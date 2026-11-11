import { useState, useEffect, useRef } from "react";
import AvatarIcone from "./AvatarIcone.jsx";

/**
 * MenuPrincipal — le menu à côté de la cloche. Il regroupe tout ce qui n'a pas sa place
 * dans la barre d'onglets : Profil, Paramètres, et plus tard la Bibliothèque, le Shop...
 * Pour ajouter une entrée, il suffit d'ajouter une ligne à `entrees` (voir BarreNav.jsx).
 * Même rendu sur téléphone et sur ordinateur (un peu plus large sur grand écran).
 *
 * entrees : [{ cle, icone, label, desc?, bientot? }]
 */
export default function MenuPrincipal({ sessionToken, monUsername, entrees, ongletActif, onChoisir }) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    const fermerSiDehors = (e) => {
      if (racine.current && !racine.current.contains(e.target)) setOuvert(false);
    };
    const fermerAuClavier = (e) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", fermerSiDehors);
    document.addEventListener("touchstart", fermerSiDehors);
    document.addEventListener("keydown", fermerAuClavier);
    return () => {
      document.removeEventListener("mousedown", fermerSiDehors);
      document.removeEventListener("touchstart", fermerSiDehors);
      document.removeEventListener("keydown", fermerAuClavier);
    };
  }, [ouvert]);

  const actifDansLeMenu = entrees.some((e) => e.cle === ongletActif);

  return (
    <div className="menu-principal" ref={racine}>
      <button
        type="button"
        className={`bouton-cloche bouton-menu ${actifDansLeMenu || ouvert ? "bouton-menu-actif" : ""}`}
        aria-label="Menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
      >
        <i className={ouvert ? "fa-solid fa-xmark" : "fa-solid fa-bars"}></i>
      </button>

      {ouvert && (
        <div className="menu-principal-liste" role="menu">
          <div className="menu-principal-entete">
            <AvatarIcone username={monUsername} taille={40} />
            <div style={{ minWidth: 0 }}>
              <div className="menu-principal-nom">{monUsername}</div>
              <div className="menu-principal-sous">Mon espace</div>
            </div>
          </div>

          {entrees.map((e) => (
            <button
              key={e.cle}
              type="button"
              role="menuitem"
              disabled={e.bientot}
              className={`menu-principal-item ${ongletActif === e.cle ? "menu-principal-item-actif" : ""}`}
              onClick={() => {
                setOuvert(false);
                onChoisir(e.cle);
              }}
            >
              <span className="menu-principal-icone"><i className={e.icone}></i></span>
              <span className="menu-principal-texte">
                <span className="menu-principal-label">{e.label}</span>
                {e.desc && <span className="menu-principal-desc">{e.desc}</span>}
              </span>
              {e.bientot && <span className="menu-principal-bientot">Bientôt</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
