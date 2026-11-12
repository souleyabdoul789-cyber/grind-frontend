import { useState, useEffect, useCallback } from "react";
import {
  adminListerSignalements,
  adminTraiterSignalement,
  adminChercherUtilisateurs,
  adminSanctionner,
  adminLeverSanction,
  adminSupprimerCompte,
} from "../api.js";
import LecteurMedia from "../components/LecteurMedia.jsx";
import BadgeCompte from "../components/BadgeCompte.jsx";
import {
  libelleMotif,
  libelleDecision,
  formaterDate,
  DUREES_SUSPENSION,
  SUSPENSION_COURTE_MAX_JOURS,
  TYPES_CIBLE,
} from "../moderationInfos.js";

// Les règles ci-dessous sont celles du serveur (qui, lui, les APPLIQUE) :
// ici on ne fait que cacher les boutons qui seraient refusés.
function droits(role, roleCible) {
  const equipe = role === "associe" || role === "admin";
  const cibleProtegee = roleCible === "admin" || (roleCible && role !== "admin");
  return {
    peutSanctionner: !cibleProtegee,
    peutBannir: equipe && !cibleProtegee,
    peutLever: equipe,
    durees: role === "controleur"
      ? DUREES_SUSPENSION.filter((j) => j <= SUSPENSION_COURTE_MAX_JOURS)
      : DUREES_SUSPENSION,
  };
}

function Interrupteur({ actif, onBasculer }) {
  return (
    <button type="button" className={`interrupteur ${actif ? "interrupteur-actif" : ""}`} onClick={onBasculer}>
      <span className="curseur-interrupteur"></span>
    </button>
  );
}

