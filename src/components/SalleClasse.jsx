import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { obtenirJetonLiveKit, urlSession, obtenirAvatarDe, transfererProf } from "../api.js";
import AvatarPersonnage from "./AvatarPersonnage.jsx";

/**
 * SalleClasse — audio à N personnes via LiveKit (notre WebRTC fait
 * main de l'étape précédente ne tenait qu'à deux). LiveKit gère pour
 * nous : la connexion, la détection de qui parle réellement (pas
 * juste le volume brut), l'état micro de chacun, les arrivées/départs.
 *
 * Notre propre canal WebSocket (/ws/session/{classe_id}) reste utilisé,
 * mais seulement pour ce que LiveKit ne fait pas : la feuille
 * collaborative et la demande/transfert du rôle de prof.
 */
export default function SalleClasse({ sessionToken, demandeId, monUsername, profInitial, onQuitter }) {
  const [permission, setPermission] = useState("attente");
  const [microActif, setMicroActif] = useState(true);
  const [connexion, setConnexion] = useState("connexion");
  const [erreur, setErreur] = useState(null);

  const [participants, setParticipants] = useState([]); // [{identity, avatarConfig, micActif}]
  const [parlants, setParlants] = useState(new Set());

  const [profActuel, setProfActuel] = useState(profInitial);
  const [demandeProfRecue, setDemandeProfRecue] = useState(null);
  const [demandeProfEnvoyee, setDemandeProfEnvoyee] = useState(false);

  const [ongletFeuille, setOngletFeuille] = useState("moi");
  const [monTexte, setMonTexte] = useState("");
  const [mesViewers, setMesViewers] = useState(new Set());
  const [demandesRecues, setDemandesRecues] = useState([]);
  const [demandesEnvoyees, setDemandesEnvoyees] = useState(new Set());
  const [feuillesAutorisees, setFeuillesAutorisees] = useState({}); // { username: texte }
  const [participantSelectionne, setParticipantSelectionne] = useState(null);

  const roomRef = useRef(null);
  const socketRef = useRef(null);
  const avatarsCacheRef = useRef({});
  const mesViewersRef = useRef(new Set());
  const elementsAudioRef = useRef({});
  const delaiEnvoiRef = useRef(null);

  const estProf = profActuel === monUsername;

  function envoyer(msg) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }

  async function chargerAvatar(identity) {
    if (avatarsCacheRef.current[identity]) return avatarsCacheRef.current[identity];
    const res = await obtenirAvatarDe(identity);
    avatarsCacheRef.current[identity] = res.config;
    return res.config;
  }

  async function ajouterParticipant(identity) {
    const avatarConfig = await chargerAvatar(identity);
    setParticipants((prev) => {
      if (prev.some((p) => p.identity === identity)) return prev;
      return [...prev, { identity, avatarConfig, micActif: true }];
    });
  }

  function retirerParticipant(identity) {
    setParticipants((prev) => prev.filter((p) => p.identity !== identity));
    setParlants((prev) => {
      const s = new Set(prev);
      s.delete(identity);
      return s;
    });
    setFeuillesAutorisees((prev) => {
      const { [identity]: _retire, ...reste } = prev;
      return reste;
    });
    setDemandesRecues((prev) => prev.filter((u) => u !== identity));
    mesViewersRef.current.delete(identity);
    setMesViewers(new Set(mesViewersRef.current));
  }

  useEffect(() => {
    let arrete = false;

    async function demarrer() {
      // ---- WebSocket : feuille + transfert de prof ----
      const socket = new WebSocket(urlSession(sessionToken, demandeId));
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "sheet-update") {
          setFeuillesAutorisees((prev) =>
            prev[msg.sender] !== undefined ? { ...prev, [msg.sender]: msg.contenu } : prev
          );
        }
        if (msg.type === "demande-voir-feuille") {
          setDemandesRecues((prev) => (prev.includes(msg.sender) ? prev : [...prev, msg.sender]));
        }
        if (msg.type === "autorisation-voir-feuille") {
          setDemandesEnvoyees((prev) => {
            const s = new Set(prev);
            s.delete(msg.sender);
            return s;
          });
          if (msg.autorise) {
            setFeuillesAutorisees((prev) => ({ ...prev, [msg.sender]: "" }));
          }
        }
        if (msg.type === "demande-devenir-prof") {
          setDemandeProfRecue(msg.sender);
        }
        if (msg.type === "reponse-devenir-prof") {
          setDemandeProfEnvoyee(false);
          if (msg.accepte) {
            setProfActuel(monUsername);
          }
        }
        if (msg.type === "prof-change") {
          setProfActuel(msg.nouveau_prof);
        }
      };

      // ---- LiveKit : audio à N personnes ----
      let jetonData;
      try {
        jetonData = await obtenirJetonLiveKit(sessionToken, demandeId);
      } catch (err) {
        setErreur(err.message);
        setConnexion("echec");
        return;
      }
      if (arrete) return;

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, (p) => ajouterParticipant(p.identity));
      room.on(RoomEvent.ParticipantDisconnected, (p) => retirerParticipant(p.identity));

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setParlants(new Set(speakers.map((p) => p.identity)));
      });

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          document.body.appendChild(el);
          elementsAudioRef.current[participant.identity] = el;
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
      });

      room.on(RoomEvent.TrackMuted, (_pub, participant) => {
        setParticipants((prev) => prev.map((p) => (p.identity === participant.identity ? { ...p, micActif: false } : p)));
      });
      room.on(RoomEvent.TrackUnmuted, (_pub, participant) => {
        setParticipants((prev) => prev.map((p) => (p.identity === participant.identity ? { ...p, micActif: true } : p)));
      });

      room.on(RoomEvent.Disconnected, () => {
        if (!arrete) setConnexion("echec");
      });

      try {
        await room.connect(jetonData.url, jetonData.token);
      } catch (err) {
        setErreur("Connexion à la salle impossible");
        setConnexion("echec");
        return;
      }
      if (arrete) return;
      setConnexion("connecte");

      for (const p of room.remoteParticipants.values()) {
        ajouterParticipant(p.identity);
      }

      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setPermission("accordee");
      } catch {
        setPermission("refusee");
      }
    }

    demarrer();

    return () => {
      arrete = true;
      socketRef.current?.close();
      roomRef.current?.disconnect();
      Object.values(elementsAudioRef.current).forEach((el) => el.remove());
      clearTimeout(delaiEnvoiRef.current);
    };
  }, []);

  async function demanderMicro() {
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(true);
      setPermission("accordee");
      setMicroActif(true);
    } catch {
      setPermission("refusee");
    }
  }

  async function basculerMicro() {
    if (permission !== "accordee") return;
    const nouvelEtat = !microActif;
    setMicroActif(nouvelEtat);
    await roomRef.current?.localParticipant.setMicrophoneEnabled(nouvelEtat);
  }

  function raccrocher() {
    socketRef.current?.close();
    roomRef.current?.disconnect();
    onQuitter();
  }

  // ---- Feuille ----
  function gererSaisie(valeur) {
    setMonTexte(valeur);
    clearTimeout(delaiEnvoiRef.current);
    delaiEnvoiRef.current = setTimeout(() => {
      mesViewersRef.current.forEach((cible) => {
        envoyer({ type: "sheet-update", cible, contenu: valeur });
      });
    }, 200);
  }

  function autoriserDemande(demandeur) {
    mesViewersRef.current.add(demandeur);
    setMesViewers(new Set(mesViewersRef.current));
    envoyer({ type: "autorisation-voir-feuille", cible: demandeur, autorise: true });
    envoyer({ type: "sheet-update", cible: demandeur, contenu: monTexte });
    setDemandesRecues((prev) => prev.filter((u) => u !== demandeur));
  }

  function refuserDemande(demandeur) {
    envoyer({ type: "autorisation-voir-feuille", cible: demandeur, autorise: false });
    setDemandesRecues((prev) => prev.filter((u) => u !== demandeur));
  }

  function retirerAcces(viewer) {
    mesViewersRef.current.delete(viewer);
    setMesViewers(new Set(mesViewersRef.current));
  }

  function demanderAVoir(identity) {
    setDemandesEnvoyees((prev) => new Set(prev).add(identity));
    envoyer({ type: "demande-voir-feuille", cible: identity });
  }

  // ---- Transfert de prof ----
  function demanderDevenirProf() {
    setDemandeProfEnvoyee(true);
    envoyer({ type: "demande-devenir-prof", cible: profActuel });
  }

  async function accepterTransfertProf() {
    const nouveau = demandeProfRecue;
    try {
      await transfererProf(sessionToken, demandeId, nouveau);
      setProfActuel(nouveau);
      setDemandeProfRecue(null);
      envoyer({ type: "reponse-devenir-prof", cible: nouveau, accepte: true });
      envoyer({ type: "prof-change", nouveau_prof: nouveau });
    } catch (err) {
      setErreur(err.message);
    }
  }

  function refuserTransfertProf() {
    envoyer({ type: "reponse-devenir-prof", cible: demandeProfRecue, accepte: false });
    setDemandeProfRecue(null);
  }

  let iconeMicro = "fa-solid fa-microphone";
  let classeMicro = "bouton-micro";
  if (permission === "attente") iconeMicro = "fa-solid fa-spinner fa-spin";
  else if (permission === "refusee") { iconeMicro = "fa-solid fa-microphone-slash"; classeMicro += " bouton-micro-refuse"; }
  else if (!microActif) { iconeMicro = "fa-solid fa-microphone-slash"; classeMicro += " bouton-micro-coupe"; }
  else if (parlants.has(monUsername)) { iconeMicro = "fa-solid fa-microphone"; classeMicro += " bouton-micro-actif bouton-micro-parle"; }
  else { iconeMicro = "fa-solid fa-microphone"; classeMicro += " bouton-micro-actif"; }

  const placesVides = Math.max(0, 9 - participants.length);

  return (
    <div className="salle-classe">
      <div className="statut-appel">
        {connexion === "connexion" && <><i className="fa-solid fa-spinner fa-spin"></i> Préparation...</>}
        {connexion === "connecte" && <><i className="fa-solid fa-circle" style={{ color: "var(--succes)", fontSize: 10 }}></i> Connecté — {participants.length + 1}/10</>}
        {connexion === "echec" && <><i className="fa-solid fa-triangle-exclamation"></i> {erreur || "Connexion interrompue"}</>}
      </div>

      {permission === "refusee" && (
        <div className="info">
          <i className="fa-solid fa-circle-info"></i> Micro refusé — tu peux écouter, pas parler.
          <button type="button" className="lien" onClick={demanderMicro}>Autoriser le micro</button>
        </div>
      )}

      {demandeProfRecue && (
        <div className="banniere-demande">
          <i className="fa-solid fa-chalkboard-user"></i> {demandeProfRecue} veut devenir prof
          <button type="button" onClick={accepterTransfertProf}>Accepter</button>
          <button type="button" className="bouton-retour" onClick={refuserTransfertProf}>Refuser</button>
        </div>
      )}

      {/* ---- Grille des bureaux ---- */}
      <div className="grille-bureaux">
        <div className="bureau-occupe bureau-moi">
          <AvatarPersonnage config={avatarsCacheRef.current[monUsername]} parle={parlants.has(monUsername)} taille={64} />
          <div className="nom-bureau">{monUsername} {estProf && <i className="fa-solid fa-star" title="Prof"></i>}</div>
          <i className={microActif ? "fa-solid fa-microphone" : "fa-solid fa-microphone-slash"}></i>
        </div>

        {participants.map((p) => (
          <div key={p.identity} className="bureau-occupe">
            <AvatarPersonnage config={p.avatarConfig} parle={parlants.has(p.identity)} taille={64} />
            <div className="nom-bureau">{p.identity} {profActuel === p.identity && <i className="fa-solid fa-star" title="Prof"></i>}</div>
            <i className={p.micActif ? "fa-solid fa-microphone" : "fa-solid fa-microphone-slash"}></i>
          </div>
        ))}

        {Array.from({ length: placesVides }).map((_, i) => (
          <div key={`vide-${i}`} className="bureau-vide"><i className="fa-regular fa-circle"></i></div>
        ))}
      </div>

      <div className="controles-appel">
        <button className={classeMicro} onClick={basculerMicro} type="button" disabled={permission === "attente"}>
          <i className={iconeMicro}></i>
        </button>
        <button className="bouton-appel bouton-raccrocher" onClick={raccrocher} type="button">
          <i className="fa-solid fa-phone-slash"></i>
        </button>
      </div>

      {!estProf && !demandeProfEnvoyee && (
        <button type="button" className="lien" onClick={demanderDevenirProf}>
          <i className="fa-solid fa-chalkboard-user"></i> Demander à devenir prof
        </button>
      )}
      {demandeProfEnvoyee && <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Demande envoyée...</div>}

      {/* ---- Feuille collaborative ---- */}
      <div className="bloc-feuille">
        <div className="onglets-feuille">
          <button className={ongletFeuille === "moi" ? "onglet-feuille onglet-feuille-actif" : "onglet-feuille"} onClick={() => setOngletFeuille("moi")} type="button">
            <i className="fa-solid fa-file-lines"></i> Ma feuille
          </button>
          <button className={ongletFeuille === "autres" ? "onglet-feuille onglet-feuille-actif" : "onglet-feuille"} onClick={() => setOngletFeuille("autres")} type="button">
            <i className="fa-solid fa-eye"></i> Feuilles
          </button>
        </div>

        {demandesRecues.map((d) => (
          <div key={d} className="banniere-demande">
            <i className="fa-solid fa-eye"></i> {d} veut voir ta feuille
            <button type="button" onClick={() => autoriserDemande(d)}>Autoriser</button>
            <button type="button" className="bouton-retour" onClick={() => refuserDemande(d)}>Refuser</button>
          </div>
        ))}

        {ongletFeuille === "moi" && (
          <>
            <textarea className="feuille-textarea" value={monTexte} onChange={(e) => gererSaisie(e.target.value)} placeholder="Écris ici — privé, sauf si tu autorises quelqu'un" rows={6} />
            {mesViewers.size > 0 ? (
              <div className="choix-categorie" style={{ flexWrap: "wrap" }}>
                {[...mesViewers].map((v) => (
                  <span key={v} className="chip">
                    {v} <button type="button" className="lien" onClick={() => retirerAcces(v)} style={{ marginLeft: 6 }}>×</button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="info"><i className="fa-solid fa-lock"></i> Privée, personne ne la voit</div>
            )}
          </>
        )}

        {ongletFeuille === "autres" && (
          <>
            {participants.length === 0 && <div className="info">Personne d'autre dans la salle.</div>}
            {participants.map((p) => (
              <div key={p.identity} className="carte-post" style={{ marginBottom: 10 }}>
                <div className="auteur-post">{p.identity}</div>
                {feuillesAutorisees[p.identity] !== undefined ? (
                  <textarea className="feuille-textarea" value={feuillesAutorisees[p.identity]} readOnly rows={4} />
                ) : demandesEnvoyees.has(p.identity) ? (
                  <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> En attente...</div>
                ) : (
                  <button type="button" onClick={() => demanderAVoir(p.identity)}>
                    <i className="fa-solid fa-eye"></i> Demander à voir sa feuille
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
