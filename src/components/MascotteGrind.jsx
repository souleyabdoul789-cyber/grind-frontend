export default function MascotteGrind({ humeur = "vide", taille = 72 }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={humeur === "vide" ? "mascotte-flotte" : "mascotte-secoue"}
    >
      <defs>
        <linearGradient id={`degradeMascotte-${humeur}`} x1="0" y1="0" x2="100" y2="100">
          <stop offset="0" stopColor="#d8bfa6" />
          <stop offset="1" stopColor="#c9b6e4" />
        </linearGradient>
      </defs>

      {/* corps, façon cerveau du logo : deux lobes qui se chevauchent */}
      <ellipse cx="38" cy="52" rx="30" ry="32" fill={`url(#degradeMascotte-${humeur})`} opacity="0.9" />
      <ellipse cx="62" cy="52" rx="30" ry="32" fill={`url(#degradeMascotte-${humeur})`} opacity="0.9" />
      {/* petites bosses du dessus, comme le logo */}
      <circle cx="30" cy="24" r="9" fill={`url(#degradeMascotte-${humeur})`} />
      <circle cx="70" cy="24" r="9" fill={`url(#degradeMascotte-${humeur})`} />
      <circle cx="50" cy="18" r="8" fill={`url(#degradeMascotte-${humeur})`} />

      {humeur === "vide" ? (
        <>
          {/* yeux calmes, fermés — rien ne se passe, tout va bien */}
          <path d="M30 54 Q36 50 42 54" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M58 54 Q64 50 70 54" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* petit sourire détendu */}
          <path d="M42 66 Q50 71 58 66" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          {/* yeux inquiets — quelque chose a coincé */}
          <path d="M30 50 L42 58 M42 50 L30 58" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" />
          <path d="M58 50 L70 58 M70 50 L58 58" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" />
          {/* petite bouche en vague, un peu embêtée */}
          <path d="M40 68 Q45 64 50 68 Q55 72 60 68" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  );
}
