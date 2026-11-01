import { useState, useEffect, useCallback } from "react";
import {
  adminListerEquipe,
  adminNommer,
  adminRetirerDeLEquipe,
  adminChercherUtilisateurs,
  adminCertifier,
  adminPublierAnnonce,
  adminSupprimerAnnonce,
  listerAnnonces,
} from "../api.js";
import ConfirmModal from "../components/ConfirmModal.jsx";
import BadgeCompte from "../components/BadgeCompte.jsx";
import { ROLES_EQUIPE, libelleRole, formaterDate } from "../moderationInfos.js";

/* ------------------------------- Équipe ------------------------------- */
export function SalleEquipe({ sessionToken }) {
  const [equipe, setEquipe] = useState([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("controleur");
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [aRetirer, setARetirer] = useState(null);

  const charger = useCallback(async () => {
    try {
      const res = await adminListerEquipe(sessionToken);
      setEquipe(res.equipe);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function nommer() {
    if (!username.trim()) {
      setErreur("Indique le pseudo GRIND de la personne");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    setMessage(null);
    try {
      await adminNommer(sessionToken, username.trim(), role);
      setMessage(`${username.trim()} est maintenant ${libelleRole(role).toLowerCase()}.`);
      setUsername("");
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function retirer(nom) {
    setARetirer(null);
    setErreur(null);
    try {
      await adminRetirerDeLEquipe(sessionToken, nom);
      await charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="admin-grille">
      <div className="carte-post">
        <div className="sous-titre" style={{ marginBottom: 10 }}>
          <i className="fa-solid fa-user-plus"></i> Nommer un membre
        </div>
        <div className="info" style={{ fontSize: 13, marginBottom: 10 }}>
          La personne doit déjà avoir un compte GRIND. Tu ne peux nommer que des associés et des contrôleurs : il n'y a qu'un seul administrateur.
        </div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Pseudo GRIND"
          style={{ marginBottom: 10 }}
        />
        <div className="choix-categorie" style={{ flexWrap: "wrap" }}>
          {["controleur", "associe"].map((r) => (
            <button key={r} type="button" className={`chip ${role === r ? "chip-actif" : ""}`} onClick={() => setRole(r)}>
              <i className={ROLES_EQUIPE[r].icone}></i> {ROLES_EQUIPE[r].label}
            </button>
          ))}
        </div>
        <div className="info" style={{ fontSize: 12.5, marginBottom: 12 }}>
          {role === "controleur"
            ? "Contrôleur : traite les signalements, supprime les contenus, suspend jusqu'à 7 jours."
            : "Associé : tout ce que fait un contrôleur, plus les bannissements, la levée des sanctions et la certification."}
        </div>
        <button type="button" className="bouton-admin" onClick={nommer} disabled={envoi}>
          {envoi ? "..." : "Nommer"}
        </button>
        {message && <div className="info" style={{ color: "var(--succes)", marginTop: 10 }}>{message}</div>}
        {erreur && <div className="erreur" style={{ marginTop: 10 }}>{erreur}</div>}
      </div>

      <div className="carte-post">
        <div className="sous-titre" style={{ marginBottom: 6 }}>
          <i className="fa-solid fa-people-group"></i> L'équipe
        </div>
        {chargement && <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>}
        {!chargement && equipe.length === 0 && <div className="info">Personne pour l'instant.</div>}
        {equipe.map((m) => (
          <div key={m.username} className="ligne-membre">
            <span>
              <strong>{m.username}</strong>
              <BadgeCompte badge={{ role: m.role, certifie: m.certifie }} taille={14} />
              <span className="bureau-role"> · {libelleRole(m.role)}</span>
            </span>
            <button type="button" className="bouton-admin bouton-admin-doux" onClick={() => setARetirer(m.username)}>
              Retirer
            </button>
          </div>
        ))}
      </div>

      {aRetirer && (
        <ConfirmModal
          message={`Retirer ${aRetirer} de l'équipe ? Il redevient un élève ordinaire.`}
          texteConfirmer="Retirer"
          onConfirmer={() => retirer(aRetirer)}
          onAnnuler={() => setARetirer(null)}
        />
      )}
    </div>
  );
}

/* ----------------------------- Certification ----------------------------- */
export function SalleCertification({ sessionToken }) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("tous"); // "tous" / "certifies"
  const [comptes, setComptes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const res = await adminChercherUtilisateurs(sessionToken, recherche);
      setComptes(res.utilisateurs);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }, [sessionToken, recherche]);

  useEffect(() => {
    charger();
    // recherche au clic / Entrée
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function basculer(u) {
    setEnCours(u.username);
    setErreur(null);
    try {
      await adminCertifier(sessionToken, u.username, !u.certifie);
      setComptes((liste) => liste.map((c) => (c.username === u.username ? { ...c, certifie: !u.certifie } : c)));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(null);
    }
  }

  const visibles = filtre === "certifies" ? comptes.filter((c) => c.certifie) : comptes;

  return (
    <>
      <div className="carte-post" style={{ marginBottom: 14 }}>
        <div className="sous-titre" style={{ marginBottom: 6 }}>
          <i className="fa-solid fa-circle-check"></i> Certification
        </div>
        <div className="info" style={{ fontSize: 13 }}>
          Un compte certifié reçoit le badge de certification aux couleurs de GRIND, visible partout à côté de son pseudo.
          Les frais de certification arriveront avec la monnaie G : pour l'instant, c'est l'équipe qui l'accorde ou la retire.
        </div>
      </div>

      <div className="recherche-admin">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && charger()}
          placeholder="Rechercher un pseudo..."
        />
        <button type="button" className="bouton-admin" onClick={charger}>
          <i className="fa-solid fa-magnifying-glass"></i>
        </button>
      </div>

      <div className="choix-categorie" style={{ marginBottom: 14 }}>
        <button type="button" className={`chip ${filtre === "tous" ? "chip-actif" : ""}`} onClick={() => setFiltre("tous")}>Tous</button>
        <button type="button" className={`chip ${filtre === "certifies" ? "chip-actif" : ""}`} onClick={() => setFiltre("certifies")}>Certifiés</button>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}
      {chargement && <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>}
      {!chargement && visibles.length === 0 && <div className="info">Aucun compte à afficher.</div>}

      <div className="admin-grille">
        {visibles.map((u) => (
          <div key={u.username} className="carte-post carte-signalement">
            <div className="entete-signalement">
              <strong style={{ fontSize: 15 }}>{u.username}</strong>
              <BadgeCompte badge={{ role: u.role, certifie: u.certifie }} taille={14} />
            </div>
            <button
              type="button"
              className={`bouton-admin ${u.certifie ? "bouton-admin-doux" : ""}`}
              onClick={() => basculer(u)}
              disabled={enCours === u.username}
            >
              <i className="fa-solid fa-circle-check"></i> {u.certifie ? "Retirer la certification" : "Certifier"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------- Annonces ------------------------------- */
export function SalleAnnonces({ sessionToken }) {
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [annonces, setAnnonces] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);

  const charger = useCallback(async () => {
    try {
      const res = await listerAnnonces(sessionToken);
      setAnnonces(res.annonces);
    } catch (err) {
      setErreur(err.message);
    }
  }, [sessionToken]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function publier() {
    setEnvoi(true);
    setErreur(null);
    setMessage(null);
    try {
      await adminPublierAnnonce(sessionToken, titre, contenu);
      setMessage("Annonce publiée : tous les utilisateurs connectés sont notifiés.");
      setTitre("");
      setContenu("");
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(id) {
    setASupprimer(null);
    try {
      await adminSupprimerAnnonce(sessionToken, id);
      await charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="admin-grille">
      <div className="carte-post">
        <div className="sous-titre" style={{ marginBottom: 10 }}>
          <i className="fa-solid fa-bullhorn"></i> Nouvelle annonce
        </div>
        <div className="info" style={{ fontSize: 13, marginBottom: 10 }}>
          Elle apparaît dans la cloche de tout le monde, avec ton badge d'administrateur. Un clic sur la notification ouvre l'annonce.
        </div>
        <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre" maxLength={120} style={{ marginBottom: 10 }} />
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          placeholder="Ton message..."
          rows={6}
          maxLength={3000}
          style={{ resize: "vertical", marginBottom: 12 }}
        />
        <button type="button" className="bouton-admin" onClick={publier} disabled={envoi}>
          <i className="fa-solid fa-paper-plane"></i> {envoi ? "..." : "Publier à tous"}
        </button>
        {message && <div className="info" style={{ color: "var(--succes)", marginTop: 10 }}>{message}</div>}
        {erreur && <div className="erreur" style={{ marginTop: 10 }}>{erreur}</div>}
      </div>

      <div className="carte-post">
        <div className="sous-titre" style={{ marginBottom: 6 }}>
          <i className="fa-solid fa-clock-rotate-left"></i> Déjà publiées
        </div>
        {annonces.length === 0 && <div className="info">Aucune annonce pour l'instant.</div>}
        {annonces.map((a) => (
          <div key={a.id} className="ligne-membre">
            <span style={{ minWidth: 0 }}>
              <strong>{a.titre}</strong>
              <div className="bureau-role">{formaterDate(a.created_at)}</div>
            </span>
            <button type="button" className="bouton-admin bouton-admin-doux" onClick={() => setASupprimer(a)}>
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
        ))}
      </div>

      {aSupprimer && (
        <ConfirmModal
          message={`Supprimer l'annonce « ${aSupprimer.titre} » ?`}
          onConfirmer={() => supprimer(aSupprimer.id)}
          onAnnuler={() => setASupprimer(null)}
        />
      )}
    </div>
  );
}
