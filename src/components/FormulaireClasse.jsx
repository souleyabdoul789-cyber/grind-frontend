import { useState } from "react";
import { creerClasse, estGrindEnLigne } from "../api.js";

export default function FormulaireClasse({ sessionToken, onCree }) {
  const [nom, setNom] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function creer(event) {
    event.preventDefault();
    setErreur("");
    const nomNormalise = nom.trim().replace(/\s+/g, " ");
    if (nomNormalise.length < 2) {
      setErreur("Le nom de la classe doit contenir au moins 2 caractères.");
      return;
    }
    if (nomNormalise.length > 128) {
      setErreur("Le nom de la classe ne peut pas dépasser 128 caractères.");
      return;
    }
    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour créer une classe." }));
      return;
    }

    setEnvoi(true);
    try {
      await creerClasse(sessionToken, { nom: nomNormalise });
      setNom("");
      onCree?.();
    } catch (cause) {
      setErreur(cause?.message || "La classe n'a pas pu être créée. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="carte-post formulaire-post formulaire-classe-simple" onSubmit={creer} noValidate>
      <div className="formulaire-classe-simple-entete">
        <span className="formulaire-classe-simple-icone" aria-hidden="true"><i className="fa-solid fa-users" /></span>
        <div>
          <strong>Créer une classe</strong>
          <small>Donne un nom clair à ton groupe.</small>
        </div>
      </div>
      <label htmlFor="grind-nom-classe">Nom de la classe</label>
      <input
        id="grind-nom-classe"
        className="formulaire-classe-simple-input"
        type="text"
        value={nom}
        onChange={event => setNom(event.target.value)}
        placeholder="Ex. Groupe de révision BEPC"
        minLength={2}
        maxLength={128}
        autoComplete="off"
        required
      />
      <small className="formulaire-classe-simple-aide">Tu pourras modifier ce nom plus tard.</small>
      {erreur && <div className="erreur" role="alert"><i className="fa-solid fa-triangle-exclamation" /> {erreur}</div>}
      <button type="submit" disabled={envoi || nom.trim().length < 2}>
        {envoi ? <><span className="grind-spinner" aria-hidden="true" /> Création...</> : "Créer la classe"}
      </button>
    </form>
  );
}
