import { useState, useEffect } from "react";
import { creerClasse, rejoindreClasse, listerMesClasses, GRIND_URL } from "../api.js";

export default function Classes({ sessionToken, codeAttente, onCodeConsomme }) {
  const [classes, setClasses] = useState([]);
  const [chargement, setChargement] = useState(true);

  const [formulaireOuvert, setFormulaireOuvert] = useState(codeAttente ? "rejoindre" : null);
  const [nomClasse, setNomClasse] = useState("");
  const [codeInvitation, setCodeInvitation] = useState(codeAttente || "");
  const [erreur, setErreur] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [lienCopie, setLienCopie] = useState(null);

  async function charger() {
    setChargement(true);
    const res = await listerMesClasses(sessionToken);
    setClasses(res.classes || []);
    setChargement(false);
  }

  useEffect(() => {
    charger();
  }, []);

  async function gererCreation(e) {
    e.preventDefault();
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      await creerClasse(sessionToken, nomClasse);
      setNomClasse("");
      setFormulaireOuvert(null);
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function gererAdhesion(e) {
    e.preventDefault();
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      await rejoindreClasse(sessionToken, codeInvitation.trim());
      setCodeInvitation("");
      setFormulaireOuvert(null);
      if (onCodeConsomme) onCodeConsomme();
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function copierLien(code) {
    const lien = `${window.location.origin}/rejoindre/${code}`;
    navigator.clipboard.writeText(lien);
    setLienCopie(code);
    setTimeout(() => setLienCopie(null), 2000);
  }

  return (
    <div className="fil-actu">
      <div className="choix-categorie" style={{ marginBottom: 16 }}>
        <button
          className={formulaireOuvert === "creer" ? "chip chip-actif" : "chip"}
          onClick={() => setFormulaireOuvert(formulaireOuvert === "creer" ? null : "creer")}
          type="button"
        >
          <i className="fa-solid fa-plus"></i> Créer une classe
        </button>
        <button
          className={formulaireOuvert === "rejoindre" ? "chip chip-actif" : "chip"}
          onClick={() => setFormulaireOuvert(formulaireOuvert === "rejoindre" ? null : "rejoindre")}
          type="button"
        >
          <i className="fa-solid fa-right-to-bracket"></i> Rejoindre
        </button>
      </div>

      {formulaireOuvert === "creer" && (
        <form className="carte-post formulaire-post" onSubmit={gererCreation}>
          <label><i className="fa-solid fa-chalkboard"></i> Nom de la classe</label>
          <input value={nomClasse} onChange={(e) => setNomClasse(e.target.value)} placeholder="ex: Maths Terminale - groupe de Fatima" required />
          <button type="submit" disabled={envoiEnCours}>{envoiEnCours ? "..." : "Créer"}</button>
          {erreur && <div className="erreur"><i className="fa-solid fa-triangle-exclamation"></i>{erreur}</div>}
        </form>
      )}

      {formulaireOuvert === "rejoindre" && (
        <form className="carte-post formulaire-post" onSubmit={gererAdhesion}>
          <label><i className="fa-solid fa-key"></i> Code d'invitation</label>
          <input value={codeInvitation} onChange={(e) => setCodeInvitation(e.target.value)} placeholder="collé depuis le lien reçu" required />
          <button type="submit" disabled={envoiEnCours}>{envoiEnCours ? "..." : "Rejoindre"}</button>
          {erreur && <div className="erreur"><i className="fa-solid fa-triangle-exclamation"></i>{erreur}</div>}
        </form>
      )}

      {chargement ? (
        <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>
      ) : classes.length === 0 ? (
        <div className="info"><i className="fa-solid fa-chalkboard"></i> Aucune classe pour l'instant.</div>
      ) : (
        classes.map((c) => (
          <div key={c.classe_id} className="carte-post carte-classe">
            <div className="entete-post">
              <div className="avatar-mini"><i className="fa-solid fa-chalkboard-user"></i></div>
              <div>
                <div className="auteur-post">{c.nom}</div>
                <div className="badge-categorie demonstration">
                  <i className="fa-solid fa-users"></i> {c.nb_membres} {c.nb_membres > 1 ? "membres" : "membre"}
                </div>
              </div>
              {c.role === "prof" && (
                <div className="badge-statut statut-ouverte">
                  <i className="fa-solid fa-star"></i> Créateur
                </div>
              )}
            </div>

            {c.role === "prof" && (
              <button className="action-post" onClick={() => copierLien(c.code_invitation)} type="button">
                <i className={lienCopie === c.code_invitation ? "fa-solid fa-check" : "fa-solid fa-link"}></i>
                {lienCopie === c.code_invitation ? "Lien copié" : "Copier le lien d'invitation"}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
