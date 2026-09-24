import { useRef, useEffect, useState } from "react";

const TAILLE_CANVAS = 320;

export default function EditeurPhoto({ fichier, onValider, onAnnuler }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [pret, setPret] = useState(false);

  const [crop, setCrop] = useState({ x: 20, y: 20, taille: 200 });
  const [glisse, setGlisse] = useState(null); // "deplacer" | "redimensionner" | null

  const [texte, setTexte] = useState("");
  const [posTexte, setPosTexte] = useState({ x: 160, y: 280 });
  const [tailleTexte, setTailleTexte] = useState(22);
  const [glisseTexte, setGlisseTexte] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setPret(true);
    };
    img.src = URL.createObjectURL(fichier);
  }, [fichier]);

  useEffect(() => {
    if (!pret) return;
    dessiner();
  }, [pret, crop, texte, posTexte, tailleTexte]);

  function dessiner() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imageRef.current;

    ctx.clearRect(0, 0, TAILLE_CANVAS, TAILLE_CANVAS);

    // image centrée, contenue dans le canvas
    const ratio = Math.min(TAILLE_CANVAS / img.width, TAILLE_CANVAS / img.height);
    const w = img.width * ratio, h = img.height * ratio;
    const ox = (TAILLE_CANVAS - w) / 2, oy = (TAILLE_CANVAS - h) / 2;
    ctx.drawImage(img, ox, oy, w, h);

    // voile hors-crop
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, TAILLE_CANVAS, crop.y);
    ctx.fillRect(0, crop.y + crop.taille, TAILLE_CANVAS, TAILLE_CANVAS - crop.y - crop.taille);
    ctx.fillRect(0, crop.y, crop.x, crop.taille);
    ctx.fillRect(crop.x + crop.taille, crop.y, TAILLE_CANVAS - crop.x - crop.taille, crop.taille);

    // cadre de crop
    ctx.strokeStyle = "#c9b6e4";
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.taille, crop.taille);
    // poignée coin bas-droit
    ctx.fillStyle = "#c9b6e4";
    ctx.fillRect(crop.x + crop.taille - 10, crop.y + crop.taille - 10, 10, 10);

    if (texte) {
      ctx.font = `700 ${tailleTexte}px Inter, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 4;
      ctx.textAlign = "center";
      ctx.strokeText(texte, posTexte.x, posTexte.y);
      ctx.fillText(texte, posTexte.x, posTexte.y);
    }
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
    const coinX = crop.x + crop.taille, coinY = crop.y + crop.taille;
    if (Math.hypot(p.x - coinX, p.y - coinY) < 20) {
      setGlisse("redimensionner");
    } else if (texte && Math.hypot(p.x - posTexte.x, p.y - posTexte.y) < 30) {
      setGlisseTexte(true);
    } else if (p.x > crop.x && p.x < crop.x + crop.taille && p.y > crop.y && p.y < crop.y + crop.taille) {
      setGlisse("deplacer");
    }
  }

  function pendantGlisse(e) {
    if (!glisse && !glisseTexte) return;
    e.preventDefault();
    const p = positionPointeur(e);

    if (glisseTexte) {
      setPosTexte({ x: Math.max(0, Math.min(TAILLE_CANVAS, p.x)), y: Math.max(0, Math.min(TAILLE_CANVAS, p.y)) });
      return;
    }

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
    setGlisseTexte(false);
  }

  function valider() {
    const img = imageRef.current;
    const ratio = Math.min(TAILLE_CANVAS / img.width, TAILLE_CANVAS / img.height);
    const ox = (TAILLE_CANVAS - img.width * ratio) / 2;
    const oy = (TAILLE_CANVAS - img.height * ratio) / 2;

    // coordonnées du crop dans l'image source réelle
    const sx = (crop.x - ox) / ratio;
    const sy = (crop.y - oy) / ratio;
    const sTaille = crop.taille / ratio;

    const sortie = document.createElement("canvas");
    sortie.width = 800;
    sortie.height = 800;
    const ctx = sortie.getContext("2d");
    ctx.drawImage(img, sx, sy, sTaille, sTaille, 0, 0, 800, 800);

    if (texte) {
      const echelleTexte = 800 / TAILLE_CANVAS;
      ctx.font = `700 ${tailleTexte * echelleTexte}px Inter, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 5;
      ctx.textAlign = "center";
      const tx = ((posTexte.x - crop.x) / crop.taille) * 800;
      const ty = ((posTexte.y - crop.y) / crop.taille) * 800;
      ctx.strokeText(texte, tx, ty);
      ctx.fillText(texte, tx, ty);
    }

    sortie.toBlob((blob) => onValider(blob), "image/jpeg", 0.9);
  }

  return (
    <div className="editeur-media">
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

      <label><i className="fa-solid fa-font"></i> Texte sur l'image</label>
      <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="optionnel" maxLength={40} />

      {texte && (
        <>
          <label>Taille du texte</label>
          <input
            type="range"
            min="12"
            max="48"
            value={tailleTexte}
            onChange={(e) => setTailleTexte(Number(e.target.value))}
          />
        </>
      )}

      <div className="rangee-boutons">
        <button type="button" className="bouton-retour" onClick={onAnnuler}>Annuler</button>
        <button type="button" onClick={valider}>Valider</button>
      </div>
    </div>
  );
}
