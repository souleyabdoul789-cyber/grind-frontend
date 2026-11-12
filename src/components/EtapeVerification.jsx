import { useState, useEffect, useRef } from "react";
import { verifierCode, renvoyerCode } from "../api.js";
import SaisieCode from "./SaisieCode.jsx";

const DUREE_MINIMALE_VERIFICATION = 800; // ms : l'animation ne « clignote » jamais, même si le serveur répond vite
const DUREE_SUCCES = 1000;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * EtapeVerification — la page de saisie du code à 7 chiffres envoyé par G-SOCIETY.
 * Sert à l'inscription et à la réinitialisation du mot de passe.
 * Toute la vérification est faite par le serveur : ici on n'affiche que le résultat.
 *
 * objet     : "inscription" | "reinitialisation"
 * onVerifie : appelé avec la réponse du serveur une fois le code accepté
 * onAnnuler : retour à l'écran précédent
 */
export default function EtapeVerification({ objet, emailMasque, jeton, onVerifie, onAnnuler }) {
  const [code, setCode] = useState("");
  const [etat, setEtat] = useState("saisie"); // "saisie" | "verification" | "succes"
  const [erreur, setErreur] = useState(null);
  const [secousse, setSecousse] = useState(false);
  const [codeAnnule, setCodeAnnule] = useState(false); // code expiré / annulé : il faut en redemander un
  const [attente, setAttente] = useState(60); // le premier code vient d'être envoyé
  const [renvoiEnCours, setRenvoiEnCours] = useState(false);
  const [info, setInfo] = useState(null);
  const enCours = useRef(false);

  useEffect(() => {
    if (attente <= 0) return undefined;
    const minuteur = setTimeout(() => setAttente((a) => a - 1), 1000);
    return () => clearTimeout(minuteur);
  }, [attente]);

  async function verifier(codeSaisi) {
    if (enCours.current) return;
    enCours.current = true;
    setErreur(null);
    setInfo(null);
    setEtat("verification");
    const debut = Date.now();
    try {
      const res = await verifierCode(jeton, codeSaisi);
      const restant = DUREE_MINIMALE_VERIFICATION - (Date.now() - debut);
      if (restant > 0) await pause(restant);
      setEtat("succes");
      await pause(DUREE_SUCCES);
      onVerifie(res);
    } catch (err) {
      const restant = DUREE_MINIMALE_VERIFICATION - (Date.now() - debut);
      if (restant > 0) await pause(restant);
      const type = err.donnees?.code;
      setEtat("saisie");
      setErreur(err.message);
      setCode("");
      setSecousse(true);
      setTimeout(() => setSecousse(false), 500);
      if (type === "code_annule" || type === "code_expire") setCodeAnnule(true);
      if (type === "flux_expire") setCodeAnnule(false);
    } finally {
      enCours.current = false;
    }
  }

  async function renvoyer() {
    setRenvoiEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      const res = await renvoyerCode(jeton);
      setAttente(res.attente_secondes || 60);
      setCodeAnnule(false);
      setCode("");
      setInfo(`Un nouveau code vient d'être envoyé à ${res.email_masque || emailMasque}.`);
    } catch (err) {
      if (err.donnees?.attente_secondes) setAttente(err.donnees.attente_secondes);
      setErreur(err.message);
    } finally {
      setRenvoiEnCours(false);
    }
  }

  const titre = objet === "reinitialisation" ? "Vérifie ton identité" : "Vérifie ton adresse e-mail";

  return (
    <div className="etape-verification">
      <div className="icone-etape"><i className="fa-solid fa-envelope-circle-check"></i></div>
      <div className="etape-question">{titre}</div>
      <p className="verification-texte">
        <strong>G-SOCIETY</strong> vient d'envoyer un code à 7 chiffres à <strong>{emailMasque}</strong>.
        Il est valable 10 minutes. Pense à regarder dans tes courriers indésirables.
      </p>

      {etat === "saisie" && (
        <div className={secousse ? "secousse" : ""}>
          <SaisieCode valeur={code} onChange={setCode} onComplet={verifier} erreur={!!erreur} />
        </div>
      )}

      {etat === "verification" && (
        <div className="verification-etat" role="status" aria-live="polite">
          <div className="anneau-verification" aria-hidden="true"></div>
          <div className="verification-etat-texte">Vérification du code...</div>
        </div>
      )}

      {etat === "succes" && (
        <div className="verification-etat" role="status" aria-live="polite">
          <svg className="coche-succes" viewBox="0 0 52 52" aria-hidden="true">
            <circle className="coche-succes-cercle" cx="26" cy="26" r="23" fill="none" />
            <path className="coche-succes-trait" fill="none" d="M15 27 l8 8 l15 -17" />
          </svg>
          <div className="verification-etat-texte">Vérifié</div>
        </div>
      )}

      {erreur && etat === "saisie" && (
        <div className="erreur" role="alert">
          <i className="fa-solid fa-triangle-exclamation"></i>
          {erreur}
        </div>
      )}
      {info && etat === "saisie" && <div className="info" style={{ color: "var(--succes)" }}>{info}</div>}

      {etat === "saisie" && (
        <>
          <button type="button" className="lien" onClick={renvoyer} disabled={attente > 0 || renvoiEnCours}>
            {renvoiEnCours
              ? <><span className="grind-spinner" aria-hidden="true" /> Envoi en cours</>
              : attente > 0
              ? `Renvoyer le code dans ${attente} s`
              : codeAnnule
              ? "Recevoir un nouveau code"
              : "Renvoyer le code"}
          </button>
          <button type="button" className="lien" onClick={onAnnuler}>
            <i className="fa-solid fa-arrow-left"></i> Retour
          </button>
        </>
      )}
    </div>
  );
}
