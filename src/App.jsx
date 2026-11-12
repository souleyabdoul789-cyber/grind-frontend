import { useState, useEffect } from "react";
import Connexion from "./pages/Connexion.jsx";
import Questionnaire from "./pages/Questionnaire.jsx";
import FilActu from "./pages/FilActu.jsx";
import Classes from "./pages/Classes.jsx";
import Profil from "./pages/Profil.jsx";
import Reglages from "./pages/Reglages.jsx";
import BureauAdmin from "./pages/BureauAdmin.jsx";
import ModaleAcceptationCgu from "./components/ModaleAcceptationCgu.jsx";
import { obtenirMonStatut, deconnecterGrind, statutPin, relockerPin, obtenirMonProfil } from "./api.js";
import { oublierBloques } from "./blocages.js";
import BarreNav from "./components/BarreNav.jsx";
import FondAnime from "./components/FondAnime.jsx";
import EspaceProviseur from "./pages/EspaceProviseur.jsx";
import VerrouPin from "./components/VerrouPin.jsx";
import GestionComptes from "./components/GestionComptes.jsx";
import Library from "./pages/Library.jsx";
import BienvenueGrind from "./components/BienvenueGrind.jsx";
import PaysIndisponible from "./components/PaysIndisponible.jsx";
import { statutBienvenue, verifierAccesPays } from "./api.js";

function extraireCodeDepuisUrl() {
  const correspondance = window.location.pathname.match(/^\/rejoindre\/(.+)$/);
  return correspondance ? decodeURIComponent(correspondance[1]) : null;
}

