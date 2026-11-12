import { useState, useEffect } from "react";
import { enregistrerProfil, catalogueScolaire } from "../api.js";
import FondAnime from "../components/FondAnime.jsx";
import ChargementGrind from "../components/ChargementGrind.jsx";
import { PAYS } from "../paysListe.js";

const ETAPES = [
  { cle: "age", icone: "fa-solid fa-cake-candles", question: "Quel âge as-tu ?", type: "age" },
  { cle: "pays", icone: "fa-solid fa-earth-africa", question: "Dans quel pays étudies-tu ?", type: "pays" },
  { cle: "scolarite", icone: "fa-solid fa-graduation-cap", question: "Parle-nous de tes études", type: "scolarite" },
  { cle: "difficultes", icone: "fa-solid fa-book-open", question: "Quelles matières veux-tu travailler ?", type: "matieres" },
];

const MAX_MATIERES = 8;

/** Questionnaire international : les libellés scolaires sont saisis par l'élève.
 * Le catalogue ne sert ici qu'à récupérer les bornes d'âge.
 */
export default function Questionnaire({ sessionToken, onTermine }) {
  const [catalogue, setCatalogue] = useState(null);
  const [erreurCatalogue, setErreurCatalogue] = useState(null);
  const [etapeIndex, setEtapeIndex] = useState(0);
  const [reponses, setReponses] = useState({
    age: "", pays: "", niveau: "", filiere: "", etablissement: "", difficultes: [],
  });
  const [matiereSaisie, setMatiereSaisie] = useState("");
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);

  function chargerCatalogue() {
    setErreurCatalogue(null);
    catalogueScolaire()
      .then(setCatalogue)
      .catch((err) => setErreurCatalogue(err.message || "Impossible de préparer ton profil. Vérifie ta connexion."));
  }

  useEffect(() => { chargerCatalogue(); }, []);

  const etape = ETAPES[etapeIndex];
  const derniereEtape = etapeIndex === ETAPES.length - 1;

  function maj(champs) {
    setReponses((ancienne) => ({ ...ancienne, ...champs }));
  }

  function matieresEnAttente() {
    return matiereSaisie.split(/[;,\n]/).map((m) => m.trim()).filter(Boolean);
  }

  function ajouterMatieres() {
    const ajouts = matieresEnAttente();
    if (!ajouts.length) return;
    const fusion = [...reponses.difficultes];
    for (const matiere of ajouts) {
      if (!fusion.some((m) => m.localeCompare(matiere, undefined, { sensitivity: "accent" }) === 0)) {
        fusion.push(matiere);
      }
    }
    if (fusion.length > MAX_MATIERES) {
      setErreur(`${MAX_MATIERES} matières au maximum.`);
      return;
    }
    maj({ difficultes: fusion });
    setMatiereSaisie("");
    setErreur(null);
  }

  function retirerMatiere(matiere) {
    maj({ difficultes: reponses.difficultes.filter((m) => m !== matiere) });
  }

  function verifierEtape() {
    if (etape.type === "age") {
      const valeur = Number(reponses.age);
      if (!Number.isInteger(valeur)) return "Indique ton âge en chiffres.";
      if (valeur < catalogue.age_min) return `GRIND est réservé aux élèves de ${catalogue.age_min} ans et plus.`;
      if (valeur > catalogue.age_max) return `Indique un âge valide (entre ${catalogue.age_min} et ${catalogue.age_max} ans).`;
    }
    if (etape.type === "pays" && !reponses.pays) return "Choisis ton pays pour continuer.";
    if (etape.type === "scolarite") {
      if (reponses.niveau.trim().length < 2) return "Indique ta classe ou ton niveau d'études.";
      if (reponses.niveau.trim().length > 80) return "La classe ou le niveau ne doit pas dépasser 80 caractères.";
      if (reponses.filiere.trim().length > 100) return "La filière ne doit pas dépasser 100 caractères.";
      if (reponses.etablissement.trim().length > 160) return "L'établissement ne doit pas dépasser 160 caractères.";
    }
    if (etape.type === "matieres") {
      const pending = matieresEnAttente();
      const all = [...reponses.difficultes];
      for (const m of pending) if (!all.some((d) => d.toLocaleLowerCase() === m.toLocaleLowerCase())) all.push(m);
      if (all.length === 0) return "Ajoute au moins une matière à travailler.";
      if (all.length > MAX_MATIERES) return `${MAX_MATIERES} matières au maximum.`;
    }
    return null;
  }

  function suivant() {
    const probleme = verifierEtape();
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setErreur(null);
    if (!derniereEtape) setEtapeIndex((i) => i + 1);
    else envoyer();
  }

  function precedent() {
    setErreur(null);
    if (etapeIndex > 0) setEtapeIndex((i) => i - 1);
  }

  async function envoyer() {
    const difficultes = [...reponses.difficultes];
    for (const matiere of matieresEnAttente()) {
      if (!difficultes.some((m) => m.toLocaleLowerCase() === matiere.toLocaleLowerCase())) difficultes.push(matiere);
    }
    setChargement(true);
    try {
      await enregistrerProfil(sessionToken, {
        age: Number(reponses.age),
        pays: reponses.pays,
        niveau: reponses.niveau.trim(),
        filiere: reponses.filiere.trim() || null,
        etablissement: reponses.etablissement.trim() || null,
        difficultes,
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
          ) : <ChargementGrind texte="Préparation de ton profil..." />}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <FondAnime />
      <div className="carte">
        <div className="barre-progression">
          {ETAPES.map((_, i) => <div key={i} className={`segment-progression ${i <= etapeIndex ? "rempli" : ""}`} />)}
        </div>

        <div key={etape.cle} className="etape-auth">
          <div className="icone-etape"><i className={etape.icone}></i></div>
          <div className="etape-question">{etape.question}</div>
          <div className="sous-titre">Étape {etapeIndex + 1} sur {ETAPES.length}</div>

          {etape.type === "age" && (
            <input type="number" inputMode="numeric" min={catalogue.age_min} max={catalogue.age_max}
              value={reponses.age} onChange={(e) => maj({ age: e.target.value })}
              placeholder={`Entre ${catalogue.age_min} et ${catalogue.age_max} ans`} autoFocus />
          )}

          {etape.type === "pays" && (
            <div className="grille-pays">
              {PAYS.map((p) => (
                <button key={p.code} type="button"
                  className={`carte-pays ${reponses.pays === p.code ? "carte-pays-actif" : ""}`}
                  onClick={() => maj({ pays: p.code })}>
                  <span className={`fi fi-${p.code} drapeau`}></span><span>{p.nom}</span>
                </button>
              ))}
            </div>
          )}

          {etape.type === "scolarite" && (
            <>
              <label htmlFor="niveau-scolaire">Classe / niveau d'études</label>
              <input id="niveau-scolaire" type="text" maxLength={80} value={reponses.niveau}
                onChange={(e) => maj({ niveau: e.target.value })}
                placeholder="Ex. : Terminale F3, Grade 11, CAP, BTS 1..." autoFocus />
              <label htmlFor="filiere-scolaire">Voie / filière (facultatif)</label>
              <input id="filiere-scolaire" type="text" maxLength={100} value={reponses.filiere}
                onChange={(e) => maj({ filiere: e.target.value })}
                placeholder="Général, professionnel, technique, apprentissage..." />
              <label htmlFor="etablissement-scolaire">Établissement (facultatif)</label>
              <input id="etablissement-scolaire" type="text" maxLength={160} value={reponses.etablissement}
                onChange={(e) => maj({ etablissement: e.target.value })}
                placeholder="Nom de ton école, lycée ou centre de formation" />
              <div className="info champ-aide">
                Tu peux utiliser les appellations de ton pays et de ton système scolaire. Aucun catalogue national n'est imposé.
              </div>
            </>
          )}

          {etape.type === "matieres" && (
            <>
              <div className="info champ-aide">
                Écris les matières que tu souhaites travailler, puis appuie sur « Ajouter ». Tu peux en indiquer jusqu'à {MAX_MATIERES}.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input style={{ minWidth: 0, margin: 0 }} type="text" maxLength={80} value={matiereSaisie}
                  onChange={(e) => setMatiereSaisie(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterMatieres(); } }}
                  placeholder="Ex. : Mathématiques, électrotechnique..." />
                <button type="button" onClick={ajouterMatieres}
                  style={{ width: "auto", flex: "0 0 auto", margin: 0, padding: "10px 14px", background: "var(--brown)", color: "var(--text)" }}>
                  Ajouter
                </button>
              </div>
              <div className="choix-categorie choix-puces" style={{ flexWrap: "wrap", marginTop: 12 }}>
                {reponses.difficultes.map((m) => (
                  <button key={m} type="button" className="chip chip-actif" onClick={() => retirerMatiere(m)} title={`Retirer ${m}`}>
                    {m} <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rangee-boutons">
          {etapeIndex > 0 && <button className="bouton-retour" onClick={precedent} type="button"><i className="fa-solid fa-arrow-left"></i></button>}
          <button onClick={suivant} disabled={chargement} type="button">
            {chargement ? <span className="grind-spinner" aria-label="Enregistrement" /> : derniereEtape ? "Terminer" : "Continuer"}
          </button>
        </div>

        {erreur && <div className="erreur" role="alert"><i className="fa-solid fa-triangle-exclamation"></i> {erreur}</div>}
      </div>
    </div>
  );
}
