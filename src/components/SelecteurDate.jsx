import { useState } from "react";

const NOMS_MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const NOMS_JOURS = ["L", "M", "M", "J", "V", "S", "D"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function formaterAffichage(date) {
  if (!date) return "Choisir une date et une heure";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SelecteurDate({ valeur, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const [moisAffiche, setMoisAffiche] = useState(valeur ? new Date(valeur) : new Date());
  const [heure, setHeure] = useState(valeur ? valeur.getHours() : 12);
  const [minute, setMinute] = useState(valeur ? valeur.getMinutes() : 0);

  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);

  const annee = moisAffiche.getFullYear();
  const mois = moisAffiche.getMonth();
  const premierJourSemaine = (new Date(annee, mois, 1).getDay() + 6) % 7; // lundi = 0
  const nbJours = new Date(annee, mois + 1, 0).getDate();

  const cases = [];
  for (let i = 0; i < premierJourSemaine; i++) cases.push(null);
  for (let j = 1; j <= nbJours; j++) cases.push(j);

  function changerMois(delta) {
    setMoisAffiche(new Date(annee, mois + delta, 1));
  }

  function choisirJour(jour) {
    const dateChoisie = new Date(annee, mois, jour, heure, minute);
    onChange(dateChoisie);
  }

  function ajusterHeure(delta) {
    let h = (heure + delta + 24) % 24;
    setHeure(h);
    if (valeur) onChange(new Date(valeur.getFullYear(), valeur.getMonth(), valeur.getDate(), h, minute));
  }

  function ajusterMinute(delta) {
    let m = (minute + delta + 60) % 60;
    setMinute(m);
    if (valeur) onChange(new Date(valeur.getFullYear(), valeur.getMonth(), valeur.getDate(), heure, m));
  }

  return (
    <div className="selecteur-date">
      <button type="button" className="bouton-ouvrir-date" onClick={() => setOuvert(!ouvert)}>
        <i className="fa-solid fa-calendar-days"></i>
        {formaterAffichage(valeur)}
      </button>

      {ouvert && (
        <div className="panneau-date">
          <div className="entete-calendrier">
            <button type="button" onClick={() => changerMois(-1)}><i className="fa-solid fa-chevron-left"></i></button>
            <span>{NOMS_MOIS[mois]} {annee}</span>
            <button type="button" onClick={() => changerMois(1)}><i className="fa-solid fa-chevron-right"></i></button>
          </div>

          <div className="grille-jours-semaine">
            {NOMS_JOURS.map((j, i) => <span key={i}>{j}</span>)}
          </div>

          <div className="grille-calendrier">
            {cases.map((jour, i) => {
              if (jour === null) return <span key={i}></span>;
              const dateCase = new Date(annee, mois, jour);
              const estPasse = dateCase < aujourdHui;
              const estSelectionne = valeur &&
                valeur.getFullYear() === annee && valeur.getMonth() === mois && valeur.getDate() === jour;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={estPasse}
                  className={`case-jour ${estSelectionne ? "case-jour-actif" : ""}`}
                  onClick={() => choisirJour(jour)}
                >
                  {jour}
                </button>
              );
            })}
          </div>

          <div className="selecteur-heure">
            <div className="colonne-heure">
              <button type="button" onClick={() => ajusterHeure(1)}><i className="fa-solid fa-chevron-up"></i></button>
              <span>{pad(heure)}</span>
              <button type="button" onClick={() => ajusterHeure(-1)}><i className="fa-solid fa-chevron-down"></i></button>
            </div>
            <span className="separateur-heure">:</span>
            <div className="colonne-heure">
              <button type="button" onClick={() => ajusterMinute(5)}><i className="fa-solid fa-chevron-up"></i></button>
              <span>{pad(minute)}</span>
              <button type="button" onClick={() => ajusterMinute(-5)}><i className="fa-solid fa-chevron-down"></i></button>
            </div>
          </div>

          <button type="button" className="bouton-valider-date" onClick={() => setOuvert(false)} disabled={!valeur}>
            Valider
          </button>
        </div>
      )}
    </div>
  );
}
