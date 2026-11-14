import { useCallback, useEffect, useRef, useState } from "react";
import AvatarIcone from "./AvatarIcone.jsx";
import {
  stockageAndroidDisponible, sourceLocaleMedia, nettoyerCacheMediaAndroid, effacerCacheClasseMediaAndroid,
  chercherMediaTemporaire, chercherMediaEnregistre, mettreEnCacheMedia,
  enregistrerMediaAndroid, enregistrerMediaCacheAndroid, ouvrirFichierAndroid, ecouterProgressionMedia,
  telechargerDansNavigateur,
} from "../mediaStorage.js";
import {
  obtenirDiscussionClasse, listerMessagesDiscussion, envoyerMessageDiscussion, urlDiscussion,
  listerMentionsDiscussion, marquerMentionDiscussionLue, rejoindreVraieClasseDepuisDiscussion,
  modifierPhotoDiscussion, ajouterAdminDiscussion, retirerAdminDiscussion,
  restreindreMembreDiscussion, leverRestrictionDiscussion, retirerMembreDiscussion,
  transfererProprietaireDiscussion, renouvelerInvitationDiscussion, uploaderMedia, uploaderDocument,
  envoyerVocalDiscussion, urlPieceDiscussion, modifierMessageDiscussion,
  supprimerMessageDiscussionPourMoi, supprimerMessageDiscussionPourTous, estGrindEnLigne,
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
let lecteurVocalActif = null;

function extensionPiece(message) {
  const piece = message?.piece || {};
  const nom = String(piece.nom || "");
  const ext = nom.includes(".") ? nom.split(".").pop().toLowerCase() : "";
  if (ext) return ext;
  const mime = String(piece.mime || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("mp4") && piece.type === "audio") return "m4a";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  return piece.type === "audio" ? "webm" : piece.type === "image" ? "jpg" : piece.type === "video" ? "mp4" : "pdf";
}

function mimePiece(message) {
  const piece = message?.piece || {};
  if (piece.mime) return piece.mime;
  const ext = extensionPiece(message);
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    mp4: piece.type === "audio" ? "audio/mp4" : "video/mp4", mov: "video/quicktime", webm: piece.type === "audio" ? "audio/webm" : "video/webm",
    ogg: "audio/ogg", m4a: "audio/mp4", mp3: "audio/mpeg", pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })[ext] || "application/octet-stream";
}

function cleCompteFichier(username) {
  return String(username || "compte").toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 32) || "compte";
}

function nomFichierTemporaire(username, classeId, message) {
  return `u-${cleCompteFichier(username)}-classe-${classeId}-message-${message.id}.${extensionPiece(message)}`;
}

