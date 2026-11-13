import { useEffect, useState } from "react";
import { finaliserNomProfilInscription, verifierNomProfilInscription } from "../api.js";

/** Dernière étape d'identité publique : le serveur reste l'autorité sur la disponibilité. */
export default function EtapeNomProfil({ jetonInscription, onTermine }) {
  const [username, setUsername] = useState("");
  const [etat, setEtat] = useState({ type: "vide", message: "Choisis un identifiant public unique de 3 à 24 caractères.", suggestions: [] });
  const [chargement, setChargement] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const valeur = username.trim();

  useEffect(() => {
    if (!valeur) {
      setEtat({ type: "vide", message: "Choisis un identifiant public unique de 3 à 24 caractères.", suggestions: [] });
      return undefined;
    }
    let actif = true;
    setChargement(false);
    setEtat({ type: "verification", message: "Vérification de la disponibilité…", suggestions: [] });
    const minuteur = window.setTimeout(async () => {
      setChargement(true);
      try {
        const resultat = await verifierNomProfilInscription(jetonInscription, valeur);
        if (!actif) return;
        setEtat({
          type: resultat.disponible ? "disponible" : resultat.valide ? "pris" : "invalide",
          message: resultat.message,
          suggestions: Array.isArray(resultat.suggestions) ? resultat.suggestions : [],
        });
      } catch (erreur) {
        if (!actif) return;
        setEtat({ type: "erreur", message: erreur.message || "La vérification est momentanément indisponible.", suggestions: [] });
      } finally {
        if (actif) setChargement(false);
      }
    }, 350);
    return () => { actif = false; window.clearTimeout(minuteur); };
  }, [valeur, jetonInscription]);

  async function valider(e) {
    e.preventDefault();
    if (etat.type !== "disponible" || chargement || enregistrement) return;
    setEnregistrement(true);
    try {
      const resultat = await finaliserNomProfilInscription(jetonInscription, valeur);
      onTermine(resultat);
    } catch (erreur) {
      const suggestions = erreur.donnees?.suggestions || [];
      setEtat({ type: "pris", message: erreur.message || "Ce nom de profil n'est plus disponible.", suggestions });
    } finally {
      setEnregistrement(false);
    }
  }

  const statutPositif = etat.type === "disponible";
  const statutNegatif = ["pris", "invalide", "erreur"].includes(etat.type);

  return (
    <form className="etape-nom-profil" onSubmit={valider} noValidate>
      <div className="nom-profil-etape-icone"><i className="fa-solid fa-at" aria-hidden="true" /></div>
      <div className="nom-profil-etape-titre">Choisis ton nom de profil</div>
      <p className="nom-profil-etape-description">
        C'est ton identifiant public sur GRIND. Il servira aux mentions, aux tags et à la connexion. Tu pourras le communiquer aux autres membres.
      </p>

      <label className="nom-profil-label" htmlFor="grind-nom-profil">Nom de profil</label>
      <div className={`nom-profil-saisie ${statutPositif ? "est-disponible" : ""} ${statutNegatif ? "est-invalide" : ""}`}>
        <span aria-hidden="true">@</span>
        <input
          id="grind-nom-profil"
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/^@+/, "").toLowerCase())}
          placeholder="ex. souley_abdoul"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          minLength={3}
          maxLength={24}
          autoFocus
          aria-describedby="grind-nom-profil-aide grind-nom-profil-statut"
        />
        <span className="nom-profil-etat-icone" aria-hidden="true">
          {etat.type === "verification" ? <i className="fa-solid fa-circle-notch fa-spin" /> : statutPositif ? <i className="fa-solid fa-circle-check" /> : statutNegatif ? <i className="fa-solid fa-circle-xmark" /> : <i className="fa-solid fa-at" />}
        </span>
      </div>
      <p id="grind-nom-profil-aide" className="nom-profil-aide">3 à 24 caractères : lettres, chiffres, point, tiret ou souligné. Pas d'espaces.</p>
      <div id="grind-nom-profil-statut" className={`nom-profil-statut ${statutPositif ? "positif" : statutNegatif ? "negatif" : ""}`} role="status" aria-live="polite">
        {etat.message}
      </div>

      {etat.suggestions.length > 0 && (
        <div className="nom-profil-suggestions">
          <span>Suggestions disponibles</span>
          <div>
            {etat.suggestions.map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => setUsername(suggestion)}>@{suggestion}</button>
            ))}
          </div>
        </div>
      )}

      <button className="nom-profil-valider" type="submit" disabled={!statutPositif || chargement || enregistrement}>
        {enregistrement ? <><span className="grind-spinner" /> Création du profil…</> : "Valider mon nom de profil"}
      </button>
      <p className="nom-profil-note"><i className="fa-solid fa-shield-halved" aria-hidden="true" /> La disponibilité est contrôlée par le serveur au moment de la saisie et à la validation finale.</p>
    </form>
  );
}
