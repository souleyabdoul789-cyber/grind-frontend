import React from "react";

export default function EcranHorsLigne({ motif = "internet", verificationEnCours = false, onReessayer }) {
  const internetAbsent = motif === "internet";

  return (
    <main className="grind-hors-ligne" role="alert" aria-live="assertive">
      <section className="grind-hors-ligne-carte">
        <div className="grind-hors-ligne-marque" aria-label="GRIND">
          <span className="grind-hors-ligne-embleme">
            <img src="/icon-192.png" alt="" />
            <span className="grind-hors-ligne-wifi" aria-hidden="true">
              <svg viewBox="0 0 48 48" focusable="false">
                <path d="M7 17.5C16.5 9.8 31.5 9.8 41 17.5M13.5 25C20 19.8 28 19.8 34.5 25M20 32C22.4 30.1 25.6 30.1 28 32" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
                <path d="M8 7.5 40 40.5" fill="none" stroke="#0a0a0f" strokeWidth="8" strokeLinecap="round" />
                <path d="M8 7.5 40 40.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
              </svg>
            </span>
          </span>
          <span className="grind-hors-ligne-nom">GRIND</span>
        </div>

        <div className="grind-hors-ligne-message">
          <span className="grind-hors-ligne-surtitre">CONNEXION</span>
          <h1>{internetAbsent ? "Aucune connexion Internet" : "GRIND est momentanément injoignable"}</h1>
          <p>
            {internetAbsent
              ? "Ton appareil n’est pas connecté à Internet. Vérifie ton Wi-Fi ou tes données mobiles."
              : "Ton appareil détecte un réseau, mais le serveur GRIND ne répond pas. Vérifie l’accès Internet puis réessaie."}
          </p>
        </div>

        <button className="grind-hors-ligne-bouton" type="button" onClick={onReessayer} disabled={verificationEnCours}>
          {verificationEnCours ? <><span className="grind-hors-ligne-spinner" aria-hidden="true" /> Vérification…</> : "Réessayer"}
        </button>
        <p className="grind-hors-ligne-note">GRIND se reconnectera automatiquement dès que le service sera disponible.</p>
      </section>
    </main>
  );
}
