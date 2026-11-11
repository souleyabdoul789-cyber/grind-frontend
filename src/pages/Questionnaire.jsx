import { useState, useEffect } from "react";
import { enregistrerProfil, catalogueScolaire } from "../api.js";
import FondAnime from "../components/FondAnime.jsx";
import ChargementGrind from "../components/ChargementGrind.jsx";
import { PAYS } from "../paysListe.js";

const ETAPES = [
  { cle: "age", icone: "fa-solid fa-cake-candles", question: "Quel âge as-tu ?", type: "age" },
  { cle: "pays", icone: "fa-solid fa-earth-africa", question: "Dans quel pays étudies-tu ?", type: "pays" },
  { cle: "niveau", icone: "fa-solid fa-graduation-cap", question: "Quel est ton niveau ?", type: "niveau" },
  { cle: "difficultes", icone: "fa-solid fa-book-open", question: "Dans quelles matières as-tu des difficultés ?", type: "matieres" },
];

const MAX_MATIERES = 8;

/**
 * Questionnaire du profil. Aucun texte libre : le niveau et les matières se CHOISISSENT dans le
 * catalogue du serveur (GET /api/scolaire/catalogue), qui est aussi ce que le serveur vérifie à l'enregistrement.
 */
export default function Questionnaire({ sessionToken, onTermine }) {
  const [catalogue, setCatalogue] = useState(null);
  const [erreurCatalogue, setErreurCatalogue] = useState(null);
  const [etapeIndex, setEtapeIndex] = useState(0);
  const [reponses, setReponses] = useState({ age: "", pays: "", niveauId: "", filiere: "", difficultes: [] });
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);

  function chargerCatalogue() {
    setErreurCatalogue(null);
    catalogueScolaire().then(setCatalogue).catch(() => setErreurCatalogue("Impossible de charger la liste des niveaux. Vérifie ta connexion."));
  }

  useEffect(chargerCatalogue, []);

  const etape = ETAPES[etapeIndex];
  const derniereEtape = etapeIndex === ETAPES.length - 1;
  const niveau = catalogue?.niveaux.find((n) => n.id === reponses.niveauId) || null;
  const lycee = niveau?.cycle === "lycee";
  const matieres = catalogue && niveau ? catalogue.matieres_par_niveau[niveau.id] : [];

  function maj(champs) {
    setReponses({ ...reponses, ...champs });
  }

  function choisirNiveau(id) {
    // Les matières dépendent du niveau : on repart de zéro si le niveau change.
    maj({ niveauId: id, filiere: "", difficultes: [] });
  }

  function basculerMatiere(matiere) {
    const deja = reponses.difficultes.includes(matiere);
    if (!deja && reponses.difficultes.length >= MAX_MATIERES) {
      setErreur(`${MAX_MATIERES} matières au maximum.`);
      return;
    }
    setErreur(null);
    maj({ difficultes: deja ? reponses.difficultes.filter((m) => m !== matiere) : [...reponses.difficultes, matiere] });
  }

  function verifierEtape() {
    // Simple confort : le serveur revérifie TOUT à l'enregistrement.
    if (etape.type === "age") {
      const valeur = Number(reponses.age);
      if (!Number.isInteger(valeur)) return "Indique ton âge en chiffres.";
      if (valeur < catalogue.age_min) return `GRIND est réservé aux élèves de ${catalogue.age_min} ans et plus.`;
      if (valeur > catalogue.age_max) return `Indique un âge valide (entre ${catalogue.age_min} et ${catalogue.age_max} ans).`;
    }
    if (etape.type === "pays" && !reponses.pays) return "Choisis ton pays pour continuer.";
    if (etape.type === "niveau" && !reponses.niveauId) return "Choisis ton niveau pour continuer.";
    if (etape.type === "matieres" && reponses.difficultes.length === 0) return "Choisis au moins une matière.";
    return null;
  }

  function suivant() {
    const probleme = verifierEtape();
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setErreur(null);
    if (!derniereEtape) setEtapeIndex(etapeIndex + 1);
    else envoyer();
  }

  function precedent() {
    setErreur(null);
    if (etapeIndex > 0) setEtapeIndex(etapeIndex - 1);
  }

  async function envoyer() {
    setChargement(true);
    try {
      await enregistrerProfil(sessionToken, {
        age: Number(reponses.age),
        pays: reponses.pays, // code ISO (ex. « ne »)
        niveau: niveau.label + (reponses.filiere ? ` ${reponses.filiere}` : ""),
        difficultes: reponses.difficultes,
      });
      onTermine();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  if (!catalogue) {
    return (
      <div className="page">
        <FondAnime />
        <div className="carte">
          {erreurCatalogue ? (
            <>
              <div className="erreur">{erreurCatalogue}</div>
              <button type="button" onClick={chargerCatalogue}>Réessayer</button>
            </>
          ) : (
            <ChargementGrind texte="Préparation de ton profil..." />
          )}
        </div>
      </div>
    );
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

        <div key={etape.cle} className="etape-auth">
          <div className="icone-etape">
            <i className={etape.icone}></i>
          </div>
          <div className="etape-question">{etape.question}</div>
          <div className="sous-titre">Étape {etapeIndex + 1} sur {ETAPES.length}</div>

          {etape.type === "age" && (
            <input
              type="number"
              inputMode="numeric"
              min={catalogue.age_min}
              max={catalogue.age_max}
              value={reponses.age}
              onChange={(e) => maj({ age: e.target.value })}
              placeholder={`Entre ${catalogue.age_min} et ${catalogue.age_max} ans`}
              autoFocus
            />
          )}

          {etape.type === "pays" && (
            <div className="grille-pays">
              {PAYS.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  className={`carte-pays ${reponses.pays === p.code ? "carte-pays-actif" : ""}`}
                  onClick={() => maj({ pays: p.code })}
                >
                  <span className={`fi fi-${p.code} drapeau`}></span>
                  <span>{p.nom}</span>
                </button>
              ))}
            </div>
          )}

          {etape.type === "niveau" && (
            <>
              <div className="choix-categorie choix-puces">
                {catalogue.niveaux.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`chip ${reponses.niveauId === n.id ? "chip-actif" : ""}`}
                    onClick={() => choisirNiveau(n.id)}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
              {lycee && (
                <>
                  <div className="info champ-aide">Ta série (facultatif)</div>
                  <div className="choix-categorie choix-puces">
                    {catalogue.filieres.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`chip ${reponses.filiere === f ? "chip-actif" : ""}`}
                        onClick={() => maj({ filiere: reponses.filiere === f ? "" : f })}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {etape.type === "matieres" && (
            <>
              <div className="info champ-aide">
                Choisis jusqu'à {MAX_MATIERES} matières ({reponses.difficultes.length} sélectionnée{reponses.difficultes.length > 1 ? "s" : ""}).
              </div>
              <div className="choix-categorie choix-puces">
                {matieres.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`chip ${reponses.difficultes.includes(m) ? "chip-actif" : ""}`}
                    onClick={() => basculerMatiere(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
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
          <div className="erreur" role="alert">
            <i className="fa-solid fa-triangle-exclamation"></i>
            {erreur}
          </div>
        )}
      </div>
    </div>
  );
}
