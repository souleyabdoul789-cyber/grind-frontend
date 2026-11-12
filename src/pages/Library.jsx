import { useCallback, useEffect, useState } from "react";
import {
  listerPlaylistsLibrary, rechercherDocumentsLibrary, creerPlaylistLibrary,
  uploaderDocumentLibrary, listerDocumentsLibrary, voterDocumentLibrary,
  commenterDocumentLibrary, listerCommentairesDocumentLibrary, obtenirDocumentLibrary,
} from "../api.js";
import AvatarIcone from "../components/AvatarIcone.jsx";
import ProfilPublic from "../components/ProfilPublic.jsx";
import ChargementGrind from "../components/ChargementGrind.jsx";
import ApercuDocument from "../components/ApercuDocument.jsx";

function dateCourte(value) {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function taille(value) {
  if (!value) return "";
  return value >= 1048576 ? `${(value / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(value / 1024))} Ko`;
}

export default function Library({ sessionToken, monUsername, documentAouvrirId = null }) {
  const [categories, setCategories] = useState([]);
  const [categorie, setCategorie] = useState("Toutes");
  const [categorieCreation, setCategorieCreation] = useState("");
  const [documentCible, setDocumentCible] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [playlist, setPlaylist] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentsRecherche, setDocumentsRecherche] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [profil, setProfil] = useState(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [uploadOuvert, setUploadOuvert] = useState(false);
  const [uploadGlobal, setUploadGlobal] = useState(false);
  const [categorieUpload, setCategorieUpload] = useState("");
  const [fichierGlobal, setFichierGlobal] = useState(null);
  const [titreGlobal, setTitreGlobal] = useState("");
  const [descriptionGlobal, setDescriptionGlobal] = useState("");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [fichier, setFichier] = useState(null);
  const [titreDoc, setTitreDoc] = useState("");
  const [descriptionDoc, setDescriptionDoc] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [apercu, setApercu] = useState(null);
  const [docCommentaires, setDocCommentaires] = useState({});
  const [avisOuvert, setAvisOuvert] = useState(null);
  const [avisTexte, setAvisTexte] = useState("");

  const chargerPlaylists = useCallback(async () => {
    const r = await listerPlaylistsLibrary(sessionToken, categorie === "Toutes" ? "" : categorie, recherche);
    setPlaylists(r.playlists || []);
    setCategories(r.categories || []);
    if (playlist && !(r.playlists || []).some(p => p.id === playlist.id)) setPlaylist(null);
  }, [sessionToken, categorie, recherche]);

  const chargerDocs = useCallback(async (p = playlist) => {
    if (!p) { setDocuments([]); return; }
    const r = await listerDocumentsLibrary(sessionToken, p.id, recherche);
    setDocuments(r.documents || []);
  }, [sessionToken, playlist, recherche]);

  useEffect(() => {
    let actif = true;
    setChargement(true); setErreur("");
    listerPlaylistsLibrary(sessionToken, categorie === "Toutes" ? "" : categorie, recherche)
      .then(r => { if (!actif) return; setPlaylists(r.playlists || []); setCategories(r.categories || []); })
      .catch(e => { if (actif) setErreur(e.message); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, [sessionToken, categorie, recherche]);

  useEffect(() => { if (playlist) chargerDocs(playlist).catch(e => setErreur(e.message)); }, [playlist?.id, recherche]);
  useEffect(() => {
    let actif = true;
    const mot = recherche.trim();
    if (!mot) { setDocumentsRecherche([]); return () => { actif = false; }; }
    rechercherDocumentsLibrary(sessionToken, mot, categorie === "Toutes" ? "" : categorie)
      .then(r => { if (actif) setDocumentsRecherche(r.documents || []); })
      .catch(e => { if (actif) setErreur(e.message); });
    return () => { actif = false; };
  }, [sessionToken, recherche, categorie]);

  function ouvrirDocumentRecherche(doc) {
    setPlaylist({ id: doc.playlist_id, titre: doc.playlist, categorie: doc.categorie, description: "Ressources publiques de la communauté GRIND." });
    setDocumentCible(doc.id);
    setApercu(doc);
  }

  useEffect(() => {
    let actif = true;
    if (!documentAouvrirId) return () => { actif = false; };
    obtenirDocumentLibrary(sessionToken, Number(documentAouvrirId)).then(r => {
      if (!actif) return;
      setCategorie(r.playlist.categorie);
      setPlaylist(r.playlist);
      setDocumentCible(r.document.id);
      setApercu(r.document);
    }).catch(e => { if (actif) setErreur(e.message); });
    return () => { actif = false; };
  }, [sessionToken, documentAouvrirId]);

  async function creer(e) {
    e.preventDefault(); setEnvoi(true); setErreur("");
    try {
      const r = await creerPlaylistLibrary(sessionToken, { titre, description, categorie: categorieCreation || (categorie === "Toutes" ? categories[0] : categorie) });
      setTitre(""); setDescription(""); setCreationOuverte(false); setCategorieCreation(""); await chargerPlaylists();
      setPlaylist(r.playlist);
    } catch (e) { setErreur(e.message); } finally { setEnvoi(false); }
  }
  async function publierDocumentGlobal(e) {
    e.preventDefault();
    if (!fichierGlobal || !categorieUpload) return;
    setEnvoi(true); setErreur("");
    try {
      const r = await uploaderDocumentLibrary(sessionToken, categorieUpload, fichierGlobal, null, titreGlobal, descriptionGlobal);
      setFichierGlobal(null); setTitreGlobal(""); setDescriptionGlobal(""); setUploadGlobal(false);
      setCategorie(categorieUpload);
      const liste = await listerPlaylistsLibrary(sessionToken, categorieUpload, "");
      setPlaylists(liste.playlists || []);
      if (r.document) {
        const cible = (liste.playlists || []).find(x => x.id === r.document.playlist_id);
        if (cible) { setPlaylist(cible); setDocuments(await listerDocumentsLibrary(sessionToken, cible.id, "")); }
        setDocumentCible(r.document.id);
        setApercu(r.document);
      }
    } catch (e) { setErreur(e.message); } finally { setEnvoi(false); }
  }

  async function publierDocument(e) {
    e.preventDefault(); if (!fichier || !playlist) return;
    setEnvoi(true); setErreur("");
    try {
      await uploaderDocumentLibrary(sessionToken, playlist.categorie, fichier, playlist.id, titreDoc, descriptionDoc);
      setFichier(null); setTitreDoc(""); setDescriptionDoc(""); setUploadOuvert(false); await chargerDocs(playlist);
    } catch (e) { setErreur(e.message); } finally { setEnvoi(false); }
  }
  async function voter(doc, valeur) {
    const avant = doc.mon_vote;
    const majVote = d => d.id === doc.id ? { ...d, mon_vote: avant === valeur ? 0 : valeur, votes_positifs: d.votes_positifs + (avant === 1 ? -1 : valeur === 1 ? 1 : 0), votes_negatifs: d.votes_negatifs + (avant === -1 ? -1 : valeur === -1 ? 1 : 0) } : d;
    setDocuments(ds => ds.map(majVote));
    setDocumentsRecherche(ds => ds.map(majVote));
    try { await voterDocumentLibrary(sessionToken, doc.id, valeur); } catch (e) { setErreur(e.message); await chargerDocs(); }
  }
  async function ouvrirAvis(doc) {
    setAvisOuvert(doc); setAvisTexte("");
    try { const r = await listerCommentairesDocumentLibrary(sessionToken, doc.id); setDocCommentaires(s => ({ ...s, [doc.id]: r.commentaires || [] })); }
    catch (e) { setErreur(e.message); }
  }
  async function envoyerAvis(e) {
    e.preventDefault(); if (!avisOuvert || !avisTexte.trim()) return;
    try { await commenterDocumentLibrary(sessionToken, avisOuvert.id, avisTexte); const r = await listerCommentairesDocumentLibrary(sessionToken, avisOuvert.id); setDocCommentaires(s => ({ ...s, [avisOuvert.id]: r.commentaires || [] })); setAvisTexte(""); await chargerDocs(); }
    catch (e) { setErreur(e.message); }
  }

  if (profil) return <ProfilPublic username={profil} onRetour={() => setProfil(null)} sessionToken={sessionToken} monUsername={monUsername} />;

  return <main className="library-page">
    <header className="library-header">
      <div className="library-marque"><span className="library-mark"><i className="fa-solid fa-book-open" /></span><div><h1>Library</h1><p>Le savoir se partage. Les ressources restent accessibles à tous.</p></div></div>
      <div className="library-header-actions"><button type="button" className="library-upload-global" onClick={() => setUploadGlobal(v => !v)}><i className="fa-solid fa-file-arrow-up" /> Partager un document</button><button type="button" className="library-create" onClick={() => setCreationOuverte(v => !v)}><i className="fa-solid fa-pen-to-square" /> Créer un playsit</button></div>
    </header>
    {uploadGlobal && <form className="library-form" onSubmit={publierDocumentGlobal}>
      <div className="library-form-title"><i className="fa-solid fa-cloud-arrow-up" /> Publier une ressource dans la Library</div>
      <label className="library-select-label">Matière du document<select value={categorieUpload} onChange={e => setCategorieUpload(e.target.value)} required><option value="" disabled>Choisir une matière</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
      <input value={titreGlobal} onChange={e => setTitreGlobal(e.target.value)} placeholder="Titre du document (facultatif)" maxLength={180} />
      <textarea value={descriptionGlobal} onChange={e => setDescriptionGlobal(e.target.value)} rows={2} maxLength={2000} placeholder="Décrire la ressource (facultatif)" />
      <label className="library-file"><i className="fa-solid fa-paperclip" /> {fichierGlobal ? fichierGlobal.name : "Choisir PDF, Word, Excel ou CSV (30 Mo max)"}<input type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={e => setFichierGlobal(e.target.files?.[0] || null)} required /></label>
      <div className="library-form-actions"><button type="button" className="bouton-retour" onClick={() => setUploadGlobal(false)}>Annuler</button><button disabled={envoi || !categorieUpload || !fichierGlobal}>{envoi ? <i className="fa-solid fa-circle-notch fa-spin" /> : "Publier la ressource"}</button></div>
      <small>Le document sera classé automatiquement dans le playsit public de sa matière.</small>
    </form>}
    <div className="library-search"><i className="fa-solid fa-magnifying-glass" /><input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un document, un playsit ou une matière…" /></div>
    <nav className="library-categories" aria-label="Catégories de ressources">
      <button className={categorie === "Toutes" ? "library-chip actif" : "library-chip"} onClick={() => setCategorie("Toutes")}>Toutes</button>
      {categories.map(c => <button key={c} className={categorie === c ? "library-chip actif" : "library-chip"} onClick={() => setCategorie(c)}>{c}</button>)}
    </nav>
    {creationOuverte && <form className="library-form" onSubmit={creer}>
      <div className="library-form-title"><i className="fa-solid fa-folder-plus" /> Nouveau playsit public</div>
      <input value={titre} onChange={e => setTitre(e.target.value)} maxLength={120} placeholder="Nom du playsit" required />
      <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1200} rows={2} placeholder="Description (facultative)" />
      <label className="library-select-label">Matière du playsit<select value={categorieCreation || (categorie === "Toutes" ? "" : categorie)} onChange={e => setCategorieCreation(e.target.value)} required><option value="" disabled>Choisir une matière</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
      <div className="library-form-actions"><button type="button" className="bouton-retour" onClick={() => setCreationOuverte(false)}>Annuler</button><button disabled={envoi}>{envoi ? <i className="fa-solid fa-circle-notch fa-spin" /> : "Créer le playsit"}</button></div>
      <small>Playsit public : les autres membres peuvent y ajouter des ressources de la même matière.</small>
    </form>}
    {erreur && <div className="library-error" role="alert">{erreur}</div>}
    {!playlist && recherche.trim() && <section className="library-docs library-search-results"><div className="library-section-heading"><div><h2>Documents trouvés</h2><p>Recherche dans tous les playsits publics.</p></div><span>{documentsRecherche.length} résultat{documentsRecherche.length > 1 ? "s" : ""}</span></div>{documentsRecherche.length === 0 ? <div className="library-empty">Aucun document correspondant dans cette catégorie.</div> : documentsRecherche.map(doc => <article className="library-doc" key={`search-${doc.id}`}>
      <div className="library-doc-icon"><i className={`fa-solid ${doc.fichier_type === "application/pdf" ? "fa-file-pdf" : doc.fichier_type.includes("spreadsheet") || doc.fichier_type === "text/csv" || doc.fichier_type.includes("excel") ? "fa-file-excel" : "fa-file-word"}`} /></div>
      <div className="library-doc-main"><h3>{doc.titre}</h3><p className="library-doc-author">Dans {doc.playlist} · <button onClick={() => setProfil(doc.auteur.username)}>{doc.auteur.nom}</button></p><p className="library-doc-meta">{doc.categorie} · {dateCourte(doc.date)}</p>{doc.description && <p className="library-doc-description">{doc.description}</p>}
        <div className="library-doc-actions"><button type="button" title="Prévisualiser" aria-label="Prévisualiser" onClick={() => ouvrirDocumentRecherche(doc)}><i className="fa-regular fa-eye" /></button><a href={doc.fichier_url} download={doc.fichier_nom} target="_blank" rel="noreferrer" title="Télécharger" aria-label="Télécharger"><i className="fa-solid fa-download" /></a><button className={doc.mon_vote === 1 ? "actif" : ""} onClick={() => voter(doc, 1)} title="Utile" aria-label="Utile"><i className="fa-regular fa-thumbs-up" /> <small>{doc.votes_positifs}</small></button><button className={doc.mon_vote === -1 ? "actif" : ""} onClick={() => voter(doc, -1)} title="Peu utile" aria-label="Peu utile"><i className="fa-regular fa-thumbs-down" /> <small>{doc.votes_negatifs}</small></button><button onClick={() => ouvrirAvis(doc)} title="Avis" aria-label="Avis"><i className="fa-regular fa-comment" /> <small>{doc.commentaires}</small></button></div>
      </div></article>)}</section>}
    {playlist ? <>
      <div className="library-playlist-head"><button className="library-back" onClick={() => setPlaylist(null)}><i className="fa-solid fa-arrow-left" /> Bibliothèque</button><div><span className="library-category-label">{playlist.categorie}</span><h2>{playlist.titre}</h2><p>{playlist.description || "Ressources partagées par la communauté GRIND."}</p></div><button className="library-upload" onClick={() => setUploadOuvert(v => !v)}><i className="fa-solid fa-file-arrow-up" /> Ajouter un document</button></div>
      {uploadOuvert && <form className="library-form" onSubmit={publierDocument}>
        <div className="library-form-title">Partager dans « {playlist.titre} »</div><input value={titreDoc} onChange={e => setTitreDoc(e.target.value)} maxLength={180} placeholder="Titre du document" required />
        <textarea value={descriptionDoc} onChange={e => setDescriptionDoc(e.target.value)} maxLength={2000} rows={2} placeholder="Description du contenu" />
        <label className="library-file"><i className="fa-solid fa-paperclip" /> {fichier ? fichier.name : "Choisir PDF, Excel ou CSV (30 Mo max)"}<input type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={e => setFichier(e.target.files?.[0] || null)} required /></label>
        <div className="library-form-actions"><button type="button" className="bouton-retour" onClick={() => setUploadOuvert(false)}>Annuler</button><button disabled={envoi || !fichier}>{envoi ? <i className="fa-solid fa-circle-notch fa-spin" /> : "Publier dans le playsit"}</button></div>
      </form>}
      <section className="library-docs">{documents.length === 0 ? <div className="library-empty">Aucun document dans ce playsit pour le moment. Tu peux y partager la première ressource.</div> : documents.map(doc => <article className={`library-doc ${documentCible === doc.id ? "library-doc-cible" : ""}`} key={doc.id}>
        <div className="library-doc-icon"><i className={`fa-solid ${doc.fichier_type === "application/pdf" ? "fa-file-pdf" : doc.fichier_type.includes("spreadsheet") || doc.fichier_type === "text/csv" || doc.fichier_type.includes("excel") ? "fa-file-excel" : "fa-file-word"}`} /></div>
        <div className="library-doc-main"><h3>{doc.titre}</h3><p className="library-doc-author">Par <button onClick={() => setProfil(doc.auteur.username)}>{doc.auteur.nom}</button></p><p className="library-doc-meta">{dateCourte(doc.date)}{doc.taille_octets ? ` · ${taille(doc.taille_octets)}` : ""}</p>{doc.description && <p className="library-doc-description">{doc.description}</p>}
          <div className="library-doc-actions"><button type="button" title="Prévisualiser" aria-label="Prévisualiser" onClick={() => { setDocumentCible(doc.id); setApercu(doc); }}><i className="fa-regular fa-eye" /></button><a href={doc.fichier_url} download={doc.fichier_nom} target="_blank" rel="noreferrer" title="Télécharger" aria-label="Télécharger"><i className="fa-solid fa-download" /></a><button className={doc.mon_vote === 1 ? "actif" : ""} onClick={() => voter(doc, 1)} title="Utile" aria-label="Utile"><i className="fa-regular fa-thumbs-up" /> <small>{doc.votes_positifs}</small></button><button className={doc.mon_vote === -1 ? "actif" : ""} onClick={() => voter(doc, -1)} title="Peu utile" aria-label="Peu utile"><i className="fa-regular fa-thumbs-down" /> <small>{doc.votes_negatifs}</small></button><button onClick={() => ouvrirAvis(doc)} title="Avis" aria-label="Avis"><i className="fa-regular fa-comment" /> <small>{doc.commentaires}</small></button></div>
        </div>
      </article>)}</section>
    </> : <section className="library-playlists"><div className="library-section-heading"><div><h2>Playsits publics</h2><p>Des ressources classées par matière, enrichies par tous les membres.</p></div><span>{playlists.length} playsits</span></div>{chargement ? <ChargementGrind texte="Chargement de la Library…" /> : playlists.length === 0 ? <div className="library-empty">Aucun playsit trouvé. Essaie une autre recherche ou crée le premier.</div> : <div className="library-playlist-grid">{playlists.map(p => <button key={p.id} className="library-playlist" onClick={() => setPlaylist(p)}><span className="library-folder"><i className="fa-regular fa-folder-open" /></span><span className="library-playlist-text"><strong>{p.titre}</strong><small>{p.categorie} · {p.documents} document{p.documents > 1 ? "s" : ""}</small><small>Par {p.createur.nom}</small></span><i className="fa-solid fa-arrow-up-right-from-square" /></button>)}</div>}</section>}

    {apercu && <div className="library-modal-backdrop" onClick={() => setApercu(null)}><section className="library-preview-modal" role="dialog" aria-modal="true" aria-label={`Aperçu : ${apercu.titre}`} onClick={e => e.stopPropagation()}><header><div><strong>{apercu.titre}</strong><small>{apercu.categorie} · partagé par {apercu.auteur?.nom || "un membre"}</small></div><button onClick={() => setApercu(null)} aria-label="Fermer"><i className="fa-solid fa-xmark" /></button></header><ApercuDocument document={apercu} sessionToken={sessionToken} /></section></div>}
    {avisOuvert && <div className="library-modal-backdrop" onClick={() => setAvisOuvert(null)}><section className="library-review-modal" onClick={e => e.stopPropagation()}><header><strong>Avis sur « {avisOuvert.titre} »</strong><button onClick={() => setAvisOuvert(null)} aria-label="Fermer"><i className="fa-solid fa-xmark" /></button></header><div className="library-review-list">{(docCommentaires[avisOuvert.id] || []).map(c => <div className="library-review" key={c.id}><button onClick={() => setProfil(c.username)}>{c.nom || c.username}</button><p>{c.contenu}</p><small>{new Date(c.date).toLocaleDateString("fr-FR")}</small></div>)}</div><form onSubmit={envoyerAvis}><input value={avisTexte} onChange={e => setAvisTexte(e.target.value)} maxLength={2000} placeholder="Écrire un avis…" /><button disabled={!avisTexte.trim()}><i className="fa-solid fa-paper-plane" /></button></form></section></div>}
  </main>;
}
