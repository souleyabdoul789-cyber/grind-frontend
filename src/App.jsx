import { useState, useEffect } from "react";
import Connexion from "./pages/Connexion.jsx";
import Questionnaire from "./pages/Questionnaire.jsx";
import FilActu from "./pages/FilActu.jsx";
import Classes from "./pages/Classes.jsx";
import Profil from "./pages/Profil.jsx";
import Reglages from "./pages/Reglages.jsx";
import BureauAdmin from "./pages/BureauAdmin.jsx";
import ModaleAcceptationCgu from "./components/ModaleAcceptationCgu.jsx";
import { obtenirMonStatut } from "./api.js";
import { oublierBloques } from "./blocages.js";
import BarreNav from "./components/BarreNav.jsx";
import FondAnime from "./components/FondAnime.jsx";

function extraireCodeDepuisUrl() {
  const correspondance = window.location.pathname.match(/^\/rejoindre\/(.+)$/);
  return correspondance ? decodeURIComponent(correspondance[1]) : null;
}

export default function App() {
  const [sessionToken, setSessionToken] = useState(null);
  const [profilComplet, setProfilComplet] = useState(false);
  const [username, setUsername] = useState(null);
  const [codeAttente, setCodeAttente] = useState(extraireCodeDepuisUrl());
  const [onglet, setOnglet] = useState(codeAttente ? "classes" : "fil");
  const [statut, setStatut] = useState(null); // { role, est_equipe, cgu_a_accepter, ... }
  const [role, setRole] = useState(null); // "admin" : compte administrateur (entré avec la clé)

  useEffect(() => {
    const tokenSauvegarde = localStorage.getItem("grind_session_token");
    const usernameSauvegarde = localStorage.getItem("grind_username");
    if (tokenSauvegarde) {
      setSessionToken(tokenSauvegarde);
      setUsername(usernameSauvegarde);
      setProfilComplet(!!localStorage.getItem("grind_profil_complet"));
      setRole(localStorage.getItem("grind_role") || null);
    }
  }, []);

  // Statut du compte : droits d'administration et acceptation des CGU.
  useEffect(() => {
    if (!sessionToken || !profilComplet || role === "admin") return;
    obtenirMonStatut(sessionToken)
      .then(setStatut)
      .catch((err) => {
        // Session morte (expirée, ou compte suspendu/banni entre-temps) : retour à la connexion.
        if (String(err.message).includes("Session GRIND invalide")) deconnecter();
      });
  }, [sessionToken, profilComplet, role]);

  function deconnecter() {
    localStorage.removeItem("grind_session_token");
    localStorage.removeItem("grind_username");
    localStorage.removeItem("grind_profil_complet");
    localStorage.removeItem("grind_role");
    oublierBloques();
    setSessionToken(null);
    setProfilComplet(false);
    setStatut(null);
    setRole(null);
    setOnglet("fil");
  }

  function consommerCode() {
    setCodeAttente(null);
    window.history.replaceState({}, "", "/");
  }

  if (!sessionToken) {
    return (
      <Connexion
        onConnecte={(token) => {
          setSessionToken(token);
          setUsername(localStorage.getItem("grind_username"));
          setRole(localStorage.getItem("grind_role") || null);
        }}
      />
    );
  }

  // L'administrateur n'est pas un élève : il ne voit ni classes, ni fil, ni avatar,
  // ni réglages — uniquement son bureau d'administration.
  if (role === "admin") {
    return (
      <div className="app-shell">
        <FondAnime />
        <BureauAdmin sessionToken={sessionToken} role="admin" autonome onDeconnexion={deconnecter} />
      </div>
    );
  }

  if (!profilComplet) {
    return (
      <Questionnaire
        sessionToken={sessionToken}
        onTermine={() => {
          localStorage.setItem("grind_profil_complet", "1");
          setProfilComplet(true);
          if (codeAttente) setOnglet("classes");
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <FondAnime />
      <BarreNav sessionToken={sessionToken} ongletActif={onglet} onChangerOnglet={setOnglet} estEquipe={!!statut?.est_equipe} />

      {onglet === "fil" && <FilActu sessionToken={sessionToken} monUsername={username} />}
      {onglet === "classes" && (
        <Classes sessionToken={sessionToken} monUsername={username} codeAttente={codeAttente} onCodeConsomme={consommerCode} />
      )}
      {onglet === "profil" && <Profil sessionToken={sessionToken} monUsername={username} />}
      {onglet === "reglages" && <Reglages sessionToken={sessionToken} onDeconnexion={deconnecter} />}
      {onglet === "admin" && statut?.est_equipe && <BureauAdmin sessionToken={sessionToken} role={statut.role} />}

      {statut?.cgu_a_accepter && (
        <ModaleAcceptationCgu
          sessionToken={sessionToken}
          onAccepte={() => setStatut({ ...statut, cgu_a_accepter: false })}
          onRefuse={deconnecter}
        />
      )}
    </div>
  );
}
