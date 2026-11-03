import { useState, useEffect, useCallback } from "react";
import {
  adminExamens,
  adminExamenDossier,
  adminExamenTraiter,
  adminSupprimerContenu,
  adminToutSupprimer,
  adminSupprimerClasse,
} from "../api.js";
import LecteurMedia from "../components/LecteurMedia.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import BadgeCompte from "../components/BadgeCompte.jsx";
import ChargementGrind from "../components/ChargementGrind.jsx";
import { formaterDate, libelleMotif, TYPES_CIBLE } from "../moderationInfos.js";

const CATEGORIES = {
  demonstration: "Démonstration",
  probleme: "Problème",
  document: "Document",
};

/* Un post tel que les utilisateurs le voient dans leur fil, avec en plus le bouton de suppression. */
function ApercuPost({ post, peutAgir, onSupprimer }) {
  return (
    <div className="carte-post">
      <div className="entete-signalement">
        <span className="badge-motif">{CATEGORIES[post.categorie] || post.categorie}</span>
        <span className="date-signalement">{formaterDate(post.created_at)}</span>
      </div>
      {post.media_url && <LecteurMedia url={post.media_url} type={post.media_type} />}
      {post.contenu && <div className="contenu-signale">{post.contenu}</div>}
      <div className="info" style={{ fontSize: 12.5, marginBottom: peutAgir ? 10 : 0 }}>
        <i className="fa-solid fa-heart"></i> {post.likes} · <i className="fa-regular fa-comment"></i> {post.commentaires}
      </div>
      {peutAgir && (
        <button type="button" className="bouton-admin" onClick={() => onSupprimer(post)}>
          <i className="fa-solid fa-trash"></i> Supprimer ce contenu
        </button>
      )}
    </div>
  );
}

