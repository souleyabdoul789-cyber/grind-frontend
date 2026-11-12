import { useState } from "react";
import { reinitialiserMotDePasse } from "../api.js";
import ChampAvecIcone from "./ChampAvecIcone.jsx";

/** Indice de robustesse affiché pendant la saisie. Purement informatif : le serveur applique les vraies règles. */
export function forceMotDePasse(mdp) {
  if (!mdp) return { niveau: 0, libelle: "" };
  let points = 0;
  if (mdp.length >= 8) points += 1;
  if (mdp.length >= 12) points += 1;
  if (/[a-z]/.test(mdp) && /[A-Z]/.test(mdp)) points += 1;
  if (/[0-9]/.test(mdp)) points += 1;
  if (/[^A-Za-z0-9]/.test(mdp)) points += 1;
  if (mdp.length < 8) return { niveau: 1, libelle: "Trop court" };
  if (points <= 2) return { niveau: 1, libelle: "Faible" };
  if (points === 3) return { niveau: 2, libelle: "Correct" };
  return { niveau: 3, libelle: "Solide" };
}

export function IndicateurForce({ mdp }) {
  const { niveau, libelle } = forceMotDePasse(mdp);
  if (!mdp) return null;
  return (
    <div className="force-mdp" aria-live="polite">
      <div className="force-mdp-barres">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`force-mdp-barre ${niveau >= n ? `force-mdp-barre-${niveau}` : ""}`}></span>
        ))}
      </div>
      <span className="force-mdp-libelle">{libelle}</span>
    </div>
  );
}

export default function EtapeNouveauMotDePasse({ jeton, onTermine, onAnnuler }) {
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(e) {
    e.preventDefault();
    setErreur(null);
    if (mdp !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setEnvoi(true);
    try {
      await reinitialiserMotDePasse(jeton, mdp);
      onTermine();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={envoyer} className="etape-verification">
      <div className="icone-etape"><i className="fa-solid fa-lock"></i></div>
      <div className="etape-question">Choisis ton nouveau mot de passe</div>
      <p className="verification-texte">Ton code est validé. Après ce changement, tu seras déconnecté de tes autres appareils.</p>

      <ChampAvecIcone icone="fa-solid fa-lock" valeur={mdp} onChange={setMdp} placeholder="Nouveau mot de passe" bascule autoComplete="new-password" autoFocus />
      <IndicateurForce mdp={mdp} />
      <ChampAvecIcone icone="fa-solid fa-lock" valeur={confirmation} onChange={setConfirmation} placeholder="Confirme le mot de passe" bascule autoComplete="new-password" />

      {erreur && (
        <div className="erreur" role="alert">
          <i className="fa-solid fa-triangle-exclamation"></i>
          {erreur}
        </div>
      )}

      <button type="submit" disabled={envoi || !mdp || !confirmation}>
        {envoi ? <><span className="grind-spinner" /> Enregistrement…</> : "Changer le mot de passe"}
      </button>
      <button type="button" className="lien" onClick={onAnnuler}>
        <i className="fa-solid fa-arrow-left"></i> Annuler
      </button>
    </form>
  );
}
