import { useState } from "react";
import { terminerBienvenue } from "../api.js";

function LogoGrind({ grand = false }) {
  return <div className={grand ? "welcome-logo grand" : "welcome-logo"}>
    <svg viewBox="0 0 100 100" role="img" aria-label="Emblème GRIND">
      <path d="M18 25 L50 8 L82 25 L50 42 Z" fill="#b28b68" />
      <path d="M28 30 L28 42 Q50 54 72 42 L72 30 L50 43 Z" fill="#d9c7b2" />
      <path d="M50 43 C33 43 21 55 21 70 C21 84 32 92 48 92 C63 92 75 82 75 66 L53 66 L53 78 L62 78 C59 83 54 85 48 85 C38 85 32 79 32 70 C32 60 39 54 50 54 C57 54 63 57 67 62 L78 55 C72 44 62 43 50 43 Z" fill="#b28b68" />
      <path d="M81 24 L88 24 L88 48 L82 48 L82 32 Z" fill="#8f6b4f" />
      <circle cx="88" cy="53" r="5" fill="#8f6b4f" />
    </svg>
    <strong>GRIND</strong>
  </div>;
}

function DrapeauNiger() {
  return <svg className="welcome-flag" viewBox="0 0 90 60" role="img" aria-label="Drapeau du Niger"><rect width="90" height="20" fill="#e87932"/><rect y="20" width="90" height="20" fill="#fff"/><rect y="40" width="90" height="20" fill="#159447"/><circle cx="45" cy="30" r="8" fill="#e87932"/></svg>;
}

function IllustrationEtude() {
  return <svg className="welcome-scene" viewBox="0 0 640 420" role="img" aria-label="Deux élèves étudient ensemble avec GRIND">
    <defs><linearGradient id="welcomeShirt" x1="0" x2="1"><stop stopColor="#ad8968"/><stop offset="1" stopColor="#806048"/></linearGradient><linearGradient id="welcomeBook" x1="0" x2="1"><stop stopColor="#e6d9c8"/><stop offset="1" stopColor="#c4ad96"/></linearGradient></defs>
    <rect x="20" y="18" width="600" height="380" rx="32" fill="#eee5d9"/><circle cx="90" cy="84" r="34" fill="#e3d2bf"/><circle cx="560" cy="75" r="28" fill="#e3d2bf"/>
    <rect x="72" y="282" width="496" height="22" rx="11" fill="#8f6b4f"/><path d="M110 304 L530 304 L510 370 L132 370 Z" fill="#9f7959"/>
    <rect x="128" y="265" width="148" height="19" rx="5" fill="url(#welcomeBook)"/><path d="M134 260 L270 260 L276 268 L128 268 Z" fill="#faf7f2"/>
    <rect x="380" y="266" width="130" height="18" rx="5" fill="#e9dfd3"/><path d="M386 260 L505 260 L510 268 L380 268 Z" fill="#fff"/>
    {/* garçon */}
    <path d="M118 280 Q112 205 153 164 Q181 140 215 166 Q250 190 247 280 Z" fill="url(#welcomeShirt)"/><ellipse cx="184" cy="139" rx="48" ry="58" fill="#683f2b"/>
    <path d="M137 115 Q132 61 181 61 Q226 60 230 114 Q204 91 182 92 Q158 96 137 115" fill="#211a16"/><circle cx="166" cy="137" r="4" fill="#241713"/><circle cx="202" cy="137" r="4" fill="#241713"/><path d="M170 158 Q184 173 202 158" fill="none" stroke="#f1c2a0" strokeWidth="5" strokeLinecap="round"/>
    <path d="M157 212 L181 229 L204 212" fill="none" stroke="#e7d7c7" strokeWidth="6"/><path d="M177 224 L184 239 L191 224" fill="#e7d7c7"/><text x="182" y="253" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">G</text>
    {/* fille légèrement en retrait */}
    <path d="M343 280 Q338 202 384 164 Q418 135 455 167 Q491 202 486 280 Z" fill="#9b775c"/><ellipse cx="416" cy="137" rx="48" ry="56" fill="#744831"/>
    <path d="M370 127 Q358 55 417 55 Q479 60 465 143 Q452 103 419 96 Q390 96 370 127" fill="#211a16"/><path d="M377 79 Q339 126 365 186 M456 78 Q490 127 470 184" fill="none" stroke="#211a16" strokeWidth="12" strokeLinecap="round"/><circle cx="399" cy="139" r="4" fill="#241713"/><circle cx="435" cy="139" r="4" fill="#241713"/><path d="M401 159 Q416 171 434 159" fill="none" stroke="#f1c2a0" strokeWidth="5" strokeLinecap="round"/><text x="416" y="251" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">G</text>
    {/* téléphone GRIND */}
    <g transform="rotate(-7 320 224)"><rect x="280" y="154" width="82" height="124" rx="14" fill="#2b2925"/><rect x="286" y="162" width="70" height="107" rx="8" fill="#f5efe7"/><rect x="292" y="171" width="58" height="22" rx="6" fill="#b28b68"/><text x="321" y="186" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">GRIND</text><rect x="293" y="200" width="56" height="7" rx="3" fill="#c5ad95"/><rect x="293" y="213" width="48" height="7" rx="3" fill="#dfd2c3"/><rect x="293" y="229" width="55" height="28" rx="6" fill="#e8dfd4"/><path d="M300 249 L309 239 L318 245 L329 233 L340 245" fill="none" stroke="#8f6b4f" strokeWidth="2"/></g>
    <path d="M236 214 Q260 210 284 228 M351 232 Q372 208 394 218" fill="none" stroke="#683f2b" strokeWidth="16" strokeLinecap="round"/>
  </svg>;
}

