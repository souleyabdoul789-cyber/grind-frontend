import { GRIND_URL } from "./api.js";

async function requeteSalle(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { cache: "no-store", ...options });
  } catch (cause) {
    const error = new Error("Le serveur GRIND ne répond pas. Vérifie la connexion puis réessaie.");
    error.cause = cause;
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof data.detail === "string" ? data.detail : "Opération impossible dans la salle de classe.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function urlHistorique(classeId, type, suffix = "") {
  const url = new URL(`${GRIND_URL}/api/classes/${Number(classeId)}/salle/historique/${encodeURIComponent(type)}${suffix}`);
  return url;
}

export function capturerHistoriqueSalle(sessionToken, classeId, type) {
  return requeteSalle(urlHistorique(classeId, type, "/capturer"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken }),
  });
}

export function listerHistoriqueSalle(sessionToken, classeId, type) {
  const url = urlHistorique(classeId, type);
  url.searchParams.set("session_token", sessionToken);
  return requeteSalle(url);
}

export function obtenirVersionHistoriqueSalle(sessionToken, classeId, type, versionId) {
  const url = urlHistorique(classeId, type, `/${Number(versionId)}`);
  url.searchParams.set("session_token", sessionToken);
  return requeteSalle(url);
}

export function restaurerVersionHistoriqueSalle(sessionToken, classeId, type, versionId) {
  return requeteSalle(urlHistorique(classeId, type, `/${Number(versionId)}/restaurer`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken }),
  });
}
