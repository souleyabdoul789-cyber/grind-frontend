import { useEffect, useRef, useState } from "react";
import { obtenirIdentifiantsTurn, urlSession } from "../api.js";
import { creerDetecteurParole } from "../lib/detecteurParole.js";

/**
 * États volontairement séparés, comme demandé — jamais fusionnés :
 * - permission      : "attente" | "accordee" | "refusee"      → le navigateur a-t-il donné le micro ?
 * - microActif       : bool                                    → l'utilisateur veut-il émettre du son ?
 * - jeParle          : bool                                    → le niveau audio local dépasse le seuil, là maintenant
 * - connexion        : "connexion"|"attente_pair"|"connecte"|"reconnexion"|"echec" → état de la RTCPeerConnection
 * - autreMicroActif  : bool|null                                → ce que le pair a signalé de son côté (pas déduit)
 * - autreParle       : bool                                     → niveau audio du flux DISTANT reçu
 */
export default function SalleAudio({ sessionToken, demandeId, monUsername, onQuitter }) {
  const [permission, setPermission] = useState("attente");
  const [microActif, setMicroActif] = useState(true);
  const [jeParle, setJeParle] = useState(false);
  const [connexion, setConnexion] = useState("connexion");

  const [autreUsername, setAutreUsername] = useState(null);
  const [autreMicroActif, setAutreMicroActif] = useState(null);
  const [autreParle, setAutreParle] = useState(false);
  const [erreur, setErreur] = useState(null);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const streamLocalRef = useRef(null);
  const audioDistantRef = useRef(null);
  const autreUsernameRef = useRef(null);
  const arreterDetecteurLocalRef = useRef(null);
  const arreterDetecteurDistantRef = useRef(null);

  useEffect(() => {
    let arrete = false;

    async function demarrer() {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (arrete) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamLocalRef.current = stream;
        setPermission("accordee");

        arreterDetecteurLocalRef.current = creerDetecteurParole(stream, (parle) => {
          setJeParle(parle);
        });
      } catch (err) {
        setPermission("refusee");
        // Spec : un refus ne doit pas empêcher de rester dans la classe,
        // juste passer en réception seule (on entend, on n'émet pas).
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
      socket.onclose = () => {
        if (!arrete) setConnexion("echec");
      };

      socket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "peer-parti" && msg.sender === autreUsernameRef.current) {
          setAutreUsername(null);
          setAutreMicroActif(null);
          setAutreParle(false);
          setConnexion("attente_pair");
          if (arreterDetecteurDistantRef.current) {
            arreterDetecteurDistantRef.current();
            arreterDetecteurDistantRef.current = null;
          }
          pcRef.current?.close();
          pcRef.current = null;
          autreUsernameRef.current = null;
          return;
        }

        if (msg.type === "etat-micro" && msg.sender === autreUsernameRef.current) {
          setAutreMicroActif(msg.actif);
          return;
        }

        if (msg.type === "ready" && !autreUsernameRef.current) {
          autreUsernameRef.current = msg.sender;
          setAutreUsername(msg.sender);
          setAutreMicroActif(true); // hypothèse par défaut tant qu'aucun signal contraire

          if (monUsername < msg.sender) {
            await creerConnexionPair(identifiantsTurn.iceServers, stream, socket, msg.sender);
            const offre = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offre);
            socket.send(JSON.stringify({ type: "webrtc-offer", cible: msg.sender, sdp: offre }));
          } else {
            await creerConnexionPair(identifiantsTurn.iceServers, stream, socket, msg.sender);
          }
        }

        if (msg.type === "webrtc-offer") {
          autreUsernameRef.current = msg.sender;
          setAutreUsername(msg.sender);
          setAutreMicroActif((v) => v ?? true);
          if (!pcRef.current) await creerConnexionPair(identifiantsTurn.iceServers, stream, socket, msg.sender);
          await pcRef.current.setRemoteDescription(msg.sdp);
          const reponse = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(reponse);
          socket.send(JSON.stringify({ type: "webrtc-answer", cible: msg.sender, sdp: reponse }));
        }

        if (msg.type === "webrtc-answer" && pcRef.current) {
          await pcRef.current.setRemoteDescription(msg.sdp);
        }

        if (msg.type === "webrtc-ice" && pcRef.current && msg.candidate) {
          try {
            await pcRef.current.addIceCandidate(msg.candidate);
          } catch {
            // candidat arrivé trop tôt/tard — sans conséquence si la connexion aboutit
          }
        }
      };
    }

    async function creerConnexionPair(iceServers, streamLocal, socket, destinataire) {
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      if (streamLocal) {
        streamLocal.getTracks().forEach((piste) => pc.addTrack(piste, streamLocal));
      } else {
        // Permission refusée : on reçoit quand même l'audio de l'autre,
        // on n'en émet juste aucun — la classe n'est pas bloquée pour autant.
        pc.addTransceiver("audio", { direction: "recvonly" });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.send(JSON.stringify({ type: "webrtc-ice", cible: destinataire, candidate: e.candidate }));
        }
      };

      pc.ontrack = (e) => {
        const streamDistant = e.streams[0];
        if (audioDistantRef.current) audioDistantRef.current.srcObject = streamDistant;
        setConnexion("connecte");

        if (arreterDetecteurDistantRef.current) arreterDetecteurDistantRef.current();
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
    };
  }, []);

  function basculerMicro() {
    if (permission !== "accordee") return;
    const nouvelEtat = !microActif;
    setMicroActif(nouvelEtat);
    streamLocalRef.current?.getAudioTracks().forEach((t) => (t.enabled = nouvelEtat));
    socketRef.current?.send(JSON.stringify({ type: "etat-micro", actif: nouvelEtat }));
  }

  function raccrocher() {
    socketRef.current?.close();
    pcRef.current?.close();
    streamLocalRef.current?.getTracks().forEach((t) => t.stop());
    onQuitter();
  }

  // ---- Rendu de l'icône/état du bouton micro — les 4 états demandés ----
  let iconeMicro = "fa-solid fa-microphone";
  let classeMicro = "bouton-micro";
  if (permission === "attente") {
    iconeMicro = "fa-solid fa-spinner fa-spin";
  } else if (permission === "refusee") {
    iconeMicro = "fa-solid fa-microphone-slash";
    classeMicro += " bouton-micro-refuse";
  } else if (!microActif) {
    iconeMicro = "fa-solid fa-microphone-slash";
    classeMicro += " bouton-micro-coupe";
  } else if (jeParle) {
    iconeMicro = "fa-solid fa-microphone";
    classeMicro += " bouton-micro-actif bouton-micro-parle";
  } else {
    iconeMicro = "fa-solid fa-microphone";
    classeMicro += " bouton-micro-actif";
  }

  return (
    <div className="salle-audio">
      <audio ref={audioDistantRef} autoPlay />

      <div className="statut-appel">
        {connexion === "connexion" && <><i className="fa-solid fa-spinner fa-spin"></i> Préparation...</>}
        {connexion === "attente_pair" && <><i className="fa-solid fa-ellipsis"></i> En attente d'un autre membre de la classe...</>}
        {connexion === "connecte" && <><i className="fa-solid fa-circle" style={{ color: "var(--succes)", fontSize: 10 }}></i> Connecté{autreUsername ? ` avec ${autreUsername}` : ""}</>}
        {connexion === "reconnexion" && <><i className="fa-solid fa-rotate fa-spin"></i> Reconnexion en cours...</>}
        {connexion === "echec" && <><i className="fa-solid fa-triangle-exclamation"></i> {erreur || "Connexion audio interrompue"}</>}
      </div>

      {permission === "refusee" && (
        <div className="info">
          <i className="fa-solid fa-circle-info"></i>
          Micro refusé — tu peux quand même écouter, mais pas parler.
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
              {autreMicroActif === false ? (
                <><i className="fa-solid fa-microphone-slash"></i> Micro coupé</>
              ) : autreParle ? (
                <><i className="fa-solid fa-microphone"></i> Parle</>
              ) : (
                <><i className="fa-solid fa-microphone"></i> Silencieux</>
              )}
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
    </div>
  );
}
