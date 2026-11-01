import { useState } from "react";
import { signalerContenu } from "../api.js";
import { MOTIFS } from "../moderationInfos.js";

/**
 * ModaleSignalement — l'élève choisit un motif et peut préciser.
 * Sert pour un post, un commentaire ou un profil (typeCible).
 * Le serveur vérifie tout (existence, doublon, limite quotidienne) :
 * ici on ne fait qu'afficher le résultat.
 */
export default function ModaleSignalement({ sessionToken, typeCible, cibleId, libelle, onFermer }) {
  const [motif, setMotif] = useState(null);
  const [details, setDetails] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  async function envoyer() {
    if (!motif) {
      setErreur("Choisis un motif");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await signalerContenu(sessionToken, {
        type_cible: typeCible,
        cible_id: String(cibleId),
        motif,
        details: details.trim() || null,
      });
      setConfirmation(res.message);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="voile-modal" onClick={onFermer}>
      <div className="carte-modal carte-modal-large" onClick={(e) => e.stopPropagation()}>
        {confirmation ? (
          <>
            <div className="message-modal" style={{ color: "var(--succes)" }}>
              <i className="fa-solid fa-circle-check"></i>
              {confirmation}
            </div>
            <button type="button" onClick={onFermer}>Fermer</button>
          </>
        ) : (
          <>
            <div className="sous-titre" style={{ marginBottom: 6 }}>
              <i className="fa-regular fa-flag"></i> Signaler {libelle}
            </div>
            <div className="info" style={{ marginBottom: 12 }}>Pourquoi ce contenu pose-t-il problème ?</div>

            <div className="choix-categorie" style={{ flexWrap: "wrap" }}>
              {MOTIFS.map((m) => (
                <button
                  key={m.cle}
                  type="button"
                  className={`chip ${motif === m.cle ? "chip-actif" : ""}`}
                  onClick={() => setMotif(m.cle)}
                >
                  <i className={m.icone}></i> {m.label}
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Précisions (facultatif)"
              style={{ resize: "vertical", marginBottom: 12 }}
            />

            {erreur && <div className="erreur" style={{ marginBottom: 10 }}>{erreur}</div>}

            <div className="rangee-boutons">
              <button type="button" className="bouton-retour" onClick={onFermer} disabled={envoi}>Annuler</button>
              <button type="button" onClick={envoyer} disabled={envoi}>{envoi ? "..." : "Envoyer"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
