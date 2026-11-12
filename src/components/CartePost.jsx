import { useState, useEffect } from "react";
import { togglerLike, listerCommentaires, ajouterCommentaire, resoudrePost, supprimerPost, obtenirAvatarDe, modererPostInstitution } from "../api.js";
import LecteurMedia from "./LecteurMedia.jsx";
import TexteExtensible from "./TexteExtensible.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import AvatarIcone from "./AvatarIcone.jsx";
import ModaleSignalement from "./ModaleSignalement.jsx";
import BadgeCompte from "./BadgeCompte.jsx";
import ActionsCompte from "./ActionsCompte.jsx";

function rendreTexteAvecMentions(texte, onClicAuteur) {
  const morceaux = String(texte || "").split(/(@[A-Za-z_]{3,24})/g);
  return morceaux.map((morceau, index) => {
    if (/^@[A-Za-z_]{3,24}$/.test(morceau)) {
      const username = morceau.slice(1);
      return (
        <button
          key={`${username}-${index}`}
          type="button"
          className="mention-profil"
          onClick={() => onClicAuteur && onClicAuteur(username)}
          aria-label={`Ouvrir le profil de ${username}`}
        >
          {morceau}
        </button>
      );
    }
    return <span key={`texte-${index}`}>{morceau}</span>;
  });
}

function formaterDelai(dateLimiteIso) {
  const diffMs = new Date(dateLimiteIso).getTime() - Date.now();
  if (diffMs <= 0) return "délai dépassé";
  const heures = Math.floor(diffMs / 3600000);
  if (heures < 1) return `${Math.floor(diffMs / 60000)} min restantes`;
  if (heures < 24) return `${heures} h restantes`;
  return `${Math.floor(heures / 24)} j restants`;
}

const STATUT_STYLE = {
  ouverte: { icone: "fa-solid fa-hourglass-half", classe: "statut-ouverte", texte: "ouverte" },
  resolue: { icone: "fa-solid fa-circle-check", classe: "statut-resolue", texte: "résolue" },
  expiree: { icone: "fa-solid fa-clock-rotate-left", classe: "statut-expiree", texte: "expirée" },
  publiee: null,
};

