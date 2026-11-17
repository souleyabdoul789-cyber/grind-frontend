import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function ConfirmModal({ message, texteConfirmer = "Confirmer", onConfirmer, onAnnuler }) {
  const boutonAnnuler = useRef(null);

  useEffect(() => {
    boutonAnnuler.current?.focus();
    function fermerAvecEchap(event) {
      if (event.key === "Escape") onAnnuler?.();
    }
    document.addEventListener("keydown", fermerAvecEchap);
    return () => document.removeEventListener("keydown", fermerAvecEchap);
  }, [onAnnuler]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="voile-modal confirmation-administration-voile" onClick={onAnnuler}>
      <section className="carte-modal confirmation-administration" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-administration-titre" aria-describedby="confirmation-administration-message" onClick={(e) => e.stopPropagation()}>
        <div className="confirmation-administration-icone"><i className="fa-solid fa-triangle-exclamation" /></div>
        <div className="confirmation-administration-contenu">
          <span className="confirmation-administration-surtitre">VALIDATION REQUISE</span>
          <h2 id="confirmation-administration-titre">Confirmer cette action ?</h2>
          <p id="confirmation-administration-message">{message}</p>
        </div>
        <div className="rangee-boutons confirmation-administration-actions">
          <button ref={boutonAnnuler} type="button" className="bouton-retour" onClick={onAnnuler}>Annuler</button>
          <button type="button" className="bouton-danger-plein" onClick={onConfirmer}>{texteConfirmer}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
