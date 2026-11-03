import { useState } from "react";
import { examenDemander, examenEtat } from "../api.js";
import IconeCompteBloque from "./IconeCompteBloque.jsx";
import ChargementGrind from "./ChargementGrind.jsx";
import { formaterDate } from "../moderationInfos.js";

/**
 * EcranSanction — ce que voit une personne dont le compte est suspendu ou banni.
 *
 * C'est une décision ADMINISTRATIVE (jamais automatique). Selon ce que l'administration a
 * décidé : un bouton « Demander un examen » (une seule demande par décision), ou un bouton
 * grisé indiquant qu'aucun examen n'est possible. Tant que l'examen est en cours ou si
 * la décision est définitive, c'est écrit clairement.
 *
 * `donnees` vient de la réponse du serveur à la connexion (voir moderation.detail_sanction).
 */
export default function EcranSanction({ donnees, username, onRetour }) {
  const [etat, setEtat] = useState(donnees);
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState("");
  const [traitement, setTraitement] = useState(null); // texte affiché pendant un traitement
  const [erreur, setErreur] = useState(null);

  const banni = etat.type === "bannissement";
  const examen = etat.examen;

  async function demander() {
    setErreur(null);
    setTraitement("Envoi de ta demande à l'administration...");
    try {
      const res = await examenDemander(username, etat.jeton_examen, message);
      setEtat({ ...res, jeton_examen: etat.jeton_examen });
      setOuvert(false);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setTraitement(null);
    }
  }

  async function actualiser() {
    setErreur(null);
    setTraitement("Vérification de l'état de ta demande...");
    try {
      const res = await examenEtat(username, etat.jeton_examen);
      setEtat({ ...res, jeton_examen: etat.jeton_examen });
    } catch (err) {
      // Si la sanction a été levée entre-temps, le jeton n'est plus valable : on invite à se reconnecter.
      setErreur("Ton compte a peut-être été rétabli : essaie de te reconnecter.");
    } finally {
      setTraitement(null);
    }
  }

  return (
    <div className="page">
      <div className="carte ecran-sanction">
        <IconeCompteBloque taille={104} />

        <h2 className="sanction-titre">{etat.message}</h2>
        {!banni && etat.jusqu_a && (
          <div className="info" style={{ textAlign: "center" }}>Fin de la suspension : {formaterDate(etat.jusqu_a)}</div>
        )}

        <div className="sanction-motif">
          <div className="sanction-motif-label">Motif</div>
          <div>{etat.motif}</div>
        </div>

        <div className="info" style={{ textAlign: "center", fontSize: 13, lineHeight: 1.5 }}>
          Cette décision a été prise par l'administration de GRIND. Elle n'est pas automatique.
        </div>

        {traitement ? (
          <ChargementGrind texte={traitement} />
        ) : (
          <>
            {examen?.statut === "en_attente" && (
              <div className="sanction-examen">
                <div><i className="fa-solid fa-hourglass-half"></i> Ta demande d'examen est en cours de traitement.</div>
                <button type="button" className="bouton-admin bouton-admin-doux" onClick={actualiser}>
                  <i className="fa-solid fa-rotate"></i> Actualiser
                </button>
              </div>
            )}

            {examen?.statut === "refuse" && (
              <div className="sanction-examen">
                <div><i className="fa-solid fa-circle-xmark"></i> Ta demande d'examen a été refusée. La décision est définitive.</div>
                {examen.note && <div className="info" style={{ fontSize: 13 }}>« {examen.note} »</div>}
              </div>
            )}

            {!examen && etat.examen_possible && !ouvert && (
              <button type="button" onClick={() => setOuvert(true)}>
                <i className="fa-solid fa-scale-balanced"></i> Demander un examen
              </button>
            )}

            {!examen && etat.examen_possible && ouvert && (
              <div className="sanction-examen">
                <label>Explique ta demande</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  placeholder="Dis ce qui s'est passé selon toi et pourquoi cette décision devrait être revue."
                  style={{ resize: "vertical" }}
                />
                <div className="rangee-boutons">
                  <button type="button" className="bouton-retour" onClick={() => setOuvert(false)}>Annuler</button>
                  <button type="button" onClick={demander} disabled={message.trim().length < 10}>Envoyer la demande</button>
                </div>
              </div>
            )}

            {!examen && !etat.examen_possible && (
              <button type="button" className="bouton-sanction-ferme" disabled>
                <i className="fa-solid fa-lock"></i> Il n'est pas possible de demander un examen
              </button>
            )}

            {erreur && <div className="erreur" style={{ marginTop: 10 }}>{erreur}</div>}
          </>
        )}

        <button type="button" className="lien" onClick={onRetour}>
          <i className="fa-solid fa-arrow-left"></i> Retour à la connexion
        </button>
      </div>
    </div>
  );
}
