const ROLES = {
  admin: { icone: "fa-solid fa-crown", classe: "badge-admin", titre: "Administrateur GRIND" },
  associe: { icone: "fa-solid fa-star", classe: "badge-associe", titre: "Associé GRIND" },
  controleur: { icone: "fa-solid fa-shield-halved", classe: "badge-controleur", titre: "Contrôleur GRIND" },
};

/**
 * BadgeCompte — les pastilles à côté d'un pseudo.
 *  - certifié   : coche aux couleurs de GRIND (le « badge bleu », mais à notre couleur)
 *  - admin / associé / contrôleur : trois badges DIFFÉRENTS, pour qu'on ne confonde jamais
 *    l'administrateur avec son équipe.
 * badge = { role: "admin" | "associe" | "controleur" | null, certifie: bool }
 */
export default function BadgeCompte({ badge, taille = 14 }) {
  if (!badge) return null;
  const role = badge.role && ROLES[badge.role];
  if (!role && !badge.certifie) return null;

  return (
    <span className="badges-compte" style={{ fontSize: taille }}>
      {role && <i className={`${role.icone} badge-compte ${role.classe}`} title={role.titre} aria-label={role.titre}></i>}
      {badge.certifie && (
        <i className="fa-solid fa-circle-check badge-compte badge-certifie" title="Compte certifié" aria-label="Compte certifié"></i>
      )}
    </span>
  );
}
