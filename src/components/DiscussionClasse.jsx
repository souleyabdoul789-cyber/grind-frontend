import { useCallback, useEffect, useRef, useState } from "react";
import AvatarIcone from "./AvatarIcone.jsx";
import {
  stockageAndroidDisponible, sourceLocaleMedia, nettoyerCacheMediaAndroid, effacerCacheClasseMediaAndroid,
  chercherMediaTemporaire, chercherMediaEnregistre, mettreEnCacheMedia,
  enregistrerMediaAndroid, enregistrerMediaCacheAndroid, ouvrirFichierAndroid, ecouterProgressionMedia,
  telechargerDansNavigateur,
} from "../mediaStorage.js";
import {
  GRIND_URL, obtenirDiscussionClasse, listerMessagesDiscussion, urlDiscussion,
  listerMentionsDiscussion, marquerMentionDiscussionLue, marquerMessagesDiscussionLus,
  rejoindreVraieClasseDepuisDiscussion,
  modifierPhotoDiscussion, ajouterAdminDiscussion, retirerAdminDiscussion,
  restreindreMembreDiscussion, leverRestrictionDiscussion, retirerMembreDiscussion,
  transfererProprietaireDiscussion, renouvelerInvitationDiscussion,
  obtenirTicketsMediaDiscussion, obtenirTicketPieceDiscussion, modifierMessageDiscussion,
  supprimerMessageDiscussionPourMoi, supprimerMessageDiscussionPourTous,
} from "../api.js";

async function posterDiscussionAvecReprise(url, payload, etape) {
  const delais = [500, 1200, 2400];
  let derniereErreur = null;
  for (let tentative = 0; tentative <= delais.length; tentative += 1) {
    let controleur = null;
    let timer = null;
    try {
      controleur = new AbortController();
      timer = window.setTimeout(() => controleur.abort(), 12000);
      const response = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: controleur.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const erreur = new Error(typeof data.detail === "string"
          ? data.detail : data.detail?.message || `Échec de ${etape} (HTTP ${response.status}).`);
        erreur.status = response.status;
        throw erreur;
      }
      return data;
    } catch (erreur) {
      derniereErreur = erreur;
      const statut = Number(erreur?.status || (erreur?.name === "AbortError" ? 408 : 0));
      derniereErreur.status = statut;
      const temporaire = !statut || [408, 425, 429, 500, 502, 503, 504].includes(statut);
      if (!temporaire || tentative === delais.length) break;
      await new Promise(resolve => window.setTimeout(resolve, delais[tentative]));
    } finally {
      if (timer !== null) window.clearTimeout(timer);
    }
  }
  throw derniereErreur || new Error(`Échec de ${etape}.`);
}

async function uploaderVocalDiscussionMedia(sessionToken, fichier, onProgress = null) {
  if (!fichier || !String(fichier.type || "").toLowerCase().startsWith("audio/")) {
    throw new Error("L'enregistrement vocal n'est pas valide.");
  }
  if (fichier.size <= 0 || fichier.size > 8 * 1024 * 1024) {
    throw new Error("Le vocal doit être non vide et ne pas dépasser 8 Mo.");
  }
  const nom = String(fichier.name || "message-vocal.webm").replace(/\\/g, "/").split("/").pop().slice(0, 180);
  const extension = nom.split(".").pop().toLowerCase();
  const mime = String(fichier.type || "audio/webm").split(";", 1)[0].trim().toLowerCase();
  const mimeAutorises = { webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", mp3: "audio/mpeg" };
  if (!mimeAutorises[extension] || mime !== mimeAutorises[extension]) {
    throw new Error("Le format vocal doit être WEBM, OGG, M4A ou MP3.");
  }

  const signature = await posterDiscussionAvecReprise(`${GRIND_URL}/api/media/upload/signature`, {
    session_token: sessionToken, file_name: nom, file_size: fichier.size, content_type: mime,
    usage: "discussion",
  }, "la signature du vocal");
  const uploadUrl = verifierDestinationCloudinaryDiscussion(signature, "video", "audio");

  const asset = await new Promise((resolve, reject) => {
    const formulaire = new FormData();
    formulaire.append("file", fichier, nom);
    formulaire.append("api_key", signature.api_key);
    formulaire.append("timestamp", String(signature.timestamp));
    formulaire.append("signature", signature.signature);
    Object.entries(signature.params || {}).forEach(([cle, valeur]) => formulaire.append(cle, String(valeur)));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl.href, true);
    xhr.timeout = 120000;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(Math.min(98, Math.round(event.loaded / event.total * 98)));
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || "{}"); } catch {}
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(data.error?.message || `Cloudinary a refusé le vocal (HTTP ${xhr.status}).`));
        return;
      }
      if (!data.secure_url || !data.public_id || !data.version || !data.signature
          || data.resource_type !== "video") {
        reject(new Error("Cloudinary n'a pas confirmé un fichier vocal exploitable."));
        return;
      }
      resolve(data);
    };
    xhr.onerror = () => reject(new Error("Connexion interrompue pendant l'envoi du vocal."));
    xhr.ontimeout = () => reject(new Error("Le transfert vocal a dépassé le délai autorisé."));
    xhr.onabort = () => reject(new Error("Transfert vocal annulé."));
    xhr.send(formulaire);
  });

  onProgress?.(99);
  const confirmation = await posterDiscussionAvecReprise(`${GRIND_URL}/api/media/upload/confirm`, {
    session_token: sessionToken, asset,
  }, "la confirmation du vocal");
  if (!confirmation?.media_url || confirmation.media_type !== "audio" || confirmation.usage !== "discussion") {
    throw new Error("Le serveur GRIND n'a pas confirmé ce message vocal.");
  }
  onProgress?.(100);
  return {
    url: confirmation.media_url, type: "audio", nom, mime,
    taille: Number(asset.bytes) || fichier.size,
  };
}

async function uploaderDocumentPriveDiscussion(sessionToken, fichier, onProgress = null) {
  if (!sessionToken || !fichier) throw new Error("Session ou document manquant.");
  const nomOriginal = String(fichier.name || "document").replace(/\\/g, "/").split("/").pop().slice(0, 160);
  const mimeDeclare = String(fichier.type || "").split(";", 1)[0].trim().toLowerCase();
  const extensionNom = nomOriginal.includes(".") ? nomOriginal.split(".").pop().toLowerCase() : "";
  const extensionMime = mimeDeclare === "application/pdf" ? "pdf"
    : mimeDeclare === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? "docx" : "";
  const extension = ["pdf", "docx"].includes(extensionNom) ? extensionNom : extensionMime;
  const mimeParExtension = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const mime = mimeParExtension[extension];
  if (!mime || (mimeDeclare && mimeDeclare !== mime && mimeDeclare !== "application/octet-stream")) {
    throw new Error("Seuls les documents PDF et DOCX valides sont acceptés.");
  }
  if (fichier.size <= 0 || fichier.size > 15 * 1024 * 1024) {
    throw new Error("Le document doit être non vide et ne pas dépasser 15 Mo.");
  }
  const nom = /\.(pdf|docx)$/i.test(nomOriginal) ? nomOriginal : `${nomOriginal}.${extension}`;
  const fichierNormalise = new File([fichier], nom, {
    type: mime, lastModified: Number(fichier.lastModified) || Date.now(),
  });

  const signature = await posterDiscussionAvecReprise(`${GRIND_URL}/api/media/upload/signature`, {
    session_token: sessionToken, file_name: nom, file_size: fichierNormalise.size,
    content_type: mime, usage: "discussion",
  }, "la signature du document privé");
  const destination = verifierDestinationCloudinaryDiscussion(signature, "raw", "document");

  const asset = await new Promise((resolve, reject) => {
    const formulaire = new FormData();
    formulaire.append("file", fichierNormalise, nom);
    formulaire.append("api_key", signature.api_key);
    formulaire.append("timestamp", String(signature.timestamp));
    formulaire.append("signature", signature.signature);
    Object.entries(signature.params || {}).forEach(([cle, valeur]) => formulaire.append(cle, String(valeur)));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", destination.href, true);
    xhr.timeout = 120000;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(Math.min(98, Math.round(event.loaded / event.total * 98)));
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || "{}"); } catch {}
      if (xhr.status < 200 || xhr.status >= 300) {
        const erreur = new Error(data.error?.message || `Cloudinary a refusé le document (HTTP ${xhr.status}).`);
        erreur.status = xhr.status;
        reject(erreur);
        return;
      }
      if (!data.secure_url || !data.public_id || !data.version || !data.signature || data.resource_type !== "raw") {
        reject(new Error("Cloudinary n'a pas confirmé un document exploitable."));
        return;
      }
      resolve(data);
    };
    xhr.onerror = () => { const erreur = new Error("Connexion interrompue pendant le transfert du document."); erreur.status = 0; reject(erreur); };
    xhr.ontimeout = () => { const erreur = new Error("Le transfert du document a dépassé le délai autorisé."); erreur.status = 408; reject(erreur); };
    xhr.onabort = () => { const erreur = new Error("Transfert du document annulé."); erreur.status = 0; reject(erreur); };
    xhr.send(formulaire);
  });

  onProgress?.(99);
  const confirmation = await posterDiscussionAvecReprise(`${GRIND_URL}/api/media/upload/confirm`, {
    session_token: sessionToken, asset, usage: "discussion",
  }, "la confirmation du document privé");
  if (!confirmation?.media_url || confirmation.media_type !== "document" || confirmation.usage !== "discussion") {
    throw new Error("Le serveur GRIND n'a pas confirmé ce document privé.");
  }
  onProgress?.(100);
  return {
    document_url: confirmation.media_url, document_name: nom, document_type: mime,
    document_size: Number(asset.bytes) || fichierNormalise.size,
  };
}

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

// Le contrôle /api/health peut échouer pendant le réveil du serveur alors que
// le téléphone a Internet. Dans la messagerie, on tente donc les requêtes tant
// que le navigateur n'a pas signalé une vraie coupure réseau.
function reseauInternetDisponible() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

// Publications texte ordonnées par discussion : l'UI est optimiste, mais le
// serveur reçoit les POST dans le même ordre que la saisie de l'utilisateur.
const chainPublicationDiscussion = new Map();
function publierDiscussionDansOrdre(cle, operation) {
  const precedent = chainPublicationDiscussion.get(cle) || Promise.resolve();
  const courant = precedent.catch(() => {}).then(operation);
  chainPublicationDiscussion.set(cle, courant);
  courant.finally(() => {
    if (chainPublicationDiscussion.get(cle) === courant) chainPublicationDiscussion.delete(cle);
  }).catch(() => {});
  return courant;
}

// Limite les transferts Cloudinary simultanés à trois, sans bloquer le compositeur.
let uploadsDiscussionActifs = 0;
const attenteUploadsDiscussion = [];
async function avecSlotUploadDiscussion(operation) {
  if (uploadsDiscussionActifs >= 3) {
    await new Promise(resolve => attenteUploadsDiscussion.push(resolve));
  }
  uploadsDiscussionActifs += 1;
  try { return await operation(); }
  finally {
    uploadsDiscussionActifs = Math.max(0, uploadsDiscussionActifs - 1);
    const reveiller = attenteUploadsDiscussion.shift();
    if (reveiller) reveiller();
  }
}

function verifierDestinationCloudinaryDiscussion(signature, ressourceAttendue, typeMediaAttendu = null) {
  let destination = null;
  try { destination = new URL(String(signature?.upload_url || "")); } catch { /* URL invalide */ }
  const segments = destination?.pathname.split("/").filter(Boolean) || [];
  const nomCloud = segments[1] || "";
  const destinationValide = Boolean(destination)
    && destination.protocol === "https:"
    && destination.hostname === "api.cloudinary.com"
    && !destination.port && !destination.username && !destination.password
    && !destination.search && !destination.hash
    && segments.length === 4 && segments[0] === "v1_1"
    && /^[A-Za-z][A-Za-z0-9-]{1,127}$/.test(nomCloud)
    && segments[2] === ressourceAttendue && segments[3] === "upload";
  const signatureValide = signature?.resource_type === ressourceAttendue
    && signature?.usage === "discussion"
    && (!typeMediaAttendu || signature?.media_type === typeMediaAttendu)
    && Boolean(signature?.api_key && signature?.signature && signature?.timestamp);
  if (!destinationValide || !signatureValide) {
    throw new Error(
      "Configuration de transfert Cloudinary invalide côté serveur. Vérifie CLOUDINARY_URL ou les trois variables Cloudinary dans la configuration Render de GRIND, puis redémarre le service."
    );
  }
  return destination;
}

