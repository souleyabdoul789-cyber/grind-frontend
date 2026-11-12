// GRIND_URL = seul serveur que le frontend appelle directement.
// Les comptes sont autonomes : aucune clé G-SOCIETY n'est demandée à l'inscription.
export const GRIND_URL = import.meta.env.VITE_GRIND_URL || "https://grind-4vsz.onrender.com";

async function fetchApi(url, options) {
  try {
    return await fetch(url, options);
  } catch (cause) {
    const erreur = new Error(
      "Impossible de joindre le serveur GRIND. Vérifie la connexion, l'URL VITE_GRIND_URL sur le frontend et l'origine autorisée dans GRIND_FRONTEND_ORIGINS sur Render."
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
    if (detail && typeof detail === "object" && !Array.isArray(detail)) erreur.donnees = detail;
    throw erreur;
  }
  return data;
}

// ---------- Compte GRIND (propre à GRIND, distinct de G-SOCIETY) ----------

export function inscrireGrind(username, email, password, cguAcceptees) {
  return poster(`${GRIND_URL}/api/compte/signup`, {
    username,
    email,
    password,
    cgu_acceptees: !!cguAcceptees,
  });
}

export function connecterGrind(username, password) {
  return poster(`${GRIND_URL}/api/compte/login`, { username, password });
}

export function connecterGoogle(credential, username = null, cguAcceptees = false) {
  return poster(`${GRIND_URL}/api/compte/google`, { credential, username, cgu_acceptees: !!cguAcceptees });
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

// ---------- Fil d'actu ----------

export async function listerPosts(categorie, sessionToken) {
  const url = new URL(`${GRIND_URL}/api/posts`);
  if (categorie) url.searchParams.set("categorie", categorie);
  if (sessionToken) url.searchParams.set("session_token", sessionToken);
  const res = await fetch(url);
  return res.json();
}

export function creerPost(sessionToken, { categorie, contenu, date_limite, media_url, media_type, document_url, document_name, document_type, etablissement_id }) {
  return poster(`${GRIND_URL}/api/posts`, {
    session_token: sessionToken, categorie, contenu, date_limite,
    media_url, media_type, document_url, document_name, document_type, etablissement_id,
  });
}

// ---------- Média (upload direct vers Cloudinary) ----------

export async function uploaderMedia(sessionToken, fichier, decoupeVideo) {
  if (!fichier) throw new Error("Choisis un média avant de publier.");
  if (fichier.size > 25 * 1024 * 1024) throw new Error("Le média ne doit pas dépasser 25 Mo.");
  const formulaire = new FormData();
  formulaire.append("session_token", sessionToken);
  formulaire.append("file", fichier, fichier.name || "media");
  if (decoupeVideo?.debut !== undefined && decoupeVideo?.fin !== undefined) {
    formulaire.append("debut_video", String(decoupeVideo.debut));
    formulaire.append("fin_video", String(decoupeVideo.fin));
  }
  const res = await fetch(`${GRIND_URL}/api/media/upload`, { method: "POST", body: formulaire });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Échec de l'envoi du média.");
  return data;
}

export async function uploaderDocument(sessionToken, fichier) {
  const formats = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const extension = String(fichier?.name || "").split(".").pop().toLowerCase();
  const typeOk = formats.includes(fichier?.type) ||
    (extension === "pdf" && (!fichier.type || fichier.type === "application/octet-stream")) ||
    (extension === "docx" && (!fichier.type || fichier.type === "application/octet-stream"));
  if (!fichier || !typeOk) throw new Error("Seuls les documents PDF et DOCX sont acceptés.");
  if (fichier.size <= 0 || fichier.size > 15 * 1024 * 1024) throw new Error("Le document doit être non vide et ne pas dépasser 15 Mo.");
  const formulaire = new FormData();
  formulaire.append("session_token", sessionToken);
  formulaire.append("file", fichier, fichier.name || "document");
  const res = await fetch(`${GRIND_URL}/api/media/document`, { method: "POST", body: formulaire });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Échec de l'envoi du document.");
  return data;
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

export function ajouterCommentaire(sessionToken, postId, contenu) {
  return poster(`${GRIND_URL}/api/posts/${postId}/commentaires`, {
    session_token: sessionToken,
    contenu,
  });
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

export function creerClasse(sessionToken, { niveau, matiere, complement }) {
  return poster(`${GRIND_URL}/api/classes`, {
    session_token: sessionToken,
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
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Impossible de charger les classes.");
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

export function deconnecterGrind(sessionToken) {
  return poster(`${GRIND_URL}/api/compte/deconnexion`, { session_token: sessionToken });
}

let _catalogue = null;
export async function catalogueScolaire() {
  if (_catalogue) return _catalogue;
  const res = await fetchApi(`${GRIND_URL}/api/scolaire/catalogue`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Le catalogue scolaire est temporairement indisponible.");
  if (!Array.isArray(data.niveaux) || !data.matieres_par_niveau) {
    throw new Error("Le serveur a répondu, mais le catalogue scolaire est incomplet. Vérifie la version du backend déployée.");
  }
  _catalogue = data;
  return _catalogue;
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
