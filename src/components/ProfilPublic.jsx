import { useState, useEffect } from "react";
import { obtenirProfilDe, obtenirAvatarDe } from "../api.js";
import { nomPays } from "../paysListe.js";
import AvatarPersonnage from "./AvatarPersonnage.jsx";
import ActionsCompte from "./ActionsCompte.jsx";
import IconeCompteBloque from "./IconeCompteBloque.jsx";
import BadgeCompte from "./BadgeCompte.jsx";

export default function ProfilPublic({ username, onRetour, sessionToken, monUsername }) {
  const [profil, setProfil] = useState(null);
  const [avatarConfig, setAvatarConfig] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    async function charger() {
      const [resProfil, resAvatar] = await Promise.all([
        obtenirProfilDe(username),
        obtenirAvatarDe(username),
      ]);
      setProfil(resProfil);
      setAvatarConfig(resAvatar.config);
      setChargement(false);
    }
    charger();
  }, [username]);

  if (chargement) {
    return (
      <div className="fil-actu">
        <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>
      </div>
    );
  }

  // Compte sanctionné : même apparence que sur WhatsApp, ses contenus ne sont plus accessibles.
  if (profil?.sanctionne) {
    return (
      <div className="fil-actu">
        <button type="button" className="lien" onClick={onRetour} style={{ marginBottom: 12 }}>
          <i className="fa-solid fa-arrow-left"></i> Retour
        </button>
        <div className="compte-indisponible">
          <IconeCompteBloque taille={96} />
          <div className="sous-titre" style={{ marginTop: 14 }}>Ce compte n'est plus disponible</div>
          <div className="info">Ses contenus ne sont plus accessibles.</div>
        </div>
      </div>
    );
  }

  let difficultesListe = [];
  try {
    difficultesListe = JSON.parse(profil?.difficultes || "[]");
  } catch {
    difficultesListe = (profil?.difficultes || "").split(",").map((d) => d.trim()).filter(Boolean);
  }

  return (
    <div className="fil-actu">
      <button type="button" className="lien" onClick={onRetour} style={{ marginBottom: 12 }}>
        <i className="fa-solid fa-arrow-left"></i> Retour
      </button>

      <div className="carte-post entete-profil">
        {profil?.proviseur ? (
          <div className="profil-prov-logo" aria-label="Logo de l'établissement">
            {profil.proviseur.logo_url
              ? <img src={profil.proviseur.logo_url} alt={`Logo de ${profil.proviseur.etablissements?.[0] || "l'établissement"}`} />
              : <i className="fa-solid fa-school" aria-hidden="true"></i>}
          </div>
        ) : (
          <div className="apercu-avatar" style={{ padding: 0, background: "none", marginBottom: 8 }}>
            <AvatarPersonnage config={avatarConfig} taille={120} />
          </div>
        )}
        <div className="auteur-post" style={{ fontSize: 20 }}>{profil?.proviseur ? `${profil.proviseur.nom_etablissement || profil.proviseur.etablissements?.[0] || "Établissement"}` : username}<BadgeCompte badge={profil?.badge} taille={18} />{profil?.proviseur && <span className="chip">@{username}</span>}</div>
        {profil?.proviseur?.etablissements?.map((nom, i) => <div className="info" key={`${nom}-${i}`}><i className="fa-solid fa-school"></i> {nom}</div>)}
        {sessionToken && username !== monUsername && (
          <div className="menu-profil">
            <ActionsCompte sessionToken={sessionToken} username={username} direction="bas" />
          </div>
        )}
      </div>

      {profil?.profil_existe ? (
        <>
          <div className="carte-post">
            <div className="ligne-info">
              <span className={`fi fi-${profil.pays} drapeau`}></span>
              <span>{nomPays(profil.pays)}</span>
            </div>
            <div className="ligne-info">
              <i className="fa-solid fa-graduation-cap"></i>
              <span>{profil.niveau}</span>
            </div>
            {profil.filiere && <div className="ligne-info"><i className="fa-solid fa-book-open"></i><span>{profil.filiere}</span></div>}
            {profil.etablissement && <div className="ligne-info"><i className="fa-solid fa-school"></i><span>{profil.etablissement}</span></div>}
          </div>

          {difficultesListe.length > 0 && (
            <div className="carte-post">
              <div className="sous-titre" style={{ marginBottom: 10 }}>Matières à travailler</div>
              <div className="choix-categorie" style={{ flexWrap: "wrap" }}>
                {difficultesListe.map((d, i) => (
                  <span key={i} className="chip">{d}</span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="info"><i className="fa-solid fa-circle-info"></i> Profil pas encore rempli.</div>
      )}
    </div>
  );
}