function nomFichierEnregistre(username, classeId, message) {
  const nom = String(message?.piece?.nom || `piece-${message?.id || "grind"}`).replace(/[\\/:*?"<>|]/g, "_");
  const extension = extensionPiece(message);
  const prefixe = `GRIND-${cleCompteFichier(username)}-${classeId}-${message.id}-`;
  const base = nom.replace(/\.[^.]+$/, "") || "piece";
  const longueurBase = Math.max(12, 170 - prefixe.length - extension.length - 1);
  return `${prefixe}${base.slice(0, longueurBase)}.${extension}`;
}

function ImageDiscussion({ src, alt, onOpen }) {
  const [chargee, setChargee] = useState(false);
  const [echec, setEchec] = useState(false);
  const [ratio, setRatio] = useState(4 / 3);

  useEffect(() => {
    setChargee(false);
    setEchec(false);
    setRatio(4 / 3);
  }, [src]);

  function imageChargee(event) {
    const image = event.currentTarget;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      setRatio(image.naturalWidth / image.naturalHeight);
    }
    setChargee(true);
  }

  return (
    <button
      type="button"
      className={`discussion-image ${chargee ? "media-charge" : ""} ${echec ? "media-echec" : ""}`}
      style={{ aspectRatio: ratio }}
      onClick={onOpen}
      disabled={!src || echec}
      aria-label="Afficher l'image partagée"
    >
      {!chargee && !echec && <span className="discussion-media-skeleton" aria-hidden="true" />}
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" onLoad={imageChargee} onError={() => { setEchec(true); setChargee(false); }} /> : null}
      {(!src || echec) && <span className="discussion-media-indisponible">{echec ? "Image indisponible" : "Image non enregistrée hors ligne"}</span>}
    </button>
  );
}

function BoutonTelechargement({ progression = null, enCours = false, onClick, label }) {
  const valeur = Number.isFinite(progression) ? Math.max(0, Math.min(100, progression)) : 0;
  return (
    <button
      type="button"
      className={`discussion-download-button ${enCours ? "en-cours" : ""}`}
      style={{ "--download-progress": `${valeur}%` }}
      onClick={onClick}
      disabled={enCours}
      title={label}
      aria-label={enCours ? `Téléchargement ${progression == null || progression < 0 ? "en cours" : `${valeur}%`}` : label}
    >
      <span className="discussion-download-ring" aria-hidden="true">
        <i className={`fa-solid ${enCours ? "fa-circle-notch fa-spin" : "fa-download"}`} />
      </span>
    </button>
  );
}

function VideoDiscussion({ src, poster, nom }) {
  const [erreur, setErreur] = useState(false);
  useEffect(() => setErreur(false), [src, poster]);
  return (
    <div className="discussion-video-shell">
      {!src ? (
        <div className="discussion-video-placeholder"><span className="discussion-media-skeleton" /><small>Vidéo non disponible hors ligne. Télécharge-la pour la conserver sur cet appareil.</small></div>
      ) : (
        <video className="discussion-video" src={src} poster={poster || undefined} controls playsInline preload="metadata"
          aria-label={nom || "Vidéo partagée dans la discussion"} onError={() => setErreur(true)} />
      )}
      {erreur && <div className="discussion-video-error">Cette vidéo ne peut pas être lue sur cet appareil.</div>}
    </div>
  );
}

function LecteurVocal({ src, id }) {
  const audioRef = useRef(null);
  const [lecture, setLecture] = useState(false);
  const [courant, setCourant] = useState(0);
  const [duree, setDuree] = useState(0);
  const [erreur, setErreur] = useState(false);
  const progression = duree > 0 ? Math.min(100, Math.max(0, (courant / duree) * 100)) : 0;
  const hauteurs = Array.from({ length: NOMBRE_BARRES_VOCAL }, (_, index) => {
    const seed = (Number(id) * 17 + index * 29 + index * index * 7) % 31;
    return 5 + seed % 17;
  });

  useEffect(() => {
    const audio = audioRef.current;
    setLecture(false); setCourant(0); setDuree(0); setErreur(false);
    if (audio) { audio.pause(); audio.currentTime = 0; audio.loop = false; }
    return () => {
      if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
      if (lecteurVocalActif === audio) lecteurVocalActif = null;
    };
  }, [src]);

  async function basculerLecture() {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (audio.paused) {
      if (lecteurVocalActif && lecteurVocalActif !== audio) lecteurVocalActif.pause();
      audio.loop = false;
      try {
        await audio.play();
        lecteurVocalActif = audio;
      } catch { setLecture(false); setErreur(true); }
    } else {
      audio.pause();
    }
  }

  function actualiserDuree(audio) {
    const value = Number(audio?.duration);
    if (Number.isFinite(value) && value > 0) setDuree(value);
  }

  function chercher(event) {
    const audio = audioRef.current;
    if (audio && duree > 0 && Number.isFinite(duree)) {
      audio.currentTime = duree * (Number(event.target.value) / 100);
      setCourant(audio.currentTime);
    }
  }

  function terminerLecture() {
    const audio = audioRef.current;
    setLecture(false);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCourant(0);
    if (lecteurVocalActif === audio) lecteurVocalActif = null;
  }

  return (
    <div className={`discussion-vocal-player ${!src ? "sans-source" : ""}`} onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}>
      <audio ref={audioRef} src={src || undefined} preload="metadata" loop={false}
        onLoadedMetadata={event => actualiserDuree(event.currentTarget)}
        onDurationChange={event => actualiserDuree(event.currentTarget)}
        onTimeUpdate={event => { const value = Number(event.currentTarget.currentTime); if (Number.isFinite(value)) setCourant(value); }}
        onEnded={terminerLecture}
        onPause={event => {
          setLecture(false);
          if (lecteurVocalActif === event.currentTarget) lecteurVocalActif = null;
        }}
        onPlay={() => { setLecture(true); setErreur(false); }}
        onError={event => {
          setLecture(false); setErreur(true);
          if (lecteurVocalActif === event.currentTarget) lecteurVocalActif = null;
        }} />
      <button type="button" className="discussion-vocal-play" onClick={basculerLecture} disabled={!src} aria-label={lecture ? "Mettre en pause le vocal" : "Lire le message vocal"}>
        <i className={`fa-solid ${lecture ? "fa-pause" : "fa-play"}`} />
      </button>
      <div className="discussion-vocal-piste">
        <div className="discussion-vocal-ondes" aria-hidden="true">
          {hauteurs.map((h, index) => <span key={index} className={index / hauteurs.length * 100 <= progression ? "jouee" : ""} style={{ height: `${h}px` }} />)}
        </div>
        <input aria-label="Position du message vocal" type="range" min="0" max="100" step="0.5" value={progression} onChange={chercher} disabled={!src || duree <= 0} />
        <small>{erreur ? "Audio indisponible" : !src ? "Non disponible hors ligne" : `${dureeLisible(courant)} / ${dureeLisible(duree)}`}</small>
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

function lireCacheDiscussion(classeId, username) {
  try {
    const valeur = JSON.parse(localStorage.getItem(`grind_discussion_${username}_${classeId}`) || "null");
    return valeur && typeof valeur === "object" ? valeur : null;
  } catch { return null; }
}

export default function DiscussionClasse({ sessionToken, classe, monUsername, messageAouvrirId = null, onQuitter }) {
  const cacheInitial = lireCacheDiscussion(classe.classe_id, monUsername);
  const [discussion, setDiscussion] = useState(cacheInitial?.discussion || null);
  const [membres, setMembres] = useState(cacheInitial?.membres || []);
  const [messages, setMessages] = useState(cacheInitial?.messages || []);
  const [chargement, setChargement] = useState(!cacheInitial);
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
  const [mediasLocaux, setMediasLocaux] = useState({});
  const [progressionsMedia, setProgressionsMedia] = useState({});
  const mediasLocauxRef = useRef({});
  const promessesCacheMediaRef = useRef(new Map());
  const requetesMediaRef = useRef(new Map());
  const composantActifRef = useRef(true);
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
  const [messagesSelectionnes, setMessagesSelectionnes] = useState([]);
  const [menuSelectionOuvert, setMenuSelectionOuvert] = useState(false);
  const [messageEnEdition, setMessageEnEdition] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [confirmationSuppressionOuverte, setConfirmationSuppressionOuverte] = useState(false);
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
  const longPressTimer = useRef(null);
  const longPressDeclenche = useRef(false);
  const cacheDiscussionKey = `grind_discussion_${monUsername}_${classe.classe_id}`;
  const retourDiscussionRef = useRef({});
  retourDiscussionRef.current = {
    confirmationSuppressionOuverte, suppressionEnCours, transfertProprietaire,
    lightbox, panneauMembres, menuSelectionOuvert, messagesSelectionnes,
    vocalEnCours, vocalPreparation, vocalVerrouille,
    menuPiecesOuvert, messageEnEdition, reponse, fichier,
  };

  useEffect(() => {
    mediasLocauxRef.current = mediasLocaux;
  }, [mediasLocaux]);

  useEffect(() => {
    composantActifRef.current = true;
    nettoyerCacheMediaAndroid().catch(() => {});
    let abonnement = null;
    ecouterProgressionMedia(event => {
      const messageId = requetesMediaRef.current.get(event?.requestId);
      if (messageId == null || !composantActifRef.current) return;
      setProgressionsMedia(prev => ({
        ...prev,
        [messageId]: event.percent === -1 ? -1 : Math.max(0, Math.min(100, Number(event.percent) || 0)),
      }));
    }).then(resultat => { abonnement = resultat; }).catch(() => {});
    return () => {
      composantActifRef.current = false;
      abonnement?.remove?.().catch(() => {});
    };
  }, []);

  // Dans une discussion, Retour ferme d'abord l'élément le plus profond :
  // modale, aperçu, panneau, sélection, édition ou réponse. La vue de classe
  // ne se ferme que lorsqu'il ne reste plus d'élément interne à dépiler.
  useEffect(() => {
    const gererRetourDiscussion = (event) => {
      if (event.defaultPrevented) return;
      const vue = retourDiscussionRef.current;
      if (vue.confirmationSuppressionOuverte) {
        if (!vue.suppressionEnCours) setConfirmationSuppressionOuverte(false);
        event.preventDefault();
        return;
      }
      if (vue.transfertProprietaire) { setTransfertProprietaire(null); event.preventDefault(); return; }
      if (vue.lightbox) { setLightbox(null); event.preventDefault(); return; }
      if (vue.panneauMembres) { setPanneauMembres(false); event.preventDefault(); return; }
      if (vue.menuSelectionOuvert) { setMenuSelectionOuvert(false); event.preventDefault(); return; }
      if (vue.messagesSelectionnes.length) { setMessagesSelectionnes([]); event.preventDefault(); return; }
      if (vue.vocalEnCours || vue.vocalPreparation || vue.vocalVerrouille) {
        annulerEnregistrementVocal();
        event.preventDefault();
        return;
      }
      if (vue.menuPiecesOuvert) { setMenuPiecesOuvert(false); event.preventDefault(); return; }
      if (vue.messageEnEdition) { setMessageEnEdition(null); setTexte(""); event.preventDefault(); return; }
      if (vue.reponse) { setReponse(null); event.preventDefault(); return; }
      if (vue.fichier) {
        setFichier(null);
        [imagePieceRef, videoPieceRef, documentPieceRef].forEach(ref => { if (ref.current) ref.current.value = ""; });
        event.preventDefault();
      }
    };
    window.addEventListener("grind-back", gererRetourDiscussion, true);
    return () => window.removeEventListener("grind-back", gererRetourDiscussion, true);
  }, []);

  const estAdmin = discussion?.mon_role === "owner" || discussion?.mon_role === "admin";
  const estOwner = discussion?.mon_role === "owner";
  const restreint = discussion?.restreint === true;

  const charger = useCallback(async () => {
    if (!estGrindEnLigne()) {
      const cache = lireCacheDiscussion(classe.classe_id, monUsername);
      setSocketEtat("hors ligne");
      if (!cache?.discussion) {
        const erreur = new Error("Cette discussion n'a pas encore été téléchargée sur cet appareil.");
        erreur.code = "CACHE_ABSENT";
        throw erreur;
      }
      setDiscussion(cache.discussion);
      setMembres(cache.membres || []);
      setMessages(cache.messages || []);
      messagesActuels.current = cache.messages || [];
      setPlusAnciens(false);
      return cache;
    }
    const data = await obtenirDiscussionClasse(sessionToken, classe.classe_id);
    setDiscussion(data.discussion);
    setMembres(data.membres || []);
    setMessages(data.messages || []);
    messagesActuels.current = data.messages || [];
    try { localStorage.setItem(cacheDiscussionKey, JSON.stringify({ discussion: data.discussion, membres: data.membres || [], messages: data.messages || [] })); } catch {}
    setPlusAnciens((data.messages || []).length >= 50);
    setMentionsNonLues(data.discussion?.mentions_non_lues || 0);
    initialScroll.current = false;
    return data;
  }, [sessionToken, classe.classe_id, monUsername, cacheDiscussionKey]);

  useEffect(() => {
    let actif = true;
    if (!cacheInitial) setChargement(true);
    charger().then(() => { if (actif) setErreur(""); })
      .catch(error => {
        if (!actif) return;
        if ([401, 403, 404].includes(error.status)) {
          // Le serveur a confirmé que cette session n'a plus accès au groupe :
          // ne pas laisser les anciennes données en cache visibles après reconnexion.
          localStorage.removeItem(cacheDiscussionKey);
          effacerCacheClasseMediaAndroid(monUsername, classe.classe_id).catch(() => {});
          setDiscussion(null); setMembres([]); setMessages([]);
          messagesActuels.current = [];
          setErreur(error.message || "Tu n'as plus accès à cette discussion.");
        } else if (!cacheInitial) {
          setErreur(error.message || "Impossible d'ouvrir la discussion.");
        }
      })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, [charger, cacheDiscussionKey]);

  useEffect(() => {
    if (!discussion && !membres.length && !messages.length) return;
    try {
      localStorage.setItem(cacheDiscussionKey, JSON.stringify({
        discussion, membres, messages: messages.slice(-100),
      }));
    } catch {}
  }, [discussion, membres, messages, cacheDiscussionKey]);

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
      } else if (data.type === "message_updated" && data.message) {
        setMessages(prev => {
          const next = prev.map(m => m.id === data.message.id ? data.message : m);
          messagesActuels.current = next;
          return next;
        });
      } else if (data.type === "message_deleted" && data.message) {
        setMessages(prev => {
          const next = prev.map(m => m.id === data.message.id ? data.message : m);
          messagesActuels.current = next;
          return next;
        });
        setMessagesSelectionnes(prev => prev.filter(id => id !== data.message.id));
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
        localStorage.removeItem(cacheDiscussionKey);
        setDiscussion(null); setMembres([]); setMessages([]);
        messagesActuels.current = [];
        setMessageErreur("Tu as été retiré de cette discussion.");
        window.setTimeout(() => { if (actif) onQuitter?.(); }, 900);
      } else if (["member_update", "member_restriction", "member_removed", "member_joined"].includes(data.type)) {
        charger().catch(() => {});
      }
    };

    const connecter = () => {
      if (!actif) return;
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
      if (!estGrindEnLigne()) { setSocketEtat("hors ligne"); retryTimer = window.setTimeout(connecter, 5000); return; }
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
            localStorage.removeItem(cacheDiscussionKey);
            setDiscussion(null); setMembres([]); setMessages([]);
            messagesActuels.current = [];
            setSocketEtat("ferme");
            setMessageErreur("Ton accès à cette discussion n'est plus actif.");
            window.setTimeout(() => { if (actif) onQuitter?.(); }, 800);
            return;
          }
          if (!estGrindEnLigne()) { setSocketEtat("hors ligne"); retryTimer = window.setTimeout(connecter, 5000); }
          else { setSocketEtat("reconnexion"); retryTimer = window.setTimeout(connecter, 2500); }
        };
      } catch {
        setSocketEtat(!estGrindEnLigne() ? "hors ligne" : "reconnexion");
        retryTimer = window.setTimeout(connecter, !estGrindEnLigne() ? 5000 : 3500);
      }
    };
    const repriseReseau = () => {
      clearTimeout(retryTimer);
      charger().catch(error => {
        if ([401, 403, 404].includes(error.status)) {
          localStorage.removeItem(cacheDiscussionKey);
          effacerCacheClasseMediaAndroid(monUsername, classe.classe_id).catch(() => {});
          setDiscussion(null); setMembres([]); setMessages([]);
          messagesActuels.current = [];
          setErreur(error.message || "Tu n'as plus accès à cette discussion.");
        }
      });
      connecter();
    };
    const statutApi = event => {
      if (event.detail?.online) repriseReseau();
      else setSocketEtat("hors ligne");
    };
    window.addEventListener("online", repriseReseau);
    window.addEventListener("grind-api-status", statutApi);
    connecter();

    // La synchronisation REST continue à faible fréquence : elle couvre la reprise
    // après veille mobile et les déploiements exécutés avec plusieurs processus.
    const actualiserMessages = async () => {
      if (!actif || !estGrindEnLigne()) return;
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
      window.removeEventListener("online", repriseReseau);
      window.removeEventListener("grind-api-status", statutApi);
      if (socket) socket.close();
      Object.values(presenceTimeouts.current).forEach(clearTimeout);
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [sessionToken, discussion?.id, classe.classe_id, monUsername, onQuitter]);

  useEffect(() => {
    messagesActuels.current = messages;
    if (discussion) {
      try { localStorage.setItem(cacheDiscussionKey, JSON.stringify({ discussion, membres, messages: messages.slice(-100) })); } catch {}
    }
  }, [messages, discussion, membres, cacheDiscussionKey]);

  function enregistrerMediaLocal(messageId, resultat) {
    if (!resultat?.path) return;
    const entree = { path: resultat.path, fileName: resultat.fileName, mimeType: resultat.mimeType, size: resultat.size };
    mediasLocauxRef.current = { ...mediasLocauxRef.current, [messageId]: entree };
    if (composantActifRef.current) setMediasLocaux(prev => ({ ...prev, [messageId]: entree }));
  }

  function definirProgressionMedia(messageId, valeur) {
    if (!composantActifRef.current) return;
    setProgressionsMedia(prev => ({ ...prev, [messageId]: valeur }));
  }

  function sourcePieceMessage(message) {
    const locale = mediasLocaux[message.id] || mediasLocauxRef.current[message.id];
    if (locale?.path) return sourceLocaleMedia(locale.path);
    return estGrindEnLigne() ? urlPieceDiscussion(sessionToken, classe.classe_id, message.id) : null;
  }

  async function assurerCacheTemporaire(message) {
    if (!stockageAndroidDisponible() || !message?.piece || message.piece.type === "video") return null;
    const messageId = Number(message.id);
    const deja = mediasLocauxRef.current[messageId];
    if (deja?.path) return deja;
    if (promessesCacheMediaRef.current.has(messageId)) return promessesCacheMediaRef.current.get(messageId);

    const promesse = (async () => {
      const fileName = nomFichierTemporaire(monUsername, classe.classe_id, message);
      const mimeType = mimePiece(message);
      try {
        const cache = await chercherMediaTemporaire(fileName, mimeType);
        if (cache?.path) { enregistrerMediaLocal(messageId, cache); return cache; }
        if (!estGrindEnLigne()) return null;
        const requestId = `cache-${classe.classe_id}-${messageId}`;
        requetesMediaRef.current.set(requestId, messageId);
        definirProgressionMedia(messageId, -1);
        const maxBytes = message.piece.type === "audio" ? 8 * 1024 * 1024 : message.piece.type === "document" ? 15 * 1024 * 1024 : 25 * 1024 * 1024;
        const resultat = await mettreEnCacheMedia({
          url: urlPieceDiscussion(sessionToken, classe.classe_id, messageId),
          fileName, mimeType, requestId, maxBytes,
        });
        enregistrerMediaLocal(messageId, resultat);
        definirProgressionMedia(messageId, 100);
        return resultat;
      } catch (error) {
        console.warn("Cache média GRIND indisponible", messageId, error);
        return null;
      } finally {
        requetesMediaRef.current.delete(`cache-${classe.classe_id}-${messageId}`);
        promessesCacheMediaRef.current.delete(messageId);
        if (composantActifRef.current) window.setTimeout(() => {
          setProgressionsMedia(prev => { const next = { ...prev }; delete next[messageId]; return next; });
        }, 900);
      }
    })();
    promessesCacheMediaRef.current.set(messageId, promesse);
    return promesse;
  }

  async function ouvrirDocumentMessage(message) {
    const messageId = Number(message.id);
    const mimeType = mimePiece(message);
    const fileName = nomFichierTemporaire(monUsername, classe.classe_id, message);
    const savedName = nomFichierEnregistre(monUsername, classe.classe_id, message);
    const requestId = `save-doc-${classe.classe_id}-${messageId}`;
    definirProgressionMedia(messageId, -1);
    requetesMediaRef.current.set(requestId, messageId);
    try {
      if (stockageAndroidDisponible()) {
        const cacheEnCours = promessesCacheMediaRef.current.get(messageId);
        if (cacheEnCours) await cacheEnCours;
        let saved = await chercherMediaEnregistre(savedName, mimeType);
        if (!saved?.path) {
          const cache = await chercherMediaTemporaire(fileName, mimeType);
          if (cache?.path) saved = await enregistrerMediaCacheAndroid(fileName, savedName, mimeType);
          else if (estGrindEnLigne()) {
            saved = await enregistrerMediaAndroid({
              url: urlPieceDiscussion(sessionToken, classe.classe_id, messageId, true),
              fileName: savedName, mimeType, requestId, maxBytes: 15 * 1024 * 1024,
            });
          } else {
            throw new Error("Ce document n'est pas disponible hors ligne.");
          }
        }
        enregistrerMediaLocal(messageId, saved);
        await ouvrirFichierAndroid(saved.path, mimeType);
      } else {
        if (!estGrindEnLigne()) throw new Error("Ce document n'est pas disponible hors ligne.");
        await telechargerDansNavigateur(urlPieceDiscussion(sessionToken, classe.classe_id, messageId, true), message.piece.nom || savedName,
          pct => definirProgressionMedia(messageId, pct));
      }
    } catch (error) {
      setMessageErreur(error.message || "Le document n'a pas pu être téléchargé.");
    } finally {
      requetesMediaRef.current.delete(requestId);
      if (composantActifRef.current) window.setTimeout(() => setProgressionsMedia(prev => { const next = { ...prev }; delete next[messageId]; return next; }), 900);
    }
  }

  async function telechargerVideoMessage(message) {
    const messageId = Number(message.id);
    const mimeType = mimePiece(message);
    const savedName = nomFichierEnregistre(monUsername, classe.classe_id, message);
    const requestId = `save-video-${classe.classe_id}-${messageId}`;
    definirProgressionMedia(messageId, -1);
    requetesMediaRef.current.set(requestId, messageId);
    try {
      if (stockageAndroidDisponible()) {
        let saved = await chercherMediaEnregistre(savedName, mimeType);
        if (!saved?.path) {
          if (!estGrindEnLigne()) throw new Error("Cette vidéo n'a pas encore été téléchargée sur cet appareil.");
          saved = await enregistrerMediaAndroid({
            url: urlPieceDiscussion(sessionToken, classe.classe_id, messageId, true),
            fileName: savedName, mimeType, requestId, maxBytes: 300 * 1024 * 1024,
          });
        }
        enregistrerMediaLocal(messageId, saved);
        await ouvrirFichierAndroid(saved.path, mimeType);
      } else {
        if (!estGrindEnLigne()) throw new Error("Cette vidéo n'est pas disponible hors ligne.");
        await telechargerDansNavigateur(urlPieceDiscussion(sessionToken, classe.classe_id, messageId, true), message.piece.nom || savedName,
          pct => definirProgressionMedia(messageId, pct));
      }
    } catch (error) {
      setMessageErreur(error.message || "La vidéo n'a pas pu être téléchargée.");
    } finally {
      requetesMediaRef.current.delete(requestId);
      if (composantActifRef.current) window.setTimeout(() => setProgressionsMedia(prev => { const next = { ...prev }; delete next[messageId]; return next; }), 900);
    }
  }

  useEffect(() => {
    if (!stockageAndroidDisponible() || !messages.length) return undefined;
    let actif = true;
    const candidats = messages.filter(message => message?.piece && !message.supprime_pour_tous && ["image", "document", "audio"].includes(message.piece.type));
    let prochain = 0;
    const worker = async () => {
      while (actif && prochain < candidats.length) {
        const message = candidats[prochain++];
        await assurerCacheTemporaire(message);
      }
    };
    // Deux transferts en parallèle maximum pour préserver la réactivité des téléphones modestes.
    Promise.all([worker(), worker()]).catch(() => {});
    return () => { actif = false; };
  }, [messages, sessionToken, classe.classe_id]);

  useEffect(() => {
    if (!stockageAndroidDisponible() || !messages.length) return undefined;
    let actif = true;
    const videos = messages.filter(message => message?.piece?.type === "video" && !message.supprime_pour_tous);
    (async () => {
      for (const message of videos) {
        if (!actif) break;
        const key = Number(message.id);
        if (mediasLocauxRef.current[key]?.path) continue;
        try {
          const saved = await chercherMediaEnregistre(nomFichierEnregistre(monUsername, classe.classe_id, message), mimePiece(message));
          if (actif && saved?.path) enregistrerMediaLocal(key, saved);
        } catch { /* recherche locale silencieuse */ }
      }
    })();
    return () => { actif = false; };
  }, [messages, classe.classe_id]);

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
    // Les vidéos ne se téléchargent et ne se lancent jamais automatiquement.
    // On interrompt uniquement la lecture manuelle lorsqu'une vidéo quitte la vue.
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (!entry.isIntersecting) entry.target.pause();
    }, { root, threshold: 0 });
    root.querySelectorAll("video.discussion-video").forEach(video => observer.observe(video));
    return () => observer.disconnect();
  }, [messages, mediasLocaux]);

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
    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Les anciens messages non enregistrés sur cet appareil nécessitent Internet." }));
      return;
    }
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
    if (!estGrindEnLigne()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour envoyer un message." })); return; }
    if (envoi || (!texte.trim() && !fichier)) return;
    setEnvoi(true); setProgression(0); setMessageErreur("");
    try {
      let piece = null;
      if (fichier) {
        const ext = fichier.name.split(".").pop().toLowerCase();
        if (["pdf", "docx"].includes(ext)) {
          const doc = await uploaderDocument(sessionToken, fichier, setProgression);
          piece = { url: doc.document_url, type: "document", nom: doc.document_name || fichier.name, mime: doc.document_type || fichier.type, taille: fichier.size };
        } else {
          const estVideo = fichier.type.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext);
          const decoupe = estVideo ? await extraireDureeVideo(fichier) : null;
          const media = await uploaderMedia(sessionToken, fichier, decoupe, setProgression);
          piece = { url: media.media_url, type: media.media_type || (estVideo ? "video" : "image"), nom: fichier.name, mime: fichier.type, taille: fichier.size };
        }
      }
      if (messageEnEdition && !piece) {
        const res = await modifierMessageDiscussion(sessionToken, classe.classe_id, messageEnEdition, texte.trim());
        setMessages(prev => prev.map(m => m.id === messageEnEdition ? res.message : m));
        setMessageEnEdition(null);
      } else {
        const res = await envoyerMessageDiscussion(sessionToken, classe.classe_id, {
          contenu: texte.trim(), reply_to_id: reponse?.id || null, style_texte: "normal", piece,
        });
        setMessages(prev => prev.some(m => m.id === res.message.id) ? prev : [...prev, res.message]);
      }
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
    if (!estGrindEnLigne()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour envoyer un vocal." })); return; }
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
    if (!estGrindEnLigne()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour enregistrer et envoyer un vocal." })); return; }
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
    clearTimeout(longPressTimer.current);
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
    if (!estGrindEnLigne()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour rejoindre la classe réelle." })); return; }
    setActionEnCours("classe"); setMessageErreur("");
    try {
      await rejoindreVraieClasseDepuisDiscussion(sessionToken, classe.classe_id);
      setDiscussion(prev => ({ ...prev, est_membre_classe: true }));
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Tu as rejoint la classe réelle." }));
    } catch (error) { setMessageErreur(error.message); }
    finally { setActionEnCours(""); }
  }

  async function changerPhoto(event) {
    if (!estGrindEnLigne()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour modifier la photo du groupe." })); return; }
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
    if (!estGrindEnLigne()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour gérer les membres." })); return; }
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

  function messageEditable(message) {
    if (!message || message.supprime_pour_tous || message.auteur !== monUsername || message.piece || !message.contenu) return false;
    const date = Date.parse(message.created_at || "");
    return Number.isFinite(date) && Date.now() - date >= 0 && Date.now() - date <= 15 * 60 * 1000;
  }

  function peutSupprimerMessagePourTous(message) {
    return !!message && !message.supprime_pour_tous && (message.auteur === monUsername || estAdmin);
  }

  function basculerSelectionMessage(messageId) {
    setMessagesSelectionnes(prev => prev.includes(messageId) ? prev.filter(id => id !== messageId) : [...prev, messageId]);
    setMenuSelectionOuvert(false);
  }

  function commencerPressMessage(event, message) {
    if (event.target?.closest?.("button, input, audio, video, a, textarea")) return;
    if (messagesSelectionnes.length) return;
    clearTimeout(longPressTimer.current);
    debutSwipe(event, message.id);
    longPressDeclenche.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressDeclenche.current = true;
      setMessagesSelectionnes(prev => prev.includes(message.id) ? prev : [...prev, message.id]);
      setMenuSelectionOuvert(false);
      try { navigator.vibrate?.(24); } catch {}
    }, 560);
  }

  function deplacerPressMessage(event) {
    const start = swipeStart.current.get(Number(event.currentTarget?.dataset?.messageId));
    if (start && (Math.abs(event.clientX - start.x) > 12 || Math.abs(event.clientY - start.y) > 12)) clearTimeout(longPressTimer.current);
  }

  function terminerPressMessage(event, message) {
    clearTimeout(longPressTimer.current);
    if (!longPressDeclenche.current) finSwipe(event, message);
  }

  function annulerPressMessage() { clearTimeout(longPressTimer.current); }

  function cliquerMessageEnModeSelection(event, message) {
    if (longPressDeclenche.current) { longPressDeclenche.current = false; event.preventDefault(); return; }
    if (messagesSelectionnes.length && !event.target?.closest?.("button, input, audio, video, a")) {
      event.preventDefault(); basculerSelectionMessage(message.id);
    }
  }

  function modifierSelection() {
    if (messagesSelectionnes.length !== 1) return;
    const message = messages.find(m => m.id === messagesSelectionnes[0]);
    if (!messageEditable(message)) return;
    setTexte(message.contenu || "");
    setMessageEnEdition(message.id);
    setMessagesSelectionnes([]); setMenuSelectionOuvert(false); setReponse(null);
    requestAnimationFrame(() => { textareaRef.current?.focus(); redimensionnerSaisie(); });
  }

  async function supprimerSelectionPourMoi() {
    if (!messagesSelectionnes.length || suppressionEnCours) return;
    if (!estGrindEnLigne()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour supprimer ces messages de ton historique." })); return; }
    setSuppressionEnCours(true); setMessageErreur("");
    const resultats = await Promise.allSettled(messagesSelectionnes.map(id => supprimerMessageDiscussionPourMoi(sessionToken, classe.classe_id, id)));
    const supprimes = messagesSelectionnes.filter((id, index) => resultats[index].status === "fulfilled");
    setMessages(prev => prev.filter(message => !supprimes.includes(message.id)));
    setMessagesSelectionnes([]); setMenuSelectionOuvert(false); setSuppressionEnCours(false);
    const echecs = resultats.filter(r => r.status === "rejected");
    if (echecs.length) setMessageErreur(echecs[0].reason?.message || "Certains messages n'ont pas pu être masqués.");
    else window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Messages supprimés de ton historique." }));
  }

  function demanderSuppressionSelectionPourTous() {
    if (messagesSelectionnes.length !== 1 || suppressionEnCours) return;
    const cible = messages.find(message => message.id === messagesSelectionnes[0]);
    if (!peutSupprimerMessagePourTous(cible)) return;
    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour supprimer ce message pour tout le monde." }));
      return;
    }
    setConfirmationSuppressionOuverte(true);
  }

  async function confirmerSuppressionSelectionPourTous() {
    if (messagesSelectionnes.length !== 1 || suppressionEnCours) return;
    const messageId = messagesSelectionnes[0];
    const cible = messages.find(message => message.id === messageId);
    if (!peutSupprimerMessagePourTous(cible)) {
      setConfirmationSuppressionOuverte(false);
      return;
    }
    setConfirmationSuppressionOuverte(false);
    setSuppressionEnCours(true);
    setMessageErreur("");
    try {
      const resultat = await supprimerMessageDiscussionPourTous(sessionToken, classe.classe_id, messageId);
      if (resultat.message) {
        setMessages(prev => prev.map(message => message.id === messageId ? resultat.message : message));
      }
      setMessagesSelectionnes([]);
      setMenuSelectionOuvert(false);
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Message supprimé pour tout le monde." }));
    } catch (error) {
      setMessageErreur(error.message || "Impossible de supprimer ce message pour tout le monde.");
    } finally {
      setSuppressionEnCours(false);
    }
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

      <div className="discussion-statut"><span className={`discussion-online-dot ${socketEtat === "connecte" ? "actif" : ""}`} />{!estGrindEnLigne() || socketEtat === "hors ligne" ? "Hors ligne · lecture seule" : socketEtat === "connecte" ? "Connecté" : "Reconnexion automatique"} · {discussion.limite_membres || 200} membres maximum</div>

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

      <div className="discussion-corps" ref={scrollRef} onScroll={() => {
        if (scrollRef.current && scrollRef.current.scrollTop < 72 && plusAnciens && !chargementAnciens) chargerPlusAnciens();
      }}>
        {messagesSelectionnes.length > 0 && <div className="discussion-selection-barre">
          <button type="button" onClick={() => { setMessagesSelectionnes([]); setMenuSelectionOuvert(false); }} aria-label="Annuler la sélection"><i className="fa-solid fa-xmark" /></button>
          <strong>{messagesSelectionnes.length} sélectionné{messagesSelectionnes.length > 1 ? "s" : ""}</strong>
          <button type="button" onClick={() => setMenuSelectionOuvert(v => !v)} aria-label="Actions des messages sélectionnés"><i className="fa-solid fa-ellipsis-vertical" /></button>
          {menuSelectionOuvert && <div className="discussion-selection-menu">
            {messagesSelectionnes.length === 1 && messageEditable(messages.find(m => m.id === messagesSelectionnes[0])) && <button type="button" onClick={modifierSelection}><i className="fa-solid fa-pen" /> Modifier</button>}
            {messagesSelectionnes.length === 1 && !messages.find(m => m.id === messagesSelectionnes[0])?.supprime_pour_tous && <button type="button" onClick={() => { const cible = messages.find(m => m.id === messagesSelectionnes[0]); if (cible) commencerReponse(cible); setMessagesSelectionnes([]); setMenuSelectionOuvert(false); }}><i className="fa-solid fa-reply" /> Répondre</button>}
            {messagesSelectionnes.length === 1 && peutSupprimerMessagePourTous(messages.find(m => m.id === messagesSelectionnes[0])) && <button type="button" className="danger" onClick={demanderSuppressionSelectionPourTous} disabled={suppressionEnCours}><i className="fa-solid fa-trash-can" /> Supprimer pour tout le monde</button>}
            <button type="button" className="danger" onClick={supprimerSelectionPourMoi} disabled={suppressionEnCours}><i className="fa-solid fa-trash" /> {suppressionEnCours ? "Suppression…" : "Supprimer pour moi"}</button>
          </div>}
        </div>}
        {plusAnciens && messages.length > 0 && <button className="discussion-plus-anciens" type="button" onClick={chargerPlusAnciens} disabled={chargementAnciens}>{chargementAnciens ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-clock-rotate-left" />} Charger les messages précédents</button>}
        {messages.length === 0 ? <div className="discussion-vide"><i className="fa-regular fa-comments" /><strong>La discussion commence ici</strong><span>Pose une question, partage un cours ou aide un camarade.</span></div> : messages.map(message => {
          const propre = message.auteur === monUsername;
          const mediaPriveUrl = message.piece ? sourcePieceMessage(message) : null;
          const progressionMedia = progressionsMedia[message.id];
          const telechargementActif = progressionMedia !== undefined;
          return (
            <article key={message.id} ref={node => { if (node) messageRefs.current.set(message.id, node); else messageRefs.current.delete(message.id); }}
              className={`discussion-ligne ${propre ? "moi" : "autre"} ${messagesSelectionnes.includes(message.id) ? "selectionnee" : ""}`} data-message-id={message.id} onPointerDown={event => commencerPressMessage(event, message)} onPointerMove={deplacerPressMessage} onPointerUp={event => terminerPressMessage(event, message)} onPointerCancel={annulerPressMessage} onClick={event => cliquerMessageEnModeSelection(event, message)}>
              {!propre && <AvatarIcone username={message.auteur} taille={34} onClic={ouvrirProfil} />}
              <div className="discussion-bulle-wrap">
                {!propre && <button type="button" className="discussion-auteur" onClick={() => ouvrirProfil(message.auteur)}>{message.auteur_nom} <small>@{message.auteur}</small></button>}
                {message.reply && <button type="button" className="discussion-reponse-citee" onClick={() => messageRefs.current.get(message.reply.id)?.scrollIntoView({ behavior: "smooth", block: "center" })}><strong>{message.reply.auteur_nom}</strong><span>{message.reply.contenu || "Message"}</span></button>}
                <div className={`discussion-bulle style-${message.style_texte || "normal"} ${message.piece?.type === "image" ? "discussion-bulle-avec-image" : ""}`}>
                  {message.supprime_pour_tous ? (
                    <div className="discussion-message-supprime"><i className="fa-solid fa-ban" /> Ce message a été supprimé.</div>
                  ) : <>
                  {!!message.contenu && <div className="discussion-texte"><TexteMessage texte={message.contenu} onProfil={ouvrirProfil} /></div>}
                  {message.piece && message.piece.type === "image" && (
                    <ImageDiscussion src={mediaPriveUrl} alt={message.piece.nom || "Image partagée"} onOpen={() => mediaPriveUrl && setLightbox(mediaPriveUrl)} />
                  )}
                  {message.piece && message.piece.type === "video" && <>
                    <VideoDiscussion
                      src={mediaPriveUrl}
                      poster={mediaPriveUrl && /^https:\/\//.test(mediaPriveUrl) ? urlPieceDiscussion(sessionToken, classe.classe_id, message.id, false, true) : null}
                      nom={message.piece.nom}
                    />
                    <div className="discussion-media-actions">
                      <BoutonTelechargement progression={progressionMedia} enCours={telechargementActif} onClick={() => telechargerVideoMessage(message)} label="Télécharger la vidéo" />
                      <small>{message.piece.nom || "Vidéo"}</small>
                    </div>
                  </>}
                  {message.piece && message.piece.type === "audio" && <LecteurVocal src={mediaPriveUrl} id={message.id} />}
                  {message.piece && message.piece.type === "document" && <div className="discussion-fichier">
                    <span className="discussion-fichier-icone"><i className={`fa-solid ${extensionPiece(message) === "pdf" ? "fa-file-pdf" : "fa-file-word"}`} /></span>
                    <span className="discussion-fichier-details"><strong>{message.piece.nom}</strong><small>{tailleLisible(message.piece.taille)}{mediasLocaux[message.id] ? " · disponible hors ligne" : ""}</small></span>
                    <BoutonTelechargement progression={progressionMedia} enCours={telechargementActif} onClick={() => ouvrirDocumentMessage(message)} label="Enregistrer et ouvrir le document" />
                  </div>}
                  </>}
                  <span className="discussion-heure">{heure(message.created_at)}{message.modifie && <small className="discussion-message-modifie"> · modifié</small>}</span>
                </div>
                {!message.supprime_pour_tous && <button type="button" className="discussion-repondre-rapide" onClick={() => commencerReponse(message)} title="Répondre"><i className="fa-solid fa-reply" /></button>}
              </div>
              {propre && <AvatarIcone username={message.auteur} taille={30} />}
            </article>
          );
        })}
        {typing.length > 0 && <div className="discussion-typing"><span /><span /><span />{typing.slice(0, 2).map(user => membres.find(m => m.username === user)?.nom || user).join(", ")} écrit{typing.length > 1 ? "ent" : ""}…</div>}
      </div>

      {messageErreur && <div className="discussion-erreur-message" role="alert">{messageErreur}<button type="button" onClick={() => setMessageErreur("")} aria-label="Fermer"><i className="fa-solid fa-xmark" /></button></div>}
      {!estGrindEnLigne() ? <div className="discussion-hors-ligne-note"><i className="fa-solid fa-wifi-slash" /> Lecture hors ligne · les envois reprendront avec Internet.</div> : restreint ? <div className="discussion-restreint"><i className="fa-solid fa-comment-slash" /> Tu ne peux pas envoyer de message{discussion.restriction_jusqua ? ` jusqu'au ${new Date(discussion.restriction_jusqua).toLocaleString()}` : " pour le moment"}.</div> : (
        <div className="discussion-compositeur-zone">
          {messageEnEdition && <div className="discussion-reponse-active discussion-edition-active"><span><strong>Modification du message</strong><small>Tu peux modifier ton texte pendant les 15 premières minutes.</small></span><button type="button" onClick={() => { setMessageEnEdition(null); setTexte(""); }} aria-label="Annuler la modification"><i className="fa-solid fa-xmark" /></button></div>}
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
                <textarea ref={textareaRef} rows={1} value={texte} onChange={event => changerTexte(event.target.value)} enterKeyHint="enter" placeholder={messageEnEdition ? "Modifier ton message…" : "Écrire un message…"} disabled={envoi || !!fichier} />
                {(texte.trim() || fichier) && <button type="button" className="discussion-envoyer" onClick={envoyer} disabled={envoi} title="Envoyer" aria-label="Envoyer">{envoi ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className={`fa-solid ${messageEnEdition ? "fa-check" : "fa-paper-plane"}`} />}</button>}
              </>
            )}
            <button
              type="button"
              className={`discussion-vocal-bouton ${vocalEnCours || vocalPreparation ? "actif" : ""}`}
              onPointerDown={demarrerVocal}
              onPointerMove={deplacerPointeurVocal}
              onPointerUp={relacherPointeurVocal}
              onPointerCancel={annulerEnregistrementVocal}
              disabled={envoi || !!messageEnEdition || (!vocalEnCours && (!!texte.trim() || !!fichier))}
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

      {confirmationSuppressionOuverte && (
        <div className="discussion-confirmation-fond" onMouseDown={event => { if (event.target === event.currentTarget && !suppressionEnCours) setConfirmationSuppressionOuverte(false); }}>
          <div className="discussion-confirmation-carte" role="dialog" aria-modal="true" aria-labelledby="discussion-confirmation-suppression-titre">
            <div className="discussion-confirmation-icone"><i className="fa-solid fa-trash-can" aria-hidden="true" /></div>
            <strong id="discussion-confirmation-suppression-titre">Supprimer ce message pour tout le monde ?</strong>
            <p>Ce message ne sera plus visible par les membres de la discussion. Cette action est définitive.</p>
            <div className="discussion-confirmation-actions">
              <button type="button" onClick={() => setConfirmationSuppressionOuverte(false)} disabled={suppressionEnCours}>Annuler</button>
              <button type="button" className="discussion-confirmation-danger" onClick={confirmerSuppressionSelectionPourTous} disabled={suppressionEnCours}>{suppressionEnCours ? <><i className="fa-solid fa-circle-notch fa-spin" /> Suppression…</> : "Confirmer la suppression"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
