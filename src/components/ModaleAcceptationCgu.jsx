import { useState } from "react";
import { accepterCgu } from "../api.js";
import PageCgu from "./PageCgu.jsx";

/**
 * Affichée une seule fois aux comptes qui n'ont pas encore accepté la
 * version actuelle des CGU (comptes créés avant leur mise en ligne, ou
 * après une modification du texte). Bloque l'app tant que ce n'est pas fait.
 */
export default function ModaleAcceptationCgu({ sessionToken, onAccepte, onRefuse }) {
  const [lecture, setLecture] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function accepter() {
    setEnvoi(true);
    setErreur(null);
    try {
      await accepterCgu(sessionToken);
      onAccepte();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <>
      <div className="voile-modal voile-bloquant">
        <div className="carte-modal carte-modal-large">
          <div className="sous-titre" style={{ marginBottom: 10 }}>
            <i className="fa-solid fa-file-contract"></i> Conditions d'utilisation
          </div>
          <p className="texte-modal">
            GRIND a maintenant des règles de vie commune, un système de signalement et une
            administration. Pour continuer à utiliser GRIND, lis et accepte les conditions d'utilisation.
          </p>
          <button type="button" className="lien" style={{ margin: "0 0 14px" }} onClick={() => setLecture(true)}>
            <i className="fa-solid fa-book-open"></i> Lire les conditions
          </button>

          {erreur && <div className="erreur" style={{ marginBottom: 10 }}>{erreur}</div>}

          <div className="rangee-boutons">
            <button type="button" className="bouton-retour" onClick={onRefuse} disabled={envoi}>
              Se déconnecter
            </button>
            <button type="button" onClick={accepter} disabled={envoi}>
              {envoi ? "..." : "J'accepte"}
            </button>
          </div>
        </div>
      </div>
      {lecture && <PageCgu onFermer={() => setLecture(false)} />}
    </>
  );
}
