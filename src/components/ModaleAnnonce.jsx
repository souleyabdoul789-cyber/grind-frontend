import BadgeCompte from "./BadgeCompte.jsx";
import LecteurMedia from "./LecteurMedia.jsx";
import { formaterDate } from "../moderationInfos.js";

/** Annonce officielle : priorité conservée jusqu'à suppression par l'administration. */
export default function ModaleAnnonce({ annonce, onFermer, onMasquer }) {
  return (
    <div className="voile-modal" onClick={onFermer} style={{ zIndex: 450 }}>
      <div className={`carte-modal carte-modal-large modal-annonce-officielle ${annonce.important ? "annonce-importante" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="annonce-entete">
          <i className="fa-solid fa-bullhorn" style={{ color: "#f5d485" }}></i>
          <span>Annoncé par <strong>{annonce.auteur}</strong> <BadgeCompte badge={{ role: annonce.role || "admin" }} taille={13} /></span>
          <span style={{ marginLeft: "auto" }}>{formaterDate(annonce.created_at)}</span>
        </div>
        <div className="priorite-annonce">
          {annonce.epinglee && <span><i className="fa-solid fa-thumbtack"></i> Épinglée</span>}
          {annonce.important && <span className="annonce-importance"><i className="fa-solid fa-circle-exclamation"></i> Information importante</span>}
        </div>
        <h3 className="annonce-titre">{annonce.titre}</h3>
        {annonce.media_url && <LecteurMedia url={annonce.media_url} type={annonce.media_type} />}
        {!!annonce.contenu && <p className="annonce-texte">{annonce.contenu}</p>}
        {annonce.document_url && <a className="piece-jointe-document" href={annonce.document_url} target="_blank" rel="noopener noreferrer"><span className="icone-document"><i className="fa-solid fa-file-lines"></i></span><span><strong>{annonce.document_name || "Document officiel"}</strong><small>{annonce.document_type === "application/pdf" ? "PDF" : "DOCX"} · Ouvrir ou télécharger</small></span><i className="fa-solid fa-download" /></a>}
        <div className="actions-annonce-modal">
          {!annonce.important && onMasquer && <button type="button" className="bouton-retour" onClick={() => onMasquer(annonce.id)}>Masquer cette annonce</button>}
          <button type="button" onClick={onFermer}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
