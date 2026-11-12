import { useEffect, useMemo, useState } from "react";
import { listerAnnonces } from "../api.js";
import { formaterDate } from "../moderationInfos.js";
import LecteurMedia from "./LecteurMedia.jsx";
import ModaleAnnonce from "./ModaleAnnonce.jsx";

const CLE_MASQUEES = "grind_annonces_masquees";

function lireMasquees() {
  try { return new Set((JSON.parse(localStorage.getItem(CLE_MASQUEES) || "[]") || []).map(Number)); }
  catch { return new Set(); }
}

export default function BandeauAnnonces({ sessionToken }) {
  const [annonces, setAnnonces] = useState([]);
  const [masquees, setMasquees] = useState(() => lireMasquees());
  const [selection, setSelection] = useState(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let actif = true;
    listerAnnonces(sessionToken)
      .then((res) => { if (actif) setAnnonces(res.annonces || []); })
      .catch(() => { if (actif) setErreur(true); });
    return () => { actif = false; };
  }, [sessionToken]);

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
    localStorage.setItem(CLE_MASQUEES, JSON.stringify([...prochaines]));
    window.dispatchEvent(new Event("grind-annonces-masquees"));
    if (selection && Number(selection.id) === Number(id)) setSelection(null);
  }

  if (erreur || visibles.length === 0) return null;

  return (
    <section className="bandeau-annonces" aria-label="Annonces officielles GRIND">
      <div className="bandeau-annonces-titre"><span><i className="fa-solid fa-bullhorn" /> Informations officielles</span><small>GRIND</small></div>
      {visibles.map((annonce) => (
        <article key={annonce.id} className={`carte-annonce-fil ${annonce.important ? "annonce-fil-importante" : ""}`}>
          <div className="carte-annonce-fil-entete">
            <span className="annonce-fil-auteur"><i className="fa-solid fa-circle-check" /> Compte officiel GRIND</span>
            <time>{formaterDate(annonce.created_at)}</time>
          </div>
          <div className="carte-annonce-fil-tags">
            {annonce.important && <span className="tag-annonce-important"><i className="fa-solid fa-circle-exclamation" /> Important</span>}
            {annonce.epinglee && <span><i className="fa-solid fa-thumbtack" /> Épinglé</span>}
          </div>
          <h3>{annonce.titre}</h3>
          {annonce.media_url && <LecteurMedia url={annonce.media_url} type={annonce.media_type} />}
          {!!annonce.contenu && <p>{annonce.contenu}</p>}
          {annonce.document_url && <a className="piece-jointe-document" href={annonce.document_url} target="_blank" rel="noopener noreferrer" download>
            <span className="icone-document"><i className="fa-solid fa-file-lines" /></span>
            <span><strong>{annonce.document_name || "Document officiel"}</strong><small>{annonce.document_type === "application/pdf" ? "PDF" : "DOCX"} · Ouvrir ou télécharger</small></span>
            <i className="fa-solid fa-download" />
          </a>}
          <div className="carte-annonce-fil-actions">
            <button type="button" onClick={() => setSelection(annonce)}><i className="fa-regular fa-eye" /> Voir l'annonce</button>
            {!annonce.important && <button type="button" className="annonce-fil-masquer" onClick={() => masquer(annonce.id)}>Masquer</button>}
          </div>
        </article>
      ))}
      {selection && <ModaleAnnonce annonce={selection} onFermer={() => setSelection(null)} onMasquer={masquer} />}
    </section>
  );
}
