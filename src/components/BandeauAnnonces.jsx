import { useEffect, useMemo, useRef, useState } from "react";
import { listerAnnonces } from "../api.js";
import { formaterDate } from "../moderationInfos.js";
import BadgeCompte from "./BadgeCompte.jsx";
import LecteurMedia from "./LecteurMedia.jsx";
import ModaleAnnonce from "./ModaleAnnonce.jsx";

const CLE_MASQUEES = "grind_annonces_masquees";

function lireMasquees() {
  try {
    const valeur = JSON.parse(localStorage.getItem(CLE_MASQUEES) || "[]");
    return new Set((Array.isArray(valeur) ? valeur : []).map(Number));
  } catch {
    return new Set();
  }
}

function libelleAuteur(role) {
  if (role === "annonceur") return "Annonceur habilité";
  if (role === "associe") return "Associé GRIND";
  return "Équipe GRIND";
}

export default function BandeauAnnonces({ sessionToken }) {
  const [annonces, setAnnonces] = useState([]);
  const [masquees, setMasquees] = useState(() => lireMasquees());
  const [selection, setSelection] = useState(null);
  const [erreur, setErreur] = useState(false);
  const annonceDejaChargee = useRef(false);

  // Chargement initial + actualisation après une annonce WebSocket et au retour
  // dans l'application. L'identifiant de l'annonce reste la source côté serveur.
  useEffect(() => {
    let actif = true;
    let requeteEnCours = false;
    let actualisationEnAttente = false;

    async function charger() {
      if (requeteEnCours) {
        actualisationEnAttente = true;
        return;
      }

      do {
        actualisationEnAttente = false;
        requeteEnCours = true;
        try {
          const res = await listerAnnonces(sessionToken);
          if (!actif) return;
          const liste = Array.isArray(res?.annonces) ? res.annonces : [];
          setAnnonces(liste);
          annonceDejaChargee.current = true;
          setErreur(false);
          setSelection((actuelle) => actuelle ? liste.find((a) => Number(a.id) === Number(actuelle.id)) || null : null);
        } catch {
          if (actif && !annonceDejaChargee.current) setErreur(true);
        } finally {
          requeteEnCours = false;
        }
      } while (actif && actualisationEnAttente);
    }

    const actualiser = () => { void charger(); };
    const retourVisible = () => {
      if (document.visibilityState === "visible") actualiser();
    };

    actualiser();
    window.addEventListener("grind-annonce-publiee", actualiser);
    document.addEventListener("visibilitychange", retourVisible);

    return () => {
      actif = false;
      window.removeEventListener("grind-annonce-publiee", actualiser);
      document.removeEventListener("visibilitychange", retourVisible);
    };
  }, [sessionToken]);

  // Le classement existant est conservé : important, puis épinglé, puis plus récent.
  const visibles = useMemo(() => annonces
    .filter((a) => a.important || !masquees.has(Number(a.id)))
    .sort((a, b) => Number(!!b.important) - Number(!!a.important) || Number(!!b.epinglee) - Number(!!a.epinglee) || Number(b.id) - Number(a.id))
    .slice(0, 3), [annonces, masquees]);

  function masquer(id) {
    const annonce = annonces.find((a) => Number(a.id) === Number(id));
    if (!annonce || annonce.important) return;
    const prochaines = new Set(masquees);
    prochaines.add(Number(id));
    setMasquees(prochaines);
    try { localStorage.setItem(CLE_MASQUEES, JSON.stringify([...prochaines])); } catch {}
    window.dispatchEvent(new Event("grind-annonces-masquees"));
    if (selection && Number(selection.id) === Number(id)) setSelection(null);
  }

  if (erreur || visibles.length === 0) return null;

  return (
    <section className="bandeau-annonces grind-annonces-section" aria-label="Annonces GRIND">
      <div className="bandeau-annonces-titre grind-annonces-heading">
        <div className="grind-annonces-identite">
          <span className="grind-annonce-brand" aria-label="GRIND">
            <span className="grind-annonce-brand-g" aria-hidden="true">G</span>
            <strong>GRIND</strong>
          </span>
          <span className="grind-annonce-verifie" role="img" aria-label="Compte GRIND vérifié" title="Compte GRIND vérifié">
            <i className="fa-solid fa-check" aria-hidden="true" />
          </span>
        </div>
        <span className="grind-annonces-heading-tag">À LA UNE</span>
      </div>

      <div className="grind-annonces-liste">
        {visibles.map((annonce) => (
          <article key={annonce.id} className={`carte-annonce-fil grind-annonce-card ${annonce.important ? "annonce-fil-importante" : ""}`}>
            <div className="carte-annonce-fil-entete grind-annonce-card-head">
              <span className="annonce-fil-auteur grind-annonce-author">
                <span className="grind-annonce-author-icon" aria-hidden="true"><i className="fa-solid fa-bullhorn" /></span>
                <span className="grind-annonce-author-text">
                  <strong>{annonce.auteur || "GRIND"}</strong>
                  <small>{libelleAuteur(annonce.role)}</small>
                </span>
                <BadgeCompte badge={{ role: annonce.role || "admin" }} taille={14} />
              </span>
              <time>{formaterDate(annonce.created_at)}</time>
            </div>

            {(annonce.important || annonce.epinglee) && (
              <div className="carte-annonce-fil-tags grind-annonce-tags">
                {annonce.important && <span className="tag-annonce-important"><i className="fa-solid fa-circle-exclamation" /> Important</span>}
                {annonce.epinglee && <span className="grind-annonce-pin"><i className="fa-solid fa-thumbtack" /> Épinglé</span>}
              </div>
            )}

            <button type="button" className="grind-annonce-open" onClick={() => setSelection(annonce)} aria-label={`Lire l'annonce : ${annonce.titre}`}>
              <span className="grind-annonce-title">{annonce.titre}</span>
              {!!annonce.contenu && <span className="grind-annonce-extrait">{annonce.contenu}</span>}
            </button>
            {annonce.media_url && <div className="grind-annonce-media-preview"><LecteurMedia url={annonce.media_url} type={annonce.media_type} /></div>}
            {annonce.document_url && (
              <a className="piece-jointe-document grind-annonce-document" href={annonce.document_url} target="_blank" rel="noopener noreferrer" download>
                <span className="icone-document"><i className="fa-solid fa-file-lines" /></span>
                <span><strong>{annonce.document_name || "Document GRIND"}</strong><small>{annonce.document_type === "application/pdf" ? "PDF" : "DOCX"} · Ouvrir ou télécharger</small></span>
                <i className="fa-solid fa-arrow-up-right-from-square" />
              </a>
            )}

            <div className="carte-annonce-fil-actions grind-annonce-actions">
              <button type="button" onClick={() => setSelection(annonce)}><i className="fa-regular fa-eye" /> Lire l'annonce</button>
              {!annonce.important && <button type="button" className="annonce-fil-masquer" onClick={() => masquer(annonce.id)}>Masquer</button>}
            </div>
          </article>
        ))}
      </div>

      {selection && <ModaleAnnonce annonce={selection} onFermer={() => setSelection(null)} onMasquer={masquer} />}
    </section>
  );
}
