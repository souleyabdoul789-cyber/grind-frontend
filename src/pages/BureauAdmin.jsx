import { useState, useEffect, useCallback } from "react";
import { obtenirMonStatut, adminApercu, adminDefinirNom } from "../api.js";
import BadgeCompte from "../components/BadgeCompte.jsx";
import { SalleSignalements, SalleUtilisateurs } from "./Admin.jsx";
import { SalleEquipe, SalleCertification, SalleAnnonces } from "./SallesEquipe.jsx";
import SalleSupport from "./SalleSupport.jsx";
import SalleExamens from "./SalleExamens.jsx";
import SalleProviseurs from "./SalleProviseurs.jsx";
import { libelleRole } from "../moderationInfos.js";
import SallePays from "./SallePays.jsx";
import SalleSuppression from "./SalleSuppression.jsx";

const NOM_PAR_DEFAUT = "GRIND Admin";

// Chaque salle n'apparaît que si le rôle en a la permission (le serveur applique la même règle).
const SALLES = [
  { cle: "signalements", titre: "Salle de contrôle", desc: "Traiter les signalements des élèves.", icone: "fa-solid fa-flag", permission: "signalements" },
  { cle: "support", titre: "Boîte de support", desc: "Répondre aux élèves, activer ou couper l'assistant IA.", icone: "fa-solid fa-headset", permission: "support" },
  { cle: "utilisateurs", titre: "Registre des comptes", desc: "Rechercher un compte, suspendre, bannir.", icone: "fa-solid fa-address-book", permission: "utilisateurs" },
  { cle: "examens", titre: "Examens", desc: "Dossiers des demandes d'examen après une sanction.", icone: "fa-solid fa-scale-balanced", permission: "examens" },
  { cle: "certification", titre: "Certification", desc: "Accorder ou retirer le badge de certification.", icone: "fa-solid fa-circle-check", permission: "certification" },
  { cle: "equipe", titre: "Équipe", desc: "Attribuer les rôles, périmètres et responsabilités des collaborateurs.", icone: "fa-solid fa-people-group", permission: "equipe" },
  { cle: "annonces", titre: "Communication", desc: "Préparer et publier les annonces destinées à la communauté.", icone: "fa-solid fa-bullhorn", permission: "annonces" },
  { cle: "suppression", titre: "Gestion des contenus", desc: "Retirer des publications, commentaires et classes de comptes sanctionnés.", icone: "fa-solid fa-trash-can", permission: "suppression" },
  { cle: "proviseurs", titre: "Candidatures établissement", desc: "Vérifier les pièces privées et autoriser les directions.", icone: "fa-solid fa-school-circle-check", permission: "equipe" },
  { cle: "pays", titre: "Disponibilité par pays", desc: "Suspendre l’accès régional à GRIND selon l’IP.", icone: "fa-solid fa-earth-africa", permission: "pays" },
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
        {envoi ? <span className="grind-spinner" aria-label="Ouverture" /> : "Entrer dans le bureau"}
      </button>
      {erreur && <div className="erreur" style={{ marginTop: 10 }}>{erreur}</div>}
    </form>
  );
}

/* ------------------------------ En-tête du centre d'administration ------------------------------ */
function VueEnsemble({ nom, role }) {
  return (
    <section className="bureau-overview">
      <div className="bureau-overview-marque">
        <span className="bureau-overview-logo"><i className="fa-solid fa-brain" /> G-SOCIETY</span>
        <span className="bureau-overview-separateur" />
        <span>PLATEFORME GRIND</span>
      </div>
      <div className="bureau-overview-contenu">
        <span className="bureau-overview-eyebrow">ESPACE DE GESTION</span>
        <h1>Centre d’administration</h1>
        <p>Pilotage de la communauté, suivi des opérations et modération des espaces GRIND.</p>
      </div>
      <div className="bureau-overview-session">
        <span className="bureau-session-indicateur" />
        <span><strong>{nom}</strong><small>{role === "admin" ? "Administration officielle" : libelleRole(role)}</small></span>
      </div>
    </section>
  );
}

