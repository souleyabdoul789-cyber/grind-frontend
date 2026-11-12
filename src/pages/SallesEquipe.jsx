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
  uploaderMedia,
  uploaderDocument,
} from "../api.js";
import ConfirmModal from "../components/ConfirmModal.jsx";
import BadgeCompte from "../components/BadgeCompte.jsx";
import EditeurVideo from "../components/EditeurVideo.jsx";
import EditeurPhoto from "../components/EditeurPhoto.jsx";
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
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [editionVideo, setEditionVideo] = useState(null);
  const [editionPhoto, setEditionPhoto] = useState(null);
  const [decoupeVideo, setDecoupeVideo] = useState(null);
  const [important, setImportant] = useState(false);
  const [epinglee, setEpinglee] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);

  useEffect(() => {
    const url = apercu?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [apercu?.url]);

  const charger = useCallback(async () => {
    try { const res = await listerAnnonces(sessionToken); setAnnonces(res.annonces || []); }
    catch (err) { setErreur(err.message); }
  }, [sessionToken]);
  useEffect(() => { charger(); }, [charger]);

  function choisirFichier(e) {
    const f = e.target.files?.[0] || null;
    setFichier(f);
    setEditionVideo(null);
    setEditionPhoto(null);
    setDecoupeVideo(null);
    if (!f) { setApercu(null); return; }
    const type = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "document";
    const extension = String(f.name || "").split(".").pop().toLowerCase();
    const documentOk = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(f.type) ||
      ((f.type === "" || f.type === "application/octet-stream") && ["pdf", "docx"].includes(extension));
    if (type === "document" && !documentOk) {
      setErreur("Format non accepté. Choisis une image, une vidéo, un PDF ou un DOCX."); setFichier(null); setApercu(null); return;
    }
    if (f.size > (type === "document" ? 15 : 25) * 1024 * 1024) {
      setErreur(`Fichier trop lourd (max ${type === "document" ? 15 : 25} Mo).`); setFichier(null); setApercu(null); return;
    }
    if (type === "video") { setEditionVideo(f); setApercu(null); setErreur(null); return; }
    if (type === "image") { setEditionPhoto(f); setApercu(null); setErreur(null); return; }
    setApercu({ url: null, type, nom: f.name });
    setErreur(null);
  }

  async function publier() {
    setEnvoi(true); setErreur(null); setMessage(null);
    try {
      let media = {}; let document = {};
      if (fichier && apercu?.type === "document") document = await uploaderDocument(sessionToken, fichier);
      else if (fichier) media = await uploaderMedia(sessionToken, fichier, decoupeVideo);
      await adminPublierAnnonce(sessionToken, {
        titre, contenu, media_url: media.media_url, media_type: media.media_type,
        document_url: document.document_url, document_name: document.document_name, document_type: document.document_type,
        important, epinglee,
      });
      setMessage("Annonce officielle publiée. Les utilisateurs connectés sont notifiés.");
      setTitre(""); setContenu(""); setFichier(null); setApercu(null); setEditionVideo(null); setEditionPhoto(null); setDecoupeVideo(null); setImportant(false); setEpinglee(false);
      await charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnvoi(false); }
  }

  async function supprimer(id) {
    setASupprimer(null);
    try { await adminSupprimerAnnonce(sessionToken, id); await charger(); }
    catch (err) { setErreur(err.message); }
  }

  return (
    <div className="admin-grille salle-annonces">
      <div className="carte-post annonce-editeur-admin">
        <div className="sous-titre" style={{ marginBottom: 10 }}><i className="fa-solid fa-bullhorn"></i> Nouvelle annonce officielle</div>
        <div className="info" style={{ fontSize: 13, marginBottom: 10 }}>Publication réservée à l'administrateur global. Elle est envoyée à tous les utilisateurs et possède un niveau de priorité distinct du fil des élèves.</div>
        <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre de l'annonce" maxLength={120} style={{ marginBottom: 10 }} />
        <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} placeholder="Légende ou message officiel..." rows={5} maxLength={3000} style={{ resize: "vertical", marginBottom: 12 }} />
        <div className="compteur-caracteres">{contenu.length} / 3 000</div>
        {editionPhoto && <div className="annonce-editeur-photo"><p className="info">Ajuste la photo officielle avant publication.</p><EditeurPhoto fichier={editionPhoto} onValider={(blob) => { const photo = new File([blob], "annonce-grind.jpg", { type: "image/jpeg" }); setFichier(photo); setApercu({ url: URL.createObjectURL(photo), type: "image", nom: photo.name }); setEditionPhoto(null); }} onAnnuler={() => { setFichier(null); setEditionPhoto(null); }} /></div>}
        {editionVideo && <div className="annonce-editeur-video"><p className="info">Prépare le clip de l'annonce (120 secondes maximum).</p><EditeurVideo fichier={editionVideo} onValider={({ debut, fin }) => { setDecoupeVideo({ debut, fin }); setEditionVideo(null); setApercu({ url: URL.createObjectURL(fichier), type: "video", nom: fichier.name }); }} onAnnuler={() => { setFichier(null); setEditionVideo(null); setDecoupeVideo(null); }} /></div>}
        {apercu && <div className="apercu-media-form annonce-apercu-admin">
          {apercu.type === "image" ? <img src={apercu.url} alt="Aperçu de l'annonce" /> : apercu.type === "video" ? <video src={apercu.url} controls playsInline preload="metadata" /> : <div className="apercu-document"><i className="fa-solid fa-file-lines"></i><span>{apercu.nom}</span></div>}
          <button type="button" className="bouton-retirer-media" onClick={() => { setFichier(null); setApercu(null); setEditionVideo(null); setDecoupeVideo(null); }} aria-label="Retirer la pièce jointe"><i className="fa-solid fa-xmark"></i></button>
        </div>}
        {!editionPhoto && !editionVideo && <label className="bouton-ajouter-media bouton-document-annonce"><i className="fa-solid fa-paperclip"></i> Ajouter photo, vidéo ou document<input type="file" accept="image/*,video/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={choisirFichier} hidden /></label>}
        <div className="options-annonce-admin">
          <label><input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} /> <span><strong>Important</strong><small>Reste visible dans la cloche ; ne peut pas être masquée.</small></span></label>
          <label><input type="checkbox" checked={epinglee} onChange={(e) => setEpinglee(e.target.checked)} /> <span><strong>Épingler</strong><small>Priorité d'affichage dans la liste des annonces.</small></span></label>
        </div>
        <button type="button" className="bouton-admin" onClick={publier} disabled={envoi || !!editionVideo || !!editionPhoto || titre.trim().length < 3 || (!contenu.trim() && !fichier)}><i className="fa-solid fa-paper-plane"></i> {envoi ? "Publication..." : "Publier à tous"}</button>
        {message && <div className="info" style={{ color: "var(--succes)", marginTop: 10 }}>{message}</div>}
        {erreur && <div className="erreur" style={{ marginTop: 10 }}>{erreur}</div>}
      </div>
      <div className="carte-post">
        <div className="sous-titre" style={{ marginBottom: 6 }}><i className="fa-solid fa-clock-rotate-left"></i> Annonces publiées</div>
        {annonces.length === 0 && <div className="info">Aucune annonce pour l'instant.</div>}
        {annonces.map((a) => <div key={a.id} className="ligne-membre ligne-annonce-admin"><span style={{ minWidth: 0 }}><strong>{a.epinglee ? "📌 " : ""}{a.titre}</strong><div className="bureau-role">{formaterDate(a.created_at)}{a.important ? " · IMPORTANT" : ""}{a.media_type ? ` · ${a.media_type}` : ""}{a.document_url ? " · DOCUMENT" : ""}</div></span><button type="button" className="bouton-admin bouton-admin-doux" onClick={() => setASupprimer(a)} aria-label="Supprimer l'annonce"><i className="fa-solid fa-trash"></i></button></div>)}
      </div>
      {aSupprimer && <ConfirmModal message={`Supprimer l'annonce « ${aSupprimer.titre} » ?`} onConfirmer={() => supprimer(aSupprimer.id)} onAnnuler={() => setASupprimer(null)} />}
    </div>
  );
}
