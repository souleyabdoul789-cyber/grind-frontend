import { useEffect, useRef, useState } from "react";
import { obtenirIdentifiantsTurn, urlSession } from "../api.js";

export default function SalleAudio({ sessionToken, demandeId, monUsername, onQuitter }) {
  const [statut, setStatut] = useState("connexion"); // connexion | attente | en_appel | erreur
  const [micCoupe, setMicCoupe] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [autreUsername, setAutreUsername] = useState(null);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const streamLocalRef = useRef(null);
  const audioDistantRef = useRef(null);
  const suisInitiateurRef = useRef(false);
  const autreUsernameRef = useRef(null);

  useEffect(() => {
    let arrete = false;

    async function demarrer() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (arrete) return;
        streamLocalRef.current = stream;

        const identifiantsTurn = await obtenirIdentifiantsTurn(sessionToken);

        const socket = new WebSocket(urlSession(sessionToken, demandeId));
        socketRef.current = socket;

        socket.onopen = () => {
          setStatut("attente");
          socket.send(JSON.stringify({ type: "ready" }));
        };

        socket.onerror = () => setErreur("Connexion au serveur impossible");

        socket.onmessage = async (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === "ready" && !autreUsernameRef.current) {
            autreUsernameRef.current = msg.sender;
            setAutreUsername(msg.sender);
            // Règle simple et déterministe pour éviter que les deux
            // parties créent une offre en même temps : le pseudo le
            // plus petit alphabétiquement initie.
            if (monUsername < msg.sender) {
              suisInitiateurRef.current = true;
              await creerConnexion(identifiantsTurn.iceServers, stream, socket, msg.sender);
              const offre = await pcRef.current.createOffer();
              await pcRef.current.setLocalDescription(offre);
              socket.send(JSON.stringify({ type: "webrtc-offer", cible: msg.sender, sdp: offre }));
            } else {
              await creerConnexion(identifiantsTurn.iceServers, stream, socket, msg.sender);
            }
          }

          if (msg.type === "webrtc-offer") {
            autreUsernameRef.current = msg.sender;
            setAutreUsername(msg.sender);
            if (!pcRef.current) await creerConnexion(identifiantsTurn.iceServers, stream, socket, msg.sender);
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
              // candidat arrivé trop tôt/tard — sans conséquence si la connexion aboutit quand même
            }
          }
        };
      } catch (err) {
        setErreur(err.message.includes("Permission") ? "Autorise l'accès au micro pour continuer" : "Impossible de démarrer l'audio");
        setStatut("erreur");
      }
    }

    async function creerConnexion(iceServers, streamLocal, socket, destinataire) {
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      streamLocal.getTracks().forEach((piste) => pc.addTrack(piste, streamLocal));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.send(JSON.stringify({ type: "webrtc-ice", cible: destinataire, candidate: e.candidate }));
        }
      };

      pc.ontrack = (e) => {
        if (audioDistantRef.current) {
          audioDistantRef.current.srcObject = e.streams[0];
        }
        setStatut("en_appel");
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setErreur("Connexion audio perdue");
        }
      };
    }

    demarrer();

    return () => {
      arrete = true;
      socketRef.current?.close();
      pcRef.current?.close();
      streamLocalRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function basculerMicro() {
    const stream = streamLocalRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = micCoupe));
    setMicCoupe(!micCoupe);
  }

  function raccrocher() {
    socketRef.current?.close();
    pcRef.current?.close();
    streamLocalRef.current?.getTracks().forEach((t) => t.stop());
    onQuitter();
  }

  return (
    <div className="salle-audio">
      <audio ref={audioDistantRef} autoPlay />

      <div className="statut-appel">
        {statut === "connexion" && <><i className="fa-solid fa-spinner fa-spin"></i> Préparation du micro...</>}
        {statut === "attente" && <><i className="fa-solid fa-ellipsis"></i> En attente de l'autre personne...</>}
        {statut === "en_appel" && <><i className="fa-solid fa-circle" style={{ color: "var(--succes)", fontSize: 10 }}></i> En communication{autreUsername ? ` avec ${autreUsername}` : ""}</>}
        {statut === "erreur" && <><i className="fa-solid fa-triangle-exclamation"></i> {erreur}</>}
      </div>

      <div className="controles-appel">
        <button className={`bouton-appel ${micCoupe ? "bouton-appel-actif" : ""}`} onClick={basculerMicro} type="button">
          <i className={micCoupe ? "fa-solid fa-microphone-slash" : "fa-solid fa-microphone"}></i>
        </button>
        <button className="bouton-appel bouton-raccrocher" onClick={raccrocher} type="button">
          <i className="fa-solid fa-phone-slash"></i>
        </button>
      </div>
    </div>
  );
}