/* ----------------------------------- Le bureau ----------------------------------- */
export default function BureauAdmin({ sessionToken, role, autonome = false, onDeconnexion, onChangerCompte, changementCompteEnCours = false }) {
  const [statut, setStatut] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [salle, setSalle] = useState(null);
  const [erreur, setErreur] = useState(null);
  const permissions = statut?.permissions || [];
  const peutVoirApercu = ["signalements", "support", "examens", "utilisateurs", "certification", "equipe"].some((permission) => permissions.includes(permission));

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
    if (statut && salle === null && peutVoirApercu) chargerApercu();
    else if (statut && !peutVoirApercu) setApercu(null);
  }, [statut, salle, peutVoirApercu, chargerApercu]);

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
  const sallesVisibles = SALLES.filter((s) => s.permission === "pays" ? monRole === "admin" : permissions.includes(s.permission));
  const nom = statut.nom_affiche || statut.username;
  const salleActive = SALLES.find((s) => s.cle === salle);
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
        {autonome && <div className="bureau-actions-session">
          {onChangerCompte && <button type="button" className="bouton-admin bouton-admin-doux" onClick={onChangerCompte} disabled={changementCompteEnCours}>{changementCompteEnCours ? <><i className="fa-solid fa-spinner fa-spin"></i> Changement...</> : <><i className="fa-solid fa-users"></i> Gérer les comptes</>}</button>}
          {onDeconnexion && <button type="button" className="bouton-admin bouton-admin-doux" onClick={onDeconnexion}><i className="fa-solid fa-right-from-bracket"></i> Quitter</button>}
        </div>}
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
          {salle === "examens" && <SalleExamens sessionToken={sessionToken} />}
          {salle === "utilisateurs" && <SalleUtilisateurs sessionToken={sessionToken} role={monRole} />}
          {salle === "certification" && <SalleCertification sessionToken={sessionToken} />}
          {salle === "equipe" && <SalleEquipe sessionToken={sessionToken} role={monRole} />}
          {salle === "annonces" && <SalleAnnonces sessionToken={sessionToken} role={monRole} username={statut.username} />}
          {salle === "suppression" && <SalleSuppression sessionToken={sessionToken} />}
          {salle === "proviseurs" && <SalleProviseurs sessionToken={sessionToken} />}
          {salle === "pays" && monRole === "admin" && <SallePays sessionToken={sessionToken} />}
        </>
      ) : (
        <>
          <VueEnsemble nom={nom} role={monRole} />

          {apercu && (permissions.includes("signalements") || permissions.includes("support") || permissions.includes("examens") || permissions.includes("utilisateurs") || permissions.includes("certification") || permissions.includes("equipe")) && (
            <section className="bureau-indicateurs" aria-label="Indicateurs d’activité">
              <div className="bureau-section-heading"><div><span className="bureau-section-eyebrow">SUIVI OPÉRATIONNEL</span><h2>Vue d’ensemble</h2></div></div>
              <div className="bureau-kpis">
                {permissions.includes("signalements") && <div className={`kpi ${apercu.nb_signalements_ouverts > 0 ? "kpi-alerte" : ""}`}><span className="kpi-icone"><i className="fa-solid fa-flag" /></span><div className="kpi-valeur">{apercu.nb_signalements_ouverts}</div><div className="kpi-libelle">signalements ouverts</div></div>}
                {permissions.includes("support") && <div className={`kpi ${apercu.nb_support_attente > 0 ? "kpi-alerte" : ""}`}><span className="kpi-icone"><i className="fa-solid fa-headset" /></span><div className="kpi-valeur">{apercu.nb_support_attente}</div><div className="kpi-libelle">demandes de support</div></div>}
                {permissions.includes("examens") && <div className={`kpi ${apercu.nb_examens_attente > 0 ? "kpi-alerte" : ""}`}><span className="kpi-icone"><i className="fa-solid fa-scale-balanced" /></span><div className="kpi-valeur">{apercu.nb_examens_attente}</div><div className="kpi-libelle">examens en attente</div></div>}
                {permissions.includes("utilisateurs") && <div className="kpi"><span className="kpi-icone"><i className="fa-solid fa-users" /></span><div className="kpi-valeur">{apercu.nb_comptes}</div><div className="kpi-libelle">comptes utilisateurs</div></div>}
                {permissions.includes("certification") && <div className="kpi"><span className="kpi-icone"><i className="fa-solid fa-certificate" /></span><div className="kpi-valeur">{apercu.nb_certifies}</div><div className="kpi-libelle">comptes certifiés</div></div>}
                {permissions.includes("equipe") && <div className="kpi"><span className="kpi-icone"><i className="fa-solid fa-people-group" /></span><div className="kpi-valeur">{apercu.nb_equipe}</div><div className="kpi-libelle">collaborateurs</div></div>}
              </div>
            </section>
          )}

          <section className="bureau-section">
            <div className="bureau-section-heading"><div><span className="bureau-section-eyebrow">OUTILS ET SERVICES</span><h2>Espaces de travail</h2><p>Accède aux modules correspondant à ton niveau d’autorisation.</p></div><span className="bureau-section-count">{sallesVisibles.length} espace(s)</span></div>
            <div className="bureau-salles">
            {sallesVisibles.map((s) => (
              <button key={s.cle} type="button" className="salle-tuile" onClick={() => setSalle(s.cle)}>
                <span className="salle-tuile-entete"><span className="salle-icone"><i className={s.icone}></i></span><span className="salle-titre">{s.titre}</span><i className="fa-solid fa-arrow-up-right-from-square salle-tuile-ouvrir" aria-hidden="true" /></span>
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
                {s.cle === "examens" && apercu?.nb_examens_attente > 0 && (
                  <span className="salle-etiquette" style={{ color: "var(--erreur)", borderColor: "rgba(224,138,138,0.5)" }}>
                    {apercu.nb_examens_attente} en attente
                  </span>
                )}
              </button>
            ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
