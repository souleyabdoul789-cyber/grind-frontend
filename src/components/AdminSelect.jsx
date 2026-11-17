import { useEffect, useRef, useState } from "react";

export default function AdminSelect({ value, onChange, options, ariaLabel = "Sélectionner une option" }) {
  const [ouvert, setOuvert] = useState(false);
  const [index, setIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const racine = useRef(null);
  const courant = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!ouvert) return undefined;
    function clicExterieur(event) {
      if (!racine.current?.contains(event.target)) setOuvert(false);
    }
    document.addEventListener("pointerdown", clicExterieur);
    return () => document.removeEventListener("pointerdown", clicExterieur);
  }, [ouvert]);

  function gererClavier(event) {
    if (event.key === "Escape" && ouvert) {
      event.preventDefault();
      event.stopPropagation();
      setOuvert(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (!ouvert) {
        setIndex(Math.max(0, options.findIndex((option) => option.value === value)));
        setOuvert(true);
      } else {
        const pas = event.key === "ArrowDown" ? 1 : -1;
        setIndex((courantIndex) => (courantIndex + pas + options.length) % options.length);
      }
      return;
    }
    if (event.key === "Enter" && ouvert && options[index]) {
      event.preventDefault();
      event.stopPropagation();
      onChange(options[index].value);
      setOuvert(false);
    }
  }

  return (
    <div className="admin-select" ref={racine} onKeyDown={gererClavier}>
      <button type="button" className="admin-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={ouvert} onClick={() => { setIndex(Math.max(0, options.findIndex((option) => option.value === value))); setOuvert((v) => !v); }}>
        <span>{courant?.label || "Choisir"}</span>
        <i className={`fa-solid fa-chevron-${ouvert ? "up" : "down"}`} aria-hidden="true" />
      </button>
      {ouvert && (
        <div className="admin-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option, i) => (
            <button key={option.value} type="button" role="option" tabIndex={-1} aria-selected={option.value === value} className={`admin-select-option ${option.value === value ? "active" : ""} ${i === index ? "focused" : ""}`} onMouseEnter={() => setIndex(i)} onClick={() => { onChange(option.value); setOuvert(false); }}>
              <span>{option.label}</span>
              {option.value === value && <i className="fa-solid fa-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
