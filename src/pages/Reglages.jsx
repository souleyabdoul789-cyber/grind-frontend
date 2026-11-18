import PageCgu from "../components/PageCgu.jsx";
import ContactSupport from "../components/ContactSupport.jsx";
import AideGrind from "../components/AideGrind.jsx";
import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { obtenirMonProfil, modifierIdentite } from "../api.js";
import "../reglages-extra.css";

const VERSION_DISTANTE_URL = "https://raw.githubusercontent.com/souleyabdoul789-cyber/grind-frontend/main/public/grind-update.json";
const DELAI_VERIFICATION_MAJ = 12000;
const URL_APK_SECOURS = "https://www.mediafire.com/file/ynfql3kz04yb5wq/GRIND.apk/file";

function comparerVersions(a, b) {
  const parse = (version) => {
    if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) return null;
    const parties = version.split(".").map(Number);
    return parties.every((partie) => Number.isSafeInteger(partie) && partie >= 0) ? parties : null;
  };
  const gauche = parse(a);
  const droite = parse(b);
  if (!gauche || !droite) return null;
  for (let i = 0; i < 3; i += 1) {
    if (gauche[i] > droite[i]) return 1;
    if (gauche[i] < droite[i]) return -1;
  }
  return 0;
}

function validerManifesteMiseAJour(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) || data.platform !== "android") {
    throw new Error("Le manifeste de mise à jour Android est invalide.");
  }
  if (comparerVersions(data.version, "0.0.0") === null) {
    throw new Error("La version publiée dans le manifeste est invalide.");
  }
  const lien = new URL(data.downloadUrl || URL_APK_SECOURS);
  const domaineAutorise = lien.protocol === "https:" &&
    (lien.hostname === "mediafire.com" || lien.hostname.endsWith(".mediafire.com"));
  if (!domaineAutorise || !lien.pathname.startsWith("/file/")) {
    throw new Error("Le lien de téléchargement publié n'est pas autorisé.");
  }
  return {
    version: data.version,
    downloadUrl: lien.href,
    releaseNotes: Array.isArray(data.releaseNotes)
      ? data.releaseNotes.filter((note) => typeof note === "string").slice(0, 8)
      : [],
  };
}

