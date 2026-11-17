import { useCallback, useEffect, useState } from "react";
import {
  adminListerComptesSanctionnes,
  adminDossierSuppression,
  adminSupprimerContenu,
  adminSupprimerClasse,
} from "../api.js";
import ConfirmModal from "../components/ConfirmModal.jsx";
import LecteurMedia from "../components/LecteurMedia.jsx";
import ChargementGrind from "../components/ChargementGrind.jsx";
import { formaterDate } from "../moderationInfos.js";

function libelleSanction(sanction) {
  if (!sanction) return "Sanction active";
  return sanction.type === "bannissement" ? "Compte banni" : "Compte suspendu";
}

export default function SalleSuppression({ sessionToken }) {
  const [recherche, setRecherche] = useState("");
  const [comptes, setComptes] = useState([]);
  const [selection, setSelection] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [action, setAction] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const chargerComptes = useCallback(async (terme = "") => {
    setChargement(true);
    setErreur("");
    setMessage("");
    try {
      const resultat = await adminListerComptesSanctionnes(sessionToken, terme.trim());
      setComptes(resultat.utilisateurs || []);
    } catch (err) {
      setErreur(err.message || "Impossible de charger les comptes sanctionnés.");
    } finally {
      setChargement(false);
    }
  }, [sessionToken]);

  useEffect(() => { chargerComptes(""); }, [chargerComptes]);

  const ouvrirDossier = useCallback(async (username) => {
    setChargement(true);
    setErreur("");
    setMessage("");
    try {
      const resultat = await adminDossierSuppression(sessionToken, username);
      setSelection(username);
      setDossier(resultat);
    } catch (err) {
      setErreur(err.message || "Le dossier n’est pas accessible.");
    } finally {
      setChargement(false);
    }
  }, [sessionToken]);

  async function executerSuppression(actionTexte, promesse) {
    setConfirmation(null);
    setAction(true);
    setErreur("");
    setMessage("");
    try {
      await promesse();
      const rafraichi = await adminDossierSuppression(sessionToken, selection);
      setDossier(rafraichi);
      setMessage(actionTexte);
      const comptesActualises = await adminListerComptesSanctionnes(sessionToken, "");
      setComptes(comptesActualises.utilisateurs || []);
    } catch (err) {
      setErreur(err.message || "La suppression n’a pas abouti.");
    } finally {
      setAction(false);
    }
  }

  function demanderSuppression(messageConfirmation, actionTexte, promesse) {
    setConfirmation({ message: messageConfirmation, actionTexte, promesse });
  }

  return (
    <section className="admin-suppression">
      <header className="admin-panel-heading">
        <div>
          <span className="admin-panel-eyebrow">MODÉRATION CIBLÉE</span>
          <h2>Suppression des contenus et des classes</h2>
          <p>Cette salle donne accès uniquement aux comptes qui font actuellement l’objet d’une sanction. Elle ne permet ni de sanctionner ni de supprimer un compte.</p>
        </div>
        <span className="admin-perimeter"><i className="fa-solid fa-lock" /> Périmètre limité</span>
      </header>

      {erreur && <div className="erreur" role="alert">{erreur}</div>}
      {message && <div className="admin-success" role="status"><i className="fa-solid fa-circle-check" /> {message}</div>}
      {chargement && <ChargementGrind texte="Chargement des dossiers..." />}

      {!selection && (
        <>
          <form className="admin-suppression-recherche" onSubmit={(event) => { event.preventDefault(); chargerComptes(); }}>
            <label htmlFor="admin-suppression-recherche">Rechercher un compte sanctionné</label>
            <div className="admin-suppression-recherche-ligne">
              <input id="admin-suppression-recherche" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Pseudo GRIND" autoComplete="off" />
              <button className="bouton-admin" type="submit" disabled={chargement}><i className="fa-solid fa-magnifying-glass" /> Rechercher</button>
            </div>
            <small>Les comptes de l’équipe et les comptes sans sanction active ne sont pas proposés.</small>
          </form>

          {!chargement && comptes.length === 0 && <div className="admin-empty"><i className="fa-solid fa-shield-check" /><strong>Aucun compte sanctionné trouvé</strong><span>Essaie un autre pseudo ou vérifie les sanctions actives.</span></div>}
          <div className="admin-suppression-comptes">
            {comptes.map((compte) => (
              <button key={compte.username} type="button" className="admin-suppression-compte" onClick={() => ouvrirDossier(compte.username)}>
                <span className="admin-suppression-avatar"><i className="fa-solid fa-user" /></span>
                <span className="admin-suppression-compte-texte">
                  <strong>@{compte.username}</strong>
                  <small>{libelleSanction(compte.sanction)} · {compte.nb_publications} publication(s) · {compte.nb_commentaires} commentaire(s) · {compte.nb_classes} classe(s)</small>
                </span>
                <i className="fa-solid fa-chevron-right" aria-hidden="true" />
              </button>
            ))}
          </div>
        </>
      )}

      {selection && dossier && (
        <div className="admin-suppression-dossier">
          <div className="admin-suppression-retour">
            <button type="button" className="bouton-admin bouton-admin-doux" onClick={() => { setSelection(null); setDossier(null); setMessage(""); }}><i className="fa-solid fa-arrow-left" /> Retour aux comptes</button>
            <div><strong>@{selection}</strong><span className="badge-motif badge-motif-alerte">Sanction active</span></div>
          </div>

          <section className="admin-suppression-section">
            <header><h3><i className="fa-solid fa-newspaper" /> Publications</h3><span>{dossier.posts.length}</span></header>
            {dossier.posts.length === 0 && <p className="info">Aucune publication.</p>}
            <div className="admin-grille">
              {dossier.posts.map((post) => (
                <article className="carte-post admin-suppression-contenu" key={post.id}>
                  <div className="admin-suppression-meta"><span>{post.categorie || "Publication"}</span><time>{formaterDate(post.created_at)}</time></div>
                  {post.media_url && <LecteurMedia url={post.media_url} type={post.media_type} />}
                  {post.contenu && <p>{post.contenu}</p>}
                  <button type="button" className="bouton-admin bouton-admin-danger" disabled={action} onClick={() => demanderSuppression(`Supprimer définitivement cette publication de @${selection} ?`, "Publication supprimée.", () => adminSupprimerContenu(sessionToken, "post", String(post.id)))}><i className="fa-solid fa-trash" /> Supprimer la publication</button>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-suppression-section">
            <header><h3><i className="fa-regular fa-comment" /> Commentaires</h3><span>{dossier.commentaires.length}</span></header>
            {dossier.commentaires.length === 0 && <p className="info">Aucun commentaire.</p>}
            {dossier.commentaires.map((commentaire) => (
              <article className="admin-suppression-commentaire" key={commentaire.id}>
                <div><p>{commentaire.contenu}</p><time>{formaterDate(commentaire.created_at)}</time></div>
                <button type="button" className="bouton-admin bouton-admin-doux" aria-label="Supprimer le commentaire" disabled={action} onClick={() => demanderSuppression(`Supprimer définitivement ce commentaire de @${selection} ?`, "Commentaire supprimé.", () => adminSupprimerContenu(sessionToken, "commentaire", String(commentaire.id)))}><i className="fa-solid fa-trash" /></button>
              </article>
            ))}
          </section>

          <section className="admin-suppression-section">
            <header><h3><i className="fa-solid fa-chalkboard" /> Classes créées</h3><span>{dossier.classes.length}</span></header>
            {dossier.classes.length === 0 && <p className="info">Aucune classe créée.</p>}
            {dossier.classes.map((classe) => (
              <article className="admin-suppression-commentaire" key={classe.id}>
                <div><strong>{classe.nom}</strong><time>{classe.nb_membres} membre(s) · créée le {formaterDate(classe.created_at)}</time></div>
                <button type="button" className="bouton-admin bouton-admin-danger" disabled={action} onClick={() => demanderSuppression(`Supprimer la classe « ${classe.nom} » ? Ses membres ne pourront plus y accéder.`, "Classe supprimée.", () => adminSupprimerClasse(sessionToken, classe.id))}><i className="fa-solid fa-trash" /> Supprimer la classe</button>
              </article>
            ))}
          </section>
        </div>
      )}

      {confirmation && <ConfirmModal message={confirmation.message} texteConfirmer={confirmation.actionTexte.includes("Classe") ? "Supprimer la classe" : "Supprimer"} onConfirmer={() => executerSuppression(confirmation.actionTexte, confirmation.promesse)} onAnnuler={() => setConfirmation(null)} />}
    </section>
  );
}
