import { useState, useEffect } from "react";
import { GRIND_URL, obtenirMonAvatar, modifierNomProfil } from "../api.js";
import { nomPays } from "../paysListe.js";
import AvatarPersonnage from "../components/AvatarPersonnage.jsx";
import Personnalisation from "./Personnalisation.jsx";

export default function Profil({ sessionToken, monUsername }) {
  const [profil, setProfil] = useState(null);
  const [avatarConfig, setAvatarConfig] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [personnalisationOuverte, setPersonnalisationOuverte] = useState(false);
  const [nomEdite, setNomEdite] = useState(monUsername || "");
  const [editionNom, setEditionNom] = useState(false);
  const [erreurNom, setErreurNom] = useState("");
  const [enregistrementNom, setEnregistrementNom] = useState(false);

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

  async function enregistrerNouveauNom() {
    setErreurNom(""); setEnregistrementNom(true);
    try { const r = await modifierNomProfil(sessionToken, nomEdite); window.dispatchEvent(new CustomEvent("grind-username-changed", { detail: r.username })); setEditionNom(false); }
    catch (e) { setErreurNom(e.message || "Modification impossible"); }
    finally { setEnregistrementNom(false); }
  }

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
        <div className="auteur-post" style={{ fontSize: 20 }}>@{monUsername}</div>
        {editionNom ? (
          <div style={{ width: "100%", maxWidth: 320, marginTop: 10 }}>
            <input value={nomEdite} onChange={e => setNomEdite(e.target.value)} maxLength={24} autoComplete="off" aria-label="Nouveau nom de profil" />
            <small>3 à 24 caractères : lettres et underscores uniquement.</small>
            {erreurNom && <p role="alert">{erreurNom}</p>}
            <button type="button" disabled={enregistrementNom} onClick={enregistrerNouveauNom}>{enregistrementNom ? "Enregistrement…" : "Enregistrer"}</button>
            <button type="button" onClick={() => { setEditionNom(false); setNomEdite(monUsername); }}>Annuler</button>
          </div>
        ) : <button type="button" onClick={() => setEditionNom(true)} style={{ marginTop: 8 }}>Modifier mon nom de profil</button>}
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
        {profil.filiere && <div className="ligne-info"><i className="fa-solid fa-book-open"></i><span>{profil.filiere}</span></div>}
        {profil.etablissement && <div className="ligne-info"><i className="fa-solid fa-school"></i><span>{profil.etablissement}</span></div>}
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
