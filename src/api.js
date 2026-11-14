// GRIND_URL = seul serveur que le frontend appelle directement.
// Les comptes sont autonomes : aucune clé G-SOCIETY n'est demandée à l'inscription.
export const GRIND_URL = import.meta.env.VITE_GRIND_URL || "https://grind-4vsz.onrender.com";

// L'application Android confirme l'accès réel à l'API via /api/health.
// navigator.onLine seul est insuffisant lorsqu'un Wi-Fi est connecté sans Internet.
export function estGrindEnLigne() {
  return navigator.onLine !== false && window.__GRIND_API_ONLINE !== false;
}

async function fetchApi(url, options) {
  try {
    return await fetch(url, options);
  } catch (cause) {
    const erreur = new Error(
      navigator.onLine === false
        ? "Aucune connexion à Internet. Vérifie ton réseau puis réessaie."
        : "Le serveur GRIND ne répond pas."
    );
    erreur.cause = cause;
    throw erreur;
  }
}

async function poster(url, body) {
  const res = await fetchApi(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    // Le serveur renvoie parfois un détail structuré (ex. compte sanctionné) : on le garde dans `donnees`.
    const erreur = new Error(typeof detail === "string" ? detail : detail?.message || "Une erreur est survenue");
    erreur.status = res.status;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) erreur.donnees = detail;
    throw erreur;
  }
  return data;
}

const pauseReessaiMedia = (delai) => new Promise((resolve) => window.setTimeout(resolve, delai));

// Les opérations de signature/confirmation ne créent pas de message. Elles
// peuvent donc être retentées brièvement quand Render se réveille ou répond 502/503.
// Ne pas utiliser cette fonction pour publier un message : un POST non idempotent
// pourrait créer un doublon si la réponse réseau se perd après le commit SQL.
async function posterMediaAvecReprise(url, body, etape) {
  const delais = [1200, 2800];
  let derniereErreur = null;

  for (let tentative = 0; tentative <= delais.length; tentative += 1) {
    try {
      return await poster(url, body);
    } catch (erreur) {
      derniereErreur = erreur;
      const statut = Number(erreur?.status || 0);
      const temporaire = !statut || [408, 425, 429, 500, 502, 503, 504].includes(statut);
      if (!temporaire || tentative === delais.length) break;
      await pauseReessaiMedia(delais[tentative]);
    }
  }

  const statut = Number(derniereErreur?.status || 0);
  if (!statut || [502, 503, 504].includes(statut)) {
    const suffixe = statut ? ` (HTTP ${statut})` : "";
    throw new Error(`GRIND n'a pas répondu pendant ${etape}${suffixe}. Le fichier n'a pas encore été publié ; vérifie la connexion puis réessaie.`);
  }
  throw derniereErreur;
}

// ---------- Compte GRIND (propre à GRIND, distinct de G-SOCIETY) ----------

export function inscrireGrind(email, password, cguAcceptees, nom, prenom) {
  // Le nom de profil n'est volontairement pas envoyé ici : il sera choisi
  // après la vérification e-mail et la configuration du PIN à 4 chiffres.
  return poster(`${GRIND_URL}/api/compte/signup`, {
    email, password, nom, prenom, cgu_acceptees: !!cguAcceptees,
  });
}

export function configurerPinInscription(jetonInscription, pin) {
  return poster(`${GRIND_URL}/api/compte/inscription/pin`, { jeton_inscription: jetonInscription, pin });
}

export function verifierNomProfilInscription(jetonInscription, username) {
  return poster(`${GRIND_URL}/api/compte/inscription/nom-profil/disponibilite`, {
    jeton_inscription: jetonInscription, username,
  });
}

export function finaliserNomProfilInscription(jetonInscription, username) {
  return poster(`${GRIND_URL}/api/compte/inscription/nom-profil/finaliser`, {
    jeton_inscription: jetonInscription, username,
  });
}

export function connecterGrind(username, password) {
  return poster(`${GRIND_URL}/api/compte/login`, { username, password });
}

export async function connecterGoogle(credential, username = null, cguAcceptees = false, password = null) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetchApi(`${GRIND_URL}/api/compte/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, username, password, cgu_acceptees: !!cguAcceptees }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.detail;
      const error = new Error(typeof detail === "string" ? detail : detail?.message || "La vérification du compte Google a échoué.");
      error.status = res.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("La vérification Google a dépassé 25 secondes. Vérifie la connexion au serveur GRIND puis réessaie.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export function obtenirDeviceId() {
  let id = localStorage.getItem("grind_device_id");
  if (!id) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem("grind_device_id", id);
  }
  return id;
}

export function associerCompteAppareil(sessionToken) {
  return poster(`${GRIND_URL}/api/compte/appareils/associer`, { session_token: sessionToken, device_id: obtenirDeviceId() });
}

export function oublierCompteAppareil(sessionToken, username) {
  return poster(`${GRIND_URL}/api/compte/appareils/oublier`, { session_token: sessionToken, username, device_id: obtenirDeviceId() });
}

export function statutPin(sessionToken) {
  return poster(`${GRIND_URL}/api/security/pin/status`, { session_token: sessionToken });
}
export function configurerPin(sessionToken, pin) {
  return poster(`${GRIND_URL}/api/security/pin/configurer`, { session_token: sessionToken, pin });
}
export function verifierPin(sessionToken, pin) {
  return poster(`${GRIND_URL}/api/security/pin/verifier`, { session_token: sessionToken, pin });
}

export function relockerPin(sessionToken) {
  return poster(`${GRIND_URL}/api/security/pin/relocker`, { session_token: sessionToken });
}

export function reinitialiserPin(sessionToken, password, nouveauPin) {
  return poster(`${GRIND_URL}/api/security/pin/reinitialiser`, { session_token: sessionToken, password, nouveau_pin: nouveauPin });
}
export function demanderReinitialisationPin(sessionToken) {
  return poster(`${GRIND_URL}/api/security/pin/reinitialiser/demander`, { session_token: sessionToken });
}
export function reinitialiserPinParEmail(sessionToken, jetonVerification, nouveauPin) {
  return poster(`${GRIND_URL}/api/security/pin/reinitialiser/email`, { session_token: sessionToken, jeton_verification: jetonVerification, nouveau_pin: nouveauPin });
}

// ---------- Profil GRIND (questionnaire) ----------

export function enregistrerProfil(sessionToken, { age, pays, niveau, filiere, etablissement, difficultes }) {
  return poster(`${GRIND_URL}/api/profil`, {
    session_token: sessionToken,
    age,
    pays,
    niveau,
    filiere,
    etablissement,
    difficultes,
  });
}

export async function obtenirMonProfil(sessionToken) {
  const res = await fetchApi(`${GRIND_URL}/api/profil/moi?session_token=${encodeURIComponent(sessionToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.message || "Impossible de vérifier le profil GRIND.");
  }
  return data;
}

