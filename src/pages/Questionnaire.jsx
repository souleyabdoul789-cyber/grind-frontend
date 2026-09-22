import { useState } from "react";
import { enregistrerProfil } from "../api.js";
import FondAnime from "../components/FondAnime.jsx";
import { PAYS } from "../paysListe.js";

const ETAPES = [
  { cle: "age", icone: "fa-solid fa-cake-candles", question: "Quel âge as-tu ?", type: "number" },
  { cle: "pays", icone: "fa-solid fa-earth-africa", question: "Dans quel pays étudies-tu ?", type: "pays" },
  { cle: "niveau", icone: "fa-solid fa-graduation-cap", question: "Quelle est ta classe ou ta filière ?", type: "text" },
  { cle: "difficultes", icone: "fa-solid fa-book-open", question: "Dans quelles matières as-tu des difficultés ?", type: "textarea" },
];

export default function Questionnaire({ sessionToken, onTermine }) {
  const [etapeIndex, setEtapeIndex] = useState(0);
  const [reponses, setReponses] = useState({ age: "", pays: "", niveau: "", difficultes: "" });
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);

  const etape = ETAPES[etapeIndex];
  const derniereEtape = etapeIndex === ETAPES.length - 1;

  function majReponse(valeur) {
    setReponses({ ...reponses, [etape.cle]: valeur });
  }

  function suivant() {
    if (!String(reponses[etape.cle]).trim()) {
      setErreur("Cette information est nécessaire pour continuer");
      return;
    }
    setErreur(null);
    if (!derniereEtape) {
      setEtapeIndex(etapeIndex + 1);
    } else {
      envoyer();
    }
  }

  function precedent() {
    setErreur(null);
    if (etapeIndex > 0) setEtapeIndex(etapeIndex - 1);
  }

  async function envoyer() {
    setChargement(true);
    try {
      const difficultesJson = JSON.stringify(
        reponses.difficultes.split(",").map((d) => d.trim()).filter(Boolean)
      );

      await enregistrerProfil(sessionToken, {
        age: Number(reponses.age),
        pays: reponses.pays, // code ISO (ex: "ne")
        niveau: reponses.niveau,
        difficultes: difficultesJson,
      });

      onTermine();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="page">
      <FondAnime />
      <div className="carte">
        <div className="barre-progression">
          {ETAPES.map((_, i) => (
            <div key={i} className={`segment-progression ${i <= etapeIndex ? "rempli" : ""}`} />
          ))}
        </div>

        <div key={etape.cle}>
          <div className="icone-etape">
            <i className={etape.icone}></i>
          </div>
          <div className="etape-question">{etape.question}</div>
          <div className="sous-titre">Étape {etapeIndex + 1} sur {ETAPES.length}</div>

          {etape.type === "textarea" && (
            <textarea
              rows={3}
              value={reponses[etape.cle]}
              onChange={(e) => majReponse(e.target.value)}
              placeholder="ex: maths, physique"
            />
          )}

          {etape.type === "pays" && (
            <div className="grille-pays">
              {PAYS.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  className={`carte-pays ${reponses.pays === p.code ? "carte-pays-actif" : ""}`}
                  onClick={() => majReponse(p.code)}
                >
                  <span className={`fi fi-${p.code} drapeau`}></span>
                  <span>{p.nom}</span>
                </button>
              ))}
            </div>
          )}

          {(etape.type === "number" || etape.type === "text") && (
            <input
              type={etape.type}
              value={reponses[etape.cle]}
              onChange={(e) => majReponse(e.target.value)}
              placeholder={etape.cle === "niveau" ? "ex: Terminale S" : ""}
              autoFocus
            />
          )}
        </div>

        <div className="rangee-boutons">
          {etapeIndex > 0 && (
            <button className="bouton-retour" onClick={precedent} type="button">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          )}
          <button onClick={suivant} disabled={chargement} type="button">
            {chargement ? "..." : derniereEtape ? "Terminer" : "Continuer"}
          </button>
        </div>

        {erreur && (
          <div className="erreur">
            <i className="fa-solid fa-triangle-exclamation"></i>
            {erreur}
          </div>
        )}
      </div>
    </div>
  );
}