async function uploaderMediaPriveDiscussion(sessionToken, fichier, decoupeVideo = null, onProgress = null) {
  if (!sessionToken || !fichier) throw new Error("Session ou fichier manquant.");
  const nomOriginal = String(fichier.name || "media").replace(/\\/g, "/").split("/").pop().slice(0, 160);
  const extensionOriginale = nomOriginal.includes(".") ? nomOriginal.split(".").pop().toLowerCase() : "";
  const mimeDeclare = String(fichier.type || "").split(";", 1)[0].trim().toLowerCase();
  const extensionsParMime = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
  };
  const extensionsAutorisees = new Set(["jpg", "jpeg", "png", "webp", "mp4", "mov", "webm"]);
  const extension = extensionsAutorisees.has(extensionOriginale)
    ? extensionOriginale : extensionsParMime[mimeDeclare] || "";
  if (!extension) throw new Error("Format d'image ou de vidéo non pris en charge.");
  const baseNom = nomOriginal.replace(/\.[^.]+$/, "") || "media";
  const nom = extensionsAutorisees.has(extensionOriginale) ? nomOriginal : `${baseNom}.${extension}`;
  const estVideo = ["mp4", "mov", "webm"].includes(extension);
  const limite = estVideo ? 300 : 25;
  if (fichier.size <= 0 || fichier.size > limite * 1024 * 1024) {
    throw new Error(`Le fichier doit être non vide et ne pas dépasser ${limite} Mo.`);
  }
  const typeAttendu = ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" })[extension];
  const mime = !mimeDeclare || mimeDeclare === "application/octet-stream" || mimeDeclare === "image/jpg"
    ? typeAttendu : mimeDeclare;
  if (mime !== typeAttendu) throw new Error("Le type du fichier ne correspond pas à son extension.");
  if (estVideo && (!decoupeVideo || !Number.isFinite(Number(decoupeVideo.debut)) || !Number.isFinite(Number(decoupeVideo.fin)))) {
    throw new Error("Les informations de durée de la vidéo sont invalides.");
  }

  const signature = await posterDiscussionAvecReprise(`${GRIND_URL}/api/media/upload/signature`, {
    session_token: sessionToken, file_name: nom, file_size: fichier.size, content_type: mime,
    debut_video: decoupeVideo?.debut, fin_video: decoupeVideo?.fin, usage: "discussion",
  }, "la signature du média privé");
  const resourceType = estVideo ? "video" : "image";
  const destination = verifierDestinationCloudinaryDiscussion(signature, resourceType, estVideo ? "video" : "image");

  const transmettre = (blob, debut = null, fin = null) => new Promise((resolve, reject) => {
    const formulaire = new FormData();
    formulaire.append("file", blob, nom);
    formulaire.append("api_key", signature.api_key);
    formulaire.append("timestamp", String(signature.timestamp));
    formulaire.append("signature", signature.signature);
    Object.entries(signature.params || {}).forEach(([cle, valeur]) => formulaire.append(cle, String(valeur)));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", destination.href, true);
    xhr.timeout = 15 * 60 * 1000;
    if (debut !== null && fin !== null) {
      xhr.setRequestHeader("Content-Range", `bytes ${debut}-${fin}/${fichier.size}`);
    }
    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return;
      const charge = debut === null ? event.loaded : debut + Math.min(event.loaded, event.total);
      const pourcentage = charge / fichier.size * 98;
      onProgress?.(Math.max(0, Math.min(98, Math.round(pourcentage))));
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || "{}"); } catch {}
      if (xhr.status < 200 || xhr.status >= 300) {
        const erreur = new Error(data.error?.message || `Cloudinary a refusé le fichier (HTTP ${xhr.status}).`);
        erreur.status = xhr.status;
        reject(erreur);
      } else resolve(data);
    };
    xhr.onerror = () => { const e = new Error("Connexion interrompue pendant le transfert du média."); e.status = 0; reject(e); };
    xhr.ontimeout = () => { const e = new Error("Le transfert du média a dépassé le délai autorisé."); e.status = 408; reject(e); };
    xhr.onabort = () => { const e = new Error("Transfert du média annulé."); e.status = 0; reject(e); };
    xhr.send(formulaire);
  });

  let asset;
  if (estVideo && fichier.size > 90 * 1024 * 1024) {
    const chunkSize = Number(signature.taille_chunk_octets || 20 * 1024 * 1024);
    if (chunkSize < 5 * 1024 * 1024) throw new Error("Taille de segment Cloudinary invalide.");
    const uploadId = globalThis.crypto?.randomUUID?.() || `grind-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    for (let debut = 0; debut < fichier.size; debut += chunkSize) {
      const finExclusive = Math.min(debut + chunkSize, fichier.size);
      const resultat = await new Promise((resolve, reject) => {
        const formulaire = new FormData();
        const morceau = fichier.slice(debut, finExclusive);
        formulaire.append("file", morceau, nom);
        formulaire.append("api_key", signature.api_key);
        formulaire.append("timestamp", String(signature.timestamp));
        formulaire.append("signature", signature.signature);
        Object.entries(signature.params || {}).forEach(([cle, valeur]) => formulaire.append(cle, String(valeur)));
        const xhr = new XMLHttpRequest();
        xhr.open("POST", destination.href, true);
        xhr.timeout = 15 * 60 * 1000;
        xhr.setRequestHeader("Content-Range", `bytes ${debut}-${finExclusive - 1}/${fichier.size}`);
        xhr.setRequestHeader("X-Unique-Upload-Id", uploadId);
        xhr.upload.onprogress = event => {
          if (event.lengthComputable) onProgress?.(Math.min(98, Math.round((debut + event.loaded) / fichier.size * 98)));
        };
        xhr.onload = () => {
          let d = {}; try { d = JSON.parse(xhr.responseText || "{}"); } catch {}
          if (xhr.status < 200 || xhr.status >= 300) reject(new Error(d.error?.message || `Cloudinary a refusé le segment (HTTP ${xhr.status}).`));
          else resolve(d);
        };
        xhr.onerror = () => reject(new Error("Connexion interrompue pendant le transfert vidéo."));
        xhr.ontimeout = () => reject(new Error("Le transfert vidéo a dépassé le délai autorisé."));
        xhr.send(formulaire);
      });
      const dernier = finExclusive === fichier.size;
      if (!dernier && resultat.done !== false) throw new Error("Cloudinary n'a pas confirmé le segment vidéo.");
      if (dernier) {
        if (resultat.done !== true) throw new Error("Cloudinary n'a pas confirmé la fin de la vidéo.");
        asset = resultat;
      }
    }
  } else {
    asset = await transmettre(fichier);
  }
  if (!asset?.secure_url || !asset?.public_id || !asset?.version || !asset?.signature) {
    throw new Error("Le stockage n'a pas confirmé la réception complète du média.");
  }
  onProgress?.(99);
  const confirmation = await posterDiscussionAvecReprise(`${GRIND_URL}/api/media/upload/confirm`, {
    session_token: sessionToken, asset,
    debut_video: decoupeVideo?.debut, fin_video: decoupeVideo?.fin,
  }, "la confirmation du média privé");
  if (!confirmation?.media_url || confirmation.usage !== "discussion") {
    throw new Error("Le serveur GRIND n'a pas confirmé le média privé.");
  }
  onProgress?.(100);
  return confirmation;
}

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

function nomPosterTemporaire(username, classeId, message) {
  return `u-${cleCompteFichier(username)}-classe-${classeId}-message-${message.id}-poster.jpg`;
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

function BoutonTelechargement({ progression = null, enCours = false, disabled = false, onClick, label }) {
  const valeur = Number.isFinite(progression) ? Math.max(0, Math.min(100, progression)) : 0;
  return (
    <button
      type="button"
      className={`discussion-download-button ${enCours ? "en-cours" : ""}`}
      style={{ "--download-progress": `${valeur}%` }}
      onClick={onClick}
      disabled={enCours || disabled}
      title={label}
      aria-label={enCours ? `Téléchargement ${progression == null || progression < 0 ? "en cours" : `${valeur}%`}` : label}
    >
      <span className="discussion-download-ring" aria-hidden="true">
        <i className={`fa-solid ${enCours ? "fa-circle-notch fa-spin" : "fa-download"}`} />
      </span>
    </button>
  );
}

function VideoDiscussion({ src, poster, nom, messageId }) {
  const [erreur, setErreur] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [ratio, setRatio] = useState(16 / 9);
  useEffect(() => {
    setErreur(false);
    setChargement(true);
    setRatio(16 / 9);
  }, [src, poster]);

  function actualiserRatio(event) {
    const video = event.currentTarget;
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setRatio(Math.max(0.5625, Math.min(2.4, video.videoWidth / video.videoHeight)));
    }
  }

  return (
    <div className="discussion-video-shell" style={{ aspectRatio: ratio }}>
      {!src && <div className="discussion-video-placeholder">
        {poster && <img src={poster} alt="Miniature de la vidéo" loading="lazy" />}
        {!poster && <span className="discussion-video-skeleton" aria-hidden="true" />}
        <i className="fa-solid fa-circle-play" aria-hidden="true" />
        <small>Vidéo non téléchargée sur cet appareil</small>
      </div>}
      {src && <>
        {chargement && <span className="discussion-video-skeleton" aria-hidden="true" />}
        <video
          className="discussion-video"
          data-message-id={messageId}
          src={src}
          poster={poster || undefined}
          controls
          playsInline
          preload="metadata"
          aria-label={nom || "Vidéo partagée dans la discussion"}
          onLoadedMetadata={actualiserRatio}
          onLoadedData={() => setChargement(false)}
          onCanPlay={() => setChargement(false)}
          onWaiting={() => setChargement(true)}
          onPlaying={() => setChargement(false)}
          onError={() => { setErreur(true); setChargement(false); }}
        />
      </>}
      {erreur && <div className="discussion-video-error">Cette vidéo ne peut pas être lue sur cet appareil.</div>}
    </div>
  );
}

function LecteurVocal({ src, id, dureeInitiale = 0 }) {
  const audioRef = useRef(null);
  const pisteRef = useRef(null);
  const [lecture, setLecture] = useState(false);
  const [courant, setCourant] = useState(0);
  const [duree, setDuree] = useState(() => Number.isFinite(Number(dureeInitiale)) ? Math.max(0, Number(dureeInitiale)) : 0);
  const [erreur, setErreur] = useState(false);
  const progression = duree > 0 ? Math.min(100, Math.max(0, (courant / duree) * 100)) : 0;
  const hauteurs = Array.from({ length: NOMBRE_BARRES_VOCAL }, (_, index) => {
    const seed = (Number(id) * 17 + index * 29 + index * index * 7) % 31;
    return 5 + seed % 17;
  });

  useEffect(() => {
    const audio = audioRef.current;
    setLecture(false); setCourant(0);
    setDuree(Number.isFinite(Number(dureeInitiale)) ? Math.max(0, Number(dureeInitiale)) : 0);
    setErreur(false);
    if (audio) { audio.pause(); audio.currentTime = 0; audio.loop = false; }
    return () => {
      if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
      if (lecteurVocalActif === audio) lecteurVocalActif = null;
    };
  }, [src, dureeInitiale]);

  // timeupdate est trop peu fréquent et irrégulier dans certains WebView Android.
  // Le RAF suit currentTime pendant la lecture et s'arrête dès la pause.
  useEffect(() => {
    if (!lecture) return undefined;
    let frame = 0;
    let dernier = 0;
    const suivre = (horodatage) => {
      const audio = audioRef.current;
      if (!audio || audio.paused || audio.ended) return;
      if (horodatage - dernier >= 70) {
        const value = Number(audio.currentTime);
        if (Number.isFinite(value)) setCourant(value);
        dernier = horodatage;
      }
      frame = window.requestAnimationFrame(suivre);
    };
    frame = window.requestAnimationFrame(suivre);
    return () => window.cancelAnimationFrame(frame);
  }, [lecture, src]);

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
    let value = Number(audio?.duration);
    if (!Number.isFinite(value) || value <= 0) {
      // Certains WebView Android exposent duration=Infinity pour les WebM
      // produits par MediaRecorder ; la dernière plage seekable reste exploitable.
      try {
        const plages = audio?.seekable;
        if (plages?.length) value = Number(plages.end(plages.length - 1));
      } catch { value = 0; }
    }
    if (Number.isFinite(value) && value > 0) setDuree(precedente => Math.max(precedente, value));
  }

  function chercherPourcentage(pourcentage) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(duree) || duree <= 0) return;
    const cible = Math.max(0, Math.min(1, pourcentage)) * duree;
    audio.currentTime = cible;
    setCourant(cible);
  }

  function chercherDepuisPointeur(event) {
    const piste = pisteRef.current;
    if (!piste || duree <= 0) return;
    const rect = piste.getBoundingClientRect();
    if (!rect.width) return;
    chercherPourcentage((event.clientX - rect.left) / rect.width);
  }

  function gererClavier(event) {
    if (duree <= 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const audio = audioRef.current;
      const delta = event.key === "ArrowRight" ? 5 : -5;
      const cible = Math.max(0, Math.min(duree, (audio?.currentTime || 0) + delta));
      if (audio) audio.currentTime = cible;
      setCourant(cible);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      chercherPourcentage(event.key === "Home" ? 0 : 1);
    }
  }

  function terminerLecture() {
    const audio = audioRef.current;
    setLecture(false);
    if (audio) { audio.pause(); audio.currentTime = 0; }
    setCourant(0);
    if (lecteurVocalActif === audio) lecteurVocalActif = null;
  }

  return (
    <div className={`discussion-vocal-player ${!src ? "sans-source" : ""}`}>
      <audio ref={audioRef} src={src || undefined} preload="metadata" loop={false}
        onLoadedMetadata={event => actualiserDuree(event.currentTarget)}
        onDurationChange={event => actualiserDuree(event.currentTarget)}
        onTimeUpdate={event => {
          actualiserDuree(event.currentTarget);
          const value = Number(event.currentTarget.currentTime);
          if (Number.isFinite(value)) setCourant(value);
        }}
        onEnded={terminerLecture}
        onPause={event => { setLecture(false); if (lecteurVocalActif === event.currentTarget) lecteurVocalActif = null; }}
        onPlay={() => { setLecture(true); setErreur(false); }}
        onError={event => { setLecture(false); setErreur(true); if (lecteurVocalActif === event.currentTarget) lecteurVocalActif = null; }} />
      <button type="button" className="discussion-vocal-play" onClick={basculerLecture} disabled={!src} aria-label={lecture ? "Mettre en pause le vocal" : "Lire le message vocal"}>
        <i className={`fa-solid ${lecture ? "fa-pause" : "fa-play"}`} />
      </button>
      <div className="discussion-vocal-piste">
        <div ref={pisteRef} className="discussion-vocal-ondes discussion-vocal-ondes-seek" role="slider"
          aria-label="Position du message vocal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progression)}
          aria-valuetext={`${dureeLisible(courant)} sur ${dureeLisible(duree)}`} tabIndex={src && duree > 0 ? 0 : -1}
          onClick={chercherDepuisPointeur} onKeyDown={gererClavier} aria-disabled={!src || duree <= 0}>
          {hauteurs.map((h, index) => <span key={index} className={index / hauteurs.length * 100 <= progression ? "jouee" : ""} style={{ height: `${h}px` }} />)}
        </div>
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

function cleFileAttenteDiscussion(classeId, username) {
  return `grind_discussion_outbox_${username || "compte"}_${classeId}`;
}

function lireFileAttenteDiscussion(classeId, username) {
  try {
    const valeur = JSON.parse(localStorage.getItem(cleFileAttenteDiscussion(classeId, username)) || "[]");
    if (!Array.isArray(valeur)) return [];
    return valeur.filter(item => item && typeof item.contenu === "string"
      && typeof item.client_message_id === "string").slice(0, 20);
  } catch { return []; }
}

function persisterMessageDansOutbox(classeId, username, element) {
  try {
    const cle = cleFileAttenteDiscussion(classeId, username);
    const precedente = lireFileAttenteDiscussion(classeId, username);
    const fusionnee = [
      ...precedente.filter(item => item.client_message_id !== element.client_message_id),
      { ...element, failed: false },
    ].slice(-20);
    localStorage.setItem(cle, JSON.stringify(fusionnee));
    return true;
  } catch {
    return false;
  }
}

async function envoyerMessageDiscussionAvecReprise(sessionToken, classeId, payload) {
  const delais = [500, 1200, 2400];
  let derniereErreur = null;
  for (let tentative = 0; tentative <= delais.length; tentative += 1) {
    let controleur = null;
    let timer = null;
    try {
      controleur = new AbortController();
      timer = window.setTimeout(() => controleur.abort(), 12000);
      const response = await fetch(`${GRIND_URL}/api/classes/${classeId}/discussion/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: sessionToken, ...payload }),
        signal: controleur.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data.detail;
        const erreur = new Error(typeof detail === "string" ? detail : detail?.message || "Le message n'a pas pu être publié.");
        erreur.status = response.status;
        throw erreur;
      }
      return data;
    } catch (erreur) {
      derniereErreur = erreur;
      const statut = Number(erreur?.status || (erreur?.name === "AbortError" ? 408 : 0));
      derniereErreur.status = statut;
      const temporaire = !statut || [408, 425, 429, 500, 502, 503, 504].includes(statut);
      if (!temporaire || tentative === delais.length) break;
      await new Promise(resolve => window.setTimeout(resolve, delais[tentative]));
    } finally {
      if (timer !== null) window.clearTimeout(timer);
    }
  }
  throw derniereErreur || new Error("Le message n'a pas pu être confirmé par GRIND.");
}

