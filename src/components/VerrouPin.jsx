import { useState } from "react";
import { configurerPin, verifierPin, reinitialiserPin, demanderReinitialisationPin, reinitialiserPinParEmail, verifierCode, associerCompteAppareil } from "../api.js";

function enregistrerCompteLocal() {
  const username = localStorage.getItem("grind_username");
  const token = localStorage.getItem("grind_session_token");
  if (!username || !token) return;
  let comptes = [];
  try { comptes = JSON.parse(localStorage.getItem("grind_accounts") || "[]"); } catch { comptes = []; }
  comptes = comptes.filter((c) => c.username !== username);
  comptes.unshift({ username, token, role: localStorage.getItem("grind_role") || "", type_compte: localStorage.getItem("grind_type_compte") || "eleve" });
  localStorage.setItem("grind_accounts", JSON.stringify(comptes.slice(0, 4)));
}

export default function VerrouPin({ sessionToken, statut, onValide }) {
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [modeReset, setModeReset] = useState(false);
  const [codeRecuperation, setCodeRecuperation] = useState("");
  const [jetonRecuperation, setJetonRecuperation] = useState("");
  const [emailMasque, setEmailMasque] = useState("");
  const [codeValide, setCodeValide] = useState(false);
  const compteDirection = localStorage.getItem("grind_type_compte") === "proviseur";
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [info, setInfo] = useState("");
  const configuration = !statut?.configured;

  if (statut?.loading) {
    return <main className="ecran-pin"><div className="carte carte-pin"><div className="logo-grind"><i className="fa-solid fa-brain"></i><span>GRIND</span></div><p>Vérification de la session…</p></div></main>;
  }

  async function valider(e) {
    e.preventDefault(); setErreur(""); setInfo("");
    if (modeReset && !compteDirection && !codeValide) {
      if (!/^\d{7}$/.test(codeRecuperation)) { setErreur("Entre le code à 7 chiffres reçu par e-mail."); return; }
      setChargement(true);
      try {
        await verifierCode(jetonRecuperation, codeRecuperation);
        setCodeValide(true);
        setInfo("Adresse vérifiée. Choisis maintenant ton nouveau PIN.");
      } catch (e) { setErreur(e.message || "Code invalide."); }
      finally { setChargement(false); }
      return;
    }
    if (!/^\d{4}$/.test(pin)) { setErreur("Le PIN doit contenir exactement 4 chiffres."); return; }
    if ((configuration || modeReset) && pin !== confirmation) { setErreur("Les deux PIN ne correspondent pas."); return; }
    if (modeReset && compteDirection && !password) { setErreur("Entre ton mot de passe GRIND pour réinitialiser le PIN."); return; }
    setChargement(true);
    try {
      if (modeReset && compteDirection) await reinitialiserPin(sessionToken, password, pin);
      else if (modeReset) await reinitialiserPinParEmail(sessionToken, jetonRecuperation, pin);
      else if (configuration) await configurerPin(sessionToken, pin);
      else await verifierPin(sessionToken, pin);
      try {
        const res = await associerCompteAppareil(sessionToken);
        enregistrerCompteLocal();
        setInfo(`Compte mémorisé sur cet appareil (${res.comptes_memorises}/${res.max_comptes}).`);
      } catch (e) {
        if (e.message?.includes("Limite")) setInfo("Session ouverte, mais la limite de comptes mémorisés sur cet appareil est atteinte.");
        else setInfo("PIN validé. La mémorisation de l'appareil sera réessayée à la prochaine connexion.");
      }
      onValide();
    } catch (e) { setErreur(e.message || "Validation impossible."); }
    finally { setChargement(false); }
  }

  async function demarrerReinitialisation() {
    setErreur(""); setInfo(""); setPassword(""); setPin(""); setConfirmation(""); setCodeRecuperation(""); setCodeValide(false);
    if (compteDirection) { setModeReset(true); return; }
    setChargement(true);
    try {
      const resultat = await demanderReinitialisationPin(sessionToken);
      setJetonRecuperation(resultat.jeton_verification);
      setEmailMasque(resultat.email_masque || "ton adresse vérifiée");
      setModeReset(true);
    } catch (e) { setErreur(e.message || "Impossible de démarrer la récupération du PIN."); }
    finally { setChargement(false); }
  }

  return (
    <main className="ecran-pin">
      <form className="carte carte-pin" onSubmit={valider}>
        <div className="logo-grind"><i className="fa-solid fa-brain"></i><span>GRIND</span></div>
        <div className="badge-securite"><i className="fa-solid fa-shield-halved"></i> Protection du compte</div>
        <h2>{modeReset ? "Réinitialiser le PIN" : configuration ? "Créer ton PIN" : "Confirmer ton identité"}</h2>
        <p>{modeReset ? (compteDirection ? "Pour un compte de direction sans e-mail, le mot de passe du compte confirme ton identité." : codeValide ? "L'adresse e-mail est vérifiée. Définis un nouveau PIN de 4 chiffres." : `Un code à 7 chiffres a été envoyé à ${emailMasque}.`) : configuration ? "Choisis un code personnel de 4 chiffres. Il sera redemandé lors des connexions et au moins toutes les 48 heures." : "Entre ton PIN pour continuer. Il est redemandé après 48 heures et lors du changement de compte."}</p>
        {modeReset && compteDirection && <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe GRIND" required />}
        {modeReset && !compteDirection && !codeValide && <input className="champ-pin" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{7}" maxLength={7} value={codeRecuperation} onChange={(e) => setCodeRecuperation(e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="Code reçu par e-mail" aria-label="Code de récupération à 7 chiffres" required />}
        {(!modeReset || compteDirection || codeValide) && <input className="champ-pin" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" aria-label="PIN à 4 chiffres" required />}
        {(configuration || (modeReset && (compteDirection || codeValide))) && <input className="champ-pin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={confirmation} onChange={(e) => setConfirmation(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Confirmer le PIN" aria-label="Confirmer le PIN" required />}
        <button type="submit" disabled={chargement}>{chargement ? "Vérification..." : modeReset ? (!compteDirection && !codeValide ? "Vérifier le code" : "Enregistrer le nouveau PIN") : configuration ? "Enregistrer le PIN" : "Déverrouiller GRIND"}</button>
        {!configuration && !modeReset && <button type="button" className="lien" onClick={demarrerReinitialisation} disabled={chargement}>PIN oublié ? Récupérer l'accès</button>}
        {modeReset && <button type="button" className="lien" onClick={() => { setModeReset(false); setPassword(""); setPin(""); setConfirmation(""); setCodeRecuperation(""); setJetonRecuperation(""); setCodeValide(false); setErreur(""); setInfo(""); }}>Retour à la vérification du PIN</button>}
        {erreur && <div className="erreur" role="alert">{erreur}</div>}
        {info && <div className="info">{info}</div>}
      </form>
    </main>
  );
}