/* ------------------------------- Un dossier ------------------------------- */
function Dossier({ sessionToken, examenId, onRetour }) {
  const [dossier, setDossier] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [note, setNote] = useState("");
  const [traitement, setTraitement] = useState(null);
  const [confirmation, setConfirmation] = useState(null); // { message, action }

  const charger = useCallback(async () => {
    try {
      setDossier(await adminExamenDossier(sessionToken, examenId));
    } catch (err) {
      setErreur(err.message);
    }
  }, [sessionToken, examenId]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function executer(texte, promesse, apres) {
    setConfirmation(null);
    setErreur(null);
    setTraitement(texte);
    try {
      await promesse();
      if (apres) apres();
      else await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setTraitement(null);
    }
  }

  if (!dossier) {
    return (
      <>
        <button type="button" className="bouton-admin bouton-admin-doux" onClick={onRetour}>
          <i className="fa-solid fa-arrow-left"></i> Examens
        </button>
        {erreur ? <div className="erreur" style={{ marginTop: 12 }}>{erreur}</div> : <ChargementGrind texte="Ouverture du dossier..." />}
      </>
    );
  }

  const ex = dossier.examen;
  const enAttente = ex.statut === "en_attente";

  return (
    <div>
      <div className="entete-signalement" style={{ marginBottom: 12 }}>
        <button type="button" className="bouton-admin bouton-admin-doux" onClick={onRetour}>
          <i className="fa-solid fa-arrow-left"></i> Examens
        </button>
        <strong style={{ fontSize: 16 }}>{ex.username}</strong>
        <BadgeCompte badge={ex.badge} taille={14} />
        <span className={`badge-motif ${enAttente ? "badge-motif-alerte" : ""}`}>
          {enAttente ? "En attente" : ex.statut === "accepte" ? "Acceptée" : "Refusée"}
        </span>
      </div>

      {traitement && <ChargementGrind texte={traitement} />}
      {erreur && <div className="erreur" style={{ marginBottom: 10 }}>{erreur}</div>}

      <div className="admin-grille" style={{ marginBottom: 18 }}>
        <div className="carte-post">
          <div className="sous-titre" style={{ marginBottom: 8 }}><i className="fa-solid fa-gavel"></i> La sanction</div>
          {ex.sanction && (
            <div className="info" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              {ex.sanction.type === "bannissement" ? "Bannissement" : "Suspension"} par <strong>{ex.sanction.par}</strong>
              {ex.sanction.jusqu_a && <> jusqu'au {formaterDate(ex.sanction.jusqu_a)}</>}
              <div>Motif : {ex.sanction.motif}</div>
              {ex.sanction.levee && <div>Sanction levée.</div>}
            </div>
          )}
        </div>

        <div className="carte-post">
          <div className="sous-titre" style={{ marginBottom: 8 }}><i className="fa-solid fa-quote-left"></i> Sa demande</div>
          <div className="contenu-signale" style={{ marginBottom: 6 }}>{ex.message}</div>
          <div className="info" style={{ fontSize: 12 }}>Envoyée le {formaterDate(ex.created_at)}</div>
        </div>
      </div>

      {enAttente ? (
        <div className="carte-post" style={{ marginBottom: 18 }}>
          <div className="sous-titre" style={{ marginBottom: 8 }}><i className="fa-solid fa-scale-balanced"></i> Décision</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Note (facultative, montrée à la personne si l'examen est refusé)"
            style={{ marginBottom: 10 }}
          />
          <div className="actions-admin">
            <button
              type="button"
              className="bouton-admin"
              onClick={() => executer("Rétablissement du compte...", () => adminExamenTraiter(sessionToken, examenId, "accepter", note), charger)}
            >
              <i className="fa-solid fa-lock-open"></i> Accepter l'examen et rétablir le compte
            </button>
            <button
              type="button"
              className="bouton-admin bouton-admin-danger"
              onClick={() => setConfirmation({
                message: `Refuser l'examen ? La décision de ${ex.username} deviendra définitive.`,
                texte: "Refuser",
                action: () => executer("Enregistrement de la décision...", () => adminExamenTraiter(sessionToken, examenId, "refuser", note), charger),
              })}
            >
              <i className="fa-solid fa-ban"></i> Refuser l'examen
            </button>
          </div>
        </div>
      ) : (
        <div className="info" style={{ marginBottom: 18 }}>
          <i className="fa-solid fa-circle-check" style={{ color: "var(--succes)" }}></i>{" "}
          {ex.statut === "accepte" ? "Examen accepté" : "Examen refusé"} par {ex.traite_par} · {formaterDate(ex.traite_le)}
          {ex.note_admin && <div>« {ex.note_admin} »</div>}
        </div>
      )}

      <div className="entete-signalement" style={{ marginBottom: 10 }}>
        <div className="sous-titre" style={{ margin: 0 }}><i className="fa-solid fa-newspaper"></i> Ses publications ({dossier.posts.length})</div>
        {dossier.posts.length > 0 && !ex.sanction?.levee && (
          <button
            type="button"
            className="bouton-admin bouton-admin-danger"
            style={{ marginLeft: "auto" }}
            onClick={() => setConfirmation({
              message: `Supprimer toutes les publications et tous les commentaires de ${ex.username} ? Cette action est définitive.`,
              texte: "Tout supprimer",
              action: () => executer("Suppression des contenus...", () => adminToutSupprimer(sessionToken, ex.username)),
            })}
          >
            <i className="fa-solid fa-trash"></i> Tout supprimer
          </button>
        )}
      </div>
      {dossier.posts.length === 0 && <div className="info" style={{ marginBottom: 14 }}>Aucune publication.</div>}
      <div className="admin-grille" style={{ marginBottom: 18 }}>
        {dossier.posts.map((p) => (
          <ApercuPost
            key={p.id}
            post={p}
            peutAgir
            onSupprimer={(post) => executer("Suppression du contenu...", () => adminSupprimerContenu(sessionToken, "post", String(post.id)))}
          />
        ))}
      </div>

      <div className="sous-titre" style={{ marginBottom: 10 }}><i className="fa-regular fa-comment"></i> Ses commentaires ({dossier.commentaires.length})</div>
      {dossier.commentaires.length === 0 && <div className="info" style={{ marginBottom: 14 }}>Aucun commentaire.</div>}
      <div className="carte-post" style={{ marginBottom: 18, display: dossier.commentaires.length ? "block" : "none" }}>
        {dossier.commentaires.map((c) => (
          <div key={c.id} className="ligne-membre">
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              {c.contenu}
              <div className="bureau-role">{formaterDate(c.created_at)}</div>
            </span>
            <button
              type="button"
              className="bouton-admin bouton-admin-doux"
              onClick={() => executer("Suppression du contenu...", () => adminSupprimerContenu(sessionToken, "commentaire", String(c.id)))}
            >
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
        ))}
      </div>

      <div className="sous-titre" style={{ marginBottom: 10 }}><i className="fa-solid fa-chalkboard"></i> Ses classes ({dossier.classes.length})</div>
      {dossier.classes.length === 0 && <div className="info" style={{ marginBottom: 14 }}>Aucune classe.</div>}
      <div className="carte-post" style={{ marginBottom: 18, display: dossier.classes.length ? "block" : "none" }}>
        <div className="info" style={{ fontSize: 12.5, marginBottom: 6 }}>
          Pendant la sanction, ses classes sont suspendues : leurs membres ne peuvent plus y entrer.
        </div>
        {dossier.classes.map((c) => (
          <div key={c.id} className="ligne-membre">
            <span>
              <strong>{c.nom}</strong>
              <div className="bureau-role">{c.nb_membres} membre{c.nb_membres > 1 ? "s" : ""} · créée le {formaterDate(c.created_at)}</div>
            </span>
            {!ex.sanction?.levee && (
              <button
                type="button"
                className="bouton-admin"
                onClick={() => setConfirmation({
                  message: `Supprimer la classe « ${c.nom} » ? Tous ses membres seront retirés.`,
                  texte: "Supprimer",
                  action: () => executer("Suppression de la classe...", () => adminSupprimerClasse(sessionToken, c.id)),
                })}
              >
                <i className="fa-solid fa-trash"></i> Supprimer
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="sous-titre" style={{ marginBottom: 10 }}><i className="fa-solid fa-flag"></i> Signalements reçus ({dossier.signalements.length})</div>
      {dossier.signalements.length === 0 && <div className="info">Aucun signalement.</div>}
      <div className="admin-grille">
        {dossier.signalements.map((s) => (
          <div key={s.id} className="carte-post">
            <div className="entete-signalement">
              <span className="badge-motif">{(TYPES_CIBLE[s.type_cible] || {}).label || s.type_cible}</span>
              <span className="badge-motif badge-motif-alerte">{libelleMotif(s.motif)}</span>
              <span className="date-signalement">{formaterDate(s.created_at)}</span>
            </div>
            {s.extrait && <div className="contenu-signale" style={{ marginBottom: 6 }}>{s.extrait}</div>}
            {s.details && <div className="details-signalement">{s.details}</div>}
          </div>
        ))}
      </div>

      {confirmation && (
        <ConfirmModal
          message={confirmation.message}
          texteConfirmer={confirmation.texte}
          onConfirmer={confirmation.action}
          onAnnuler={() => setConfirmation(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------- La salle ---------------------------------- */
export default function SalleExamens({ sessionToken }) {
  const [statut, setStatut] = useState("en_attente");
  const [liste, setListe] = useState([]);
  const [selection, setSelection] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const res = await adminExamens(sessionToken, statut);
      setListe(res.examens);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }, [sessionToken, statut]);

  useEffect(() => {
    charger();
  }, [charger]);

  if (selection !== null) {
    return (
      <Dossier
        sessionToken={sessionToken}
        examenId={selection}
        onRetour={() => {
          setSelection(null);
          charger();
        }}
      />
    );
  }

  return (
    <>
      <div className="choix-categorie" style={{ marginBottom: 14 }}>
        <button type="button" className={`chip ${statut === "en_attente" ? "chip-actif" : ""}`} onClick={() => setStatut("en_attente")}>En attente</button>
        <button type="button" className={`chip ${statut === "traite" ? "chip-actif" : ""}`} onClick={() => setStatut("traite")}>Traités</button>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}
      {chargement && <ChargementGrind texte="Chargement..." />}
      {!chargement && !erreur && liste.length === 0 && (
        <div className="info"><i className="fa-solid fa-circle-check"></i> Aucun examen {statut === "en_attente" ? "en attente" : "traité"}.</div>
      )}

      <div className="admin-grille">
        {liste.map((e) => (
          <button key={e.id} type="button" className="carte-post carte-support" onClick={() => setSelection(e.id)}>
            <div className="entete-signalement">
              <strong style={{ fontSize: 15 }}>{e.username}</strong>
              <BadgeCompte badge={e.badge} taille={13} />
              {e.sanction && (
                <span className="badge-motif badge-motif-alerte">
                  <i className="fa-solid fa-gavel"></i> {e.sanction.type === "bannissement" ? "banni" : "suspendu"}
                </span>
              )}
              <span className="date-signalement">{formaterDate(e.created_at)}</span>
            </div>
            <div className="info" style={{ fontSize: 13, textAlign: "left" }}>{e.message.length > 140 ? `${e.message.slice(0, 140)}…` : e.message}</div>
          </button>
        ))}
      </div>
    </>
  );
}
