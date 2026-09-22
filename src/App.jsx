import { useState, useEffect } from "react";
import Connexion from "./pages/Connexion.jsx";
import Questionnaire from "./pages/Questionnaire.jsx";
import FondAnime from "./components/FondAnime.jsx";

export default function App() {
  const [sessionToken, setSessionToken] = useState(null);
  const [profilComplet, setProfilComplet] = useState(false);

  useEffect(() => {
    const tokenSauvegarde = localStorage.getItem("grind_session_token");
    if (tokenSauvegarde) setSessionToken(tokenSauvegarde);
  }, []);

  if (!sessionToken) {
    return <Connexion onConnecte={(token) => setSessionToken(token)} />;
  }

  if (!profilComplet) {
    return <Questionnaire sessionToken={sessionToken} onTermine={() => setProfilComplet(true)} />;
  }

  // Prochaine étape : fil d'actu + classes — pas encore construit.
  return (
    <div className="page">
      <FondAnime />
      <div className="carte">
        <div className="logo-grind">
          <i className="fa-solid fa-brain"></i>
          <span>GRIND</span>
        </div>
        <div className="sous-titre">
          <i className="fa-solid fa-circle-check" style={{ color: "var(--succes)", marginRight: 6 }}></i>
          Profil enregistré. La suite arrive bientôt.
        </div>
      </div>
    </div>
  );
}
