// GRIND_URL = seul serveur que le frontend appelle directement.
// Pluton (G-SOCIETY) n'est plus contacté ici : la clé G-SOCIETY est
// collée manuellement par l'utilisateur au moment de l'inscription
// GRIND, GRIND se charge lui-même de la vérifier auprès de Pluton
// côté serveur.
export const GRIND_URL = import.meta.env.VITE_GRIND_URL || "https://grind-4vsz.onrender.com";

async function poster(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Une erreur est survenue");
  }
  return data;
}

// ---------- Compte GRIND (propre à GRIND, distinct de G-SOCIETY) ----------

export function inscrireGrind(username, password, apiKeyGSociety) {
  return poster(`${GRIND_URL}/api/compte/signup`, {
    username,
    password,
    api_key: apiKeyGSociety,
  });
}

export function connecterGrind(username, password) {
  return poster(`${GRIND_URL}/api/compte/login`, { username, password });
}

// ---------- Profil GRIND (questionnaire) ----------

export function enregistrerProfil(sessionToken, { age, pays, niveau, difficultes }) {
  return poster(`${GRIND_URL}/api/profil`, {
    session_token: sessionToken,
    age,
    pays,
    niveau,
    difficultes,
  });
}

// ---------- Fil d'actu ----------

export async function listerPosts(categorie) {
  const url = new URL(`${GRIND_URL}/api/posts`);
  if (categorie) url.searchParams.set("categorie", categorie);
  const res = await fetch(url);
  return res.json();
}

export function creerPost(sessionToken, { categorie, contenu, date_limite, media_url, media_type }) {
  return poster(`${GRIND_URL}/api/posts`, {
    session_token: sessionToken,
    categorie,
    contenu,
    date_limite,
    media_url,
    media_type,
  });
}

// ---------- Média (upload direct vers Cloudinary) ----------

export async function uploaderMedia(sessionToken, fichier, decoupeVideo) {
  const sigRes = await fetch(`${GRIND_URL}/api/media/signature-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_token: sessionToken,
      debut_video: decoupeVideo?.debut,
      fin_video: decoupeVideo?.fin,
    }),
  });
  const sig = await sigRes.json();
  if (!sigRes.ok) throw new Error(sig.detail || "Impossible de préparer l'upload");

  if (fichier.size > sig.poids_max_mo * 1024 * 1024) {
    throw new Error(`Fichier trop lourd (max ${sig.poids_max_mo} Mo)`);
  }

  const estVideo = fichier.type.startsWith("video/");
  const formData = new FormData();
  formData.append("file", fichier, fichier.name || (estVideo ? "video.mp4" : "photo.jpg"));
  formData.append("api_key", sig.api_key);
  formData.append("timestamp", sig.timestamp);
  formData.append("signature", sig.signature);
  formData.append("folder", sig.folder);
  formData.append("eager", sig.eager);

  const urlCloudinary = `https://api.cloudinary.com/v1_1/${sig.cloud_name}/${estVideo ? "video" : "image"}/upload`;
  const uploadRes = await fetch(urlCloudinary, { method: "POST", body: formData });
  const resultat = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(resultat.error?.message || "Échec de l'upload");

  // resultat.secure_url = fichier original brut, sans watermark.
  // resultat.eager[0].secure_url = version transformée (compressée +
  // watermark incrusté) — c'est celle-là qu'on veut afficher.
  const urlFinale = resultat.eager?.[0]?.secure_url || resultat.secure_url;

  return { media_url: urlFinale, media_type: estVideo ? "video" : "image" };
}

export function togglerLike(sessionToken, postId) {
  return poster(`${GRIND_URL}/api/posts/${postId}/like`, { session_token: sessionToken });
}

export async function listerCommentaires(postId) {
  const res = await fetch(`${GRIND_URL}/api/posts/${postId}/commentaires`);
  return res.json();
}

export function ajouterCommentaire(sessionToken, postId, contenu) {
  return poster(`${GRIND_URL}/api/posts/${postId}/commentaires`, {
    session_token: sessionToken,
    contenu,
  });
}

export function resoudrePost(sessionToken, postId) {
  return poster(`${GRIND_URL}/api/posts/${postId}/resoudre`, { session_token: sessionToken });
}

// ---------- Classes ----------

export function creerClasse(sessionToken, nom) {
  return poster(`${GRIND_URL}/api/classes`, { session_token: sessionToken, nom });
}

export function rejoindreClasse(sessionToken, codeInvitation) {
  return poster(`${GRIND_URL}/api/classes/rejoindre`, { session_token: sessionToken, code_invitation: codeInvitation });
}

export async function listerMesClasses(sessionToken) {
  const res = await fetch(`${GRIND_URL}/api/classes/mes-classes?session_token=${encodeURIComponent(sessionToken)}`);
  return res.json();
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

export function urlSession(sessionToken, demandeId) {
  const base = GRIND_URL.replace(/^https/, "wss").replace(/^http/, "ws");
  return `${base}/ws/session/${demandeId}?session_token=${encodeURIComponent(sessionToken)}`;
}

// ---------- Notifications temps réel ----------

export function urlNotifs(sessionToken) {
  const base = GRIND_URL.replace(/^https/, "wss").replace(/^http/, "ws");
  return `${base}/ws/notifs?session_token=${encodeURIComponent(sessionToken)}`;
}