export default function Reglages({ sessionToken, monUsername, onDeconnexion }) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [identiteChargee, setIdentiteChargee] = useState(false);
  const [editionIdentite, setEditionIdentite] = useState(false);
  const [identiteErreur, setIdentiteErreur] = useState("");
  const [sauvegardeIdentite, setSauvegardeIdentite] = useState(false);
  const [cguOuvertes, setCguOuvertes] = useState(false);
  const [contactOuvert, setContactOuvert] = useState(false);
  const [aideOuverte, setAideOuverte] = useState(false);
  const [versionInstallee, setVersionInstallee] = useState("");
  const [etatMaj, setEtatMaj] = useState({ statut: "idle", message: "", version: null, lien: null, notes: [] });
  const [ouvertureApk, setOuvertureApk] = useState(false);
  const estAndroid = Capacitor.getPlatform() === "android";

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

  useEffect(() => {
    if (!estAndroid) return undefined;
    let actif = true;
    CapacitorApp.getInfo()
      .then((info) => {
        if (actif) setVersionInstallee(typeof info.version === "string" ? info.version : "");
      })
      .catch(() => {
        if (actif) setVersionInstallee("");
      });
    return () => { actif = false; };
  }, [estAndroid]);

  async function verifierMiseAJour() {
    if (!estAndroid || etatMaj.statut === "checking") return;
    setEtatMaj({ statut: "checking", message: "Vérification de la version publiée…", version: null, lien: null, notes: [] });
    const controleur = new AbortController();
    const delai = window.setTimeout(() => controleur.abort(), DELAI_VERIFICATION_MAJ);
    try {
      const separateur = VERSION_DISTANTE_URL.includes("?") ? "&" : "?";
      const reponse = await fetch(`${VERSION_DISTANTE_URL}${separateur}t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controleur.signal,
      });
      if (!reponse.ok) throw new Error(`Le service de version a répondu HTTP ${reponse.status}.`);
      const manifeste = validerManifesteMiseAJour(await reponse.json());
      const comparaison = comparerVersions(manifeste.version, versionInstallee);
      if (comparaison === null) throw new Error("Impossible de lire la version installée sur cet appareil.");
      if (comparaison > 0) {
        setEtatMaj({
          statut: "available",
          message: `Une nouvelle version de GRIND est disponible : ${manifeste.version}.`,
          version: manifeste.version,
          lien: manifeste.downloadUrl,
          notes: manifeste.releaseNotes,
        });
      } else if (comparaison === 0) {
        setEtatMaj({
          statut: "current",
          message: `GRIND est à jour (version ${versionInstallee}).`,
          version: manifeste.version,
          lien: null,
          notes: [],
        });
      } else {
        setEtatMaj({
          statut: "notice",
          message: `Les informations de mise à jour ne sont pas synchronisées : cette application est en version ${versionInstallee}, tandis que le catalogue référence ${manifeste.version}. La vérification sera disponible après actualisation du catalogue.`,
          version: manifeste.version,
          lien: null,
          notes: [],
        });
      }
    } catch (erreur) {
      const message = erreur?.name === "AbortError"
        ? "La vérification a dépassé le délai autorisé. Réessaie lorsque la connexion est stable."
        : erreur.message || "Impossible de vérifier les mises à jour.";
      setEtatMaj({ statut: "error", message, version: null, lien: null, notes: [] });
    } finally {
      window.clearTimeout(delai);
    }
  }

  async function ouvrirTelechargementApk() {
    if (!estAndroid || !etatMaj.lien || ouvertureApk) return;
    setOuvertureApk(true);
    try {
      await Browser.open({ url: etatMaj.lien, presentationStyle: "popover" });
    } catch {
      // Repli natif : Android ouvre le lien dans le navigateur disponible.
      window.location.assign(etatMaj.lien);
    } finally {
      setOuvertureApk(false);
    }
  }

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

  const retourReglagesRef = useRef({});
  retourReglagesRef.current = { contactOuvert, cguOuvertes, aideOuverte, editionIdentite };

  useEffect(() => {
    const gererRetourReglages = (event) => {
      if (event.defaultPrevented) return;
      const vue = retourReglagesRef.current;
      if (vue.aideOuverte) { setAideOuverte(false); event.preventDefault(); return; }
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

  if (aideOuverte) return <AideGrind onFermer={() => setAideOuverte(false)} />;

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
          <button type="button" className={`interrupteur ${notifAide ? "interrupteur-actif" : ""}`} onClick={basculerNotifAide} aria-pressed={notifAide} aria-label="Activer ou désactiver les demandes d'aide">
            <span className="curseur-interrupteur"></span>
          </button>
        </div>

        <div className="ligne-reglage">
          <span>Invitations de classe</span>
          <button type="button" className={`interrupteur ${notifClasses ? "interrupteur-actif" : ""}`} onClick={basculerNotifClasses} aria-pressed={notifClasses} aria-label="Activer ou désactiver les invitations de classe">
            <span className="curseur-interrupteur"></span>
          </button>
        </div>
      </div>

      {estAndroid && (
        <section className="carte-post grind-update-card" aria-labelledby="grind-update-title">
          <div className="grind-update-heading">
            <span className="grind-update-icon"><i className="fa-solid fa-arrow-rotate-right" aria-hidden="true" /></span>
            <div>
              <h3 id="grind-update-title">Mise à jour de GRIND</h3>
              <p>Version installée : {versionInstallee || "lecture en cours…"}</p>
            </div>
          </div>
          <button type="button" className="grind-update-check" onClick={verifierMiseAJour} disabled={!versionInstallee || etatMaj.statut === "checking"}>
            <i className={`fa-solid ${etatMaj.statut === "checking" ? "fa-spinner fa-spin" : "fa-rotate"}`} aria-hidden="true" />
            {etatMaj.statut === "checking" ? "Vérification…" : "Vérifier les mises à jour"}
          </button>
          {etatMaj.message && <p className={`grind-update-status ${etatMaj.statut === "error" ? "error" : etatMaj.statut === "current" ? "success" : etatMaj.statut === "notice" ? "notice" : ""}`} role="status">{etatMaj.message}</p>}
          {etatMaj.statut === "available" && (
            <>
              {etatMaj.notes.length > 0 && <ul className="grind-update-notes">{etatMaj.notes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>}
              <button type="button" className="grind-update-download" onClick={ouvrirTelechargementApk} disabled={ouvertureApk}>
                <i className={`fa-solid ${ouvertureApk ? "fa-spinner fa-spin" : "fa-download"}`} aria-hidden="true" />
                {ouvertureApk ? "Ouverture du téléchargement…" : `Télécharger GRIND ${etatMaj.version}`}
              </button>
              <small className="grind-update-note">Android demandera de confirmer l'installation du fichier APK. GRIND ne s'installe pas en silence.</small>
            </>
          )}
        </section>
      )}

      <button className="carte-post bouton-lien-carte" onClick={() => setContactOuvert(true)} type="button">
        <i className="fa-solid fa-robot"></i> Assistance IA GRIND
      </button>
      {contactOuvert && <ContactSupport sessionToken={sessionToken} onFermer={() => setContactOuvert(false)} />}

      <a className="carte-post bouton-lien-carte grind-human-contact-settings" href="mailto:grind.supportt@gmail.com?subject=Contact%20GRIND">
        <i className="fa-solid fa-envelope"></i> Contacter G-SOCIETY par e-mail · grind.supportt@gmail.com
      </a>

      <button className="carte-post bouton-lien-carte" onClick={() => setCguOuvertes(true)} type="button">
        <i className="fa-solid fa-file-contract"></i> Conditions d'utilisation
      </button>
      {cguOuvertes && <PageCgu onFermer={() => setCguOuvertes(false)} />}

      <button className="carte-post bouton-lien-carte grind-help-entry" onClick={() => setAideOuverte(true)} type="button">
        <span className="grind-help-entry-icon"><i className="fa-solid fa-circle-question" aria-hidden="true" /></span>
        <span><strong>Centre d'aide GRIND</strong><small>Guide détaillé des classes, discussions, comptes, publications, documents et Library</small></span>
        <i className="fa-solid fa-chevron-right" aria-hidden="true" />
      </button>

      <button className="carte-post bouton-danger" onClick={onDeconnexion} type="button">
        <i className="fa-solid fa-right-from-bracket"></i> Se déconnecter
      </button>
    </div>
  );
}