export default function App() {
  const [sessionToken, setSessionToken] = useState(null);
  const [profilComplet, setProfilComplet] = useState(false);
  const [profilPret, setProfilPret] = useState(false);
  const [profilErreur, setProfilErreur] = useState("");
  const [username, setUsername] = useState(null);
  const [codeAttente, setCodeAttente] = useState(extraireCodeDepuisUrl());
  const [onglet, setOnglet] = useState(codeAttente ? "classes" : "fil");
  const [statut, setStatut] = useState(null); // { role, est_equipe, cgu_a_accepter, ... }
  const [role, setRole] = useState(null); // rôle global de l'équipe GRIND
  const [typeCompte, setTypeCompte] = useState("eleve");
  const [pinStatus, setPinStatus] = useState(null);
  const [changementCompteEnCours, setChangementCompteEnCours] = useState(false);
  const [gestionComptesOuverte, setGestionComptesOuverte] = useState(false);
  const [paysAccess, setPaysAccess] = useState({ loading: true, blocked: false });
  const [forcerConnexionAdmin, setForcerConnexionAdmin] = useState(false);
  const [bienvenueOuverte, setBienvenueOuverte] = useState(false);
  const [bienvenueVerifiee, setBienvenueVerifiee] = useState(false);
  const [documentLibraryAouvrir, setDocumentLibraryAouvrir] = useState(null);
  const [postAouvrir, setPostAouvrir] = useState(null);

  async function initialiserSession(token, donnees = {}) {
    setBienvenueOuverte(false);
    setBienvenueVerifiee(false);
    const nouveauRole = donnees.role ?? localStorage.getItem("grind_role") ?? null;
    const nouveauType = donnees.type_compte ?? localStorage.getItem("grind_type_compte") ?? "eleve";
    const nouveauUsername = donnees.username ?? localStorage.getItem("grind_username");

    setSessionToken(token);
    setUsername(nouveauUsername);
    setRole(nouveauRole);
    setTypeCompte(nouveauType);
    setProfilErreur("");

    if (nouveauRole === "admin" || nouveauType === "proviseur") {
      setProfilComplet(true);
      setProfilPret(true);
      localStorage.setItem("grind_profil_complet", "1");
      return;
    }

    if (typeof donnees.profil_complet === "boolean") {
      setProfilComplet(donnees.profil_complet);
      setProfilPret(true);
      if (donnees.profil_complet) localStorage.setItem("grind_profil_complet", "1");
      else localStorage.removeItem("grind_profil_complet");
      return;
    }

    // Session ancienne ou mémorisée : vérifier le profil après la validation éventuelle du PIN.
    // Le middleware de session refuse volontairement les routes privées tant que le PIN est expiré.
    setProfilPret(false);
  }

  async function verifierProfilServeur(token) {
    setProfilPret(false);
    setProfilErreur("");
    try {
      const profil = await obtenirMonProfil(token);
      if (localStorage.getItem("grind_session_token") !== token) return;
      const complet = profil.profil_complet === true || (!!profil.profil_existe && profil.profil_complet !== false);
      setProfilComplet(complet);
      if (complet) localStorage.setItem("grind_profil_complet", "1");
      else localStorage.removeItem("grind_profil_complet");
      setProfilPret(true);
    } catch (erreur) {
      if (localStorage.getItem("grind_session_token") !== token) return;
      setProfilErreur(erreur.message || "Impossible de vérifier le profil sur le serveur.");
      setProfilPret(true);
    }
  }

  useEffect(() => {
    const ouvrirDocument = (event) => { setDocumentLibraryAouvrir(Number(event.detail)); setOnglet("library"); };
    const ouvrirPublication = (event) => { setPostAouvrir(event.detail); setOnglet("fil"); };
    window.addEventListener("grind-open-library-doc", ouvrirDocument);
    window.addEventListener("grind-navigate-post", ouvrirPublication);
    return () => { window.removeEventListener("grind-open-library-doc", ouvrirDocument); window.removeEventListener("grind-navigate-post", ouvrirPublication); };
  }, []);

  useEffect(() => {
    let actif = true;
    verifierAccesPays().then((r) => {
      if (actif) setPaysAccess({ loading: false, blocked: r.allowed === false, country: r.country_name, message: r.message });
    }).catch(() => { if (actif) setPaysAccess({ loading: false, blocked: false }); });
    return () => { actif = false; };
  }, []);

  useEffect(() => {
    if (!sessionToken || !profilComplet || role === "admin" || bienvenueVerifiee) return;
    let actif = true;
    statutBienvenue(sessionToken).then((r) => { if (actif) { setBienvenueOuverte(r.a_afficher === true); setBienvenueVerifiee(true); } })
      .catch(() => { if (actif) setBienvenueVerifiee(true); });
    return () => { actif = false; };
  }, [sessionToken, profilComplet, role, typeCompte, bienvenueVerifiee]);

  useEffect(() => {
    const tokenSauvegarde = localStorage.getItem("grind_session_token");
    if (tokenSauvegarde) {
      initialiserSession(tokenSauvegarde, {
        username: localStorage.getItem("grind_username"),
        role: localStorage.getItem("grind_role") || null,
        type_compte: localStorage.getItem("grind_type_compte") || "eleve",
      });
    } else {
      setProfilPret(true);
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
    if (!sessionToken || !pinStatus || pinStatus.loading || pinStatus.required || profilPret) return;
    if (role === "admin" || typeCompte === "proviseur") return;
    verifierProfilServeur(sessionToken);
  }, [sessionToken, pinStatus, profilPret, role, typeCompte]);

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
    setProfilPret(true);
    setProfilErreur("");
    setStatut(null);
    setRole(null);
    setTypeCompte("eleve");
    setBienvenueOuverte(false);
    setBienvenueVerifiee(false);
    setForcerConnexionAdmin(false);
    setOnglet("fil");
  }

  function ouvrirGestionComptes() {
    setGestionComptesOuverte(true);
  }

  async function changerCompte() {
    if (changementCompteEnCours) return;
    setChangementCompteEnCours(true);
    try {
      if (sessionToken) { try { await relockerPin(sessionToken); } catch { /* le PIN sera contrôlé à la prochaine utilisation */ } }
      // On conserve grind_accounts : l'ajout d'un compte ne doit pas effacer les autres sessions mémorisées.
      localStorage.removeItem("grind_session_token");
      localStorage.removeItem("grind_username");
      localStorage.removeItem("grind_role");
      localStorage.removeItem("grind_type_compte");
      localStorage.removeItem("grind_profil_complet");
      setGestionComptesOuverte(false);
      setOnglet("fil");
      setSessionToken(null); setUsername(null); setPinStatus(null); setStatut(null);
      setRole(null); setTypeCompte("eleve"); setProfilComplet(false); setProfilPret(true); setProfilErreur("");
    } finally {
      setChangementCompteEnCours(false);
    }
  }

  async function selectionnerCompteMemorise(compte) {
    if (!compte?.token || compte.token === sessionToken) return;
    if (changementCompteEnCours) return;
    setChangementCompteEnCours(true);
    try {
      // Les deux sessions sont verrouillées avant le basculement : le PIN du compte cible sera demandé.
      if (sessionToken) { try { await relockerPin(sessionToken); } catch { /* la session cible reste contrôlée par le serveur */ } }
      try { await relockerPin(compte.token); } catch { /* statutPin détectera une session expirée ou invalide */ }
      localStorage.setItem("grind_session_token", compte.token);
      localStorage.setItem("grind_username", compte.username);
      localStorage.setItem("grind_role", compte.role || "");
      localStorage.setItem("grind_type_compte", compte.type_compte || "eleve");
      localStorage.removeItem("grind_profil_complet");
      oublierBloques();
      setStatut(null);
      setPinStatus({ loading: true });
      setGestionComptesOuverte(false);
      setOnglet("fil");
      await initialiserSession(compte.token, {
        username: compte.username,
        role: compte.role || null,
        type_compte: compte.type_compte || "eleve",
      });
    } finally {
      setChangementCompteEnCours(false);
    }
  }

  function consommerCode() {
    setCodeAttente(null);
    window.history.replaceState({}, "", "/");
  }

  if (paysAccess.loading) {
    return <div className="country-check" role="status"><span className="grind-spinner" /><p>Vérification de la disponibilité de GRIND…</p></div>;
  }

  if (paysAccess.blocked && role !== "admin" && (!forcerConnexionAdmin || !!sessionToken)) {
    return <PaysIndisponible
      pays={paysAccess.country}
      message={paysAccess.message}
      onAdmin={() => { if (sessionToken) deconnecter(); setForcerConnexionAdmin(true); }}
    />;
  }

  if (!sessionToken) {
    return (
      <Connexion
        onConnecte={(token, donnees) => initialiserSession(token, donnees || {})}
      />
    );
  }

  if (!pinStatus || pinStatus.loading || pinStatus.required) {
    return <VerrouPin sessionToken={sessionToken} statut={pinStatus} onValide={apresValidationPin} />;
  }

  if (gestionComptesOuverte) {
    return (
      <div className="app-shell">
        <FondAnime />
        <GestionComptes
          sessionToken={sessionToken}
          monUsername={username}
          role={role}
          compteType={typeCompte}
          chargementAction={changementCompteEnCours}
          onRetour={() => setGestionComptesOuverte(false)}
          onAjouter={changerCompte}
          onSelectionner={selectionnerCompteMemorise}
        />
      </div>
    );
  }

  // L'administrateur n'est pas un élève : il ne voit ni classes, ni fil, ni avatar,
  // ni réglages — uniquement son bureau d'administration.
  if (role === "admin") {
    return (
      <div className="app-shell">
        <FondAnime />
        <BureauAdmin sessionToken={sessionToken} role="admin" autonome onDeconnexion={deconnecter} onChangerCompte={ouvrirGestionComptes} changementCompteEnCours={false} />
      </div>
    );
  }

  if (typeCompte === "proviseur") {
    return (
      <div className="app-shell">
        <FondAnime />
        <EspaceProviseur sessionToken={sessionToken} onDeconnexion={deconnecter} onChangerCompte={ouvrirGestionComptes} changementCompteEnCours={false} />
        {bienvenueOuverte && <BienvenueGrind sessionToken={sessionToken} onTermine={() => setBienvenueOuverte(false)} />}
      </div>
    );
  }

  if (!profilPret) {
    return <div className="app-shell"><FondAnime /><div className="info profil-verification-chargement"><span className="grind-spinner" aria-hidden="true" /> Vérification du profil GRIND…</div></div>;
  }

  if (profilErreur) {
    return (
      <div className="app-shell"><FondAnime /><div className="carte-post profil-verification-erreur">
        <p>{profilErreur}</p>
        <button type="button" onClick={() => { setProfilErreur(""); setProfilPret(false); }}>Réessayer</button>
      </div></div>
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
      <BarreNav sessionToken={sessionToken} monUsername={username} ongletActif={onglet} onChangerOnglet={setOnglet} onGererComptes={ouvrirGestionComptes} estEquipe={!!statut?.est_equipe} />

      {onglet === "fil" && <FilActu sessionToken={sessionToken} monUsername={username} postAouvrir={postAouvrir} />}
      {onglet === "library" && <Library sessionToken={sessionToken} monUsername={username} documentAouvrirId={documentLibraryAouvrir} />}
      {onglet === "classes" && (
        <Classes sessionToken={sessionToken} monUsername={username} codeAttente={codeAttente} onCodeConsomme={consommerCode} />
      )}
      {onglet === "profil" && <Profil sessionToken={sessionToken} monUsername={username} />}
      {onglet === "reglages" && <Reglages sessionToken={sessionToken} monUsername={username} onDeconnexion={deconnecter} />}
      {onglet === "admin" && statut?.est_equipe && <BureauAdmin sessionToken={sessionToken} role={statut.role} />}

      {bienvenueOuverte && <BienvenueGrind sessionToken={sessionToken} onTermine={() => setBienvenueOuverte(false)} />}

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
