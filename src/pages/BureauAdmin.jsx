import { useState, useEffect, useCallback } from "react";
import { obtenirMonStatut, adminApercu, adminDefinirNom } from "../api.js";
import BadgeCompte from "../components/BadgeCompte.jsx";
import { SalleSignalements, SalleUtilisateurs } from "./Admin.jsx";
import { SalleEquipe, SalleCertification, SalleAnnonces } from "./SallesEquipe.jsx";
import SalleSupport from "./SalleSupport.jsx";
import { libelleRole } from "../moderationInfos.js";

const NOM_PAR_DEFAUT = "GRIND Admin";

// Chaque salle n'apparaît que si le rôle en a la permission (le serveur applique la même règle).
const SALLES = [
  { cle: "signalements", titre: "Salle de contrôle", desc: "Traiter les signalements des élèves.", icone: "fa-solid fa-flag", permission: "signalements" },
  { cle: "support", titre: "Boîte de support", desc: "Répondre aux élèves, activer ou couper l'assistant IA.", icone: "fa-solid fa-headset", permission: "support" },
  { cle: "utilisateurs", titre: "Registre des comptes", desc: "Rechercher un compte, suspendre, bannir.", icone: "fa-solid fa-address-book", permission: "utilisateurs" },
  { cle: "certification", titre: "Certification", desc: "Accorder ou retirer le badge de certification.", icone: "fa-solid fa-circle-check", permission: "certification" },
  { cle: "equipe", titre: "Équipe", desc: "Nommer des associés et des contrôleurs.", icone: "fa-solid fa-people-group", permission: "equipe" },
  { cle: "annonces", titre: "Annonces", desc: "Publier un message à tous les utilisateurs.", icone: "fa-solid fa-bullhorn", permission: "annonces" },
];

/* ----------------------- Première entrée de l'administrateur ----------------------- */
function EcranEntree({ sessionToken, onTermine }) {
  const [nom, setNom] = useState(NOM_PAR_DEFAUT);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function entrer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await adminDefinirNom(sessionToken, nom);
      onTermine(res.nom_affiche);
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <form className="entree-bureau" onSubmit={entrer}>
      <div className="logo-grind">
        <i className="fa-solid fa-brain"></i>
        <span>GRIND</span>
      </div>
      <div className="sous-titre" style={{ marginBottom: 6 }}>
        <i className="fa-solid fa-crown" style={{ color: "#f5d485" }}></i> Bureau d'administration
      </div>
      <div className="info" style={{ fontSize: 13, marginBottom: 18 }}>
        Choisis le nom sous lequel tu signeras tes annonces. Tu pourras le garder tel quel.
      </div>
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        maxLength={40}
        style={{ textAlign: "center", marginBottom: 14 }}
        aria-label="Nom d'administrateur"
      />
      <button type="submit" disabled={envoi}>
        {envoi ? "..." : "Entrer dans le bureau"}
      </button>
      {erreur && <div className="erreur" style={{ marginTop: 10 }}>{erreur}</div>}
    </form>
  );
}

/* ------------------------------ Salle de contrôle (décor) ------------------------------ */
function ScenePupitre({ alerte }) {
  return (
    <svg viewBox="0 0 600 150" role="img" aria-label="Salle de contrôle">
      <rect x="70" y="112" width="460" height="14" rx="7" fill="#3a3347" />
      <rect x="96" y="124" width="8" height="22" fill="#2c2738" />
      <rect x="496" y="124" width="8" height="22" fill="#2c2738" />

      {[110, 250, 390].map((x, i) => (
        <g key={x}>
          <rect x={x} y="36" width="100" height="62" rx="7" fill="#12131c" stroke="#c9b6e4" strokeWidth="1.5" />
          <rect x={x + 6} y="42" width="88" height="50" rx="4" fill="#1b1d2b" />
          <rect x={x + 12} y="50" width={52 - i * 8} height="5" rx="2.5" fill="#d8bfa6" opacity="0.85" />
          <rect x={x + 12} y="60" width={70 - i * 10} height="5" rx="2.5" fill="#c9b6e4" opacity="0.7" />
          <rect x={x + 12} y="70" width={40 + i * 12} height="5" rx="2.5" fill="#c9b6e4" opacity="0.45" />
          <rect x={x + 12} y="80" width={58 - i * 6} height="5" rx="2.5" fill="#d8bfa6" opacity="0.4" />
          <rect x={x + 40} y="98" width="20" height="8" fill="#2c2738" />
        </g>
      ))}

      {/* Voyant : rouge et clignotant s'il y a des signalements à traiter, vert sinon */}
      <circle cx="300" cy="22" r="7" fill={alerte ? "#e08a8a" : "#9fd8b0"} className={alerte ? "voyant-alerte" : undefined} />
      <rect x="296" y="29" width="8" height="6" rx="2" fill="#2c2738" />

      {/* Lampe de bureau */}
      <path d="M 540 112 L 556 70 L 574 58" stroke="#d8bfa6" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="578" cy="56" rx="12" ry="6" fill="#f5d485" opacity="0.9" />
    </svg>
  );
}

