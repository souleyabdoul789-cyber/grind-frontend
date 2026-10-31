const PEAU = "#e8c4a0";
const COULEURS_AURA = { brand: "#c9b6e4", or: "#f5d485" };

/**
 * AvatarDessus — l'avatar vu DU DESSUS et DE DOS, tel qu'on le voit
 * assis à son bureau dans la vue de classe.
 *
 * Il lit exactement la même config que AvatarPersonnage (genre, cheveux,
 * vêtement, chapeau, lunettes, gants, aura) : un objet acheté apparaît donc
 * aussi bien dans le profil (vue de face) que dans la classe (vue de dessus).
 *
 * Repère : le centre de la tête est en (0, 0). L'avatar regarde vers le HAUT
 * (vers le tableau) : les bras partent vers y négatif, les épaules sont en
 * dessous de la tête, les cheveux longs retombent dans le dos (y positif).
 */
export default function AvatarDessus({ config, parle = false }) {
  const genre = (config?.genre || "genre_neutre").replace("genre_", "");
  const fille = genre === "fille";
  const garcon = genre === "garcon";

  const cheveux = fille ? "#4a2a35" : garcon ? "#1f1f28" : "#2a2a35";
  const veste = config?.vetement === "vetement_veste";
  const demi = garcon ? 31 : fille ? 24 : 28; // demi-largeur des épaules
  const couleurTorse = veste ? "#2a2a35" : "#d4c0d8";
  const couleurManche = veste ? "#33333f" : "#cdb8d6";
  const couleurMain = config?.gants ? (config.gants === "gants_sport" ? "#c9b6e4" : "#5a4a3a") : PEAU;
  const aura = COULEURS_AURA[config?.couleur_aura] || COULEURS_AURA.brand;

  const long = config?.cheveux === "cheveux_long";
  const mi = !long && fille;
  const noeud = long || fille;

  const bras = (cote) => {
    const s = cote; // -1 gauche, +1 droite
    return `M ${s * (demi - 8)} 19 Q ${s * (demi - 1)} -7 ${s * 12} -31`;
  };

  return (
    <g className={parle ? "avatar-dessus avatar-dessus-parle" : "avatar-dessus"}>
      {parle && (
        <>
          <circle cx="0" cy="10" r="46" fill={aura} opacity="0.16" />
          <circle className="anneau-parole" cx="0" cy="10" r="42" fill="none" stroke={aura} strokeWidth="3" />
        </>
      )}

      {/* Épaules / dos */}
      <ellipse cx="0" cy="24" rx={demi} ry="17" fill={couleurTorse} />
      <ellipse cx="0" cy="19" rx={demi - 7} ry="7" fill="#ffffff" opacity={veste ? 0.06 : 0.22} />
      <path d="M 0 12 L 0 41" stroke="#000000" strokeWidth="1.4" opacity={veste ? 0.35 : 0.1} />
      {veste && <path d={`M -9 10 Q 0 17 9 10`} stroke="#4a4a58" strokeWidth="2" fill="none" strokeLinecap="round" />}

      {/* Bras : manches = couleur du vêtement, mains = peau ou gants */}
      <path d={bras(-1)} stroke={couleurManche} strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d={bras(1)} stroke={couleurManche} strokeWidth="11" strokeLinecap="round" fill="none" />
      <circle cx="-11" cy="-32" r="5.6" fill={couleurMain} />
      <circle cx="11" cy="-32" r="5.6" fill={couleurMain} />

      {/* Nuque */}
      <ellipse cx="0" cy="14" rx="8" ry="6" fill={PEAU} />

      {/* Cheveux retombant dans le dos */}
      {long && (
        <path d="M -17 -2 Q -23 28 -15 48 Q 0 55 15 48 Q 23 28 17 -2 Z" fill={cheveux} />
      )}
      {mi && (
        <path d="M -17 -2 Q -21 18 -14 31 Q 0 36 14 31 Q 21 18 17 -2 Z" fill={cheveux} />
      )}
      {(long || mi) && <path d="M 0 6 L 0 40" stroke="#ffffff" strokeWidth="1.2" opacity="0.1" />}

      {/* Oreilles */}
      <circle cx="-18" cy="2" r="3.6" fill={PEAU} />
      <circle cx="18" cy="2" r="3.6" fill={PEAU} />

      {/* Branches de lunettes : seul indice visible de dos */}
      {config?.lunettes === "lunettes_rondes" && (
        <g stroke="#2a2a35" strokeWidth="1.8" strokeLinecap="round" fill="none">
          <path d="M -19 0 L -18 -11" />
          <path d="M 19 0 L 18 -11" />
        </g>
      )}

      {/* Visière de la casquette (dépasse devant la tête) */}
      {config?.chapeau === "chapeau_casquette" && (
        <path d="M -12 -13 Q 0 -31 12 -13 Z" fill="#6a4c39" />
      )}

      {/* Tête vue de dessus : on ne voit que les cheveux */}
      <circle cx="0" cy="0" r="17.5" fill={cheveux} />
      <path d="M -10 -9 Q 0 -16 10 -9" stroke="#ffffff" strokeWidth="3" opacity="0.15" fill="none" strokeLinecap="round" />
      <path d="M -8 -3 Q -3 -8 2 -4 M 4 1 Q 8 -4 11 2 M -4 7 Q 2 3 7 8" stroke="#ffffff" strokeWidth="1.5" opacity="0.1" fill="none" strokeLinecap="round" />
      {garcon && !long && (
        <path d="M -13 -8 L -9 -16 L -5 -9 L 0 -17 L 5 -9 L 9 -16 L 13 -8" stroke={cheveux} strokeWidth="3" fill="none" strokeLinejoin="round" />
      )}

      {/* Petit nœud */}
      {noeud && (
        <g transform="translate(10 -12) rotate(20)">
          <path d="M 0 0 L -8 -5 L -8 5 Z" fill="#c9b6e4" />
          <path d="M 0 0 L 8 -5 L 8 5 Z" fill="#c9b6e4" />
          <circle r="2.6" fill="#d8bfa6" />
        </g>
      )}

      {/* Casquette : dôme + coutures + bouton */}
      {config?.chapeau === "chapeau_casquette" && (
        <g>
          <circle cx="0" cy="0" r="15.5" fill="#7a5a45" />
          <path d="M 0 -15 Q -7 0 0 15 M 0 -15 Q 7 0 0 15 M -15 0 Q 0 -5 15 0" stroke="#5e4332" strokeWidth="1.2" fill="none" />
          <circle cx="0" cy="0" r="2.4" fill="#5e4332" />
        </g>
      )}
    </g>
  );
}
