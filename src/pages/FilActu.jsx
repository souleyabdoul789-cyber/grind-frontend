import { useState, useEffect } from "react";
import { listerPosts, creerPost, uploaderMedia } from "../api.js";
import CartePost from "../components/CartePost.jsx";
import SelecteurDate from "../components/SelecteurDate.jsx";

const LIMITE_LEGENDE = 500;

export default function FilActu({ sessionToken, monUsername }) {
  const [posts, setPosts] = useState([]);
  const [filtre, setFiltre] = useState(null); // null = tout
  const [chargement, setChargement] = useState(true);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  const [categorie, setCategorie] = useState("demonstration");
  const [contenu, setContenu] = useState("");
  const [dateLimite, setDateLimite] = useState(null); // objet Date, plus une string de champ natif
  const [fichierMedia, setFichierMedia] = useState(null);
  const [apercuMedia, setApercuMedia] = useState(null);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function charger() {
    setChargement(true);
    const res = await listerPosts(filtre);
    setPosts(res.posts || []);
    setChargement(false);
  }

  useEffect(() => {
    charger();
  }, [filtre]);

  function gererChoixFichier(e) {
    const fichier = e.target.files[0];
    if (!fichier) return;
    setFichierMedia(fichier);
    setApercuMedia({ url: URL.createObjectURL(fichier), estVideo: fichier.type.startsWith("video/") });
  }

  function retirerMedia() {
    setFichierMedia(null);
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
      if (fichierMedia) {
        setUploadEnCours(true);
        media = await uploaderMedia(sessionToken, fichierMedia);
        setUploadEnCours(false);
      }

      const dateLimiteIso = categorie === "probleme" ? dateLimite.toISOString() : null;
      await creerPost(sessionToken, {
        categorie,
        contenu,
        date_limite: dateLimiteIso,
        media_url: media.media_url,
        media_type: media.media_type,
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

  return (
    <div className="fil-actu">
      <div className="filtres-fil">
        <button className={filtre === null ? "filtre-actif" : "filtre"} onClick={() => setFiltre(null)}>
          Tout
        </button>
        <button className={filtre === "probleme" ? "filtre-actif" : "filtre"} onClick={() => setFiltre("probleme")}>
          <i className="fa-solid fa-circle-question"></i> Problèmes
        </button>
        <button className={filtre === "demonstration" ? "filtre-actif" : "filtre"} onClick={() => setFiltre("demonstration")}>
          <i className="fa-solid fa-star"></i> Démonstrations
        </button>
      </div>

      {formulaireOuvert && (
        <form className="carte-post formulaire-post" onSubmit={gererCreation}>
          <div className="choix-categorie">
            <button
              type="button"
              className={categorie === "demonstration" ? "chip chip-actif" : "chip"}
              onClick={() => setCategorie("demonstration")}
            >
              <i className="fa-solid fa-star"></i> Démonstration
            </button>
            <button
              type="button"
              className={categorie === "probleme" ? "chip chip-actif" : "chip"}
              onClick={() => setCategorie("probleme")}
            >
              <i className="fa-solid fa-circle-question"></i> Problème
            </button>
          </div>

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
              {apercuMedia.estVideo ? (
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
              Ajouter une photo ou vidéo
              <input type="file" accept="image/*,video/*" onChange={gererChoixFichier} hidden />
            </label>
          )}

          {categorie === "probleme" && (
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
        <div className="info">Rien ici pour le moment.</div>
      ) : (
        posts.map((post) => (
          <CartePost key={post.id} post={post} sessionToken={sessionToken} monUsername={monUsername} />
        ))
      )}

      <button className="bouton-flottant" onClick={() => setFormulaireOuvert(!formulaireOuvert)} type="button">
        <i className={formulaireOuvert ? "fa-solid fa-xmark" : "fa-solid fa-plus"}></i>
      </button>
    </div>
  );
}