/* ----------------------------------- Le bureau ----------------------------------- */
export default function BureauAdmin({ sessionToken, role, autonome = false, onDeconnexion }) {
  const [statut, setStatut] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [salle, setSalle] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    obtenirMonStatut(sessionToken)
      .then(setStatut)
      .catch((err) => {
        setErreur(err.message);
        if (autonome && String(err.message).includes("Session GRIND invalide") && onDeconnexion) onDeconnexion();
      });
  }, [sessionToken, autonome, onDeconnexion]);

  const chargerApercu = useCallback(() => {
    adminApercu(sessionToken).then(setApercu).catch(() => {});
  }, [sessionToken]);

  useEffect(() => {
    if (statut && salle === null) chargerApercu();
  }, [statut, salle, chargerApercu]);

  if (erreur && !statut) {
    return (
      <div className="bureau">
        <div className="erreur"><i className="fa-solid fa-triangle-exclamation"></i> {erreur}</div>
      </div>
    );
  }
  if (!statut) {
    return (
      <div className="bureau">
        <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Ouverture du bureau...</div>
      </div>
    );
  }

  // Première entrée de l'administrateur : on lui fait choisir son nom, avec un bouton pour entrer.
  if (autonome && role === "admin" && !statut.nom_affiche) {
    return <EcranEntree sessionToken={sessionToken} onTermine={(nom) => setStatut({ ...statut, nom_affiche: nom })} />;
  }

  const monRole = statut.role || role;
  const permissions = statut.permissions || [];
  const sallesVisibles = SALLES.filter((s) => permissions.includes(s.permission));
  const nom = statut.nom_affiche || statut.username;
  const salleActive = SALLES.find((s) => s.cle === salle);
  const alerte = (apercu?.nb_signalements_ouverts || 0) + (apercu?.nb_support_attente || 0) > 0;

  return (
    <div className="bureau">
      <header className="bureau-hud">
        <div className="bureau-identite">
          <BadgeCompte badge={{ role: monRole, certifie: statut.certifie }} taille={20} />
          <div style={{ minWidth: 0 }}>
            <strong>{nom}</strong>
            <div className="bureau-role">{libelleRole(monRole)}</div>
          </div>
        </div>
        {autonome && onDeconnexion && (
          <button type="button" className="bouton-admin bouton-admin-doux" onClick={onDeconnexion}>
            <i className="fa-solid fa-right-from-bracket"></i> Quitter
          </button>
        )}
      </header>

      {salleActive ? (
        <>
          <div className="entete-salle">
            <button type="button" className="bouton-admin bouton-admin-doux" onClick={() => setSalle(null)}>
              <i className="fa-solid fa-arrow-left"></i> Retour au bureau
            </button>
            <div className="sous-titre" style={{ margin: 0 }}>
              <i className={salleActive.icone}></i> {salleActive.titre}
            </div>
          </div>

          {salle === "signalements" && <SalleSignalements sessionToken={sessionToken} role={monRole} />}
          {salle === "support" && <SalleSupport sessionToken={sessionToken} role={monRole} />}
          {salle === "utilisateurs" && <SalleUtilisateurs sessionToken={sessionToken} role={monRole} />}
          {salle === "certification" && <SalleCertification sessionToken={sessionToken} />}
          {salle === "equipe" && <SalleEquipe sessionToken={sessionToken} />}
          {salle === "annonces" && <SalleAnnonces sessionToken={sessionToken} />}
        </>
      ) : (
        <>
          <div className="bureau-scene">
            <ScenePupitre alerte={alerte} />
          </div>

          {apercu && (
            <div className="bureau-kpis">
              <div className={`kpi ${alerte ? "kpi-alerte" : ""}`}>
                <div className="kpi-valeur">{apercu.nb_signalements_ouverts}</div>
                <div className="kpi-libelle">signalements à traiter</div>
              </div>
              <div className={`kpi ${apercu.nb_support_attente > 0 ? "kpi-alerte" : ""}`}>
                <div className="kpi-valeur">{apercu.nb_support_attente}</div>
                <div className="kpi-libelle">discussions à répondre</div>
              </div>
              <div className="kpi">
                <div className="kpi-valeur">{apercu.nb_comptes}</div>
                <div className="kpi-libelle">comptes</div>
              </div>
              <div className="kpi">
                <div className="kpi-valeur">{apercu.nb_certifies}</div>
                <div className="kpi-libelle">certifiés</div>
              </div>
              <div className="kpi">
                <div className="kpi-valeur">{apercu.nb_equipe}</div>
                <div className="kpi-libelle">dans l'équipe</div>
              </div>
            </div>
          )}

          <div className="bureau-salles">
            {sallesVisibles.map((s) => (
              <button key={s.cle} type="button" className="salle-tuile" onClick={() => setSalle(s.cle)}>
                <span className="salle-icone"><i className={s.icone}></i></span>
                <span className="salle-titre">{s.titre}</span>
                <span className="salle-desc">{s.desc}</span>
                {s.cle === "signalements" && apercu?.nb_signalements_ouverts > 0 && (
                  <span className="salle-etiquette" style={{ color: "var(--erreur)", borderColor: "rgba(224,138,138,0.5)" }}>
                    {apercu.nb_signalements_ouverts} à traiter
                  </span>
                )}
                {s.cle === "support" && apercu?.nb_support_attente > 0 && (
                  <span className="salle-etiquette" style={{ color: "var(--erreur)", borderColor: "rgba(224,138,138,0.5)" }}>
                    {apercu.nb_support_attente} à répondre
                  </span>
                )}
              </button>
            ))}

            {permissions.includes("equipe") && (
              <button type="button" className="salle-tuile" disabled>
                <span className="salle-icone"><i className="fa-solid fa-coins"></i></span>
                <span className="salle-titre">Caisse G</span>
                <span className="salle-desc">Monnaie G, frais de certification et cadeaux.</span>
                <span className="salle-etiquette">Bientôt</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