export function modifierIdentite(sessionToken, prenom, nom) {
  return poster(`${GRIND_URL}/api/compte/identite`, { session_token: sessionToken, prenom, nom });
}

// ---------- Fil d'actu ----------

export async function listerPosts(categorie, sessionToken) {
  const url = new URL(`${GRIND_URL}/api/posts`);
  if (categorie) url.searchParams.set("categorie", categorie);
  if (sessionToken) url.searchParams.set("session_token", sessionToken);
  const res = await fetch(url);
  return res.json();
}

export function creerPost(sessionToken, { categorie, contenu, date_limite, media_url, media_type, media_items, document_url, document_name, document_title, document_type, document_categorie, etablissement_id }) {
  return poster(`${GRIND_URL}/api/posts`, {
    session_token: sessionToken, categorie, contenu, date_limite,
    media_url, media_type, media_items, document_url, document_name, document_title, document_type, document_categorie, etablissement_id,
  });
}

// ---------- Média (upload direct vers Cloudinary) ----------

const EXTENSION_PAR_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

function nomFichierTransfert(fichier, base = "media") {
  const nom = String(fichier?.name || "").trim();
  if (/\.[a-z0-9]{2,8}$/i.test(nom)) return nom;
  const type = String(fichier?.type || "").split(";", 1)[0].trim().toLowerCase();
  const extension = EXTENSION_PAR_MIME[type] || "";
  return `${nom || base}${extension}`;
}

