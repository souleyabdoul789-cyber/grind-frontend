import { useState, useEffect, useRef } from "react";

/**
 * MenuTroisPoints — le menu « ⋮ » : une petite liste d'actions qui s'ouvre au clic.
 * Se ferme en touchant ailleurs ou avec Échap. Aucun composant natif du navigateur.
 *
 * actions   : [{ cle, icone, label, onClick, danger? }]
 * direction : "bas" (s'ouvre vers le bas, ex. en-tête de profil) ou "haut" (ex. bas d'un post)
 */
export default function MenuTroisPoints({ actions, direction = "bas", libelle = "Plus d'options" }) {
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

  return (
    <div className="menu-points" ref={racine}>
      <button
        type="button"
        className="menu-points-bouton"
        aria-label={libelle}
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
      >
        <i className="fa-solid fa-ellipsis-vertical"></i>
      </button>

      {ouvert && (
        <div className={`menu-points-liste menu-points-${direction}`} role="menu">
          {actions.map((a) => (
            <button
              key={a.cle}
              type="button"
              role="menuitem"
              className={`menu-points-item ${a.danger ? "menu-points-danger" : ""}`}
              onClick={() => {
                setOuvert(false);
                a.onClick();
              }}
            >
              <i className={a.icone}></i> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
