import { useState, useEffect } from "react";
import { creerClasse, rejoindreClasse, listerMesClasses, renommerClasse, supprimerClasse, extraireCode } from "../api.js";
import SalleClasse from "../components/SalleClasse.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import EtatVide from "../components/EtatVide.jsx";

export default function Classes({ sessionToken, monUsername, codeAttente, onCodeConsomme }) {
  const [classes, setClasses] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [salleActive, setSalleActive] = useState(null); // classe_id ou null

  const [formulaireOuvert, setFormulaireOuvert] = useState(codeAttente ? "rejoindre" : null);
  const [nomClasse, setNomClasse] = useState("");
  const [codeInvitation, setCodeInvitation] = useState(codeAttente || "");
  const [erreur, setErreur] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [lienCopie, setLienCopie] = useState(null);

  const [classeEnEdition, setClasseEnEdition] = useState(null);
  const [nomEdition, setNomEdition] = useState("");
  const [classeASupprimer, setClasseASupprimer] = useState(null);

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
      await rejoindreClasse(sessionToken, extraireCode(codeInvitation));
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
    navigator.clipboard.writeText(code);
    setLienCopie(code);
    setTimeout(() => setLienCopie(null), 2000);
  }

  function commencerEdition(c) {
    setClasseEnEdition(c.classe_id);
    setNomEdition(c.nom);
  }

  async function validerRenommage(classeId) {
    if (!nomEdition.trim()) return;
    try {
      await renommerClasse(sessionToken, classeId, nomEdition.trim());
      setClasses((prev) => prev.map((c) => (c.classe_id === classeId ? { ...c, nom: nomEdition.trim() } : c)));
      setClasseEnEdition(null);
    } catch (err) {
      setErreur(err.message);
    }
  }

  function gererSuppression(classeId) {
    setClasseASupprimer(classeId);
  }

  async function confirmerSuppression() {
    const classeId = classeASupprimer;
    setClasseASupprimer(null);
    try {
      await supprimerClasse(sessionToken, classeId);
      setClasses((prev) => prev.filter((c) => c.classe_id !== classeId));
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (salleActive) {
    const classeOuverte = classes.find((c) => c.classe_id === salleActive);
    return (
      <div className="fil-actu">
        <div className="sous-titre" style={{ marginBottom: 12 }}>
          <i className="fa-solid fa-chalkboard"></i> {classeOuverte?.nom}
        </div>
        <SalleClasse
          sessionToken={sessionToken}
          demandeId={salleActive}
          monUsername={monUsername}
          onQuitter={() => setSalleActive(null)}
        />
      </div>
    );
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
          <input
            value={codeInvitation}
            onChange={(e) => setCodeInvitation(e.target.value)}
            placeholder="colle juste le code (pas besoin du lien entier)"
            required
          />
          <button type="submit" disabled={envoiEnCours}>{envoiEnCours ? "..." : "Rejoindre"}</button>
          {erreur && <div className="erreur"><i className="fa-solid fa-triangle-exclamation"></i>{erreur}</div>}
        </form>
      )}

      {chargement ? (
        <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>
      ) : classes.length === 0 ? (
        <EtatVide texte="Aucune classe pour l'instant" />
      ) : (
        classes.map((c) => (
          <div key={c.classe_id} className="carte-post carte-classe">
            <div className="entete-post">
              <div className="avatar-mini"><i className="fa-solid fa-chalkboard-user"></i></div>
              <div style={{ flex: 1 }}>
                {classeEnEdition === c.classe_id ? (
                  <div className="edition-nom-classe">
                    <input
                      value={nomEdition}
                      onChange={(e) => setNomEdition(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && validerRenommage(c.classe_id)}
                      autoFocus
                    />
                    <button type="button" onClick={() => validerRenommage(c.classe_id)}><i className="fa-solid fa-check"></i></button>
                    <button type="button" className="bouton-retour" onClick={() => setClasseEnEdition(null)}><i className="fa-solid fa-xmark"></i></button>
                  </div>
                ) : (
                  <div className="auteur-post">{c.nom}</div>
                )}
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

            {c.role === "prof" && classeEnEdition !== c.classe_id && (
              <>
                <button className="action-post" onClick={() => copierLien(c.code_invitation)} type="button">
                  <i className={lienCopie === c.code_invitation ? "fa-solid fa-check" : "fa-solid fa-link"}></i>
                  {lienCopie === c.code_invitation ? "Code copié" : "Copier le code d'invitation"}
                </button>
                <button className="action-post" onClick={() => commencerEdition(c)} type="button">
                  <i className="fa-solid fa-pen"></i> Renommer
                </button>
                <button className="action-post action-danger" onClick={() => gererSuppression(c.classe_id)} type="button">
                  <i className="fa-solid fa-trash"></i> Supprimer la classe
                </button>
              </>
            )}

            <button className="action-post" onClick={() => setSalleActive(c.classe_id)} type="button">
              <i className="fa-solid fa-phone"></i> Entrer dans la classe
            </button>
          </div>
        ))
      )}
      {classeASupprimer && (
        <ConfirmModal
          message="Supprimer définitivement cette classe ? Tous ses membres seront retirés."
          onConfirmer={confirmerSuppression}
          onAnnuler={() => setClasseASupprimer(null)}
        />
      )}
    </div>
  );
}
