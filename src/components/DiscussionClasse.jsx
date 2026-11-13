import { useCallback, useEffect, useRef, useState } from "react";
import AvatarIcone from "./AvatarIcone.jsx";
import {
  obtenirDiscussionClasse, listerMessagesDiscussion, envoyerMessageDiscussion, urlDiscussion,
  listerMentionsDiscussion, marquerMentionDiscussionLue, rejoindreVraieClasseDepuisDiscussion,
  modifierPhotoDiscussion, ajouterAdminDiscussion, retirerAdminDiscussion,
  restreindreMembreDiscussion, leverRestrictionDiscussion, retirerMembreDiscussion,
  transfererProprietaireDiscussion, renouvelerInvitationDiscussion, uploaderMedia, uploaderDocument,
  envoyerVocalDiscussion, urlPieceDiscussion,
} from "../api.js";

function heure(date) {
  if (!date) return "";
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? "" : value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function tailleLisible(bytes) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function iconePieceSelectionnee(file) {
  const extension = String(file?.name || "").split(".").pop().toLowerCase();
  if (file?.type?.startsWith("video/") || ["mp4", "mov", "webm"].includes(extension)) return "fa-file-video";
  if (file?.type?.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(extension)) return "fa-file-image";
  return "fa-file-lines";
}

function extraireDureeVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 59 * 60) {
        reject(new Error("La vidéo doit durer au maximum 59 minutes."));
        return;
      }
      resolve({ debut: 0, fin: Math.max(1, Math.ceil(duration)) });
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Impossible de lire les informations de cette vidéo.")); };
    video.src = url;
  });
}

function dureeLisible(secondes) {
  const total = Number.isFinite(Number(secondes)) ? Math.max(0, Math.floor(Number(secondes))) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const NOMBRE_BARRES_VOCAL = 30;

function LecteurVocal({ src, id }) {
  const audioRef = useRef(null);
  const [lecture, setLecture] = useState(false);
  const [courant, setCourant] = useState(0);
  const [duree, setDuree] = useState(0);
  const progression = duree > 0 ? Math.min(100, (courant / duree) * 100) : 0;
  const hauteurs = Array.from({ length: NOMBRE_BARRES_VOCAL }, (_, index) => {
    const seed = (Number(id) * 17 + index * 29 + index * index * 7) % 31;
    return 5 + seed % 17;
  });

  async function basculerLecture() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); setLecture(true); } catch { setLecture(false); }
    } else {
      audio.pause();
      setLecture(false);
    }
  }

  function chercher(event) {
    const audio = audioRef.current;
    if (audio && duree > 0) {
      audio.currentTime = duree * (Number(event.target.value) / 100);
      setCourant(audio.currentTime);
    }
  }

  return (
    <div className="discussion-vocal-player" onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}>
      <audio ref={audioRef} src={src} preload="metadata" onLoadedMetadata={event => setDuree(event.currentTarget.duration || 0)} onTimeUpdate={event => setCourant(event.currentTarget.currentTime || 0)} onEnded={() => setLecture(false)} onPause={() => setLecture(false)} onPlay={() => setLecture(true)} />
      <button type="button" className="discussion-vocal-play" onClick={basculerLecture} aria-label={lecture ? "Mettre en pause le vocal" : "Lire le message vocal"}>
        <i className={`fa-solid ${lecture ? "fa-pause" : "fa-play"}`} />
      </button>
      <div className="discussion-vocal-piste">
        <div className="discussion-vocal-ondes" aria-hidden="true">
          {hauteurs.map((h, index) => <span key={index} className={index / hauteurs.length * 100 <= progression ? "jouee" : ""} style={{ height: `${h}px` }} />)}
        </div>
        <input aria-label="Position du message vocal" type="range" min="0" max="100" step="0.5" value={progression} onChange={chercher} />
        <small>{dureeLisible(courant)} / {dureeLisible(duree)}</small>
      </div>
    </div>
  );
}


function TexteMessage({ texte, onProfil }) {
  const fragments = String(texte || "").split(/(@[A-Za-z_]{3,24})/g);
  return <>{fragments.map((part, index) => part.startsWith("@")
    ? <button type="button" className="discussion-mention-texte" key={`${part}-${index}`} onClick={() => onProfil?.(part.slice(1))}>{part}</button>
    : <span key={index}>{part}</span>)}</>;
}