function envoyerXHR(url, formulaire, { headers = {}, onProgress = null, timeout = 15 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = timeout;
    Object.entries(headers).forEach(([nom, valeur]) => xhr.setRequestHeader(nom, valeur));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || "{}"); } catch { /* réponse non JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else {
        const detail = typeof data.detail === "string" ? data.detail : data.detail?.message;
        const fournisseur = typeof data.error?.message === "string" ? data.error.message : "";
        const brut = detail || fournisseur;
        const message = brut && !/cloudinary|signature|api[_ -]?key|upload[_ -]?preset|secret/i.test(brut)
          ? brut
          : xhr.status === 401
            ? "Ta session GRIND a expiré. Reconnecte-toi puis réessaie."
            : xhr.status === 413
              ? "Le fichier dépasse la limite autorisée."
              : xhr.status === 415
                ? "Ce format de fichier n'est pas accepté."
                : xhr.status >= 500
                  ? "Le service de stockage rencontre une difficulté. Réessaie dans quelques instants."
                  : "Le transfert du fichier n’a pas abouti. Réessaie dans quelques instants.";
        const erreur = new Error(message);
        erreur.status = xhr.status;
        reject(erreur);
      }
    };
    xhr.onerror = () => {
      const erreur = new Error("Le service de transfert n'a pas répondu. Vérifie Internet puis réessaie.");
      erreur.status = xhr.status || 0;
      reject(erreur);
    };
    xhr.ontimeout = () => {
      const erreur = new Error("Le transfert a dépassé le délai autorisé. Ta publication n'a pas été envoyée ; réessaie avec une connexion plus stable.");
      erreur.status = 408;
      reject(erreur);
    };
    xhr.send(formulaire);
  });
}

function verifierUrlUploadCloudinary(url, ressource) {
  try {
    const cible = new URL(url);
    return cible.protocol === "https:" && cible.hostname === "api.cloudinary.com"
      && /^\/v1_1\/[A-Za-z0-9_-]+\/(image|video|raw)\/upload$/.test(cible.pathname)
      && cible.pathname.endsWith(`/${ressource}/upload`);
  } catch {
    return false;
  }
}

function formulaireUploadSigne(fichier, nom, signature) {
  const formulaire = new FormData();
  formulaire.append("file", fichier, nom);
  formulaire.append("api_key", signature.api_key);
  formulaire.append("timestamp", String(signature.timestamp));
  formulaire.append("signature", signature.signature);
  Object.entries(signature.params || {}).forEach(([cle, valeur]) => formulaire.append(cle, String(valeur)));
  return formulaire;
}

async function uploaderVideoChunked(sessionToken, fichier, decoupeVideo, onProgress) {
  const nom = nomFichierTransfert(fichier, "cours");
  const signature = await posterMediaAvecReprise(`${GRIND_URL}/api/media/upload/signature`, {
    session_token: sessionToken, file_name: nom, file_size: fichier.size,
    content_type: fichier.type || "application/octet-stream",
    debut_video: decoupeVideo?.debut, fin_video: decoupeVideo?.fin,
  }, "la préparation de l'envoi média");
  if (!verifierUrlUploadCloudinary(signature.upload_url, "video")) {
    throw new Error("Le serveur GRIND a renvoyé une destination de transfert invalide.");
  }
  const chunkSize = signature.taille_chunk_octets;
  if (!chunkSize || chunkSize < 5 * 1024 * 1024) throw new Error("Le transfert de la vidéo n’a pas pu être initialisé. Réessaie dans quelques instants.");
  const uploadId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let resultatFinal = null;
  for (let debut = 0; debut < fichier.size; debut += chunkSize) {
    const finExclusive = Math.min(debut + chunkSize, fichier.size);
    const fin = finExclusive - 1;
    const morceau = fichier.slice(debut, finExclusive);
    const formulaire = new FormData();
    formulaire.append("file", morceau, nom);
    formulaire.append("api_key", signature.api_key);
    formulaire.append("timestamp", signature.timestamp);
    formulaire.append("signature", signature.signature);
    Object.entries(signature.params || {}).forEach(([cle, valeur]) => formulaire.append(cle, valeur));
    const resultat = await envoyerXHR(signature.upload_url, formulaire, {
      headers: {
        "Content-Range": `bytes ${debut}-${fin}/${fichier.size}`,
        "X-Unique-Upload-Id": uploadId,
      },
      onProgress: (charge, total) => onProgress?.(Math.min(99, Math.round((debut + Math.min(charge, total)) / fichier.size * 100))),
    });
    const dernierSegment = finExclusive === fichier.size;
    if (!dernierSegment && resultat.done !== false) throw new Error("Le transfert de la vidéo a échoué. Réessaie avec une connexion plus stable.");
    if (dernierSegment) {
      if (resultat.done !== true) throw new Error("Le transfert de la vidéo a échoué. Réessaie avec une connexion plus stable.");
      resultatFinal = resultat;
    }
  }
  if (!resultatFinal?.secure_url || !resultatFinal?.signature) throw new Error("Le transfert de la vidéo n’a pas pu être finalisé. Réessaie dans quelques instants.");
  onProgress?.(99);
  const confirmation = await posterMediaAvecReprise(`${GRIND_URL}/api/media/upload/confirm`, {
    session_token: sessionToken, asset: resultatFinal,
    debut_video: decoupeVideo?.debut, fin_video: decoupeVideo?.fin,
  }, "la validation du média");
  onProgress?.(100);
  return confirmation;
}

export async function uploaderMedia(sessionToken, fichier, decoupeVideo, onProgress = null) {
  if (!fichier) throw new Error("Choisis un média avant de publier.");
  const nom = nomFichierTransfert(fichier, "media");
  const extension = nom.split(".").pop().toLowerCase();
  const estVideo = String(fichier.type || "").startsWith("video/") || ["mp4", "mov", "webm"].includes(extension);
  const groupe = estVideo ? "video" : "image";
  const limiteMo = estVideo ? 300 : 25;
  if (fichier.size <= 0 || fichier.size > limiteMo * 1024 * 1024) {
    throw new Error(`Le média doit être non vide et ne pas dépasser ${limiteMo} Mo${estVideo ? " pour une vidéo" : " pour une image"}.`);
  }

  // Les très grosses vidéos utilisent le transfert Cloudinary par segments.
  if (estVideo && fichier.size > 90 * 1024 * 1024) {
    return uploaderVideoChunked(sessionToken, fichier, decoupeVideo, onProgress);
  }

  // Le fichier part directement vers Cloudinary après signature par GRIND.
  // GRIND ne relaie donc plus le corps du fichier : on évite les timeouts Render.
  const signature = await posterMediaAvecReprise(`${GRIND_URL}/api/media/upload/signature`, {
    session_token: sessionToken,
    file_name: nom,
    file_size: fichier.size,
    content_type: fichier.type || "application/octet-stream",
    debut_video: decoupeVideo?.debut,
    fin_video: decoupeVideo?.fin,
  }, "la préparation de l'envoi média");
  if (!verifierUrlUploadCloudinary(signature.upload_url, groupe)) {
    throw new Error("Le serveur GRIND a renvoyé une destination de transfert invalide.");
  }

  const formulaire = formulaireUploadSigne(fichier, nom, signature);
  const asset = await envoyerXHR(signature.upload_url, formulaire, {
    onProgress: (charge, total) => onProgress?.(total ? Math.min(98, Math.round(charge / total * 98)) : 0),
    timeout: 15 * 60 * 1000,
  });
  if (!asset?.secure_url || !asset?.public_id || !asset?.version || !asset?.signature) {
    throw new Error("Le stockage n'a pas confirmé la réception complète du média.");
  }

  onProgress?.(99);
  const resultat = await posterMediaAvecReprise(`${GRIND_URL}/api/media/upload/confirm`, {
    session_token: sessionToken,
    asset,
    debut_video: decoupeVideo?.debut,
    fin_video: decoupeVideo?.fin,
  }, "la validation du média");
  onProgress?.(100);
  return resultat;
}

export async function uploaderDocument(sessionToken, fichier, onProgress = null) {
  if (!fichier) throw new Error("Choisis un document avant de publier.");
  const nomOriginal = String(fichier.name || "").trim();
  const typeFourni = String(fichier.type || "").split(";", 1)[0].trim().toLowerCase();
  const extensionDepuisMime = typeFourni === "application/pdf" ? "pdf"
    : typeFourni === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? "docx" : "";
  const extensionNom = nomOriginal.split(".").pop().toLowerCase();
  const extension = ["pdf", "docx"].includes(extensionNom) ? extensionNom : extensionDepuisMime;
  const mimeParExtension = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const typeAttendu = mimeParExtension[extension];
  if (!typeAttendu) throw new Error("Seuls les documents PDF et DOCX sont acceptés.");
  if (fichier.size <= 0 || fichier.size > 15 * 1024 * 1024) throw new Error("Le document doit être non vide et ne pas dépasser 15 Mo.");

  // Retour au chemin multipart stable de 2.10.5 : le backend vérifie les octets
  // et la structure PDF/DOCX avant le stockage, sans relire un raw asset Cloudinary
  // (qui répond actuellement 401 à l'étape de confirmation directe).
  const nom = /\.(pdf|docx)$/i.test(nomOriginal) ? nomOriginal : `document.${extension}`;
  const fichierNormalise = new File([fichier], nom, {
    type: typeAttendu,
    lastModified: Number(fichier.lastModified) || Date.now(),
  });
  const formulaire = new FormData();
  formulaire.append("session_token", sessionToken);
  formulaire.append("file", fichierNormalise, nom);
  const resultat = await envoyerXHR(`${GRIND_URL}/api/media/document`, formulaire, {
    onProgress: (charge, total) => onProgress?.(total ? Math.round(charge / total * 100) : 0),
    timeout: 5 * 60 * 1000,
  });
  onProgress?.(100);
  return resultat;
}

export function togglerLike(sessionToken, postId) {
  return poster(`${GRIND_URL}/api/posts/${postId}/like`, { session_token: sessionToken });
}

export async function listerCommentaires(postId, sessionToken) {
  const url = new URL(`${GRIND_URL}/api/posts/${postId}/commentaires`);
  if (sessionToken) url.searchParams.set("session_token", sessionToken);
  const res = await fetch(url);
  return res.json();
}

export function ajouterCommentaire(sessionToken, postId, contenu, pieces = {}) {
  return poster(`${GRIND_URL}/api/posts/${postId}/commentaires`, { session_token: sessionToken, contenu, ...pieces });
}

export function resoudrePost(sessionToken, postId) {
  return poster(`${GRIND_URL}/api/posts/${postId}/resoudre`, { session_token: sessionToken });
}

export async function supprimerPost(sessionToken, postId) {
  const res = await fetch(`${GRIND_URL}/api/posts/${postId}?session_token=${encodeURIComponent(sessionToken)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Suppression impossible");
  return data;
}

// ---------- Classes ----------

export function creerClasse(sessionToken, { nom, niveau, matiere, complement } = {}) {
  // Le contrat moderne ne demande que le nom. Les trois champs historiques
  // restent transmis lorsqu'un ancien écran les fournit encore.
  return poster(`${GRIND_URL}/api/classes`, {
    session_token: sessionToken,
    nom,
    niveau,
    matiere,
    complement,
  });
}

export function rejoindreClasse(sessionToken, codeInvitation) {
  return poster(`${GRIND_URL}/api/classes/rejoindre`, { session_token: sessionToken, code_invitation: codeInvitation });
}

export async function listerMesClasses(sessionToken) {
  const res = await fetchApi(`${GRIND_URL}/api/classes/mes-classes?session_token=${encodeURIComponent(sessionToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(typeof data.detail === "string" ? data.detail : "Impossible de charger les classes.");
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function renommerClasse(sessionToken, classeId, nom) {
  const res = await fetch(`${GRIND_URL}/api/classes/${classeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken, nom }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Renommage impossible");
  return data;
}

export async function obtenirEtatSalle(sessionToken, classeId) {
  const res = await fetchApi(`${GRIND_URL}/api/classes/${classeId}/salle/etat?session_token=${encodeURIComponent(sessionToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Impossible de charger la salle de classe.");
  return data;
}

export async function modererMicroClasse(sessionToken, classeId, username, mute) {
  const res = await fetchApi(`${GRIND_URL}/api/livekit/classes/${classeId}/micro/${encodeURIComponent(username)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken, mute: !!mute }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "La modération du micro a échoué.");
  return data;
}

export async function obtenirJetonLiveKit(sessionToken, classeId) {
  const res = await fetch(`${GRIND_URL}/api/livekit/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken, classe_id: classeId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Impossible d'obtenir l'accès audio");
  return data;
}

export async function transfererProf(sessionToken, classeId, nouveauProf) {
  const res = await fetch(`${GRIND_URL}/api/classes/${classeId}/transferer-prof`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken, nouveau_prof: nouveauProf }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Transfert impossible");
  return data;
}

export async function supprimerClasse(sessionToken, classeId) {
  const res = await fetch(`${GRIND_URL}/api/classes/${classeId}?session_token=${encodeURIComponent(sessionToken)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Suppression impossible");
  return data;
}

// Tolère qu'on colle le lien complet au lieu du code seul —
// extrait automatiquement la dernière partie de l'URL.
export function extraireCode(saisie) {
  const propre = saisie.trim();
  const correspondance = propre.match(/\/rejoindre\/([^/?#]+)/);
  if (correspondance) return decodeURIComponent(correspondance[1]);
  return propre;
}


export async function obtenirDiscussionClasse(sessionToken, classeId) {
  const url = `${GRIND_URL}/api/classes/${classeId}/discussion?session_token=${encodeURIComponent(sessionToken)}`;
  const res = await fetchApi(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(typeof data.detail === "string" ? data.detail : data.detail?.message || "Impossible d'ouvrir la discussion.");
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function listerMessagesDiscussion(sessionToken, classeId, beforeId = null, afterId = null) {
  const url = new URL(`${GRIND_URL}/api/classes/${classeId}/discussion/messages`);
  url.searchParams.set("session_token", sessionToken);
  if (beforeId) url.searchParams.set("before_id", String(beforeId));
  if (afterId) url.searchParams.set("after_id", String(afterId));
  const res = await fetchApi(url.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.detail || "Impossible de charger les messages.");
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function envoyerVocalDiscussion(sessionToken, classeId, fichier, replyToId = null, onProgress = null) {
  if (!fichier || !fichier.type?.startsWith("audio/")) throw new Error("L'enregistrement vocal n'est pas valide.");
  if (fichier.size <= 0 || fichier.size > 8 * 1024 * 1024) throw new Error("Le vocal doit être non vide et ne pas dépasser 8 Mo.");
  const formulaire = new FormData();
  formulaire.append("session_token", sessionToken);
  formulaire.append("file", fichier, fichier.name || "message-vocal.webm");
  if (replyToId) formulaire.append("reply_to_id", String(replyToId));
  return envoyerXHR(`${GRIND_URL}/api/classes/${classeId}/discussion/vocaux`, formulaire, {
    onProgress: (charge, total) => onProgress?.(total ? Math.round(charge / total * 100) : 0),
    timeout: 120000,
  });
}

export async function envoyerMessageDiscussion(sessionToken, classeId, payload) {
  try {
    return await poster(`${GRIND_URL}/api/classes/${classeId}/discussion/messages`, { session_token: sessionToken, ...payload });
  } catch (erreur) {
    if (!erreur?.status) {
      throw new Error("GRIND n'a pas confirmé la publication du message. Vérifie d'abord s'il apparaît déjà dans le groupe avant de réessayer, pour éviter un doublon.");
    }
    throw erreur;
  }
}

export async function modifierMessageDiscussion(sessionToken, classeId, messageId, contenu) {
  const res = await fetchApi(`${GRIND_URL}/api/classes/${classeId}/discussion/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken, contenu }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Impossible de modifier ce message.");
  return data;
}

export async function supprimerMessageDiscussionPourMoi(sessionToken, classeId, messageId) {
  const url = `${GRIND_URL}/api/classes/${classeId}/discussion/messages/${messageId}/pour-moi`;
  const res = await fetchApi(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Impossible de masquer ce message.");
  return data;
}

export async function supprimerMessageDiscussionPourTous(sessionToken, classeId, messageId) {
  const url = `${GRIND_URL}/api/classes/${classeId}/discussion/messages/${messageId}/pour-tous`;
  const res = await fetchApi(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : data.detail?.message || "Impossible de supprimer ce message pour tout le monde.");
  return data;
}

export function urlDiscussion(sessionToken, discussionId) {
  const base = GRIND_URL.replace(/^https/, "wss").replace(/^http/, "ws");
  return `${base}/ws/discussion/${discussionId}?session_token=${encodeURIComponent(sessionToken)}`;
}

export function urlPieceDiscussion(sessionToken, classeId, messageId, download = false, poster = false) {
  const url = new URL(`${GRIND_URL}/api/classes/${classeId}/discussion/messages/${messageId}/piece`);
  url.searchParams.set("session_token", sessionToken);
  if (download) url.searchParams.set("download", "1");
  if (poster) url.searchParams.set("poster", "1");
  return url.toString();
}

export async function listerMentionsDiscussion(sessionToken, classeId) {
  const res = await fetchApi(`${GRIND_URL}/api/classes/${classeId}/discussion/mentions?session_token=${encodeURIComponent(sessionToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Impossible de charger les mentions.");
  return data;
}

export function marquerMentionDiscussionLue(sessionToken, classeId, mentionId) {
  return poster(`${GRIND_URL}/api/classes/${classeId}/discussion/mentions/${mentionId}/lue`, { session_token: sessionToken });
}

export function rejoindreDiscussion(sessionToken, codeInvitation) {
  return poster(`${GRIND_URL}/api/classes/discussions/rejoindre`, { session_token: sessionToken, code_invitation: codeInvitation });
}

export function rejoindreVraieClasseDepuisDiscussion(sessionToken, classeId) {
  return poster(`${GRIND_URL}/api/classes/${classeId}/discussion/rejoindre-classe`, { session_token: sessionToken });
}

export function modifierPhotoDiscussion(sessionToken, classeId, photoUrl) {
  return poster(`${GRIND_URL}/api/classes/${classeId}/discussion/photo`, { session_token: sessionToken, photo_url: photoUrl });
}

export function ajouterAdminDiscussion(sessionToken, classeId, username) {
  return poster(`${GRIND_URL}/api/classes/${classeId}/discussion/admins`, { session_token: sessionToken, username });
}

export function retirerAdminDiscussion(sessionToken, classeId, username) {
  return poster(`${GRIND_URL}/api/classes/${classeId}/discussion/admins/${encodeURIComponent(username)}?session_token=${encodeURIComponent(sessionToken)}`, { session_token: sessionToken });
}

export function restreindreMembreDiscussion(sessionToken, classeId, username, options) {
  return fetchApi(`${GRIND_URL}/api/classes/${classeId}/discussion/membres/${encodeURIComponent(username)}/restriction`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken, ...options }),
  }).then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail || "Restriction impossible."); return data; });
}

export function leverRestrictionDiscussion(sessionToken, classeId, username) {
  return fetchApi(`${GRIND_URL}/api/classes/${classeId}/discussion/membres/${encodeURIComponent(username)}/restriction?session_token=${encodeURIComponent(sessionToken)}`, { method: "DELETE" }).then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail || "Impossible de lever la restriction."); return data; });
}

export function retirerMembreDiscussion(sessionToken, classeId, username) {
  return fetchApi(`${GRIND_URL}/api/classes/${classeId}/discussion/membres/${encodeURIComponent(username)}?session_token=${encodeURIComponent(sessionToken)}`, { method: "DELETE" }).then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail || "Impossible de retirer ce membre."); return data; });
}

export function quitterDiscussion(sessionToken, classeId) {
  return poster(`${GRIND_URL}/api/classes/${classeId}/discussion/quitter`, { session_token: sessionToken });
}

export function transfererProprietaireDiscussion(sessionToken, classeId, username) {
  return poster(`${GRIND_URL}/api/classes/${classeId}/discussion/proprietaire`, { session_token: sessionToken, username });
}

export function renouvelerInvitationDiscussion(sessionToken, classeId) {
  return poster(`${GRIND_URL}/api/classes/${classeId}/discussion/invitation/renouveler`, { session_token: sessionToken });
}

// ---------- Aide ----------

export function demanderAide(sessionToken, sujet, description) {
  return poster(`${GRIND_URL}/api/aide/demander`, { session_token: sessionToken, sujet, description });
}

export async function listerDemandesOuvertes() {
  const res = await fetch(`${GRIND_URL}/api/aide/ouvertes`);
  return res.json();
}

export function accepterDemande(sessionToken, demandeId) {
  return poster(`${GRIND_URL}/api/aide/accepter`, { session_token: sessionToken, demande_id: demandeId });
}

export async function obtenirIdentifiantsTurn(sessionToken) {
  const res = await fetch(`${GRIND_URL}/api/turn-credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken }),
  });
  return res.json();
}

export function urlSession(sessionToken, demandeId, estClasse = false) {
  const base = GRIND_URL.replace(/^https/, "wss").replace(/^http/, "ws");
  const mode = estClasse ? "&classe=1" : "";
  return `${base}/ws/session/${demandeId}?session_token=${encodeURIComponent(sessionToken)}${mode}`;
}

// ---------- Avatar ----------

export async function obtenirCatalogueAvatar() {
  const res = await fetch(`${GRIND_URL}/api/avatar/catalogue`);
  return res.json();
}

export async function obtenirMonAvatar(sessionToken) {
  const res = await fetch(`${GRIND_URL}/api/avatar/moi?session_token=${encodeURIComponent(sessionToken)}`);
  return res.json();
}

export async function obtenirProfilDe(username) {
  const res = await fetch(`${GRIND_URL}/api/profil/de/${encodeURIComponent(username)}`);
  return res.json();
}

export async function obtenirAvatarDe(username) {
  const res = await fetch(`${GRIND_URL}/api/avatar/de/${encodeURIComponent(username)}`);
  return res.json();
}

export async function enregistrerAvatar(sessionToken, config) {
  const res = await fetch(`${GRIND_URL}/api/avatar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken, ...config }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Enregistrement impossible");
  return data;
}

// ---------- Notifications temps réel ----------

export function urlNotifs(sessionToken) {
  const base = GRIND_URL.replace(/^https/, "wss").replace(/^http/, "ws");
  return `${base}/ws/notifs?session_token=${encodeURIComponent(sessionToken)}`;
}


// ---------- Modération, CGU et administration ----------

export function obtenirMonStatut(sessionToken) {
  return poster(`${GRIND_URL}/api/moderation/moi`, { session_token: sessionToken });
}

export function accepterCgu(sessionToken) {
  return poster(`${GRIND_URL}/api/moderation/accepter-cgu`, { session_token: sessionToken });
}

export function signalerContenu(sessionToken, { type_cible, cible_id, motif, details }) {
  return poster(`${GRIND_URL}/api/moderation/signaler`, {
    session_token: sessionToken,
    type_cible,
    cible_id,
    motif,
    details,
  });
}

export function adminListerSignalements(sessionToken, statut) {
  return poster(`${GRIND_URL}/api/admin/signalements`, { session_token: sessionToken, statut });
}

export function adminTraiterSignalement(sessionToken, signalementId, { action, supprimer_contenu, duree_jours, note, examen_possible }) {
  return poster(`${GRIND_URL}/api/admin/signalements/${signalementId}/traiter`, {
    session_token: sessionToken,
    action,
    supprimer_contenu: !!supprimer_contenu,
    duree_jours,
    note,
    examen_possible: !!examen_possible,
  });
}

export function adminChercherUtilisateurs(sessionToken, q) {
  return poster(`${GRIND_URL}/api/admin/utilisateurs`, { session_token: sessionToken, q });
}

export function adminSanctionner(sessionToken, { username, type, duree_jours, motif, examen_possible }) {
  return poster(`${GRIND_URL}/api/admin/sanctionner`, {
    session_token: sessionToken,
    username,
    type,
    duree_jours,
    motif,
    examen_possible: !!examen_possible,
  });
}

export function adminLeverSanction(sessionToken, username) {
  return poster(`${GRIND_URL}/api/admin/lever-sanction`, { session_token: sessionToken, username });
}

export function adminSupprimerCompte(sessionToken, username, confirmationUsername) {
  return poster(`${GRIND_URL}/api/admin/comptes/supprimer`, { session_token: sessionToken, username, confirmation_username: confirmationUsername });
}

// ---------- Bureau d'administration : équipe, certification, annonces ----------

export function adminApercu(sessionToken) {
  return poster(`${GRIND_URL}/api/admin/apercu`, { session_token: sessionToken });
}

export function adminDefinirNom(sessionToken, nomAffiche) {
  return poster(`${GRIND_URL}/api/admin/nom`, { session_token: sessionToken, nom_affiche: nomAffiche });
}

export function adminListerEquipe(sessionToken) {
  return poster(`${GRIND_URL}/api/admin/equipe`, { session_token: sessionToken });
}

export function adminNommer(sessionToken, username, role) {
  return poster(`${GRIND_URL}/api/admin/equipe/nommer`, { session_token: sessionToken, username, role });
}

export function adminRetirerDeLEquipe(sessionToken, username) {
  return poster(`${GRIND_URL}/api/admin/equipe/retirer`, { session_token: sessionToken, username });
}

export function adminCertifier(sessionToken, username, certifie) {
  return poster(`${GRIND_URL}/api/admin/certifier`, { session_token: sessionToken, username, certifie });
}

export function adminPublierAnnonce(sessionToken, { titre, contenu, media_url, media_type, document_url, document_name, document_type, important, epinglee }) {
  return poster(`${GRIND_URL}/api/admin/annonces/publier`, {
    session_token: sessionToken, titre, contenu, media_url, media_type,
    document_url, document_name, document_type, important: !!important, epinglee: !!epinglee,
  });
}

export function adminSupprimerAnnonce(sessionToken, annonceId) {
  return poster(`${GRIND_URL}/api/admin/annonces/supprimer`, { session_token: sessionToken, annonce_id: annonceId });
}

export function listerAnnonces(sessionToken) {
  return poster(`${GRIND_URL}/api/annonces`, { session_token: sessionToken });
}

// ---------- Support : « Contactez-nous » (élève) ----------

export function supportConversation(sessionToken) {
  return poster(`${GRIND_URL}/api/support/conversation`, { session_token: sessionToken });
}

export function supportOuvrir(sessionToken, message) {
  return poster(`${GRIND_URL}/api/support/ouvrir`, { session_token: sessionToken, message });
}

export function supportEnvoyer(sessionToken, conversationId, message) {
  return poster(`${GRIND_URL}/api/support/envoyer`, { session_token: sessionToken, conversation_id: conversationId, message });
}

export function supportDemanderHumain(sessionToken, conversationId) {
  return poster(`${GRIND_URL}/api/support/demander-humain`, { session_token: sessionToken, conversation_id: conversationId });
}

export function supportCloturer(sessionToken, conversationId) {
  return poster(`${GRIND_URL}/api/support/cloturer`, { session_token: sessionToken, conversation_id: conversationId });
}

// ---------- Support : boîte de l'équipe ----------

export function adminSupportListe(sessionToken, statut) {
  return poster(`${GRIND_URL}/api/admin/support/liste`, { session_token: sessionToken, statut });
}

export function adminSupportLire(sessionToken, conversationId) {
  return poster(`${GRIND_URL}/api/admin/support/lire`, { session_token: sessionToken, conversation_id: conversationId });
}

export function adminSupportRepondre(sessionToken, conversationId, message) {
  return poster(`${GRIND_URL}/api/admin/support/repondre`, { session_token: sessionToken, conversation_id: conversationId, message });
}

export function adminSupportIA(sessionToken, conversationId, active) {
  return poster(`${GRIND_URL}/api/admin/support/ia`, { session_token: sessionToken, conversation_id: conversationId, active });
}

export function adminSupportAssistant(sessionToken, tester) {
  return poster(`${GRIND_URL}/api/admin/support/assistant`, { session_token: sessionToken, tester: !!tester });
}

export function adminSupportCloturer(sessionToken, conversationId) {
  return poster(`${GRIND_URL}/api/admin/support/cloturer`, { session_token: sessionToken, conversation_id: conversationId });
}

// ---------- Blocage : « ne plus voir ses contenus » ----------

export function bloquerCompte(sessionToken, username) {
  return poster(`${GRIND_URL}/api/moderation/bloquer`, { session_token: sessionToken, username });
}

export function debloquerCompte(sessionToken, username) {
  return poster(`${GRIND_URL}/api/moderation/debloquer`, { session_token: sessionToken, username });
}

export function listerBloques(sessionToken) {
  return poster(`${GRIND_URL}/api/moderation/bloques`, { session_token: sessionToken });
}

// ---------- Examen d'une sanction (la personne n'a plus de session : elle utilise le jeton reçu à la connexion) ----------

export function examenEtat(username, jetonExamen) {
  return poster(`${GRIND_URL}/api/examen/etat`, { username, jeton_examen: jetonExamen });
}

export function examenDemander(username, jetonExamen, message) {
  return poster(`${GRIND_URL}/api/examen/demander`, { username, jeton_examen: jetonExamen, message });
}

// ---------- Examens : côté administration ----------

export function adminExamens(sessionToken, statut) {
  return poster(`${GRIND_URL}/api/admin/examens`, { session_token: sessionToken, statut });
}

export function adminExamenDossier(sessionToken, examenId) {
  return poster(`${GRIND_URL}/api/admin/examens/dossier`, { session_token: sessionToken, examen_id: examenId });
}

export function adminExamenTraiter(sessionToken, examenId, decision, note) {
  return poster(`${GRIND_URL}/api/admin/examens/traiter`, {
    session_token: sessionToken,
    examen_id: examenId,
    decision,
    note: note || null,
  });
}

export function adminSupprimerContenu(sessionToken, typeCible, cibleId) {
  return poster(`${GRIND_URL}/api/admin/contenu/supprimer`, { session_token: sessionToken, type_cible: typeCible, cible_id: cibleId });
}

export function adminToutSupprimer(sessionToken, username) {
  return poster(`${GRIND_URL}/api/admin/contenu/tout-supprimer`, { session_token: sessionToken, username });
}

export function adminSupprimerClasse(sessionToken, classeId) {
  return poster(`${GRIND_URL}/api/admin/classe/supprimer`, { session_token: sessionToken, classe_id: classeId });
}

// ---------- Authentification : vérification d'e-mail, mot de passe oublié, déconnexion, catalogue ----------

export function verifierCode(jetonVerification, code) {
  return poster(`${GRIND_URL}/api/compte/verification/verifier`, { jeton_verification: jetonVerification, code });
}

export function renvoyerCode(jetonVerification) {
  return poster(`${GRIND_URL}/api/compte/verification/renvoyer`, { jeton_verification: jetonVerification });
}

export function associerEmail(jetonVerification, email) {
  return poster(`${GRIND_URL}/api/compte/email/associer`, { jeton_verification: jetonVerification, email });
}

export function motDePasseOublie(email) {
  return poster(`${GRIND_URL}/api/compte/mot-de-passe-oublie`, { email });
}

export function reinitialiserMotDePasse(jetonVerification, motDePasse) {
  return poster(`${GRIND_URL}/api/compte/mot-de-passe/reinitialiser`, {
    jeton_verification: jetonVerification,
    mot_de_passe: motDePasse,
  });
}

export function enregistrerJetonPush(sessionToken, token) {
  return poster(`${GRIND_URL}/api/push/register`, { session_token: sessionToken, token, platform: "android" });
}
export function retirerJetonPush(sessionToken, token) {
  return poster(`${GRIND_URL}/api/push/unregister`, { session_token: sessionToken, token, platform: "android" });
}
export async function deconnecterGrind(sessionToken) {
  const pushToken = localStorage.getItem("grind_push_token");
  if (pushToken) {
    try { await retirerJetonPush(sessionToken, pushToken); } catch {}
    localStorage.removeItem("grind_push_token");
  }
  return poster(`${GRIND_URL}/api/compte/deconnexion`, { session_token: sessionToken });
}

let _catalogue = null;
const CLE_CACHE_CATALOGUE = "grind_scolaire_catalogue_v1";
const AGE_MAX_CACHE_CATALOGUE = 180 * 24 * 60 * 60 * 1000;
function catalogueValide(data) {
  return Boolean(data && Array.isArray(data.niveaux) && data.matieres_par_niveau && typeof data.matieres_par_niveau === "object");
}
function lireCatalogueLocal() {
  try {
    const cache = JSON.parse(localStorage.getItem(CLE_CACHE_CATALOGUE) || "null");
    if (!catalogueValide(cache?.data) || !Number.isFinite(Number(cache?.savedAt))) return null;
    if (Date.now() - Number(cache.savedAt) > AGE_MAX_CACHE_CATALOGUE) return null;
    return cache.data;
  } catch { return null; }
}
export async function catalogueScolaire() {
  if (_catalogue) return _catalogue;
  const local = lireCatalogueLocal();
  if (!estGrindEnLigne() && local) { _catalogue = local; return _catalogue; }
  try {
    const res = await fetchApi(`${GRIND_URL}/api/scolaire/catalogue`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Le catalogue scolaire est temporairement indisponible.");
    if (!catalogueValide(data)) throw new Error("Le serveur a répondu, mais le catalogue scolaire est incomplet. Vérifie la version du backend déployée.");
    _catalogue = data;
    try { localStorage.setItem(CLE_CACHE_CATALOGUE, JSON.stringify({ data, savedAt: Date.now() })); } catch {}
    return _catalogue;
  } catch (erreur) {
    if (local) { _catalogue = local; return _catalogue; }
    throw erreur;
  }
}

// ---------- Candidature proviseur / direction ----------

export async function inscrireProviseur(formData) {
  const res = await fetchApi(`${GRIND_URL}/api/proviseur/candidature`, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Candidature impossible");
  return data;
}

export function obtenirMaCandidatureProviseur(sessionToken) {
  return poster(`${GRIND_URL}/api/proviseur/moi`, { session_token: sessionToken });
}


export async function uploaderLogoProviseur(sessionToken, fichier) {
  if (!fichier || !["image/jpeg", "image/png"].includes(fichier.type)) throw new Error("Le logo doit être une image JPEG ou PNG.");
  if (fichier.size > 5 * 1024 * 1024) throw new Error("Le logo ne doit pas dépasser 5 Mo.");
  const formulaire = new FormData();
  formulaire.append("session_token", sessionToken);
  formulaire.append("file", fichier, fichier.name || "logo.png");
  const res = await fetch(`${GRIND_URL}/api/proviseur/logo/upload`, { method: "POST", body: formulaire });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Échec de l'envoi du logo.");
  return data.logo_url;
}

export function changerLogoProviseur(sessionToken, logoUrl) {
  return poster(`${GRIND_URL}/api/proviseur/logo`, { session_token: sessionToken, logo_url: logoUrl });
}

export function listerCandidaturesProviseurs(sessionToken, statut = "en_attente") {
  return poster(`${GRIND_URL}/api/admin/proviseurs/liste`, { session_token: sessionToken, statut });
}

export function traiterCandidatureProviseur(sessionToken, { candidature_id, decision, etablissements, etablissement, note_admin, message_candidat, moderation_locale }) {
  return poster(`${GRIND_URL}/api/admin/proviseurs/traiter`, {
    session_token: sessionToken, candidature_id, decision, etablissements, etablissement, note_admin, message_candidat, moderation_locale,
  });
}

export async function telechargerDocumentProviseur(sessionToken, documentId) {
  const res = await fetch(`${GRIND_URL}/api/admin/proviseurs/document/${documentId}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : "Lecture du document impossible");
  }
  return res.blob();
}


export function modererPostInstitution(sessionToken, postId) {
  return poster(`${GRIND_URL}/api/proviseur/posts/${postId}/moderation`, { session_token: sessionToken });
}


export function modifierNomProfil(sessionToken, nouveauUsername) {
  return poster(`${GRIND_URL}/api/profil/nom-utilisateur`, { session_token: sessionToken, nouveau_username: nouveauUsername });
}
export function listerNotifications(sessionToken) {
  return fetch(`${GRIND_URL}/api/notifications?session_token=${encodeURIComponent(sessionToken)}`).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || "Notifications indisponibles"); return d; });
}
export function marquerNotificationLue(sessionToken, id) {
  return poster(`${GRIND_URL}/api/notifications/${id}/lue`, { session_token: sessionToken });
}

// ---------- Bibliothèque GRIND : documents partagés ----------
export async function rechercherDocumentsLibrary(sessionToken, q = "", offset = 0, limit = 100) {
  const u = new URL(`${GRIND_URL}/api/library/documents`);
  u.searchParams.set("session_token", sessionToken);
  if (q) u.searchParams.set("q", q);
  u.searchParams.set("offset", String(offset));
  u.searchParams.set("limit", String(limit));
  const r = await fetchApi(u); const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Recherche de documents indisponible.");
  return d;
}
export async function uploaderDocumentLibrary(sessionToken, fichier, titre, description = "") {
  const f = new FormData();
  f.append("session_token", sessionToken);
  f.append("titre", String(titre || "").trim());
  f.append("description", description || "");
  f.append("file", fichier, fichier.name);
  const r = await fetchApi(`${GRIND_URL}/api/library/documents`, { method: "POST", body: f });
  const d = await r.json();
  if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Envoi du document impossible.");
  return d;
}
export function commenterDocumentLibrary(sessionToken, id, contenu) {
  return poster(`${GRIND_URL}/api/library/documents/${id}/commentaires`, { session_token: sessionToken, contenu });
}
export async function listerCommentairesDocumentLibrary(sessionToken, id) {
  const u = new URL(`${GRIND_URL}/api/library/documents/${id}/commentaires`);
  u.searchParams.set("session_token", sessionToken);
  const r = await fetchApi(u); const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Commentaires indisponibles.");
  return d;
}
export async function obtenirDocumentLibrary(sessionToken, id) {
  const u = new URL(`${GRIND_URL}/api/library/documents/${id}`);
  u.searchParams.set("session_token", sessionToken);
  const r = await fetchApi(u); const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Document introuvable.");
  return d;
}
export async function statutBienvenue(sessionToken) {
  const u = new URL(`${GRIND_URL}/api/compte/bienvenue`); u.searchParams.set("session_token", sessionToken);
  const r = await fetchApi(u); const d = await r.json(); if (!r.ok) throw new Error(d.detail || "Accueil indisponible."); return d;
}
export function terminerBienvenue(sessionToken) { return poster(`${GRIND_URL}/api/compte/bienvenue/terminer`, { session_token: sessionToken }); }
export async function verifierAccesPays() {
  const r = await fetchApi(`${GRIND_URL}/api/country-access`); const d = await r.json(); if (!r.ok) throw new Error("Vérification géographique indisponible."); return d;
}
export async function listerPaysBloques(sessionToken) {
  const u = new URL(`${GRIND_URL}/api/admin/countries`); u.searchParams.set("session_token", sessionToken);
  const r = await fetchApi(u); const d = await r.json(); if (!r.ok) throw new Error(d.detail || "Liste indisponible."); return d;
}
export function definirPaysBloque(sessionToken, payload) { return poster(`${GRIND_URL}/api/admin/countries`, { session_token: sessionToken, ...payload }); }
export async function supprimerPaysBloque(sessionToken, code) {
  const u = new URL(`${GRIND_URL}/api/admin/countries/${encodeURIComponent(code)}`); u.searchParams.set("session_token", sessionToken);
  const r = await fetchApi(u, { method: "DELETE" }); const d = await r.json(); if (!r.ok) throw new Error(d.detail || "Suppression impossible."); return d;
}
export async function rechercherMentions(sessionToken, q = "") {
  const u = new URL(`${GRIND_URL}/api/utilisateurs/suggestions`); u.searchParams.set("session_token", sessionToken); u.searchParams.set("q", q);
  const r = await fetchApi(u); const d = await r.json(); if (!r.ok) throw new Error(d.detail || "Recherche de membres indisponible."); return d;
}
export function likerCommentaire(sessionToken, commentaireId) { return poster(`${GRIND_URL}/api/commentaires/${commentaireId}/like`, { session_token: sessionToken }); }
export function modifierPost(sessionToken, postId, contenu) { return poster(`${GRIND_URL}/api/posts/${postId}/modifier`, { session_token: sessionToken, contenu }); }

export function urlFichierDocumentLibrary(sessionToken, id) {
  const u = new URL(`${GRIND_URL}/api/library/documents/${Number(id)}/download`);
  u.searchParams.set("session_token", sessionToken);
  return u.toString();
}

export async function chargerApercuDocumentLibrary(sessionToken, id, signal) {
  const u = new URL(`${GRIND_URL}/api/library/documents/${id}/preview`);
  u.searchParams.set("session_token", sessionToken);
  const r = await fetchApi(u, { signal });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(typeof d.detail === "string" ? d.detail : "Impossible de prévisualiser ce document.");
  }
  return r.blob();
}
