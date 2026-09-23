import Notifications from "./Notifications.jsx";

const ONGLETS = [
  { cle: "fil", icone: "fa-solid fa-house", label: "Fil" },
  { cle: "classes", icone: "fa-solid fa-chalkboard", label: "Classes" },
  { cle: "profil", icone: "fa-solid fa-user", label: "Profil" },
  { cle: "reglages", icone: "fa-solid fa-gear", label: "Réglages" },
];

export default function BarreNav({ sessionToken, ongletActif, onChangerOnglet }) {
  return (
    <>
      <div className="barre-nav">
        <div className="logo-grind logo-petit">
          <i className="fa-solid fa-brain"></i>
          <span>GRIND</span>
        </div>
        <div className="barre-nav-droite">
          <Notifications sessionToken={sessionToken} />
        </div>
      </div>

      <div className="barre-onglets">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            className={`onglet ${ongletActif === o.cle ? "onglet-actif" : ""}`}
            onClick={() => onChangerOnglet(o.cle)}
            type="button"
          >
            <i className={o.icone}></i>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
