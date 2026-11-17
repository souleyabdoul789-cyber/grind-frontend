// Informations partagées entre le signalement (élèves) et l'administration.

export const MOTIFS = [
  { cle: "inapproprie", label: "Contenu inapproprié", icone: "fa-solid fa-ban" },
  { cle: "harcelement", label: "Harcèlement", icone: "fa-solid fa-user-slash" },
  { cle: "spam", label: "Spam ou publicité", icone: "fa-solid fa-envelope-open-text" },
  { cle: "danger", label: "Danger ou élève en difficulté", icone: "fa-solid fa-triangle-exclamation" },
  { cle: "autre", label: "Autre", icone: "fa-solid fa-ellipsis" },
];

export function libelleMotif(cle) {
  return MOTIFS.find((m) => m.cle === cle)?.label || cle;
}

export const DUREES_SUSPENSION = [1, 3, 7, 30];

export const TYPES_CIBLE = {
  post: { label: "Post", icone: "fa-solid fa-newspaper" },
  commentaire: { label: "Commentaire", icone: "fa-regular fa-comment" },
  profil: { label: "Profil", icone: "fa-solid fa-user" },
};

export function libelleDecision(decision) {
  if (!decision) return "";
  const parties = decision.split("+");
  const noms = {
    ignorer: "Ignoré",
    supprimer: "Contenu supprimé",
    suspendre: "Compte suspendu",
    bannir: "Compte banni",
    suppression: "contenu supprimé",
  };
  return parties.map((p) => noms[p] || p).join(" + ");
}

export function formaterDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export const ROLES_EQUIPE = {
  admin: { label: "Administration officielle", icone: "fa-solid fa-crown", description: "Compte officiel de GRIND. Il représente l’administration centrale et supervise l’ensemble des services de la plateforme." },
  associe: { label: "Associé", icone: "fa-solid fa-star", description: "Membre de l’équipe de direction GRIND, habilité à superviser la modération, les sanctions et la certification." },
  controleur: { label: "Contrôleur", icone: "fa-solid fa-shield-halved", description: "Membre de l’équipe de modération. Il examine les signalements et peut appliquer les mesures de courte durée prévues par son rôle." },
  annonceur: { label: "Annonceur", icone: "fa-solid fa-bullhorn", description: "Collaborateur autorisé par l’administration GRIND à publier des annonces destinées à la communauté. Les annonces importantes et épinglées restent réservées à l’administrateur." },
  supprimeur: { label: "Modérateur de contenus", icone: "fa-solid fa-trash-can", description: "Collaborateur chargé du retrait ciblé de publications, commentaires et classes appartenant à des comptes déjà sanctionnés. Il ne peut pas sanctionner ni supprimer un compte." },
};

export function libelleRole(role) {
  return ROLES_EQUIPE[role]?.label || "";
}

// Un contrôleur ne suspend que brièvement ; le serveur applique la même règle.
export const SUSPENSION_COURTE_MAX_JOURS = 7;
