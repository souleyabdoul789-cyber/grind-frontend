import { useState } from "react";
import { signalerContenu, bloquerCompte } from "../api.js";
import { MOTIFS } from "../moderationInfos.js";
import { memoriserBlocage } from "../blocages.js";
import ChargementGrind from "./ChargementGrind.jsx";

/**
 * ModaleSignalement — signaler un post, un commentaire ou un compte.
 *
 * L'élève choisit un motif et peut préciser. Comme sur WhatsApp, il peut aussi cocher
 * « Ne plus voir ses contenus » : ce sont DEUX traitements côté serveur (le signalement,
 * puis le filtre), chacun avec sa petite animation, car ils peuvent prendre du temps
 * (les informations du compte et un extrait de ses contenus partent à l'administration).
 *
 * compteCible : pseudo de l'auteur, pour proposer le filtre (null = pas de filtre proposé).
 * onChange    : appelé quand un filtre est mis en place (le fil se recharge).
 */
export default function ModaleSignalement({ sessionToken, typeCible, cibleId, libelle, compteCible = null, onFermer, onChange }) {
  const [motif, setMotif] = useState(null);
  const [details, setDetails] = useState("");
  const [masquer, setMasquer] = useState(false);
  const [etape, setEtape] = useState("saisie"); // "saisie" / "envoi" / "fait"
  const [texteEtape, setTexteEtape] = useState("");
  const [erreur, setErreur] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  async function envoyer() {
    if (!motif) {
      setErreur("Choisis un motif");
      return;
    }
    setErreur(null);
    setEtape("envoi");
    setTexteEtape("Envoi du signalement à l'administration...");
    try {
      const res = await signalerContenu(sessionToken, {
        type_cible: typeCible,
        cible_id: String(cibleId),
        motif,
        details: details.trim() || null,
      });
      let message = res.message;

      if (masquer && compteCible) {
        setTexteEtape("Mise en place du filtre...");
        await bloquerCompte(sessionToken, compteCible);
        memoriserBlocage(compteCible, true);
        message += ` Tu ne verras plus les contenus de ${compteCible}.`;
        if (onChange) onChange(compteCible, true);
      }
      setConfirmation(message);
      setEtape("fait");
    } catch (err) {
      setErreur(err.message);
      setEtape("saisie");
    }
  }

  const enCours = etape === "envoi";

  return (
    <div className="voile-modal" onClick={enCours ? undefined : onFermer}>
      <div className="carte-modal carte-modal-large" onClick={(e) => e.stopPropagation()}>
        {etape === "fait" && (
          <>
            <div className="message-modal" style={{ color: "var(--succes)" }}>
              <i className="fa-solid fa-circle-check"></i>
              {confirmation}
            </div>
            <button type="button" onClick={onFermer}>Fermer</button>
          </>
        )}

        {enCours && <ChargementGrind texte={texteEtape} />}

        {etape === "saisie" && (
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

            {compteCible && (
              <div className="ligne-reglage" style={{ padding: "2px 0 14px" }}>
                <span>
                  Ne plus voir les contenus de {compteCible}
                  <div className="info" style={{ fontSize: 12 }}>Tu pourras les réafficher à tout moment.</div>
                </span>
                <button
                  type="button"
                  className={`interrupteur ${masquer ? "interrupteur-actif" : ""}`}
                  onClick={() => setMasquer((v) => !v)}
                  aria-label="Ne plus voir ses contenus"
                >
                  <span className="curseur-interrupteur"></span>
                </button>
              </div>
            )}

            {erreur && <div className="erreur" style={{ marginBottom: 10 }}>{erreur}</div>}

            <div className="rangee-boutons">
              <button type="button" className="bouton-retour" onClick={onFermer}>Annuler</button>
              <button type="button" onClick={envoyer}>Signaler</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
