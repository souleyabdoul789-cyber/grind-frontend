import { useState } from "react";
import { inscrireGrind, connecterGrind } from "../api.js";
import FondAnime from "../components/FondAnime.jsx";

export default function Connexion({ onConnecte }) {
  const [mode, setMode] = useState("login"); // "login" ou "signup"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);

  async function gererConnexion(e) {
    e.preventDefault();
    setErreur(null);

    if (mode === "signup" && password !== confirmation) {
      setErreur("Les mots de passe ne correspondent pas");
      return;
    }

    setChargement(true);
    try {
      if (mode === "signup") {
        await inscrireGrind(username, password, apiKey);
      }
      const resLogin = await connecterGrind(username, password);

      localStorage.setItem("grind_session_token", resLogin.session_token);
      localStorage.setItem("grind_username", resLogin.username);
      onConnecte(resLogin.session_token);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="page">
      <FondAnime />
      <div className="carte">
        <div className="logo-grind">
          <i className="fa-solid fa-brain"></i>
          <span>GRIND</span>
        </div>
        <div className="sous-titre">
          {mode === "login" ? "Connecte-toi à ton compte GRIND" : "Crée ton compte GRIND"}
        </div>

        <form onSubmit={gererConnexion}>
          <label><i className="fa-solid fa-user"></i> Nom d'utilisateur GRIND</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />

          <label><i className="fa-solid fa-lock"></i> Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {mode === "signup" && (
            <>
              <label><i className="fa-solid fa-lock"></i> Confirme le mot de passe</label>
              <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />

              <label><i className="fa-solid fa-key"></i> Clé API G-SOCIETY (catégorie grind)</label>
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} required placeholder="collée depuis G-SOCIETY" />
              <div className="info">
                <i className="fa-solid fa-circle-info"></i>
                Génère cette clé sur le site G-SOCIETY avant de continuer.
              </div>
            </>
          )}

          <button type="submit" disabled={chargement}>
            {chargement ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>

          {erreur && (
            <div className="erreur">
              <i className="fa-solid fa-triangle-exclamation"></i>
              {erreur}
            </div>
          )}
        </form>

        <button
          className="lien"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setErreur(null);
          }}
        >
          {mode === "login" ? "Pas encore de compte ? Inscris-toi" : "Déjà un compte ? Connecte-toi"}
        </button>
      </div>
    </div>
  );
}
