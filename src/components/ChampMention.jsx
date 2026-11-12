import { useEffect, useState } from "react";
import { rechercherMentions } from "../api.js";
import AvatarIcone from "./AvatarIcone.jsx";

export default function ChampMention({ sessionToken, value, onChange, placeholder, rows = 2, className = "" }) {
  const [terme, setTerme] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [actif, setActif] = useState(false);
  useEffect(() => {
    const correspondance = String(value || "").match(/(?:^|\s)@([A-Za-z_]{0,24})$/);
    if (!correspondance) { setTerme(null); setActif(false); setSuggestions([]); return; }
    const t = correspondance[1] || ""; setTerme(t); setActif(true);
    let vivant = true;
    const timer = window.setTimeout(() => rechercherMentions(sessionToken, t)
      .then(r => { if (vivant) setSuggestions(r.utilisateurs || []); })
      .catch(() => { if (vivant) setSuggestions([]); }), 140);
    return () => { vivant = false; window.clearTimeout(timer); };
  }, [value, sessionToken]);
  function choisir(username) {
    const texte = String(value || "");
    const index = texte.lastIndexOf("@");
    onChange(`${texte.slice(0, index)}@${username} `);
    setActif(false); setTerme(null); setSuggestions([]);
  }
  return <div className="mention-field-wrap">
    {actif && <div className="mention-suggestions" role="listbox" aria-label="Suggestions de comptes">
      {suggestions.length ? suggestions.map(user => <button type="button" key={user.username} role="option" onMouseDown={e => e.preventDefault()} onClick={() => choisir(user.username)}>
        <AvatarIcone username={user.username} taille={34} /><span><strong>{user.nom || user.username}</strong><small>@{user.username}</small></span><i className="fa-solid fa-plus" />
      </button>) : <div className="mention-empty">{terme ? "Aucun compte correspondant" : "Recherche des membres…"}</div>}
    </div>}
    <textarea className={className} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
  </div>;
}
