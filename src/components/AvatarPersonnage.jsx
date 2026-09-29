const COULEURS_AURA = {
  brand: ["#d8bfa6", "#c9b6e4"],
  or: ["#f5d485", "#e8b74a"],
};

function assombrir(hex, montant) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max((n >> 16) - montant, 0);
  const g = Math.max(((n >> 8) & 0xff) - montant, 0);
  const b = Math.max((n & 0xff) - montant, 0);
  return `rgb(${r},${g},${b})`;
}

/**
 * AvatarPersonnage — validé visuellement (proto Python) avant d'être
 * porté ici. Style plat façon Duolingo : visage rectangle arrondi,
 * grands yeux, oreilles qui dépassent, cheveux en blob derrière la
 * tête, frange différente selon le genre.
 *
 * Point corrigé par rapport à la 1ère version : les bras sont de la
 * couleur du HAUT (manches), pas de la peau — seule la main, au bout,
 * reprend la couleur de peau (ou du gant si équipé).
 */
export default function AvatarPersonnage({ config, parle = false, taille = 140 }) {
  const [auraA, auraB] = COULEURS_AURA[config?.couleur_aura] || COULEURS_AURA.brand;
  const genre = (config?.genre || "genre_neutre").replace("genre_", "");
  const estFille = genre === "fille";

  const peau = config?.peau || "#e8c4a0";
  const cheveux = config?.couleur_cheveux || "#2a2a35";
  const ombrePeau = assombrir(peau, 35);
  const couleurHaut = config?.vetement === "vetement_veste" ? "#2a2a35" : "#c9b6e4";
  const couleurGants = config?.gants === "gants_sport" ? "#c9b6e4" : "#5a4a3a";
  const couleurChaussures = config?.chaussures === "chaussures_montantes" ? "#2a2a35" : couleurHaut;

  return (
    <svg width={taille} height={taille * 1.7} viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" className="avatar-respire">
      <defs>
        <radialGradient id="auraGlow">
          <stop offset="0%" stopColor={auraA} stopOpacity="0.55" />
          <stop offset="100%" stopColor={auraB} stopOpacity="0" />
        </radialGradient>
      </defs>

      {parle && <circle cx="100" cy="170" r="115" fill="url(#auraGlow)" className="aura-personnage" />}

      {/* ---- Jambes + chaussures ---- */}
      <rect x="78" y="268" width="18" height="42" rx="7" fill="#2a2a35" />
      <rect x="104" y="268" width="18" height="42" rx="7" fill="#2a2a35" />
      <ellipse cx="87" cy="312" rx="16" ry="8" fill={couleurChaussures} />
      <ellipse cx="113" cy="312" rx="16" ry="8" fill={couleurChaussures} />

      {/* ---- Bras : couleur du HAUT (manche), main en peau/gant au bout ---- */}
      <g className={parle ? "bras-gauche bras-anime" : "bras-gauche"} style={{ transformOrigin: "62px 196px" }}>
        <path d="M62 196 Q46 214 48 250" stroke={couleurHaut} strokeWidth="20" strokeLinecap="round" fill="none" />
        <circle cx="48" cy="256" r="11" fill={config?.gants ? couleurGants : peau} />
      </g>
      <g className={parle ? "bras-droit bras-anime" : "bras-droit"} style={{ transformOrigin: "138px 196px" }}>
        <path d="M138 196 Q154 214 152 250" stroke={couleurHaut} strokeWidth="20" strokeLinecap="round" fill="none" />
        <circle cx="152" cy="256" r="11" fill={config?.gants ? couleurGants : peau} />
      </g>

      {/* ---- Buste ---- */}
      <rect x="55" y="188" width="90" height="82" rx="22" fill={couleurHaut} />

      {/* ---- Cou ---- */}
      <rect x="84" y="168" width="32" height="26" fill={peau} />

      {/* ---- Cheveux arrière ---- */}
      {estFille ? (
        <>
          <rect x="35" y="38" width="130" height="152" rx="63" fill={cheveux} />
          <ellipse cx="38" cy="90" rx="20" ry="37" fill={cheveux} />
          <ellipse cx="162" cy="90" rx="20" ry="37" fill={cheveux} />
        </>
      ) : (
        <rect x="47" y="42" width="106" height="110" rx="40" fill={cheveux} />
      )}

      {/* ---- Visage ---- */}
      <rect x="45" y="68" width="110" height="110" rx="30" fill={peau} />
      <path d="M28 92 A18 18 0 0 1 28 128" fill={peau} />
      <path d="M172 92 A18 18 0 0 0 172 128" fill={peau} />

      {/* ---- Frange ---- */}
      {estFille ? (
        <path d="M45 74 L75 71 L88 84 L100 71 L112 84 L125 71 L155 74 L155 50 L45 50 Z" fill={cheveux} />
      ) : (
        <path d="M43 90 L63 60 L78 78 L100 55 L122 78 L137 60 L157 90 L157 45 L43 45 Z" fill={cheveux} />
      )}

      {/* ---- Yeux ---- */}
      {[81, 119].map((ex, i) => (
        <g key={i} className="avatar-oeil" style={{ animationDelay: i === 1 ? "0.05s" : "0s" }}>
          <rect x={ex - 12} y="112" width="24" height="27" rx="11" fill="white" />
          <circle cx={ex} cy="127" r="9" fill="#2f6fce" />
          <path d={`M${ex - 9} 119 A9 9 0 0 1 ${ex + 4} 121`} fill="#5a94e6" opacity="0.7" />
          <circle cx={ex - 2.5} cy="122" r="2.2" fill="white" />
        </g>
      ))}

      {/* ---- Nez ---- */}
      <path d="M99 143 L102 152 L98 153 L96 149 Z" fill={ombrePeau} />

      {/* ---- Bouche ---- */}
      <path d="M88 158 Q100 166 112 158" stroke="#8a5a45" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* ---- Taches de rousseur (uniquement style fille, cohérent avec la référence) ---- */}
      {estFille && (
        <g fill="#c98a6a" opacity="0.8">
          <circle cx="66" cy="148" r="1.6" /><circle cx="61" cy="156" r="1.6" /><circle cx="70" cy="160" r="1.6" />
          <circle cx="134" cy="148" r="1.6" /><circle cx="139" cy="156" r="1.6" /><circle cx="130" cy="160" r="1.6" />
        </g>
      )}

      {/* ---- Sourcils ---- */}
      <path d="M70 104 Q81 99 92 104" stroke={cheveux} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M108 104 Q119 99 130 104" stroke={cheveux} strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* ---- Chapeau ---- */}
      {config?.chapeau === "chapeau_casquette" && (
        <g>
          <path d="M40 60 Q100 28 160 60 L160 48 Q100 20 40 48 Z" fill="#7a5a45" />
          <path d="M150 54 Q176 54 182 66 L156 66 Z" fill="#7a5a45" />
        </g>
      )}

      {/* ---- Lunettes ---- */}
      {config?.lunettes === "lunettes_rondes" && (
        <g stroke="#2a2a35" strokeWidth="3" fill="none">
          <circle cx="81" cy="127" r="16" />
          <circle cx="119" cy="127" r="16" />
          <line x1="97" y1="127" x2="103" y2="127" />
        </g>
      )}
    </svg>
  );
}
