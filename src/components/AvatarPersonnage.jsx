const COULEURS_AURA = {
  brand: ["#d8bfa6", "#c9b6e4"],
  or: ["#f5d485", "#e8b74a"],
};

/**
 * AvatarPersonnage — le modèle validé par ASP (celui d'avant la
 * tentative "façon Duolingo", jugée moins belle). Seul changement
 * par rapport à cette version-là : les bras portent la couleur du
 * VÊTEMENT (manche), plus la couleur de peau — seule la main, au
 * bout, reste en peau (ou en gant si équipé). C'était le bug signalé.
 *
 * Le genre change vraiment la silhouette :
 * - fille   : épaules fines, jupe, cheveux mi-longs/longs avec mèches, cils, petit nœud
 * - garçon  : épaules larges, pantalon, cheveux en pics, sourcils plus marqués
 * - neutre  : entre les deux, cheveux courts arrondis
 */
export default function AvatarPersonnage({ config, parle = false, taille = 140 }) {
  const [auraA, auraB] = COULEURS_AURA[config?.couleur_aura] || COULEURS_AURA.brand;

  const genre = (config?.genre || "genre_neutre").replace("genre_", "");
  const estFille = genre === "fille";
  const estGarcon = genre === "garcon";

  const couleurCheveux = estFille ? "#4a2a35" : estGarcon ? "#1f1f28" : "#2a2a35";
  const couleurPeau = "#e8c4a0";
  const couleurGants = config?.gants === "gants_sport" ? "#c9b6e4" : "#5a4a3a";
  const couleurChaussures = config?.chaussures === "chaussures_montantes" ? "#3a2a2f" : "#d8bfa6";
  // Couleur des MANCHES — reprend la logique du vêtement, jamais la peau.
  const couleurManche = config?.vetement === "vetement_veste" ? "#2a2a35" : "url(#vetementDegrade)";

  const demiTorse = estGarcon ? 44 : estFille ? 34 : 40;
  const decalageBras = demiTorse - 7;
  const basTorse = estFille ? 172 : 200;
  const epaisseurSourcil = estGarcon ? 3.4 : 2.4;
  const intensiteJoues = estFille ? 0.55 : 0.3;

  const longueur = config?.cheveux === "cheveux_long" ? "long" : estFille ? "mi" : "court";
  const aMechesEtNoeud = longueur !== "court" && (estFille || config?.cheveux === "cheveux_long");

  const gaucheX = 80 - demiTorse;
  const droiteX = 80 + demiTorse;

  return (
    <svg width={taille} height={taille * 1.5} viewBox="0 0 160 240" xmlns="http://www.w3.org/2000/svg" className="avatar-respire">
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

      {parle && <circle cx="80" cy="120" r="90" fill="url(#auraGlow)" className="aura-personnage" />}

      {longueur === "mi" && (
        <path d="M38 74 Q30 30 80 28 Q130 30 122 74 L128 138 Q104 126 80 128 Q56 126 32 138 Z" fill={couleurCheveux} />
      )}
      {longueur === "long" && (
        <path d="M38 74 Q30 30 80 28 Q130 30 122 74 L130 196 Q104 184 80 186 Q56 184 30 196 Z" fill={couleurCheveux} />
      )}

      <rect x="58" y="192" width="18" height="38" rx="6" fill="#2a2a35" />
      <rect x="84" y="192" width="18" height="38" rx="6" fill="#2a2a35" />
      <ellipse cx="67" cy="232" rx="14" ry="7" fill={couleurChaussures} />
      <ellipse cx="93" cy="232" rx="14" ry="7" fill={couleurChaussures} />

      {/* ---- Bras : manche = couleur du vêtement, main = peau/gant ---- */}
      <g className={parle ? "bras-gauche bras-anime" : "bras-gauche"} style={{ transformOrigin: `${80 - decalageBras}px 128px` }}>
        <path d={`M${80 - decalageBras} 128 Q${80 - decalageBras - 20} 145 ${80 - decalageBras - 18} 172`} stroke={couleurManche} strokeWidth="14" strokeLinecap="round" fill="none" />
        <circle cx={80 - decalageBras - 18} cy="174" r="9" fill={config?.gants ? couleurGants : couleurPeau} />
      </g>
      <g className={parle ? "bras-droit bras-anime" : "bras-droit"} style={{ transformOrigin: `${80 + decalageBras}px 128px` }}>
        <path d={`M${80 + decalageBras} 128 Q${80 + decalageBras + 20} 145 ${80 + decalageBras + 18} 172`} stroke={couleurManche} strokeWidth="14" strokeLinecap="round" fill="none" />
        <circle cx={80 + decalageBras + 18} cy="174" r="9" fill={config?.gants ? couleurGants : couleurPeau} />
      </g>

      {/* ---- Buste ---- */}
      <path d={`M${gaucheX} ${basTorse} Q${gaucheX} 122 80 120 Q${droiteX} 122 ${droiteX} ${basTorse} Z`} fill="url(#vetementDegrade)" />
      {estFille && (
        <path d={`M${gaucheX} 166 L${gaucheX - 14} 204 L${droiteX + 14} 204 L${droiteX} 166 Z`} fill="url(#vetementDegrade)" opacity="0.92" />
      )}
      {config?.vetement === "vetement_veste" && (
        <>
          <path d={`M${gaucheX} ${basTorse} Q${gaucheX} 124 74 122 L72 ${basTorse} Z`} fill="#2a2a35" />
          <path d={`M${droiteX} ${basTorse} Q${droiteX} 124 86 122 L88 ${basTorse} Z`} fill="#2a2a35" />
        </>
      )}
      <path d="M65 124 L80 140 L95 124" stroke="#0a0a0f" strokeWidth="3" fill="none" strokeLinecap="round" />

      <rect x="70" y="104" width="20" height="20" fill={couleurPeau} />
      <ellipse cx="80" cy="78" rx="38" ry="40" fill={couleurPeau} />

      <path d="M42 72 Q38 32 80 30 Q122 32 118 72 Q118 52 80 50 Q42 52 42 72 Z" fill={couleurCheveux} />

      <ellipse cx="63" cy="82" rx="8" ry="11" fill="#1a1a22" className="avatar-oeil" />
      <ellipse cx="97" cy="82" rx="8" ry="11" fill="#1a1a22" className="avatar-oeil" style={{ animationDelay: "0.05s" }} />
      <circle cx="65" cy="78" r="2.6" fill="#ffffff" />
      <circle cx="99" cy="78" r="2.6" fill="#ffffff" />

      {estFille && (
        <g stroke="#1a1a22" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M56 74 L49 70 M58 72 L54 65" />
          <path d="M104 74 L111 70 M102 72 L106 65" />
        </g>
      )}

      <path d="M55 68 Q63 64 71 68" stroke={couleurCheveux} strokeWidth={epaisseurSourcil} fill="none" strokeLinecap="round" />
      <path d="M89 68 Q97 64 105 68" stroke={couleurCheveux} strokeWidth={epaisseurSourcil} fill="none" strokeLinecap="round" />

      <path d="M80 88 L78 94 L82 94" stroke="#c99a76" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M70 100 Q80 106 90 100" stroke="#8a5a45" strokeWidth="2.2" fill="none" strokeLinecap="round" />

      <ellipse cx="58" cy="92" rx="6" ry="4" fill="#e59a8a" opacity={intensiteJoues} />
      <ellipse cx="102" cy="92" rx="6" ry="4" fill="#e59a8a" opacity={intensiteJoues} />

      {estGarcon && longueur === "court" ? (
        <path d="M44 58 L52 34 L62 46 L72 28 L82 44 L94 28 L102 46 L110 34 L116 58 Q100 44 80 44 Q60 44 44 58 Z" fill={couleurCheveux} />
      ) : (
        <path d="M44 58 Q50 36 80 34 Q110 36 116 58 Q100 44 80 44 Q60 44 44 58 Z" fill={couleurCheveux} />
      )}

      {aMechesEtNoeud && (
        <>
          <path d="M42 64 Q36 92 44 120 Q54 100 52 68 Z" fill={couleurCheveux} />
          <path d="M118 64 Q124 92 116 120 Q106 100 108 68 Z" fill={couleurCheveux} />
          <g transform="translate(108 46)">
            <path d="M0 0 L-12 -7 L-12 7 Z" fill="#c9b6e4" />
            <path d="M0 0 L12 -7 L12 7 Z" fill="#c9b6e4" />
            <circle r="3.5" fill="#d8bfa6" />
          </g>
        </>
      )}

      {config?.chapeau === "chapeau_casquette" && (
        <g>
          <path d="M46 46 Q80 20 114 46 L114 38 Q80 16 46 38 Z" fill="#7a5a45" />
          <path d="M108 42 Q128 42 132 52 L112 52 Z" fill="#7a5a45" />
        </g>
      )}

      {config?.lunettes === "lunettes_rondes" && (
        <g stroke="#2a2a35" strokeWidth="2.4" fill="none">
          <circle cx="63" cy="82" r="12" />
          <circle cx="97" cy="82" r="12" />
          <line x1="75" y1="82" x2="85" y2="82" />
        </g>
      )}
    </svg>
  );
}
