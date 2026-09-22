// GRIND_URL = seul serveur que le frontend appelle directement.
// Pluton (G-SOCIETY) n'est plus contacté ici : la clé G-SOCIETY est
// collée manuellement par l'utilisateur au moment de l'inscription
// GRIND, GRIND se charge lui-même de la vérifier auprès de Pluton
// côté serveur.
export const GRIND_URL = import.meta.env.VITE_GRIND_URL || "https://grind-4vsz.onrender.com";

async function poster(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Une erreur est survenue");
  }
  return data;
}

// ---------- Compte GRIND (propre à GRIND, distinct de G-SOCIETY) ----------

export function inscrireGrind(username, password, apiKeyGSociety) {
  return poster(`${GRIND_URL}/api/compte/signup`, {
    username,
    password,
    api_key: apiKeyGSociety,
  });
}

export function connecterGrind(username, password) {
  return poster(`${GRIND_URL}/api/compte/login`, { username, password });
}

// ---------- Profil GRIND (questionnaire) ----------

export function enregistrerProfil(sessionToken, { age, pays, niveau, difficultes }) {
  return poster(`${GRIND_URL}/api/profil`, {
    session_token: sessionToken,
    age,
    pays,
    niveau,
    difficultes,
  });
}
