import { useMemo, useState } from "react";
import AvatarIcone from "./AvatarIcone.jsx";

function lireComptesMemorises() {
  try {
    const valeur = JSON.parse(localStorage.getItem("grind_accounts") || "[]");
    if (!Array.isArray(valeur)) return [];
    const uniques = new Map();
    for (const compte of valeur) {
      if (!compte || typeof compte.username !== "string" || !compte.username.trim() || typeof compte.token !== "string" || !compte.token) continue;
      const cle = compte.username.trim().toLowerCase();
      if (!uniques.has(cle)) uniques.set(cle, { ...compte, username: compte.username.trim() });
    }
    return [...uniques.values()];
  } catch {
    return [];
  }
}

function typeCompte(compte) {
  if (compte?.role === "admin") return "Administration GRIND";
  if (compte?.type_compte === "proviseur") return "Espace établissement";
  return "Compte élève";
}

export default function GestionComptes({ sessionToken, monUsername, role, compteType, chargementAction = false, onRetour, onAjouter, onSelectionner }) {
  const [selection, setSelection] = useState("");
  const [erreur, setErreur] = useState("");
  const comptes = useMemo(() => lireComptesMemorises(), []);

  const actif = {
    username: monUsername || localStorage.getItem("grind_username") || "Compte actuel",
    token: sessionToken,
    role: role || "",
    type_compte: compteType || "eleve",
  };
  const limiteComptes = Number(localStorage.getItem("grind_device_max_comptes") || 0);
  const comptesMemorises = Number(localStorage.getItem("grind_device_comptes_memorises") || comptes.length);
  const limiteAtteinte = limiteComptes > 0 && comptesMemorises >= limiteComptes;
  const autres = comptes.filter((compte) =>
    compte.username.toLowerCase() !== String(actif.username).toLowerCase() && compte.token !== sessionToken
  );

  async function choisir(compte) {
    if (!compte?.token || compte.token === sessionToken || selection) return;
    setErreur("");
    setSelection(compte.username);
    try {
      await onSelectionner(compte);
    } catch (cause) {
      setErreur(cause?.message || "Impossible de changer de compte. Réessaie.");
      setSelection("");
    }
  }

  return (
    <main className="gestion-comptes-page">
      <header className="gestion-comptes-entete">
        <button type="button" className="gestion-comptes-retour" onClick={onRetour} aria-label="Retour">
          <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
        </button>
        <div>
          <p className="gestion-comptes-surtitre">ESPACE PERSONNEL</p>
          <h1>Comptes</h1>
          <p className="gestion-comptes-intro">Gère les comptes GRIND mémorisés sur cet appareil.</p>
        </div>
      </header>

      <section className="gestion-comptes-section" aria-labelledby="compte-actuel-titre">
        <h2 id="compte-actuel-titre">Compte actuel</h2>
        <div className="gestion-compte-carte gestion-compte-actif" aria-current="true" aria-disabled="true">
          <AvatarIcone username={actif.username} taille={46} />
          <span className="gestion-compte-infos">
            <strong>@{actif.username}</strong>
            <small>{typeCompte(actif)}</small>
          </span>
          <span className="gestion-compte-statut"><i className="fa-solid fa-check" aria-hidden="true"></i> Actif</span>
        </div>
      </section>

      {autres.length > 0 && (
        <section className="gestion-comptes-section" aria-labelledby="autres-comptes-titre">
          <h2 id="autres-comptes-titre">Autres comptes</h2>
          <div className="gestion-comptes-liste">
            {autres.map((compte) => (
              <button
                key={compte.username.toLowerCase()}
                type="button"
                className="gestion-compte-carte gestion-compte-bouton"
                onClick={() => choisir(compte)}
                disabled={!!selection || chargementAction}
              >
                <AvatarIcone username={compte.username} taille={46} />
                <span className="gestion-compte-infos">
                  <strong>@{compte.username}</strong>
                  <small>{typeCompte(compte)}</small>
                </span>
                <span className="gestion-compte-action">
                  {selection === compte.username
                    ? <i className="fa-solid fa-spinner fa-spin" aria-label="Changement en cours"></i>
                    : <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {erreur && <p className="erreur gestion-comptes-erreur" role="alert">{erreur}</p>}

      <section className="gestion-comptes-ajout">
        <div className="gestion-comptes-ajout-icone"><i className="fa-solid fa-user-plus" aria-hidden="true"></i></div>
        <div className="gestion-comptes-ajout-texte">
          <strong>Ajouter un compte</strong>
          <span>{limiteAtteinte
            ? `La limite de ${limiteComptes} comptes mémorisés sur cet appareil est atteinte.`
            : "Connecte-toi à un autre compte GRIND sur cet appareil."}</span>
        </div>
        <button type="button" className="gestion-comptes-bouton-ajout" onClick={onAjouter} disabled={!!selection || chargementAction || limiteAtteinte}>
          {chargementAction ? "Ouverture…" : limiteAtteinte ? "Limite atteinte" : <>Ajouter <i className="fa-solid fa-arrow-right" aria-hidden="true"></i></>}
        </button>
      </section>

      <p className="gestion-comptes-note">
        Pour protéger chaque compte, GRIND demande son PIN lors du changement de compte. Les limites de comptes mémorisés sont appliquées par le serveur.
      </p>
    </main>
  );
}
