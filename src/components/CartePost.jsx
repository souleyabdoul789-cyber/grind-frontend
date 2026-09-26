import { useState } from "react";
import { togglerLike, listerCommentaires, ajouterCommentaire, resoudrePost, supprimerPost } from "../api.js";
import LecteurMedia from "./LecteurMedia.jsx";
import TexteExtensible from "./TexteExtensible.jsx";

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

export default function CartePost({ post, sessionToken, monUsername, onSupprime }) {
  const [aime, setAime] = useState(false);
  const [nbLikes, setNbLikes] = useState(post.likes);
  const [commentairesOuverts, setCommentairesOuverts] = useState(false);
  const [commentaires, setCommentaires] = useState([]);
  const [nouveauCommentaire, setNouveauCommentaire] = useState("");
  const [statutActuel, setStatutActuel] = useState(post.statut);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

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
      const res = await listerCommentaires(post.id);
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
    if (!window.confirm("Supprimer ce post ?")) return;
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

  return (
    <div className="carte-post">
      <div className="entete-post">
        <div className="avatar-mini">
          <i className="fa-solid fa-user"></i>
        </div>
        <div>
          <div className="auteur-post">{post.auteur}</div>
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

      <TexteExtensible texte={post.contenu} />

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
        {estAuteur && (
          <button className="action-post action-danger" onClick={gererSuppression} disabled={suppressionEnCours} type="button">
            <i className="fa-solid fa-trash"></i>
          </button>
        )}
      </div>

      {commentairesOuverts && (
        <div className="bloc-commentaires">
          {commentaires.map((c) => (
            <div key={c.id} className="ligne-commentaire">
              <span className="auteur-commentaire">{c.username}</span> {c.contenu}
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
    </div>
  );
}
