import { useRef, useEffect, useState } from "react";

const TAILLE_CANVAS = 320;

export default function EditeurPhoto({ fichier, onValider, onAnnuler }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState("");
  const [crop, setCrop] = useState({ x: 20, y: 20, taille: 200 });
  const [glisse, setGlisse] = useState(null);

  useEffect(() => {
    let actif = true;
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      if (!actif) return;
      imageRef.current = img;
      setErreur("");
      setPret(true);
    };
    img.onerror = () => {
      if (actif) setErreur("Cette image ne peut pas être ouverte. Essaie un fichier JPG, PNG ou WebP.");
    };
    img.src = url;
    return () => {
      actif = false;
      URL.revokeObjectURL(url);
    };
  }, [fichier]);

  useEffect(() => {
    if (!pret || !imageRef.current || !canvasRef.current) return;
    dessiner();
  }, [pret, crop]);

  function dessiner() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imageRef.current;
    if (!ctx || !img) return;

    ctx.clearRect(0, 0, TAILLE_CANVAS, TAILLE_CANVAS);
    const ratio = Math.max(TAILLE_CANVAS / img.width, TAILLE_CANVAS / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const ox = (TAILLE_CANVAS - w) / 2;
    const oy = (TAILLE_CANVAS - h) / 2;
    ctx.drawImage(img, ox, oy, w, h);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, TAILLE_CANVAS, crop.y);
    ctx.fillRect(0, crop.y + crop.taille, TAILLE_CANVAS, TAILLE_CANVAS - crop.y - crop.taille);
    ctx.fillRect(0, crop.y, crop.x, crop.taille);
    ctx.fillRect(crop.x + crop.taille, crop.y, TAILLE_CANVAS - crop.x - crop.taille, crop.taille);

    ctx.strokeStyle = "#c9b6e4";
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.taille, crop.taille);
    ctx.fillStyle = "#c9b6e4";
    ctx.fillRect(crop.x + crop.taille - 10, crop.y + crop.taille - 10, 10, 10);
  }

  function positionPointeur(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: ((point.clientX - rect.left) / rect.width) * TAILLE_CANVAS,
      y: ((point.clientY - rect.top) / rect.height) * TAILLE_CANVAS,
    };
  }

  function debutGlisse(e) {
    const p = positionPointeur(e);
    const coinX = crop.x + crop.taille;
    const coinY = crop.y + crop.taille;
    if (Math.hypot(p.x - coinX, p.y - coinY) < 20) {
      setGlisse("redimensionner");
    } else if (p.x > crop.x && p.x < crop.x + crop.taille && p.y > crop.y && p.y < crop.y + crop.taille) {
      setGlisse("deplacer");
    }
  }

  function pendantGlisse(e) {
    if (!glisse) return;
    e.preventDefault();
    const p = positionPointeur(e);
    if (glisse === "redimensionner") {
      const nouvelleTaille = Math.max(40, Math.min(p.x - crop.x, p.y - crop.y, TAILLE_CANVAS - crop.x, TAILLE_CANVAS - crop.y));
      setCrop((c) => ({ ...c, taille: nouvelleTaille }));
    } else if (glisse === "deplacer") {
      const nx = Math.max(0, Math.min(p.x - crop.taille / 2, TAILLE_CANVAS - crop.taille));
      const ny = Math.max(0, Math.min(p.y - crop.taille / 2, TAILLE_CANVAS - crop.taille));
      setCrop((c) => ({ ...c, x: nx, y: ny }));
    }
  }

  function finGlisse() {
    setGlisse(null);
  }

  function valider() {
    const img = imageRef.current;
    if (!img) return;
    const ratio = Math.max(TAILLE_CANVAS / img.width, TAILLE_CANVAS / img.height);
    const ox = (TAILLE_CANVAS - img.width * ratio) / 2;
    const oy = (TAILLE_CANVAS - img.height * ratio) / 2;
    const sx = Math.max(0, (crop.x - ox) / ratio);
    const sy = Math.max(0, (crop.y - oy) / ratio);
    const sTaille = Math.min(crop.taille / ratio, img.width - sx, img.height - sy);
    if (!Number.isFinite(sTaille) || sTaille <= 0) {
      setErreur("Impossible de préparer cette image. Ajuste le cadrage puis réessaie.");
      return;
    }

    const sortie = document.createElement("canvas");
    sortie.width = 800;
    sortie.height = 800;
    const ctx = sortie.getContext("2d");
    if (!ctx) {
      setErreur("Impossible de préparer cette image sur cet appareil.");
      return;
    }
    ctx.drawImage(img, sx, sy, sTaille, sTaille, 0, 0, 800, 800);
    sortie.toBlob((blob) => {
      if (blob) onValider(blob);
      else setErreur("La préparation de l'image a échoué. Réessaie avec une autre image.");
    }, "image/jpeg", 0.9);
  }

  return (
    <div className="editeur-media">
      {pret ? (
        <canvas
          ref={canvasRef}
          width={TAILLE_CANVAS}
          height={TAILLE_CANVAS}
          className="canvas-editeur"
          onMouseDown={debutGlisse}
          onMouseMove={pendantGlisse}
          onMouseUp={finGlisse}
          onMouseLeave={finGlisse}
          onTouchStart={debutGlisse}
          onTouchMove={pendantGlisse}
          onTouchEnd={finGlisse}
        />
      ) : !erreur ? <div className="info">Préparation de l'image…</div> : null}
      {erreur && <div className="erreur" role="alert">{erreur}</div>}
      <div className="rangee-boutons">
        <button type="button" className="bouton-retour" onClick={onAnnuler}>Annuler</button>
        <button type="button" onClick={valider} disabled={!pret}>Valider</button>
      </div>
    </div>
  );
}