function nouveauClientMessageId() {
  return globalThis.crypto?.randomUUID?.()
    || `grind-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function ordonnerMessagesDiscussion(messages) {
  return [...(messages || [])].sort((a, b) => {
    const aOptimiste = Boolean(a.optimistic);
    const bOptimiste = Boolean(b.optimistic);
    if (aOptimiste !== bOptimiste) return aOptimiste ? 1 : -1;
    if (aOptimiste && bOptimiste) {
      return Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0);
    }
    return Number(a.id) - Number(b.id);
  });
}

function fusionnerMessageDiscussion(messages, entrant) {
  const precedent = (messages || []).find(message => entrant.client_message_id
    && message.client_message_id === entrant.client_message_id);
  const suivant = (messages || []).filter(message => message.id !== entrant.id
    && !(entrant.client_message_id && message.client_message_id === entrant.client_message_id));
  const fusion = precedent ? {
    ...precedent,
    ...entrant,
    // Garde la source locale jusqu'au démontage : le ticket privé peut arriver
    // après le POST et ne doit pas faire clignoter l'image ni réinitialiser l'audio.
    preview_url: precedent.preview_url || entrant.preview_url || null,
    piece: precedent.piece && entrant.piece
      ? { ...entrant.piece, duree: Number(entrant.piece.duree) > 0 ? entrant.piece.duree : precedent.piece.duree }
      : entrant.piece || precedent.piece,
    media_envoi: Number(entrant.id) > 0 ? false : Boolean(precedent.media_envoi || entrant.media_envoi),
    optimistic: Number(entrant.id) > 0 ? false : Boolean(precedent.optimistic || entrant.optimistic),
  } : entrant;
  suivant.push(fusion);
  return ordonnerMessagesDiscussion(suivant);
}

export default function DiscussionClasse({ sessionToken, classe, monUsername, messageAouvrirId = null, onQuitter }) {
  const cacheInitial = lireCacheDiscussion(classe.classe_id, monUsername);
  const [discussion, setDiscussion] = useState(cacheInitial?.discussion || null);
  const [membres, setMembres] = useState(cacheInitial?.membres || []);
  const [messages, setMessages] = useState(cacheInitial?.messages || []);
  const [messagesEnAttente, setMessagesEnAttente] = useState(() => lireFileAttenteDiscussion(classe.classe_id, monUsername));
  const [revisionReseau, setRevisionReseau] = useState(0);
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
  const [ticketsMedia, setTicketsMedia] = useState({});
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
  const pendingMessageIdRef = useRef(null);
  const pendingMessagePieceRef = useRef(null);
  const pendingMessagePayloadRef = useRef(null);
  const pendingVocalIdRef = useRef(null);
  const vocalPublicationEnCoursRef = useRef(false);
  const fileAttenteEnCoursRef = useRef(false);
  const tentativesFileAttenteRef = useRef(new Map());
  const prochaineTentativeFileAttenteRef = useRef(0);
  const prochaineIdOptimisteRef = useRef(0);
  const apercusMediaRef = useRef(new Map());
  const pendingVocalPieceRef = useRef(null);
  const messagesEnAttenteRef = useRef(messagesEnAttente);
  messagesEnAttenteRef.current = messagesEnAttente;
  const messagesActuels = useRef([]);
  const dernierMessageLuRef = useRef(0);
  const lectureEnAttenteRef = useRef(0);
  const lectureEnCoursRef = useRef(false);
  const lectureTimerRef = useRef(null);
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
  const cleOutboxDiscussion = cleFileAttenteDiscussion(classe.classe_id, monUsername);
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
    const parClientId = new Map(messages
      .filter(message => message?.client_message_id)
      .map(message => [message.client_message_id, message]));
    for (const [clientId, url] of apercusMediaRef.current.entries()) {
      const message = parClientId.get(clientId);
      if (!message || message.supprime_pour_tous) {
        URL.revokeObjectURL(url);
        apercusMediaRef.current.delete(clientId);
      }
    }
  }, [messages]);

  // Les médias HTML reçoivent des tickets limités au fichier et à une durée courte.
  // Le jeton de session principal reste dans les requêtes POST authentifiées.
  useEffect(() => {
    if (!discussion?.id || !sessionToken || !messages.length || !reseauInternetDisponible()) return undefined;
    let actif = true;
    const obtenirIdsManquants = () => messages
      .filter(m => m?.piece && !m.supprime_pour_tous)
      .map(m => Number(m.id))
      .filter(id => Number.isInteger(id) && id > 0 && (!ticketsMedia[id]?.url || ticketsMedia[id].expiresAt < Date.now() + 5 * 60 * 1000));
    const renouveler = async () => {
      const ids = obtenirIdsManquants();
      if (!ids.length) return;
      try {
        const tickets = await obtenirTicketsMediaDiscussion(sessionToken, classe.classe_id, ids);
        if (actif) setTicketsMedia(prev => ({ ...prev, ...tickets }));
      } catch (error) {
        if (actif) console.debug("Tickets média GRIND non renouvelés", error?.message || "");
      }
    };
    renouveler();
    const timer = window.setInterval(renouveler, 5 * 60 * 1000);
    return () => { actif = false; window.clearInterval(timer); };
  }, [discussion?.id, sessionToken, classe.classe_id, messages, ticketsMedia]);

  async function obtenirUrlPiece(message, download = false) {
    const id = Number(message?.id);
    const cache = ticketsMedia[id];
    if (!download && cache?.url && cache.expiresAt > Date.now() + 30000) return cache.url;
    return obtenirTicketPieceDiscussion(sessionToken, classe.classe_id, id, download);
  }

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
      for (const url of apercusMediaRef.current.values()) URL.revokeObjectURL(url);
      apercusMediaRef.current.clear();
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
    if (!reseauInternetDisponible()) {
      const cache = lireCacheDiscussion(classe.classe_id, monUsername);
      setSocketEtat("hors ligne");
      if (!cache?.discussion) {
        const erreur = new Error("Cette discussion n'a pas encore été téléchargée sur cet appareil.");
        erreur.code = "CACHE_ABSENT";
        throw erreur;
      }
      // Les tickets photo sont des liens porteurs temporaires : ne jamais
      // réutiliser ni persister un ticket d'une ancienne session hors ligne.
      setDiscussion({ ...cache.discussion, photo_url: null });
      setMembres(cache.membres || []);
      setMessages(cache.messages || []);
      messagesActuels.current = cache.messages || [];
      setPlusAnciens(false);
      return cache;
    }
    const data = await obtenirDiscussionClasse(sessionToken, classe.classe_id);
    const cacheLocal = lireCacheDiscussion(classe.classe_id, monUsername);
    const dureesLocales = new Map((cacheLocal?.messages || [])
      .filter(message => message.client_message_id && Number(message.piece?.duree) > 0)
      .map(message => [message.client_message_id, Number(message.piece.duree)]));
    const messagesServeur = (data.messages || []).map(message => {
      const dureeLocale = message.client_message_id ? dureesLocales.get(message.client_message_id) : null;
      return dureeLocale && message.piece?.type === "audio"
        ? { ...message, piece: { ...message.piece, duree: dureeLocale } } : message;
    });
    const idsServeur = new Set(messagesServeur.map(message => message.client_message_id).filter(Boolean));
    // Une actualisation réseau ne doit jamais effacer un transfert local encore
    // en cours. Le message sera rapproché par client_message_id après le commit.
    const messagesOptimistes = messagesActuels.current.filter(message =>
      (message.optimistic || message.media_envoi)
      && message.client_message_id && !idsServeur.has(message.client_message_id)
    );
    const messagesCharges = ordonnerMessagesDiscussion([...messagesServeur, ...messagesOptimistes]);
    setDiscussion(data.discussion);
    setMembres(data.membres || []);
    setMessages(messagesCharges);
    messagesActuels.current = messagesCharges;
    try {
      const discussionCacheable = { ...data.discussion, photo_url: null };
      localStorage.setItem(cacheDiscussionKey, JSON.stringify({
        discussion: discussionCacheable, membres: data.membres || [],
        messages: messagesServeur.filter(message => !message.preview_url && !message.media_envoi).slice(-100),
      }));
    } catch {}
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
          localStorage.removeItem(cleOutboxDiscussion);
          setMessagesEnAttente([]);
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
      const messagesPersistables = messages
        .filter(message => Number(message.id) > 0 && !message.media_envoi)
        .slice(-100)
        .map(message => {
          const { preview_url, ...messageSansApercu } = message;
          return messageSansApercu;
        });
      const discussionCacheable = discussion ? { ...discussion, photo_url: null } : discussion;
      localStorage.setItem(cacheDiscussionKey, JSON.stringify({
        discussion: discussionCacheable, membres, messages: messagesPersistables,
      }));
    } catch {}
  }, [discussion, membres, messages, cacheDiscussionKey]);


  useEffect(() => {
    try { localStorage.setItem(cleOutboxDiscussion, JSON.stringify(messagesEnAttente.slice(0, 20))); }
    catch { /* le fil reste utilisable même si le stockage local est saturé */ }
  }, [messagesEnAttente, cleOutboxDiscussion]);

  useEffect(() => {
    const verifierReseau = () => setRevisionReseau(value => value + 1);
    const reconnexion = () => {
      tentativesFileAttenteRef.current.clear();
      prochaineTentativeFileAttenteRef.current = 0;
      verifierReseau();
    };
    window.addEventListener("online", reconnexion);
    window.addEventListener("grind-api-status", reconnexion);
    const intervalle = window.setInterval(verifierReseau, 15000);
    return () => {
      window.removeEventListener("online", reconnexion);
      window.removeEventListener("grind-api-status", reconnexion);
      window.clearInterval(intervalle);
    };
  }, []);

  // Reconstitue dans le fil les messages placés en file avant une fermeture de l'app.
  // Le client_message_id reste la clé de rapprochement avec la réponse serveur.
  useEffect(() => {
    if (!messagesEnAttente.length) return;
    setMessages(prev => {
      let suivant = prev;
      for (const element of messagesEnAttente) {
        if (suivant.some(message => message.client_message_id === element.client_message_id)) continue;
        if (suivant === prev) suivant = [...prev];
        const auteur = membres.find(membre => membre.username === monUsername);
        const reponseCible = element.reply_to_id
          ? suivant.find(message => Number(message.id) === Number(element.reply_to_id))
          : null;
        const sequence = prochaineIdOptimisteRef.current++ % 1000;
        const idOptimiste = -(Date.now() * 1000 + sequence);
        suivant.push({
          id: idOptimiste,
          client_message_id: element.client_message_id,
          auteur: monUsername,
          auteur_nom: auteur?.nom || monUsername,
          contenu: element.contenu || "",
          piece: element.piece || null,
          reply_to_id: element.reply_to_id || null,
          reply: reponseCible ? {
            id: reponseCible.id,
            auteur: reponseCible.auteur,
            auteur_nom: reponseCible.auteur_nom || reponseCible.auteur,
            contenu: reponseCible.contenu || "",
          } : null,
          style_texte: element.style_texte || "normal",
          created_at: element.created_at || new Date().toISOString(),
          optimistic: true,
          supprime_pour_tous: false,
          lu_par_au_moins_un: false,
        });
      }
      return suivant === prev ? prev : ordonnerMessagesDiscussion(suivant);
    });
  }, [messagesEnAttente, membres, monUsername]);

  // Envoi séquentiel des messages texte déjà placés dans la file locale.
  // Chaque élément conserve son client_message_id : un retry après réponse perdue
  // retrouve le message côté serveur au lieu d'en créer un second.
  useEffect(() => {
    if (!discussion?.id || !sessionToken || !messagesEnAttente.length || !reseauInternetDisponible()) return undefined;
    const attenteRestante = prochaineTentativeFileAttenteRef.current - Date.now();
    if (attenteRestante > 0) {
      const timer = window.setTimeout(() => {
        prochaineTentativeFileAttenteRef.current = 0;
        setRevisionReseau(value => value + 1);
      }, attenteRestante);
      return () => window.clearTimeout(timer);
    }
    let actif = true;
    let timerNouvelleTentative = null;
    const synchroniser = async () => {
      if (fileAttenteEnCoursRef.current) return;
      fileAttenteEnCoursRef.current = true;
      const envoyes = [];
      try {
        for (const element of messagesEnAttente) {
          if (!actif || element.failed) continue;
          try {
            const resultat = await envoyerMessageDiscussionAvecReprise(sessionToken, classe.classe_id, {
              contenu: element.contenu,
              reply_to_id: element.reply_to_id || null,
              style_texte: element.style_texte || "normal",
              piece: element.piece || null,
              client_message_id: element.client_message_id,
            });
            if (!actif) return;
            tentativesFileAttenteRef.current.delete(element.client_message_id);
            setMessages(prev => fusionnerMessageDiscussion(prev, resultat.message));
            envoyes.push(element.client_message_id);
          } catch (erreur) {
            if (!actif) return;
            const statut = Number(erreur?.status || 0);
            const temporaire = !statut || [408, 425, 429, 500, 502, 503, 504].includes(statut);
            if (temporaire) {
              const tentatives = (tentativesFileAttenteRef.current.get(element.client_message_id) || 0) + 1;
              tentativesFileAttenteRef.current.set(element.client_message_id, tentatives);
              const delai = Math.min(30000, 1200 * (2 ** Math.min(tentatives - 1, 5)))
                + Math.floor(Math.random() * 500);
              // Backoff exponentiel borné : évite de marteler une API instable.
              prochaineTentativeFileAttenteRef.current = Date.now() + delai;
              timerNouvelleTentative = window.setTimeout(() => {
                if (!actif) return;
                prochaineTentativeFileAttenteRef.current = 0;
                setRevisionReseau(value => value + 1);
              }, delai);
            } else {
              setMessagesEnAttente(prev => prev.map(item => item.client_message_id === element.client_message_id
                ? { ...item, failed: true, error: erreur.message || "Le serveur a refusé ce message." } : item));
            }
            break;
          }
        }
      } finally {
        fileAttenteEnCoursRef.current = false;
        if (envoyes.length) {
          const ids = new Set(envoyes);
          setMessagesEnAttente(prev => prev.filter(item => !ids.has(item.client_message_id)));
        }
        // Si la file a changé pendant une requête, le nouvel effet a pu trouver
        // le verrou occupé. On le réveille aussitôt après la libération du verrou.
        if (!actif && composantActifRef.current
            && messagesEnAttenteRef.current.some(item => !item.failed)) {
          window.setTimeout(() => {
            if (composantActifRef.current) setRevisionReseau(value => value + 1);
          }, 0);
        }
      }
    };
    synchroniser();
    return () => {
      actif = false;
      if (timerNouvelleTentative !== null) window.clearTimeout(timerNouvelleTentative);
    };
  }, [discussion?.id, sessionToken, classe.classe_id, messagesEnAttente, revisionReseau]);

  function annulerMessageEnAttente(clientMessageId) {
    tentativesFileAttenteRef.current.delete(clientMessageId);
    const apercu = apercusMediaRef.current.get(clientMessageId);
    if (apercu) { URL.revokeObjectURL(apercu); apercusMediaRef.current.delete(clientMessageId); }
    setMessagesEnAttente(prev => prev.filter(item => item.client_message_id !== clientMessageId));
    setMessages(prev => prev.filter(message => message.client_message_id !== clientMessageId));
  }

  function retenterMessageEnAttente(clientMessageId) {
    tentativesFileAttenteRef.current.delete(clientMessageId);
    prochaineTentativeFileAttenteRef.current = 0;
    setMessagesEnAttente(prev => prev.map(item => item.client_message_id === clientMessageId
      ? { ...item, failed: false, error: null } : item));
    setRevisionReseau(value => value + 1);
  }

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
          const next = fusionnerMessageDiscussion(prev, data.message);
          messagesActuels.current = next;
          return next;
        });
        if (data.message.client_message_id) {
          setMessagesEnAttente(prev => prev.filter(item => item.client_message_id !== data.message.client_message_id));
        }
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
      } else if (data.type === "read_receipt" && data.username !== monUsername) {
        const dernierIdLu = Number(data.last_message_id || 0);
        if (dernierIdLu > 0) {
          setMessages(prev => {
            const next = prev.map(message => message.auteur === monUsername
              && Number(message.id) <= dernierIdLu
              && !message.lu_par_au_moins_un
              ? { ...message, lu_par_au_moins_un: true } : message);
            messagesActuels.current = next;
            return next;
          });
        }
      } else if (data.type === "typing" && data.username) {
        setTyping(prev => data.typing
          ? (prev.includes(data.username) ? prev : [...prev, data.username])
          : prev.filter(x => x !== data.username));
        clearTimeout(presenceTimeouts.current[data.username]);
        if (data.typing) presenceTimeouts.current[data.username] = setTimeout(() => setTyping(prev => prev.filter(x => x !== data.username)), 2600);
      } else if (data.type === "group_update") {
        obtenirDiscussionClasse(sessionToken, classe.classe_id).then(resultat => {
          if (actif) setDiscussion(resultat.discussion);
        }).catch(() => {});
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
        localStorage.removeItem(cleOutboxDiscussion);
        setMessagesEnAttente([]);
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
      if (!reseauInternetDisponible()) { setSocketEtat("hors ligne"); retryTimer = window.setTimeout(connecter, 5000); return; }
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
            localStorage.removeItem(cleOutboxDiscussion);
            setMessagesEnAttente([]);
            setDiscussion(null); setMembres([]); setMessages([]);
            messagesActuels.current = [];
            setSocketEtat("ferme");
            setMessageErreur("Ton accès à cette discussion n'est plus actif.");
            window.setTimeout(() => { if (actif) onQuitter?.(); }, 800);
            return;
          }
          if (!reseauInternetDisponible()) { setSocketEtat("hors ligne"); retryTimer = window.setTimeout(connecter, 5000); }
          else { setSocketEtat("reconnexion"); retryTimer = window.setTimeout(connecter, 2500); }
        };
      } catch {
        setSocketEtat(!reseauInternetDisponible() ? "hors ligne" : "reconnexion");
        retryTimer = window.setTimeout(connecter, !reseauInternetDisponible() ? 5000 : 3500);
      }
    };
    const repriseReseau = () => {
      clearTimeout(retryTimer);
      charger().catch(error => {
        if ([401, 403, 404].includes(error.status)) {
          localStorage.removeItem(cacheDiscussionKey);
          localStorage.removeItem(cleOutboxDiscussion);
          setMessagesEnAttente([]);
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
      if (!actif || !reseauInternetDisponible()) return;
      const dernierId = messagesActuels.current.filter(message => Number(message.id) > 0).at(-1)?.id || 0;
      try {
        const [data, mentions] = await Promise.all([
          listerMessagesDiscussion(sessionToken, classe.classe_id, null, dernierId),
          listerMentionsDiscussion(sessionToken, classe.classe_id),
        ]);
        if (!actif) return;
        setMentionsNonLues((mentions.mentions || []).length);
        if (!data.messages?.length) return;
        setMessages(prev => {
          let next = prev;
          data.messages.forEach(message => { next = fusionnerMessageDiscussion(next, message); });
          messagesActuels.current = next;
          return next;
        });
        const envoyes = new Set(data.messages.map(message => message.client_message_id).filter(Boolean));
        if (envoyes.size) setMessagesEnAttente(prev => prev.filter(item => !envoyes.has(item.client_message_id)));
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
  }, [messages]);

  function enregistrerMediaLocal(messageId, resultat) {
    if (!resultat?.path) return;
    const precedent = mediasLocauxRef.current[messageId] || {};
    const entree = { ...precedent, path: resultat.path, fileName: resultat.fileName, mimeType: resultat.mimeType, size: resultat.size };
    mediasLocauxRef.current = { ...mediasLocauxRef.current, [messageId]: entree };
    if (composantActifRef.current) setMediasLocaux(prev => ({ ...prev, [messageId]: { ...prev[messageId], ...entree } }));
  }

  function enregistrerVideoCacheSansInterrompre(messageId, resultat) {
    const video = scrollRef.current?.querySelector(`video.discussion-video[data-message-id="${Number(messageId)}"]`);
    if (!video || video.paused || video.ended) {
      enregistrerMediaLocal(messageId, resultat);
      return;
    }
    // Ne remplace pas le src d'une vidéo en cours de lecture : on conserve
    // le flux jusqu'à sa pause/fin, puis les prochaines lectures utiliseront le cache.
    const appliquer = () => {
      video.removeEventListener("ended", appliquer);
      // Ne remplace jamais la source au simple événement pause : cela remettrait
      // le curseur de lecture à zéro. Le cache prendra le relais à la fin du clip.
      enregistrerMediaLocal(messageId, resultat);
    };
    video.addEventListener("ended", appliquer, { once: true });
  }

  function enregistrerPosterLocal(messageId, resultat) {
    if (!resultat?.path) return;
    const precedent = mediasLocauxRef.current[messageId] || {};
    const entree = { ...precedent, posterPath: resultat.path };
    mediasLocauxRef.current = { ...mediasLocauxRef.current, [messageId]: entree };
    if (composantActifRef.current) setMediasLocaux(prev => ({ ...prev, [messageId]: { ...prev[messageId], ...entree } }));
  }

  function definirProgressionMedia(messageId, valeur) {
    if (!composantActifRef.current) return;
    setProgressionsMedia(prev => ({ ...prev, [messageId]: valeur }));
  }

  function sourcePieceMessage(message) {
    if (message?.preview_url) return message.preview_url;
    const locale = mediasLocaux[message.id] || mediasLocauxRef.current[message.id];
    if (locale?.path) return sourceLocaleMedia(locale.path);
    return reseauInternetDisponible() ? ticketsMedia[message.id]?.url || null : null;
  }

  function sourcePosterMessage(message) {
    const locale = mediasLocaux[message.id] || mediasLocauxRef.current[message.id];
    if (locale?.posterPath) return sourceLocaleMedia(locale.posterPath);
    const ticket = ticketsMedia[message.id];
    if (!reseauInternetDisponible()) return null;
    return ticket?.poster_url || (ticket?.url ? `${ticket.url}${ticket.url.includes("?") ? "&" : "?"}poster=1` : null);
  }

  async function assurerPosterTemporaire(message) {
    if (!stockageAndroidDisponible() || !message?.piece || message.piece.type !== "video") return null;
    const messageId = Number(message.id);
    const deja = mediasLocauxRef.current[messageId]?.posterPath;
    if (deja) return { path: deja };
    const fileName = nomPosterTemporaire(monUsername, classe.classe_id, message);
    try {
      const cache = await chercherMediaTemporaire(fileName, "image/jpeg");
      if (cache?.path) { enregistrerPosterLocal(messageId, cache); return cache; }
      if (!reseauInternetDisponible()) return null;
      const resultat = await mettreEnCacheMedia({
        url: ticketsMedia[messageId]?.poster_url || await obtenirUrlPiece(message).then(url => `${url}${url.includes("?") ? "&" : "?"}poster=1`),
        fileName,
        mimeType: "image/jpeg",
        requestId: `poster-cache-${classe.classe_id}-${messageId}`,
        maxBytes: 2 * 1024 * 1024,
      });
      enregistrerPosterLocal(messageId, resultat);
      return resultat;
    } catch (error) {
      console.debug("Miniature vidéo GRIND non mise en cache", messageId, error?.message || "");
      return null;
    }
  }

  async function assurerCacheTemporaire(message) {
    if (!stockageAndroidDisponible() || !message?.piece) return null;
    const typePiece = message.piece.type;
    const tailleOctets = Number(message.piece.taille || 0);
    const tailleVideoMin = 1024;
    const tailleVideoMax = 10 * 1024 * 1024;
    if (typePiece === "video" && (tailleOctets < tailleVideoMin || tailleOctets > tailleVideoMax)) return null;
    if (!["image", "document", "audio", "video"].includes(typePiece)) return null;
    const messageId = Number(message.id);
    const deja = mediasLocauxRef.current[messageId];
    if (deja?.path) return deja;
    if (promessesCacheMediaRef.current.has(messageId)) return promessesCacheMediaRef.current.get(messageId);

    const promesse = (async () => {
      const fileName = nomFichierTemporaire(monUsername, classe.classe_id, message);
      const mimeType = mimePiece(message);
      try {
        const cache = await chercherMediaTemporaire(fileName, mimeType);
        if (cache?.path) {
          if (typePiece === "video") {
            enregistrerVideoCacheSansInterrompre(messageId, cache);
            await assurerPosterTemporaire(message);
          } else {
            enregistrerMediaLocal(messageId, cache);
          }
          return cache;
        }
        if (!reseauInternetDisponible()) return null;
        if (typePiece === "video") await assurerPosterTemporaire(message);
        const requestId = `cache-${classe.classe_id}-${messageId}`;
        requetesMediaRef.current.set(requestId, messageId);
        definirProgressionMedia(messageId, -1);
        const maxBytes = typePiece === "audio" ? 8 * 1024 * 1024
          : typePiece === "document" ? 15 * 1024 * 1024
            : typePiece === "video" ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
        const resultat = await mettreEnCacheMedia({
          url: await obtenirUrlPiece(message),
          fileName, mimeType, requestId, maxBytes,
        });
        if (typePiece === "video") enregistrerVideoCacheSansInterrompre(messageId, resultat);
        else enregistrerMediaLocal(messageId, resultat);
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
          else if (reseauInternetDisponible()) {
            saved = await enregistrerMediaAndroid({
              url: await obtenirUrlPiece(message, true),
              fileName: savedName, mimeType, requestId, maxBytes: 15 * 1024 * 1024,
            });
          } else {
            throw new Error("Ce document n'est pas disponible hors ligne.");
          }
        }
        enregistrerMediaLocal(messageId, saved);
        await ouvrirFichierAndroid(saved.path, mimeType);
      } else {
        if (!reseauInternetDisponible()) throw new Error("Ce document n'est pas disponible hors ligne.");
        await telechargerDansNavigateur(await obtenirUrlPiece(message, true), message.piece.nom || savedName,
          pct => definirProgressionMedia(messageId, pct), { size: Number(message.piece.taille || 0), maxBlobBytes: 32 * 1024 * 1024 });
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
        const cacheEnCours = promessesCacheMediaRef.current.get(messageId);
        if (cacheEnCours) await cacheEnCours;
        let saved = await chercherMediaEnregistre(savedName, mimeType);
        if (!saved?.path) {
          const cache = await chercherMediaTemporaire(nomFichierTemporaire(monUsername, classe.classe_id, message), mimeType);
          if (cache?.path) {
            saved = await enregistrerMediaCacheAndroid(cache.fileName || nomFichierTemporaire(monUsername, classe.classe_id, message), savedName, mimeType);
          } else if (reseauInternetDisponible()) {
            saved = await enregistrerMediaAndroid({
              url: await obtenirUrlPiece(message, true),
              fileName: savedName, mimeType, requestId, maxBytes: 300 * 1024 * 1024,
            });
          } else {
            throw new Error("Cette vidéo n'a pas encore été mise en cache sur cet appareil.");
          }
        }
        enregistrerMediaLocal(messageId, saved);
        await ouvrirFichierAndroid(saved.path, mimeType);
      } else {
        if (!reseauInternetDisponible()) throw new Error("Cette vidéo n'est pas disponible hors ligne.");
        await telechargerDansNavigateur(await obtenirUrlPiece(message, true), message.piece.nom || savedName,
          pct => definirProgressionMedia(messageId, pct), { size: Number(message.piece.taille || 0), maxBlobBytes: 32 * 1024 * 1024 });
      }
    } catch (error) {
      setMessageErreur(error.message || "La vidéo n'a pas pu être téléchargée.");
    } finally {
      requetesMediaRef.current.delete(requestId);
      if (composantActifRef.current) window.setTimeout(() => setProgressionsMedia(prev => { const next = { ...prev }; delete next[messageId]; return next; }), 900);
    }
  }

  useEffect(() => {
    if (!stockageAndroidDisponible() || !messages.length || typeof IntersectionObserver === "undefined") return undefined;
    const root = scrollRef.current;
    if (!root) return undefined;
    let actif = true;
    const parId = new Map(messages.map(message => [Number(message.id), message]));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const ligne = entry.target;
        const id = Number(ligne.dataset.messageId);
        const message = parId.get(id);
        if (!entry.isIntersecting || !message?.piece || message.supprime_pour_tous) {
          if (!entry.isIntersecting) {
            const video = ligne.querySelector("video.discussion-video");
            if (video && !video.paused) video.pause();
          }
          continue;
        }
        // Images, vocaux et vidéos légères seulement ; les documents ne se
        // téléchargent jamais en tâche de fond sans demande explicite.
        const type = message.piece.type;
        const taille = Number(message.piece.taille || 0);
        const admissible = type === "image" || type === "audio" || (type === "video" && taille >= 1024 && taille <= 10 * 1024 * 1024);
        if (admissible) assurerCacheTemporaire(message).catch(() => {});
      }
    }, { root, rootMargin: "240px 0px", threshold: 0.01 });
    root.querySelectorAll("article[data-has-media='true'][data-message-id]").forEach(el => observer.observe(el));
    return () => { actif = false; observer.disconnect(); };
  }, [messages, mediasLocaux, classe.classe_id, sessionToken]);

  // Les accusés de lecture ne partent que lorsque le message est réellement visible.
  // Le curseur est monotone et synchronisé avec un léger délai pour éviter un POST par ligne.
  useEffect(() => {
    if (!discussion?.id || typeof IntersectionObserver === "undefined") return undefined;
    const root = scrollRef.current;
    if (!root) return undefined;

    dernierMessageLuRef.current = 0;
    lectureEnAttenteRef.current = 0;
    let actif = true;
    let observer = null;

    const synchroniserLecture = async () => {
      const cible = Number(lectureEnAttenteRef.current || 0);
      if (!actif || lectureEnCoursRef.current || cible <= dernierMessageLuRef.current
          || !reseauInternetDisponible() || document.visibilityState !== "visible") return;
      lectureEnCoursRef.current = true;
      let confirme = false;
      try {
        const resultat = await marquerMessagesDiscussionLus(sessionToken, classe.classe_id, cible);
        if (actif) {
          const idConfirme = Number(resultat?.dernier_message_lu_id || cible);
          dernierMessageLuRef.current = Math.max(dernierMessageLuRef.current, idConfirme);
          lectureEnAttenteRef.current = Math.max(lectureEnAttenteRef.current, dernierMessageLuRef.current);
          confirme = true;
        }
      } catch {
        // La reconnexion ou le prochain passage visible permettra un nouvel essai.
      } finally {
        lectureEnCoursRef.current = false;
        if (actif && confirme && lectureEnAttenteRef.current > dernierMessageLuRef.current) {
          window.clearTimeout(lectureTimerRef.current);
          lectureTimerRef.current = window.setTimeout(synchroniserLecture, 250);
        } else if (!confirme) {
          lectureEnAttenteRef.current = dernierMessageLuRef.current;
        }
      }
    };

    const programmerLecture = messageId => {
      const id = Number(messageId || 0);
      if (!id || id <= dernierMessageLuRef.current) return;
      lectureEnAttenteRef.current = Math.max(lectureEnAttenteRef.current, id);
      window.clearTimeout(lectureTimerRef.current);
      lectureTimerRef.current = window.setTimeout(synchroniserLecture, 450);
    };

    observer = new IntersectionObserver(entries => {
      if (!actif || document.visibilityState !== "visible" || !reseauInternetDisponible()) return;
      let dernierVisible = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.35) continue;
        dernierVisible = Math.max(dernierVisible, Number(entry.target.dataset.messageId || 0));
      }
      if (dernierVisible > 0) programmerLecture(dernierVisible);
    }, { root, threshold: [0.35] });

    const observerMessages = () => {
      root.querySelectorAll("article[data-message-id]").forEach(element => observer.observe(element));
    };
    observerMessages();

    const mutations = typeof MutationObserver !== "undefined"
      ? new MutationObserver(observerMessages) : null;
    mutations?.observe(root, { childList: true, subtree: true });

    const reobserverMessagesVisibles = () => {
      if (!actif || document.visibilityState !== "visible" || !reseauInternetDisponible()) return;
      observer.disconnect();
      observerMessages();
    };
    window.addEventListener("online", reobserverMessagesVisibles);
    window.addEventListener("grind-api-status", reobserverMessagesVisibles);
    document.addEventListener("visibilitychange", reobserverMessagesVisibles);

    return () => {
      actif = false;
      window.clearTimeout(lectureTimerRef.current);
      observer.disconnect();
      mutations?.disconnect();
      window.removeEventListener("online", reobserverMessagesVisibles);
      window.removeEventListener("grind-api-status", reobserverMessagesVisibles);
      document.removeEventListener("visibilitychange", reobserverMessagesVisibles);
    };
  }, [discussion?.id, sessionToken, classe.classe_id]);

  useEffect(() => {
    if (!stockageAndroidDisponible() || !messages.length) return undefined;
    let actif = true;
    const videos = messages.filter(message => message?.piece && !message.supprime_pour_tous);
    let prochain = 0;
    const worker = async () => {
      while (actif && prochain < videos.length) {
        const message = videos[prochain++];
        const key = Number(message.id);
        if (mediasLocauxRef.current[key]?.path) continue;
        try {
          const mimeType = mimePiece(message);
          let local = await chercherMediaEnregistre(nomFichierEnregistre(monUsername, classe.classe_id, message), mimeType);
          if (!local?.path) local = await chercherMediaTemporaire(nomFichierTemporaire(monUsername, classe.classe_id, message), mimeType);
          if (!actif) return;
          if (local?.path) enregistrerMediaLocal(key, local);
          if (message.piece.type === "video") {
            const posterLocal = await chercherMediaTemporaire(nomPosterTemporaire(monUsername, classe.classe_id, message), "image/jpeg");
            if (actif && posterLocal?.path) enregistrerPosterLocal(key, posterLocal);
          }
        } catch { /* recherche locale silencieuse, aucun téléchargement ici */ }
      }
    };
    Promise.all([worker(), worker()]).catch(() => {});
    return () => { actif = false; };
  }, [messages, classe.classe_id, monUsername]);


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
            const next = ordonnerMessagesDiscussion([...map.values()]);
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
    if (!reseauInternetDisponible()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Les anciens messages non enregistrés sur cet appareil nécessitent Internet." }));
      return;
    }
    const premierMessageConfirme = messages.find(message => Number(message.id) > 0);
    if (!premierMessageConfirme || chargementAnciens) return;
    setChargementAnciens(true);
    const scroll = scrollRef.current;
    const avant = scroll?.scrollHeight || 0;
    try {
      const data = await listerMessagesDiscussion(sessionToken, classe.classe_id, premierMessageConfirme.id);
      setMessages(prev => ordonnerMessagesDiscussion([
        ...(data.messages || []).filter(message => !prev.some(existing => existing.id === message.id)),
        ...prev,
      ]));
      setPlusAnciens(data.has_more);
      requestAnimationFrame(() => { if (scroll) scroll.scrollTop += scroll.scrollHeight - avant; });
    } catch (error) { setMessageErreur(error.message); }
    finally { setChargementAnciens(false); }
  }

  async function envoyer() {
    if (envoi || (!texte.trim() && !fichier)) return;

    // Les messages texte simples sont affichés immédiatement, puis envoyés en
    // arrière-plan par la file idempotente. Le champ reste libre pour la suite.
    if (texte.trim() && !fichier && !pendingMessagePieceRef.current && !messageEnEdition) {
      const contenu = texte.trim();
      const replyToId = reponse?.id || null;
      const payloadIdempotence = JSON.stringify({ contenu, reply_to_id: replyToId, style_texte: "normal", piece_url: null });
      if (!pendingMessageIdRef.current || pendingMessagePayloadRef.current !== payloadIdempotence) {
        pendingMessageIdRef.current = nouveauClientMessageId();
        pendingMessagePayloadRef.current = payloadIdempotence;
      }
      const clientMessageId = pendingMessageIdRef.current;
      if (messagesEnAttente.length >= 20 && !messagesEnAttente.some(item => item.client_message_id === clientMessageId)) {
        setMessageErreur("La file d'envoi contient déjà 20 messages. Attends la synchronisation avant d'en ajouter d'autres.");
        return;
      }
      const createdAt = new Date().toISOString();
      const nouvelElement = {
        client_message_id: clientMessageId, contenu, reply_to_id: replyToId, style_texte: "normal",
        piece: null, created_at: createdAt, failed: false,
      };
      const membreAuteur = membres.find(membre => membre.username === monUsername);
      const reponseCible = replyToId ? messages.find(message => Number(message.id) === Number(replyToId)) : null;
      const sequence = prochaineIdOptimisteRef.current++ % 1000;
      const messageOptimiste = {
        id: -(Date.now() * 1000 + sequence),
        client_message_id: clientMessageId,
        auteur: monUsername,
        auteur_nom: membreAuteur?.nom || monUsername,
        contenu,
        piece: null,
        reply_to_id: replyToId,
        reply: reponseCible ? {
          id: reponseCible.id, auteur: reponseCible.auteur,
          auteur_nom: reponseCible.auteur_nom || reponseCible.auteur, contenu: reponseCible.contenu || "",
        } : null,
        style_texte: "normal", created_at: createdAt, optimistic: true,
        supprime_pour_tous: false, lu_par_au_moins_un: false,
      };
      messageOptimiste.media_envoi = true;
      setMessages(prev => fusionnerMessageDiscussion(prev, messageOptimiste));
      pendingMessageIdRef.current = null;
      pendingMessagePayloadRef.current = null;
      setTexte("");
      setReponse(null);
      setMessageErreur("");
      setMenuPiecesOuvert(false);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", typing: false }));

      if (!reseauInternetDisponible()) {
        persisterMessageDansOutbox(classe.classe_id, monUsername, nouvelElement);
        setMessagesEnAttente(prev => [...prev.filter(item => item.client_message_id !== clientMessageId), nouvelElement].slice(0, 20));
      } else {
        const cleOrdre = `${classe.classe_id}:${monUsername}`;
        publierDiscussionDansOrdre(cleOrdre, async () => {
          // Si un message antérieur a échoué temporairement, les suivants
          // rejoignent la même outbox au lieu de dépasser son ordre SQL.
          const attenteAnterieure = lireFileAttenteDiscussion(classe.classe_id, monUsername);
          if (attenteAnterieure.length) {
            persisterMessageDansOutbox(classe.classe_id, monUsername, nouvelElement);
            if (composantActifRef.current) {
              setMessagesEnAttente(prev => [...prev.filter(item => item.client_message_id !== clientMessageId), nouvelElement].slice(0, 20));
            }
            return;
          }
          try {
            const resultat = await envoyerMessageDiscussionAvecReprise(sessionToken, classe.classe_id, {
              contenu, reply_to_id: replyToId, style_texte: "normal", piece: null,
              client_message_id: clientMessageId,
            });
            if (composantActifRef.current) {
              setMessages(prev => fusionnerMessageDiscussion(prev, resultat.message));
            }
          } catch (erreur) {
            const statut = Number(erreur?.status || 0);
            const temporaire = !statut || [408, 425, 429, 500, 502, 503, 504].includes(statut);
            if (temporaire) {
              persisterMessageDansOutbox(classe.classe_id, monUsername, nouvelElement);
              if (composantActifRef.current) {
                setMessagesEnAttente(prev => [...prev.filter(item => item.client_message_id !== clientMessageId), nouvelElement].slice(0, 20));
              }
            } else if (composantActifRef.current) {
              setMessages(prev => prev.map(message => message.client_message_id === clientMessageId
                ? { ...message, media_envoi: false, send_error: erreur.message || "Envoi refusé" } : message));
              setMessageErreur(erreur.message || "Le serveur a refusé le message.");
            }
          }
        });
      }
      return;
    }

    // Les pièces apparaissent immédiatement dans le fil. Le transfert réseau
    // démarre ensuite sans bloquer le compositeur ni les messages suivants.
    if (fichier && !messageEnEdition) {
      if (!reseauInternetDisponible()) {
        window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour envoyer ce fichier. Il reste sélectionné." }));
        return;
      }
      const fichierLocal = fichier;
      const contenuLocal = texte.trim();
      const replyToId = reponse?.id || null;
      const ext = String(fichierLocal.name || "").split(".").pop().toLowerCase();
      const mimeFichier = String(fichierLocal.type || "").split(";", 1)[0].trim().toLowerCase();
      const estDocument = ["pdf", "docx"].includes(ext)
        || mimeFichier === "application/pdf"
        || mimeFichier === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const estVideo = mimeFichier.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext);
      const typePiece = estDocument ? "document" : estVideo ? "video" : "image";
      const clientMessageId = nouveauClientMessageId();
      const previewUrl = typePiece === "image" || typePiece === "video" ? URL.createObjectURL(fichierLocal) : null;
      if (previewUrl) apercusMediaRef.current.set(clientMessageId, previewUrl);
      const sequence = prochaineIdOptimisteRef.current++ % 1000;
      const membreAuteur = membres.find(membre => membre.username === monUsername);
      const reponseCible = replyToId ? messages.find(message => Number(message.id) === Number(replyToId)) : null;
      const messageOptimiste = {
        id: -(Date.now() * 1000 + sequence), client_message_id: clientMessageId,
        auteur: monUsername, auteur_nom: membreAuteur?.nom || monUsername,
        contenu: contenuLocal, piece: { type: typePiece, nom: fichierLocal.name, mime: fichierLocal.type, taille: fichierLocal.size },
        preview_url: previewUrl, media_envoi: true, reply_to_id: replyToId,
        reply: reponseCible ? { id: reponseCible.id, auteur: reponseCible.auteur,
          auteur_nom: reponseCible.auteur_nom || reponseCible.auteur, contenu: reponseCible.contenu || "" } : null,
        style_texte: "normal", created_at: new Date().toISOString(), optimistic: true,
        supprime_pour_tous: false, lu_par_au_moins_un: false,
      };
      setMessages(prev => fusionnerMessageDiscussion(prev, messageOptimiste));
      setTexte(""); setFichier(null); setReponse(null); setMessageErreur("");
      setMenuPiecesOuvert(false);
      [imagePieceRef, videoPieceRef, documentPieceRef].forEach(ref => { if (ref.current) ref.current.value = ""; });
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      void (async () => {
        let piece = null;
        try {
          if (estDocument) {
            const doc = await avecSlotUploadDiscussion(() => uploaderDocumentPriveDiscussion(sessionToken, fichierLocal, valeur => {
              if (composantActifRef.current) setProgressionsMedia(prev => ({ ...prev, [messageOptimiste.id]: valeur }));
            }));
            if (composantActifRef.current) setProgressionsMedia(prev => { const next = { ...prev }; delete next[messageOptimiste.id]; return next; });
            piece = { url: doc.document_url, type: "document", nom: doc.document_name || fichierLocal.name,
              mime: doc.document_type || fichierLocal.type, taille: fichierLocal.size };
          } else {
            const decoupe = estVideo ? await extraireDureeVideo(fichierLocal) : null;
            const media = await avecSlotUploadDiscussion(() => uploaderMediaPriveDiscussion(
              sessionToken, fichierLocal, decoupe, valeur => {
                if (composantActifRef.current) setProgressionsMedia(prev => ({ ...prev, [messageOptimiste.id]: valeur }));
              }
            ));
            if (composantActifRef.current) setProgressionsMedia(prev => { const next = { ...prev }; delete next[messageOptimiste.id]; return next; });
            piece = { url: media.media_url, type: media.media_type || typePiece,
              nom: fichierLocal.name, mime: fichierLocal.type, taille: fichierLocal.size };
          }
          const resultat = await envoyerMessageDiscussionAvecReprise(sessionToken, classe.classe_id, {
            contenu: contenuLocal, reply_to_id: replyToId, style_texte: "normal", piece,
            client_message_id: clientMessageId,
          });
          if (composantActifRef.current) setMessages(prev => fusionnerMessageDiscussion(prev, resultat.message));
        } catch (error) {
          if (composantActifRef.current) setProgressionsMedia(prev => { const next = { ...prev }; delete next[messageOptimiste.id]; return next; });
          const statut = Number(error?.status || 0);
          const temporaire = !statut || [408, 425, 429, 500, 502, 503, 504].includes(statut);
          if (piece && temporaire) {
            const element = { client_message_id: clientMessageId, contenu: contenuLocal,
              reply_to_id: replyToId, style_texte: "normal", piece,
              created_at: messageOptimiste.created_at, failed: false };
            persisterMessageDansOutbox(classe.classe_id, monUsername, element);
            if (composantActifRef.current) {
              setMessagesEnAttente(prev => [...prev.filter(item => item.client_message_id !== clientMessageId), element].slice(0, 20));
              setMessages(prev => prev.map(message => message.client_message_id === clientMessageId
                ? { ...message, media_envoi: false } : message));
            }
          } else {
            const apercu = apercusMediaRef.current.get(clientMessageId);
            if (apercu) { URL.revokeObjectURL(apercu); apercusMediaRef.current.delete(clientMessageId); }
            if (composantActifRef.current) {
              setMessages(prev => prev.filter(message => message.client_message_id !== clientMessageId));
              if (piece) {
                // Le fichier est déjà stocké : conserver sa référence pour ne pas le renvoyer.
                pendingMessagePieceRef.current = piece;
                setFichier(null);
              } else {
                setFichier(fichierLocal);
              }
              setTexte(contenuLocal);
              setMessageErreur(error.message || "Le fichier n'a pas pu être publié. Tu peux réessayer.");
            }
          }
        }
      })();
      return;
    }

    if (!reseauInternetDisponible()) {
      const pieceDejaChargee = pendingMessagePieceRef.current;
      if (fichier && !pieceDejaChargee) {
        window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Le fichier sera envoyé dès le retour de la connexion. Garde-le sélectionné." }));
        return;
      }
      if (messageEnEdition) {
        window.dispatchEvent(new CustomEvent("grind-toast", { detail: "La modification sera possible dès le retour de la connexion." }));
        return;
      }
      if (!texte.trim() && !pieceDejaChargee) return;
      const payloadIdempotence = JSON.stringify({ contenu: texte.trim(), reply_to_id: reponse?.id || null,
        style_texte: "normal", piece_url: pieceDejaChargee?.url || null });
      if (!pendingMessageIdRef.current || pendingMessagePayloadRef.current !== payloadIdempotence) {
        pendingMessageIdRef.current = nouveauClientMessageId();
        pendingMessagePayloadRef.current = payloadIdempotence;
      }
      if (messagesEnAttente.length >= 20 && !messagesEnAttente.some(item => item.client_message_id === pendingMessageIdRef.current)) {
        setMessageErreur("La file hors ligne contient déjà 20 messages. Rétablis la connexion avant d'en ajouter d'autres.");
        return;
      }
      const element = {
        client_message_id: pendingMessageIdRef.current,
        contenu: texte.trim(), reply_to_id: reponse?.id || null,
        style_texte: "normal", piece: pieceDejaChargee || null,
        created_at: new Date().toISOString(), failed: false,
      };
      setMessagesEnAttente(prev => [...prev.filter(item => item.client_message_id !== element.client_message_id), element].slice(0, 20));
      pendingMessageIdRef.current = null;
      pendingMessagePayloadRef.current = null;
      pendingMessagePieceRef.current = null;
      setTexte(""); setFichier(null); setReponse(null);
      [imagePieceRef, videoPieceRef, documentPieceRef].forEach(ref => { if (ref.current) ref.current.value = ""; });
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Message enregistré sur cet appareil. Il sera envoyé automatiquement à la reconnexion." }));
      return;
    }
    setEnvoi(true); setProgression(0); setMessageErreur("");
    try {
      let piece = pendingMessagePieceRef.current;
      if (fichier && !piece) {
        const ext = String(fichier.name || "").split(".").pop().toLowerCase();
        const mimeFichier = String(fichier.type || "").split(";", 1)[0].trim().toLowerCase();
        if (["pdf", "docx"].includes(ext) || mimeFichier === "application/pdf"
            || mimeFichier === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          const doc = await avecSlotUploadDiscussion(() => uploaderDocumentPriveDiscussion(sessionToken, fichier, setProgression));
          piece = { url: doc.document_url, type: "document", nom: doc.document_name || fichier.name, mime: doc.document_type || fichier.type, taille: fichier.size };
        } else {
          const estVideo = fichier.type.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext);
          const decoupe = estVideo ? await extraireDureeVideo(fichier) : null;
          const media = await avecSlotUploadDiscussion(() => uploaderMediaPriveDiscussion(
            sessionToken, fichier, decoupe, setProgression
          ));
          piece = { url: media.media_url, type: media.media_type || (estVideo ? "video" : "image"), nom: fichier.name, mime: fichier.type, taille: fichier.size };
        }
        pendingMessagePieceRef.current = piece;
      }
      if (messageEnEdition && !piece) {
        const res = await modifierMessageDiscussion(sessionToken, classe.classe_id, messageEnEdition, texte.trim());
        setMessages(prev => prev.map(m => m.id === messageEnEdition ? res.message : m));
        setMessageEnEdition(null);
      } else {
        const payloadIdempotence = JSON.stringify({
          contenu: texte.trim(), reply_to_id: reponse?.id || null,
          style_texte: "normal", piece_url: piece?.url || null,
        });
        if (!pendingMessageIdRef.current || pendingMessagePayloadRef.current !== payloadIdempotence) {
          pendingMessageIdRef.current = globalThis.crypto?.randomUUID?.() || `grind-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
          pendingMessagePayloadRef.current = payloadIdempotence;
        }
        const res = await envoyerMessageDiscussionAvecReprise(sessionToken, classe.classe_id, {
          contenu: texte.trim(), reply_to_id: reponse?.id || null, style_texte: "normal", piece,
          client_message_id: pendingMessageIdRef.current,
        });
        pendingMessageIdRef.current = null;
        pendingMessagePieceRef.current = null;
        pendingMessagePayloadRef.current = null;
        setMessages(prev => prev.some(m => m.id === res.message.id) ? prev : [...prev, res.message]);
      }
      setTexte(""); setFichier(null); setReponse(null);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      [imagePieceRef, videoPieceRef, documentPieceRef].forEach(ref => { if (ref.current) ref.current.value = ""; });
      setMenuPiecesOuvert(false);
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", typing: false }));
    } catch (error) {
      const statut = Number(error?.status || 0);
      const temporaire = !statut || [408, 425, 429, 500, 502, 503, 504].includes(statut);
      if (temporaire && !messageEnEdition && (!fichier || pendingMessagePieceRef.current)) {
        const pieceDejaChargee = pendingMessagePieceRef.current;
        const payloadIdempotence = JSON.stringify({ contenu: texte.trim(), reply_to_id: reponse?.id || null,
          style_texte: "normal", piece_url: pieceDejaChargee?.url || null });
        if (!pendingMessageIdRef.current || pendingMessagePayloadRef.current !== payloadIdempotence) {
          pendingMessageIdRef.current = nouveauClientMessageId();
          pendingMessagePayloadRef.current = payloadIdempotence;
        }
        const element = { client_message_id: pendingMessageIdRef.current, contenu: texte.trim(),
          reply_to_id: reponse?.id || null, style_texte: "normal", piece: pieceDejaChargee || null,
          created_at: new Date().toISOString(), failed: false };
        if (messagesEnAttente.length >= 20 && !messagesEnAttente.some(item => item.client_message_id === element.client_message_id)) {
          setMessageErreur("La file hors ligne est pleine. Ton texte reste dans le champ ; réessaie après la reconnexion.");
          return;
        }
        setMessagesEnAttente(prev => [...prev.filter(item => item.client_message_id !== element.client_message_id), element]);
        pendingMessageIdRef.current = null; pendingMessagePayloadRef.current = null; pendingMessagePieceRef.current = null;
        setTexte(""); setFichier(null); setReponse(null);
        [imagePieceRef, videoPieceRef, documentPieceRef].forEach(ref => { if (ref.current) ref.current.value = ""; });
        setMessageErreur("Connexion interrompue : le message a été conservé sur cet appareil et sera renvoyé sans doublon.");
      } else {
        setMessageErreur(error.message || "Échec de l'envoi du message.");
      }
    }
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

  async function publierVocal(fichierVocal, dureeEnregistree = 0) {
    if (!reseauInternetDisponible()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour envoyer un vocal." }));
      return;
    }
    if (messagesEnAttente.length >= 20 && !pendingVocalIdRef.current) {
      setMessageErreur("La file d'envoi contient déjà 20 messages. Attends la synchronisation avant d'enregistrer un nouveau vocal.");
      return;
    }
    if (vocalPublicationEnCoursRef.current) return;
    vocalPublicationEnCoursRef.current = true;
    const clientMessageId = pendingVocalIdRef.current || nouveauClientMessageId();
    pendingVocalIdRef.current = clientMessageId;
    const previewUrl = URL.createObjectURL(fichierVocal);
    apercusMediaRef.current.set(clientMessageId, previewUrl);
    const replyToId = reponse?.id || null;
    const sequence = prochaineIdOptimisteRef.current++ % 1000;
    const membreAuteur = membres.find(membre => membre.username === monUsername);
    const createdAt = new Date().toISOString();
    const vocalOptimiste = {
      id: -(Date.now() * 1000 + sequence), client_message_id: clientMessageId,
      auteur: monUsername, auteur_nom: membreAuteur?.nom || monUsername, contenu: "",
      piece: { type: "audio", nom: fichierVocal.name || "Message vocal", mime: fichierVocal.type || "audio/webm",
        taille: fichierVocal.size || 0, duree: Math.max(0, Number(dureeEnregistree) || 0) },
      preview_url: previewUrl, media_envoi: true, reply_to_id: replyToId,
      style_texte: "normal", created_at: createdAt, optimistic: true,
      supprime_pour_tous: false, lu_par_au_moins_un: false,
    };
    setMessages(prev => fusionnerMessageDiscussion(prev, vocalOptimiste));
    setReponse(null);
    setProgression(0);
    setMessageErreur("");
    try {
      let piece = pendingVocalPieceRef.current;
      if (!piece) {
        piece = await avecSlotUploadDiscussion(() => uploaderVocalDiscussionMedia(
          sessionToken, fichierVocal, valeur => { if (composantActifRef.current) setProgression(valeur); }
        ));
        piece = { ...piece, duree: Math.max(0, Number(dureeEnregistree) || 0) };
        pendingVocalPieceRef.current = piece;
      }
      const resultat = await envoyerMessageDiscussionAvecReprise(sessionToken, classe.classe_id, {
        contenu: "", reply_to_id: replyToId, style_texte: "normal", piece,
        client_message_id: clientMessageId,
      });
      pendingVocalIdRef.current = null;
      pendingVocalPieceRef.current = null;
      if (composantActifRef.current) setMessages(prev => fusionnerMessageDiscussion(prev, resultat.message));
    } catch (error) {
      const pieceDejaChargee = pendingVocalPieceRef.current;
      const statut = Number(error?.status || 0);
      const temporaire = !statut || [408, 425, 429, 500, 502, 503, 504].includes(statut);
      if (pieceDejaChargee && temporaire && messagesEnAttente.length < 20) {
        const element = {
          client_message_id: clientMessageId, contenu: "", reply_to_id: replyToId,
          style_texte: "normal", piece: pieceDejaChargee, created_at: createdAt, failed: false,
        };
        persisterMessageDansOutbox(classe.classe_id, monUsername, element);
        if (composantActifRef.current) {
          setMessagesEnAttente(prev => [...prev.filter(item => item.client_message_id !== clientMessageId), element].slice(0, 20));
          setMessages(prev => prev.map(message => message.client_message_id === clientMessageId
            ? { ...message, media_envoi: false } : message));
          setMessageErreur("Le vocal est stocké. Sa publication sera reprise automatiquement sans doublon.");
        }
      } else {
        const apercu = apercusMediaRef.current.get(clientMessageId);
        if (apercu) { URL.revokeObjectURL(apercu); apercusMediaRef.current.delete(clientMessageId); }
        if (composantActifRef.current) {
          setMessages(prev => prev.filter(message => message.client_message_id !== clientMessageId));
          setMessageErreur(error.message || "Impossible d'envoyer le message vocal. Réessaie.");
        }
        pendingVocalIdRef.current = null;
        pendingVocalPieceRef.current = null;
      }
    } finally {
      vocalPublicationEnCoursRef.current = false;
      if (composantActifRef.current) setProgression(0);
    }
  }

  async function demarrerVocal(event) {
    event.preventDefault();
    if (!reseauInternetDisponible()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour enregistrer et envoyer un vocal." })); return; }
    if (vocalPreparation || vocalEnCours || vocalPublicationEnCoursRef.current || envoi || texte.trim() || fichier) return;
    // Chaque nouvel enregistrement est un nouveau message ; seul le réessai
    // d'une requête précédente conserve sa clé d'idempotence.
    pendingVocalIdRef.current = null;
    pendingVocalPieceRef.current = null;
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
          await publierVocal(fichierVocal, duree);
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
        setMessages(prev => ordonnerMessagesDiscussion([
          ...(anciens.messages || []).filter(message => !prev.some(existing => existing.id === message.id)),
          ...prev,
        ]));
        cible = (anciens.messages || []).find(m => m.id === mention.message_id);
      }
      await marquerMentionDiscussionLue(sessionToken, classe.classe_id, mention.id);
      setMentionsNonLues(count => Math.max(0, count - 1));
      window.setTimeout(() => messageRefs.current.get(mention.message_id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    } catch (error) { setMessageErreur(error.message); }
  }

  async function rejoindreVraieClasse() {
    if (!reseauInternetDisponible()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour rejoindre la classe réelle." })); return; }
    setActionEnCours("classe"); setMessageErreur("");
    try {
      await rejoindreVraieClasseDepuisDiscussion(sessionToken, classe.classe_id);
      setDiscussion(prev => ({ ...prev, est_membre_classe: true }));
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Tu as rejoint la classe réelle." }));
    } catch (error) { setMessageErreur(error.message); }
    finally { setActionEnCours(""); }
  }

  async function changerPhoto(event) {
    if (!reseauInternetDisponible()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour modifier la photo du groupe." })); return; }
    const image = event.target.files?.[0];
    if (!image) return;
    setProfilPhotoEnvoi(true); setMessageErreur("");
    try {
      const media = await avecSlotUploadDiscussion(() => uploaderMediaPriveDiscussion(sessionToken, image, null));
      const res = await modifierPhotoDiscussion(sessionToken, classe.classe_id, media.media_url);
      setDiscussion(prev => ({ ...prev, photo_url: res.photo_url }));
    } catch (error) { setMessageErreur(error.message); }
    finally { setProfilPhotoEnvoi(false); if (photoRef.current) photoRef.current.value = ""; }
  }

  async function acterMembre(action, membre) {
    if (!reseauInternetDisponible()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour gérer les membres." })); return; }
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
    if (!message || message.optimistic || Number(message.id) <= 0 || message.supprime_pour_tous || message.auteur !== monUsername || message.piece || !message.contenu) return false;
    const date = Date.parse(message.created_at || "");
    return Number.isFinite(date) && Date.now() - date >= 0 && Date.now() - date <= 15 * 60 * 1000;
  }

  function peutSupprimerMessagePourTous(message) {
    return !!message && !message.optimistic && Number(message.id) > 0
      && !message.supprime_pour_tous && (message.auteur === monUsername || estAdmin);
  }

  function basculerSelectionMessage(messageId) {
    setMessagesSelectionnes(prev => prev.includes(messageId) ? prev.filter(id => id !== messageId) : [...prev, messageId]);
    setMenuSelectionOuvert(false);
  }

  function commencerPressMessage(event, message) {
    if (message?.optimistic || Number(message?.id) <= 0) return;
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
    if (message?.optimistic || Number(message?.id) <= 0) return;
    if (!longPressDeclenche.current) finSwipe(event, message);
  }

  function annulerPressMessage() { clearTimeout(longPressTimer.current); }

  async function copierSelectionMessages() {
    const contenus = messages
      .filter(message => messagesSelectionnes.includes(message.id) && !message.supprime_pour_tous)
      .map(message => {
        const parties = [];
        const texte = String(message.contenu || "").trim();
        if (texte) parties.push(texte);
        if (message.piece) {
          const type = String(message.piece.type || "").toLowerCase();
          const libelles = {
            image: "Image partagée",
            video: "Vidéo partagée",
            audio: "Vocal partagé",
            document: "Document partagé",
          };
          const nom = String(message.piece.nom || libelles[type] || "Pièce jointe").trim();
          if (nom) parties.push(nom);
        }
        return parties.join("\n");
      })
      .filter(Boolean);
    if (!contenus.length) return;
    const texteCopie = contenus.join("\n\n");
    const copierViaWebView = () => {
      const champTemporaire = document.createElement("textarea");
      champTemporaire.value = texteCopie;
      champTemporaire.setAttribute("readonly", "");
      champTemporaire.style.position = "fixed";
      champTemporaire.style.opacity = "0";
      document.body.appendChild(champTemporaire);
      try {
        champTemporaire.select();
        return document.execCommand("copy");
      } finally {
        champTemporaire.remove();
      }
    };
    try {
      let copiee = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(texteCopie);
          copiee = true;
        } catch {
          // Secours pour les WebView Android qui refusent Clipboard API.
          copiee = copierViaWebView();
        }
      } else {
        copiee = copierViaWebView();
      }
      if (!copiee) throw new Error("Copie refusée par le navigateur.");
      setMessagesSelectionnes([]);
      setMenuSelectionOuvert(false);
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Texte copié." }));
    } catch {
      setMessageErreur("Impossible de copier le texte sur cet appareil.");
    }
  }

  function cliquerMessageEnModeSelection(event, message) {
    if (message?.optimistic || Number(message?.id) <= 0) return;
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
    if (!reseauInternetDisponible()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour supprimer ces messages de ton historique." })); return; }
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
    if (!reseauInternetDisponible()) {
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
        {messagesEnAttente.length > 0 && <section className="discussion-outbox" aria-label="Messages en attente de connexion">
          <div className="discussion-outbox-entete"><i className="fa-solid fa-cloud-arrow-up" /><strong>{messagesEnAttente.length} message{messagesEnAttente.length > 1 ? "s" : ""} en attente</strong><small>Envoi automatique à la reconnexion</small></div>
          {messagesEnAttente.map(element => <div className="discussion-outbox-item" key={element.client_message_id}>
            <span className="discussion-outbox-texte">{element.contenu || element.piece?.nom || "Pièce jointe"}</span>
            <span className={element.failed ? "discussion-outbox-erreur" : "discussion-outbox-etat"}>{element.failed ? (element.error || "Envoi refusé") : "En attente"}</span>
            {element.failed && <button type="button" onClick={() => retenterMessageEnAttente(element.client_message_id)}>Réessayer</button>}
            <button type="button" className="discussion-outbox-annuler" onClick={() => annulerMessageEnAttente(element.client_message_id)} aria-label="Retirer ce message en attente"><i className="fa-solid fa-xmark" /></button>
          </div>)}
        </section>}
        {messagesSelectionnes.length > 0 && <div className="discussion-selection-barre">
          <button type="button" onClick={() => { setMessagesSelectionnes([]); setMenuSelectionOuvert(false); }} aria-label="Annuler la sélection"><i className="fa-solid fa-xmark" /></button>
          <strong>{messagesSelectionnes.length} sélectionné{messagesSelectionnes.length > 1 ? "s" : ""}</strong>
          <button type="button" onClick={() => setMenuSelectionOuvert(v => !v)} aria-label="Actions des messages sélectionnés"><i className="fa-solid fa-ellipsis-vertical" /></button>
          {menuSelectionOuvert && <div className="discussion-selection-menu">
            {messagesSelectionnes.some(id => {
              const cible = messages.find(message => message.id === id);
              return cible && !cible.supprime_pour_tous
                && (!!String(cible.contenu || "").trim() || !!cible.piece);
            }) && <button type="button" onClick={copierSelectionMessages}><i className="fa-solid fa-copy" /> Copier</button>}
            {messagesSelectionnes.length === 1 && messageEditable(messages.find(m => m.id === messagesSelectionnes[0])) && <button type="button" onClick={modifierSelection}><i className="fa-solid fa-pen" /> Modifier</button>}
            {messagesSelectionnes.length === 1 && !messages.find(m => m.id === messagesSelectionnes[0])?.supprime_pour_tous && <button type="button" onClick={() => { const cible = messages.find(m => m.id === messagesSelectionnes[0]); if (cible) commencerReponse(cible); setMessagesSelectionnes([]); setMenuSelectionOuvert(false); }}><i className="fa-solid fa-reply" /> Répondre</button>}
            {messagesSelectionnes.length === 1 && peutSupprimerMessagePourTous(messages.find(m => m.id === messagesSelectionnes[0])) && <button type="button" className="danger" onClick={demanderSuppressionSelectionPourTous} disabled={suppressionEnCours}><i className="fa-solid fa-trash-can" /> Supprimer pour tout le monde</button>}
            <button type="button" className="danger" onClick={supprimerSelectionPourMoi} disabled={suppressionEnCours}><i className="fa-solid fa-trash" /> {suppressionEnCours ? "Suppression…" : "Supprimer pour moi"}</button>
          </div>}
        </div>}
        {plusAnciens && messages.some(message => Number(message.id) > 0) && <button className="discussion-plus-anciens" type="button" onClick={chargerPlusAnciens} disabled={chargementAnciens}>{chargementAnciens ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-clock-rotate-left" />} Charger les messages précédents</button>}
        {messages.length === 0 ? <div className="discussion-vide"><i className="fa-regular fa-comments" /><strong>La discussion commence ici</strong><span>Pose une question, partage un cours ou aide un camarade.</span></div> : messages.map(message => {
          const propre = message.auteur === monUsername;
          const mediaPriveUrl = message.piece ? sourcePieceMessage(message) : null;
          const progressionMedia = progressionsMedia[message.id];
          const telechargementActif = progressionMedia !== undefined;
          const elementEnAttente = message.client_message_id
            ? messagesEnAttente.find(item => item.client_message_id === message.client_message_id)
            : null;
          return (
            <article key={message.client_message_id || message.id} ref={node => { if (node) messageRefs.current.set(message.id, node); else messageRefs.current.delete(message.id); }}
              className={`discussion-ligne ${propre ? "moi" : "autre"} ${messagesSelectionnes.includes(message.id) ? "selectionnee" : ""}`} data-message-id={message.id} data-has-media={message.piece && !message.supprime_pour_tous ? "true" : "false"} onPointerDown={event => commencerPressMessage(event, message)} onPointerMove={deplacerPressMessage} onPointerUp={event => terminerPressMessage(event, message)} onPointerCancel={annulerPressMessage} onClick={event => cliquerMessageEnModeSelection(event, message)}>
              {!propre && <AvatarIcone username={message.auteur} taille={34} onClic={ouvrirProfil} />}
              <div className={`discussion-bulle-wrap ${message.piece?.type === "video" ? "discussion-bulle-wrap-video" : ""}`}>
                {!propre && <button type="button" className="discussion-auteur" onClick={() => ouvrirProfil(message.auteur)}>{message.auteur_nom} <small>@{message.auteur}</small></button>}
                {message.reply && <button type="button" className="discussion-reponse-citee" onClick={() => messageRefs.current.get(message.reply.id)?.scrollIntoView({ behavior: "smooth", block: "center" })}><strong>{message.reply.auteur_nom}</strong><span>{message.reply.contenu || "Message"}</span></button>}
                <div className={`discussion-bulle style-${message.style_texte || "normal"} ${message.piece?.type === "image" ? "discussion-bulle-avec-image" : ""} ${message.piece?.type === "video" ? "discussion-bulle-avec-video" : ""}`}>
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
                      poster={sourcePosterMessage(message)}
                      nom={message.piece.nom}
                      messageId={message.id}
                    />
                    <div className="discussion-media-actions">
                      <BoutonTelechargement progression={progressionMedia} enCours={telechargementActif} disabled={!!message.optimistic} onClick={() => telechargerVideoMessage(message)} label="Télécharger la vidéo" />
                      <small>{message.piece.nom || "Vidéo"}</small>
                    </div>
                  </>}
                  {message.piece && message.piece.type === "audio" && <LecteurVocal
                    src={mediaPriveUrl} id={message.id} dureeInitiale={message.piece.duree || 0}
                  />}
                  {message.piece && message.piece.type === "document" && <div className="discussion-fichier">
                    <span className="discussion-fichier-icone"><i className={`fa-solid ${extensionPiece(message) === "pdf" ? "fa-file-pdf" : "fa-file-word"}`} /></span>
                    <span className="discussion-fichier-details"><strong>{message.piece.nom}</strong><small>{tailleLisible(message.piece.taille)}{mediasLocaux[message.id] ? " · disponible hors ligne" : ""}</small></span>
                    <BoutonTelechargement progression={progressionMedia} enCours={telechargementActif} disabled={!!message.optimistic} onClick={() => ouvrirDocumentMessage(message)} label="Enregistrer et ouvrir le document" />
                  </div>}
                  </>}
                  <span className="discussion-heure">
                    {heure(message.created_at)}
                    {message.modifie && <small className="discussion-message-modifie"> · modifié</small>}
                    {(elementEnAttente || message.media_envoi) && <small className={`discussion-message-envoi ${elementEnAttente?.failed ? "echec" : ""}`} title={elementEnAttente?.failed ? "Échec de l'envoi" : message.media_envoi && Number(progressionMedia) > 0 ? `Envoi : ${Math.max(0, Math.min(100, Number(progressionMedia) || 0))}%` : "Envoi en cours"} aria-label={elementEnAttente?.failed ? "Échec de l'envoi" : message.media_envoi && Number(progressionMedia) > 0 ? `Envoi : ${Math.max(0, Math.min(100, Number(progressionMedia) || 0))}%` : "Envoi en cours"}>
                      <i className={`fa-solid ${elementEnAttente?.failed ? "fa-circle-exclamation" : "fa-clock"}`} />
                    </small>}
                    {propre && Number(message.id) > 0 && !message.supprime_pour_tous && <span className={`discussion-etat-message ${message.lu_par_au_moins_un ? "lu" : ""}`} title={message.lu_par_au_moins_un ? "Vu par au moins un membre" : "Envoyé"} aria-label={message.lu_par_au_moins_un ? "Vu par au moins un membre" : "Envoyé"}><i className={`fa-solid ${message.lu_par_au_moins_un ? "fa-check-double" : "fa-check"}`} /></span>}
                  </span>
                </div>
                {!message.supprime_pour_tous && !message.optimistic && <button type="button" className="discussion-repondre-rapide" onClick={() => commencerReponse(message)} title="Répondre"><i className="fa-solid fa-reply" /></button>}
              </div>
              {propre && <AvatarIcone username={message.auteur} taille={30} />}
            </article>
          );
        })}
        {typing.length > 0 && <div className="discussion-typing"><span /><span /><span />{typing.slice(0, 2).map(user => membres.find(m => m.username === user)?.nom || user).join(", ")} écrit{typing.length > 1 ? "ent" : ""}…</div>}
      </div>

      {messageErreur && <div className="discussion-erreur-message" role="alert">{messageErreur}<button type="button" onClick={() => setMessageErreur("")} aria-label="Fermer"><i className="fa-solid fa-xmark" /></button></div>}
      {!reseauInternetDisponible() ? <div className="discussion-hors-ligne-note"><i className="fa-solid fa-wifi-slash" /> Lecture hors ligne · les envois reprendront avec Internet.</div> : restreint ? <div className="discussion-restreint"><i className="fa-solid fa-comment-slash" /> Tu ne peux pas envoyer de message{discussion.restriction_jusqua ? ` jusqu'au ${new Date(discussion.restriction_jusqua).toLocaleString()}` : " pour le moment"}.</div> : (
        <div className="discussion-compositeur-zone">
          {messageEnEdition && <div className="discussion-reponse-active discussion-edition-active"><span><strong>Modification du message</strong><small>Tu peux modifier ton texte pendant les 15 premières minutes.</small></span><button type="button" onClick={() => { setMessageEnEdition(null); setTexte(""); }} aria-label="Annuler la modification"><i className="fa-solid fa-xmark" /></button></div>}
          {reponse && <div className="discussion-reponse-active"><span><strong>Réponse à {reponse.auteur_nom}</strong><small>{reponse.contenu}</small></span><button type="button" onClick={() => setReponse(null)} aria-label="Annuler la réponse"><i className="fa-solid fa-xmark" /></button></div>}
          {fichier && <div className="discussion-piece-selectionnee"><i className={`fa-solid ${iconePieceSelectionnee(fichier)}`} /><span>{fichier.name}</span><small>{tailleLisible(fichier.size)}</small><button type="button" onClick={() => { pendingMessageIdRef.current = null; pendingMessagePieceRef.current = null; pendingMessagePayloadRef.current = null; setFichier(null); [imagePieceRef, videoPieceRef, documentPieceRef].forEach(ref => { if (ref.current) ref.current.value = ""; }); }}><i className="fa-solid fa-xmark" /></button></div>}
          <div className={`discussion-compositeur ${vocalEnCours || vocalPreparation ? "vocal-actif" : ""}`}>
            {(vocalEnCours || vocalPreparation) ? (
              <div className="discussion-vocal-enregistrement" role="status" aria-live="polite">
                <span className="discussion-vocal-point" />
                <strong>{vocalPreparation ? "Ouverture du microphone…" : dureeLisible(vocalSecondes)}</strong>
                <div className="discussion-vocal-ondes en-direct" aria-label="Niveau sonore en direct">
                  {vocalNiveaux.map((niveau, index) => <span key={index} style={{ height: `${niveau}px` }} />)}
                </div>
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
                  <input ref={imagePieceRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={event => { pendingMessageIdRef.current = null; pendingMessagePieceRef.current = null; pendingMessagePayloadRef.current = null; setFichier(event.target.files?.[0] || null); setMenuPiecesOuvert(false); }} />
                  <input ref={videoPieceRef} type="file" hidden accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={event => { pendingMessageIdRef.current = null; pendingMessagePieceRef.current = null; pendingMessagePayloadRef.current = null; setFichier(event.target.files?.[0] || null); setMenuPiecesOuvert(false); }} />
                  <input ref={documentPieceRef} type="file" hidden accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => { pendingMessageIdRef.current = null; pendingMessagePieceRef.current = null; pendingMessagePayloadRef.current = null; setFichier(event.target.files?.[0] || null); setMenuPiecesOuvert(false); }} />
                </div>
                <textarea ref={textareaRef} rows={1} value={texte} onChange={event => changerTexte(event.target.value)} enterKeyHint="enter" placeholder={messageEnEdition ? "Modifier ton message…" : "Écrire un message…"} disabled={envoi || !!fichier} />
                {(texte.trim() || fichier) && <button type="button" className={`discussion-envoyer ${envoi ? "envoi-en-cours" : ""}`} onClick={envoyer} disabled={envoi} title="Envoyer" aria-label="Envoyer"><i className={`fa-solid ${messageEnEdition ? "fa-check" : "fa-paper-plane"}`} /></button>}
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
              title="Enregistrer un message vocal"
              aria-label="Enregistrer un message vocal"
            ><i className={`fa-solid ${vocalEnCours || vocalPreparation ? "fa-microphone-lines" : "fa-microphone"}`} /></button>
          </div>
          {suggestions.length > 0 && <div className="discussion-suggestions-mention">{suggestions.map(m => <button type="button" key={m.username} onClick={() => choisirMention(m)}><AvatarIcone username={m.username} taille={30} /><span><strong>{m.nom}</strong><small>@{m.username}</small></span><i className="fa-solid fa-at" /></button>)}</div>}
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
          <div className="discussion-panneau-statut">
            <span><i className={`discussion-online-dot ${socketEtat === "connecte" ? "actif" : ""}`} />{!reseauInternetDisponible() || socketEtat === "hors ligne" ? "Hors ligne · lecture seule" : socketEtat === "connecte" ? "Connecté" : "Reconnexion automatique"}</span>
            <small>Capacité : {discussion.limite_membres || 200} membres maximum</small>
          </div>
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
