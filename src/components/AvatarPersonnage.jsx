const COULEURS_AURA = {
  brand: ["#d8bfa6", "#c9b6e4"],
  or: ["#f5d485", "#e8b74a"],
};

/**
 * AvatarPersonnage — rendu en couches façon Picrew/VRoid : un corps de
 * base, puis cheveux/vêtements/chapeau/lunettes superposés selon la
 * config. Un seul jeu de formes pour l'instant (le personnage de
 * validation) — le catalogue s'enrichira avec d'autres silhouettes/
 * coiffures une fois le système lui-même validé.
 *
 * `parle` déclenche l'aura — jamais décorative en continu, branchée
 * sur la vraie détection de parole (Web Audio) utilisée dans la salle.
 */
export default function AvatarPersonnage({ config, parle = false, taille = 140 }) {
  const [auraA, auraB] = COULEURS_AURA[config?.couleur_aura] || COULEURS_AURA.brand;
  const couleurCheveux = config?.genre === "fille" ? "#3a2a2f" : "#2a2a35";
  const couleurPeau = "#e8c4a0";

  return (
    <svg width={taille} height={taille} viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" className="avatar-respire">
      <defs>
        <radialGradient id="auraGlow">
          <stop offset="0%" stopColor={auraA} stopOpacity="0.55" />
          <stop offset="100%" stopColor={auraB} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vetementDegrade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8bfa6" />
          <stop offset="1" stopColor="#c9b6e4" />
        </linearGradient>
      </defs>

      {/* Aura — visible uniquement quand parle=true, jamais figée */}
      {parle && <circle cx="80" cy="90" r="72" fill="url(#auraGlow)" className="aura-personnage" />}

      {/* ---- Corps / buste ---- */}
      <path d="M40 158 Q40 110 80 108 Q120 110 120 158 Z" fill="url(#vetementDegrade)" />
      {/* col */}
      <path d="M65 112 L80 128 L95 112" stroke="#0a0a0f" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* ---- Cou ---- */}
      <rect x="70" y="92" width="20" height="20" fill={couleurPeau} />

      {/* ---- Tête ---- */}
      <ellipse cx="80" cy="66" rx="38" ry="40" fill={couleurPeau} />

      {/* ---- Cheveux (arrière, sous le visage) ---- */}
      <path d="M42 60 Q38 20 80 18 Q122 20 118 60 Q118 40 80 38 Q42 40 42 60 Z" fill={couleurCheveux} />

      {/* ---- Grands yeux façon anime ---- */}
      <ellipse cx="63" cy="70" rx="8" ry="11" fill="#1a1a22" className="avatar-oeil" />
      <ellipse cx="97" cy="70" rx="8" ry="11" fill="#1a1a22" className="avatar-oeil" style={{ animationDelay: "0.05s" }} />
      <circle cx="65" cy="66" r="2.6" fill="#ffffff" />
      <circle cx="99" cy="66" r="2.6" fill="#ffffff" />

      {/* sourcils */}
      <path d="M55 56 Q63 52 71 56" stroke={couleurCheveux} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M89 56 Q97 52 105 56" stroke={couleurCheveux} strokeWidth="2.4" fill="none" strokeLinecap="round" />

      {/* petit nez et sourire */}
      <path d="M80 76 L78 82 L82 82" stroke="#c99a76" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M70 88 Q80 94 90 88" stroke="#8a5a45" strokeWidth="2.2" fill="none" strokeLinecap="round" />

      {/* joues */}
      <ellipse cx="58" cy="80" rx="6" ry="4" fill="#e59a8a" opacity="0.35" />
      <ellipse cx="102" cy="80" rx="6" ry="4" fill="#e59a8a" opacity="0.35" />

      {/* ---- Cheveux (frange, par-dessus le front) ---- */}
      <path d="M44 46 Q50 24 80 22 Q110 24 116 46 Q100 32 80 32 Q60 32 44 46 Z" fill={couleurCheveux} />

      {/* ---- Chapeau (optionnel) ---- */}
      {config?.chapeau === "chapeau_casquette" && (
        <g>
          <path d="M46 34 Q80 8 114 34 L114 26 Q80 4 46 26 Z" fill="#7a5a45" />
          <path d="M108 30 Q128 30 132 40 L112 40 Z" fill="#7a5a45" />
        </g>
      )}

      {/* ---- Lunettes (optionnel) ---- */}
      {config?.lunettes === "lunettes_rondes" && (
        <g stroke="#2a2a35" strokeWidth="2.4" fill="none">
          <circle cx="63" cy="70" r="12" />
          <circle cx="97" cy="70" r="12" />
          <line x1="75" y1="70" x2="85" y2="70" />
        </g>
      )}
    </svg>
  );
}