export default function BienvenueGrind({ sessionToken, onTermine }) {
  const [etape, setEtape] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  async function terminer() {
    setEnvoi(true); setErreur("");
    try { await terminerBienvenue(sessionToken); onTermine?.(); }
    catch (e) { setErreur(e.message || "Impossible d'enregistrer cette étape."); setEnvoi(false); }
  }
  return <div className="welcome-backdrop"><section className="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <div className="welcome-topline"><span>GRIND · APPRENDRE ENSEMBLE</span><span>{etape + 1} / 3</span></div>
    {etape === 0 ? <div className="welcome-intro">
      <aside className="welcome-brand-side"><LogoGrind grand /><p>Apprendre, partager, réussir.</p></aside>
      <div className="welcome-copy"><span className="welcome-eyebrow">TON ESPACE D'ÉTUDE COMMENCE ICI</span><h1 id="welcome-title">Bienvenue sur <em>GRIND</em></h1><h2>La plateforme d'entraide scolaire.</h2><p>Nous sommes ravis de vous accueillir parmi nous. Ici, les élèves peuvent partager leurs connaissances, trouver des ressources et progresser ensemble.</p>
        <div className="welcome-origin"><DrapeauNiger /><div><strong>Développé au Niger</strong><span>par <b>G-SOCIETY</b></span></div></div>
        <p className="welcome-legal">Consultez les <a href="/conditions" target="_blank" rel="noreferrer">conditions d'utilisation de GRIND</a>.</p>
        <button className="welcome-next" onClick={() => setEtape(1)}>Suivant <i className="fa-solid fa-arrow-right" /></button>
      </div>
    </div> : etape === 1 ? <div className="welcome-warning-step">
      <div className="welcome-warning-copy"><div className="welcome-warning-icon"><i className="fa-solid fa-triangle-exclamation" /></div><span className="welcome-eyebrow">UN ESPACE DE TRAVAIL ET D'APPRENTISSAGE</span><h2 id="welcome-title">GRIND n'est pas une plateforme de distraction.</h2><p>Tout comportement contraire à nos règles, même discret ou répété, peut entraîner une sanction sévère.</p><a href="/conditions#sanctions">Consulter les règles et les sanctions</a></div>
      <div className="welcome-warning-side"><span className="welcome-warning-note">Respect · Concentration · Entraide</span><p>GRIND est un espace consacré au travail scolaire. Chaque membre contribue à préserver un environnement sérieux, utile et respectueux.</p><button className="welcome-next" onClick={() => setEtape(2)}>Suivant <i className="fa-solid fa-arrow-right" /></button></div>
    </div> : <div className="welcome-final-step">
      <div className="welcome-final-copy"><span className="welcome-eyebrow">BIENVENUE DANS LA COMMUNAUTÉ</span><h2>Apprendre ensemble change tout.</h2><p>Retrouve des élèves, partage tes ressources et avance à ton rythme avec GRIND.</p></div>
      <div className="welcome-illustration"><IllustrationEtude /><div className="welcome-caption"><strong>On avance mieux ensemble.</strong><span>Les ressources, les idées et l'entraide au même endroit.</span></div></div>
      <button className="welcome-next welcome-start" onClick={terminer} disabled={envoi}>{envoi ? <><i className="fa-solid fa-circle-notch fa-spin" /> Préparation…</> : <>Commencer <i className="fa-solid fa-arrow-right" /></>}</button>
    </div>}
    {erreur && <p className="welcome-error" role="alert">{erreur}</p>}
  </section></div>;
}
