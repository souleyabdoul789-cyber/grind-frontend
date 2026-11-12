import Notifications from "./Notifications.jsx";
import MenuPrincipal from "./MenuPrincipal.jsx";

// Les onglets de premier niveau : ceux qu'on utilise sans cesse.
const ONGLETS = [
  { cle: "fil", icone: "fa-solid fa-house", label: "Fil" },
  { cle: "classes", icone: "fa-solid fa-chalkboard", label: "Classes" },
];

// Le reste vit dans le menu à côté de la cloche. Pour ajouter la Bibliothèque ou le Shop,
// ajouter une ligne ici (avec `bientot: true` tant que la page n'existe pas).
const ENTREES_MENU = [
  { cle: "profil", icone: "fa-solid fa-user", label: "Profil", desc: "Ton profil et tes publications" },
  { cle: "reglages", icone: "fa-solid fa-gear", label: "Paramètres", desc: "Contact, conditions, déconnexion" },
  { cle: "comptes", icone: "fa-solid fa-users", label: "Ajouter un compte", desc: "Gérer les comptes de cet appareil" },
];

export default function BarreNav({ sessionToken, monUsername, ongletActif, onChangerOnglet, onGererComptes, estEquipe = false }) {
  const onglets = estEquipe
    ? [...ONGLETS, { cle: "admin", icone: "fa-solid fa-building-shield", label: "Bureau" }]
    : ONGLETS;

  return (
    <>
      <div className="barre-nav">
        <div className="logo-grind logo-petit">
          <i className="fa-solid fa-brain"></i>
          <span>GRIND</span>
        </div>
        <div className="barre-nav-droite">
          <Notifications sessionToken={sessionToken} />
          <MenuPrincipal
            sessionToken={sessionToken}
            monUsername={monUsername}
            entrees={ENTREES_MENU}
            ongletActif={ongletActif}
            onChoisir={(cle) => cle === "comptes" ? onGererComptes?.() : onChangerOnglet(cle)}
          />
        </div>
      </div>

      <div className="barre-onglets">
        {onglets.map((o) => (
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
