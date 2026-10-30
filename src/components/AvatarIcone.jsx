import { useState, useEffect } from "react";
import { obtenirAvatarDe } from "../api.js";
import AvatarPersonnage from "./AvatarPersonnage.jsx";

// Cache partagé : un même pseudo n'est demandé qu'une seule fois au serveur.
const cacheAvatars = new Map();

/**
 * AvatarIcone — le visage de l'avatar, rond, comme une photo de profil.
 * Cliquable si onClic est fourni (ouvre le profil de la personne).
 */
export default function AvatarIcone({ username, taille = 28, config = null, onClic }) {
  const [cfg, setCfg] = useState(config || cacheAvatars.get(username) || null);

  useEffect(() => {
    if (config) {
      setCfg(config);
      return undefined;
    }
    if (cacheAvatars.has(username)) {
      setCfg(cacheAvatars.get(username));
      return undefined;
    }
    let actif = true;
    obtenirAvatarDe(username)
      .then((res) => {
        cacheAvatars.set(username, res.config);
        if (actif) setCfg(res.config);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [username, config]);

  return (
    <button
      type="button"
      className="avatar-icone"
      style={{ width: taille, height: taille }}
      onClick={() => onClic && onClic(username)}
      aria-label={`Voir le profil de ${username}`}
    >
      <AvatarPersonnage config={cfg} taille={taille} vue="tete" />
    </button>
  );
}
