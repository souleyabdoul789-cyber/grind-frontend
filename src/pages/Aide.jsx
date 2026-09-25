import { useState, useEffect } from "react";
import { demanderAide, listerDemandesOuvertes, accepterDemande } from "../api.js";
import SalleAudio from "../components/SalleAudio.jsx";

export default function Aide({ sessionToken, monUsername }) {
  const [demandes, setDemandes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [sujet, setSujet] = useState("");
  const [description, setDescription] = useState("");
  const [erreur, setErreur] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [salleActive, setSalleActive] = useState(null); // demande_id ou null

  async function charger() {
    setChargement(true);
    const res = await listerDemandesOuvertes();
    setDemandes(res.demandes || []);
    setChargement(false);
  }

  useEffect(() => {
    charger();
  }, []);

  async function gererDemande(e) {
    e.preventDefault();
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      const res = await demanderAide(sessionToken, sujet, description);
      setSujet("");
      setDescription("");
      setFormulaireOuvert(false);
      // Le demandeur entre directement dans sa propre salle, en attente.
      setSalleActive(res.demande_id);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function rejoindre(demandeId) {
    setErreur(null);
    try {
      await accepterDemande(sessionToken, demandeId);
      setSalleActive(demandeId);
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (salleActive) {
    return (
      <div className="fil-actu">
        <SalleAudio
          sessionToken={sessionToken}
          demandeId={salleActive}
          monUsername={monUsername}
          onQuitter={() => {
            setSalleActive(null);
            charger();
          }}
        />
      </div>
    );
  }

  return (
    <div className="fil-actu">
      <div className="choix-categorie" style={{ marginBottom: 16 }}>
        <button
          className={formulaireOuvert ? "chip chip-actif" : "chip"}
          onClick={() => setFormulaireOuvert(!formulaireOuvert)}
          type="button"
        >
          <i className="fa-solid fa-hand"></i> Demander de l'aide
        </button>
      </div>

      {formulaireOuvert && (
        <form className="carte-post formulaire-post" onSubmit={gererDemande}>
          <label><i className="fa-solid fa-book"></i> Sujet</label>
          <input value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="ex: Maths - dérivées" required />

          <label><i className="fa-solid fa-align-left"></i> Description</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optionnel" />

          <button type="submit" disabled={envoiEnCours}>{envoiEnCours ? "..." : "Lancer la demande"}</button>
          {erreur && <div className="erreur"><i className="fa-solid fa-triangle-exclamation"></i>{erreur}</div>}
        </form>
      )}

      {chargement ? (
        <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>
      ) : demandes.length === 0 ? (
        <div className="info"><i className="fa-solid fa-check"></i> Aucune demande ouverte pour l'instant.</div>
      ) : (
        demandes.map((d) => (
          <div key={d.id} className="carte-post">
            <div className="entete-post">
              <div className="avatar-mini"><i className="fa-solid fa-hand"></i></div>
              <div>
                <div className="auteur-post">{d.demandeur}</div>
                <div className="badge-categorie probleme"><i className="fa-solid fa-circle-question"></i>{d.sujet}</div>
              </div>
            </div>
            {d.description && <div className="contenu-post">{d.description}</div>}
            <button className="action-post" onClick={() => rejoindre(d.id)} type="button">
              <i className="fa-solid fa-phone"></i> Rejoindre en audio
            </button>
          </div>
        ))
      )}
    </div>
  );
}
