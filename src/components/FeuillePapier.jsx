import { useId } from "react";

/** Feuille de cahier dessinée en SVG ; la saisie reste un vrai champ accessible. */
export default function FeuillePapier({ value, onChange, readOnly = false, placeholder = "Écris tes notes ici…", label = "Feuille de notes" }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const lignes = Array.from({ length: 19 }, (_, index) => 38 + index * 26);
  return (
    <div className={`feuille-papier${readOnly ? " feuille-papier-lecture" : ""}`}>
      <svg className="feuille-papier-dessin" viewBox="0 0 390 540" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`papierGrind-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fffefb" />
            <stop offset="1" stopColor="#f3f0e7" />
          </linearGradient>
          <filter id={`ombrePapierGrind-${uid}`} x="-15%" y="-15%" width="135%" height="145%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000000" floodOpacity="0.20" />
          </filter>
        </defs>
        <rect x="6" y="4" width="378" height="532" rx="5" fill={`url(#papierGrind-${uid})`} stroke="#d8d2c6" filter={`url(#ombrePapierGrind-${uid})`} />
        {lignes.map((y) => <path key={y} d={`M 14 ${y} H 376`} stroke="#b7c7d8" strokeWidth="1" opacity="0.64" />)}
        <path d="M 67 12 V 526" stroke="#d58d91" strokeWidth="1.25" opacity="0.65" />
        {[82, 270, 458].map((y) => <g key={y}><circle cx="22" cy={y} r="7" fill="#e6e1d7" stroke="#c8c1b4"/><circle cx="22" cy={y} r="3.3" fill="#d2cbbf" /></g>)}
        <path d="M 370 8 L 382 20 L 382 520" stroke="#e5e0d6" strokeWidth="2" fill="none" opacity="0.8" />
      </svg>
      <textarea
        className="feuille-papier-ecriture"
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck="true"
      />
      <div className="feuille-papier-bas">GRIND · NOTES PERSONNELLES</div>
    </div>
  );
}
