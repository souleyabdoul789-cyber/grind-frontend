import { useState, useEffect } from "react";
import Connexion from "./pages/Connexion.jsx";
import Questionnaire from "./pages/Questionnaire.jsx";
import FilActu from "./pages/FilActu.jsx";
import Classes from "./pages/Classes.jsx";
import Profil from "./pages/Profil.jsx";
import Reglages from "./pages/Reglages.jsx";
import BureauAdmin from "./pages/BureauAdmin.jsx";
import ModaleAcceptationCgu from "./components/ModaleAcceptationCgu.jsx";
import { obtenirMonStatut, deconnecterGrind, statutPin, relockerPin } from "./api.js";
import { oublierBloques } from "./blocages.js";
import BarreNav from "./components/BarreNav.jsx";
import FondAnime from "./components/FondAnime.jsx";
import EspaceProviseur from "./pages/EspaceProviseur.jsx";
import VerrouPin from "./components/VerrouPin.jsx";

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
  const [role, setRole] = useState(null); // rôle global de l'équipe GRIND
  const [typeCompte, setTypeCompte] = useState("eleve");
  const [pinStatus, setPinStatus] = useState(null);
  const [changementCompteEnCours, setChangementCompteEnCours] = useState(false);

  useEffect(() => {
    const tokenSauvegarde = localStorage.getItem("grind_session_token");
    const usernameSauvegarde = localStorage.getItem("grind_username");
    if (tokenSauvegarde) {
      setSessionToken(tokenSauvegarde);
      setUsername(usernameSauvegarde);
      setProfilComplet(!!localStorage.getItem("grind_profil_complet"));
      setRole(localStorage.getItem("grind_role") || null);
      setTypeCompte(localStorage.getItem("grind_type_compte") || "eleve");
    }
  }, []);


  useEffect(() => {
    if (!sessionToken) { setPinStatus(null); return; }
    let actif = true;
    setPinStatus({ loading: true });
    statutPin(sessionToken)
      .then((status) => { if (actif) setPinStatus({ ...status, loading: false }); })
      .catch(() => {
        if (!actif) return;
        localStorage.removeItem("grind_session_token");
        localStorage.removeItem("grind_username");
        setSessionToken(null); setUsername(null); setPinStatus(null);
      });
    return () => { actif = false; };
  }, [sessionToken]);

  useEffect(() => {
    const majNom = (event) => {
      const nouveau = event.detail;
      if (!nouveau) return;
      const ancien = localStorage.getItem("grind_username");
      setUsername(nouveau);
      localStorage.setItem("grind_username", nouveau);
      try {
        const comptes = JSON.parse(localStorage.getItem("grind_accounts") || "[]");
        localStorage.setItem("grind_accounts", JSON.stringify(comptes.map(c => c.username === ancien ? { ...c, username: nouveau } : c)));
      } catch {}
    };
    window.addEventListener("grind-username-changed", majNom);
    return () => window.removeEventListener("grind-username-changed", majNom);
  }, []);

  // Re-verrouille l'interface au terme exact des 48 h, même si l'onglet reste ouvert.
  useEffect(() => {
    if (!sessionToken || !pinStatus || pinStatus.loading || pinStatus.required || !pinStatus.configured) return;
    const delai = Math.max(0, Number(pinStatus.remaining_seconds || 0) * 1000 + 500);
    const timer = window.setTimeout(async () => {
      try {
        const nouveauStatut = await statutPin(sessionToken);
        setPinStatus({ ...nouveauStatut, loading: false });
      } catch {
        localStorage.removeItem("grind_session_token");
        setSessionToken(null); setUsername(null); setPinStatus(null);
      }
    }, delai);
    return () => window.clearTimeout(timer);
  }, [sessionToken, pinStatus]);

  async function apresValidationPin() {
    try {
      const nouveauStatut = await statutPin(sessionToken);
      setPinStatus({ ...nouveauStatut, loading: false });
    } catch {
      localStorage.removeItem("grind_session_token");
      setSessionToken(null); setUsername(null); setPinStatus(null);
    }
  }

  // Statut du compte : droits d'administration et acceptation des CGU.
  useEffect(() => {
    if (!sessionToken || !profilComplet || role === "admin" || typeCompte === "proviseur") return;
    obtenirMonStatut(sessionToken)
      .then(setStatut)
      .catch((err) => {
        // Session morte (expirée, ou compte suspendu/banni entre-temps) : retour à la connexion.
        if (String(err.message).includes("Session GRIND invalide")) deconnecter();
      });
  }, [sessionToken, profilComplet, role, typeCompte]);

  function deconnecter() {
    // Déconnexion RÉELLE : la session est aussi supprimée côté serveur (le jeton ne sert plus, même volé).
    if (sessionToken) deconnecterGrind(sessionToken).catch(() => {});
    const usernameActif = localStorage.getItem("grind_username");
    try {
      const comptes = JSON.parse(localStorage.getItem("grind_accounts") || "[]").filter((c) => c.username !== usernameActif);
      localStorage.setItem("grind_accounts", JSON.stringify(comptes));
    } catch { localStorage.removeItem("grind_accounts"); }
    localStorage.removeItem("grind_session_token");
    localStorage.removeItem("grind_username");
    localStorage.removeItem("grind_profil_complet");
    localStorage.removeItem("grind_role");
    localStorage.removeItem("grind_type_compte");
    oublierBloques();
    setSessionToken(null);
    setProfilComplet(false);
    setStatut(null);
    setRole(null);
    setTypeCompte("eleve");
    setOnglet("fil");
  }

  async function changerCompte() {
    if (changementCompteEnCours) return;
    setChangementCompteEnCours(true);
    try {
      if (sessionToken) { try { await relockerPin(sessionToken); } catch { /* la connexion mémorisée sera réévaluée */ } }
      localStorage.removeItem("grind_session_token");
      localStorage.removeItem("grind_username");
      localStorage.removeItem("grind_role");
      localStorage.removeItem("grind_type_compte");
      localStorage.removeItem("grind_profil_complet");
      setSessionToken(null); setUsername(null); setPinStatus(null); setStatut(null);
      setRole(null); setTypeCompte("eleve"); setProfilComplet(false);
    } finally {
      setChangementCompteEnCours(false);
    }
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
          setTypeCompte(localStorage.getItem("grind_type_compte") || "eleve");
        }}
      />
    );
  }

  if (!pinStatus || pinStatus.loading || pinStatus.required) {
    return <VerrouPin sessionToken={sessionToken} statut={pinStatus} onValide={apresValidationPin} />;
  }

  // L'administrateur n'est pas un élève : il ne voit ni classes, ni fil, ni avatar,
  // ni réglages — uniquement son bureau d'administration.
  if (role === "admin") {
    return (
      <div className="app-shell">
        <FondAnime />
        <BureauAdmin sessionToken={sessionToken} role="admin" autonome onDeconnexion={deconnecter} onChangerCompte={changerCompte} changementCompteEnCours={changementCompteEnCours} />
      </div>
    );
  }

  if (typeCompte === "proviseur") {
    return (
      <div className="app-shell">
        <FondAnime />
        <EspaceProviseur sessionToken={sessionToken} onDeconnexion={deconnecter} onChangerCompte={changerCompte} changementCompteEnCours={changementCompteEnCours} />
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
      <BarreNav sessionToken={sessionToken} monUsername={username} ongletActif={onglet} onChangerOnglet={setOnglet} estEquipe={!!statut?.est_equipe} onChangerCompte={changerCompte} changementCompteEnCours={changementCompteEnCours} />

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
