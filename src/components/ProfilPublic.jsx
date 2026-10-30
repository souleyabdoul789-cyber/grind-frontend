import { useState, useEffect } from "react";
import { obtenirProfilDe, obtenirAvatarDe } from "../api.js";
import { nomPays } from "../paysListe.js";
import AvatarPersonnage from "./AvatarPersonnage.jsx";

export default function ProfilPublic({ username, onRetour }) {
  const [profil, setProfil] = useState(null);
  const [avatarConfig, setAvatarConfig] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    async function charger() {
      const [resProfil, resAvatar] = await Promise.all([
        obtenirProfilDe(username),
        obtenirAvatarDe(username),
      ]);
      setProfil(resProfil);
      setAvatarConfig(resAvatar.config);
      setChargement(false);
    }
    charger();
  }, [username]);

  if (chargement) {
    return (
      <div className="fil-actu">
        <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>
      </div>
    );
  }

  let difficultesListe = [];
  try {
    difficultesListe = JSON.parse(profil?.difficultes || "[]");
  } catch {
    difficultesListe = (profil?.difficultes || "").split(",").map((d) => d.trim()).filter(Boolean);
  }

  return (
    <div className="fil-actu">
      <button type="button" className="lien" onClick={onRetour} style={{ marginBottom: 12 }}>
        <i className="fa-solid fa-arrow-left"></i> Retour
      </button>

      <div className="carte-post entete-profil">
        <div className="apercu-avatar" style={{ padding: 0, background: "none", marginBottom: 8 }}>
          <AvatarPersonnage config={avatarConfig} taille={120} />
        </div>
        <div className="auteur-post" style={{ fontSize: 20 }}>{username}</div>
      </div>

      {profil?.profil_existe ? (
        <>
          <div className="carte-post">
            <div className="ligne-info">
              <span className={`fi fi-${profil.pays} drapeau`}></span>
              <span>{nomPays(profil.pays)}</span>
            </div>
            <div className="ligne-info">
              <i className="fa-solid fa-graduation-cap"></i>
              <span>{profil.niveau}</span>
            </div>
          </div>

          {difficultesListe.length > 0 && (
            <div className="carte-post">
              <div className="sous-titre" style={{ marginBottom: 10 }}>Matières à travailler</div>
              <div className="choix-categorie" style={{ flexWrap: "wrap" }}>
                {difficultesListe.map((d, i) => (
                  <span key={i} className="chip">{d}</span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="info"><i className="fa-solid fa-circle-info"></i> Profil pas encore rempli.</div>
      )}
    </div>
  );
}
