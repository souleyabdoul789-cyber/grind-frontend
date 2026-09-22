import { useState, useEffect } from "react";
import { GRIND_URL } from "../api.js";
import { nomPays } from "../paysListe.js";

export default function Profil({ sessionToken, monUsername }) {
  const [profil, setProfil] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    fetch(`${GRIND_URL}/api/profil/moi?session_token=${encodeURIComponent(sessionToken)}`)
      .then((r) => r.json())
      .then((data) => {
        setProfil(data);
        setChargement(false);
      });
  }, [sessionToken]);

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
        <div className="avatar-profil">
          <i className="fa-solid fa-user-astronaut"></i>
        </div>
        <div className="auteur-post" style={{ fontSize: 20 }}>{monUsername}</div>
        <div className="info" style={{ marginTop: 4 }}>
          <i className="fa-solid fa-circle-info"></i>
          Avatar personnalisable bientôt disponible
        </div>
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