export default function CartePost({ post, sessionToken, monUsername, onSupprime, onClicAuteur, onChange, modeInstitutionnel = false, etablissements = [] }) {
  const [avatarAuteur, setAvatarAuteur] = useState(null);

  useEffect(() => {
    obtenirAvatarDe(post.auteur).then((res) => setAvatarAuteur(res.config));
  }, [post.auteur]);

  const [aime, setAime] = useState(false);
  const [nbLikes, setNbLikes] = useState(post.likes);
  const [commentairesOuverts, setCommentairesOuverts] = useState(false);
  const [commentaires, setCommentaires] = useState([]);
  const [nouveauCommentaire, setNouveauCommentaire] = useState("");
  const [statutActuel, setStatutActuel] = useState(post.statut);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const [signalement, setSignalement] = useState(null); // { type, id, libelle }
  const [moderationEnCours, setModerationEnCours] = useState(false);

  async function gererLike() {
    setAime(!aime);
    setNbLikes(nbLikes + (aime ? -1 : 1));
    try {
      await togglerLike(sessionToken, post.id);
    } catch {
      setAime(aime);
      setNbLikes(nbLikes);
    }
  }

  async function ouvrirCommentaires() {
    const nouvelEtat = !commentairesOuverts;
    setCommentairesOuverts(nouvelEtat);
    if (nouvelEtat && commentaires.length === 0) {
      const res = await listerCommentaires(post.id, sessionToken);
      setCommentaires(res.commentaires || []);
    }
  }

  async function envoyerCommentaire() {
    if (!nouveauCommentaire.trim()) return;
    const res = await ajouterCommentaire(sessionToken, post.id, nouveauCommentaire);
    setCommentaires([...commentaires, res.commentaire]);
    setNouveauCommentaire("");
  }

  async function marquerResolu() {
    await resoudrePost(sessionToken, post.id);
    setStatutActuel("resolue");
  }

  async function gererSuppression() {
    setConfirmationOuverte(true);
  }

  async function confirmerSuppression() {
    setConfirmationOuverte(false);
    setSuppressionEnCours(true);
    try {
      await supprimerPost(sessionToken, post.id);
      if (onSupprime) onSupprime(post.id);
    } catch {
      setSuppressionEnCours(false);
    }
  }

  const statut = STATUT_STYLE[statutActuel];
  const estAuteur = post.auteur === monUsername;
  const peutModerer = modeInstitutionnel && !estAuteur && etablissements.some((e) => Number(e.id) === Number(post.etablissement_id) && e.moderation_locale);

  async function retirerPublicationLocale() {
    setModerationEnCours(true);
    try { await modererPostInstitution(sessionToken, post.id); if (onSupprime) onSupprime(post.id); }
    catch { setModerationEnCours(false); }
  }

  return (
    <div className="carte-post" id={`grind-post-${post.id}`} data-post-id={post.id}>
      <div className="entete-post">
        {post.auteur_type === "proviseur" && post.logo_etablissement ? <img className="avatar-institution-post" src={post.logo_etablissement} alt="Logo de l'établissement" /> : <AvatarIcone username={post.auteur} config={avatarAuteur} taille={40} onClic={onClicAuteur} />}
        <div>
          <button type="button" className="auteur-post auteur-post-bouton" onClick={() => onClicAuteur && onClicAuteur(post.auteur)}>
            {post.auteur}<BadgeCompte badge={post.auteur_badge} />
          </button>
          {post.auteur_type === "proviseur" && <div className="meta-etablissement-post"><i className="fa-solid fa-school"></i> {post.etablissement_nom || "Établissement"}</div>}
          <div className={`badge-categorie ${post.categorie}`}>
            <i className={post.categorie === "probleme" ? "fa-solid fa-circle-question" : "fa-solid fa-star"}></i>
            {post.categorie === "probleme" ? "Problème" : "Démonstration"}
          </div>
        </div>
        {statut && (
          <div className={`badge-statut ${statut.classe}`}>
            <i className={statut.icone}></i>
            {statut.texte}
          </div>
        )}
      </div>

      {post.media_url && <LecteurMedia url={post.media_url} type={post.media_type} />}

      {post.document_url && <a className="piece-jointe-document" href={post.document_url} target="_blank" rel="noopener noreferrer" download><span className="icone-document"><i className="fa-solid fa-file-lines"></i></span><span><strong>{post.document_name || "Document"}</strong><small>{post.document_type === "application/pdf" ? "PDF" : "DOCX"} · Ouvrir ou télécharger</small></span><i className="fa-solid fa-download" /></a>}
      {!!post.contenu && <TexteExtensible texte={post.contenu} rendreTexte={(texte) => rendreTexteAvecMentions(texte, onClicAuteur)} />}

      {post.categorie === "probleme" && statutActuel === "ouverte" && post.date_limite && (
        <div className="delai-post">
          <i className="fa-solid fa-stopwatch"></i>
          {formaterDelai(post.date_limite)}
        </div>
      )}

      {post.raison_expiration && (
        <div className="delai-post">
          <i className="fa-solid fa-circle-info"></i>
          {post.raison_expiration}
        </div>
      )}

      <div className="actions-post">
        <button className={`action-post ${aime ? "actif" : ""}`} onClick={gererLike} type="button">
          <i className={aime ? "fa-solid fa-heart" : "fa-regular fa-heart"}></i>
          {nbLikes}
        </button>
        <button className="action-post" onClick={ouvrirCommentaires} type="button">
          <i className="fa-regular fa-comment"></i>
          {post.commentaires}
        </button>
        {estAuteur && post.categorie === "probleme" && statutActuel === "ouverte" && (
          <button className="action-post" onClick={marquerResolu} type="button">
            <i className="fa-solid fa-check"></i>
            Marquer résolu
          </button>
        )}
        {peutModerer && <button className="action-post action-danger" type="button" disabled={moderationEnCours} onClick={retirerPublicationLocale}><i className="fa-solid fa-shield-halved"></i> {moderationEnCours ? "Retrait..." : "Retirer du réseau"}</button>}
        {estAuteur && (
          <button className="action-post action-danger" onClick={gererSuppression} disabled={suppressionEnCours} type="button">
            <i className="fa-solid fa-trash"></i>
          </button>
        )}
        {!estAuteur && (
          <span className="action-signaler">
            <ActionsCompte
              sessionToken={sessionToken}
              username={post.auteur}
              direction="haut"
              onChange={onChange}
              extras={[
                {
                  cle: "signaler-post",
                  icone: "fa-regular fa-flag",
                  label: "Signaler ce post",
                  onClick: () => setSignalement({ type: "post", id: post.id, libelle: `ce post de ${post.auteur}`, compte: post.auteur }),
                },
              ]}
            />
          </span>
        )}
      </div>

      {commentairesOuverts && (
        <div className="bloc-commentaires">
          {commentaires.map((c) => (
            <div key={c.id} className="ligne-commentaire">
              <AvatarIcone username={c.username} taille={26} onClic={onClicAuteur} />
              <div className="texte-commentaire">
                <button type="button" className="auteur-commentaire auteur-commentaire-bouton" onClick={() => onClicAuteur && onClicAuteur(c.username)}>
                  {c.username}<BadgeCompte badge={c.badge} taille={12} />
                </button>{" "}
                {rendreTexteAvecMentions(c.contenu, onClicAuteur)}
              </div>
              {c.username !== monUsername && (
                <button
                  type="button"
                  className="action-signaler-mini"
                  onClick={() => setSignalement({ type: "commentaire", id: c.id, libelle: `le commentaire de ${c.username}`, compte: c.username })}
                  aria-label="Signaler ce commentaire"
                >
                  <i className="fa-regular fa-flag"></i>
                </button>
              )}
            </div>
          ))}
          <div className="saisie-commentaire">
            <input
              value={nouveauCommentaire}
              onChange={(e) => setNouveauCommentaire(e.target.value)}
              placeholder="Écris une réponse..."
              onKeyDown={(e) => e.key === "Enter" && envoyerCommentaire()}
            />
            <button onClick={envoyerCommentaire} type="button">
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}
      {signalement && (
        <ModaleSignalement
          sessionToken={sessionToken}
          typeCible={signalement.type}
          cibleId={signalement.id}
          libelle={signalement.libelle}
          compteCible={signalement.compte}
          onChange={onChange}
          onFermer={() => setSignalement(null)}
        />
      )}
      {confirmationOuverte && (
        <ConfirmModal
          message="Supprimer ce post définitivement ?"
          onConfirmer={confirmerSuppression}
          onAnnuler={() => setConfirmationOuverte(false)}
        />
      )}
    </div>
  );
}
