import { useState } from "react";
import { DOCUMENTS, CGU_VERSION } from "../cguContenu.js";

/**
 * PageCgu — les conditions d'utilisation ET la politique de confidentialité, en plein écran.
 * Deux onglets, une seule colonne centrée : lisible aussi bien sur téléphone que sur ordinateur.
 */
export default function PageCgu({ onFermer, ongletInitial = "cgu" }) {
  const [cle, setCle] = useState(ongletInitial);
  const document_ = DOCUMENTS.find((d) => d.cle === cle) || DOCUMENTS[0];

  return (
    <div className="voile-page" onClick={onFermer}>
      <div className="page-cgu" onClick={(e) => e.stopPropagation()}>
        <div className="entete-page-cgu">
          <div className="sous-titre" style={{ margin: 0 }}>
            <i className="fa-solid fa-file-contract"></i> {document_.titre}
          </div>
          <button type="button" className="bouton-admin bouton-admin-doux" onClick={onFermer}>
            <i className="fa-solid fa-xmark"></i> Fermer
          </button>
        </div>

        <div className="choix-categorie" style={{ margin: "10px 0 6px" }}>
          {DOCUMENTS.map((d) => (
            <button key={d.cle} type="button" className={`chip ${cle === d.cle ? "chip-actif" : ""}`} onClick={() => setCle(d.cle)}>
              {d.cle === "cgu" ? "Conditions d'utilisation" : "Confidentialité"}
            </button>
          ))}
        </div>
        <div className="info" style={{ marginBottom: 12 }}>Version du {CGU_VERSION}</div>
        <p className="texte-cgu-intro">{document_.intro}</p>

        {document_.articles.map((a) => (
          <section key={a.titre} className="section-cgu">
            <h3>{a.titre}</h3>
            <p>{a.texte}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
