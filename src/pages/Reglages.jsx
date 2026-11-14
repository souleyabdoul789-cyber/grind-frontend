import PageCgu from "../components/PageCgu.jsx";
import ContactSupport from "../components/ContactSupport.jsx";
import { useState, useEffect, useRef } from "react";
import { obtenirMonProfil, modifierIdentite } from "../api.js";

export default function Reglages({ sessionToken, monUsername, onDeconnexion }) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [identiteChargee, setIdentiteChargee] = useState(false);
  const [editionIdentite, setEditionIdentite] = useState(false);
  const [identiteErreur, setIdentiteErreur] = useState("");
  const [sauvegardeIdentite, setSauvegardeIdentite] = useState(false);

  useEffect(() => {
    let actif = true;
    obtenirMonProfil(sessionToken)
      .then((profil) => {
        if (!actif) return;
        setPrenom(profil.prenom || "");
        setNom(profil.nom || "");
        setIdentiteChargee(true);
      })
      .catch((erreur) => {
        if (!actif) return;
        setIdentiteErreur(erreur.message || "Impossible de charger l'identité.");
        setIdentiteChargee(true);
      });
    return () => { actif = false; };
  }, [sessionToken]);

  async function enregistrerIdentite(e) {
    e.preventDefault();
    setIdentiteErreur("");
    setSauvegardeIdentite(true);
    try {
      const resultat = await modifierIdentite(sessionToken, prenom, nom);
      setPrenom(resultat.prenom);
      setNom(resultat.nom);
      setEditionIdentite(false);
    } catch (erreur) {
      setIdentiteErreur(erreur.message || "La modification n'a pas pu être enregistrée.");
    } finally {
      setSauvegardeIdentite(false);
    }
  }

  const [cguOuvertes, setCguOuvertes] = useState(false);
  const [contactOuvert, setContactOuvert] = useState(false);
  const retourReglagesRef = useRef({});
  retourReglagesRef.current = { contactOuvert, cguOuvertes, editionIdentite };

  useEffect(() => {
    const gererRetourReglages = (event) => {
      if (event.defaultPrevented) return;
      const vue = retourReglagesRef.current;
      if (vue.contactOuvert) { setContactOuvert(false); event.preventDefault(); return; }
      if (vue.cguOuvertes) { setCguOuvertes(false); event.preventDefault(); return; }
      if (vue.editionIdentite) { setEditionIdentite(false); setIdentiteErreur(""); event.preventDefault(); }
    };
    window.addEventListener("grind-back", gererRetourReglages);
    return () => window.removeEventListener("grind-back", gererRetourReglages);
  }, []);

  const [notifAide, setNotifAide] = useState(
    localStorage.getItem("grind_pref_notif_aide") !== "0"
  );
  const [notifClasses, setNotifClasses] = useState(
    localStorage.getItem("grind_pref_notif_classes") !== "0"
  );

  function basculerNotifAide() {
    const val = !notifAide;
    setNotifAide(val);
    localStorage.setItem("grind_pref_notif_aide", val ? "1" : "0");
  }

  function basculerNotifClasses() {
    const val = !notifClasses;
    setNotifClasses(val);
    localStorage.setItem("grind_pref_notif_classes", val ? "1" : "0");
  }

  return (
    <div className="fil-actu">
      <div className="carte-post reglages-identite">
        <div className="sous-titre reglages-identite-titre">Identité</div>
        <div className="reglages-identite-username">@{monUsername || ""}</div>
        <div className="reglages-identite-ligne">
          <div className="reglages-identite-valeur">
            <span>{identiteChargee ? ([prenom, nom].filter(Boolean).join(" ") || "Prénom et nom non renseignés") : "Chargement de l'identité…"}</span>
            <small>Prénom et nom associés à ton compte</small>
          </div>
          {!editionIdentite && (
            <button type="button" className="bouton-editer-identite" onClick={() => { setIdentiteErreur(""); setEditionIdentite(true); }} aria-label="Modifier le prénom et le nom" title="Modifier">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
            </button>
          )}
        </div>
        {editionIdentite && (
          <form className="form-identite-reglages" onSubmit={enregistrerIdentite}>
            <label>Prénom<input value={prenom} onChange={(e) => setPrenom(e.target.value)} maxLength={80} autoComplete="given-name" required /></label>
            <label>Nom<input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} autoComplete="family-name" required /></label>
            {identiteErreur && <p className="erreur" role="alert">{identiteErreur}</p>}
            <div className="actions-identite-reglages">
              <button type="button" className="bouton-retour" disabled={sauvegardeIdentite} onClick={() => { setEditionIdentite(false); setIdentiteErreur(""); }}>Annuler</button>
              <button type="submit" disabled={sauvegardeIdentite || !prenom.trim() || !nom.trim()}>{sauvegardeIdentite ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        )}
        {!editionIdentite && identiteErreur && <p className="erreur" role="alert">{identiteErreur}</p>}
      </div>

      <div className="carte-post">
        <div className="sous-titre" style={{ marginBottom: 14 }}>
          <i className="fa-solid fa-bell"></i> Notifications
        </div>

        <div className="ligne-reglage">
          <span>Demandes d'aide sur mes matières</span>
          <button
            type="button"
            className={`interrupteur ${notifAide ? "interrupteur-actif" : ""}`}
            onClick={basculerNotifAide}
          >
            <span className="curseur-interrupteur"></span>
          </button>
        </div>

        <div className="ligne-reglage">
          <span>Invitations de classe</span>
          <button
            type="button"
            className={`interrupteur ${notifClasses ? "interrupteur-actif" : ""}`}
            onClick={basculerNotifClasses}
          >
            <span className="curseur-interrupteur"></span>
          </button>
        </div>
      </div>

      <button className="carte-post bouton-lien-carte" onClick={() => setContactOuvert(true)} type="button">
        <i className="fa-solid fa-headset"></i> Contactez-nous
      </button>
      {contactOuvert && <ContactSupport sessionToken={sessionToken} onFermer={() => setContactOuvert(false)} />}

      <button className="carte-post bouton-lien-carte" onClick={() => setCguOuvertes(true)} type="button">
        <i className="fa-solid fa-file-contract"></i> Conditions d'utilisation
      </button>
      {cguOuvertes && <PageCgu onFermer={() => setCguOuvertes(false)} />}

      <button className="carte-post bouton-danger" onClick={onDeconnexion} type="button">
        <i className="fa-solid fa-right-from-bracket"></i> Se déconnecter
      </button>
    </div>
  );
}
