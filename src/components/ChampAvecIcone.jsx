import { useState } from "react";

/**
 * ChampAvecIcone — un champ de saisie avec son icône (compte, e-mail, mot de passe, clé...).
 * Avec `bascule`, un bouton œil affiche ou masque le mot de passe.
 */
export default function ChampAvecIcone({
  icone, valeur, onChange, placeholder, type = "text", name, autoComplete, maxLength, inputMode,
  autoFocus = false, disabled = false, bascule = false, erreur = false, ariaLabel,
}) {
  const [visible, setVisible] = useState(false);
  const typeReel = bascule ? (visible ? "text" : "password") : type;

  return (
    <div className={`champ-icone ${erreur ? "champ-icone-erreur" : ""}`}>
      <i className={`${icone} champ-icone-pictogramme`} aria-hidden="true"></i>
      <input
        name={name}
        type={typeReel}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        inputMode={inputMode}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        autoCapitalize="none"
        spellCheck={false}
      />
      {bascule && (
        <button
          type="button"
          className="champ-icone-oeil"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          tabIndex={-1}
        >
          <i className={visible ? "fa-regular fa-eye-slash" : "fa-regular fa-eye"}></i>
        </button>
      )}
    </div>
  );
}
