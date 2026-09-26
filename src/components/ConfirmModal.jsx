export default function ConfirmModal({ message, texteConfirmer = "Supprimer", onConfirmer, onAnnuler }) {
  return (
    <div className="voile-modal" onClick={onAnnuler}>
      <div className="carte-modal" onClick={(e) => e.stopPropagation()}>
        <div className="message-modal">
          <i className="fa-solid fa-triangle-exclamation"></i>
          {message}
        </div>
        <div className="rangee-boutons">
          <button type="button" className="bouton-retour" onClick={onAnnuler}>Annuler</button>
          <button type="button" className="bouton-danger-plein" onClick={onConfirmer}>{texteConfirmer}</button>
        </div>
      </div>
    </div>
  );
}
