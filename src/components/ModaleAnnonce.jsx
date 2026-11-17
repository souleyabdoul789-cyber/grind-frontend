import { useEffect } from "react";
import BadgeCompte from "./BadgeCompte.jsx";
import LecteurMedia from "./LecteurMedia.jsx";
import { formaterDate } from "../moderationInfos.js";

function libelleAuteur(role) {
  if (role === "annonceur") return "Annonceur habilité par l’administration GRIND";
  if (role === "associe") return "Associé de l’administration GRIND";
  return "Communication de l’administration officielle GRIND";
}

/** Fenêtre de lecture des communications GRIND, adaptée aux écrans mobiles. */
export default function ModaleAnnonce({ annonce, onFermer, onMasquer }) {
  useEffect(() => {
    function fermerAvecEchap(event) {
      if (event.key === "Escape") onFermer();
    }
    window.addEventListener("keydown", fermerAvecEchap);
    return () => window.removeEventListener("keydown", fermerAvecEchap);
  }, [onFermer]);

  return (
    <div className="annonce-modal-voile" role="presentation" onClick={onFermer}>
      <section
        className={`annonce-modal-carte ${annonce.important ? "annonce-modal-importante" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="grind-annonce-modal-titre"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="annonce-modal-header">
          <div className="annonce-modal-identite">
            <span className="grind-annonce-brand" aria-label="GRIND, identité de la plateforme">
              <span className="grind-annonce-brand-g" aria-hidden="true">G</span>
              <strong>GRIND</strong>
              <i className="fa-solid fa-check" aria-hidden="true" />
            </span>
            <span className="annonce-modal-header-copy">
              <strong>Communication officielle</strong>
              <small>Information de la plateforme</small>
            </span>
          </div>
          <button type="button" className="annonce-modal-fermer" onClick={onFermer} aria-label="Fermer l'annonce">
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        <div className="annonce-modal-auteur-ligne">
          <span className="annonce-modal-auteur-icone"><i className="fa-solid fa-bullhorn" /></span>
          <span className="annonce-modal-auteur-texte">
            <strong>{annonce.auteur || "GRIND"}</strong>
            <small>{libelleAuteur(annonce.role)}</small>
          </span>
          <BadgeCompte badge={{ role: annonce.role || "admin" }} taille={15} />
          <time>{formaterDate(annonce.created_at)}</time>
        </div>

        <div className="annonce-modal-contenu">
          <div className="annonce-modal-etiquettes">
            {annonce.important && <span className="annonce-modal-important"><i className="fa-solid fa-circle-exclamation" /> Information importante</span>}
            {annonce.epinglee && <span className="annonce-modal-epinglee"><i className="fa-solid fa-thumbtack" /> Annonce épinglée</span>}
          </div>
          <h2 id="grind-annonce-modal-titre">{annonce.titre}</h2>
          {annonce.media_url && <div className="annonce-modal-media"><LecteurMedia url={annonce.media_url} type={annonce.media_type} /></div>}
          {!!annonce.contenu && <p className="annonce-modal-texte">{annonce.contenu}</p>}
          {annonce.document_url && (
            <a className="piece-jointe-document annonce-modal-document" href={annonce.document_url} target="_blank" rel="noopener noreferrer" download>
              <span className="icone-document"><i className="fa-solid fa-file-lines" /></span>
              <span><strong>{annonce.document_name || "Document officiel"}</strong><small>{annonce.document_type === "application/pdf" ? "PDF" : "DOCX"} · Ouvrir ou télécharger</small></span>
              <i className="fa-solid fa-download" />
            </a>
          )}
        </div>

        <footer className="annonce-modal-footer">
          {!annonce.important && onMasquer && <button type="button" className="annonce-modal-secondary" onClick={() => onMasquer(annonce.id)}>Masquer cette annonce</button>}
          <button type="button" className="annonce-modal-primary" onClick={onFermer}>Fermer</button>
        </footer>
      </section>
    </div>
  );
}
