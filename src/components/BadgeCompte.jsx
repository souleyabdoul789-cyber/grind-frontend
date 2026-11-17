import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ROLES_EQUIPE } from "../moderationInfos.js";

const ROLES = {
  admin: {
    icone: "fa-solid fa-crown",
    classe: "badge-admin",
    titre: "Compte officiel GRIND",
    description: "Ce compte est le compte officiel de GRIND. Il représente l’administration centrale de la plateforme et détient les pouvoirs de gestion globaux.",
  },
  associe: {
    icone: ROLES_EQUIPE.associe.icone,
    classe: "badge-associe",
    titre: "Associé GRIND",
    description: ROLES_EQUIPE.associe.description,
  },
  controleur: {
    icone: ROLES_EQUIPE.controleur.icone,
    classe: "badge-controleur",
    titre: "Contrôleur GRIND",
    description: ROLES_EQUIPE.controleur.description,
  },
  annonceur: {
    icone: ROLES_EQUIPE.annonceur.icone,
    classe: "badge-annonceur",
    titre: "Annonceur GRIND",
    description: "Ce compte est un compte officiel GRIND habilité par l’administration à publier des annonces pour la communauté. Cette autorisation ne donne pas accès au bureau d’administration et ne permet pas de définir les annonces importantes ou épinglées.",
  },
  supprimeur: {
    icone: ROLES_EQUIPE.supprimeur.icone,
    classe: "badge-supprimeur",
    titre: "Modérateur de contenus GRIND",
    description: ROLES_EQUIPE.supprimeur.description,
  },
};

function DetailBadge({ detail, icone, classe, onFermer }) {
  useEffect(() => {
    function touche(event) {
      if (event.key === "Escape") onFermer();
    }
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [onFermer]);

  return (
    <div className="badge-detail-voile" role="presentation" onClick={onFermer}>
      <section className="badge-detail-carte" role="dialog" aria-modal="true" aria-labelledby="badge-detail-titre" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="badge-detail-fermer" onClick={onFermer} aria-label="Fermer"><i className="fa-solid fa-xmark" /></button>
        <div className={`badge-detail-embleme ${classe || ""}`}><i className={icone} /></div>
        <span className="badge-detail-surtitre">IDENTITÉ GRIND</span>
        <h2 id="badge-detail-titre">{detail.titre}</h2>
        <p>{detail.description}</p>
        <button type="button" className="badge-detail-valider" onClick={onFermer}>Compris</button>
      </section>
    </div>
  );
}

/** Badge compact et consultable : une activation ouvre l'explication officielle du rôle. */
export default function BadgeCompte({ badge, taille = 14 }) {
  const [detail, setDetail] = useState(null);
  if (!badge) return null;
  const role = badge.role && ROLES[badge.role];
  if (!role && !badge.certifie && !badge.proviseur) return null;

  return (
    <>
    <span className="badges-compte" style={{ fontSize: taille }}>
      {role && (
        <span className={`badge-compte-trigger ${role.classe}`} title={role.titre} aria-label={`En savoir plus : ${role.titre}`} role="button" tabIndex={0} aria-haspopup="dialog" onClick={(event) => { event.stopPropagation(); setDetail({ ...role, classe: role.classe }); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setDetail({ ...role, classe: role.classe }); } }}>
          <i className={`${role.icone} badge-compte`} />
        </span>
      )}
      {badge.proviseur && (
        <span className="badge-compte-trigger badge-proviseur" title="Direction d’établissement autorisée" aria-label="En savoir plus sur le badge de direction" role="button" tabIndex={0} aria-haspopup="dialog" onClick={(event) => { event.stopPropagation(); setDetail({ titre: "Direction d’établissement autorisée", description: "Ce compte représente la direction d’un établissement vérifiée et autorisée par l’administration GRIND. Ses pouvoirs sont limités à son établissement et aux autorisations accordées.", icone: "fa-solid fa-school", classe: "badge-proviseur" }); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setDetail({ titre: "Direction d’établissement autorisée", description: "Ce compte représente la direction d’un établissement vérifiée et autorisée par l’administration GRIND. Ses pouvoirs sont limités à son établissement et aux autorisations accordées.", icone: "fa-solid fa-school", classe: "badge-proviseur" }); } }}>
          <i className="fa-solid fa-school badge-compte" />
        </span>
      )}
      {badge.certifie && (
        <span className="badge-compte-trigger badge-certifie" title="Compte certifié" aria-label="En savoir plus sur la certification" role="button" tabIndex={0} aria-haspopup="dialog" onClick={(event) => { event.stopPropagation(); setDetail({ titre: "Compte certifié", description: "Ce compte a reçu le badge de certification GRIND. La certification est accordée par l’équipe selon les règles de la plateforme.", icone: "fa-solid fa-circle-check", classe: "badge-certifie" }); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setDetail({ titre: "Compte certifié", description: "Ce compte a reçu le badge de certification GRIND. La certification est accordée par l’équipe selon les règles de la plateforme.", icone: "fa-solid fa-circle-check", classe: "badge-certifie" }); } }}>
          <i className="fa-solid fa-circle-check badge-compte" />
        </span>
      )}
    </span>
    {detail && typeof document !== "undefined" && createPortal(
      <DetailBadge detail={detail} icone={detail.icone} classe={detail.classe} onFermer={() => setDetail(null)} />,
      document.body,
    )}
    </>
  );
}
