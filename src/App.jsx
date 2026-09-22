import { useState, useEffect } from "react";
import Connexion from "./pages/Connexion.jsx";
import Questionnaire from "./pages/Questionnaire.jsx";
import FilActu from "./pages/FilActu.jsx";
import Profil from "./pages/Profil.jsx";
import Reglages from "./pages/Reglages.jsx";
import BarreNav from "./components/BarreNav.jsx";
import FondAnime from "./components/FondAnime.jsx";

export default function App() {
  const [sessionToken, setSessionToken] = useState(null);
  const [profilComplet, setProfilComplet] = useState(false);
  const [username, setUsername] = useState(null);
  const [onglet, setOnglet] = useState("fil");

  useEffect(() => {
    const tokenSauvegarde = localStorage.getItem("grind_session_token");
    const usernameSauvegarde = localStorage.getItem("grind_username");
    if (tokenSauvegarde) {
      setSessionToken(tokenSauvegarde);
      setUsername(usernameSauvegarde);
      setProfilComplet(!!localStorage.getItem("grind_profil_complet"));
    }
  }, []);

  function deconnecter() {
    localStorage.removeItem("grind_session_token");
    localStorage.removeItem("grind_username");
    localStorage.removeItem("grind_profil_complet");
    setSessionToken(null);
    setProfilComplet(false);
    setOnglet("fil");
  }

  if (!sessionToken) {
    return (
      <Connexion
        onConnecte={(token) => {
          setSessionToken(token);
          setUsername(localStorage.getItem("grind_username"));
        }}
      />
    );
  }

  if (!profilComplet) {
    return (
      <Questionnaire
        sessionToken={sessionToken}
        onTermine={() => {
          localStorage.setItem("grind_profil_complet", "1");
          setProfilComplet(true);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <FondAnime />
      <BarreNav sessionToken={sessionToken} ongletActif={onglet} onChangerOnglet={setOnglet} />

      {onglet === "fil" && <FilActu sessionToken={sessionToken} monUsername={username} />}
      {onglet === "profil" && <Profil sessionToken={sessionToken} monUsername={username} />}
      {onglet === "reglages" && <Reglages sessionToken={sessionToken} onDeconnexion={deconnecter} />}
    </div>
  );
}
