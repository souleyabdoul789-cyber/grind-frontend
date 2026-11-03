// Comptes que l'utilisateur ne veut plus voir (« Ne plus voir ses contenus »).
// Un seul chargement partagé par tous les menus de la page : pas une requête par post.
import { listerBloques } from "./api.js";

let cache = null; // Set des pseudos masqués
let promesse = null;

export function chargerBloques(sessionToken) {
  if (cache) return Promise.resolve(cache);
  if (!promesse) {
    promesse = listerBloques(sessionToken)
      .then((res) => {
        cache = new Set(res.bloques || []);
        return cache;
      })
      .catch(() => {
        promesse = null;
        return new Set();
      });
  }
  return promesse;
}

export function estBloque(username) {
  return !!cache && cache.has(username);
}

export function memoriserBlocage(username, bloque) {
  if (!cache) cache = new Set();
  if (bloque) cache.add(username);
  else cache.delete(username);
}

export function oublierBloques() {
  cache = null;
  promesse = null;
}
