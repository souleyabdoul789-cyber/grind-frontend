import { useState } from "react";
import { inscrireProviseur } from "../api.js";
import FondAnime from "../components/FondAnime.jsx";

export default function CandidatureProviseur({ onRetour, onConnecte }) {
  const [form, setForm] = useState({ username: "", prenom: "", nom: "", telephone: "+227", password: "", confirmation: "", etablissement: "" });
  const [photo, setPhoto] = useState(null);
  const [identite, setIdentite] = useState(null);
  const [justificatifs, setJustificatifs] = useState([]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const maj = (cle, valeur) => setForm((ancien) => ({ ...ancien, [cle]: valeur }));

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    if (form.password !== form.confirmation) return setErreur("Les mots de passe ne correspondent pas.");
    if (!photo || !identite) return setErreur("La photo personnelle et la pièce d'identité sont obligatoires.");
    if (justificatifs.length > 5) return setErreur("Maximum 5 justificatifs supplémentaires.");
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
        <p className="info">Le numéro sert uniquement à te contacter manuellement en cas de problème. Aucun code SMS, appel ou WhatsApp automatique ne sera envoyé.</p>
        <form onSubmit={soumettre} className="form-prov">
          <div className="grille-prov">{champ("prenom", "Prénom")}{champ("nom", "Nom de famille")}</div>
          {champ("username", "Nom de profil unique", "text", "Lettres et underscore uniquement")}
          {champ("telephone", "Téléphone avec indicatif international", "tel", "+227XXXXXXXX")}
          {champ("etablissement", "Nom de l'établissement")}
          {champ("password", "Mot de passe", "password")}
          {champ("confirmation", "Confirmer le mot de passe", "password")}
          <label className="champ-prov"><span>Photo personnelle — privée, pour vérification</span><input type="file" accept="image/jpeg,image/png" onChange={(e) => setPhoto(e.target.files?.[0] || null)} required /></label>
          <label className="champ-prov"><span>Pièce d'identité — privée, obligatoire</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setIdentite(e.target.files?.[0] || null)} required /></label>
          <label className="champ-prov"><span>Justificatifs supplémentaires (facultatifs, 5 maximum)</span><input type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={(e) => setJustificatifs(Array.from(e.target.files || []).slice(0, 5))} /></label>
          <p className="info">Les pièces sont chiffrées et accessibles uniquement à l'administration autorisée. Le profil public n'affichera pas ta photo personnelle.</p>
          {erreur && <div className="erreur" role="alert">{erreur}</div>}
          <button type="submit" disabled={envoi}>{envoi ? "Envoi..." : "Envoyer ma candidature"}</button>
          <button type="button" className="lien" onClick={onRetour}>Retour à la connexion</button>
        </form>
      </main>
    </div>
  );
}