export default function DiscussionClasse({ sessionToken, classe, monUsername, messageAouvrirId = null, onQuitter }) {
  const [discussion, setDiscussion] = useState(null);
  const [membres, setMembres] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [texte, setTexte] = useState("");
  const [vocalEnCours, setVocalEnCours] = useState(false);
  const [vocalPreparation, setVocalPreparation] = useState(false);
  const [vocalVerrouille, setVocalVerrouille] = useState(false);
  const [vocalSecondes, setVocalSecondes] = useState(0);
  const [vocalNiveaux, setVocalNiveaux] = useState(Array(24).fill(3));
  const [reponse, setReponse] = useState(null);
  const [fichier, setFichier] = useState(null);
  const [menuPiecesOuvert, setMenuPiecesOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [progression, setProgression] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [panneauMembres, setPanneauMembres] = useState(false);
  const [mentionsNonLues, setMentionsNonLues] = useState(0);
  const [typing, setTyping] = useState([]);
  const [socketEtat, setSocketEtat] = useState("connexion");
  const [lightbox, setLightbox] = useState(null);
  const [plusAnciens, setPlusAnciens] = useState(true);
  const [chargementAnciens, setChargementAnciens] = useState(false);
  const [actionEnCours, setActionEnCours] = useState("");
  const [messageErreur, setMessageErreur] = useState("");
  const [profilPhotoEnvoi, setProfilPhotoEnvoi] = useState(false);
  const [inviteCopie, setInviteCopie] = useState(false);
  const [dureesRestriction, setDureesRestriction] = useState({});
  const [renouvellementInvitation, setRenouvellementInvitation] = useState(false);
  const [transfertProprietaire, setTransfertProprietaire] = useState(null);
  const messageInitialTraite = useRef(null);
  const messagesActuels = useRef([]);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const socketRef = useRef(null);
  const imagePieceRef = useRef(null);
  const videoPieceRef = useRef(null);
  const documentPieceRef = useRef(null);
  const photoRef = useRef(null);
  const mediaRecorderVocalRef = useRef(null);
  const streamVocalRef = useRef(null);
  const morceauxVocalRef = useRef([]);
  const pointeurVocalRef = useRef(null);
  const annulerVocalRef = useRef(false);
  const envoyerVocalAutoRef = useRef(false);
  const debutVocalRef = useRef(0);
  const minuteurVocalRef = useRef(null);
  const audioContextVocalRef = useRef(null);
  const analyseurVocalRef = useRef(null);
  const messageRefs = useRef(new Map());
  const swipeStart = useRef(new Map());
  const typingTimeout = useRef(null);
  const presenceTimeouts = useRef({});
  const initialScroll = useRef(false);

  const estAdmin = discussion?.mon_role === "owner" || discussion?.mon_role === "admin";
  const estOwner = discussion?.mon_role === "owner";
  const restreint = discussion?.restreint === true;

  const charger = useCallback(async () => {
    const data = await obtenirDiscussionClasse(sessionToken, classe.classe_id);
    setDiscussion(data.discussion);
    setMembres(data.membres || []);
    setMessages(data.messages || []);
    messagesActuels.current = data.messages || [];
    setPlusAnciens((data.messages || []).length >= 50);
    setMentionsNonLues(data.discussion?.mentions_non_lues || 0);
    initialScroll.current = false;
    return data;
  }, [sessionToken, classe.classe_id]);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    charger().then(() => { if (actif) setErreur(""); })
      .catch(error => { if (actif) setErreur(error.message || "Impossible d'ouvrir la discussion."); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, [charger]);

  useEffect(() => {
    if (!discussion?.id) return undefined;
    let actif = true;
    let retryTimer = null;
    let pollTimer = null;
    let socket = null;

    const recevoir = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === "message" && data.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          const next = [...prev, data.message].sort((a, b) => a.id - b.id);
          messagesActuels.current = next;
          return next;
        });
        // Une nouvelle mention reçue pendant que le groupe est ouvert met à jour le compteur.
        if (data.message.contenu?.toLowerCase().includes(`@${String(monUsername).toLowerCase()}`) && data.message.auteur !== monUsername) {
          setMentionsNonLues(value => value + 1);
        }
      } else if (data.type === "typing" && data.username) {
        setTyping(prev => data.typing
          ? (prev.includes(data.username) ? prev : [...prev, data.username])
          : prev.filter(x => x !== data.username));
        clearTimeout(presenceTimeouts.current[data.username]);
        if (data.typing) presenceTimeouts.current[data.username] = setTimeout(() => setTyping(prev => prev.filter(x => x !== data.username)), 2600);
      } else if (data.type === "group_update") {
        setDiscussion(prev => prev ? { ...prev, photo_url: data.photo_url } : prev);
      } else if (data.type === "group_name_update") {
        setDiscussion(prev => prev ? { ...prev, nom: data.nom } : prev);
      } else if (data.type === "invitation_changed") {
        obtenirDiscussionClasse(sessionToken, classe.classe_id).then(data => {
          if (actif) setDiscussion(data.discussion);
        }).catch(() => {});
      } else if (data.type === "owner_changed") {
        charger().catch(() => {});
      } else if (data.type === "member_removed" && data.username === monUsername) {
        setMessageErreur("Tu as été retiré de cette discussion.");
        window.setTimeout(() => { if (actif) onQuitter?.(); }, 900);
      } else if (["member_update", "member_restriction", "member_removed", "member_joined"].includes(data.type)) {
        charger().catch(() => {});
      }
    };

    const connecter = () => {
      if (!actif) return;
      try {
        socket = new WebSocket(urlDiscussion(sessionToken, discussion.id));
        socketRef.current = socket;
        socket.onopen = () => { if (actif) setSocketEtat("connecte"); };
        socket.onmessage = recevoir;
        socket.onerror = () => { if (actif) setSocketEtat("reconnexion"); };
        socket.onclose = (event) => {
          if (!actif) return;
          // 1008 = refus d'accès côté serveur : ne pas boucler en reconnexion
          // quand un administrateur vient de retirer ou qu'un membre a quitté.
          if (event?.code === 1008) {
            setSocketEtat("ferme");
            setMessageErreur("Ton accès à cette discussion n'est plus actif.");
            window.setTimeout(() => { if (actif) onQuitter?.(); }, 800);
            return;
          }
          setSocketEtat("reconnexion");
          retryTimer = window.setTimeout(connecter, 2500);
        };
      } catch {
        setSocketEtat("reconnexion");
        retryTimer = window.setTimeout(connecter, 3500);
      }
    };
    connecter();

    // La synchronisation REST continue à faible fréquence : elle couvre la reprise
    // après veille mobile et les déploiements exécutés avec plusieurs processus.
    const actualiserMessages = async () => {
      if (!actif) return;
      const dernierId = messagesActuels.current.at(-1)?.id || 0;
      try {
        const [data, mentions] = await Promise.all([
          listerMessagesDiscussion(sessionToken, classe.classe_id, null, dernierId),
          listerMentionsDiscussion(sessionToken, classe.classe_id),
        ]);
        if (!actif) return;
        setMentionsNonLues((mentions.mentions || []).length);
        if (!data.messages?.length) return;
        setMessages(prev => {
          const map = new Map(prev.map(m => [m.id, m]));
          data.messages.forEach(m => map.set(m.id, m));
          const next = [...map.values()].sort((a, b) => a.id - b.id);
          messagesActuels.current = next;
          return next;
        });
      } catch { /* le fil reste consultable avec les messages déjà chargés */ }
    };
    pollTimer = window.setInterval(actualiserMessages, 12000);

    return () => {
      actif = false;
      clearTimeout(retryTimer);
      clearInterval(pollTimer);
      if (socket) socket.close();
      Object.values(presenceTimeouts.current).forEach(clearTimeout);
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [sessionToken, discussion?.id, classe.classe_id, monUsername, onQuitter]);

  useEffect(() => {
    messagesActuels.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!scrollRef.current || !messages.length) return;
    if (!initialScroll.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      initialScroll.current = true;
    } else if (!reponse) {
      const el = scrollRef.current;
      const procheBas = el.scrollHeight - el.scrollTop - el.clientHeight < 180;
      if (procheBas) el.scrollTop = el.scrollHeight;
    }
  }, [messages, reponse]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const video = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.58) {
          video.muted = true;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    }, { root, threshold: [0, 0.58, 1] });
    root.querySelectorAll("video.discussion-video").forEach(video => observer.observe(video));
    return () => observer.disconnect();
  }, [messages]);

  useEffect(() => {
    const cibleId = Number(messageAouvrirId || 0);
    if (!discussion?.id || !cibleId || messageInitialTraite.current === `${discussion.id}:${cibleId}`) return;
    messageInitialTraite.current = `${discussion.id}:${cibleId}`;
    let actif = true;
    (async () => {
      try {
        let cible = messagesActuels.current.find(m => Number(m.id) === cibleId);
        if (!cible) {
          const anciens = await listerMessagesDiscussion(sessionToken, classe.classe_id, cibleId + 1);
          if (!actif) return;
          setMessages(prev => {
            const map = new Map(prev.map(m => [m.id, m]));
            (anciens.messages || []).forEach(m => map.set(m.id, m));
            const next = [...map.values()].sort((a, b) => a.id - b.id);
            messagesActuels.current = next;
            return next;
          });
          cible = (anciens.messages || []).find(m => Number(m.id) === cibleId);
        }
        if (cible && actif) {
          window.setTimeout(() => messageRefs.current.get(cibleId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 180);
          const mentions = await listerMentionsDiscussion(sessionToken, classe.classe_id);
          const mention = (mentions.mentions || []).find(m => Number(m.message_id) === cibleId);
          if (mention) {
            const resultat = await marquerMentionDiscussionLue(sessionToken, classe.classe_id, mention.id);
            if (actif) setMentionsNonLues(resultat.mentions_non_lues ?? 0);
          }
        }
      } catch (error) { if (actif) setMessageErreur(error.message); }
    })();
    return () => { actif = false; };
  }, [discussion?.id, messageAouvrirId, sessionToken, classe.classe_id]);

  useEffect(() => {
    const match = texte.match(/(?:^|\s)@([A-Za-z_]*)$/);
    if (!match) { setSuggestions([]); return; }
    const terme = match[1] || "";
    setSuggestions(membres.filter(m => m.username !== monUsername && (!terme || m.username.toLowerCase().startsWith(terme.toLowerCase()) || m.nom.toLowerCase().includes(terme.toLowerCase()))).slice(0, 12));
  }, [texte, membres, monUsername]);

  function redimensionnerSaisie() {
    const area = textareaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 160)}px`;
  }

  function changerTexte(value) {
    setTexte(value);
    requestAnimationFrame(redimensionnerSaisie);
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "typing", typing: true }));
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => socket.send(JSON.stringify({ type: "typing", typing: false })), 1800);
    }
  }

  function choisirMention(membre) {
    const match = texte.match(/(?:^|\s)@[A-Za-z_]*$/);
    const prefix = match ? texte.slice(0, match.index + (match[0].startsWith(" ") ? 1 : 0)) : texte;
    setTexte(`${prefix}@${membre.username} `);
    setSuggestions([]);
    textareaRef.current?.focus();
  }

  function commencerReponse(message) {
    const resume = message.contenu || (message.piece?.type === "audio" ? "Message vocal" : message.piece?.nom || "Pièce jointe");
    setReponse({ id: message.id, auteur: message.auteur, auteur_nom: message.auteur_nom, contenu: resume });
    textareaRef.current?.focus();
  }

  function debutSwipe(event, id) {
    if (event.target?.closest?.("button, input, audio, video, a")) return;
    const t = event.touches?.[0];
    swipeStart.current.set(id, { x: t ? t.clientX : event.clientX, y: t ? t.clientY : event.clientY });
  }

  function finSwipe(event, message) {
    const start = swipeStart.current.get(message.id);
    if (!start) return;
    const t = event.changedTouches?.[0];
    const dx = (t ? t.clientX : event.clientX) - start.x;
    const dy = (t ? t.clientY : event.clientY) - start.y;
    swipeStart.current.delete(message.id);
    if (Math.abs(dx) > 62 && Math.abs(dx) > Math.abs(dy) * 1.25) commencerReponse(message);
  }

  async function chargerPlusAnciens() {
    if (!messages.length || chargementAnciens) return;
    setChargementAnciens(true);
    const scroll = scrollRef.current;
    const avant = scroll?.scrollHeight || 0;
    try {
      const data = await listerMessagesDiscussion(sessionToken, classe.classe_id, messages[0].id);
      setMessages(prev => [...(data.messages || []).filter(m => !prev.some(p => p.id === m.id)), ...prev]);
      setPlusAnciens(data.has_more);
      requestAnimationFrame(() => { if (scroll) scroll.scrollTop += scroll.scrollHeight - avant; });
    } catch (error) { setMessageErreur(error.message); }
    finally { setChargementAnciens(false); }
  }

  async function envoyer() {
    if (envoi || (!texte.trim() && !fichier)) return;
    setEnvoi(true); setProgression(0); setMessageErreur("");
    try {
      let piece = null;
      if (fichier) {
        const ext = fichier.name.split(".").pop().toLowerCase();
        if (["pdf", "docx"].includes(ext)) {
          const doc = await uploaderDocument(sessionToken, fichier);
          piece = { url: doc.document_url, type: "document", nom: doc.document_name || fichier.name, mime: doc.document_type || fichier.type, taille: fichier.size };
        } else {
          const estVideo = fichier.type.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext);
          const decoupe = estVideo ? await extraireDureeVideo(fichier) : null;
          const media = await uploaderMedia(sessionToken, fichier, decoupe, setProgression);
          piece = { url: media.media_url, type: media.media_type || (estVideo ? "video" : "image"), nom: fichier.name, mime: fichier.type, taille: fichier.size };
        }
      }
      const res = await envoyerMessageDiscussion(sessionToken, classe.classe_id, {
        contenu: texte.trim(), reply_to_id: reponse?.id || null, style_texte: "normal", piece,
      });
      setMessages(prev => prev.some(m => m.id === res.message.id) ? prev : [...prev, res.message]);
      setTexte(""); setFichier(null); setReponse(null);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      [imagePieceRef, videoPieceRef, documentPieceRef].forEach(ref => { if (ref.current) ref.current.value = ""; });
      setMenuPiecesOuvert(false);
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", typing: false }));
    } catch (error) { setMessageErreur(error.message || "Échec de l'envoi du message."); }
    finally { setEnvoi(false); setProgression(0); }
  }

  function nettoyerCaptureVocal() {
    if (minuteurVocalRef.current) window.clearInterval(minuteurVocalRef.current);
    minuteurVocalRef.current = null;
    streamVocalRef.current?.getTracks?.().forEach(track => track.stop());
    streamVocalRef.current = null;
    const contexte = audioContextVocalRef.current;
    audioContextVocalRef.current = null;
    analyseurVocalRef.current = null;
    if (contexte && contexte.state !== "closed") contexte.close().catch(() => {});
    mediaRecorderVocalRef.current = null;
  }

  async function publierVocal(fichierVocal) {
    setEnvoi(true); setProgression(0); setMessageErreur("");
    try {
      const resultat = await envoyerVocalDiscussion(
        sessionToken, classe.classe_id, fichierVocal, reponse?.id || null,
        value => setProgression(value),
      );
      setMessages(prev => prev.some(m => m.id === resultat.message.id) ? prev : [...prev, resultat.message].sort((a, b) => a.id - b.id));
      setReponse(null);
    } catch (error) {
      setMessageErreur(error.message || "Impossible d'envoyer le message vocal.");
    } finally {
      setEnvoi(false); setProgression(0);
    }
  }

  async function demarrerVocal(event) {
    event.preventDefault();
    if (vocalPreparation || vocalEnCours || envoi || texte.trim() || fichier) return;
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* certains WebView ne prennent pas la capture */ }
    pointeurVocalRef.current = { x: event.clientX, y: event.clientY, startedAt: Date.now(), released: false, locked: false };
    annulerVocalRef.current = false;
    envoyerVocalAutoRef.current = false;
    setVocalPreparation(true); setVocalSecondes(0); setVocalNiveaux(Array(24).fill(3));
    setMessageErreur("");

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("L'enregistrement vocal n'est pas disponible sur cette version d'Android.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamVocalRef.current = stream;
      if (annulerVocalRef.current) {
        nettoyerCaptureVocal(); setVocalPreparation(false); return;
      }
      const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const mime = types.find(type => MediaRecorder.isTypeSupported?.(type)) || "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 }) : new MediaRecorder(stream);
      mediaRecorderVocalRef.current = recorder;
      morceauxVocalRef.current = [];
      recorder.ondataavailable = eventData => { if (eventData.data?.size) morceauxVocalRef.current.push(eventData.data); };
      recorder.onstop = async () => {
        const blob = new Blob(morceauxVocalRef.current, { type: recorder.mimeType || "audio/webm" });
        const annule = annulerVocalRef.current;
        const envoyer = envoyerVocalAutoRef.current && !annule;
        const duree = Math.max(1, Math.round((Date.now() - debutVocalRef.current) / 1000));
        const type = blob.type.split(";")[0] || "audio/webm";
        const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        nettoyerCaptureVocal();
        setVocalEnCours(false); setVocalPreparation(false); setVocalVerrouille(false);
        setVocalSecondes(duree); pointeurVocalRef.current = null;
        if (envoyer && blob.size > 512) {
          const fichierVocal = new File([blob], `vocal-grind-${Date.now()}.${extension}`, { type });
          await publierVocal(fichierVocal);
        } else if (!annule && blob.size <= 512) {
          setMessageErreur("Le message vocal est trop court ou vide. Réessaie.");
        }
        morceauxVocalRef.current = [];
      };
      recorder.start(250);
      debutVocalRef.current = Date.now();
      setVocalPreparation(false); setVocalEnCours(true);

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const contexte = new AudioContextClass();
          const analyseur = contexte.createAnalyser();
          analyseur.fftSize = 128;
          contexte.createMediaStreamSource(stream).connect(analyseur);
          audioContextVocalRef.current = contexte;
          analyseurVocalRef.current = analyseur;
        }
      } catch { /* l'enregistrement fonctionne même sans visualiseur de niveau */ }

      minuteurVocalRef.current = window.setInterval(() => {
        const secondes = Math.floor((Date.now() - debutVocalRef.current) / 1000);
        setVocalSecondes(secondes);
        const analyseur = analyseurVocalRef.current;
        if (analyseur) {
          const valeurs = new Uint8Array(analyseur.frequencyBinCount);
          analyseur.getByteFrequencyData(valeurs);
          const niveaux = Array.from({ length: 24 }, (_, index) => Math.max(3, Math.min(26, Math.round((valeurs[Math.min(index, valeurs.length - 1)] || 0) / 9))));
          setVocalNiveaux(niveaux);
        }
        if (secondes >= 300 && mediaRecorderVocalRef.current?.state === "recording") {
          envoyerVocalAutoRef.current = true;
          mediaRecorderVocalRef.current.stop();
        }
      }, 120);

      // Un appui très bref verrouille le vocal au lieu de l'envoyer immédiatement.
      // Cela permet de toucher l'icône puis d'avoir le temps d'écouter/annuler/envoyer.
      const pointeur = pointeurVocalRef.current;
      if (pointeur?.released) {
        if ((pointeur.elapsedAtRelease ?? 999) < 320) {
          pointeur.locked = true; setVocalVerrouille(true);
        } else {
          envoyerVocalAutoRef.current = true;
          recorder.stop();
        }
      }
    } catch (error) {
      nettoyerCaptureVocal();
      setVocalPreparation(false); setVocalEnCours(false); setVocalVerrouille(false);
      pointeurVocalRef.current = null;
      setMessageErreur(error.name === "NotAllowedError" ? "Autorise le microphone pour enregistrer un message vocal." : error.message || "Impossible d'accéder au microphone.");
    }
  }

  function deplacerPointeurVocal(event) {
    const pointeur = pointeurVocalRef.current;
    if (!pointeur || pointeur.released || pointeur.locked) return;
    const dx = event.clientX - pointeur.x;
    const dy = event.clientY - pointeur.y;
    if (dx < -95) {
      annulerEnregistrementVocal();
      return;
    }
    if (dy < -85) {
      pointeur.locked = true;
      setVocalVerrouille(true);
    }
  }

  function relacherPointeurVocal() {
    const pointeur = pointeurVocalRef.current;
    if (!pointeur || pointeur.released) return;
    pointeur.released = true;
    pointeur.elapsedAtRelease = Date.now() - pointeur.startedAt;
    if (pointeur.locked) return;
    const recorder = mediaRecorderVocalRef.current;
    if (!recorder || recorder.state !== "recording") return;
    if (pointeur.elapsedAtRelease < 320) {
      pointeur.locked = true;
      setVocalVerrouille(true);
    } else {
      envoyerVocalAutoRef.current = true;
      recorder.stop();
    }
  }

  function annulerEnregistrementVocal() {
    annulerVocalRef.current = true;
    envoyerVocalAutoRef.current = false;
    const recorder = mediaRecorderVocalRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else {
      nettoyerCaptureVocal();
      setVocalPreparation(false); setVocalEnCours(false); setVocalVerrouille(false);
      pointeurVocalRef.current = null;
    }
  }

  function envoyerVocalVerrouille() {
    const recorder = mediaRecorderVocalRef.current;
    if (!recorder || recorder.state !== "recording") return;
    envoyerVocalAutoRef.current = true;
    recorder.stop();
  }

  useEffect(() => () => {
    annulerVocalRef.current = true;
    const recorder = mediaRecorderVocalRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try { recorder.stop(); } catch { /* capture déjà terminée */ }
    }
    nettoyerCaptureVocal();
  }, []);

  async function sauterVersMention() {
    try {
      const data = await listerMentionsDiscussion(sessionToken, classe.classe_id);
      const mention = (data.mentions || [])[0];
      if (!mention) { setMentionsNonLues(0); return; }
      let cible = messages.find(m => m.id === mention.message_id);
      if (!cible) {
        const anciens = await listerMessagesDiscussion(sessionToken, classe.classe_id, mention.message_id + 1);
        setMessages(prev => [...(anciens.messages || []).filter(m => !prev.some(p => p.id === m.id)), ...prev].sort((a, b) => a.id - b.id));
        cible = (anciens.messages || []).find(m => m.id === mention.message_id);
      }
      await marquerMentionDiscussionLue(sessionToken, classe.classe_id, mention.id);
      setMentionsNonLues(count => Math.max(0, count - 1));
      window.setTimeout(() => messageRefs.current.get(mention.message_id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    } catch (error) { setMessageErreur(error.message); }
  }

  async function rejoindreVraieClasse() {
    setActionEnCours("classe"); setMessageErreur("");
    try {
      await rejoindreVraieClasseDepuisDiscussion(sessionToken, classe.classe_id);
      setDiscussion(prev => ({ ...prev, est_membre_classe: true }));
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Tu as rejoint la classe réelle." }));
    } catch (error) { setMessageErreur(error.message); }
    finally { setActionEnCours(""); }
  }

  async function changerPhoto(event) {
    const image = event.target.files?.[0];
    if (!image) return;
    setProfilPhotoEnvoi(true); setMessageErreur("");
    try {
      const media = await uploaderMedia(sessionToken, image, null);
      const res = await modifierPhotoDiscussion(sessionToken, classe.classe_id, media.media_url);
      setDiscussion(prev => ({ ...prev, photo_url: res.photo_url }));
    } catch (error) { setMessageErreur(error.message); }
    finally { setProfilPhotoEnvoi(false); if (photoRef.current) photoRef.current.value = ""; }
  }

  async function acterMembre(action, membre) {
    setActionEnCours(`${action}:${membre.username}`); setMessageErreur("");
    try {
      if (action === "owner") await transfererProprietaireDiscussion(sessionToken, classe.classe_id, membre.username);
      if (action === "admin") await ajouterAdminDiscussion(sessionToken, classe.classe_id, membre.username);
      if (action === "retirer-admin") await retirerAdminDiscussion(sessionToken, classe.classe_id, membre.username);
      if (action.startsWith("mute:")) {
        const valeur = action.slice(5);
        await restreindreMembreDiscussion(sessionToken, classe.classe_id, membre.username,
          valeur === "permanent" ? { permanent: true } : { minutes: Number(valeur) });
      }
      if (action === "unmute") await leverRestrictionDiscussion(sessionToken, classe.classe_id, membre.username);
      if (action === "remove") await retirerMembreDiscussion(sessionToken, classe.classe_id, membre.username);
      await charger();
      setTransfertProprietaire(null);
    } catch (error) { setMessageErreur(error.message); }
    finally { setActionEnCours(""); }
  }

  async function copierInvitation() {
    try {
      await navigator.clipboard.writeText(discussion.code_invitation);
      setInviteCopie(true); window.setTimeout(() => setInviteCopie(false), 1800);
    } catch { setMessageErreur("Impossible de copier le code sur cet appareil."); }
  }

  async function renouvelerCodeInvitation() {
    if (renouvellementInvitation) return;
    setRenouvellementInvitation(true); setMessageErreur("");
    try {
      const res = await renouvelerInvitationDiscussion(sessionToken, classe.classe_id);
      setDiscussion(prev => ({ ...prev, code_invitation: res.code_invitation }));
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Le code d'invitation a été renouvelé. L'ancien code ne fonctionne plus." }));
    } catch (error) { setMessageErreur(error.message); }
    finally { setRenouvellementInvitation(false); }
  }

  function ouvrirProfil(username) {
    window.dispatchEvent(new CustomEvent("grind-open-profil", { detail: username }));
  }

  if (chargement) return <div className="discussion-loading"><span className="grind-spinner" /><span>Ouverture de la discussion…</span></div>;
  if (erreur || !discussion) return <section className="discussion-erreur"><p>{erreur || "Discussion indisponible."}</p><button type="button" onClick={onQuitter}>Retour aux classes</button></section>;

  return (
    <section className="discussion-page" aria-label={`Discussion ${discussion.nom}`}>
      <header className="discussion-entete">
        <button className="discussion-retour" type="button" onClick={onQuitter} aria-label="Retour aux classes"><i className="fa-solid fa-arrow-left" /></button>
        <button className="discussion-identite" type="button" onClick={() => setPanneauMembres(v => !v)}>
          <span className="discussion-photo">
            {discussion.photo_url ? <img src={discussion.photo_url} alt="" /> : <i className="fa-solid fa-users" />}
          </span>
          <span className="discussion-identite-texte"><strong>{discussion.nom}</strong><small>{discussion.nb_membres} membres · groupe de classe</small></span>
        </button>
        <div className="discussion-actions-entete">
          {!discussion.est_membre_classe && <button type="button" className="discussion-action-icon" onClick={rejoindreVraieClasse} disabled={actionEnCours === "classe"} title="Rejoindre la vraie classe" aria-label="Rejoindre la vraie classe"><i className="fa-solid fa-person-circle-plus" /></button>}
          <button type="button" className="discussion-action-icon" onClick={() => setPanneauMembres(v => !v)} title="Informations du groupe" aria-label="Informations du groupe"><i className="fa-solid fa-ellipsis-vertical" /></button>
        </div>
      </header>

      <div className="discussion-statut"><span className={`discussion-online-dot ${socketEtat === "connecte" ? "actif" : ""}`} />{socketEtat === "connecte" ? "Connecté" : "Reconnexion automatique"} · {discussion.limite_membres || 200} membres maximum</div>

      {mentionsNonLues > 0 && (
        <button
          type="button"
          className="discussion-mention-flottant"
          onClick={sauterVersMention}
          title="Aller à ta première mention non lue"
          aria-label={`Aller à tes ${mentionsNonLues} mentions non lues`}
        >
          <i className="fa-solid fa-at" aria-hidden="true" />
          <span>{mentionsNonLues > 99 ? "99+" : mentionsNonLues}</span>
        </button>
      )}

      <div className="discussion-corps" ref={scrollRef}>
        {plusAnciens && messages.length > 0 && <button className="discussion-plus-anciens" type="button" onClick={chargerPlusAnciens} disabled={chargementAnciens}>{chargementAnciens ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-clock-rotate-left" />} Charger les messages précédents</button>}
        {messages.length === 0 ? <div className="discussion-vide"><i className="fa-regular fa-comments" /><strong>La discussion commence ici</strong><span>Pose une question, partage un cours ou aide un camarade.</span></div> : messages.map(message => {
          const propre = message.auteur === monUsername;
          const mediaPriveUrl = message.piece ? urlPieceDiscussion(sessionToken, classe.classe_id, message.id) : null;
          return (
            <article key={message.id} ref={node => { if (node) messageRefs.current.set(message.id, node); else messageRefs.current.delete(message.id); }}
              className={`discussion-ligne ${propre ? "moi" : "autre"}`} onTouchStart={event => debutSwipe(event, message.id)} onTouchEnd={event => finSwipe(event, message)} onMouseDown={event => debutSwipe(event, message.id)} onMouseUp={event => finSwipe(event, message)}>
              {!propre && <AvatarIcone username={message.auteur} taille={34} onClic={ouvrirProfil} />}
              <div className="discussion-bulle-wrap">
                {!propre && <button type="button" className="discussion-auteur" onClick={() => ouvrirProfil(message.auteur)}>{message.auteur_nom} <small>@{message.auteur}</small></button>}
                {message.reply && <button type="button" className="discussion-reponse-citee" onClick={() => messageRefs.current.get(message.reply.id)?.scrollIntoView({ behavior: "smooth", block: "center" })}><strong>{message.reply.auteur_nom}</strong><span>{message.reply.contenu || "Message"}</span></button>}
                <div className={`discussion-bulle style-${message.style_texte || "normal"}`}>
                  {!!message.contenu && <div className="discussion-texte"><TexteMessage texte={message.contenu} onProfil={ouvrirProfil} /></div>}
                  {message.piece && message.piece.type === "image" && <>
                    <button type="button" className="discussion-image" onClick={() => setLightbox(mediaPriveUrl)}><img src={mediaPriveUrl} alt={message.piece.nom || "Image partagée"} loading="lazy" /></button>
                    <div className="discussion-media-actions"><a href={mediaPriveUrl} download={message.piece.nom || "image-grind"} title="Télécharger la photo" aria-label="Télécharger la photo"><i className="fa-solid fa-download" /></a></div>
                  </>}
                  {message.piece && message.piece.type === "video" && <>
                    <video className="discussion-video" src={mediaPriveUrl} controls playsInline preload="metadata" />
                    <div className="discussion-media-actions"><a href={mediaPriveUrl} download={message.piece.nom || "video-grind"} title="Télécharger la vidéo" aria-label="Télécharger la vidéo"><i className="fa-solid fa-download" /></a></div>
                  </>}
                  {message.piece && message.piece.type === "audio" && <LecteurVocal src={mediaPriveUrl} id={message.id} />}
                  {message.piece && message.piece.type === "document" && <a className="discussion-fichier" href={mediaPriveUrl} target="_blank" rel="noreferrer" download><span className="discussion-fichier-icone"><i className="fa-solid fa-file-pdf" /></span><span><strong>{message.piece.nom}</strong><small>{tailleLisible(message.piece.taille)}</small></span><i className="fa-solid fa-download" /></a>}
                  <span className="discussion-heure">{heure(message.created_at)}</span>
                </div>
                <button type="button" className="discussion-repondre-rapide" onClick={() => commencerReponse(message)} title="Répondre"><i className="fa-solid fa-reply" /></button>
              </div>
              {propre && <AvatarIcone username={message.auteur} taille={30} />}
            </article>
          );
        })}
        {typing.length > 0 && <div className="discussion-typing"><span /><span /><span />{typing.slice(0, 2).map(user => membres.find(m => m.username === user)?.nom || user).join(", ")} écrit{typing.length > 1 ? "ent" : ""}…</div>}
      </div>

      {messageErreur && <div className="discussion-erreur-message" role="alert">{messageErreur}<button type="button" onClick={() => setMessageErreur("")} aria-label="Fermer"><i className="fa-solid fa-xmark" /></button></div>}
      {restreint ? <div className="discussion-restreint"><i className="fa-solid fa-comment-slash" /> Tu ne peux pas envoyer de message{discussion.restriction_jusqua ? ` jusqu'au ${new Date(discussion.restriction_jusqua).toLocaleString()}` : " pour le moment"}.</div> : (
        <div className="discussion-compositeur-zone">
          {reponse && <div className="discussion-reponse-active"><span><strong>Réponse à {reponse.auteur_nom}</strong><small>{reponse.contenu}</small></span><button type="button" onClick={() => setReponse(null)} aria-label="Annuler la réponse"><i className="fa-solid fa-xmark" /></button></div>}
          {fichier && <div className="discussion-piece-selectionnee"><i className={`fa-solid ${iconePieceSelectionnee(fichier)}`} /><span>{fichier.name}</span><small>{tailleLisible(fichier.size)}</small><button type="button" onClick={() => { setFichier(null); [imagePieceRef, videoPieceRef, documentPieceRef].forEach(ref => { if (ref.current) ref.current.value = ""; }); }}><i className="fa-solid fa-xmark" /></button></div>}
          {envoi && <div className="discussion-progression"><span style={{ width: `${progression}%` }} /></div>}
          <div className={`discussion-compositeur ${vocalEnCours || vocalPreparation ? "vocal-actif" : ""}`}>
            {(vocalEnCours || vocalPreparation) ? (
              <div className="discussion-vocal-enregistrement" role="status" aria-live="polite">
                <span className="discussion-vocal-point" />
                <strong>{vocalPreparation ? "Ouverture du microphone…" : dureeLisible(vocalSecondes)}</strong>
                <div className="discussion-vocal-ondes en-direct" aria-label="Niveau sonore en direct">
                  {vocalNiveaux.map((niveau, index) => <span key={index} style={{ height: `${niveau}px` }} />)}
                </div>
                <small>{vocalVerrouille ? "Enregistrement verrouillé" : "Glisse vers le haut pour verrouiller · vers la gauche pour annuler"}</small>
                {vocalVerrouille && <div className="discussion-vocal-commandes">
                  <button type="button" className="discussion-vocal-supprimer" onClick={annulerEnregistrementVocal} title="Supprimer le vocal" aria-label="Supprimer le vocal"><i className="fa-solid fa-trash" /></button>
                  <button type="button" className="discussion-vocal-envoyer" onClick={envoyerVocalVerrouille} title="Envoyer le vocal" aria-label="Envoyer le vocal"><i className="fa-solid fa-paper-plane" /></button>
                </div>}
              </div>
            ) : (
              <>
                <div className="discussion-attachement-wrap">
                  <button type="button" className={`discussion-joindre ${menuPiecesOuvert ? "actif" : ""}`} onClick={() => setMenuPiecesOuvert(v => !v)} title="Choisir une pièce jointe" aria-label="Choisir une pièce jointe" aria-expanded={menuPiecesOuvert}><i className="fa-solid fa-paperclip" /></button>
                  {menuPiecesOuvert && <div className="discussion-attachement-menu" role="group" aria-label="Type de pièce jointe">
                    <button type="button" onClick={() => imagePieceRef.current?.click()}><span><i className="fa-regular fa-image" /></span><strong>Image</strong><small>Photo ou capture</small></button>
                    <button type="button" onClick={() => videoPieceRef.current?.click()}><span><i className="fa-solid fa-video" /></span><strong>Vidéo</strong><small>Lecture dans le fil</small></button>
                    <button type="button" onClick={() => documentPieceRef.current?.click()}><span><i className="fa-solid fa-file-lines" /></span><strong>Document</strong><small>PDF ou DOCX</small></button>
                  </div>}
                  <input ref={imagePieceRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={event => { setFichier(event.target.files?.[0] || null); setMenuPiecesOuvert(false); }} />
                  <input ref={videoPieceRef} type="file" hidden accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={event => { setFichier(event.target.files?.[0] || null); setMenuPiecesOuvert(false); }} />
                  <input ref={documentPieceRef} type="file" hidden accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => { setFichier(event.target.files?.[0] || null); setMenuPiecesOuvert(false); }} />
                </div>
                <textarea ref={textareaRef} rows={1} value={texte} onChange={event => changerTexte(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); envoyer(); } }} placeholder="Écrire un message…" disabled={envoi || !!fichier} />
                {(texte.trim() || fichier) && <button type="button" className="discussion-envoyer" onClick={envoyer} disabled={envoi} title="Envoyer" aria-label="Envoyer">{envoi ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-paper-plane" />}</button>}
              </>
            )}
            <button
              type="button"
              className={`discussion-vocal-bouton ${vocalEnCours || vocalPreparation ? "actif" : ""}`}
              onPointerDown={demarrerVocal}
              onPointerMove={deplacerPointeurVocal}
              onPointerUp={relacherPointeurVocal}
              onPointerCancel={annulerEnregistrementVocal}
              disabled={envoi || (!vocalEnCours && (!!texte.trim() || !!fichier))}
              title="Maintenir pour enregistrer un vocal · Toucher pour verrouiller"
              aria-label="Enregistrer un message vocal"
            ><i className={`fa-solid ${vocalEnCours || vocalPreparation ? "fa-microphone-lines" : "fa-microphone"}`} /></button>
          </div>
          {suggestions.length > 0 && <div className="discussion-suggestions-mention">{suggestions.map(m => <button type="button" key={m.username} onClick={() => choisirMention(m)}><AvatarIcone username={m.username} taille={30} /><span><strong>{m.nom}</strong><small>@{m.username}</small></span><i className="fa-solid fa-at" /></button>)}</div>}
          <small className="discussion-aide-composer">Maintiens le micro pour envoyer · Glisse vers le haut pour verrouiller · Glisse un message pour répondre</small>
        </div>
      )}

      {panneauMembres && <div className="discussion-panneau-fond" onMouseDown={event => { if (event.target === event.currentTarget) setPanneauMembres(false); }}>
        <aside className="discussion-panneau">
          <header><div><strong>Informations du groupe</strong><small>{membres.length} / 200 membres</small></div><button type="button" onClick={() => setPanneauMembres(false)} aria-label="Fermer"><i className="fa-solid fa-xmark" /></button></header>
          <div className="discussion-groupe-photo-section">
            <div className="discussion-groupe-photo">{discussion.photo_url ? <img src={discussion.photo_url} alt="Photo du groupe" /> : <i className="fa-solid fa-users" />}</div>
            {estAdmin && <><input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={changerPhoto} /><button type="button" onClick={() => photoRef.current?.click()} disabled={profilPhotoEnvoi}>{profilPhotoEnvoi ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-camera" />} Modifier la photo</button></>}
            <h3>{discussion.nom}</h3><p>Discussion privée liée à la classe {discussion.nom_classe}.</p>
          </div>
          <div className="discussion-invitation"><span><small>Code d'invitation au groupe</small><strong>{discussion.code_invitation}</strong></span><button type="button" onClick={copierInvitation} title="Copier le code"><i className={inviteCopie ? "fa-solid fa-check" : "fa-solid fa-copy"} /></button>{estAdmin && <button type="button" onClick={renouvelerCodeInvitation} disabled={renouvellementInvitation} title="Renouveler le code"><i className={renouvellementInvitation ? "fa-solid fa-circle-notch fa-spin" : "fa-solid fa-rotate"} /></button>}</div>
          {!discussion.est_membre_classe && <button type="button" className="discussion-joindre-classe-panneau" onClick={rejoindreVraieClasse} disabled={actionEnCours === "classe"}><i className="fa-solid fa-school" /> Rejoindre la vraie classe (10 places max)</button>}
          <div className="discussion-membres-titre"><strong>Membres</strong><span>{membres.length}/200</span></div>
          <div className="discussion-liste-membres">{membres.map(m => <div key={m.username} className="discussion-membre-ligne">
            <AvatarIcone username={m.username} taille={36} onClic={ouvrirProfil} />
            <div className="discussion-membre-identite"><strong>{m.nom}</strong><small>@{m.username} · {m.role === "owner" ? "Propriétaire" : m.role === "admin" ? "Administrateur" : m.est_en_classe ? "Membre de la classe" : "Membre du groupe"}</small>{m.restreint && <small className="discussion-membre-mute">Messages restreints</small>}</div>
            {estAdmin && m.username !== monUsername && m.role !== "owner" && (m.role !== "admin" || estOwner) && <div className="discussion-membre-actions">
              {estOwner && <>
                <button type="button" title="Transférer la propriété du groupe" disabled={!!actionEnCours} onClick={() => setTransfertProprietaire(m)}><i className="fa-solid fa-crown" /></button>
                <button type="button" title={m.role === "admin" ? "Retirer les droits admin" : "Nommer admin"} disabled={!!actionEnCours} onClick={() => acterMembre(m.role === "admin" ? "retirer-admin" : "admin", m)}><i className={`fa-solid ${m.role === "admin" ? "fa-user-minus" : "fa-user-shield"}`} /></button>
              </>}
              {m.restreint ? <button type="button" title="Lever la restriction" disabled={!!actionEnCours} onClick={() => acterMembre("unmute", m)}><i className="fa-solid fa-comment" /></button> : <>
                <select className="discussion-duree-restriction" aria-label={`Durée de restriction pour ${m.nom}`} value={dureesRestriction[m.username] || "60"} onChange={event => setDureesRestriction(prev => ({ ...prev, [m.username]: event.target.value }))}>
                  <option value="15">15 min</option><option value="60">1 h</option><option value="360">6 h</option><option value="1440">24 h</option><option value="10080">7 jours</option><option value="permanent">Manuelle</option>
                </select>
                <button type="button" title="Appliquer la restriction" disabled={!!actionEnCours} onClick={() => acterMembre(`mute:${dureesRestriction[m.username] || "60"}`, m)}><i className="fa-solid fa-comment-slash" /></button>
              </>}
              <button type="button" title="Retirer du groupe" disabled={!!actionEnCours} onClick={() => acterMembre("remove", m)}><i className="fa-solid fa-user-xmark" /></button>
            </div>}
          </div>)}</div>
          {estAdmin && <div className="discussion-moderation-rapide"><small>Restrictions disponibles : 15 min, 1 h, 6 h, 24 h, 7 jours ou jusqu'à levée manuelle.</small></div>}
          {transfertProprietaire && <div className="discussion-confirmation-transfert" role="dialog" aria-modal="true"><strong>Transférer la propriété du groupe ?</strong><p>{transfertProprietaire.nom} deviendra propriétaire. Tu conserveras le rôle d'administrateur et pourras ensuite quitter le groupe.</p><div><button type="button" onClick={() => setTransfertProprietaire(null)}>Annuler</button><button type="button" disabled={!!actionEnCours} onClick={() => acterMembre("owner", transfertProprietaire)}>{actionEnCours === `owner:${transfertProprietaire.username}` ? <i className="fa-solid fa-circle-notch fa-spin" /> : "Confirmer"}</button></div></div>}
          <footer>{estOwner ? <small>Tu es propriétaire de cette discussion. Transfère d'abord la propriété pour pouvoir la quitter.</small> : <button type="button" className="discussion-quitter-groupe" onClick={async () => { try { await import("../api.js").then(api => api.quitterDiscussion(sessionToken, classe.classe_id)); onQuitter(); } catch (e) { setMessageErreur(e.message); } }}><i className="fa-solid fa-right-from-bracket" /> Quitter la discussion</button>}</footer>
        </aside>
      </div>}

      {lightbox && <div className="discussion-lightbox" onClick={() => setLightbox(null)}><button type="button" aria-label="Fermer"><i className="fa-solid fa-xmark" /></button><img src={lightbox} alt="Image partagée en grand" onClick={event => event.stopPropagation()} /></div>}
    </section>
  );
}
