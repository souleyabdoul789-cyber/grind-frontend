import { useState, useEffect } from "react";
import { creerClasse, catalogueScolaire, estGrindEnLigne } from "../api.js";
import ChargementGrind from "./ChargementGrind.jsx";

/**
 * FormulaireClasse — créer une classe.
 * Le niveau et la matière se CHOISISSENT dans le catalogue (cohérents entre eux : pas de philosophie en 6e) ;
 * seul le complément du nom (« Groupe A », « Révisions BEPC »...) est libre, et le serveur le contrôle.
 */
export default function FormulaireClasse({ sessionToken, onCree }) {
  const [catalogue, setCatalogue] = useState(null);
  const [niveauId, setNiveauId] = useState("");
  const [filiere, setFiliere] = useState("");
  const [matiere, setMatiere] = useState("");
  const [complement, setComplement] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  function chargerCatalogue() {
    setErreur(null);
    catalogueScolaire()
      .then(setCatalogue)
      .catch((err) => setErreur(err.message || "Impossible de charger la liste des niveaux."));
  }

  useEffect(() => { chargerCatalogue(); }, []);

  if (!catalogue) {
    return (
      <div className="carte-post formulaire-post">
        {erreur ? <><div className="erreur" role="alert">{erreur}</div><button type="button" onClick={chargerCatalogue}>Réessayer</button></> : <ChargementGrind texte="Chargement du catalogue scolaire..." />}
      </div>
    );
  }

  const niveau = catalogue.niveaux.find((n) => n.id === niveauId) || null;
  const matieres = niveau ? catalogue.matieres_par_niveau[niveau.id] : [];
  const labelNiveau = niveau ? niveau.label + (filiere ? ` ${filiere}` : "") : "";

  async function creer(e) {
    e.preventDefault();
    setErreur(null);
    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour créer une classe." }));
      return;
    }
    if (!niveau) return setErreur("Choisis le niveau de la classe.");
    if (!matiere) return setErreur("Choisis la matière de la classe.");
    setEnvoi(true);
    try {
      await creerClasse(sessionToken, { niveau: labelNiveau, matiere, complement: complement.trim() || null });
      onCree();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <form className="carte-post formulaire-post" onSubmit={creer} noValidate>
      <label><i className="fa-solid fa-graduation-cap"></i> Niveau</label>
      <div className="choix-categorie choix-puces">
        {catalogue.niveaux.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`chip ${niveauId === n.id ? "chip-actif" : ""}`}
            onClick={() => { setNiveauId(n.id); setFiliere(""); setMatiere(""); }}
          >
            {n.label}
          </button>
        ))}
      </div>

      {niveau?.cycle === "lycee" && (
        <>
          <label>Série (facultatif)</label>
          <div className="choix-categorie choix-puces">
            {catalogue.filieres.map((f) => (
              <button key={f} type="button" className={`chip ${filiere === f ? "chip-actif" : ""}`} onClick={() => setFiliere(filiere === f ? "" : f)}>
                {f}
              </button>
            ))}
          </div>
        </>
      )}

      {niveau && (
        <>
          <label><i className="fa-solid fa-book-open"></i> Matière</label>
          <div className="choix-categorie choix-puces">
            {matieres.map((m) => (
              <button key={m} type="button" className={`chip ${matiere === m ? "chip-actif" : ""}`} onClick={() => setMatiere(m)}>
                {m}
              </button>
            ))}
          </div>
        </>
      )}

      <label><i className="fa-solid fa-tag"></i> Complément du nom (facultatif)</label>
      <input
        value={complement}
        onChange={(e) => setComplement(e.target.value)}
        placeholder="ex. Groupe A, Révisions BEPC"
        maxLength={30}
      />

      {matiere && (
        <div className="info champ-aide">
          Nom de la classe : <strong>{matiere} · {labelNiveau}{complement.trim() ? ` — ${complement.trim()}` : ""}</strong>
        </div>
      )}

      <button type="submit" disabled={envoi}>{envoi ? <span className="grind-spinner" aria-label="Création" /> : "Créer"}</button>
      {erreur && <div className="erreur" role="alert"><i className="fa-solid fa-triangle-exclamation"></i>{erreur}</div>}
    </form>
  );
}
