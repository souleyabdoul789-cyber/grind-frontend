import { useEffect, useRef, useState } from "react";
import { obtenirIdentifiantsTurn, urlSession } from "../api.js";
import { creerDetecteurParole } from "../lib/detecteurParole.js";

/**
 * SalleClasse — une seule connexion WebSocket pour toute la salle, qui
 * porte à la fois la signalisation audio (WebRTC) et la synchronisation
 * de la feuille. Deux sockets séparées sur le même {classe_id} pour le
 * même utilisateur se marcheraient dessus côté serveur (une seule entrée
 * par username dans la salle) — d'où la fusion en un seul composant.
 *
 * Confidentialité des feuilles : chacun voit la sienne par défaut. Pour
 * voir celle d'un autre, il faut lui envoyer une demande — cette
 * personne doit l'autoriser explicitement avant que son contenu ne soit
 * partagé, en direct, tant que l'autorisation n'est pas retirée.
 *
 * Limite assumée pour l'instant : avec plus de deux personnes dans une
 * salle, l'autorisation est donnée par le propriétaire de la feuille
 * lui-même, pas par le "chef de classe" comme prévu à terme — à revoir
 * quand la salle gérera vraiment plus de deux participants.
 */
export default function SalleClasse({ sessionToken, demandeId, monUsername, onQuitter }) {
  // ---- États audio, séparés comme validé à l'étape précédente ----
  const [permission, setPermission] = useState("attente");
  const [microActif, setMicroActif] = useState(true);
  const [jeParle, setJeParle] = useState(false);
  const [connexion, setConnexion] = useState("connexion");
  const [autreUsername, setAutreUsername] = useState(null);
  const [autreMicroActif, setAutreMicroActif] = useState(null);
  const [autreParle, setAutreParle] = useState(false);
  const [erreur, setErreur] = useState(null);

  // ---- États feuille ----
  const [monTexte, setMonTexte] = useState("");
  const [viewerAutorise, setViewerAutorise] = useState(null); // qui peut voir MA feuille
  const [demandeRecue, setDemandeRecue] = useState(null); // qui me demande de voir la sienne
  const [autorisationObtenue, setAutorisationObtenue] = useState(false); // je peux voir la SIENNE
  const [autorisationRefusee, setAutorisationRefusee] = useState(false);
  const [demandeEnvoyee, setDemandeEnvoyee] = useState(false);
  const [texteDistant, setTexteDistant] = useState("");
  const [ongletFeuille, setOngletFeuille] = useState("moi"); // "moi" | "autre"

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const streamLocalRef = useRef(null);
  const audioDistantRef = useRef(null);
  const autreUsernameRef = useRef(null);
  const arreterDetecteurLocalRef = useRef(null);
  const arreterDetecteurDistantRef = useRef(null);
  const viewerAutoriseRef = useRef(null);
  const delaiEnvoiRef = useRef(null);

  function envoyer(msg) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }

  async function demanderMicro() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamLocalRef.current = stream;
      setPermission("accordee");
      setMicroActif(true);
      arreterDetecteurLocalRef.current = creerDetecteurParole(stream, setJeParle);

      const pc = pcRef.current;
      if (pc) {
        stream.getTracks().forEach((piste) => pc.addTrack(piste, stream));
        if (autreUsernameRef.current) {
          const offre = await pc.createOffer();
          await pc.setLocalDescription(offre);
          envoyer({ type: "webrtc-offer", cible: autreUsernameRef.current, sdp: offre });
        }
      }
    } catch {
      setPermission("refusee");
    }
  }

  useEffect(() => {
    let arrete = false;

    async function demarrer() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (arrete) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamLocalRef.current = stream;
        setPermission("accordee");
        arreterDetecteurLocalRef.current = creerDetecteurParole(stream, setJeParle);
      } catch {
        setPermission("refusee");
      }

      let identifiantsTurn;
      try {
        identifiantsTurn = await obtenirIdentifiantsTurn(sessionToken);
      } catch {
        setErreur("Configuration audio indisponible côté serveur");
        setConnexion("echec");
        return;
      }
      if (arrete) return;

      const socket = new WebSocket(urlSession(sessionToken, demandeId));
      socketRef.current = socket;

      socket.onopen = () => {
        setConnexion("attente_pair");
        socket.send(JSON.stringify({ type: "ready" }));
      };
      socket.onerror = () => setErreur("Connexion au serveur impossible");
      socket.onclose = () => { if (!arrete) setConnexion("echec"); };

      socket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        // ---- Départ du pair : on efface tout son état, audio et feuille ----
        if (msg.type === "peer-parti" && msg.sender === autreUsernameRef.current) {
          setAutreUsername(null);
          setAutreMicroActif(null);
          setAutreParle(false);
          setConnexion("attente_pair");
          setAutorisationObtenue(false);
          setViewerAutorise(null);
          setDemandeRecue(null);
          setTexteDistant("");
          arreterDetecteurDistantRef.current?.();
          arreterDetecteurDistantRef.current = null;
          pcRef.current?.close();
          pcRef.current = null;
          autreUsernameRef.current = null;
          viewerAutoriseRef.current = null;
          return;
        }

        if (msg.type === "etat-micro" && msg.sender === autreUsernameRef.current) {
          setAutreMicroActif(msg.actif);
          return;
        }

        // ---- Feuille ----
        if (msg.type === "demande-voir-feuille") {
          setDemandeRecue(msg.sender);
          return;
        }
        if (msg.type === "autorisation-voir-feuille") {
          setDemandeEnvoyee(false);
          if (msg.autorise) {
            setAutorisationObtenue(true);
          } else {
            setAutorisationRefusee(true);
          }
          return;
        }
        if (msg.type === "sheet-update" && (msg.sender === viewerAutoriseRef.current || msg.sender === autreUsernameRef.current)) {
          setTexteDistant(msg.contenu);
          return;
        }

        // ---- Signalisation WebRTC (identique à l'étape précédente) ----
        if (msg.type === "ready" && !autreUsernameRef.current) {
          autreUsernameRef.current = msg.sender;
          setAutreUsername(msg.sender);
          setAutreMicroActif(true);

          if (monUsername < msg.sender) {
            await creerConnexionPair(identifiantsTurn.iceServers, streamLocalRef.current, socket, msg.sender);
            const offre = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offre);
            socket.send(JSON.stringify({ type: "webrtc-offer", cible: msg.sender, sdp: offre }));
          } else {
            await creerConnexionPair(identifiantsTurn.iceServers, streamLocalRef.current, socket, msg.sender);
          }
        }

        if (msg.type === "webrtc-offer") {
          autreUsernameRef.current = msg.sender;
          setAutreUsername(msg.sender);
          setAutreMicroActif((v) => v ?? true);
          if (!pcRef.current) await creerConnexionPair(identifiantsTurn.iceServers, streamLocalRef.current, socket, msg.sender);
          await pcRef.current.setRemoteDescription(msg.sdp);
          const reponse = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(reponse);
          socket.send(JSON.stringify({ type: "webrtc-answer", cible: msg.sender, sdp: reponse }));
        }

        if (msg.type === "webrtc-answer" && pcRef.current) {
          await pcRef.current.setRemoteDescription(msg.sdp);
        }

        if (msg.type === "webrtc-ice" && pcRef.current && msg.candidate) {
          try { await pcRef.current.addIceCandidate(msg.candidate); } catch {}
        }
      };
    }

    async function creerConnexionPair(iceServers, streamLocal, socket, destinataire) {
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      if (streamLocal) {
        streamLocal.getTracks().forEach((piste) => pc.addTrack(piste, streamLocal));
      } else {
        pc.addTransceiver("audio", { direction: "recvonly" });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.send(JSON.stringify({ type: "webrtc-ice", cible: destinataire, candidate: e.candidate }));
      };
      pc.ontrack = (e) => {
        const streamDistant = e.streams[0];
        if (audioDistantRef.current) audioDistantRef.current.srcObject = streamDistant;
        setConnexion("connecte");
        arreterDetecteurDistantRef.current?.();
        arreterDetecteurDistantRef.current = creerDetecteurParole(streamDistant, setAutreParle);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setConnexion("connecte");
        else if (pc.connectionState === "disconnected") setConnexion("reconnexion");
        else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setConnexion((c) => (c === "connecte" || c === "reconnexion" ? "echec" : c));
        }
      };
    }

    demarrer();

    return () => {
      arrete = true;
      socketRef.current?.close();
      pcRef.current?.close();
      streamLocalRef.current?.getTracks().forEach((t) => t.stop());
      arreterDetecteurLocalRef.current?.();
      arreterDetecteurDistantRef.current?.();
      clearTimeout(delaiEnvoiRef.current);
    };
  }, []);

  function basculerMicro() {
    if (permission !== "accordee") return;
    const nouvelEtat = !microActif;
    setMicroActif(nouvelEtat);
    streamLocalRef.current?.getAudioTracks().forEach((t) => (t.enabled = nouvelEtat));
    envoyer({ type: "etat-micro", actif: nouvelEtat });
  }

  function raccrocher() {
    socketRef.current?.close();
    pcRef.current?.close();
    streamLocalRef.current?.getTracks().forEach((t) => t.stop());
    onQuitter();
  }

  // ---- Feuille : je tape, j'envoie seulement si quelqu'un est autorisé ----
  function gererSaisie(valeur) {
    setMonTexte(valeur);
    if (!viewerAutoriseRef.current) return;
    clearTimeout(delaiEnvoiRef.current);
    delaiEnvoiRef.current = setTimeout(() => {
      envoyer({ type: "sheet-update", cible: viewerAutoriseRef.current, contenu: valeur });
    }, 200);
  }

  function autoriserDemande() {
    if (!demandeRecue) return;
    viewerAutoriseRef.current = demandeRecue;
    setViewerAutorise(demandeRecue);
    envoyer({ type: "autorisation-voir-feuille", cible: demandeRecue, autorise: true });
    envoyer({ type: "sheet-update", cible: demandeRecue, contenu: monTexte });
    setDemandeRecue(null);
  }

  function refuserDemande() {
    if (!demandeRecue) return;
    envoyer({ type: "autorisation-voir-feuille", cible: demandeRecue, autorise: false });
    setDemandeRecue(null);
  }

  function retirerAcces() {
    viewerAutoriseRef.current = null;
    setViewerAutorise(null);
  }

  function demanderAVoir() {
    if (!autreUsername) return;
    setDemandeEnvoyee(true);
    setAutorisationRefusee(false);
    envoyer({ type: "demande-voir-feuille", cible: autreUsername });
  }

  let iconeMicro = "fa-solid fa-microphone";
  let classeMicro = "bouton-micro";
  if (permission === "attente") iconeMicro = "fa-solid fa-spinner fa-spin";
  else if (permission === "refusee") { iconeMicro = "fa-solid fa-microphone-slash"; classeMicro += " bouton-micro-refuse"; }
  else if (!microActif) { iconeMicro = "fa-solid fa-microphone-slash"; classeMicro += " bouton-micro-coupe"; }
  else if (jeParle) { iconeMicro = "fa-solid fa-microphone"; classeMicro += " bouton-micro-actif bouton-micro-parle"; }
  else { iconeMicro = "fa-solid fa-microphone"; classeMicro += " bouton-micro-actif"; }

  return (
    <div className="salle-classe">
      <audio ref={audioDistantRef} autoPlay />

      <div className="statut-appel">
        {connexion === "connexion" && <><i className="fa-solid fa-spinner fa-spin"></i> Préparation...</>}
        {connexion === "attente_pair" && <><i className="fa-solid fa-ellipsis"></i> En attente d'un autre membre...</>}
        {connexion === "connecte" && <><i className="fa-solid fa-circle" style={{ color: "var(--succes)", fontSize: 10 }}></i> Connecté{autreUsername ? ` avec ${autreUsername}` : ""}</>}
        {connexion === "reconnexion" && <><i className="fa-solid fa-rotate fa-spin"></i> Reconnexion...</>}
        {connexion === "echec" && <><i className="fa-solid fa-triangle-exclamation"></i> {erreur || "Connexion interrompue"}</>}
      </div>

      {permission === "refusee" && (
        <div className="info">
          <i className="fa-solid fa-circle-info"></i> Micro refusé — tu peux écouter, pas parler.
          <button type="button" className="lien" onClick={demanderMicro}>Autoriser le micro</button>
        </div>
      )}

      {autreUsername && (
        <div className="carte-participant">
          <div className={`avatar-participant ${autreParle ? "avatar-parle" : ""}`}>
            <i className="fa-solid fa-user"></i>
          </div>
          <div>
            <div className="auteur-post">{autreUsername}</div>
            <div className="etat-micro-participant">
              {autreMicroActif === false ? <><i className="fa-solid fa-microphone-slash"></i> Micro coupé</>
                : autreParle ? <><i className="fa-solid fa-microphone"></i> Parle</>
                : <><i className="fa-solid fa-microphone"></i> Silencieux</>}
            </div>
          </div>
        </div>
      )}

      <div className="controles-appel">
        <button className={classeMicro} onClick={basculerMicro} type="button" disabled={permission === "attente"}>
          <i className={iconeMicro}></i>
        </button>
        <button className="bouton-appel bouton-raccrocher" onClick={raccrocher} type="button">
          <i className="fa-solid fa-phone-slash"></i>
        </button>
      </div>

      {/* ================= Feuille collaborative ================= */}
      <div className="bloc-feuille">
        <div className="onglets-feuille">
          <button className={ongletFeuille === "moi" ? "onglet-feuille onglet-feuille-actif" : "onglet-feuille"} onClick={() => setOngletFeuille("moi")} type="button">
            <i className="fa-solid fa-file-lines"></i> Ma feuille
          </button>
          {autreUsername && (
            <button className={ongletFeuille === "autre" ? "onglet-feuille onglet-feuille-actif" : "onglet-feuille"} onClick={() => setOngletFeuille("autre")} type="button">
              <i className="fa-solid fa-eye"></i> Feuille de {autreUsername}
            </button>
          )}
        </div>

        {demandeRecue && (
          <div className="banniere-demande">
            <i className="fa-solid fa-eye"></i> {demandeRecue} veut voir ta feuille
            <button type="button" onClick={autoriserDemande}>Autoriser</button>
            <button type="button" className="bouton-retour" onClick={refuserDemande}>Refuser</button>
          </div>
        )}

        {ongletFeuille === "moi" && (
          <>
            <textarea
              className="feuille-textarea"
              value={monTexte}
              onChange={(e) => gererSaisie(e.target.value)}
              placeholder="Écris ici — privé, sauf si tu autorises quelqu'un à voir"
              rows={8}
            />
            {viewerAutorise ? (
              <div className="info">
                <i className="fa-solid fa-eye"></i> Visible par {viewerAutorise}
                <button type="button" className="lien" onClick={retirerAcces}>Retirer l'accès</button>
              </div>
            ) : (
              <div className="info"><i className="fa-solid fa-lock"></i> Privée, personne ne la voit</div>
            )}
          </>
        )}

        {ongletFeuille === "autre" && (
          <>
            {autorisationObtenue ? (
              <textarea className="feuille-textarea" value={texteDistant} readOnly rows={8} placeholder="En attente de contenu..." />
            ) : demandeEnvoyee ? (
              <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Demande envoyée, en attente...</div>
            ) : autorisationRefusee ? (
              <div className="erreur"><i className="fa-solid fa-lock"></i> Accès refusé</div>
            ) : (
              <button type="button" onClick={demanderAVoir}>
                <i className="fa-solid fa-eye"></i> Demander à voir cette feuille
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
