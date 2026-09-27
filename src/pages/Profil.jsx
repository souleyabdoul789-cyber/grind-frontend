import { useState, useEffect } from "react";
import { GRIND_URL, obtenirMonAvatar } from "../api.js";
import { nomPays } from "../paysListe.js";
import AvatarPersonnage from "../components/AvatarPersonnage.jsx";
import Personnalisation from "./Personnalisation.jsx";

export default function Profil({ sessionToken, monUsername }) {
  const [profil, setProfil] = useState(null);
  const [avatarConfig, setAvatarConfig] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [personnalisationOuverte, setPersonnalisationOuverte] = useState(false);

  async function chargerTout() {
    setChargement(true);
    const [resProfil, resAvatar] = await Promise.all([
      fetch(`${GRIND_URL}/api/profil/moi?session_token=${encodeURIComponent(sessionToken)}`).then((r) => r.json()),
      obtenirMonAvatar(sessionToken),
    ]);
    setProfil(resProfil);
    setAvatarConfig(resAvatar.config);
    setChargement(false);
  }

  useEffect(() => {
    chargerTout();
  }, [sessionToken]);

  if (personnalisationOuverte) {
    return (
      <Personnalisation
        sessionToken={sessionToken}
        onRetour={() => {
          setPersonnalisationOuverte(false);
          chargerTout();
        }}
      />
    );
  }

  if (chargement) {
    return (
      <div className="fil-actu">
        <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>
      </div>
    );
  }

  let difficultesListe = [];
  try {
    difficultesListe = JSON.parse(profil.difficultes || "[]");
  } catch {
    difficultesListe = (profil.difficultes || "").split(",").map((d) => d.trim()).filter(Boolean);
  }

  return (
    <div className="fil-actu">
      <div className="carte-post entete-profil">
        <div className="apercu-avatar" style={{ padding: 0, background: "none", marginBottom: 8 }}>
          <AvatarPersonnage config={avatarConfig} taille={120} />
        </div>
        <div className="auteur-post" style={{ fontSize: 20 }}>{monUsername}</div>
        <button type="button" onClick={() => setPersonnalisationOuverte(true)} style={{ marginTop: 12 }}>
          <i className="fa-solid fa-shirt"></i> Personnaliser mon avatar
        </button>
      </div>

      <div className="carte-post">
        <div className="ligne-info">
          <span className={`fi fi-${profil.pays} drapeau`}></span>
          <span>{nomPays(profil.pays)}</span>
        </div>
        <div className="ligne-info">
          <i className="fa-solid fa-graduation-cap"></i>
          <span>{profil.niveau}</span>
        </div>
        <div className="ligne-info">
          <i className="fa-solid fa-cake-candles"></i>
          <span>{profil.age} ans</span>
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
    </div>
  );
}
