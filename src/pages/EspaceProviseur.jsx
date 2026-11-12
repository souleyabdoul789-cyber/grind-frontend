import { useEffect, useState } from "react";
import FilActu from "./FilActu.jsx";
import { obtenirMaCandidatureProviseur, changerLogoProviseur, uploaderLogoProviseur } from "../api.js";

export default function EspaceProviseur({ sessionToken, onDeconnexion, onChangerCompte, changementCompteEnCours = false }) {
  const [candidature, setCandidature] = useState(null);
  const [logo, setLogo] = useState("");
  const [fichierLogo, setFichierLogo] = useState(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    obtenirMaCandidatureProviseur(sessionToken)
      .then((data) => { setCandidature(data); setLogo(data.logo_url || ""); })
      .catch((err) => setErreur(err.message));
  }, [sessionToken]);

  async function enregistrerLogo(e) {
    e.preventDefault(); setErreur(""); setMessage("");
    try {
      const url = fichierLogo ? await uploaderLogoProviseur(sessionToken, fichierLogo) : logo;
      const data = await changerLogoProviseur(sessionToken, url);
      setCandidature((v) => ({ ...v, logo_url: data.logo_url }));
      setLogo(data.logo_url);
      setFichierLogo(null);
      setMessage("Logo public mis à jour.");
    } catch (err) { setErreur(err.message); }
  }

  return (
    <main className="espace-prov page">
      <div className="carte">
        <div className="logo-grind"><i className="fa-solid fa-brain"></i><span>GRIND</span></div>
        <h2>Espace établissement</h2>
        <div className="prov-actions-compte">
          {onChangerCompte && <button type="button" className="lien" onClick={onChangerCompte} disabled={changementCompteEnCours}>{changementCompteEnCours ? <><i className="fa-solid fa-spinner fa-spin"></i> Changement...</> : <><i className="fa-solid fa-users"></i> Changer de compte</>}</button>}
          <button type="button" className="lien" onClick={onDeconnexion}>Se déconnecter</button>
        </div>
        {!candidature && !erreur && <p className="info">Chargement du dossier...</p>}
        {erreur && <div className="erreur">{erreur}</div>}
        {candidature && <>
          <p><b>{candidature.prenom} {candidature.nom}</b> · @{candidature.username}</p>
          <p>Établissement déclaré : {candidature.etablissement_declare}</p>
          <div className={`prov-statut prov-statut-${candidature.statut}`}>
            {candidature.statut === "en_attente" && "Candidature reçue. L'administration vérifie les documents privés avant toute autorisation."}
            {candidature.statut === "rejete" && "La candidature n'a pas été approuvée. Consulte la note de l'administration ci-dessous."}
            {candidature.statut === "approuve" && "Candidature approuvée. Les établissements et droits autorisés sont indiqués ci-dessous."}
          </div>
          {candidature.message_candidat && <p><b>Message de l'administration :</b> {candidature.message_candidat}</p>}
          {candidature.etablissements?.length > 0 && <div><h3>Établissements autorisés</h3>{candidature.etablissements.map((e) => <p key={e.id}>{e.nom} {e.moderation_locale ? "· modération locale autorisée" : ""}</p>)}</div>}
          {candidature.statut === "approuve" && <form onSubmit={enregistrerLogo} className="form-prov">
            <h3>Logo public de l'établissement</h3>
            {candidature.logo_url && <img src={candidature.logo_url} alt="Logo de l'établissement" style={{ width: 84, height: 84, objectFit: "contain" }} />}
            <label className="champ-prov"><span>Importer un nouveau logo (JPEG ou PNG, 5 Mo maximum)</span><input type="file" accept="image/jpeg,image/png" onChange={(e) => setFichierLogo(e.target.files?.[0] || null)} /></label>
            <label className="champ-prov"><span>Ou coller une URL Cloudinary déjà hébergée</span><input type="url" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://res.cloudinary.com/..." /></label>
            <button type="submit">Enregistrer le logo</button>
          </form>}
          {candidature.statut === "approuve" && <section className="prov-fil-institutionnel"><h3>Publications de l'établissement</h3><p className="info">Ces publications sont visibles dans le réseau de l'établissement. La légende, les photos, les vidéos et les documents sont disponibles comme dans le fil des élèves.</p><FilActu sessionToken={sessionToken} monUsername={candidature.username} modeInstitutionnel etablissements={candidature.etablissements || []} /></section>}
        </>}
        {message && <p className="info">{message}</p>}
      </div>
    </main>
  );
}
