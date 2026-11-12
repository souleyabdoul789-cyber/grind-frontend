import FormulaireClasse from "../components/FormulaireClasse.jsx";
import { useState, useEffect } from "react";
import { rejoindreClasse, rejoindreDiscussion, listerMesClasses, renommerClasse, supprimerClasse, extraireCode } from "../api.js";
import SalleClasse from "../components/SalleClasse.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import EtatVide from "../components/EtatVide.jsx";
import DiscussionClasse from "../components/DiscussionClasse.jsx";
import ProfilPublic from "../components/ProfilPublic.jsx";

export default function Classes({ sessionToken, monUsername, codeAttente, onCodeConsomme, discussionAouvrir, onDiscussionOuverte }) {
  const [classes, setClasses] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [salleActive, setSalleActive] = useState(null); // salle LiveKit de la classe réelle
  const [discussionActive, setDiscussionActive] = useState(null);
  const [messageInitialDiscussion, setMessageInitialDiscussion] = useState(null);
  const [profilConsulte, setProfilConsulte] = useState(null);
  const [ouvertureSalleId, setOuvertureSalleId] = useState(null);

  const [formulaireOuvert, setFormulaireOuvert] = useState(codeAttente ? "rejoindre" : null);
  const [codeInvitation, setCodeInvitation] = useState(codeAttente || "");
  const [codeDiscussion, setCodeDiscussion] = useState("");
  const [erreurDiscussion, setErreurDiscussion] = useState("");
  const [adhesionDiscussion, setAdhesionDiscussion] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [lienCopie, setLienCopie] = useState(null);

  const [classeEnEdition, setClasseEnEdition] = useState(null);
  const [nomEdition, setNomEdition] = useState("");
  const [classeASupprimer, setClasseASupprimer] = useState(null);

  async function charger() {
    setChargement(true);
    setErreurChargement(null);
    try {
      const res = await listerMesClasses(sessionToken);
      setClasses(Array.isArray(res.classes) ? res.classes : []);
    } catch (err) {
      setErreurChargement(err.message || "Impossible de charger les classes. Réessaie.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  useEffect(() => {
    const ouvrirProfil = (event) => {
      const username = typeof event.detail === "string" ? event.detail : event.detail?.username;
      if (username) setProfilConsulte(username);
    };
    window.addEventListener("grind-open-profil", ouvrirProfil);
    return () => window.removeEventListener("grind-open-profil", ouvrirProfil);
  }, []);

  useEffect(() => {
    if (!discussionAouvrir?.classe_id || chargement) return;
    const cible = classes.find(c => Number(c.classe_id) === Number(discussionAouvrir.classe_id));
    if (cible) {
      setSalleActive(null);
      setMessageInitialDiscussion(discussionAouvrir.message_id || null);
      setDiscussionActive(cible);
      if (onDiscussionOuverte) onDiscussionOuverte();
    }
  }, [discussionAouvrir, classes, chargement, onDiscussionOuverte]);

  async function gererAdhesion(e) {
    e.preventDefault();
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      await rejoindreClasse(sessionToken, extraireCode(codeInvitation));
      setCodeInvitation("");
      setFormulaireOuvert(null);
      if (onCodeConsomme) onCodeConsomme();
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function gererAdhesionDiscussion(e) {
    e.preventDefault();
    setErreurDiscussion("");
    setAdhesionDiscussion(true);
    try {
      const res = await rejoindreDiscussion(sessionToken, extraireCode(codeDiscussion));
      setCodeDiscussion("");
      await charger();
      const cible = classes.find(c => Number(c.classe_id) === Number(res.classe_id));
      if (cible) setDiscussionActive(cible);
      else {
        const actualisees = await listerMesClasses(sessionToken);
        const ligne = (actualisees.classes || []).find(c => Number(c.classe_id) === Number(res.classe_id));
        if (ligne) { setClasses(actualisees.classes); setDiscussionActive(ligne); }
      }
    } catch (err) {
      setErreurDiscussion(err.message || "Impossible de rejoindre cette discussion.");
    } finally {
      setAdhesionDiscussion(false);
    }
  }

  function ouvrirDiscussion(c, messageId = null) {
    setSalleActive(null);
    setMessageInitialDiscussion(messageId);
    setDiscussionActive(c);
  }

  function ouvrirSalle(classeId) {
    if (ouvertureSalleId !== null) return;
    setOuvertureSalleId(classeId);
    window.setTimeout(() => {
      setSalleActive(classeId);
      setOuvertureSalleId(null);
    }, 250);
  }

  function copierLien(code) {
    navigator.clipboard.writeText(code);
    setLienCopie(code);
    setTimeout(() => setLienCopie(null), 2000);
  }

  function commencerEdition(c) {
    setClasseEnEdition(c.classe_id);
    setNomEdition(c.niveau && c.matiere ? c.complement || "" : c.nom);
  }

  async function validerRenommage(classeId) {
    if (!nomEdition.trim()) return;
    try {
      await renommerClasse(sessionToken, classeId, nomEdition.trim());
      setClasses((prev) => prev.map((c) => (c.classe_id === classeId ? { ...c, nom: nomEdition.trim() } : c)));
      setClasseEnEdition(null);
    } catch (err) {
      setErreur(err.message);
    }
  }

  function gererSuppression(classeId) {
    setClasseASupprimer(classeId);
  }

  async function confirmerSuppression() {
    const classeId = classeASupprimer;
    setClasseASupprimer(null);
    try {
      await supprimerClasse(sessionToken, classeId);
      setClasses((prev) => prev.filter((c) => c.classe_id !== classeId));
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (profilConsulte) {
    return (
      <div className="fil-actu">
        <ProfilPublic username={profilConsulte} sessionToken={sessionToken} monUsername={monUsername} onRetour={() => setProfilConsulte(null)} />
      </div>
    );
  }

  if (discussionActive) {
    return (
      <div className="fil-actu discussion-page-shell">
        <DiscussionClasse
          sessionToken={sessionToken}
          classe={discussionActive}
          monUsername={monUsername}
          messageAouvrirId={messageInitialDiscussion}
          onQuitter={() => { setDiscussionActive(null); setMessageInitialDiscussion(null); charger(); }}
        />
      </div>
    );
  }

  if (salleActive) {
    const classeOuverte = classes.find((c) => c.classe_id === salleActive);
    return (
      <div className="fil-actu">
        <div className="sous-titre" style={{ marginBottom: 12 }}>
          <i className="fa-solid fa-chalkboard"></i> {classeOuverte?.nom}
        </div>
        <SalleClasse
          sessionToken={sessionToken}
          demandeId={salleActive}
          monUsername={monUsername}
          profInitial={classeOuverte?.prof_actuel}
          nomClasse={classeOuverte?.nom}
          onQuitter={() => setSalleActive(null)}
        />
      </div>
    );
  }

  return (
    <div className="fil-actu">
      <form className="discussion-rejoindre-form carte-post" onSubmit={gererAdhesionDiscussion}>
        <div className="discussion-rejoindre-intro">
          <span className="discussion-rejoindre-icone"><i className="fa-solid fa-comments" /></span>
          <span><strong>Rejoindre une discussion</strong><small>Entre le code du groupe. Tu peux discuter même si la classe réelle est complète.</small></span>
        </div>
        <div className="discussion-rejoindre-ligne">
          <input value={codeDiscussion} onChange={e => setCodeDiscussion(e.target.value)} placeholder="Code ou lien d'invitation du groupe" aria-label="Code ou lien d'invitation du groupe" />
          <button type="submit" disabled={adhesionDiscussion || !codeDiscussion.trim()}>{adhesionDiscussion ? <i className="fa-solid fa-circle-notch fa-spin" /> : <><i className="fa-solid fa-arrow-right-to-bracket" /> Rejoindre</>}</button>
        </div>
        {erreurDiscussion && <div className="erreur" role="alert">{erreurDiscussion}</div>}
      </form>

      <div className="choix-categorie" style={{ marginBottom: 16 }}>
        <button
          className={formulaireOuvert === "creer" ? "chip chip-actif" : "chip"}
          onClick={() => setFormulaireOuvert(formulaireOuvert === "creer" ? null : "creer")}
          type="button"
        >
          <i className="fa-solid fa-plus"></i> Créer une classe
        </button>
        <button
          className={formulaireOuvert === "rejoindre" ? "chip chip-actif" : "chip"}
          onClick={() => setFormulaireOuvert(formulaireOuvert === "rejoindre" ? null : "rejoindre")}
          type="button"
        >
          <i className="fa-solid fa-right-to-bracket"></i> Rejoindre
        </button>
      </div>

      {formulaireOuvert === "creer" && (
        <FormulaireClasse
          sessionToken={sessionToken}
          onCree={() => {
            setFormulaireOuvert(null);
            charger();
          }}
        />
      )}

      {formulaireOuvert === "rejoindre" && (
        <form className="carte-post formulaire-post" onSubmit={gererAdhesion}>
          <label><i className="fa-solid fa-key"></i> Code d'invitation</label>
          <input
            value={codeInvitation}
            onChange={(e) => setCodeInvitation(e.target.value)}
            placeholder="colle juste le code (pas besoin du lien entier)"
            required
          />
          <button type="submit" disabled={envoiEnCours}>{envoiEnCours ? <><i className="fa-solid fa-spinner fa-spin"></i> Connexion...</> : "Rejoindre"}</button>
          {erreur && <div className="erreur"><i className="fa-solid fa-triangle-exclamation"></i>{erreur}</div>}
        </form>
      )}

      {chargement ? (
        <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement des classes...</div>
      ) : erreurChargement && classes.length === 0 ? (
        <div className="carte-post etat-erreur-reseau" role="alert">
          <p>{erreurChargement}</p>
          <button type="button" onClick={charger}>Réessayer</button>
        </div>
      ) : classes.length === 0 ? (
        <EtatVide texte="Aucune classe pour l'instant" />
      ) : (
        classes.map((c) => (
          <div key={c.classe_id} className="carte-post carte-classe">
            <div className="entete-post">
              <div className="avatar-mini"><i className="fa-solid fa-chalkboard-user"></i></div>
              <div style={{ flex: 1 }}>
                {classeEnEdition === c.classe_id ? (
                  <div className="edition-nom-classe">
                    <input
                      value={nomEdition}
                      placeholder={c.niveau && c.matiere ? "Complément du nom (facultatif)" : "Nom de la classe"}
                      maxLength={c.niveau && c.matiere ? 30 : 60}
                      onChange={(e) => setNomEdition(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && validerRenommage(c.classe_id)}
                      autoFocus
                    />
                    <button type="button" onClick={() => validerRenommage(c.classe_id)}><i className="fa-solid fa-check"></i></button>
                    <button type="button" className="bouton-retour" onClick={() => setClasseEnEdition(null)}><i className="fa-solid fa-xmark"></i></button>
                  </div>
                ) : (
                  <div className="auteur-post">{c.nom}</div>
                )}
                <div className="badge-categorie demonstration">
                  <i className="fa-solid fa-users"></i> {c.nb_membres} {c.nb_membres > 1 ? "membres" : "membre"} dans la classe
                </div>
                <div className="discussion-meta-classe">
                  <i className="fa-solid fa-comments" /> {c.discussion_membres ?? 0} / 200 dans la discussion
                  {c.est_membre_classe === false && <span> · membre du groupe uniquement</span>}
                </div>
              </div>
              {c.role === "prof" && (
                <div className="badge-statut statut-ouverte">
                  <i className="fa-solid fa-star"></i> Créateur
                </div>
              )}
            </div>

            {c.role === "prof" && classeEnEdition !== c.classe_id && (
              <>
                <button className="action-post" onClick={() => copierLien(c.code_invitation)} type="button">
                  <i className={lienCopie === c.code_invitation ? "fa-solid fa-check" : "fa-solid fa-link"}></i>
                  {lienCopie === c.code_invitation ? "Code copié" : "Copier le code d'invitation"}
                </button>
                <button className="action-post" onClick={() => commencerEdition(c)} type="button">
                  <i className="fa-solid fa-pen"></i> Renommer
                </button>
                <button className="action-post action-danger" onClick={() => gererSuppression(c.classe_id)} type="button">
                  <i className="fa-solid fa-trash"></i> Supprimer la classe
                </button>
              </>
            )}

            <div className="discussion-actions-classe">
              {c.est_membre_discussion !== false ? (
                <button className="discussion-ouvrir-groupe" onClick={() => ouvrirDiscussion(c)} type="button">
                  <i className="fa-solid fa-comments" /> Ouvrir la discussion <span>{c.discussion_membres ?? 0}</span>
                </button>
              ) : (
                <div className="info discussion-acces-retire"><i className="fa-solid fa-lock" /> Accès à la discussion retiré. Contacte un administrateur du groupe.</div>
              )}
              {c.est_membre_classe !== false && !c.suspendue && (
                <button className="action-post discussion-ouvrir-classe" onClick={() => ouvrirSalle(c.classe_id)} disabled={ouvertureSalleId !== null} type="button">
                  {ouvertureSalleId === c.classe_id ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Ouverture...</> : <><i className="fa-solid fa-phone"></i> Entrer dans la classe</>}
                </button>
              )}
              {c.suspendue && <div className="info classe-suspendue"><i className="fa-solid fa-circle-pause"></i> Classe suspendue par l'administration de GRIND</div>}
            </div>
          </div>
        ))
      )}
      {classeASupprimer && (
        <ConfirmModal
          message="Supprimer définitivement cette classe ? Tous ses membres seront retirés."
          onConfirmer={confirmerSuppression}
          onAnnuler={() => setClasseASupprimer(null)}
        />
      )}
    </div>
  );
}
