/**
 * ChargementGrind — la petite mascotte GRIND qui rebondit et cligne des yeux
 * pendant que le serveur travaille (signalement, blocage, demande d'examen...).
 * Elle n'est affichée QUE pendant un vrai traitement : l'animation reflète un état réel.
 */
export default function ChargementGrind({ texte, taille = 46 }) {
  return (
    <div className="chargement-grind" role="status" aria-live="polite">
      <svg width={taille} height={taille} viewBox="0 0 100 100" className="chargement-grind-svg" aria-hidden="true">
        <defs>
          <linearGradient id="degradeChargement" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#d8bfa6" />
            <stop offset="1" stopColor="#c9b6e4" />
          </linearGradient>
        </defs>
        <ellipse cx="38" cy="56" rx="28" ry="30" fill="url(#degradeChargement)" opacity="0.92" />
        <ellipse cx="62" cy="56" rx="28" ry="30" fill="url(#degradeChargement)" opacity="0.92" />
        <circle cx="30" cy="29" r="9" fill="url(#degradeChargement)" />
        <circle cx="70" cy="29" r="9" fill="url(#degradeChargement)" />
        <circle cx="50" cy="23" r="8" fill="url(#degradeChargement)" />
        <g className="chargement-yeux">
          <ellipse cx="40" cy="58" rx="4" ry="5.5" fill="#0a0a0f" />
          <ellipse cx="60" cy="58" rx="4" ry="5.5" fill="#0a0a0f" />
        </g>
        <path d="M 42 72 Q 50 79 58 72" stroke="#0a0a0f" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      {texte && <span className="chargement-texte">{texte}</span>}
    </div>
  );
}
