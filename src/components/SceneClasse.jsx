import AvatarDessus from "./AvatarDessus.jsx";

const LARGEUR = 800;
const HAUTEUR = 450;
const POLICE = "Space Grotesk, Inter, sans-serif";

// 9 places d'élèves (+ le prof = 10 personnes max, comme LiveKit).
// Deux rangées décalées, comme dans une vraie salle.
export const SIEGES = [
  { x: 140, y: 205 }, { x: 270, y: 205 }, { x: 400, y: 205 }, { x: 530, y: 205 }, { x: 660, y: 205 },
  { x: 205, y: 340 }, { x: 335, y: 340 }, { x: 465, y: 340 }, { x: 595, y: 340 },
];
export const NB_SIEGES = SIEGES.length;

const COULEURS_OBJETS = ["#e86f8f", "#f2a65a", "#5ab0c9", "#8fc27a", "#b48ae0", "#e8c94a"];

function hash(texte) {
  let h = 0;
  for (let i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) >>> 0;
  return h;
}

function raccourcir(nom, max = 12) {
  return nom.length > max ? nom.slice(0, max - 1) + "…" : nom;
}

function Etoile({ x, y, r = 5 }) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rayon = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(x + rayon * Math.cos(a)).toFixed(2)},${(y + rayon * Math.sin(a)).toFixed(2)}`);
  }
  return <polygon points={pts.join(" ")} fill="#f5d485" />;
}

function IconeMicCoupe({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="#e08a8a" strokeWidth="1.5" fill="none" strokeLinecap="round">
      <rect x="-2.3" y="-6" width="4.6" height="7.5" rx="2.3" />
      <path d="M -5 -0.5 Q -5 4.5 0 4.5 Q 5 4.5 5 -0.5" />
      <path d="M 0 4.5 L 0 7.5" />
      <path d="M -6.5 -7 L 6.5 8" strokeWidth="1.8" />
    </g>
  );
}

function Plaque({ x, y, nom, prof, moi, micCoupe, largeur = 84 }) {
  const texte = raccourcir(nom, 11);
  return (
    <g>
      <rect
        x={x - largeur / 2} y={y} width={largeur} height="19" rx="9.5"
        fill="rgba(10,10,15,0.78)" stroke={moi ? "#c9b6e4" : "rgba(255,255,255,0.14)"} strokeWidth="1"
      />
      {prof && <Etoile x={x - largeur / 2 + 11} y={y + 9.5} />}
      <text
        x={x + (prof ? 3 : 0) - (micCoupe ? 5 : 0)} y={y + 13.2} textAnchor="middle"
        fontFamily={POLICE} fontSize="11" fontWeight="600" fill="#ece6f1"
      >
        {texte}
      </text>
      {micCoupe && <IconeMicCoupe x={x + largeur / 2 - 10} y={y + 9.5} />}
    </g>
  );
}

/* ---------------------------- Un bureau d'élève ---------------------------- */
function Bureau({ occupant, selection, onSelection, monUsername }) {
  const vide = !occupant;
  const graine = hash(occupant?.identity || "vide");
  const couleurTrousse = COULEURS_OBJETS[graine % COULEURS_OBJETS.length];
  const couleurCrayon = COULEURS_OBJETS[(graine >> 3) % COULEURS_OBJETS.length];
  const choisi = occupant && selection === occupant.identity;

  return (
    <g
      className={vide ? "siege siege-vide" : "siege"}
      opacity={vide ? 0.5 : 1}
      onClick={() => occupant && onSelection && onSelection(occupant.identity)}
    >
      {/* Ombre portée */}
      <rect x="-42" y="-57" width="92" height="42" rx="6" fill="#000" opacity="0.2" />
      <rect x="-22" y="6" width="48" height="44" rx="10" fill="#000" opacity="0.14" />

      {/* Chaise : assise puis dossier (côté caméra) */}
      <rect x="-22" y="2" width="44" height="36" rx="9" fill="#c49a66" stroke="#9a7140" strokeWidth="1.5" />
      <rect x="-25" y="36" width="50" height="10" rx="5" fill="#a97f4d" stroke="#8a6238" strokeWidth="1.2" />

      {/* Bureau */}
      <rect x="-46" y="-62" width="92" height="42" rx="5" fill="#d9ac72" stroke="#a8793f" strokeWidth="2" />
      <rect x="-46" y="-26" width="92" height="6" rx="3" fill="#c4955c" />
      <g stroke="#8a5a28" strokeWidth="1" opacity="0.16">
        <path d="M -40 -54 H 40" />
        <path d="M -40 -46 H 40" />
        <path d="M -40 -38 H 40" />
      </g>

      {/* Objets sur le bureau (uniquement si quelqu'un est assis) */}
      {!vide && (
        <>
          <g transform="rotate(-4 -12 -42)">
            <rect x="-26" y="-58" width="28" height="34" rx="1.5" fill="#f7f6f0" stroke="#cfcdc2" strokeWidth="1" />
            <g stroke="#9aa3b5" strokeWidth="1" opacity="0.7">
              <path d="M -22 -51 H -2" />
              <path d="M -22 -45 H -6" />
              <path d="M -22 -39 H -3" />
            </g>
          </g>
          <rect x="24" y="-56" width="15" height="26" rx="4" fill={couleurTrousse} stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
          <rect x="31" y="-54" width="1.6" height="22" fill="rgba(255,255,255,0.35)" />
          <g transform="rotate(18 -34 -44)">
            <rect x="-36" y="-56" width="3.2" height="22" rx="1.4" fill={couleurCrayon} />
            <polygon points="-36,-34 -32.8,-34 -34.4,-29" fill="#e8c4a0" />
          </g>
        </>
      )}

      {/* L'élève */}
      {occupant && <AvatarDessus config={occupant.config} parle={occupant.parle} />}

      {/* Plaque de nom */}
      {occupant && (
        <Plaque
          x={0} y={53} nom={occupant.identity}
          moi={occupant.identity === monUsername} micCoupe={!occupant.micActif}
        />
      )}

      {choisi && (
        <rect x="-52" y="-68" width="104" height="142" rx="12" fill="none" stroke="#c9b6e4" strokeWidth="2" strokeDasharray="6 5" />
      )}

      {/* Zone cliquable (tout le poste de travail) */}
      <rect x="-52" y="-68" width="104" height="142" fill="transparent" />
    </g>
  );
}

/* ---------------------- Zone prof : mur, tableau, bureau ---------------------- */
function ZoneProf({ prof, nomClasse, texteTableau = "" }) {
  return (
    <g>
      {/* Mur du fond */}
      <rect x="0" y="0" width={LARGEUR} height="64" fill="url(#murClasse)" />
      <rect x="0" y="60" width={LARGEUR} height="6" fill="#aab6c4" />
      <rect x="0" y="66" width={LARGEUR} height="8" fill="#000" opacity="0.18" />

      {/* Porte */}
      <rect x="52" y="0" width="54" height="62" fill="#a8693f" stroke="#7a4a2a" strokeWidth="2" />
      <rect x="60" y="8" width="38" height="20" rx="2" fill="#b97a4e" />
      <rect x="60" y="34" width="38" height="22" rx="2" fill="#b97a4e" />
      <circle cx="98" cy="36" r="2.4" fill="#e8d6a0" />

      {/* Horloge */}
      <circle cx="140" cy="30" r="14" fill="#f4f7fa" stroke="#8b97a6" strokeWidth="2.5" />
      <path d="M 140 30 L 140 21 M 140 30 L 147 33" stroke="#2a2a35" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="140" cy="30" r="1.6" fill="#2a2a35" />

      {/* Écran de projection */}
      <rect x="180" y="5" width="200" height="50" rx="3" fill="#f6f8fb" stroke="#9aa7b5" strokeWidth="2" />
      <g fill="#c4d3e6">
        <rect x="196" y="16" width="90" height="5" rx="2" />
        <rect x="196" y="27" width="140" height="4" rx="2" />
        <rect x="196" y="36" width="116" height="4" rx="2" />
      </g>
      <rect x="320" y="14" width="46" height="22" rx="3" fill="#a9d3b8" opacity="0.8" />
      <rect x="200" y="53" width="160" height="4" rx="2" fill="#6f7c8c" />

      {/* Tableau noir : son contenu est écrit en direct par le professeur actuel. */}
      <rect x="412" y="5" width="262" height="52" rx="3" fill="#2f5242" stroke="#8b5e34" strokeWidth="4" />
      <rect x="418" y="11" width="250" height="40" rx="1" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x="430" y="19" fontFamily={POLICE} fontSize="7.5" fontWeight="700" fill="#f1f1e6" opacity="0.64">
        {raccourcir(nomClasse || "CLASSE", 28).toUpperCase()}
      </text>
      <foreignObject x="423" y="21" width="240" height="28">
        <div xmlns="http://www.w3.org/1999/xhtml" className="tableau-noir-contenu" aria-label="Contenu du tableau noir">
          {texteTableau || <span className="tableau-noir-vide">Le cours apparaîtra ici…</span>}
        </div>
      </foreignObject>
      <rect x="430" y="57" width="26" height="5" rx="1.5" fill="#f1f1e6" opacity="0.85" />
      <rect x="626" y="56" width="30" height="6" rx="1.5" fill="#e8c94a" />

      {/* Bureau du prof */}
      <rect x="322" y="106" width="156" height="30" rx="5" fill="#000" opacity="0.18" transform="translate(3 4)" />
      <rect x="322" y="106" width="156" height="30" rx="5" fill="#c99a62" stroke="#9a6d36" strokeWidth="2" />
      <rect x="340" y="110" width="40" height="22" rx="2" fill="#2a2a35" stroke="#555566" strokeWidth="1.2" />
      <rect x="344" y="113" width="32" height="14" rx="1" fill="#6fa3d6" opacity="0.55" />
      <circle cx="448" cy="121" r="6.5" fill="#f4f1ea" stroke="#c9c2b0" strokeWidth="1.2" />
      <circle cx="448" cy="121" r="4" fill="#8a5a45" />

      {/* Le prof : face à la classe → l'avatar est retourné */}
      {prof ? (
        <g transform="translate(400 84) rotate(180)">
          <AvatarDessus config={prof.config} parle={prof.parle} />
        </g>
      ) : (
        <text x="400" y="92" textAnchor="middle" fontFamily={POLICE} fontSize="12" fill="#ffffff" opacity="0.5">
          Pas de prof
        </text>
      )}

      <Plaque
        x={540} y={113} nom={prof ? prof.identity : "—"} prof largeur={96}
        moi={false} micCoupe={prof ? !prof.micActif : false}
      />
    </g>
  );
}

/* --------------------------- Décor : sol, murs, fenêtres --------------------------- */
function Fenetre({ x, y, gauche }) {
  const largeur = 26;
  const hauteur = 92;
  return (
    <g>
      <rect x={x} y={y} width={largeur} height={hauteur} rx="2" fill="#bfe0f5" stroke="#8b97a6" strokeWidth="3" />
      <path
        d={`M ${x} ${y + hauteur / 2} H ${x + largeur} M ${x + largeur / 2} ${y} V ${y + hauteur}`}
        stroke="#8b97a6" strokeWidth="2.4"
      />
      <path
        d={gauche
          ? `M ${x + 3} ${y + 6} L ${x + 12} ${y + 6} L ${x + 3} ${y + 24} Z`
          : `M ${x + largeur - 3} ${y + 6} L ${x + largeur - 12} ${y + 6} L ${x + largeur - 3} ${y + 24} Z`}
        fill="#ffffff" opacity="0.55"
      />
    </g>
  );
}

function Decor() {
  return (
    <g>
      {/* Sol : moquette bleue avec quadrillage discret */}
      <rect x="38" y="66" width="724" height={HAUTEUR - 66} fill="url(#solClasse)" />
      <rect x="38" y="66" width="724" height={HAUTEUR - 66} fill="url(#grilleSol)" />

      {/* Lumière qui entre par les fenêtres */}
      <polygon points="38,104 250,190 250,262 38,200" fill="#ffffff" opacity="0.07" />
      <polygon points="38,238 230,300 230,356 38,326" fill="#ffffff" opacity="0.05" />
      <polygon points="762,104 560,190 560,262 762,200" fill="#ffffff" opacity="0.07" />
      <polygon points="762,238 580,300 580,356 762,326" fill="#ffffff" opacity="0.05" />

      {/* Murs latéraux + plinthes */}
      <rect x="0" y="66" width="38" height={HAUTEUR - 66} fill="#cdd6e1" />
      <rect x="762" y="66" width="38" height={HAUTEUR - 66} fill="#cdd6e1" />
      <rect x="34" y="66" width="5" height={HAUTEUR - 66} fill="#8e9bab" />
      <rect x="761" y="66" width="5" height={HAUTEUR - 66} fill="#8e9bab" />
      <Fenetre x={6} y={98} gauche />
      <Fenetre x={6} y={228} gauche />
      <Fenetre x={768} y={98} gauche={false} />
      <Fenetre x={768} y={228} gauche={false} />

      {/* Plante en coin */}
      <g transform="translate(735 420)">
        <circle r="17" fill="#000" opacity="0.18" transform="translate(2 3)" />
        <circle r="14" fill="#a8693f" stroke="#7a4a2a" strokeWidth="2" />
        <g fill="#5fae6b" stroke="#3f8450" strokeWidth="1">
          <ellipse cx="0" cy="-9" rx="4" ry="9" />
          <ellipse cx="8" cy="-4" rx="4" ry="9" transform="rotate(70 8 -4)" />
          <ellipse cx="7" cy="6" rx="4" ry="9" transform="rotate(140 7 6)" />
          <ellipse cx="-7" cy="6" rx="4" ry="9" transform="rotate(-140 -7 6)" />
          <ellipse cx="-8" cy="-4" rx="4" ry="9" transform="rotate(-70 -8 -4)" />
        </g>
      </g>
    </g>
  );
}

/**
 * SceneClasse — la salle de classe vue du dessus, façon jeu vidéo.
 * Composant d'affichage pur : il reçoit tout par props (aucun état propre).
 *
 * occupants : tableau de NB_SIEGES entrées — null (place vide) ou
 *             { identity, config, parle, micActif }
 * prof      : null ou { identity, config, parle, micActif }
 */
export default function SceneClasse({ occupants, prof, nomClasse, texteTableau = "", monUsername, selection, onSelection }) {
  return (
    <svg
      className="scene-classe"
      viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Salle de classe vue du dessus"
    >
      <defs>
        <linearGradient id="solClasse" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c72a6" />
          <stop offset="1" stopColor="#3c4b78" />
        </linearGradient>
        <linearGradient id="murClasse" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6dee8" />
          <stop offset="1" stopColor="#bcc8d6" />
        </linearGradient>
        <pattern id="grilleSol" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.06" />
        </pattern>
        <radialGradient id="vignetteClasse" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0.55" stopColor="#0a0a0f" stopOpacity="0" />
          <stop offset="1" stopColor="#0a0a0f" stopOpacity="0.55" />
        </radialGradient>
      </defs>

      <Decor />
      <ZoneProf prof={prof} nomClasse={nomClasse} texteTableau={texteTableau} />

      {SIEGES.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y})`}>
          <Bureau
            occupant={occupants[i] || null}
            selection={selection}
            onSelection={onSelection}
            monUsername={monUsername}
          />
        </g>
      ))}

      <rect x="0" y="0" width={LARGEUR} height={HAUTEUR} fill="url(#vignetteClasse)" pointerEvents="none" />
    </svg>
  );
}
