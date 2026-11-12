import { useState, useEffect } from "react";
import { listerPosts, creerPost, uploaderMedia, uploaderDocument } from "../api.js";
import CartePost from "../components/CartePost.jsx";
import SelecteurDate from "../components/SelecteurDate.jsx";
import EditeurPhoto from "../components/EditeurPhoto.jsx";
import EditeurVideo from "../components/EditeurVideo.jsx";
import EtatVide from "../components/EtatVide.jsx";
import ProfilPublic from "../components/ProfilPublic.jsx";
import BandeauAnnonces from "../components/BandeauAnnonces.jsx";

const LIMITE_LEGENDE = 500;

export default function FilActu({ sessionToken, monUsername, modeInstitutionnel = false, etablissements = [] }) {
  const [profilConsulte, setProfilConsulte] = useState(null);
  const [posts, setPosts] = useState([]);
  const [filtre, setFiltre] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  const [categorie, setCategorie] = useState("demonstration");
  const [contenu, setContenu] = useState("");
  const [dateLimite, setDateLimite] = useState(null);

  const [fichierBrut, setFichierBrut] = useState(null);
  const [editeurOuvert, setEditeurOuvert] = useState(null); // "photo" | "video" | null
  const [fichierFinal, setFichierFinal] = useState(null); // Blob (photo) ou File original (video)
  const [documentFinal, setDocumentFinal] = useState(null);
  const [etablissementChoisi, setEtablissementChoisi] = useState("");
  const [decoupeVideo, setDecoupeVideo] = useState(null);
  const [apercuMedia, setApercuMedia] = useState(null);

  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    const url = apercuMedia?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [apercuMedia?.url]);

  async function charger() {
    setChargement(true);
    const res = await listerPosts(filtre, sessionToken);
    setPosts(res.posts || []);
    setChargement(false);
  }

  useEffect(() => {
    charger();
  }, [filtre]);

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
    const fichier = e.target.files[0];
    if (!fichier) return;
    setFichierBrut(fichier);
    if (fichier.type.startsWith("video/")) setEditeurOuvert("video");
    else if (fichier.type.startsWith("image/")) setEditeurOuvert("photo");
    else if (["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(fichier.type) ||
      ((fichier.type === "" || fichier.type === "application/octet-stream") && /\.(pdf|docx)$/i.test(fichier.name))) {
      setDocumentFinal(fichier);
      setFichierFinal(null);
      setApercuMedia({ estDocument: true, nom: fichier.name });
    } else {
      setFichierBrut(null);
      setDocumentFinal(null);
      setFichierFinal(null);
      setApercuMedia(null);
      setErreur("Format non accepté. Choisis une image, une vidéo, un PDF ou un DOCX.");
    }
  }

  function validerEditionPhoto(blob) {
    setFichierFinal(blob);
    setDocumentFinal(null);
    setApercuMedia({ url: URL.createObjectURL(blob), estVideo: false });
    setEditeurOuvert(null);
  }

  function validerEditionVideo({ debut, fin }) {
    setFichierFinal(fichierBrut);
    setDocumentFinal(null);
    setDecoupeVideo({ debut, fin });
    setApercuMedia({ url: URL.createObjectURL(fichierBrut), estVideo: true });
    setEditeurOuvert(null);
  }

  function annulerEdition() {
    setFichierBrut(null);
    setEditeurOuvert(null);
  }

  function retirerMedia() {
    setFichierBrut(null);
    setFichierFinal(null);
    setDocumentFinal(null);
    setDecoupeVideo(null);
    setApercuMedia(null);
  }

  async function gererCreation(e) {
    e.preventDefault();
    setErreur(null);

    if (categorie === "probleme" && !dateLimite) {
      setErreur("Indique une date limite pour ce problème");
      return;
    }

    setEnvoiEnCours(true);
    try {
      let media = {};
      let document = {};
      if (fichierFinal) {
        setUploadEnCours(true);
        media = await uploaderMedia(sessionToken, fichierFinal, decoupeVideo);
      } else if (documentFinal) {
        setUploadEnCours(true);
        document = await uploaderDocument(sessionToken, documentFinal);
      }
      setUploadEnCours(false);

      const dateLimiteIso = categorie === "probleme" ? dateLimite.toISOString() : null;
      await creerPost(sessionToken, {
        categorie, contenu, date_limite: dateLimiteIso,
        media_url: media.media_url, media_type: media.media_type,
        document_url: document.document_url, document_name: document.document_name,
        document_type: document.document_type,
        etablissement_id: modeInstitutionnel && etablissementChoisi ? Number(etablissementChoisi) : undefined,
      });

      setContenu("");
      setDateLimite(null);
      retirerMedia();
      setFormulaireOuvert(false);
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
      setUploadEnCours(false);
    }
  }

  if (profilConsulte) {
    return <ProfilPublic username={profilConsulte} onRetour={() => setProfilConsulte(null)} sessionToken={sessionToken} monUsername={monUsername} />;
  }

  return (
    <div className="fil-actu">
      <BandeauAnnonces sessionToken={sessionToken} />
      <div className="filtres-fil">
        <button className={filtre === null ? "filtre-actif" : "filtre"} onClick={() => setFiltre(null)}>
          Tout
        </button>
        <button
          className={filtre === "probleme" ? "filtre-actif" : "filtre"}
          onClick={() => setFiltre("probleme")}
          title="Problèmes"
          aria-label="Problèmes"
        >
          <i className="fa-solid fa-circle-question"></i> Prob
        </button>
        <button
          className={filtre === "demonstration" ? "filtre-actif" : "filtre"}
          onClick={() => setFiltre("demonstration")}
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
              onClick={() => setCategorie("demonstration")}
            >
              <i className="fa-solid fa-star"></i> Démonstration
            </button>
            {!modeInstitutionnel && <button
              type="button"
              className={categorie === "probleme" ? "chip chip-actif" : "chip"}
              onClick={() => setCategorie("probleme")}
            >
              <i className="fa-solid fa-circle-question"></i> Problème
            </button>}
          </div>

          {modeInstitutionnel && etablissements.length > 1 && <label className="select-etablissement-post">Publier dans <select value={etablissementChoisi} onChange={(e) => setEtablissementChoisi(e.target.value)} required><option value="">Choisir un établissement</option>{etablissements.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}</select></label>}
          <textarea
            rows={3}
            maxLength={LIMITE_LEGENDE}
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder={categorie === "probleme" ? "Décris ce que tu n'arrives pas à résoudre..." : "Partage quelque chose..."}
            required
          />
          <div className="compteur-caracteres">{contenu.length} / {LIMITE_LEGENDE}</div>

          {apercuMedia ? (
            <div className="apercu-media-form">
              {apercuMedia.estDocument ? (
                <div className="apercu-document"><i className="fa-solid fa-file-lines"></i><span>{apercuMedia.nom}</span></div>
              ) : apercuMedia.estVideo ? (
                <video src={apercuMedia.url} muted playsInline />
              ) : (
                <img src={apercuMedia.url} alt="" />
              )}
              <button type="button" className="bouton-retirer-media" onClick={retirerMedia}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ) : (
            <label className="bouton-ajouter-media">
              <i className="fa-solid fa-paperclip"></i>
              Ajouter un média ou document
              <input type="file" accept="image/*,video/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={gererChoixFichier} hidden />
            </label>
          )}

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
              {uploadEnCours ? "Envoi du média..." : envoiEnCours ? "..." : "Publier"}
            </button>
          </div>

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
