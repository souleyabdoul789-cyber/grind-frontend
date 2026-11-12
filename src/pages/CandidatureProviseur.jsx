import { useEffect, useState } from "react";
import { inscrireProviseur } from "../api.js";
import FondAnime from "../components/FondAnime.jsx";

const MAX_FICHIER = 5 * 1024 * 1024;
const MAX_TOTAL = 20 * 1024 * 1024;
const MAX_JUSTIFICATIFS = 5;
const TYPES_IMAGE = ["image/jpeg", "image/png"];
const TYPES_DOCUMENT = [...TYPES_IMAGE, "application/pdf"];

function tailleLisible(octets) {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

function SvgFichier({ pdf = false }) {
  return (
    <svg viewBox="0 0 48 48" width="34" height="34" fill="none" aria-hidden="true">
      <path d="M13 5.5h14l9 9V40a2.5 2.5 0 0 1-2.5 2.5h-20A2.5 2.5 0 0 1 11 40V8a2.5 2.5 0 0 1 2-2.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M27 6v9h9M17 24h14M17 30h14M17 36h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {pdf && <path d="M17 19h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}
    </svg>
  );
}

function ApercuFichier({ fichier }) {
  const [source, setSource] = useState(null);
  const estImage = TYPES_IMAGE.includes(fichier.type);

  useEffect(() => {
    if (!estImage) { setSource(null); return undefined; }
    const url = URL.createObjectURL(fichier);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [fichier, estImage]);

  return (
    <div className="prov-fichier-selectionne">
      <div className={`prov-fichier-apercu ${estImage ? "est-image" : "est-document"}`}>
        {estImage && source ? <img src={source} alt={`Aperçu de ${fichier.name}`} /> : <SvgFichier pdf={fichier.type === "application/pdf"} />}
      </div>
      <div className="prov-fichier-infos">
        <strong title={fichier.name}>{fichier.name}</strong>
        <small>{tailleLisible(fichier.size)} · {estImage ? "Image" : "Document PDF"}</small>
        <span className="prov-fichier-action">Cliquer pour remplacer</span>
      </div>
    </div>
  );
}

function ZoneDepot({ id, titre, description, accept, fichier, onChange, multiple = false, obligatoire = false, onRetirer }) {
  const aFichier = multiple ? fichier.length > 0 : !!fichier;
  return (
    <section className="prov-zone-groupe">
      <div className="prov-zone-entete">
        <span>{titre}</span>
        <small>{obligatoire ? "Obligatoire" : "Facultatif"}</small>
      </div>
      {!aFichier && (
        <label className="prov-zone-depot prov-zone-vide" htmlFor={id}>
          <span className="prov-zone-icone"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <strong>Choisir un fichier</strong>
          <span>{description}</span>
        </label>
      )}
      {aFichier && !multiple && (
        <div className="prov-zone-depot avec-fichier">
          <label htmlFor={id} className="prov-zone-fichier-label"><ApercuFichier fichier={fichier} /></label>
          <button type="button" className="prov-retirer-fichier" onClick={onRetirer} aria-label={`Retirer ${fichier.name}`}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
      {aFichier && multiple && (
        <div className="prov-zone-depot avec-fichier prov-zone-multiple">
          <div className="prov-liste-fichiers">
            {fichier.map((f, index) => (
              <div className="prov-ligne-fichier" key={`${f.name}-${f.size}-${index}`}>
                <label htmlFor={id} className="prov-zone-fichier-label"><ApercuFichier fichier={f} /></label>
                <button type="button" className="prov-retirer-fichier" onClick={() => onRetirer(index)} aria-label={`Retirer ${f.name}`}>
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </button>
              </div>
            ))}
          </div>
          <label htmlFor={id} className="prov-ajouter-autre">+ Ajouter ou remplacer des fichiers</label>
        </div>
      )}
      <input id={id} className="prov-input-fichier" type="file" accept={accept} multiple={multiple} onChange={onChange} />
    </section>
  );
}

function IndicateurEnvoi() {
  return (
    <span className="prov-indicateur-envoi" role="status" aria-live="polite">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
      Transmission sécurisée…
    </span>
  );
}

export default function CandidatureProviseur({ onRetour, onConnecte }) {
  const [form, setForm] = useState({ username: "", prenom: "", nom: "", telephone: "+227", password: "", confirmation: "", etablissement: "" });
  const [photo, setPhoto] = useState(null);
  const [identite, setIdentite] = useState(null);
  const [justificatifs, setJustificatifs] = useState([]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const maj = (cle, valeur) => setForm((ancien) => ({ ...ancien, [cle]: valeur }));

  function verifierFichiers(fichiers, remplacer = null) {
    if (fichiers.some((f) => f.size <= 0 || f.size > MAX_FICHIER)) {
      setErreur("Chaque fichier doit être non vide et ne pas dépasser 5 Mo.");
      return false;
    }
    const existants = [
      ...(remplacer !== "photo" && photo ? [photo] : []),
      ...(remplacer !== "identite" && identite ? [identite] : []),
      ...(remplacer !== "justificatifs" ? justificatifs : []),
    ];
    const prochainTotal = [...existants, ...fichiers].reduce((s, f) => s + f.size, 0);
    if (prochainTotal > MAX_TOTAL) {
      setErreur("La taille totale des pièces ne doit pas dépasser 20 Mo.");
      return false;
    }
    return true;
  }

  function choisirPhoto(event) {
    const f = event.target.files?.[0] || null;
    event.target.value = "";
    if (f && !TYPES_IMAGE.includes(f.type)) { setErreur("La photo personnelle doit être au format JPEG ou PNG."); event.target.value = ""; return; }
    if (f && !verifierFichiers([f], "photo")) { event.target.value = ""; return; }
    setPhoto(f); setErreur("");
  }

  function choisirIdentite(event) {
    const f = event.target.files?.[0] || null;
    event.target.value = "";
    if (f && !TYPES_DOCUMENT.includes(f.type)) { setErreur("La pièce d'identité doit être une image JPEG/PNG ou un PDF."); event.target.value = ""; return; }
    if (f && !verifierFichiers([f], "identite")) { event.target.value = ""; return; }
    setIdentite(f); setErreur("");
  }

  function choisirJustificatifs(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length > MAX_JUSTIFICATIFS) { setErreur(`Maximum ${MAX_JUSTIFICATIFS} justificatifs supplémentaires.`); event.target.value = ""; return; }
    if (files.some((f) => !TYPES_DOCUMENT.includes(f.type))) { setErreur("Les justificatifs doivent être au format JPEG, PNG ou PDF."); event.target.value = ""; return; }
    if (!verifierFichiers(files, "justificatifs")) { event.target.value = ""; return; }
    setJustificatifs(files); setErreur("");
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    if (form.password !== form.confirmation) return setErreur("Les mots de passe ne correspondent pas.");
    if (!photo || !identite) return setErreur("La photo personnelle et la pièce d'identité sont obligatoires.");
    if (justificatifs.length > MAX_JUSTIFICATIFS) return setErreur(`Maximum ${MAX_JUSTIFICATIFS} justificatifs supplémentaires.`);
    const tailleTotale = [photo, identite, ...justificatifs].reduce((s, f) => s + (f?.size || 0), 0);
    if (tailleTotale > MAX_TOTAL) return setErreur("La taille totale des pièces ne doit pas dépasser 20 Mo.");

    const data = new FormData();
    for (const cle of ["username", "prenom", "nom", "telephone", "password", "etablissement"]) data.append(cle, form[cle]);
    data.append("photo_personnelle", photo);
    data.append("piece_identite", identite);
    justificatifs.forEach((f) => data.append("justificatifs", f));
    setEnvoi(true);
    try {
      const resultat = await inscrireProviseur(data);
      localStorage.setItem("grind_session_token", resultat.session_token);
      localStorage.setItem("grind_username", resultat.username);
      localStorage.setItem("grind_role", "");
      localStorage.setItem("grind_type_compte", "proviseur");
      localStorage.setItem("grind_profil_complet", "1");
      onConnecte(resultat);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  const champ = (cle, label, type = "text", placeholder = "") => (
    <label className="champ-prov">
      <span>{label}</span>
      <input type={type} value={form[cle]} onChange={(e) => maj(cle, e.target.value)} placeholder={placeholder} required autoComplete={cle === "password" ? "new-password" : "off"} />
    </label>
  );

  return (
    <div className="page">
      <FondAnime />
      <main className="carte carte-prov">
        <div className="logo-grind"><i className="fa-solid fa-brain"></i><span>GRIND</span></div>
        <h2>Candidature direction / proviseur</h2>
        <p className="info prov-introduction">Le numéro sert uniquement à te contacter manuellement en cas de problème. Aucun code SMS, appel ou WhatsApp automatique ne sera envoyé.</p>
        <form onSubmit={soumettre} className="form-prov">
          <div className="grille-prov">{champ("prenom", "Prénom")}{champ("nom", "Nom de famille")}</div>
          {champ("username", "Nom de profil unique", "text", "Lettres et underscore uniquement")}
          {champ("telephone", "Téléphone avec indicatif international", "tel", "+227XXXXXXXX")}
          {champ("etablissement", "Nom de l'établissement")}
          {champ("password", "Mot de passe", "password")}
          {champ("confirmation", "Confirmer le mot de passe", "password")}

          <div className="prov-documents-titre">
            <strong>Documents de vérification</strong>
            <span>Ces fichiers restent privés et sont réservés à l'administration habilitée.</span>
          </div>
          <ZoneDepot id="prov-photo" titre="Photo personnelle" description="JPEG ou PNG · 5 Mo maximum" accept="image/jpeg,image/png" fichier={photo} onChange={choisirPhoto} onRetirer={() => setPhoto(null)} obligatoire />
          <ZoneDepot id="prov-identite" titre="Pièce d'identité" description="JPEG, PNG ou PDF · 5 Mo maximum" accept="image/jpeg,image/png,application/pdf" fichier={identite} onChange={choisirIdentite} onRetirer={() => setIdentite(null)} obligatoire />
          <ZoneDepot id="prov-justificatifs" titre="Justificatifs supplémentaires" description="Jusqu'à 5 fichiers · 5 Mo chacun" accept="image/jpeg,image/png,application/pdf" fichier={justificatifs} onChange={choisirJustificatifs} onRetirer={(index) => setJustificatifs((anciens) => anciens.filter((_, i) => i !== index))} multiple />
          <p className="prov-confidentialite">Les documents sont chiffrés côté serveur. La photo personnelle et la pièce d'identité ne sont jamais affichées sur ton profil public.</p>
          {erreur && <div className="erreur" role="alert">{erreur}</div>}
          <button type="submit" disabled={envoi} className="prov-bouton-envoi">{envoi ? <IndicateurEnvoi /> : "Envoyer ma candidature"}</button>
          <button type="button" className="lien" onClick={onRetour}>Retour à la connexion</button>
        </form>
      </main>
    </div>
  );
}
