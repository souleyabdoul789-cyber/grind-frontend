export default function PaysIndisponible({ pays = "votre pays", message, onAdmin }) {
  return <main className="country-stop" role="alert">
    <div className="country-stop-card">
      <div className="country-logo"><svg viewBox="0 0 100 100" role="img" aria-label="Emblème GRIND"><path d="M18 25 L50 8 L82 25 L50 42 Z" fill="#c9b6e4"/><path d="M28 30 L28 42 Q50 54 72 42 L72 30 L50 43 Z" fill="#d8bfa6"/><path d="M50 43 C33 43 21 55 21 70 C21 84 32 92 48 92 C63 92 75 82 75 66 L53 66 L53 78 L62 78 C59 83 54 85 48 85 C38 85 32 79 32 70 C32 60 39 54 50 54 C57 54 63 57 67 62 L78 55 C72 44 62 43 50 43 Z" fill="#c9b6e4"/></svg><strong>GRIND</strong></div>
      <div className="country-stop-copy"><span className="country-eyebrow">INFORMATION DE DISPONIBILITÉ</span><h1>GRIND est temporairement indisponible dans {pays}.</h1><p>{message || "Vous êtes peut-être en période de vacances. Pour éviter que le réseau ne devienne un espace de distraction, nous avons temporairement suspendu son accès dans votre pays. Veuillez nous excuser pour cette décision."}</p><small>Cette restriction est une décision de disponibilité régionale.</small>{onAdmin && <button type="button" className="country-admin-link" onClick={onAdmin}>Accès administration</button>}</div>
    </div>
  </main>;
}
