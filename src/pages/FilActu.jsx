import { useState, useEffect, useRef } from "react";
import { listerPosts, creerPost, uploaderMedia, uploaderDocument, estGrindEnLigne } from "../api.js";
import CartePost from "../components/CartePost.jsx";
import SelecteurDate from "../components/SelecteurDate.jsx";
import EditeurPhoto from "../components/EditeurPhoto.jsx";
import EditeurVideo from "../components/EditeurVideo.jsx";
import EtatVide from "../components/EtatVide.jsx";
import ProfilPublic from "../components/ProfilPublic.jsx";
import BandeauAnnonces from "../components/BandeauAnnonces.jsx";
import ChampMention from "../components/ChampMention.jsx";

const LIMITE_LEGENDE = 500;
const EXTENSIONS_IMAGES = new Set(["jpg", "jpeg", "png", "webp"]);
const EXTENSIONS_VIDEOS = new Set(["mp4", "mov", "webm"]);

function extensionFichier(fichier) {
  return String(fichier?.name || "").split(".").pop().toLowerCase();
}

function estImage(fichier) {
  const mime = String(fichier?.type || "").split(";", 1)[0].trim().toLowerCase();
  return ["image/jpeg", "image/png", "image/webp"].includes(mime) || EXTENSIONS_IMAGES.has(extensionFichier(fichier));
}

function estVideo(fichier) {
  return String(fichier?.type || "").toLowerCase().startsWith("video/") || EXTENSIONS_VIDEOS.has(extensionFichier(fichier));
}

