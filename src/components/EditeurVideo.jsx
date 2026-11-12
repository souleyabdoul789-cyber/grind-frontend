import { useRef, useState, useEffect } from "react";

const DUREE_MAX = 59 * 60; // 59 minutes, aligné sur le serveur
const formatDuree = (secondes) => { const s = Math.max(0, Math.floor(secondes)); return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

export default function EditeurVideo({ fichier, onValider, onAnnuler }) {
  const videoRef = useRef(null);
  const [duree, setDuree] = useState(0);
  const [debut, setDebut] = useState(0);
  const [fin, setFin] = useState(0);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    const url = URL.createObjectURL(fichier);
    if (videoRef.current) videoRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [fichier]);

  function metadonneesChargees() {
    const d = videoRef.current.duration;
    setDuree(d);
    setFin(Math.min(d, DUREE_MAX));
  }

  function changerDebut(valeur) {
    const v = Math.min(Number(valeur), fin - 1);
    setDebut(Math.max(0, v));
    if (videoRef.current) videoRef.current.currentTime = v;
  }

  function changerFin(valeur) {
    const v = Math.max(Number(valeur), debut + 1);
    if (v - debut > DUREE_MAX) {
      setErreur(`Clip limité à ${formatDuree(DUREE_MAX)}`);
      setFin(debut + DUREE_MAX);
      return;
    }
    setErreur(null);
    setFin(Math.min(v, duree));
  }

  function valider() {
    onValider({ debut, fin });
  }

  return (
    <div className="editeur-media">
      <video ref={videoRef} onLoadedMetadata={metadonneesChargees} controls className="video-editeur" />

      {duree > 0 && (
        <>
          <label><i className="fa-solid fa-scissors"></i> Début : {formatDuree(debut)}</label>
          <input type="range" min="0" max={duree} step="0.1" value={debut} onChange={(e) => changerDebut(e.target.value)} />

          <label>Fin : {formatDuree(fin)}</label>
          <input type="range" min="0" max={duree} step="0.1" value={fin} onChange={(e) => changerFin(e.target.value)} />

          <div className="info"><i className="fa-solid fa-circle-info"></i> Durée du clip : {formatDuree(fin - debut)} · maximum 00:59:00</div>
          <div className="info"><i className="fa-solid fa-cloud-arrow-up"></i> Fichier vidéo : 300 Mo maximum. Les fichiers volumineux sont envoyés par segments.</div>
        </>
      )}

      {erreur && <div className="erreur"><i className="fa-solid fa-triangle-exclamation"></i>{erreur}</div>}

      <div className="rangee-boutons">
        <button type="button" className="bouton-retour" onClick={onAnnuler}>Annuler</button>
        <button type="button" onClick={valider} disabled={duree === 0}>Valider</button>
      </div>
    </div>
  );
}
