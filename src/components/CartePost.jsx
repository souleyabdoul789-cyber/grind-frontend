import { useState, useEffect } from "react";
import {
  togglerLike, listerCommentaires, ajouterCommentaire, resoudrePost, supprimerPost,
  obtenirAvatarDe, modererPostInstitution, uploaderMedia, uploaderDocument,
  likerCommentaire, modifierPost,
} from "../api.js";
import LecteurMedia from "./LecteurMedia.jsx";
import TexteExtensible from "./TexteExtensible.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import AvatarIcone from "./AvatarIcone.jsx";
import ModaleSignalement from "./ModaleSignalement.jsx";
import BadgeCompte from "./BadgeCompte.jsx";
import ActionsCompte from "./ActionsCompte.jsx";
import ChampMention from "./ChampMention.jsx";

function rendreTexteAvecMentions(texte, onClicAuteur) {
  const morceaux = String(texte || "").split(/(@[A-Za-z_]{3,24})/g);
  return morceaux.map((morceau, index) => /^@[A-Za-z_]{3,24}$/.test(morceau)
    ? <button key={`${morceau}-${index}`} type="button" className="mention-profil" onClick={() => onClicAuteur?.(morceau.slice(1))}>{morceau}</button>
    : <span key={`texte-${index}`}>{morceau}</span>);
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
  const [aime, setAime] = useState(false);
  const [nbLikes, setNbLikes] = useState(post.likes || 0);
  const [commentairesOuverts, setCommentairesOuverts] = useState(false);
  const [commentaires, setCommentaires] = useState([]);
  const [nouveauCommentaire, setNouveauCommentaire] = useState("");
  const [parentCommentaire, setParentCommentaire] = useState(null);
  const [pieceCommentaire, setPieceCommentaire] = useState(null);
  const [envoiCommentaire, setEnvoiCommentaire] = useState(false);
  const [apercuPiece, setApercuPiece] = useState(null);
  const [contenuPost, setContenuPost] = useState(post.contenu || "");
  const [editionLegende, setEditionLegende] = useState(false);
  const [statutActuel, setStatutActuel] = useState(post.statut);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const [signalement, setSignalement] = useState(null);
  const [moderationEnCours, setModerationEnCours] = useState(false);
  const [indexMedia, setIndexMedia] = useState(null);
  const medias = post.media_items?.length ? post.media_items : (post.media_url ? [{ url: post.media_url, type: post.media_type || "image" }] : []);
  const galerieImages = medias.length > 1 && medias.every(m => m.type === "image");
  const telechargementMediaAutorise = !post.document_url;

  useEffect(() => { obtenirAvatarDe(post.auteur).then(res => setAvatarAuteur(res.config)).catch(() => {}); }, [post.auteur]);
  useEffect(() => {
    const ouvrirCommentaire = (event) => {
      if (!commentairesOuverts) {
        setCommentairesOuverts(true);
        listerCommentaires(post.id, sessionToken).then(res => setCommentaires(res.commentaires || [])).catch(() => {});
      }
      window.setTimeout(() => document.getElementById(`grind-comment-${event.detail}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
    };
    window.addEventListener("grind-open-comment", ouvrirCommentaire);
    return () => window.removeEventListener("grind-open-comment", ouvrirCommentaire);
  }, [post.id, sessionToken, commentairesOuverts]);

  async function gererLike() {
    const avant = aime; setAime(!avant); setNbLikes(n => n + (avant ? -1 : 1));
    try { await togglerLike(sessionToken, post.id); } catch { setAime(avant); setNbLikes(n => n + (avant ? 1 : -1)); }
  }
  async function chargerCommentaires() {
    const res = await listerCommentaires(post.id, sessionToken); setCommentaires(res.commentaires || []);
  }
  async function ouvrirCommentaires() {
    const nouvelEtat = !commentairesOuverts; setCommentairesOuverts(nouvelEtat);
    if (nouvelEtat && commentaires.length === 0) await chargerCommentaires();
  }
  async function choisirPiece(e) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.type.startsWith("image/")) setPieceCommentaire({ file, type: "image", url: URL.createObjectURL(file) });
    else if (["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type) || /\.(pdf|docx)$/i.test(file.name)) setPieceCommentaire({ file, type: "document" });
    else setPieceCommentaire(null);
    e.target.value = "";
  }
  async function envoyerCommentaire() {
    if ((!nouveauCommentaire.trim() && !pieceCommentaire) || envoiCommentaire) return;
    setEnvoiCommentaire(true);
    try {
      let pieces = {};
      if (pieceCommentaire?.type === "image") {
        const media = await uploaderMedia(sessionToken, pieceCommentaire.file, null);
        pieces = { media_url: media.media_url, media_type: "image" };
      } else if (pieceCommentaire?.type === "document") {
        const doc = await uploaderDocument(sessionToken, pieceCommentaire.file);
        pieces = { document_url: doc.document_url, document_name: doc.document_name, document_type: doc.document_type };
      }
      const res = await ajouterCommentaire(sessionToken, post.id, nouveauCommentaire, { ...pieces, parent_id: parentCommentaire || undefined });
      setCommentaires(prev => [...prev, res.commentaire]);
      setNouveauCommentaire(""); setPieceCommentaire(null); setParentCommentaire(null);
    } catch (e) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: e.message })); }
    finally { setEnvoiCommentaire(false); }
  }
  async function aimerCommentaire(c) {
    const avant = !!c.aime;
    setCommentaires(prev => prev.map(x => x.id === c.id ? { ...x, aime: !avant, likes: (x.likes || 0) + (avant ? -1 : 1) } : x));
    try { const r = await likerCommentaire(sessionToken, c.id); setCommentaires(prev => prev.map(x => x.id === c.id ? { ...x, aime: r.like, likes: r.likes } : x)); }
    catch { setCommentaires(prev => prev.map(x => x.id === c.id ? { ...x, aime: avant, likes: (x.likes || 0) + (avant ? 1 : -1) } : x)); }
  }
  async function enregistrerLegende() {
    try { const r = await modifierPost(sessionToken, post.id, contenuPost); setContenuPost(r.contenu); setEditionLegende(false); }
    catch (e) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: e.message })); }
  }
  async function marquerResolu() { await resoudrePost(sessionToken, post.id); setStatutActuel("resolue"); }
  async function confirmerSuppression() {
    setConfirmationOuverte(false); setSuppressionEnCours(true);
    try { await supprimerPost(sessionToken, post.id); onSupprime?.(post.id); } catch { setSuppressionEnCours(false); }
  }
  const statut = STATUT_STYLE[statutActuel];
  const estAuteur = post.auteur === monUsername;
  const peutModerer = modeInstitutionnel && !estAuteur && etablissements.some(e => Number(e.id) === Number(post.etablissement_id) && e.moderation_locale);
  async function retirerPublicationLocale() { setModerationEnCours(true); try { await modererPostInstitution(sessionToken, post.id); onSupprime?.(post.id); } catch { setModerationEnCours(false); } }

  function afficherCommentaire(c) {
    return <div key={c.id} id={`grind-comment-${c.id}`} className={`ligne-commentaire ${c.parent_id ? "commentaire-reponse" : ""}`}>
      <AvatarIcone username={c.username} taille={30} onClic={onClicAuteur} />
      <div className="texte-commentaire">
        <button type="button" className="auteur-commentaire auteur-commentaire-bouton" onClick={() => onClicAuteur?.(c.username)}>{c.nom || c.username}<BadgeCompte badge={c.badge} taille={12} /></button>
        {!!c.contenu && <div className="commentaire-contenu">{rendreTexteAvecMentions(c.contenu, onClicAuteur)}</div>}
        {c.media_url && <button type="button" className="commentaire-photo-card" onClick={() => setApercuPiece(c.media_url)}><img src={c.media_url} alt="Pièce jointe" /><span><i className="fa-solid fa-expand" /> Voir l'image</span></button>}
        {c.document_url && <a className="commentaire-document" href={c.document_url} target="_blank" rel="noreferrer" download><i className="fa-solid fa-file-lines" /><span>{c.document_name || "Document joint"}</span><i className="fa-solid fa-download" /></a>}
        <div className="commentaire-actions"><button type="button" className={c.aime ? "actif" : ""} onClick={() => aimerCommentaire(c)}><i className={c.aime ? "fa-solid fa-thumbs-up" : "fa-regular fa-thumbs-up"} /> {c.likes || 0}</button><button type="button" onClick={() => { setParentCommentaire(c.id); setNouveauCommentaire(`@${c.username} `); }}><i className="fa-solid fa-reply" /> Répondre</button></div>
      </div>
      {c.username !== monUsername && <button type="button" className="action-signaler-mini" onClick={() => setSignalement({ type: "commentaire", id: c.id, libelle: `le commentaire de ${c.username}`, compte: c.username })} aria-label="Signaler ce commentaire"><i className="fa-regular fa-flag" /></button>}
    </div>;
  }

  return <div className="carte-post" id={`grind-post-${post.id}`} data-post-id={post.id}>
    <div className="entete-post">
      {post.auteur_type === "proviseur" && post.logo_etablissement ? <img className="avatar-institution-post" src={post.logo_etablissement} alt="Logo de l'établissement" /> : <AvatarIcone username={post.auteur} config={avatarAuteur} taille={40} onClic={onClicAuteur} />}
      <div><button type="button" className="auteur-post auteur-post-bouton" onClick={() => onClicAuteur?.(post.auteur)}>{post.auteur}<BadgeCompte badge={post.auteur_badge} /></button>
        {post.auteur_type === "proviseur" && <div className="meta-etablissement-post"><i className="fa-solid fa-school" /> {post.etablissement_nom || "Établissement"}</div>}
        <div className={`badge-categorie ${post.categorie}`}><i className={post.categorie === "probleme" ? "fa-solid fa-circle-question" : "fa-solid fa-star"} />{post.categorie === "probleme" ? "Problème" : "Démonstration"}</div>
      </div>
      {statut && <div className={`badge-statut ${statut.classe}`}><i className={statut.icone} />{statut.texte}</div>}
    </div>

    {editionLegende ? <div className="edition-legende"><ChampMention sessionToken={sessionToken} value={contenuPost} onChange={setContenuPost} rows={4} placeholder="Modifier la légende…" /><div className="rangee-boutons"><button type="button" className="bouton-retour" onClick={() => { setContenuPost(post.contenu || ""); setEditionLegende(false); }}>Annuler</button><button type="button" onClick={enregistrerLegende}>Enregistrer</button></div><small>Les pièces jointes restent inchangées.</small></div> : !!contenuPost && <TexteExtensible texte={contenuPost} rendreTexte={texte => rendreTexteAvecMentions(texte, onClicAuteur)} />}
    {post.document_url && <a className="piece-jointe-document" href={post.document_url} target="_blank" rel="noopener noreferrer" download><span className="icone-document"><i className="fa-solid fa-file-lines" /></span><span><strong>{post.document_name || "Document"}</strong><small>{post.document_type === "application/pdf" ? "PDF" : "DOCX"} · Ouvrir ou télécharger</small></span><i className="fa-solid fa-download" /></a>}

    {galerieImages ? <div className="galerie-publication">{medias.slice(0, 4).map((m, i) => <button key={`${m.url}-${i}`} type="button" onClick={() => setIndexMedia(i)}><img src={m.url} alt={`Image ${i + 1} de la publication`} loading="lazy" />{i === 3 && medias.length > 4 && <span>+{medias.length - 4}</span>}</button>)}</div>
      : medias.map((m, i) => <div key={`${m.url}-${i}`} className="media-post-wrap" onClick={() => m.type === "image" && setIndexMedia(i)}>{m.type === "image" ? <LecteurMedia url={m.url} type="image" /> : <LecteurMedia url={m.url} type={m.type} />}</div>)}
    {telechargementMediaAutorise && medias.some(m => m.type === "video") && <div className="media-download-row"><a href={medias.find(m => m.type === "video").url} download target="_blank" rel="noreferrer"><i className="fa-solid fa-download" /> Télécharger la vidéo</a></div>}

    {post.categorie === "probleme" && statutActuel === "ouverte" && post.date_limite && <div className="delai-post"><i className="fa-solid fa-stopwatch" />{formaterDelai(post.date_limite)}</div>}
    {post.raison_expiration && <div className="delai-post"><i className="fa-solid fa-circle-info" />{post.raison_expiration}</div>}

    <div className="actions-post">
      <button className={`action-post ${aime ? "actif" : ""}`} onClick={gererLike} type="button"><i className={aime ? "fa-solid fa-heart" : "fa-regular fa-heart"} />{nbLikes}</button>
      <button className="action-post" onClick={ouvrirCommentaires} type="button"><i className="fa-regular fa-comment" />{commentairesOuverts ? commentaires.length : post.commentaires}</button>
      {estAuteur && <button className="action-post" onClick={() => setEditionLegende(v => !v)} type="button" title="Modifier uniquement la légende"><i className="fa-solid fa-pen" /> Modifier</button>}
      {estAuteur && post.categorie === "probleme" && statutActuel === "ouverte" && <button className="action-post" onClick={marquerResolu} type="button"><i className="fa-solid fa-check" /> Marquer résolu</button>}
      {peutModerer && <button className="action-post action-danger" type="button" disabled={moderationEnCours} onClick={retirerPublicationLocale}><i className="fa-solid fa-shield-halved" /> {moderationEnCours ? <i className="fa-solid fa-circle-notch fa-spin" /> : "Retirer du réseau"}</button>}
      {estAuteur && <button className="action-post action-danger" onClick={() => setConfirmationOuverte(true)} disabled={suppressionEnCours} type="button" aria-label="Supprimer la publication"><i className="fa-solid fa-trash" /></button>}
      {!estAuteur && <span className="action-signaler"><ActionsCompte sessionToken={sessionToken} username={post.auteur} direction="haut" onChange={onChange} extras={[{ cle:"signaler-post", icone:"fa-regular fa-flag", label:"Signaler ce post", onClick:() => setSignalement({ type:"post", id:post.id, libelle:`ce post de ${post.auteur}`, compte:post.auteur }) }]} /></span>}
    </div>

    {commentairesOuverts && <div className="bloc-commentaires">
      {commentaires.filter(c => !c.parent_id).map(c => <div className="commentaire-thread" key={c.id}>{afficherCommentaire(c)}{commentaires.filter(reply => reply.parent_id === c.id).map(afficherCommentaire)}</div>)}
      {commentaires.filter(c => c.parent_id && !commentaires.some(p => p.id === c.parent_id)).map(afficherCommentaire)}
      {parentCommentaire && <div className="reponse-cible">Réponse à un commentaire <button type="button" onClick={() => { setParentCommentaire(null); setNouveauCommentaire(""); }}>Annuler</button></div>}
      {pieceCommentaire && <div className="commentaire-piece-selectionnee">{pieceCommentaire.type === "image" ? <img src={pieceCommentaire.url} alt="Aperçu" /> : <i className="fa-solid fa-file-lines" />}<span>{pieceCommentaire.file.name}</span><button type="button" onClick={() => setPieceCommentaire(null)} aria-label="Retirer la pièce jointe"><i className="fa-solid fa-xmark" /></button></div>}
      <div className="saisie-commentaire"><label className="commentaire-joindre" title="Joindre une image ou un document"><i className="fa-solid fa-paperclip" /><input type="file" accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={choisirPiece} hidden /></label><ChampMention sessionToken={sessionToken} value={nouveauCommentaire} onChange={setNouveauCommentaire} placeholder="Écris un commentaire…" rows={2} className="commentaire-mention" /><button onClick={envoyerCommentaire} type="button" disabled={envoiCommentaire || (!nouveauCommentaire.trim() && !pieceCommentaire)}>{envoiCommentaire ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-paper-plane" />}</button></div>
    </div>}

    {indexMedia !== null && <div className="media-lightbox" onClick={() => setIndexMedia(null)}><button type="button" className="lightbox-close" aria-label="Fermer"><i className="fa-solid fa-xmark" /></button>{medias[indexMedia] && <><button type="button" className="lightbox-nav precedent" disabled={indexMedia === 0} onClick={e => { e.stopPropagation(); setIndexMedia(i => i - 1); }}><i className="fa-solid fa-chevron-left" /></button><img src={medias[indexMedia].url} alt={`Image ${indexMedia + 1}`} onClick={e => e.stopPropagation()} />{telechargementMediaAutorise && <a className="lightbox-download" href={medias[indexMedia].url} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}><i className="fa-solid fa-download" /> Télécharger</a>}<button type="button" className="lightbox-nav suivant" disabled={indexMedia >= medias.length - 1} onClick={e => { e.stopPropagation(); setIndexMedia(i => i + 1); }}><i className="fa-solid fa-chevron-right" /></button><span className="lightbox-counter">{indexMedia + 1} / {medias.length}</span></>}</div>}
    {apercuPiece && <div className="media-lightbox" onClick={() => setApercuPiece(null)}><button className="lightbox-close" onClick={() => setApercuPiece(null)}><i className="fa-solid fa-xmark" /></button><img src={apercuPiece} alt="Aperçu du commentaire" /></div>}
    {signalement && <ModaleSignalement sessionToken={sessionToken} typeCible={signalement.type} cibleId={signalement.id} libelle={signalement.libelle} compteCible={signalement.compte} onChange={onChange} onFermer={() => setSignalement(null)} />}
    {confirmationOuverte && <ConfirmModal message="Supprimer ce post définitivement ?" onConfirmer={confirmerSuppression} onAnnuler={() => setConfirmationOuverte(false)} />}
  </div>;
}
