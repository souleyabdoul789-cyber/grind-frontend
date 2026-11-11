import { useState } from "react";
import {
  connecterGrind, inscrireGrind, motDePasseOublie, associerEmail,
} from "../api.js";
import FondAnime from "../components/FondAnime.jsx";
import PageCgu from "../components/PageCgu.jsx";
import EcranSanction from "../components/EcranSanction.jsx";
import ChampAvecIcone from "../components/ChampAvecIcone.jsx";
import EtapeVerification from "../components/EtapeVerification.jsx";
import EtapeNouveauMotDePasse, { IndicateurForce } from "../components/EtapeNouveauMotDePasse.jsx";

const URL_GSOCIETY = "https://g-society.onrender.com/";

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
  const [apiKey, setApiKey] = useState("");
  const [cgu, setCgu] = useState(false);
  const [cguOuvertes, setCguOuvertes] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [sanction, setSanction] = useState(null);

  function terminer(res) {
    localStorage.setItem("grind_session_token", res.session_token);
    localStorage.setItem("grind_username", res.username);
    localStorage.setItem("grind_role", res.role || "");
    onConnecte(res.session_token);
  }

  function aller(nouvelEcran) {
    setErreur(null);
    setEcran(nouvelEcran);
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
        const res = await inscrireGrind(username, email, password, apiKey, cgu);
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
    setMode("login");
    setMessage(texte || null);
    aller("formulaire");
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
          {ecran === "formulaire" && (
            <form onSubmit={soumettre} noValidate>
              <div className="sous-titre">
                {mode === "login" ? "Connecte-toi pour continuer" : "Crée ton compte GRIND"}
              </div>

              <ChampAvecIcone icone="fa-solid fa-user" valeur={username} onChange={setUsername} placeholder="Nom d'utilisateur" autoComplete="username" maxLength={24} autoFocus />

              {mode === "signup" && (
                <>
                  <ChampAvecIcone icone="fa-solid fa-envelope" type="email" valeur={email} onChange={setEmail} placeholder="Adresse e-mail" autoComplete="email" inputMode="email" maxLength={254} />
                  <div className="info champ-aide">
                    <i className="fa-solid fa-shield-halved"></i> Un code de vérification te sera envoyé par <strong>G-SOCIETY</strong>.
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
                  <ChampAvecIcone icone="fa-solid fa-key" valeur={apiKey} onChange={setApiKey} placeholder="Clé API G-SOCIETY (catégorie grind)" autoComplete="off" />
                  <div className="info champ-aide">
                    Génère cette clé sur le{" "}
                    <a className="lien lien-en-ligne" href={URL_GSOCIETY} target="_blank" rel="noopener noreferrer">site G-SOCIETY</a>{" "}
                    avant de continuer.
                  </div>

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
                {chargement ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
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
              <button type="submit" disabled={chargement || !email}>{chargement ? "Envoi..." : "Recevoir le code"}</button>
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
              <button type="submit" disabled={chargement || !email}>{chargement ? "Envoi..." : "Envoyer le code"}</button>
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
        </div>

        {cguOuvertes && <PageCgu onFermer={() => setCguOuvertes(false)} />}
      </div>
    </div>
  );
}
