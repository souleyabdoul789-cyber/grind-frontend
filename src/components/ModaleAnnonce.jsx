import BadgeCompte from "./BadgeCompte.jsx";
import { formaterDate } from "../moderationInfos.js";

/** ModaleAnnonce — l'annonce officielle de l'administrateur, ouverte depuis la cloche. */
export default function ModaleAnnonce({ annonce, onFermer }) {
  return (
    <div className="voile-modal" onClick={onFermer} style={{ zIndex: 450 }}>
      <div className="carte-modal carte-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="annonce-entete">
          <i className="fa-solid fa-bullhorn" style={{ color: "#f5d485" }}></i>
          <span>
            Annonce de <strong>{annonce.auteur}</strong>
            <BadgeCompte badge={{ role: annonce.role || "admin" }} taille={13} />
          </span>
          <span style={{ marginLeft: "auto" }}>{formaterDate(annonce.created_at)}</span>
        </div>
        <h3 className="annonce-titre">{annonce.titre}</h3>
        <p className="annonce-texte">{annonce.contenu}</p>
        <button type="button" onClick={onFermer}>Fermer</button>
      </div>
    </div>
  );
}
