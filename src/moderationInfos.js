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
  admin: { label: "Administrateur", icone: "fa-solid fa-crown" },
  associe: { label: "Associé", icone: "fa-solid fa-star" },
  controleur: { label: "Contrôleur", icone: "fa-solid fa-shield-halved" },
};

export function libelleRole(role) {
  return ROLES_EQUIPE[role]?.label || "";
}

// Un contrôleur ne suspend que brièvement ; le serveur applique la même règle.
export const SUSPENSION_COURTE_MAX_JOURS = 7;
