import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { ErrorCode, GoogleSignIn } from "@capawesome/capacitor-google-sign-in";
import {
  connecterGrind, inscrireGrind, motDePasseOublie, associerEmail, connecterGoogle, GOOGLE_CLIENT_ID, relockerPin,
} from "../api.js";
import FondAnime from "../components/FondAnime.jsx";
import PageCgu from "../components/PageCgu.jsx";
import EcranSanction from "../components/EcranSanction.jsx";
import ChampAvecIcone from "../components/ChampAvecIcone.jsx";
import EtapeVerification from "../components/EtapeVerification.jsx";
import EtapeNouveauMotDePasse, { IndicateurForce } from "../components/EtapeNouveauMotDePasse.jsx";
import CandidatureProviseur from "./CandidatureProviseur.jsx";

// GIS s'initialise une seule fois par page. Le gestionnaire actif est remplacé
// quand l'écran Connexion est monté/démonté (déconnexion puis reconnexion).
let googleIdentityInitialisee = false;
let traiterCredentialGoogle = null;


/**
 * Connexion — entrée de GRIND.
 *
 * Écrans (un seul visible à la fois, avec une transition douce) :
 *   formulaire (connexion / inscription) → vérification du code → connecté
 *   mot de passe oublié → e-mail → code → nouveau mot de passe → retour à la connexion
 *   ancien compte sans e-mail → on lui demande une adresse → code → connecté
 * Le serveur décide de tout (validité, unicité, limites) : cette page ne fait que le montrer.
 */
