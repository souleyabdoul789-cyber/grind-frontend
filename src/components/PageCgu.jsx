import { CGU_SECTIONS, CGU_VERSION } from "../cguContenu.js";

/**
 * PageCgu — les conditions d'utilisation, en plein écran.
 * Une seule colonne centrée : lisible aussi bien sur téléphone que sur ordinateur.
 */
export default function PageCgu({ onFermer }) {
  return (
    <div className="voile-page" onClick={onFermer}>
      <div className="page-cgu" onClick={(e) => e.stopPropagation()}>
        <div className="entete-page-cgu">
          <div className="sous-titre" style={{ margin: 0 }}>
            <i className="fa-solid fa-file-contract"></i> Conditions d'utilisation
          </div>
          <button type="button" className="bouton-admin bouton-admin-doux" onClick={onFermer}>
            <i className="fa-solid fa-xmark"></i> Fermer
          </button>
        </div>
        <div className="info" style={{ marginBottom: 16 }}>Version du {CGU_VERSION}</div>

        {CGU_SECTIONS.map((s) => (
          <section key={s.titre} className="section-cgu">
            <h3>{s.titre}</h3>
            <p>{s.texte}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
