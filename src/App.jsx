import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import Connexion from "./pages/Connexion.jsx";
import Questionnaire from "./pages/Questionnaire.jsx";
import FilActu from "./pages/FilActu.jsx";
import Classes from "./pages/Classes.jsx";
import Profil from "./pages/Profil.jsx";
import Reglages from "./pages/Reglages.jsx";
import BureauAdmin from "./pages/BureauAdmin.jsx";
import ModaleAcceptationCgu from "./components/ModaleAcceptationCgu.jsx";
import { obtenirMonStatut, deconnecterGrind, statutPin, relockerPin, obtenirMonProfil, estGrindEnLigne } from "./api.js";
import { oublierBloques } from "./blocages.js";
import BarreNav from "./components/BarreNav.jsx";
import FondAnime from "./components/FondAnime.jsx";
import EspaceProviseur from "./pages/EspaceProviseur.jsx";
import VerrouPin from "./components/VerrouPin.jsx";
import GestionComptes from "./components/GestionComptes.jsx";
import Library from "./pages/Library.jsx";
import BienvenueGrind from "./components/BienvenueGrind.jsx";
import PaysIndisponible from "./components/PaysIndisponible.jsx";
import { statutBienvenue, verifierAccesPays, GRIND_URL } from "./api.js";
import { nettoyerCacheMediaAndroid } from "./mediaStorage.js";

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
  const ongletInitial = codeAttente ? "classes" : "fil";
  const [onglet, setOngletEtat] = useState(ongletInitial);
  const pileOngletsRef = useRef(codeAttente ? ["fil", "classes"] : ["fil"]);
  const ongletActifRef = useRef(ongletInitial);
  ongletActifRef.current = onglet;
  const setOnglet = useCallback((destination) => {
    const cible = typeof destination === "function" ? destination(ongletActifRef.current) : destination;
    if (typeof cible !== "string" || !cible || cible === ongletActifRef.current) return;
    const pile = pileOngletsRef.current;
    const indexExistant = pile.lastIndexOf(cible);
    pileOngletsRef.current = indexExistant >= 0
      ? pile.slice(0, indexExistant + 1)
      : [...pile, cible].slice(-12);
    ongletActifRef.current = cible;
    setOngletEtat(cible);
  }, []);
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
  const [discussionAouvrir, setDiscussionAouvrir] = useState(null);
  const [etatConnexion, setEtatConnexion] = useState({ disponible: true, verifiee: false, verification: false, motif: "internet" });
  const [tentativeConnexion, setTentativeConnexion] = useState(0);
  const [discussionPleineEcran, setDiscussionPleineEcran] = useState(false);
  const [bandeauHorsLigneMasque, setBandeauHorsLigneMasque] = useState(false);
  const [toastGrind, setToastGrind] = useState("");
  const toastTimerRef = useRef(null);
  const retourAppRef = useRef({});
  retourAppRef.current = { gestionComptesOuverte };
  const notifierModeDiscussion = useCallback((actif) => setDiscussionPleineEcran(Boolean(actif)), []);

  // Le bouton Retour Android doit d'abord dépiler les vues GRIND, sans laisser
  // Android fermer la WebView ou renvoyer directement l'utilisateur au navigateur.
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return undefined;
    let actif = true;
    let ecouteur = null;

    const enregistrerRetourAndroid = async () => {
      try {
        const handle = await CapacitorApp.addListener("backButton", async () => {
          const retourInterne = new Event("grind-back", { cancelable: true });
          window.dispatchEvent(retourInterne);
          if (retourInterne.defaultPrevented) return;

          if (retourAppRef.current.gestionComptesOuverte) {
            setGestionComptesOuverte(false);
            return;
          }

          const pile = pileOngletsRef.current;
          if (pile.length > 1) {
            const nouvellePile = pile.slice(0, -1);
            const precedent = nouvellePile[nouvellePile.length - 1] || "fil";
            pileOngletsRef.current = nouvellePile;
            ongletActifRef.current = precedent;
            setOngletEtat(precedent);
            return;
          }

          if (ongletActifRef.current !== "fil") {
            pileOngletsRef.current = ["fil"];
            ongletActifRef.current = "fil";
            setOngletEtat("fil");
            return;
          }

          // À la racine, on minimise l'application sans forcer sa fermeture.
          try { await CapacitorApp.minimizeApp(); }
          catch (erreur) { console.warn("Impossible de minimiser GRIND", erreur); }
        });
        if (!actif) await handle.remove();
        else ecouteur = handle;
      } catch (erreur) {
        console.warn("Gestion du bouton Retour Android indisponible", erreur);
      }
    };

    enregistrerRetourAndroid();
    return () => {
      actif = false;
      if (ecouteur) ecouteur.remove().catch(() => {});
    };
  }, []);

  // Purge au lancement des médias temporaires conservés depuis plus de 30 jours.
  useEffect(() => {
    if (Capacitor.getPlatform() === "android") nettoyerCacheMediaAndroid().catch(() => {});
  }, []);

  // Sur Android, demander les notifications dès le premier lancement, même avant la connexion.
  // Android 12 et antérieur n'affichent pas de dialogue runtime pour cette permission.
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return undefined;
    let actif = true;
    const demanderPermissionNotifications = async () => {
      try {
        const statutPermission = await PushNotifications.checkPermissions();
        if (!actif || statutPermission.receive === "granted" || statutPermission.receive === "denied") return;
        if (statutPermission.receive === "prompt" || statutPermission.receive === "prompt-with-rationale") {
          await PushNotifications.requestPermissions();
        }
      } catch (erreur) {
        console.warn("Permission des notifications GRIND indisponible", erreur);
      }
    };
    demanderPermissionNotifications();
    return () => { actif = false; };
  }, []);

  // L'état Wi-Fi seul ne garantit pas l'accès à Internet : on vérifie aussi l'API GRIND.
  // Une panne réseau ou serveur affiche un écran de reconnexion, puis disparaît automatiquement.
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return undefined;
    let actif = true;
    let verificationEnCours = false;
    let controleur = null;
    let delaiAnnulation = null;

    const verifierConnexion = async () => {
      if (!actif || verificationEnCours) return;
      if (navigator.onLine === false) {
        setEtatConnexion({ disponible: false, verifiee: true, verification: false, motif: "internet" });
        return;
      }

      verificationEnCours = true;
      setEtatConnexion((precedent) => ({ ...precedent, verification: true }));
      controleur = new AbortController();
      delaiAnnulation = window.setTimeout(() => controleur?.abort(), 9000);

      try {
        const reponse = await fetch(`${GRIND_URL}/api/health`, {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controleur.signal,
        });
        if (!reponse.ok) throw new Error(`Serveur GRIND indisponible (${reponse.status})`);
        const donnees = await reponse.json();
        if (donnees?.status !== "ok") throw new Error("Réponse de santé GRIND invalide");
        if (actif) setEtatConnexion({ disponible: true, verifiee: true, verification: false, motif: null });
      } catch {
        if (actif) {
          setEtatConnexion({
            disponible: false,
            verifiee: true,
            verification: false,
            motif: navigator.onLine === false ? "internet" : "service",
          });
        }
      } finally {
        if (delaiAnnulation !== null) window.clearTimeout(delaiAnnulation);
        controleur = null;
        delaiAnnulation = null;
        verificationEnCours = false;
      }
    };

    const horsLigne = () => {
      controleur?.abort();
      setEtatConnexion({ disponible: false, verifiee: true, verification: false, motif: "internet" });
    };
    const enLigne = () => { verifierConnexion(); };

    window.addEventListener("offline", horsLigne);
    window.addEventListener("online", enLigne);
    verifierConnexion();
    const intervalle = window.setInterval(verifierConnexion, 15000);

    return () => {
      actif = false;
      window.removeEventListener("offline", horsLigne);
      window.removeEventListener("online", enLigne);
      window.clearInterval(intervalle);
      controleur?.abort();
      if (delaiAnnulation !== null) window.clearTimeout(delaiAnnulation);
    };
  }, [tentativeConnexion]);

  useEffect(() => {
    // La vérification réseau ne doit pas retarder l'interface : tant qu'elle
    // tourne, navigator.onLine sert de signal provisoire. Dès qu'un contrôle
    // GRIND échoue, les actions serveur sont bloquées jusqu'à la reconnexion.
    const apiEnLigne = Capacitor.getPlatform() !== "android"
      || (etatConnexion.verifiee ? etatConnexion.disponible : navigator.onLine !== false);
    window.__GRIND_API_ONLINE = apiEnLigne;
    window.dispatchEvent(new CustomEvent("grind-api-status", { detail: { online: apiEnLigne } }));
    if (etatConnexion.disponible) setBandeauHorsLigneMasque(false);
  }, [etatConnexion.disponible, etatConnexion.verifiee]);

  useEffect(() => {
    const afficher = (event) => {
      const message = typeof event.detail === "string" ? event.detail : event.detail?.message;
      if (!message) return;
      setToastGrind(message);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToastGrind(""), 2600);
    };
    window.addEventListener("grind-toast", afficher);
    return () => {
      window.removeEventListener("grind-toast", afficher);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const ouvrirDiscussion = (event) => {
      const cible = event.detail;
      if (!cible?.classe_id) return;
      setDiscussionAouvrir(cible);
      setOnglet("classes");
    };
    const ouvrirClasse = () => setOnglet("classes");
    const ouvrirSupport = () => setOnglet("reglages");
    const ouvrirAide = () => setOnglet("fil");
    window.addEventListener("grind-open-discussion", ouvrirDiscussion);
    window.addEventListener("grind-open-class", ouvrirClasse);
    window.addEventListener("grind-open-support", ouvrirSupport);
    window.addEventListener("grind-open-help-request", ouvrirAide);
    return () => {
      window.removeEventListener("grind-open-discussion", ouvrirDiscussion);
      window.removeEventListener("grind-open-class", ouvrirClasse);
      window.removeEventListener("grind-open-support", ouvrirSupport);
      window.removeEventListener("grind-open-help-request", ouvrirAide);
    };
  }, []);

  async function initialiserSession(token, donnees = {}) {
    setBienvenueOuverte(false);
    setBienvenueVerifiee(false);
    const nouveauRole = donnees.role ?? localStorage.getItem("grind_role") ?? null;
    const nouveauType = donnees.type_compte ?? localStorage.getItem("grind_type_compte") ?? "eleve";
    const nouveauUsername = donnees.username ?? localStorage.getItem("grind_username");

    // L'App est la source de vérité de la session : un login réussi doit être
    // persisté avant que les contrôles asynchrones (PIN/profil) commencent.
    if (token) localStorage.setItem("grind_session_token", token);
    if (nouveauUsername) localStorage.setItem("grind_username", nouveauUsername);
    if (nouveauRole) localStorage.setItem("grind_role", nouveauRole);
    if (nouveauType) localStorage.setItem("grind_type_compte", nouveauType);

    // Réinitialise immédiatement l'état de sécurité : ne jamais réutiliser le
    // statut PIN d'un ancien compte pendant le premier rendu du nouveau login.
    setPinStatus(token ? { loading: true } : null);
    setStatut(null);
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

    // Hors ligne, on conserve uniquement le profil déjà validé sur cet appareil.
    // Les actions sensibles restent bloquées tant que le serveur est inaccessible.
    if (!estGrindEnLigne() && localStorage.getItem("grind_profil_complet") === "1") {
      setProfilComplet(true);
      setProfilPret(true);
      return;
    }
    // Session ancienne ou mémorisée : vérifier le profil après la validation éventuelle du PIN.
    // Le middleware de session refuse volontairement les routes privées tant que le PIN est expiré.
    setProfilPret(false);
  }

  function invaliderSessionConfirmee(token) {
    // Seul un HTTP 401 du contrôle de session constitue une preuve que le
    // jeton est invalide. Une panne réseau/500/503 ne doit jamais déconnecter.
    if (!token || localStorage.getItem("grind_session_token") === token) {
      localStorage.removeItem("grind_session_token");
      localStorage.removeItem("grind_username");
      localStorage.removeItem("grind_profil_complet");
    }
    setSessionToken(null);
    setUsername(null);
    setPinStatus(null);
    setProfilComplet(false);
    setProfilPret(true);
    setStatut(null);
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
      if (!estGrindEnLigne() && localStorage.getItem("grind_profil_complet") === "1") {
        setProfilComplet(true);
        setProfilPret(true);
        return;
      }
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
    const pinCacheKey = `grind_pin_status_${localStorage.getItem("grind_username") || username || "compte"}_${String(sessionToken).slice(-12)}`;
    statutPin(sessionToken)
      .then((status) => {
        if (!actif) return;
        try { localStorage.setItem(pinCacheKey, JSON.stringify({ status, checkedAt: Date.now() })); } catch {}
        setPinStatus({ ...status, loading: false });
      })
      .catch((erreur) => {
        if (!actif) return;
        if (erreur?.status === 401) {
          invaliderSessionConfirmee(sessionToken);
          return;
        }

        let cache = null;
        try { cache = JSON.parse(localStorage.getItem(pinCacheKey) || "null"); } catch {}
        const elapsed = cache?.checkedAt ? Math.max(0, (Date.now() - cache.checkedAt) / 1000) : Infinity;
        const ageValide = Number.isFinite(elapsed) && elapsed < 48 * 60 * 60;
        const secondesRestantes = Math.max(0, Number(cache?.status?.remaining_seconds || 0) - elapsed);
        const pinEncoreValide = cache?.status?.configured === true && cache.status.required === false && secondesRestantes > 0;
        const reseauInjoignable = !estGrindEnLigne() || !erreur?.status;
        if (reseauInjoignable && ageValide && pinEncoreValide) {
          setPinStatus({ ...cache.status, required: false, remaining_seconds: Math.floor(secondesRestantes), loading: false, offline: true });
          return;
        }
        // Render peut être en réveil ou une requête peut échouer ponctuellement.
        // On garde le jeton et on retente le contrôle au lieu de renvoyer au login
        // ou de deviner à tort si le compte possède déjà un PIN.
        setPinStatus({ loading: true, verification_pending: true });
      });
    return () => { actif = false; };
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken || !pinStatus?.verification_pending) return undefined;
    let actif = true;
    let timer = null;

    const retenter = async () => {
      try {
        const status = await statutPin(sessionToken);
        if (!actif) return;
        const pinCacheKey = `grind_pin_status_${localStorage.getItem("grind_username") || username || "compte"}_${String(sessionToken).slice(-12)}`;
        try { localStorage.setItem(pinCacheKey, JSON.stringify({ status, checkedAt: Date.now() })); } catch {}
        setPinStatus({ ...status, loading: false });
      } catch (erreur) {
        if (!actif) return;
        if (erreur?.status === 401) {
          invaliderSessionConfirmee(sessionToken);
          return;
        }
        // Si la connexion vient réellement de tomber, réutilise uniquement le
        // dernier PIN serveur confirmé, encore dans sa fenêtre de validité de 48 h.
        // Aucun cache absent/expiré ne permet de contourner le verrou PIN.
        const pinCacheKey = `grind_pin_status_${localStorage.getItem("grind_username") || username || "compte"}_${String(sessionToken).slice(-12)}`;
        let cache = null;
        try { cache = JSON.parse(localStorage.getItem(pinCacheKey) || "null"); } catch {}
        const elapsed = cache?.checkedAt ? Math.max(0, (Date.now() - cache.checkedAt) / 1000) : Infinity;
        const ageValide = Number.isFinite(elapsed) && elapsed < 48 * 60 * 60;
        const secondesRestantes = Math.max(0, Number(cache?.status?.remaining_seconds || 0) - elapsed);
        const pinEncoreValide = cache?.status?.configured === true && cache.status.required === false && secondesRestantes > 0;
        const reseauInjoignable = !estGrindEnLigne() || !erreur?.status;
        if (reseauInjoignable && ageValide && pinEncoreValide) {
          setPinStatus({ ...cache.status, required: false, remaining_seconds: Math.floor(secondesRestantes), loading: false, offline: true });
          return;
        }
        // Réessai borné en fréquence : pas de boucle rapide ni de déconnexion.
        timer = window.setTimeout(retenter, 10000);
      }
    };

    timer = window.setTimeout(retenter, 2500);
    return () => {
      actif = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [sessionToken, pinStatus?.verification_pending]);

  useEffect(() => {
    if (!sessionToken || !pinStatus?.offline) return undefined;
    let actif = true;
    const revalider = async () => {
      if (!estGrindEnLigne()) return;
      try {
        const status = await statutPin(sessionToken);
        if (!actif) return;
        const key = `grind_pin_status_${localStorage.getItem("grind_username") || username || "compte"}_${String(sessionToken).slice(-12)}`;
        try { localStorage.setItem(key, JSON.stringify({ status, checkedAt: Date.now() })); } catch {}
        setPinStatus({ ...status, loading: false, offline: false });
      } catch (erreur) {
        if (!actif) return;
        if (erreur?.status === 401) invaliderSessionConfirmee(sessionToken);
      }
    };
    const statutApi = (event) => { if (event.detail?.online) revalider(); };
    window.addEventListener("online", revalider);
    window.addEventListener("grind-api-status", statutApi);
    return () => {
      actif = false;
      window.removeEventListener("online", revalider);
      window.removeEventListener("grind-api-status", statutApi);
    };
  }, [sessionToken, pinStatus?.offline, username]);

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
      } catch (erreur) {
        if (erreur?.status === 401) invaliderSessionConfirmee(sessionToken);
        else setPinStatus({ loading: true, verification_pending: true });
      }
    }, delai);
    return () => window.clearTimeout(timer);
  }, [sessionToken, pinStatus]);

  async function apresValidationPin() {
    try {
      const nouveauStatut = await statutPin(sessionToken);
      setPinStatus({ ...nouveauStatut, loading: false });
    } catch (erreur) {
      if (erreur?.status === 401) invaliderSessionConfirmee(sessionToken);
      else setPinStatus({ loading: true, verification_pending: true });
    }
  }

  // Statut du compte : droits d'administration et acceptation des CGU.
  // IMPORTANT : /api/moderation/moi passe par le middleware de session protégé
  // par le PIN. L'appeler avant la validation du PIN renvoie un 401 légitime,
  // qui ne signifie PAS que le mot de passe ou la session fraîche sont invalides.
  useEffect(() => {
    if (
      !sessionToken || !profilComplet || role === "admin" || typeCompte === "proviseur"
      || !pinStatus || pinStatus.loading || pinStatus.required || pinStatus.verification_pending
    ) return undefined;

    let actif = true;
    obtenirMonStatut(sessionToken)
      .then((resultat) => {
        if (actif && localStorage.getItem("grind_session_token") === sessionToken) {
          setStatut(resultat);
        }
      })
      .catch((erreur) => {
        if (!actif) return;
        // Seul un 401 reçu APRÈS le contrôle PIN réussi peut invalider cette session.
        // Une panne réseau, un 5xx ou un changement de compte ne doit jamais déconnecter.
        if (
          erreur?.status === 401
          && localStorage.getItem("grind_session_token") === sessionToken
        ) {
          invaliderSessionConfirmee(sessionToken);
        }
      });

    return () => { actif = false; };
  }, [sessionToken, profilComplet, role, typeCompte, pinStatus?.loading, pinStatus?.required, pinStatus?.verification_pending]);

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
    <div className={`app-shell ${discussionPleineEcran ? "app-shell-discussion" : ""}`}>
      <FondAnime />
      {Capacitor.getPlatform() === "android" && etatConnexion.verifiee && !etatConnexion.disponible && !bandeauHorsLigneMasque && (
        <div className="grind-offline-chip" role="status" aria-label="Aucune connexion à Internet">
          <img src="/icon-192.png" alt="GRIND" />
          <span className="grind-offline-wifi" aria-hidden="true"><i className="fa-solid fa-wifi" /></span>
          <strong>Aucune connexion à Internet</strong>
          <button type="button" onClick={() => setBandeauHorsLigneMasque(true)} aria-label="Fermer l'indicateur hors ligne"><i className="fa-solid fa-xmark" /></button>
        </div>
      )}
      {toastGrind && <div className="grind-toast" role="status">{toastGrind}</div>}
      {!discussionPleineEcran && <BarreNav sessionToken={sessionToken} monUsername={username} ongletActif={onglet} onChangerOnglet={setOnglet} onGererComptes={ouvrirGestionComptes} estEquipe={!!statut?.est_equipe} />}

      {onglet === "fil" && <FilActu sessionToken={sessionToken} monUsername={username} postAouvrir={postAouvrir} />}
      {onglet === "library" && <Library sessionToken={sessionToken} monUsername={username} documentAouvrirId={documentLibraryAouvrir} />}
      {onglet === "classes" && (
        <Classes sessionToken={sessionToken} monUsername={username} codeAttente={codeAttente} onCodeConsomme={consommerCode} discussionAouvrir={discussionAouvrir} onDiscussionOuverte={() => setDiscussionAouvrir(null)} onModeDiscussion={notifierModeDiscussion} />
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