export default function FilActu({ sessionToken, monUsername, modeInstitutionnel = false, etablissements = [], postAouvrir = null }) {
  const [profilConsulte, setProfilConsulte] = useState(null);
  const [filtre, setFiltre] = useState(null);
  const cleCachePosts = `grind_posts_${monUsername || "compte"}_${filtre || "tout"}`;
  const cachePostsInitial = (() => { try { const value = JSON.parse(localStorage.getItem(cleCachePosts) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } })();
  const [posts, setPosts] = useState(cachePostsInitial);
  const postsActuels = useRef(cachePostsInitial);
  const [chargement, setChargement] = useState(cachePostsInitial.length === 0);
  useEffect(() => {
    postsActuels.current = posts;
    try { localStorage.setItem(cleCachePosts, JSON.stringify(posts.slice(-250))); } catch {}
  }, [posts, cleCachePosts]);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [menuPiecesOuvert, setMenuPiecesOuvert] = useState(false);
  const imagesInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const documentInputRef = useRef(null);

  const [categorie, setCategorie] = useState("demonstration");
  const [contenu, setContenu] = useState("");
  const [dateLimite, setDateLimite] = useState(null);

  const [fichierBrut, setFichierBrut] = useState(null);
  const [fichiersGalerie, setFichiersGalerie] = useState([]);
  const [editeurOuvert, setEditeurOuvert] = useState(null); // "photo" | "video" | null
  const [fichierFinal, setFichierFinal] = useState(null); // Blob (photo) ou File original (video)
  const [documentFinal, setDocumentFinal] = useState(null);
  const [documentTitre, setDocumentTitre] = useState("");
  const [etablissementChoisi, setEtablissementChoisi] = useState("");
  const [decoupeVideo, setDecoupeVideo] = useState(null);
  const [apercuMedia, setApercuMedia] = useState(null);

  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [progressionUpload, setProgressionUpload] = useState(0);
  const [erreur, setErreur] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const retourFilRef = useRef({});
  retourFilRef.current = { profilConsulte, editeurOuvert, menuPiecesOuvert, apercuMedia, documentFinal, formulaireOuvert };

  useEffect(() => {
    const gererRetourFil = (event) => {
      if (event.defaultPrevented) return;
      const vue = retourFilRef.current;
      if (vue.profilConsulte) { setProfilConsulte(null); event.preventDefault(); return; }
      if (vue.editeurOuvert) { annulerEdition(); event.preventDefault(); return; }
      if (vue.menuPiecesOuvert) { setMenuPiecesOuvert(false); event.preventDefault(); return; }
      if (vue.apercuMedia) { retirerMedia(); event.preventDefault(); return; }
      if (vue.documentFinal) { retirerDocument(); event.preventDefault(); return; }
      if (vue.formulaireOuvert) { setFormulaireOuvert(false); event.preventDefault(); }
    };
    window.addEventListener("grind-back", gererRetourFil);
    return () => window.removeEventListener("grind-back", gererRetourFil);
  }, []);

  useEffect(() => {
    const url = apercuMedia?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [apercuMedia?.url]);

  function changerFiltre(nouveauFiltre) {
    const nouvelleCle = `grind_posts_${monUsername || "compte"}_${nouveauFiltre || "tout"}`;
    let cache = [];
    try {
      const valeur = JSON.parse(localStorage.getItem(nouvelleCle) || "[]");
      if (Array.isArray(valeur)) cache = valeur;
    } catch {}
    postsActuels.current = cache;
    setPosts(cache);
    setChargement(cache.length === 0);
    setErreur(null);
    setFiltre(nouveauFiltre);
  }

  async function charger({ silencieux = false } = {}) {
    if (!estGrindEnLigne()) { setChargement(false); return; }
    if (!silencieux && postsActuels.current.length === 0) setChargement(true);
    try {
      const res = await listerPosts(filtre, sessionToken);
      const entrants = Array.isArray(res.posts) ? res.posts : [];
      setPosts((anciens) => {
        const parId = new Map(entrants.map((post) => [post.post_id ?? post.id, post]));
        const anciensIds = new Set(anciens.map((post) => post.post_id ?? post.id));
        const fusion = anciens.map((ancien) => ({ ...ancien, ...(parId.get(ancien.post_id ?? ancien.id) || {}) }));
        entrants.forEach((post) => { const id = post.post_id ?? post.id; if (!anciensIds.has(id)) fusion.push(post); });
        try { localStorage.setItem(cleCachePosts, JSON.stringify(fusion.slice(-250))); } catch {}
        return fusion;
      });
      setErreur(null);
    } catch (error) {
      if (!postsActuels.current.length) setErreur(error.message || "Impossible de charger les actualités.");
    } finally { setChargement(false); }
  }

  useEffect(() => {
    charger();
    const actualiser = () => charger({ silencieux: true });
    const statutApi = event => { if (event.detail?.online) actualiser(); };
    window.addEventListener("online", actualiser);
    window.addEventListener("grind-api-status", statutApi);
    const intervalle = window.setInterval(actualiser, 45000);
    return () => {
      window.removeEventListener("online", actualiser);
      window.removeEventListener("grind-api-status", statutApi);
      window.clearInterval(intervalle);
    };
  }, [filtre, sessionToken, cleCachePosts]);

  useEffect(() => {
    if (!postAouvrir?.post_id || !posts.length) return;
    const timer = window.setTimeout(() => {
      const cible = document.getElementById(`grind-post-${postAouvrir.post_id}`);
      if (cible) {
        cible.scrollIntoView({ behavior: "smooth", block: "center" });
        cible.classList.add("post-cible-notification");
        window.setTimeout(() => cible.classList.remove("post-cible-notification"), 1800);
        if (postAouvrir.commentaire_id) window.setTimeout(() => window.dispatchEvent(new CustomEvent("grind-open-comment", { detail: postAouvrir.commentaire_id })), 220);
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [postAouvrir, posts]);

  useEffect(() => {
    const ouvrirPost = (event) => {
      const id = event.detail;
      const cible = document.getElementById(`grind-post-${id}`);
      if (cible) { cible.scrollIntoView({ behavior: "smooth", block: "center" }); cible.classList.add("post-cible-notification"); window.setTimeout(() => cible.classList.remove("post-cible-notification"), 1800); }
    };
    window.addEventListener("grind-open-post", ouvrirPost);
    return () => window.removeEventListener("grind-open-post", ouvrirPost);
  }, [posts]);

  function gererChoixFichier(e) {
    const selection = Array.from(e.target.files || []);
    e.currentTarget.value = "";
    setMenuPiecesOuvert(false);
    if (!selection.length) return;
    if (selection.length > 1) {
      if (selection.length > 10 || selection.some(f => !estImage(f))) {
        setErreur("Choisis jusqu’à 10 images JPG, PNG ou WebP. Les vidéos et documents se publient séparément.");
        e.target.value = "";
        return;
      }
      setFichiersGalerie(selection);
      setFichierBrut(null); setFichierFinal(null); setDecoupeVideo(null);
      setApercuMedia({ estGalerie: true, items: selection.map(f => ({ nom: f.name, url: URL.createObjectURL(f) })) });
      return;
    }
    const fichier = selection[0];
    setFichiersGalerie([]);
    if (estVideo(fichier) && fichier.size > 300 * 1024 * 1024) {
      setFichierBrut(null); setFichierFinal(null); setApercuMedia(null);
      setErreur("La vidéo ne doit pas dépasser 300 Mo.");
      e.target.value = "";
      return;
    }
    setFichierBrut(fichier);
    if (estVideo(fichier)) setEditeurOuvert("video");
    else if (estImage(fichier)) setEditeurOuvert("photo");
    else {
      setFichierBrut(null);
      setFichierFinal(null);
      setApercuMedia(null);
      setErreur("Format non pris en charge. Choisis une image JPG, PNG, WebP ou une vidéo MP4, MOV, WebM.");
    }
  }

  function gererChoixDocument(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const extension = extensionFichier(fichier);
    const mime = String(fichier.type || "").toLowerCase();
    const extensionDepuisMime = mime === "application/pdf" ? "pdf" : mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? "docx" : "";
    const format = ["pdf", "docx"].includes(extension) ? extension : extensionDepuisMime;
    if (!format || fichier.size <= 0 || fichier.size > 15 * 1024 * 1024) {
      setErreur("Choisis un document PDF ou DOCX de 15 Mo maximum.");
    } else {
      // Le type MIME fourni par certains sélecteurs Android est imprécis.
      // L'extension détermine le format attendu ; le serveur vérifie ensuite la signature réelle.
      setDocumentFinal(fichier);
      setDocumentTitre(String(fichier.name || `document.${format}`).replace(/\.[^.]+$/, "").trim());
      setErreur(null); setMenuPiecesOuvert(false);
    }
    e.target.value = "";
  }

  function validerEditionPhoto(blob) {
    setFichierFinal(blob);
    setApercuMedia({ url: URL.createObjectURL(blob), estVideo: false });
    setEditeurOuvert(null);
  }

  function validerEditionVideo({ debut, fin }) {
    setFichierFinal(fichierBrut);
    setDecoupeVideo({ debut, fin });
    setApercuMedia({ url: URL.createObjectURL(fichierBrut), estVideo: true });
    setEditeurOuvert(null);
  }

  function annulerEdition() {
    setFichierBrut(null);
    setEditeurOuvert(null);
  }

  function retirerMedia() {
    setFichiersGalerie([]); setFichierBrut(null); setFichierFinal(null); setDecoupeVideo(null); setApercuMedia(null);
  }
  function retirerDocument() { setDocumentFinal(null); setDocumentTitre(""); }

  async function gererCreation(e) {
    e.preventDefault();
    setErreur(null);

    if (categorie === "probleme" && !dateLimite) {
      setErreur("Indique une date limite pour ce problème");
      return;
    }
    if (documentFinal && !documentTitre.trim()) {
      setErreur("Donne un titre au document pour qu'il soit retrouvable dans la Bibliothèque.");
      return;
    }

    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour publier." }));
      return;
    }
    setEnvoiEnCours(true);
    try {
      let media = {};
      let document = {};
      let media_items = [];
      if (fichiersGalerie.length) {
        setUploadEnCours(true); setProgressionUpload(0);
        for (let i = 0; i < fichiersGalerie.length; i += 1) {
          const photo = fichiersGalerie[i];
          const resultat = await uploaderMedia(sessionToken, photo, null, pct => setProgressionUpload(Math.round(((i + pct / 100) / fichiersGalerie.length) * 100)));
          media_items.push({ url: resultat.media_url, type: "image" });
        }
      } else if (fichierFinal) {
        setUploadEnCours(true); setProgressionUpload(0);
        media = await uploaderMedia(sessionToken, fichierFinal, decoupeVideo, setProgressionUpload);
      }
      if (documentFinal) {
        setUploadEnCours(true);
        document = await uploaderDocument(sessionToken, documentFinal);
      }
      setUploadEnCours(false);
      setProgressionUpload(100);

      const dateLimiteIso = categorie === "probleme" ? dateLimite.toISOString() : null;
      await creerPost(sessionToken, {
        categorie, contenu, date_limite: dateLimiteIso,
        media_url: media.media_url, media_type: media.media_type, media_items,
        document_url: document.document_url, document_name: document.document_name,
        document_title: documentFinal ? documentTitre.trim() : undefined,
        document_type: document.document_type,
        etablissement_id: modeInstitutionnel && etablissementChoisi ? Number(etablissementChoisi) : undefined,
      });

      setContenu("");
      setDateLimite(null);
      retirerMedia();
      setDocumentFinal(null);
      setDocumentTitre("");
      setMenuPiecesOuvert(false);
      setFormulaireOuvert(false);
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
      setUploadEnCours(false);
      setProgressionUpload(0);
    }
  }

  if (profilConsulte) {
    return <ProfilPublic username={profilConsulte} onRetour={() => setProfilConsulte(null)} sessionToken={sessionToken} monUsername={monUsername} />;
  }

  return (
    <div className="fil-actu">
      <BandeauAnnonces sessionToken={sessionToken} />
      <div className="filtres-fil">
        <button className={filtre === null ? "filtre-actif" : "filtre"} onClick={() => changerFiltre(null)}>
          Tout
        </button>
        <button
          className={filtre === "probleme" ? "filtre-actif" : "filtre"}
          onClick={() => changerFiltre("probleme")}
          title="Problèmes"
          aria-label="Problèmes"
        >
          <i className="fa-solid fa-circle-question"></i> Prob.
        </button>
        <button
          className={filtre === "demonstration" ? "filtre-actif" : "filtre"}
          onClick={() => changerFiltre("demonstration")}
          title="Démonstrations"
          aria-label="Démonstrations"
        >
          <i className="fa-solid fa-star"></i> Démo
        </button>
      </div>

      {editeurOuvert === "photo" && (
        <div className="carte-post formulaire-post publication-composer">
          <EditeurPhoto fichier={fichierBrut} onValider={validerEditionPhoto} onAnnuler={annulerEdition} />
        </div>
      )}

      {editeurOuvert === "video" && (
        <div className="carte-post formulaire-post publication-composer">
          <EditeurVideo fichier={fichierBrut} onValider={validerEditionVideo} onAnnuler={annulerEdition} />
        </div>
      )}

      {formulaireOuvert && !editeurOuvert && (
        <form className={`carte-post formulaire-post publication-composer ${modeInstitutionnel ? "publication-institutionnelle" : ""}`} onSubmit={gererCreation}>
          <div className="choix-categorie">
            <button
              type="button"
              className={categorie === "demonstration" ? "chip chip-actif" : "chip"}
              title="Démonstration" aria-label="Démonstration"
              onClick={() => setCategorie("demonstration")}
            >
              <i className="fa-solid fa-star"></i> Démo
            </button>
            {!modeInstitutionnel && <button
              type="button"
              className={categorie === "probleme" ? "chip chip-actif" : "chip"}
              title="Problème" aria-label="Problème"
              onClick={() => setCategorie("probleme")}
            >
              <i className="fa-solid fa-circle-question"></i> Prob.
            </button>}
          </div>

          {modeInstitutionnel && etablissements.length > 1 && <label className="select-etablissement-post">Publier dans <select value={etablissementChoisi} onChange={(e) => setEtablissementChoisi(e.target.value)} required><option value="">Choisir un établissement</option>{etablissements.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}</select></label>}
          <ChampMention
            sessionToken={sessionToken}
            rows={3}
            className="composer-mention-textarea"
            value={contenu}
            onChange={setContenu}
            placeholder={categorie === "probleme" ? "Décris ce que tu n'arrives pas à résoudre..." : "Partage quelque chose..."}
          />
          <div className="compteur-caracteres">{contenu.length} / {LIMITE_LEGENDE}</div>

          {apercuMedia && <div className="apercu-media-form">
            {apercuMedia.estGalerie ? <div className="publication-gallery-preview">{apercuMedia.items.slice(0, 4).map((item, i) => <div key={item.nom}><img src={item.url} alt="" />{i === 3 && apercuMedia.items.length > 4 && <span>+{apercuMedia.items.length - 4}</span>}</div>)}<small>{apercuMedia.items.length} images sélectionnées</small></div> : apercuMedia.estVideo ? <video src={apercuMedia.url} muted playsInline /> : <img src={apercuMedia.url} alt="" />}
            <button type="button" className="bouton-retirer-media" onClick={retirerMedia} aria-label="Retirer le média"><i className="fa-solid fa-xmark" /></button>
          </div>}
          <div className="publication-attachments-picker">
            <input ref={imagesInputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple hidden onChange={gererChoixFichier} />
            <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" hidden onChange={gererChoixFichier} />
            <input ref={documentInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={gererChoixDocument} />
            <button type="button" className={`publication-attachment-trigger ${menuPiecesOuvert ? "actif" : ""}`} onClick={() => setMenuPiecesOuvert(v => !v)} aria-expanded={menuPiecesOuvert} aria-label="Ajouter une pièce jointe">
              <i className="fa-solid fa-paperclip" /><span>Pièces jointes</span><i className={`fa-solid fa-chevron-${menuPiecesOuvert ? "up" : "down"}`} />
            </button>
            {menuPiecesOuvert && <div className="publication-attachment-menu" role="group" aria-label="Choisir le type de pièce jointe">
              <button type="button" onClick={() => imagesInputRef.current?.click()}><span className="publication-attachment-icon"><i className="fa-regular fa-image" /></span><strong>Images</strong><small>Jusqu'à 10 photos</small></button>
              <button type="button" onClick={() => videoInputRef.current?.click()}><span className="publication-attachment-icon"><i className="fa-solid fa-video" /></span><strong>Vidéo</strong><small>Jusqu'à 59 min</small></button>
              <button type="button" onClick={() => documentInputRef.current?.click()}><span className="publication-attachment-icon"><i className="fa-solid fa-file-lines" /></span><strong>Document</strong><small>PDF ou DOCX</small></button>
            </div>}
            {!documentFinal ? null : <div className="apercu-document publication-document-selected"><i className="fa-solid fa-file-lines" /><span>{documentFinal.name}</span><button type="button" onClick={retirerDocument} aria-label="Retirer le document"><i className="fa-solid fa-xmark" /></button></div>}
          </div>
          {documentFinal && <div className="publication-document-title">
            <label htmlFor="publication-document-title"><i className="fa-solid fa-heading" /> Titre du document</label>
            <input id="publication-document-title" value={documentTitre} onChange={event => setDocumentTitre(event.target.value)} maxLength={180} placeholder="Ex. : Correction du devoir de mathématiques" required />
            <small>Ce titre servira à retrouver le document dans la Bibliothèque. Le nom du fichier reste conservé séparément.</small>
          </div>}

          {categorie === "probleme" && !modeInstitutionnel && (
            <>
              <label><i className="fa-solid fa-stopwatch"></i> Date limite pour être aidé</label>
              <SelecteurDate valeur={dateLimite} onChange={setDateLimite} />
            </>
          )}

          <div className="rangee-boutons">
            <button type="button" className="bouton-retour" onClick={() => setFormulaireOuvert(false)}>
              Annuler
            </button>
            <button type="submit" disabled={envoiEnCours}>
              {uploadEnCours ? <><span className="grind-spinner" /> Envoi des fichiers… {progressionUpload}%</> : envoiEnCours ? <span className="grind-spinner" /> : "Publier"}
            </button>
          </div>

          {uploadEnCours && <div className="grind-upload-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressionUpload}><span style={{ width: `${progressionUpload}%` }} /></div>}
          {erreur && (
            <div className="erreur">
              <i className="fa-solid fa-triangle-exclamation"></i>
              {erreur}
            </div>
          )}
        </form>
      )}

      {chargement ? (
        <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>
      ) : posts.length === 0 ? (
        <EtatVide texte="Rien à voir pour l'instant" />
      ) : (
        posts.map((post) => (
          <CartePost
            key={post.id}
            post={post}
            sessionToken={sessionToken}
            monUsername={monUsername}
            onSupprime={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
            onClicAuteur={setProfilConsulte}
            onChange={() => charger()}
            modeInstitutionnel={modeInstitutionnel}
            etablissements={etablissements}
          />
        ))
      )}

      <button className={`bouton-flottant ${modeInstitutionnel ? "bouton-flottant-institution" : ""}`} onClick={() => setFormulaireOuvert(!formulaireOuvert)} type="button" aria-label="Nouvelle publication">
        <i className={formulaireOuvert ? "fa-solid fa-xmark" : "fa-solid fa-plus"}></i>
      </button>
    </div>
  );
}
