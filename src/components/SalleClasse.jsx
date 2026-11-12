import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { obtenirJetonLiveKit, urlSession, obtenirAvatarDe, transfererProf, obtenirEtatSalle, modererMicroClasse } from "../api.js";
import SceneClasse, { NB_SIEGES } from "./SceneClasse.jsx";
import FeuillePapier from "./FeuillePapier.jsx";

/**
 * SalleClasse — audio à N personnes via LiveKit (notre WebRTC fait
 * main de l'étape précédente ne tenait qu'à deux). LiveKit gère pour
 * nous : la connexion, la détection de qui parle réellement (pas
 * juste le volume brut), l'état micro de chacun, les arrivées/départs.
 *
 * Notre propre canal WebSocket (/ws/session/{classe_id}) reste utilisé,
 * mais seulement pour ce que LiveKit ne fait pas : les feuilles privées,
 * le tableau noir partagé et la demande/transfert du rôle de professeur.
 */
export default function SalleClasse({ sessionToken, demandeId, monUsername, profInitial, nomClasse, onQuitter }) {
  const [permission, setPermission] = useState("attente");
  const [microActif, setMicroActif] = useState(true);
  const [connexion, setConnexion] = useState("connexion");
  const [erreur, setErreur] = useState(null);
  const [microAutoriseParProf, setMicroAutoriseParProf] = useState(true);
  const [microMessage, setMicroMessage] = useState("");

  const [monAvatarConfig, setMonAvatarConfig] = useState(null);
  const [participants, setParticipants] = useState([]); // [{identity, avatarConfig, micActif}]
  const [parlants, setParlants] = useState(new Set());

  const [profActuel, setProfActuel] = useState(profInitial);
  const [etatSalle, setEtatSalle] = useState(null);
  const [tableauTexte, setTableauTexte] = useState("");
  const [moderationEnCours, setModerationEnCours] = useState({});
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
  const membresSalleRef = useRef({});
  const elementsAudioRef = useRef({});
  const delaiEnvoiRef = useRef(null);
  const delaiTableauRef = useRef(null);
  const [panneauOuvert, setPanneauOuvert] = useState(false);

  const estProf = profActuel === monUsername;
  const estOwner = etatSalle?.est_owner === true;
  const [estPaysage, setEstPaysage] = useState(
    window.matchMedia("(orientation: landscape)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(orientation: landscape)");
    const gerer = (e) => setEstPaysage(e.matches);
    media.addEventListener("change", gerer);

    // Tentative de verrouillage réel — ne marche que dans certains
    // contextes (app installée/plein écran) ; sinon on se rabat sur le
    // message "tourne ton téléphone" ci-dessous, qui marche toujours.
    if (screen.orientation?.lock) {
      screen.orientation.lock("landscape").catch(() => {});
    }

    return () => {
      media.removeEventListener("change", gerer);
      if (screen.orientation?.unlock) {
        try { screen.orientation.unlock(); } catch {}
      }
    };
  }, []);

  function envoyer(msg) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }

  function appliquerTransfertProf(info) {
    const nouveauProf = info.nouveau_prof;
    if (!nouveauProf) return;
    setProfActuel(nouveauProf);
    setEtatSalle((prev) => {
      if (!prev) return prev;
      const ancienProf = info.ancien_prof;
      return {
        ...prev,
        prof_username: nouveauProf,
        membres: (prev.membres || []).map((m) => {
          if (m.username === nouveauProf) return { ...m, role: "prof", siege_index: null };
          if (m.username === ancienProf) return { ...m, role: "membre", siege_index: info.ancien_prof_siege ?? m.siege_index };
          return m;
        }),
      };
    });
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
      const membreClasse = membresSalleRef.current[identity];
      return [...prev, {
        identity,
        avatarConfig,
        micActif: false,
        microAutorise: membreClasse?.micro_autorise !== false,
      }];
    });
  }

  useEffect(() => {
    let actif = true;
    chargerAvatar(monUsername)
      .then((c) => { if (actif) setMonAvatarConfig(c); })
      .catch(() => {});
    return () => { actif = false; };
  }, [monUsername]);

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
  }

  useEffect(() => {
    let arrete = false;

    async function demarrer() {
      // L'état initial vient du serveur : roster, pupitre stable, feuille persistante et tableau.
      let etatInitial;
      try {
        etatInitial = await obtenirEtatSalle(sessionToken, demandeId);
        if (arrete) return;
        setEtatSalle(etatInitial);
        membresSalleRef.current = Object.fromEntries(
          (etatInitial.membres || []).map((m) => [m.username, m])
        );
        setProfActuel(etatInitial.prof_username || profInitial);
        setMonTexte(etatInitial.ma_feuille || "");
        mesViewersRef.current = new Set(etatInitial.mes_viewers || []);
        setMesViewers(new Set(mesViewersRef.current));
        setFeuillesAutorisees(etatInitial.feuilles_autorisees || {});
        setTableauTexte(etatInitial.tableau || "");
        const monMembre = (etatInitial.membres || []).find((m) => m.username === monUsername);
        const droitMicro = monMembre?.micro_autorise !== false;
        setMicroAutoriseParProf(droitMicro);
        if (!droitMicro) {
          setMicroActif(false);
          setMicroMessage("Le professeur a temporairement coupé ton micro. Tu peux toujours écouter la classe.");
        }
      } catch (err) {
        setErreur(err.message || "Impossible de charger les données de la salle.");
        setConnexion("echec");
        return;
      }

      // ---- WebSocket sécurisé : accès membre vérifié côté serveur ----
      const socket = new WebSocket(urlSession(sessionToken, demandeId, true));
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "micro-permission" && msg.autorise === false) {
          setMicroAutoriseParProf(false);
          if (membresSalleRef.current[monUsername]) membresSalleRef.current[monUsername].micro_autorise = false;
          roomRef.current?.localParticipant.setMicrophoneEnabled(false).catch(() => {});
          setMicroActif(false);
          setMicroMessage("Le professeur a coupé ton micro. Tu peux continuer à écouter.");
        }
        if (msg.type === "micro-permission" && msg.autorise === true) {
          // Le droit est rétabli, mais l'élève choisit lui-même de rallumer son micro.
          setMicroAutoriseParProf(true);
          if (membresSalleRef.current[monUsername]) membresSalleRef.current[monUsername].micro_autorise = true;
          setMicroActif(false);
          setMicroMessage("Ton droit de parole est rétabli. Appuie sur le micro pour parler.");
        }
        if (msg.type === "sheet-update") {
          setFeuillesAutorisees((prev) =>
            prev[msg.sender] !== undefined ? { ...prev, [msg.sender]: msg.contenu } : prev
          );
        }
        if (msg.type === "feuille-acces-revoque") {
          setFeuillesAutorisees((prev) => {
            const { [msg.sender]: _retire, ...reste } = prev;
            return reste;
          });
        }
        if (msg.type === "blackboard-update") {
          setTableauTexte(msg.contenu || "");
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
            setFeuillesAutorisees((prev) => ({ ...prev, [msg.sender]: msg.contenu || "" }));
          } else {
            setFeuillesAutorisees((prev) => {
              const { [msg.sender]: _retire, ...reste } = prev;
              return reste;
            });
          }
        }
        if (msg.type === "demande-devenir-prof") {
          setDemandeProfRecue(msg.sender);
        }
        if (msg.type === "reponse-devenir-prof") {
          setDemandeProfEnvoyee(false);
          if (msg.accepte) appliquerTransfertProf(msg);
        }
        if (msg.type === "prof-change") {
          appliquerTransfertProf(msg);
        }
      };

      try {
        await new Promise((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("Le canal sécurisé de la classe ne répond pas.")), 12000);
          socket.addEventListener("open", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
          socket.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("Connexion au canal de classe impossible.")); }, { once: true });
        });
      } catch (err) {
        setErreur(err.message);
        setConnexion("echec");
        return;
      }
      if (arrete) return;

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

      room.on(RoomEvent.TrackPublished, (publication, participant) => {
        if (publication.kind === Track.Kind.Audio) {
          setParticipants((prev) => prev.map((p) => (p.identity === participant.identity ? { ...p, micActif: !publication.isMuted } : p)));
        }
      });
      room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        if (publication.kind === Track.Kind.Audio) {
          setParticipants((prev) => prev.map((p) => (p.identity === participant.identity ? { ...p, micActif: false } : p)));
        }
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

      if (etatInitial.membres?.find((m) => m.username === monUsername)?.micro_autorise === false) {
        // Ne pas demander ni publier le micro tant que le professeur l'interdit.
        setPermission("accordee");
        setMicroActif(false);
      } else {
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          setPermission("accordee");
          setMicroActif(true);
          setMicroAutoriseParProf(true);
        } catch {
          setPermission("refusee");
        }
      }
    }

    demarrer();

    return () => {
      arrete = true;
      socketRef.current?.close();
      roomRef.current?.disconnect();
      Object.values(elementsAudioRef.current).forEach((el) => el.remove());
      clearTimeout(delaiEnvoiRef.current);
      clearTimeout(delaiTableauRef.current);
    };
  }, []);

  async function demanderMicro() {
    if (!microAutoriseParProf) {
      setMicroMessage("Le professeur doit d'abord rétablir ton droit de parole.");
      return;
    }
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(true);
      setPermission("accordee");
      setMicroActif(true);
      setMicroMessage("");
    } catch {
      setPermission("refusee");
    }
  }

  async function basculerMicro() {
    if (permission !== "accordee" || !microAutoriseParProf) {
      if (!microAutoriseParProf) setMicroMessage("Le professeur a suspendu ton droit de parole.");
      return;
    }
    const nouvelEtat = !microActif;
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(nouvelEtat);
      setMicroActif(nouvelEtat);
      setMicroMessage("");
    } catch (err) {
      setMicroActif(false);
      setMicroMessage(err?.message || "Le micro n'a pas pu être activé.");
    }
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
      envoyer({ type: "sheet-update", contenu: valeur });
    }, 220);
  }

  function gererTableau(valeur) {
    if (!estProf) return;
    setTableauTexte(valeur);
    clearTimeout(delaiTableauRef.current);
    delaiTableauRef.current = setTimeout(() => {
      envoyer({ type: "blackboard-update", contenu: valeur });
    }, 140);
  }

  function autoriserDemande(demandeur) {
    mesViewersRef.current.add(demandeur);
    setMesViewers(new Set(mesViewersRef.current));
    envoyer({ type: "autorisation-voir-feuille", cible: demandeur, autorise: true });
    setDemandesRecues((prev) => prev.filter((u) => u !== demandeur));
  }

  function refuserDemande(demandeur) {
    envoyer({ type: "autorisation-voir-feuille", cible: demandeur, autorise: false });
    setDemandesRecues((prev) => prev.filter((u) => u !== demandeur));
  }

  function retirerAcces(viewer) {
    mesViewersRef.current.delete(viewer);
    setMesViewers(new Set(mesViewersRef.current));
    envoyer({ type: "sheet-revoke", cible: viewer });
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
      const resultat = await transfererProf(sessionToken, demandeId, nouveau);
      appliquerTransfertProf({ ...resultat, ancien_prof: monUsername });
      setDemandeProfRecue(null);
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

  if (!estPaysage) {
    return (
      <div className="invite-paysage">
        <i className="fa-solid fa-mobile-screen rotation-icone"></i>
        <div className="sous-titre">Tourne ton téléphone en mode paysage</div>
        <div className="info">La vue de classe a besoin d'espace pour afficher tout le monde</div>
      </div>
    );
  }

  function choisirSiege(identity) {
    if (identity === monUsername) return;
    setParticipantSelectionne(identity);
    setOngletFeuille("autres");
    setPanneauOuvert(true);
  }

  // ---- Sièges : le serveur attribue un index persistant à chaque membre. ----
  // Tous les appareils voient donc exactement la même place ; l'ordre WebSocket n'intervient plus.
  const membresParNom = new Map((etatSalle?.membres || []).map((m) => [m.username, m]));
  const presents = [monUsername, ...participants.map((p) => p.identity)].filter((id) => id !== profActuel);

  function infosDe(id) {
    if (id === monUsername) {
      return {
        identity: id,
        config: monAvatarConfig || avatarsCacheRef.current[id] || null,
        parle: parlants.has(id),
        micActif: microActif,
        microAutorise: microAutoriseParProf,
      };
    }
    const p = participants.find((x) => x.identity === id);
    return p ? { identity: id, config: p.avatarConfig, parle: parlants.has(id), micActif: p.micActif, microAutorise: p.microAutorise } : null;
  }

  const occupants = Array.from({ length: NB_SIEGES }, () => null);
  presents.forEach((id) => {
    const i = membresParNom.get(id)?.siege_index;
    if (Number.isInteger(i) && i >= 0 && i < NB_SIEGES) occupants[i] = infosDe(id);
  });
  const profInfos = profActuel ? infosDe(profActuel) : null;

  const autresOrdonnes = [...participants].sort(
    (a, b) => (b.identity === participantSelectionne ? 1 : 0) - (a.identity === participantSelectionne ? 1 : 0)
  );

  return (
    <div className="classe-jeu">
      <SceneClasse
        occupants={occupants}
        prof={profInfos}
        nomClasse={nomClasse}
        texteTableau={tableauTexte}
        monUsername={monUsername}
        selection={participantSelectionne}
        onSelection={choisirSiege}
      />

      {/* ---- Barre d'état, en haut à gauche ---- */}
      <div className="hud hud-haut-gauche">
        <div className="hud-pastille">
          {connexion === "connexion" && <><i className="fa-solid fa-spinner fa-spin"></i> Préparation...</>}
          {connexion === "connecte" && <><i className="fa-solid fa-circle" style={{ color: "var(--succes)", fontSize: 9 }}></i> {participants.length + 1}/10</>}
          {connexion === "echec" && <><i className="fa-solid fa-triangle-exclamation"></i> {erreur || "Connexion interrompue"}</>}
        </div>
      </div>

      {/* ---- Actions, en haut à droite ---- */}
      <div className="hud hud-haut-droite">
        <button type="button" className="hud-bouton" onClick={() => setPanneauOuvert((o) => !o)}>
          <i className="fa-solid fa-file-lines"></i> Feuille
          {demandesRecues.length > 0 && <span className="hud-badge">{demandesRecues.length}</span>}
        </button>
        {estProf && <span className="hud-pastille hud-role-prof"><i className="fa-solid fa-chalkboard-user"></i> Professeur{estOwner ? " · propriétaire" : ""}</span>}
        {!estProf && !demandeProfEnvoyee && (
          <button type="button" className="hud-bouton" onClick={demanderDevenirProf}>
            <i className="fa-solid fa-chalkboard-user"></i> Demander le rôle prof
          </button>
        )}
        {demandeProfEnvoyee && (
          <div className="hud-pastille"><i className="fa-solid fa-spinner fa-spin"></i> Demande envoyée...</div>
        )}
      </div>

      {/* ---- Notifications au centre ---- */}
      <div className="hud-notifs">
        {microMessage && (
          <div className="banniere-demande banniere-micro-info" role="status">
            <i className="fa-solid fa-microphone-slash"></i> {microMessage}
            <button type="button" className="hud-bouton" onClick={() => setMicroMessage("")} aria-label="Fermer">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}
        {permission === "refusee" && microAutoriseParProf && (
          <div className="banniere-demande">
            <i className="fa-solid fa-circle-info"></i> Micro refusé — tu peux écouter, pas parler.
            <button type="button" className="hud-bouton" onClick={demanderMicro}>Autoriser le micro</button>
          </div>
        )}
        {demandeProfRecue && (
          <div className="banniere-demande">
            <i className="fa-solid fa-chalkboard-user"></i> {demandeProfRecue} veut devenir prof
            <button type="button" className="hud-bouton" onClick={accepterTransfertProf}>Accepter</button>
            <button type="button" className="hud-bouton" onClick={refuserTransfertProf}>Refuser</button>
          </div>
        )}
        {demandesRecues.map((d) => (
          <div key={d} className="banniere-demande">
            <i className="fa-solid fa-eye"></i> {d} veut voir ta feuille
            <button type="button" className="hud-bouton" onClick={() => autoriserDemande(d)}>Autoriser</button>
            <button type="button" className="hud-bouton" onClick={() => refuserDemande(d)}>Refuser</button>
          </div>
        ))}
      </div>

      {/* ---- Contrôles d'appel, en bas ---- */}
      <div className="hud hud-controles">
        <div className="controles-appel">
          <button className={classeMicro} onClick={basculerMicro} type="button" disabled={permission === "attente" || !microAutoriseParProf} aria-label={!microAutoriseParProf ? "Micro suspendu par le professeur" : microActif ? "Couper mon micro" : "Activer mon micro"}>
            <i className={iconeMicro}></i>
          </button>
          <button className="bouton-appel bouton-raccrocher" onClick={raccrocher} type="button">
            <i className="fa-solid fa-phone-slash"></i>
          </button>
        </div>
      </div>

      {/* ---- Feuille collaborative : panneau qui glisse sur le côté ---- */}
      {panneauOuvert && (
        <div className="panneau-feuille">
          <div className="panneau-feuille-entete">
            <span><i className="fa-solid fa-file-lines"></i> Feuilles</span>
            <button type="button" className="hud-bouton hud-bouton-rond" onClick={() => setPanneauOuvert(false)} aria-label="Fermer">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="bloc-feuille">
            <div className="onglets-feuille">
              <button className={ongletFeuille === "moi" ? "onglet-feuille onglet-feuille-actif" : "onglet-feuille"} onClick={() => setOngletFeuille("moi")} type="button">
                <i className="fa-solid fa-file-lines"></i> Ma feuille
              </button>
              <button className={ongletFeuille === "autres" ? "onglet-feuille onglet-feuille-actif" : "onglet-feuille"} onClick={() => setOngletFeuille("autres")} type="button">
                <i className="fa-solid fa-eye"></i> Feuilles
              </button>
              {estProf && (
                <button className={ongletFeuille === "tableau" ? "onglet-feuille onglet-feuille-actif" : "onglet-feuille"} onClick={() => setOngletFeuille("tableau")} type="button">
                  <i className="fa-solid fa-chalkboard"></i> Tableau
                </button>
              )}
            </div>

            {ongletFeuille === "moi" && (
              <>
                <FeuillePapier value={monTexte} onChange={gererSaisie} placeholder="Écris tes notes ici…" label="Ma feuille personnelle" />
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

            {ongletFeuille === "tableau" && estProf && (
              <div className="editeur-tableau-classe">
                <div className="editeur-tableau-entete">
                  <i className="fa-solid fa-chalkboard"></i>
                  <strong>Tableau de la classe</strong>
                  <span className="tableau-etat-direct"><i className="fa-solid fa-circle"></i> En direct</span>
                </div>
                <div className="tableau-apercu-panneau">{tableauTexte || "Le tableau est prêt pour le cours."}</div>
                <textarea
                  className="tableau-saisie-prof"
                  value={tableauTexte}
                  onChange={(event) => gererTableau(event.target.value)}
                  maxLength={3000}
                  rows={5}
                  placeholder="Écris le cours ici… Les élèves verront le texte apparaître sur le tableau noir."
                />
                <div className="info"><i className="fa-solid fa-eye"></i> Seul le professeur actuel peut écrire. Tous les élèves voient le tableau en temps réel.</div>
              </div>
            )}

            {ongletFeuille === "autres" && (
              <>
                {participants.length === 0 && <div className="info">Personne d'autre dans la salle.</div>}
                {autresOrdonnes.map((p) => (
                  <div key={p.identity} className="carte-post carte-participant-salle" style={{ marginBottom: 10 }}>
                    <div className="auteur-post">{p.identity}</div>
                    {feuillesAutorisees[p.identity] !== undefined ? (
                      <FeuillePapier value={feuillesAutorisees[p.identity]} readOnly label={`Feuille de ${p.identity}`} />
                    ) : demandesEnvoyees.has(p.identity) ? (
                      <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> En attente...</div>
                    ) : (
                      <button type="button" onClick={() => demanderAVoir(p.identity)}>
                        <i className="fa-solid fa-eye"></i> Demander à voir sa feuille
                      </button>
                    )}
                    {estProf && p.identity !== monUsername && (
                      <button
                        type="button"
                        className="bouton-moderation-micro"
                        disabled={!!moderationEnCours[p.identity]}
                        onClick={async () => {
                          const couper = p.microAutorise !== false;
                          setModerationEnCours((prev) => ({ ...prev, [p.identity]: true }));
                          try {
                            await modererMicroClasse(sessionToken, demandeId, p.identity, couper);
                            setParticipants((prev) => prev.map((participant) => participant.identity === p.identity ? { ...participant, microAutorise: !couper, ...(couper ? { micActif: false } : {}) } : participant));
                          } catch (err) {
                            setErreur(err.message || "Modération micro impossible");
                          } finally {
                            setModerationEnCours((prev) => ({ ...prev, [p.identity]: false }));
                          }
                        }}
                      >
                        <i className={`fa-solid ${moderationEnCours[p.identity] ? "fa-spinner fa-spin" : p.microAutorise === false ? "fa-microphone" : "fa-microphone-slash"}`}></i>
                        {moderationEnCours[p.identity] ? "Application…" : p.microAutorise === false ? "Rétablir le droit de parole" : "Suspendre le droit de parole"}
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