export default function Connexion({ onConnecte }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [ecran, setEcran] = useState("formulaire"); // "formulaire" | "verification" | "oubli_email" | "oubli_code" | "oubli_nouveau" | "email_requis"
  const [flux, setFlux] = useState(null); // { jeton, emailMasque }
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [cgu, setCgu] = useState(false);
  const [cguOuvertes, setCguOuvertes] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [sanction, setSanction] = useState(null);
  const [credentialGoogle, setCredentialGoogle] = useState(null);
  const [usernameGoogle, setUsernameGoogle] = useState("");
  const [identiteGoogle, setIdentiteGoogle] = useState({ prenom: "", nom: "" });
  const [accountsRemembered, setAccountsRemembered] = useState(() => {
    try { return JSON.parse(localStorage.getItem("grind_accounts") || "[]"); } catch { return []; }
  });
  const [googlePret, setGooglePret] = useState(false);
  const googleButtonRef = useRef(null);
  const estAppNative = Capacitor.isNativePlatform();

  // Une même validation backend reçoit le jeton Google, qu'il vienne du SDK
  // natif Android ou de Google Identity Services sur le site web.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let actif = true;
    let script = null;

    const traiterMonCredential = async (response) => {
      const idToken = response?.credential;
      if (!idToken) {
        setErreur("Google n'a pas fourni de jeton de connexion.");
        return;
      }
      setErreur(null);
      setMessage("Compte Google sélectionné. Vérification sécurisée auprès de GRIND…");
      setChargement(true);
      try {
        const result = await connecterGoogle(idToken);
        if (result.username_requis) {
          setMessage(null);
          setCredentialGoogle(idToken);
          setUsernameGoogle(result.suggested_username || "");
          setIdentiteGoogle({ prenom: result.prenom || "", nom: result.nom || "" });
        } else {
          if (!result?.session_token || !result?.username) {
            throw new Error("Google a répondu, mais GRIND n'a pas reçu une session valide. Réessaie.");
          }
          setMessage(null);
          terminer(result);
        }
      } catch (err) {
        setMessage(null);
        setErreur(err.message || "La connexion Google a échoué.");
      } finally {
        setChargement(false);
      }
    };
    traiterCredentialGoogle = traiterMonCredential;

    if (estAppNative) {
      // Sur Android, Google interdit le flux OAuth intégré dans une WebView.
      // Le plugin ouvre le sélecteur natif et renvoie un ID token vérifié côté API.
      GoogleSignIn.initialize({ clientId: GOOGLE_CLIENT_ID })
        .then(() => { if (actif) setGooglePret(true); })
        .catch(() => { if (actif) setErreur("La connexion Google native n'a pas pu être initialisée."); });

      return () => {
        actif = false;
        if (traiterCredentialGoogle === traiterMonCredential) traiterCredentialGoogle = null;
      };
    }

    const initialiserGoogle = () => {
      if (!actif || !window.google?.accounts?.id) return;
      if (!googleIdentityInitialisee) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (traiterCredentialGoogle) traiterCredentialGoogle(response);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        googleIdentityInitialisee = true;
      }
      setGooglePret(true);
    };
    const echecChargement = () => {
      if (actif) setErreur("Le service Google ne peut pas être chargé. Vérifie ta connexion puis réessaie.");
    };

    if (window.google?.accounts?.id) {
      initialiserGoogle();
    } else {
      script = document.querySelector('script[data-grind-google-gsi="true"]');
      const creerScript = !script;
      if (!script) {
        script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.dataset.grindGoogleGsi = "true";
      }
      script.addEventListener("load", initialiserGoogle);
      script.addEventListener("error", echecChargement);
      if (creerScript) document.head.appendChild(script);
    }

    return () => {
      actif = false;
      if (traiterCredentialGoogle === traiterMonCredential) traiterCredentialGoogle = null;
      script?.removeEventListener("load", initialiserGoogle);
      script?.removeEventListener("error", echecChargement);
    };
  }, []);

  // Le formulaire connexion/inscription est rendu conditionnellement ; on monte
  // le bouton officiel dans son conteneur après initialisation, à chaque retour.
  useEffect(() => {
    if (!googlePret || !googleButtonRef.current || !window.google?.accounts?.id) return;
    googleButtonRef.current.replaceChildren();
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: "icon",
      theme: "outline",
      size: "large",
      shape: "circle",
      logo_alignment: "center",
    });
  }, [googlePret, mode, ecran, credentialGoogle]);

  function terminer(res) {
    localStorage.setItem("grind_session_token", res.session_token);
    localStorage.setItem("grind_username", res.username);
    localStorage.setItem("grind_role", res.role || "");
    localStorage.setItem("grind_type_compte", res.type_compte || "eleve");
    if (res.profil_complet === true || res.type_compte === "proviseur" || res.role === "admin") {
      localStorage.setItem("grind_profil_complet", "1");
    } else {
      localStorage.removeItem("grind_profil_complet");
    }
    onConnecte(res.session_token, res);
  }

  function aller(nouvelEcran) {
    setErreur(null);
    setEcran(nouvelEcran);
  }

  async function terminerGoogle(e) {
    e.preventDefault(); setErreur(null); setChargement(true);
    try {
      const result = await connecterGoogle(credentialGoogle, usernameGoogle, cgu);
      if (result.username_requis) { setErreur("Choisis un nom de profil pour continuer."); return; }
      setCredentialGoogle(null);
      setIdentiteGoogle({ prenom: "", nom: "" });
      setUsernameGoogle("");
      terminer(result);
    } catch (err) { setErreur(err.message); }
    finally { setChargement(false); }
  }

  async function reprendreCompte(compte) {
    setErreur(null); setChargement(true);
    try {
      await relockerPin(compte.token);
      localStorage.setItem("grind_session_token", compte.token);
      localStorage.setItem("grind_username", compte.username);
      localStorage.setItem("grind_role", compte.role || "");
      localStorage.setItem("grind_type_compte", compte.type_compte || "eleve");
      // L'App vérifie l'état du questionnaire auprès du backend pour les sessions mémorisées.
      onConnecte(compte.token, compte);
    } catch (err) {
      const restants = accountsRemembered.filter((a) => a.username !== compte.username);
      setAccountsRemembered(restants); localStorage.setItem("grind_accounts", JSON.stringify(restants));
      setErreur("Session mémorisée expirée. Connecte-toi de nouveau avec ton mot de passe.");
    } finally { setChargement(false); }
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur(null);
    setMessage(null);

    if (mode === "signup") {
      if (password !== confirmation) {
        setErreur("Les mots de passe ne correspondent pas.");
        return;
      }
      if (!cgu) {
        setErreur("Tu dois accepter les conditions d'utilisation pour créer un compte.");
        return;
      }
    }

    setChargement(true);
    try {
      if (mode === "signup") {
        const res = await inscrireGrind(username, email, password, cgu);
        setFlux({ jeton: res.jeton_verification, emailMasque: res.email_masque });
        aller("verification");
      } else {
        terminer(await connecterGrind(username, password));
      }
    } catch (err) {
      const donnees = err.donnees;
      if (donnees?.code === "sanction") setSanction(donnees);
      else if (donnees?.code === "email_non_verifie") {
        setFlux({ jeton: donnees.jeton_verification, emailMasque: donnees.email_masque });
        aller("verification");
      } else if (donnees?.code === "email_requis") {
        setFlux({ jeton: donnees.jeton_verification, emailMasque: null });
        setEmail("");
        aller("email_requis");
      } else setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  async function envoyerOubli(e) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      const res = await motDePasseOublie(email);
      setFlux({ jeton: res.jeton_verification, emailMasque: res.email_masque });
      aller("oubli_code");
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  async function envoyerEmailRequis(e) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      const res = await associerEmail(flux.jeton, email);
      setFlux({ jeton: res.jeton_verification, emailMasque: res.email_masque });
      aller("verification");
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  function retourConnexion(texte) {
    setPassword("");
    setConfirmation("");
    setFlux(null);
    setCredentialGoogle(null);
    setIdentiteGoogle({ prenom: "", nom: "" });
    setUsernameGoogle("");
    setMode("login");
    setMessage(texte || null);
    aller("formulaire");
  }

  if (mode === "proviseur") {
    return <CandidatureProviseur onRetour={() => setMode("login")} onConnecte={terminer} />;
  }

  if (sanction) {
    return (
      <>
        <FondAnime />
        <EcranSanction donnees={sanction} username={username} onRetour={() => setSanction(null)} />
      </>
    );
  }

  return (
    <div className="page">
      <FondAnime />
      <div className="carte">
        <div className="logo-grind">
          <i className="fa-solid fa-brain"></i>
          <span>GRIND</span>
        </div>

        <div key={ecran} className="etape-auth">
          {credentialGoogle ? (
            <form onSubmit={terminerGoogle} noValidate>
              <div className="sous-titre">Créer ton compte GRIND</div>
              <div className="google-identite-confirmee">
                <span className="google-identite-libelle">Compte Google vérifié</span>
                <strong>{[identiteGoogle.prenom, identiteGoogle.nom].filter(Boolean).join(" ") || "Identité Google"}</strong>
                <span className="google-identite-note">Ton prénom et ton nom sont repris automatiquement depuis Google.</span>
              </div>
              <p className="info">Ton compte sera créé après acceptation des conditions. Un nom de profil unique t'est proposé automatiquement ; tu peux le modifier.</p>
              <ChampAvecIcone icone="fa-solid fa-at" valeur={usernameGoogle} onChange={setUsernameGoogle} placeholder="Nom de profil" maxLength={24} autoFocus />
              <div className="ligne-cgu">
                <button type="button" className={`interrupteur ${cgu ? "interrupteur-actif" : ""}`} onClick={() => setCgu((v) => !v)} aria-label="Accepter les conditions"><span className="curseur-interrupteur"></span></button>
                <span>J'accepte les <button type="button" className="lien lien-en-ligne" onClick={() => setCguOuvertes(true)}>conditions d'utilisation</button></span>
              </div>
              {erreur && <div className="erreur" role="alert">{erreur}</div>}
              <button type="submit" disabled={chargement || !cgu || !usernameGoogle.trim()}>{chargement ? <><span className="grind-spinner" /> Validation…</> : "Créer mon compte"}</button>
            </form>
          ) : ecran === "formulaire" && (
            <form onSubmit={soumettre} noValidate>
              <div className="sous-titre">
                {mode === "login" ? "Connecte-toi pour continuer" : "Crée ton compte GRIND"}
              </div>

              <ChampAvecIcone icone="fa-solid fa-user" valeur={username} onChange={setUsername} placeholder={mode === "login" ? "E-mail ou nom d'utilisateur" : "Nom d'utilisateur"} autoComplete="username" maxLength={mode === "login" ? 254 : 24} autoFocus />

              {mode === "signup" && (
                <>
                  <ChampAvecIcone icone="fa-solid fa-envelope" type="email" valeur={email} onChange={setEmail} placeholder="Adresse e-mail" autoComplete="email" inputMode="email" maxLength={254} />
                  <div className="info champ-aide">
                    <i className="fa-solid fa-shield-halved"></i> Un code de vérification sera envoyé à cette adresse e-mail.
                  </div>
                </>
              )}

              <ChampAvecIcone
                icone="fa-solid fa-lock" valeur={password} onChange={setPassword} placeholder="Mot de passe"
                bascule autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {mode === "signup" && <IndicateurForce mdp={password} />}

              {mode === "signup" && (
                <>
                  <ChampAvecIcone icone="fa-solid fa-lock" valeur={confirmation} onChange={setConfirmation} placeholder="Confirme le mot de passe" bascule autoComplete="new-password" />
                  <div className="ligne-cgu">
                    <button
                      type="button"
                      className={`interrupteur ${cgu ? "interrupteur-actif" : ""}`}
                      onClick={() => setCgu((v) => !v)}
                      aria-label="Accepter les conditions d'utilisation"
                    >
                      <span className="curseur-interrupteur"></span>
                    </button>
                    <span>
                      J'accepte les{" "}
                      <button type="button" className="lien lien-en-ligne" onClick={() => setCguOuvertes(true)}>
                        conditions d'utilisation
                      </button>
                    </span>
                  </div>
                </>
              )}

              {message && <div className="info" style={{ color: "var(--succes)", marginTop: 10 }}><i className="fa-solid fa-circle-check"></i> {message}</div>}
              {erreur && (
                <div className="erreur" role="alert">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  {erreur}
                </div>
              )}

              <button type="submit" disabled={chargement}>
                {chargement ? <span className="grind-spinner" aria-label="Connexion" /> : mode === "login" ? "Se connecter" : "Créer mon compte"}
              </button>

              {mode === "login" && (
                <button type="button" className="lien" onClick={() => { setEmail(""); aller("oubli_email"); }}>
                  Mot de passe oublié ?
                </button>
              )}
              <button
                type="button"
                className="lien"
                onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErreur(null); setMessage(null); }}
              >
                {mode === "login" ? "Pas encore de compte ? Inscris-toi" : "Déjà un compte ? Connecte-toi"}
              </button>
              {GOOGLE_CLIENT_ID && googlePret && (mode === "login" || mode === "signup") && (
                <div className="bloc-google-auth">
                  <div className="separateur-auth"><span>ou</span></div>
                  <div className="google-action">
                    {estAppNative ? (
                      <button
                        type="button"
                        className="google-native-button"
                        onClick={async () => {
                          setErreur(null);
                          try {
                            setChargement(true);
                            const resultat = await GoogleSignIn.signIn();
                            if (!resultat?.idToken) throw new Error("Google n'a pas renvoyé de jeton d'identité.");
                            if (traiterCredentialGoogle) await traiterCredentialGoogle({ credential: resultat.idToken });
                            else throw new Error("Le service de connexion Google n'est pas prêt. Réessaie.");
                          } catch (err) {
                            if (err?.code !== ErrorCode.SignInCanceled) {
                              const detail = err?.code === ErrorCode.NoCredentialAvailable
                                ? "Aucun compte Google disponible sur cet appareil."
                                : err?.code === ErrorCode.ProviderConfigurationError
                                  ? "Les services Google Play ne sont pas disponibles ou doivent être mis à jour."
                                  : err?.message || "La connexion Google a échoué. Réessaie.";
                              setMessage(null);
                              setErreur(detail);
                            }
                          } finally {
                            setChargement(false);
                          }
                        }}
                        disabled={chargement}
                        aria-label="Continuer avec Google"
                      >
                        <i className="fa-brands fa-google" aria-hidden="true" />
                        <span>Continuer avec Google</span>
                      </button>
                    ) : (
                      <>
                        <div
                          className="bouton-google bouton-google-grind"
                          ref={googleButtonRef}
                          role="group"
                          aria-label="Connexion avec Google"
                        />
                        <span className="google-action-label">Continuer avec Google</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              {!GOOGLE_CLIENT_ID && (mode === "login" || mode === "signup") && <p className="info info-google">La connexion Google n'est pas configurée sur ce déploiement.</p>}
              {mode === "login" && <button type="button" className="lien" onClick={() => setMode("proviseur")}>Candidater comme proviseur / directeur</button>}
              <button type="button" className="lien" onClick={() => setCguOuvertes(true)}>
                Conditions d'utilisation
              </button>
            </form>
          )}

          {ecran === "verification" && flux && (
            <EtapeVerification
              objet="inscription"
              emailMasque={flux.emailMasque}
              jeton={flux.jeton}
              onVerifie={terminer}
              onAnnuler={() => retourConnexion()}
            />
          )}

          {ecran === "email_requis" && (
            <form onSubmit={envoyerEmailRequis} className="etape-verification" noValidate>
              <div className="icone-etape"><i className="fa-solid fa-envelope"></i></div>
              <div className="etape-question">Ajoute ton adresse e-mail</div>
              <p className="verification-texte">
                GRIND demande maintenant une adresse e-mail vérifiée pour protéger ton compte (récupération du mot de passe).
                <strong> G-SOCIETY</strong> t'enverra un code à 7 chiffres.
              </p>
              <ChampAvecIcone icone="fa-solid fa-envelope" type="email" valeur={email} onChange={setEmail} placeholder="Adresse e-mail" autoComplete="email" inputMode="email" autoFocus />
              {erreur && <div className="erreur" role="alert"><i className="fa-solid fa-triangle-exclamation"></i>{erreur}</div>}
              <button type="submit" disabled={chargement || !email}>{chargement ? <><span className="grind-spinner" /> Envoi…</> : "Recevoir le code"}</button>
              <button type="button" className="lien" onClick={() => retourConnexion()}><i className="fa-solid fa-arrow-left"></i> Retour</button>
            </form>
          )}

          {ecran === "oubli_email" && (
            <form onSubmit={envoyerOubli} className="etape-verification" noValidate>
              <div className="icone-etape"><i className="fa-solid fa-key"></i></div>
              <div className="etape-question">Mot de passe oublié</div>
              <p className="verification-texte">
                Indique l'adresse e-mail de ton compte. Si elle correspond à un compte, <strong>G-SOCIETY</strong> t'enverra un code de vérification.
              </p>
              <ChampAvecIcone icone="fa-solid fa-envelope" type="email" valeur={email} onChange={setEmail} placeholder="Adresse e-mail" autoComplete="email" inputMode="email" autoFocus />
              {erreur && <div className="erreur" role="alert"><i className="fa-solid fa-triangle-exclamation"></i>{erreur}</div>}
              <button type="submit" disabled={chargement || !email}>{chargement ? <><span className="grind-spinner" /> Envoi…</> : "Envoyer le code"}</button>
              <button type="button" className="lien" onClick={() => retourConnexion()}><i className="fa-solid fa-arrow-left"></i> Retour</button>
            </form>
          )}

          {ecran === "oubli_code" && flux && (
            <EtapeVerification
              objet="reinitialisation"
              emailMasque={flux.emailMasque}
              jeton={flux.jeton}
              onVerifie={() => aller("oubli_nouveau")}
              onAnnuler={() => aller("oubli_email")}
            />
          )}

          {ecran === "oubli_nouveau" && flux && (
            <EtapeNouveauMotDePasse
              jeton={flux.jeton}
              onTermine={() => retourConnexion("Mot de passe modifié. Connecte-toi avec ton nouveau mot de passe.")}
              onAnnuler={() => retourConnexion()}
            />
          )}
          {ecran === "formulaire" && !credentialGoogle && mode === "login" && accountsRemembered.length > 0 && (
            <section className="comptes-memorises">
              <h3>Comptes mémorisés sur cet appareil</h3>
              {accountsRemembered.map((compte) => (
                <button key={compte.username} type="button" className="compte-memorise" disabled={chargement} onClick={() => reprendreCompte(compte)}>
                  <span className="avatar-compte-memorise">{compte.username.slice(0, 1).toUpperCase()}</span>
                  <span><strong>@{compte.username}</strong><small>{compte.type_compte === "proviseur" ? "Compte établissement" : compte.role === "admin" ? "Administration" : "Compte GRIND"}</small></span>
                  <i className="fa-solid fa-arrow-right" />
                </button>
              ))}
            </section>
          )}
        </div>

        {cguOuvertes && <PageCgu onFermer={() => setCguOuvertes(false)} />}
      </div>
    </div>
  );
}
