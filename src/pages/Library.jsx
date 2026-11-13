import { useEffect, useRef, useState } from "react";
import {
  rechercherDocumentsLibrary,
  uploaderDocumentLibrary,
  commenterDocumentLibrary,
  listerCommentairesDocumentLibrary,
  obtenirDocumentLibrary, estGrindEnLigne,
} from "../api.js";
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

function iconeDocument(type = "") {
  if (type === "application/pdf") return "fa-file-pdf";
  if (type.includes("spreadsheet") || type.includes("excel") || type === "text/csv") return "fa-file-excel";
  return "fa-file-word";
}

function lireDocumentsEnCache(username) {
  try {
    const valeur = JSON.parse(localStorage.getItem(`grind_library_docs_${username || "compte"}`) || "[]");
    return Array.isArray(valeur) ? valeur : [];
  } catch { return []; }
}

export default function Library({ sessionToken, monUsername, documentAouvrirId = null }) {
  const cleCacheDocuments = `grind_library_docs_${monUsername || "compte"}`;
  const [documents, setDocuments] = useState(() => lireDocumentsEnCache(monUsername));
  const documentsCache = useRef(documents);
  const [total, setTotal] = useState(documents.length);
  const [recherche, setRecherche] = useState("");
  const [reconnexion, setReconnexion] = useState(0);
  const [chargement, setChargement] = useState(() => documents.length === 0 && estGrindEnLigne());
  const [chargementPlus, setChargementPlus] = useState(false);
  const [erreur, setErreur] = useState("");
  const [profil, setProfil] = useState(null);

  const [partageOuvert, setPartageOuvert] = useState(false);
  const [fichier, setFichier] = useState(null);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const [apercu, setApercu] = useState(null);
  const [documentCible, setDocumentCible] = useState(null);
  const [commentaires, setCommentaires] = useState([]);
  const [commentaire, setCommentaire] = useState("");
  const [chargementCommentaires, setChargementCommentaires] = useState(false);
  const [envoiCommentaire, setEnvoiCommentaire] = useState(false);

  useEffect(() => {
    const statutApi = event => { if (event.detail?.online) setReconnexion(value => value + 1); };
    window.addEventListener("grind-api-status", statutApi);
    return () => window.removeEventListener("grind-api-status", statutApi);
  }, []);

  useEffect(() => {
    let actif = true;
    const terme = recherche.trim().toLocaleLowerCase("fr");
    const filtrerCache = () => !terme ? documentsCache.current : documentsCache.current.filter(doc =>
      String(doc.titre || "").toLocaleLowerCase("fr").includes(terme)
    );
    const local = filtrerCache();
    setDocuments(local);
    setTotal(local.length);
    setErreur("");
    if (!estGrindEnLigne()) {
      setChargement(false);
      return () => { actif = false; };
    }
    const timer = window.setTimeout(async () => {
      if (!documentsCache.current.length) setChargement(true);
      try {
        const resultat = await rechercherDocumentsLibrary(sessionToken, recherche.trim(), 0, 100);
        if (!actif) return;
        const trouve = resultat.documents || [];
        setDocuments(trouve);
        setTotal(resultat.total ?? trouve.length);
        if (!recherche.trim()) {
          documentsCache.current = trouve;
          try { localStorage.setItem(cleCacheDocuments, JSON.stringify(trouve.slice(0, 100))); } catch {}
        }
      } catch (e) {
        if (actif && !local.length) setErreur(e.message || "Impossible de charger les documents.");
      } finally {
        if (actif) setChargement(false);
      }
    }, recherche.trim() ? 180 : 0);
    return () => { actif = false; window.clearTimeout(timer); };
  }, [sessionToken, recherche, cleCacheDocuments, reconnexion]);

  useEffect(() => {
    let actif = true;
    if (!documentAouvrirId) return () => { actif = false; };
    if (!estGrindEnLigne()) {
      const cached = documentsCache.current.find(doc => Number(doc.id) === Number(documentAouvrirId));
      if (cached) setApercu(cached);
      else setErreur("Ce document n'a pas encore été enregistré sur cet appareil.");
      return () => { actif = false; };
    }
    obtenirDocumentLibrary(sessionToken, Number(documentAouvrirId))
      .then(r => { if (actif) setApercu(r.document); })
      .catch(e => { if (actif) setErreur(e.message); });
    return () => { actif = false; };
  }, [sessionToken, documentAouvrirId]);

  async function publierDocument(e) {
    e.preventDefault();
    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour partager un document." }));
      return;
    }
    if (!fichier || !titre.trim()) {
      setErreur("Choisis un fichier et donne-lui un titre pour qu'il soit retrouvable.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      await uploaderDocumentLibrary(sessionToken, fichier, titre.trim(), description.trim());
      setFichier(null);
      setTitre("");
      setDescription("");
      setPartageOuvert(false);
      const resultat = await rechercherDocumentsLibrary(sessionToken, recherche.trim(), 0, 100);
      const trouve = resultat.documents || [];
      setDocuments(trouve);
      setTotal(resultat.total ?? trouve.length);
      if (!recherche.trim()) {
        documentsCache.current = trouve;
        try { localStorage.setItem(cleCacheDocuments, JSON.stringify(trouve.slice(0, 100))); } catch {}
      }
    } catch (e) {
      setErreur(e.message || "Le document n'a pas pu être partagé.");
    } finally {
      setEnvoi(false);
    }
  }

  async function chargerPlus() {
    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour charger d'autres documents." }));
      return;
    }
    if (chargementPlus || documents.length >= total) return;
    setChargementPlus(true);
    try {
      const resultat = await rechercherDocumentsLibrary(sessionToken, recherche.trim(), documents.length, 100);
      setDocuments(prev => {
        const ajoutes = resultat.documents || [];
        const ids = new Set(prev.map(doc => doc.id));
        const fusion = [...prev, ...ajoutes.filter(doc => !ids.has(doc.id))];
        if (!recherche.trim()) {
          documentsCache.current = fusion;
          try { localStorage.setItem(cleCacheDocuments, JSON.stringify(fusion.slice(0, 100))); } catch {}
        }
        return fusion;
      });
      setTotal(resultat.total ?? total);
    } catch (e) {
      setErreur(e.message || "Impossible de charger la suite.");
    } finally {
      setChargementPlus(false);
    }
  }

  async function ouvrirCommentaires(doc) {
    setDocumentCible(doc);
    setCommentaire("");
    const cleCommentaires = `grind_library_comments_${monUsername || "compte"}_${doc.id}`;
    let cacheCommentaires = [];
    try {
      const valeur = JSON.parse(localStorage.getItem(cleCommentaires) || "[]");
      if (Array.isArray(valeur)) cacheCommentaires = valeur;
    } catch {}
    setCommentaires(cacheCommentaires);
    setChargementCommentaires(estGrindEnLigne() && cacheCommentaires.length === 0);
    if (!estGrindEnLigne()) return;
    try {
      const resultat = await listerCommentairesDocumentLibrary(sessionToken, doc.id);
      const liste = resultat.commentaires || [];
      setCommentaires(liste);
      try { localStorage.setItem(cleCommentaires, JSON.stringify(liste.slice(-100))); } catch {}
    } catch (e) {
      if (!cacheCommentaires.length) setErreur(e.message || "Les commentaires sont indisponibles.");
    } finally {
      setChargementCommentaires(false);
    }
  }

  async function envoyerCommentaire(e) {
    e.preventDefault();
    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour commenter ce document." }));
      return;
    }
    if (!documentCible || !commentaire.trim() || envoiCommentaire) return;
    setEnvoiCommentaire(true);
    try {
      await commenterDocumentLibrary(sessionToken, documentCible.id, commentaire.trim());
      const resultat = await listerCommentairesDocumentLibrary(sessionToken, documentCible.id);
      const liste = resultat.commentaires || [];
      setCommentaires(liste);
      try { localStorage.setItem(`grind_library_comments_${monUsername || "compte"}_${documentCible.id}`, JSON.stringify(liste.slice(-100))); } catch {}
      setCommentaire("");
      setDocuments(prev => {
        const actualises = prev.map(doc => doc.id === documentCible.id ? { ...doc, commentaires: (doc.commentaires || 0) + 1 } : doc);
        const cacheComplet = documentsCache.current.map(doc => doc.id === documentCible.id
          ? { ...doc, commentaires: (doc.commentaires || 0) + 1 } : doc);
        documentsCache.current = cacheComplet;
        try { localStorage.setItem(cleCacheDocuments, JSON.stringify(cacheComplet.slice(0, 100))); } catch {}
        return actualises;
      });
    } catch (e) {
      setErreur(e.message || "Le commentaire n'a pas pu être envoyé.");
    } finally {
      setEnvoiCommentaire(false);
    }
  }

  if (profil) return <ProfilPublic username={profil} onRetour={() => setProfil(null)} sessionToken={sessionToken} monUsername={monUsername} />;

  return <main className="library-page">
    <header className="library-header">
      <div className="library-marque">
        <span className="library-mark"><i className="fa-solid fa-book-open" /></span>
        <div><h1>Bibliothèque</h1><p>Tous les documents partagés, réunis au même endroit.</p></div>
      </div>
      <div className="library-header-actions">
        <button type="button" className="library-upload-global" onClick={() => {
        if (!estGrindEnLigne()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour partager un document." })); return; }
        setPartageOuvert(v => !v);
      }}>
          <i className="fa-solid fa-file-arrow-up" /> Partager un document
        </button>
      </div>
    </header>

    {partageOuvert && <form className="library-form" onSubmit={publierDocument}>
      <div className="library-form-title"><i className="fa-solid fa-cloud-arrow-up" /> Ajouter un document partagé</div>
      <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre du document (obligatoire)" maxLength={180} required />
      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={2000} placeholder="Description (facultative)" />
      <label className="library-file"><i className="fa-solid fa-paperclip" /> {fichier ? fichier.name : "Choisir PDF, Word, Excel ou CSV (30 Mo max)"}
        <input type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={e => setFichier(e.target.files?.[0] || null)} required />
      </label>
      <div className="library-form-actions">
        <button type="button" className="bouton-retour" onClick={() => setPartageOuvert(false)}>Annuler</button>
        <button disabled={envoi || !fichier || !titre.trim()}>{envoi ? <i className="fa-solid fa-circle-notch fa-spin" /> : "Partager"}</button>
      </div>
    </form>}

    <div className="library-search">
      <i className="fa-solid fa-magnifying-glass" />
      <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un document par son titre…" autoComplete="off" aria-label="Rechercher un document par son titre" />
      {recherche && <button type="button" className="library-search-clear" onClick={() => setRecherche("")} aria-label="Effacer la recherche"><i className="fa-solid fa-xmark" /></button>}
    </div>

    {!estGrindEnLigne() && <div className="library-offline-note"><i className="fa-solid fa-wifi-slash" /> Bibliothèque hors ligne · documents déjà consultés sur cet appareil.</div>}
    {erreur && <div className="library-error" role="alert">{erreur}</div>}

    <section className="library-docs">
      <div className="library-section-heading">
        <div><h2>{recherche.trim() ? "Résultats correspondants" : "Documents partagés"}</h2><p>{recherche.trim() ? "Les titres les plus proches de ta recherche apparaissent en premier." : "Les nouveaux documents apparaissent ici automatiquement."}</p></div>
        {!chargement && <span>{total} document{total > 1 ? "s" : ""}</span>}
      </div>

      {chargement ? <ChargementGrind texte="Recherche des documents…" /> : documents.length === 0 ? (
        <div className="library-empty">{!estGrindEnLigne() ? "Aucun document de la Bibliothèque n'a été enregistré sur cet appareil." : recherche.trim() ? "Aucun document ne correspond à cette recherche." : "Aucun document partagé pour le moment."}</div>
      ) : documents.map(doc => <article className="library-doc" key={doc.id}>
        <div className="library-doc-icon"><i className={`fa-solid ${iconeDocument(doc.fichier_type)}`} /></div>
        <div className="library-doc-main">
          <h3>{doc.titre}</h3>
          <p className="library-doc-author">Partagé par <button type="button" onClick={() => setProfil(doc.auteur.username)}>{doc.auteur.nom}</button></p>
          <p className="library-doc-meta">{dateCourte(doc.date)}{doc.taille_octets ? ` · ${taille(doc.taille_octets)}` : ""} · {doc.fichier_nom}</p>
          {doc.description && <p className="library-doc-description">{doc.description}</p>}
          <div className="library-doc-actions">
            <button type="button" title="Prévisualiser" aria-label="Prévisualiser" onClick={() => setApercu(doc)}><i className="fa-regular fa-eye" /></button>
            <a href={doc.fichier_url} download={doc.fichier_nom} target="_blank" rel="noreferrer" title="Télécharger" aria-label="Télécharger"><i className="fa-solid fa-download" /></a>
            <button type="button" onClick={() => ouvrirCommentaires(doc)} title="Commentaires" aria-label="Commentaires"><i className="fa-regular fa-comment" /> <small>{doc.commentaires || 0}</small></button>
          </div>
        </div>
      </article>)}

      {!chargement && documents.length < total && <button type="button" className="library-load-more" onClick={chargerPlus} disabled={chargementPlus}>{chargementPlus ? "Chargement…" : "Afficher les documents suivants"}</button>}
    </section>

    {apercu && <div className="library-modal-backdrop" onClick={() => setApercu(null)}>
      <section className="library-preview-modal" role="dialog" aria-modal="true" aria-label={`Aperçu : ${apercu.titre}`} onClick={e => e.stopPropagation()}>
        <header><div><strong>{apercu.titre}</strong><small>Partagé par {apercu.auteur?.nom || "un membre"}</small></div><button onClick={() => setApercu(null)} aria-label="Fermer"><i className="fa-solid fa-xmark" /></button></header>
        {!estGrindEnLigne()
          ? <div className="library-preview-other"><i className="fa-solid fa-wifi-slash" /><strong>Fichier non disponible hors ligne</strong><span>Les informations du document sont consultables. Le fichier doit être téléchargé lorsque GRIND retrouve Internet.</span></div>
          : <ApercuDocument document={apercu} sessionToken={sessionToken} />}
      </section>
    </div>}

    {documentCible && <div className="library-modal-backdrop" onClick={() => setDocumentCible(null)}>
      <section className="library-review-modal" role="dialog" aria-modal="true" aria-label={`Commentaires : ${documentCible.titre}`} onClick={e => e.stopPropagation()}>
        <header><strong>Commentaires — {documentCible.titre}</strong><button onClick={() => setDocumentCible(null)} aria-label="Fermer"><i className="fa-solid fa-xmark" /></button></header>
        <div className="library-review-list">
          {chargementCommentaires ? <ChargementGrind texte="Chargement des commentaires…" /> : commentaires.length === 0 ? <p className="library-empty">{!estGrindEnLigne() ? "Aucun commentaire de ce document n'a été enregistré sur cet appareil." : "Aucun commentaire pour le moment."}</p> : commentaires.map(c => <div className="library-review" key={c.id}>
            <button type="button" onClick={() => { setDocumentCible(null); setProfil(c.username); }}>{c.nom || c.username}</button>
            <p>{c.contenu}</p><small>{c.date ? new Date(c.date).toLocaleDateString("fr-FR") : ""}</small>
          </div>)}
        </div>
        <form onSubmit={envoyerCommentaire}>
          <input value={commentaire} onChange={e => setCommentaire(e.target.value)} maxLength={2000} placeholder="Écrire un commentaire…" />
          <button disabled={!commentaire.trim() || envoiCommentaire} aria-label="Envoyer le commentaire">{envoiCommentaire ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-paper-plane" />}</button>
        </form>
      </section>
    </div>}
  </main>;
}
