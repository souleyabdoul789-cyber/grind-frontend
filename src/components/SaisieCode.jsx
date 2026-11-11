import { useRef } from "react";

/**
 * SaisieCode — saisie d'un code à 7 chiffres.
 * Un seul vrai champ (clavier numérique, remplissage automatique du code reçu, collage) ;
 * les 7 cases ne sont que l'affichage. Quand les 7 chiffres sont saisis, `onComplet` est appelé.
 */
export default function SaisieCode({ valeur, onChange, onComplet, disabled = false, erreur = false, longueur = 7 }) {
  const ref = useRef(null);

  function changer(e) {
    const chiffres = e.target.value.replace(/\D/g, "").slice(0, longueur);
    onChange(chiffres);
    if (chiffres.length === longueur && onComplet) onComplet(chiffres);
  }

  return (
    <div
      className={`saisie-code ${erreur ? "saisie-code-erreur" : ""}`}
      onClick={() => ref.current && ref.current.focus()}
    >
      <input
        ref={ref}
        className="saisie-code-champ"
        value={valeur}
        onChange={changer}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={longueur + 3}
        aria-label={`Code de vérification à ${longueur} chiffres`}
        autoFocus
        disabled={disabled}
      />
      <div className="saisie-code-cases" aria-hidden="true">
        {Array.from({ length: longueur }).map((_, i) => (
          <span
            key={i}
            className={`saisie-code-case ${valeur[i] ? "saisie-code-case-pleine" : ""} ${
              i === valeur.length && !disabled ? "saisie-code-case-active" : ""
            }`}
          >
            {valeur[i] || ""}
          </span>
        ))}
      </div>
    </div>
  );
}