function ChoixDuree({ valeur, durees, onChoisir }) {
  return (
    <div className="choix-categorie" style={{ flexWrap: "wrap", marginBottom: 10 }}>
      {durees.map((j) => (
        <button
          key={j}
          type="button"
          className={`chip ${valeur === j ? "chip-actif" : ""}`}
          onClick={() => onChoisir(j)}
        >
          {j} jour{j > 1 ? "s" : ""}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Un signalement ------------------------------ */
function CarteSignalement({ sig, sessionToken, role, onTraite }) {
  const d = droits(role, sig.auteur_role);
  const [panneau, setPanneau] = useState(null); // null / "suspension"
  const [duree, setDuree] = useState(d.durees.includes(3) ? 3 : d.durees[0]);
  const [supprimerAussi, setSupprimerAussi] = useState(true);
  const [note, setNote] = useState("");
  const [examenPossible, setExamenPossible] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  const type = TYPES_CIBLE[sig.type_cible] || TYPES_CIBLE.post;
  const ouvert = sig.statut === "ouvert";

  async function agir(action) {
    setEnvoi(true);
    setErreur(null);
    try {
      await adminTraiterSignalement(sessionToken, sig.id, {
        action,
        supprimer_contenu: action === "suspendre" || action === "bannir" ? supprimerAussi : false,
        duree_jours: action === "suspendre" ? duree : null,
        note: note.trim() || null,
        examen_possible: action === "suspendre" || action === "bannir" ? examenPossible : false,
      });
      onTraite();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <div className="carte-post carte-signalement">
      <div className="entete-signalement">
        <span className="badge-motif">
          <i className={type.icone}></i> {type.label}
        </span>
        <span className="badge-motif badge-motif-alerte">{libelleMotif(sig.motif)}</span>
        {sig.nb_signalements_ce_contenu > 1 && ouvert && (
          <span className="badge-motif badge-motif-alerte">
            <i className="fa-solid fa-flag"></i> ×{sig.nb_signalements_ce_contenu}
          </span>
        )}
        <span className="date-signalement">{formaterDate(sig.created_at)}</span>
      </div>

      <div className="info" style={{ fontSize: 13, marginBottom: 8 }}>
        Signalé par <strong>{sig.signaleur}</strong> · auteur : <strong>{sig.auteur}</strong>
        <BadgeCompte badge={{ role: sig.auteur_role }} taille={13} />
        {sig.nb_signalements_auteur > 1 && ` (${sig.nb_signalements_auteur} signalements au total)`}
        {sig.auteur_sanctionne && (
          <span className="badge-motif badge-motif-alerte" style={{ marginLeft: 8 }}>
            <i className="fa-solid fa-gavel"></i> {sig.auteur_sanctionne === "bannissement" ? "banni" : "suspendu"}
          </span>
        )}
      </div>

      {sig.type_cible === "profil" ? (
        <div className="contenu-signale">Profil de <strong>{sig.auteur}</strong></div>
      ) : (
        <div className="contenu-signale">
          {sig.contenu.media_url && <LecteurMedia url={sig.contenu.media_url} type={sig.contenu.media_type} />}
          <div>{sig.contenu.texte || <em>(contenu vide)</em>}</div>
          {!sig.contenu.existe && (
            <div className="info" style={{ marginTop: 6 }}>
              <i className="fa-solid fa-circle-info"></i> Ce contenu n'existe plus — voici l'extrait gardé au moment du signalement.
            </div>
          )}
        </div>
      )}

      {sig.details && (
        <div className="details-signalement">
          <i className="fa-solid fa-quote-left"></i> {sig.details}
        </div>
      )}

      {ouvert ? (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (facultatif, visible par l'équipe)"
            maxLength={200}
            style={{ marginBottom: 10 }}
          />

          {(panneau === "suspension" || panneau === "ban") && (
            <div className="panneau-sanction">
              {panneau === "suspension" && (
                <>
                  <div className="info" style={{ marginBottom: 8 }}>Durée de la suspension</div>
                  <ChoixDuree valeur={duree} durees={d.durees} onChoisir={setDuree} />
                </>
              )}
              {sig.type_cible !== "profil" && sig.contenu.existe && (
                <div className="ligne-reglage" style={{ padding: "4px 0 10px" }}>
                  <span>Supprimer aussi le contenu</span>
                  <Interrupteur actif={supprimerAussi} onBasculer={() => setSupprimerAussi((v) => !v)} />
                </div>
              )}
              <div className="ligne-reglage" style={{ padding: "4px 0 10px" }}>
                <span>
                  Autoriser une demande d'examen
                  <div className="info" style={{ fontSize: 12 }}>Sinon, la personne verra qu'aucun examen n'est possible.</div>
                </span>
                <Interrupteur actif={examenPossible} onBasculer={() => setExamenPossible((v) => !v)} />
              </div>
              <div className="rangee-boutons">
                <button type="button" className="bouton-admin bouton-admin-doux" onClick={() => setPanneau(null)} disabled={envoi}>Annuler</button>
                {panneau === "suspension" ? (
                  <button type="button" className="bouton-admin" onClick={() => agir("suspendre")} disabled={envoi}>
                    Suspendre {duree} j
                  </button>
                ) : (
                  <button type="button" className="bouton-admin bouton-admin-danger" onClick={() => agir("bannir")} disabled={envoi}>
                    Bannir
                  </button>
                )}
              </div>
            </div>
          )}

          {panneau === null && (
            <div className="actions-admin">
              <button type="button" className="bouton-admin bouton-admin-doux" onClick={() => agir("ignorer")} disabled={envoi}>
                <i className="fa-solid fa-check"></i> Ignorer
              </button>
              {sig.type_cible !== "profil" && sig.contenu.existe && (
                <button type="button" className="bouton-admin" onClick={() => agir("supprimer")} disabled={envoi}>
                  <i className="fa-solid fa-trash"></i> Supprimer
                </button>
              )}
              {d.peutSanctionner && (
                <button type="button" className="bouton-admin" onClick={() => { setExamenPossible(true); setPanneau("suspension"); }} disabled={envoi}>
                  <i className="fa-solid fa-clock"></i> Suspendre
                </button>
              )}
              {d.peutBannir && (
                <button type="button" className="bouton-admin bouton-admin-danger" onClick={() => { setExamenPossible(false); setPanneau("ban"); }} disabled={envoi}>
                  <i className="fa-solid fa-ban"></i> Bannir
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="info resultat-traitement">
          <i className="fa-solid fa-circle-check" style={{ color: "var(--succes)" }}></i>{" "}
          {libelleDecision(sig.decision)} par {sig.traite_par} · {formaterDate(sig.traite_le)}
          {sig.note_admin && <div>« {sig.note_admin} »</div>}
        </div>
      )}

      {erreur && <div className="erreur" style={{ marginTop: 8 }}>{erreur}</div>}

    </div>
  );
}

/* ------------------------------ Un utilisateur ------------------------------ */
function CarteUtilisateur({ u, sessionToken, role, onChange }) {
  const d = droits(role, u.role);
  const [panneau, setPanneau] = useState(null); // null / "suspension" / "ban"
  const [duree, setDuree] = useState(d.durees.includes(3) ? 3 : d.durees[0]);
  const [motif, setMotif] = useState("");
  const [examenPossible, setExamenPossible] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [suppressionOuverte, setSuppressionOuverte] = useState(false);
  const [confirmationSuppression, setConfirmationSuppression] = useState("");

  async function sanctionner(type) {
    if (!motif.trim()) {
      setErreur("Indique un motif");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await adminSanctionner(sessionToken, {
        username: u.username,
        type,
        duree_jours: type === "suspension" ? duree : null,
        motif: motif.trim(),
        examen_possible: examenPossible,
      });
      onChange();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  async function lever() {
    setEnvoi(true);
    try {
      await adminLeverSanction(sessionToken, u.username);
      onChange();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  async function supprimerDefinitivement() {
    if (confirmationSuppression.trim() !== u.username) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await adminSupprimerCompte(sessionToken, u.username, confirmationSuppression.trim());
      setSuppressionOuverte(false);
      onChange();
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <div className="carte-post carte-signalement">
      <div className="entete-signalement">
        <strong style={{ fontSize: 15 }}>{u.username}</strong>
        <BadgeCompte badge={{ role: u.role, certifie: u.certifie }} taille={14} />
        {u.sanction && (
          <span className="badge-motif badge-motif-alerte">
            <i className="fa-solid fa-gavel"></i> {u.sanction.type === "bannissement" ? "banni" : "suspendu"}
          </span>
        )}
        <span className="date-signalement">{u.nb_signalements} signalement{u.nb_signalements > 1 ? "s" : ""}</span>
      </div>
      <div className="info" style={{ fontSize: 13, marginBottom: 10 }}>
        Inscrit le {formaterDate(u.created_at)}
        {u.sanction && <div>Motif : {u.sanction.motif}</div>}
        {u.sanction?.jusqu_a && <div>Jusqu'au {formaterDate(u.sanction.jusqu_a)}</div>}
      </div>

      {u.sanction ? (
        d.peutLever && (
          <div className="actions-admin">
            <button type="button" className="bouton-admin" onClick={lever} disabled={envoi}>
              <i className="fa-solid fa-lock-open"></i> Lever la sanction
            </button>
          </div>
        )
      ) : d.peutSanctionner && panneau === null ? (
        <div className="actions-admin">
          <button type="button" className="bouton-admin" onClick={() => { setExamenPossible(true); setPanneau("suspension"); }}>
            <i className="fa-solid fa-clock"></i> Suspendre
          </button>
          {d.peutBannir && (
            <button type="button" className="bouton-admin bouton-admin-danger" onClick={() => { setExamenPossible(false); setPanneau("ban"); }}>
              <i className="fa-solid fa-ban"></i> Bannir
            </button>
          )}
        </div>
      ) : null}

      {panneau && !u.sanction && (
        <div className="panneau-sanction">
          {panneau === "suspension" && (
            <>
              <div className="info" style={{ marginBottom: 8 }}>Durée de la suspension</div>
              <ChoixDuree valeur={duree} durees={d.durees} onChoisir={setDuree} />
            </>
          )}
          <input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Motif (obligatoire — montré à la personne)"
            maxLength={200}
            style={{ marginBottom: 10 }}
          />
          <div className="ligne-reglage" style={{ padding: "0 0 10px" }}>
            <span>
              Autoriser une demande d'examen
              <div className="info" style={{ fontSize: 12 }}>Sinon, la personne verra qu'aucun examen n'est possible.</div>
            </span>
            <Interrupteur actif={examenPossible} onBasculer={() => setExamenPossible((v) => !v)} />
          </div>
          <div className="rangee-boutons">
            <button type="button" className="bouton-admin bouton-admin-doux" onClick={() => setPanneau(null)} disabled={envoi}>Annuler</button>
            <button
              type="button"
              className={`bouton-admin ${panneau === "ban" ? "bouton-admin-danger" : ""}`}
              onClick={() => sanctionner(panneau === "ban" ? "bannissement" : "suspension")}
              disabled={envoi}
            >
              {panneau === "ban" ? "Bannir définitivement" : `Suspendre ${duree} j`}
            </button>
          </div>
        </div>
      )}

      {role === "admin" && !suppressionOuverte && (
        <div className="actions-admin" style={{ marginTop: 12 }}>
          <button type="button" className="bouton-admin bouton-admin-danger" onClick={() => { setConfirmationSuppression(""); setSuppressionOuverte(true); }} disabled={envoi}>
            <i className="fa-solid fa-trash-can" /> Supprimer définitivement le compte
          </button>
        </div>
      )}
      {suppressionOuverte && role === "admin" && (
        <div className="panneau-sanction" style={{ border: "1px solid var(--danger, #b94a48)", marginTop: 12 }}>
          <strong>Suppression irréversible</strong>
          <p className="info">Le compte, ses publications, commentaires, documents partagés, playsits créés, classes créées, feuilles, messages, réactions, notifications et sessions seront supprimés. Les adhésions de ce compte aux classes des autres seront retirées.</p>
          <label htmlFor={`confirmation-suppression-${u.username}`}>Saisis exactement <strong>{u.username}</strong> pour confirmer.</label>
          <input id={`confirmation-suppression-${u.username}`} value={confirmationSuppression} onChange={e => setConfirmationSuppression(e.target.value)} autoComplete="off" />
          <div className="rangee-boutons">
            <button type="button" className="bouton-admin bouton-admin-doux" onClick={() => setSuppressionOuverte(false)} disabled={envoi}>Annuler</button>
            <button type="button" className="bouton-admin bouton-admin-danger" onClick={supprimerDefinitivement} disabled={envoi || confirmationSuppression.trim() !== u.username}>
              {envoi ? <i className="fa-solid fa-circle-notch fa-spin" /> : "Confirmer la suppression définitive"}
            </button>
          </div>
        </div>
      )}
      {erreur && <div className="erreur" style={{ marginTop: 8 }}>{erreur}</div>}
    </div>
  );
}

/* ----------------------- Salle de contrôle : les signalements ----------------------- */
export function SalleSignalements({ sessionToken, role }) {
  const [statut, setStatut] = useState("ouvert");
  const [signalements, setSignalements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const res = await adminListerSignalements(sessionToken, statut);
      setSignalements(res.signalements);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }, [sessionToken, statut]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <>
      <div className="choix-categorie" style={{ marginBottom: 14 }}>
        <button type="button" className={`chip ${statut === "ouvert" ? "chip-actif" : ""}`} onClick={() => setStatut("ouvert")}>À traiter</button>
        <button type="button" className={`chip ${statut === "traite" ? "chip-actif" : ""}`} onClick={() => setStatut("traite")}>Traités</button>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}
      {chargement && <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>}
      {!chargement && !erreur && signalements.length === 0 && (
        <div className="info">
          <i className="fa-solid fa-circle-check"></i>{" "}
          {statut === "ouvert" ? "Aucun signalement à traiter." : "Aucun signalement traité."}
        </div>
      )}

      <div className="admin-grille">
        {signalements.map((s) => (
          <CarteSignalement key={s.id} sig={s} sessionToken={sessionToken} role={role} onTraite={charger} />
        ))}
      </div>
    </>
  );
}

/* --------------------------- Registre : les comptes --------------------------- */
export function SalleUtilisateurs({ sessionToken, role }) {
  const [recherche, setRecherche] = useState("");
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const res = await adminChercherUtilisateurs(sessionToken, recherche);
      setUtilisateurs(res.utilisateurs);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }, [sessionToken, recherche]);

  useEffect(() => {
    charger();
    // la recherche se lance au clic / Entrée, pas à chaque lettre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
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

      {erreur && <div className="erreur">{erreur}</div>}
      {chargement && <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>}
      {!chargement && !erreur && utilisateurs.length === 0 && <div className="info">Aucun compte trouvé.</div>}

      <div className="admin-grille">
        {utilisateurs.map((u) => (
          <CarteUtilisateur key={u.username} u={u} sessionToken={sessionToken} role={role} onChange={charger} />
        ))}
      </div>
    </>
  );
}
