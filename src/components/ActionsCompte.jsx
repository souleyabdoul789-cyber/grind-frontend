import { useState, useEffect } from "react";
import MenuTroisPoints from "./MenuTroisPoints.jsx";
import ModaleSignalement from "./ModaleSignalement.jsx";
import ChargementGrind from "./ChargementGrind.jsx";
import { bloquerCompte, debloquerCompte } from "../api.js";
import { chargerBloques, estBloque, memoriserBlocage } from "../blocages.js";

/**
 * ActionsCompte — le menu « ⋮ » d'un compte (jamais affiché sur son propre compte).
 *  - Signaler le compte
 *  - Ne plus voir ses contenus / Réafficher ses contenus
 * « extras » permet d'ajouter des actions propres au contexte (ex. « Signaler ce post »).
 * Chaque action qui passe par le serveur affiche la mascotte de chargement pendant le traitement.
 */
export default function ActionsCompte({ sessionToken, username, extras = [], direction = "bas", onChange }) {
  const [bloque, setBloque] = useState(estBloque(username));
  const [signalement, setSignalement] = useState(false);
  const [traitement, setTraitement] = useState(null); // { etat: "cours" | "fait" | "erreur", texte, annulable? }

  useEffect(() => {
    let actif = true;
    chargerBloques(sessionToken).then((ensemble) => {
      if (actif) setBloque(ensemble.has(username));
    });
    return () => {
      actif = false;
    };
  }, [sessionToken, username]);

  async function basculerBlocage() {
    const vouloirBloquer = !bloque;
    setTraitement({
      etat: "cours",
      texte: vouloirBloquer ? "Mise en place du filtre..." : "Rétablissement de ses contenus...",
    });
    try {
      if (vouloirBloquer) await bloquerCompte(sessionToken, username);
      else await debloquerCompte(sessionToken, username);
      memoriserBlocage(username, vouloirBloquer);
      setBloque(vouloirBloquer);
      setTraitement({
        etat: "fait",
        texte: vouloirBloquer
          ? `Tu ne verras plus les contenus de ${username}.`
          : `Les contenus de ${username} réapparaîtront dans ton fil.`,
        annulable: vouloirBloquer,
      });
      if (onChange) onChange(username, vouloirBloquer);
    } catch (err) {
      setTraitement({ etat: "erreur", texte: err.message });
    }
  }

  const actions = [
    ...extras,
    { cle: "signaler-compte", icone: "fa-regular fa-flag", label: "Signaler le compte", onClick: () => setSignalement(true) },
    {
      cle: "blocage",
      icone: bloque ? "fa-regular fa-eye" : "fa-regular fa-eye-slash",
      label: bloque ? "Réafficher ses contenus" : "Ne plus voir ses contenus",
      onClick: basculerBlocage,
    },
  ];

  return (
    <>
      <MenuTroisPoints actions={actions} direction={direction} />

      {signalement && (
        <ModaleSignalement
          sessionToken={sessionToken}
          typeCible="profil"
          cibleId={username}
          libelle={`le compte de ${username}`}
          compteCible={username}
          onFermer={() => setSignalement(false)}
          onChange={(u, b) => {
            setBloque(b);
            if (onChange) onChange(u, b);
          }}
        />
      )}

      {traitement && (
        <div className="voile-modal" onClick={traitement.etat === "cours" ? undefined : () => setTraitement(null)}>
          <div className="carte-modal" onClick={(e) => e.stopPropagation()}>
            {traitement.etat === "cours" && <ChargementGrind texte={traitement.texte} />}

            {traitement.etat === "fait" && (
              <>
                <div className="message-modal" style={{ color: "var(--succes)" }}>
                  <i className="fa-solid fa-circle-check"></i>
                  {traitement.texte}
                </div>
                <div className="rangee-boutons">
                  {traitement.annulable && (
                    <button type="button" className="bouton-retour" onClick={basculerBlocage}>Annuler</button>
                  )}
                  <button type="button" onClick={() => setTraitement(null)}>OK</button>
                </div>
              </>
            )}

            {traitement.etat === "erreur" && (
              <>
                <div className="erreur" style={{ marginBottom: 12 }}>{traitement.texte}</div>
                <button type="button" onClick={() => setTraitement(null)}>Fermer</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
