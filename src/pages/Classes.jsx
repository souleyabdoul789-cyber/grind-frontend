import FormulaireClasse from "../components/FormulaireClasse.jsx";
import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";
import QRCode from "qrcode";
import { rejoindreClasse, listerMesClasses, renommerClasse, supprimerClasse, extraireCode, estGrindEnLigne } from "../api.js";
import SalleClasse from "../components/SalleClasse.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import EtatVide from "../components/EtatVide.jsx";
import DiscussionClasse from "../components/DiscussionClasse.jsx";
import ProfilPublic from "../components/ProfilPublic.jsx";

export default function Classes({ sessionToken, monUsername, codeAttente, onCodeConsomme, discussionAouvrir, onDiscussionOuverte, onModeDiscussion }) {
  const cleCacheClasses = `grind_classes_${monUsername || "compte"}`;
  const classesDepuisCache = (() => { try { const data = JSON.parse(localStorage.getItem(cleCacheClasses) || "[]"); return Array.isArray(data) ? data : []; } catch { return []; } })();
  const [classes, setClasses] = useState(classesDepuisCache);
  const [chargement, setChargement] = useState(classesDepuisCache.length === 0);
  const [salleActive, setSalleActive] = useState(null); // salle LiveKit de la classe réelle
  const [discussionActive, setDiscussionActive] = useState(null);
  const [messageInitialDiscussion, setMessageInitialDiscussion] = useState(null);
  const [profilConsulte, setProfilConsulte] = useState(null);
  const [ouvertureSalleId, setOuvertureSalleId] = useState(null);

  const [formulaireOuvert, setFormulaireOuvert] = useState(codeAttente ? "rejoindre" : null);
  const [erreurScanner, setErreurScanner] = useState("");
  const [scannerEnCours, setScannerEnCours] = useState(false);
  const [qrClasse, setQrClasse] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const codeLienTraite = useRef(null);
  const [erreur, setErreur] = useState(null);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [lienCopie, setLienCopie] = useState(null);

  const [classeEnEdition, setClasseEnEdition] = useState(null);
  const [nomEdition, setNomEdition] = useState("");
  const [classeASupprimer, setClasseASupprimer] = useState(null);

  async function charger({ silencieux = false } = {}) {
    if (!estGrindEnLigne()) { setChargement(false); return; }
    setErreurChargement(null);
    try {
      const res = await listerMesClasses(sessionToken);
      const entrantes = Array.isArray(res.classes) ? res.classes : [];
      setClasses((anciennes) => {
        const idsServeur = new Set(entrantes.map((c) => Number(c.classe_id)));
        // Les cartes déjà affichées gardent leur contenu et leur ordre.
        // On retire uniquement les accès révoqués, puis on ajoute les nouvelles classes à la fin.
        const fusion = anciennes.filter((c) => idsServeur.has(Number(c.classe_id)));
        const idsAffiches = new Set(fusion.map((c) => Number(c.classe_id)));
        entrantes.forEach((c) => { if (!idsAffiches.has(Number(c.classe_id))) fusion.push(c); });
        try { localStorage.setItem(cleCacheClasses, JSON.stringify(fusion.slice(-100))); } catch {}
        return fusion;
      });
    } catch (err) {
      if ([401, 403].includes(err.status)) {
        // Le serveur a invalidé la session : ne plus réafficher les classes du cache local.
        localStorage.removeItem(cleCacheClasses);
        setClasses([]);
      }
      setErreurChargement(err.message || "Impossible de charger les classes. Réessaie.");
    } finally { setChargement(false); }
  }

  useEffect(() => {
    charger();
    const actualiser = () => charger({ silencieux: true });
    const statutApi = event => { if (event.detail?.online) actualiser(); };
    window.addEventListener("online", actualiser);
    window.addEventListener("grind-api-status", statutApi);
    const intervalle = window.setInterval(actualiser, 45000);
    return () => {
      window.removeEventListener("online", actualiser);
      window.removeEventListener("grind-api-status", statutApi);
      window.clearInterval(intervalle);
    };
  }, [sessionToken, cleCacheClasses]);

  useEffect(() => {
    try { localStorage.setItem(cleCacheClasses, JSON.stringify(classes.slice(-100))); } catch {}
  }, [classes, cleCacheClasses]);

  useEffect(() => {
    onModeDiscussion?.(Boolean(discussionActive && !profilConsulte && !salleActive));
    return () => onModeDiscussion?.(false);
  }, [discussionActive, profilConsulte, salleActive, onModeDiscussion]);

  useEffect(() => {
    let actif = true;
    if (!qrClasse?.code_invitation) { setQrDataUrl(""); return undefined; }
    QRCode.toDataURL(String(qrClasse.code_invitation), { width: 240, margin: 2, errorCorrectionLevel: "M" })
      .then(url => { if (actif) setQrDataUrl(url); })
      .catch(() => { if (actif) setQrDataUrl(""); });
    return () => { actif = false; };
  }, [qrClasse]);

  useEffect(() => {
    const ouvrirProfil = (event) => {
      const username = typeof event.detail === "string" ? event.detail : event.detail?.username;
      if (username) setProfilConsulte(username);
    };
    window.addEventListener("grind-open-profil", ouvrirProfil);
    return () => window.removeEventListener("grind-open-profil", ouvrirProfil);
  }, []);

  useEffect(() => {
    if (!discussionAouvrir?.classe_id || chargement) return;
    const cible = classes.find(c => Number(c.classe_id) === Number(discussionAouvrir.classe_id));
    if (cible) {
      setSalleActive(null);
      setMessageInitialDiscussion(discussionAouvrir.message_id || null);
      setDiscussionActive(cible);
      if (onDiscussionOuverte) onDiscussionOuverte();
    }
  }, [discussionAouvrir, classes, chargement, onDiscussionOuverte]);

  async function rejoindreAvecCode(codeBrut) {
    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour rejoindre une classe." }));
      return;
    }
    const code = extraireCode(String(codeBrut || "").trim());
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(code)) {
      setErreurScanner("Ce QR code ne correspond pas à une invitation GRIND valide.");
      return;
    }
    setErreurScanner("");
    setScannerEnCours(true);
    try {
      await rejoindreClasse(sessionToken, code);
      setFormulaireOuvert(null);
      setQrClasse(null);
      onCodeConsomme?.();
      await charger({ silencieux: true });
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Tu as rejoint la classe." }));
    } catch (err) {
      setErreurScanner(err.message || "Impossible de rejoindre cette classe.");
    } finally { setScannerEnCours(false); }
  }

  async function gererAdhesion() {
    if (scannerEnCours) return;
    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour rejoindre une classe." }));
      return;
    }
    setErreurScanner("");
    setScannerEnCours(true);
    try {
      if (Capacitor.getPlatform() === "android") {
        const statutModule = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!statutModule.available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
          setErreurScanner("Le lecteur QR Android vient d'être installé. Appuie de nouveau sur le bouton pour scanner.");
          return;
        }
      }
      const resultat = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode], autoZoom: true });
      const valeur = resultat.barcodes?.find(code => code.rawValue)?.rawValue;
      if (!valeur) return;
      await rejoindreAvecCode(valeur);
    } catch (err) {
      setErreurScanner(err.message || "Impossible d'ouvrir le scanner QR.");
    } finally { setScannerEnCours(false); }
  }

  useEffect(() => {
    if (!codeAttente) return undefined;
    const traiterLien = () => {
      if (!estGrindEnLigne() || codeLienTraite.current === codeAttente) return;
      codeLienTraite.current = codeAttente;
      rejoindreAvecCode(codeAttente);
    };
    traiterLien();
    window.addEventListener("online", traiterLien);
    return () => window.removeEventListener("online", traiterLien);
  }, [codeAttente]);

  function ouvrirDiscussion(c, messageId = null) {
    setSalleActive(null);
    setMessageInitialDiscussion(messageId);
    setDiscussionActive(c);
  }

  function ouvrirSalle(classeId) {
    if (!estGrindEnLigne()) {
      window.dispatchEvent(new CustomEvent("grind-toast", { detail: "La salle de classe nécessite une connexion Internet." }));
      return;
    }
    if (ouvertureSalleId !== null) return;
    setOuvertureSalleId(classeId);
    window.setTimeout(() => {
      setSalleActive(classeId);
      setOuvertureSalleId(null);
    }, 250);
  }

  function copierLien(code) {
    navigator.clipboard.writeText(code);
    setLienCopie(code);
    setTimeout(() => setLienCopie(null), 2000);
  }

  function commencerEdition(c) {
    setClasseEnEdition(c.classe_id);
    setNomEdition(c.niveau && c.matiere ? c.complement || "" : c.nom);
  }

  async function validerRenommage(classeId) {
    if (!nomEdition.trim()) return;
    try {
      await renommerClasse(sessionToken, classeId, nomEdition.trim());
      setClasses((prev) => prev.map((c) => (c.classe_id === classeId ? { ...c, nom: nomEdition.trim() } : c)));
      setClasseEnEdition(null);
    } catch (err) {
      setErreur(err.message);
    }
  }

  function gererSuppression(classeId) {
    setClasseASupprimer(classeId);
  }

  async function confirmerSuppression() {
    const classeId = classeASupprimer;
    setClasseASupprimer(null);
    try {
      await supprimerClasse(sessionToken, classeId);
      setClasses((prev) => prev.filter((c) => c.classe_id !== classeId));
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (profilConsulte) {
    return (
      <div className="fil-actu">
        <ProfilPublic username={profilConsulte} sessionToken={sessionToken} monUsername={monUsername} onRetour={() => setProfilConsulte(null)} />
      </div>
    );
  }

  if (discussionActive) {
    return (
      <div className="fil-actu discussion-page-shell">
        <DiscussionClasse
          sessionToken={sessionToken}
          classe={discussionActive}
          monUsername={monUsername}
          messageAouvrirId={messageInitialDiscussion}
          onQuitter={() => { setDiscussionActive(null); setMessageInitialDiscussion(null); charger(); }}
        />
      </div>
    );
  }

  if (salleActive) {
    const classeOuverte = classes.find((c) => c.classe_id === salleActive);
    return (
      <div className="fil-actu">
        <div className="sous-titre" style={{ marginBottom: 12 }}>
          <i className="fa-solid fa-chalkboard"></i> {classeOuverte?.nom}
        </div>
        <SalleClasse
          sessionToken={sessionToken}
          demandeId={salleActive}
          monUsername={monUsername}
          profInitial={classeOuverte?.prof_actuel}
          nomClasse={classeOuverte?.nom}
          onQuitter={() => setSalleActive(null)}
        />
      </div>
    );
  }

  return (
    <div className="fil-actu">

      <div className="choix-categorie" style={{ marginBottom: 16 }}>
        <button
          className={formulaireOuvert === "creer" ? "chip chip-actif" : "chip"}
          onClick={() => {
            if (!estGrindEnLigne()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour créer une classe." })); return; }
            setFormulaireOuvert(formulaireOuvert === "creer" ? null : "creer");
          }}
          type="button"
        >
          <i className="fa-solid fa-plus"></i> Créer une classe
        </button>
        <button
          className={formulaireOuvert === "rejoindre" ? "chip chip-actif" : "chip"}
          onClick={() => {
            if (!estGrindEnLigne()) { window.dispatchEvent(new CustomEvent("grind-toast", { detail: "Connexion requise pour rejoindre une classe." })); return; }
            setFormulaireOuvert(formulaireOuvert === "rejoindre" ? null : "rejoindre"); setErreurScanner("");
          }}
          type="button"
        >
          <i className="fa-solid fa-right-to-bracket"></i> Rejoindre
        </button>
      </div>

      {formulaireOuvert === "creer" && (
        <FormulaireClasse
          sessionToken={sessionToken}
          onCree={() => {
            setFormulaireOuvert(null);
            charger();
          }}
        />
      )}

      {formulaireOuvert === "rejoindre" && (
        <div className="carte-post classe-scanner-card">
          <button type="button" className="classe-scanner-button" onClick={gererAdhesion} disabled={scannerEnCours}>
            {scannerEnCours ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-camera" />}
            <span>{scannerEnCours ? "Ouverture du scanner…" : "Scanner le QR code d'une classe"}</span>
          </button>
          {erreurScanner && <div className="erreur" role="alert">{erreurScanner}</div>}
        </div>
      )}

      {chargement ? (
        <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement des classes...</div>
      ) : erreurChargement && classes.length === 0 ? (
        <div className="carte-post etat-erreur-reseau" role="alert">
          <p>{erreurChargement}</p>
          <button type="button" onClick={charger}>Réessayer</button>
        </div>
      ) : classes.length === 0 ? (
        <EtatVide texte={!estGrindEnLigne() ? "Aucune classe n'a encore été enregistrée sur cet appareil" : "Aucune classe pour l'instant"} />
      ) : (
        classes.map((c) => (
          <div key={c.classe_id} className="carte-post carte-classe">
            <div className="entete-post">
              <div className="avatar-mini"><i className="fa-solid fa-chalkboard-user"></i></div>
              <div style={{ flex: 1 }}>
                {classeEnEdition === c.classe_id ? (
                  <div className="edition-nom-classe">
                    <input
                      value={nomEdition}
                      placeholder={c.niveau && c.matiere ? "Complément du nom (facultatif)" : "Nom de la classe"}
                      maxLength={c.niveau && c.matiere ? 30 : 60}
                      onChange={(e) => setNomEdition(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && validerRenommage(c.classe_id)}
                      autoFocus
                    />
                    <button type="button" onClick={() => validerRenommage(c.classe_id)}><i className="fa-solid fa-check"></i></button>
                    <button type="button" className="bouton-retour" onClick={() => setClasseEnEdition(null)}><i className="fa-solid fa-xmark"></i></button>
                  </div>
                ) : (
                  <div className="auteur-post">{c.nom}</div>
                )}
                <div className="badge-categorie demonstration">
                  <i className="fa-solid fa-users"></i> {c.nb_membres} {c.nb_membres > 1 ? "membres" : "membre"} dans la classe
                </div>
                <div className="discussion-meta-classe">
                  <i className="fa-solid fa-comments" /> {c.discussion_membres ?? 0} / 200 dans la discussion
                  {c.est_membre_classe === false && <span> · membre du groupe uniquement</span>}
                </div>
              </div>
              {c.role === "prof" && !!c.code_invitation && <button className="classe-qr-action" type="button" onClick={() => setQrClasse(c)} title="Afficher le QR code de la classe" aria-label={`Afficher le QR code de ${c.nom}`}><i className="fa-solid fa-qrcode" /></button>}
              {c.role === "prof" && (
                <div className="badge-statut statut-ouverte">
                  <i className="fa-solid fa-star"></i> Créateur
                </div>
              )}
            </div>

            {c.role === "prof" && classeEnEdition !== c.classe_id && (
              <>
                <button className="action-post" onClick={() => copierLien(c.code_invitation)} type="button">
                  <i className={lienCopie === c.code_invitation ? "fa-solid fa-check" : "fa-solid fa-link"}></i>
                  {lienCopie === c.code_invitation ? "Code copié" : "Copier le code d'invitation"}
                </button>
                <button className="action-post" onClick={() => commencerEdition(c)} type="button">
                  <i className="fa-solid fa-pen"></i> Renommer
                </button>
                <button className="action-post action-danger" onClick={() => gererSuppression(c.classe_id)} type="button">
                  <i className="fa-solid fa-trash"></i> Supprimer la classe
                </button>
              </>
            )}

            <div className="discussion-actions-classe">
              {c.est_membre_discussion !== false ? (
                <button className="discussion-ouvrir-groupe" onClick={() => ouvrirDiscussion(c)} type="button">
                  <i className="fa-solid fa-comments" /> Ouvrir la discussion <span>{c.discussion_membres ?? 0}</span>
                </button>
              ) : (
                <div className="info discussion-acces-retire"><i className="fa-solid fa-lock" /> Accès à la discussion retiré. Contacte un administrateur du groupe.</div>
              )}
              {c.est_membre_classe !== false && !c.suspendue && (
                <button className="action-post discussion-ouvrir-classe" onClick={() => ouvrirSalle(c.classe_id)} disabled={ouvertureSalleId !== null} type="button">
                  {ouvertureSalleId === c.classe_id ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Ouverture...</> : <><i className="fa-solid fa-phone"></i> Entrer dans la classe</>}
                </button>
              )}
              {c.suspendue && <div className="info classe-suspendue"><i className="fa-solid fa-circle-pause"></i> Classe suspendue par l'administration de GRIND</div>}
            </div>
          </div>
        ))
      )}
      {qrClasse && (
        <div className="classe-qr-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setQrClasse(null); }}>
          <section className="classe-qr-modal" role="dialog" aria-modal="true" aria-label={`QR code de ${qrClasse.nom}`}>
            <button type="button" className="classe-qr-close" onClick={() => setQrClasse(null)} aria-label="Fermer"><i className="fa-solid fa-xmark" /></button>
            <strong>{qrClasse.nom}</strong>
            <small>Scanne ce code depuis GRIND pour rejoindre la classe.</small>
            {qrDataUrl ? <img src={qrDataUrl} alt={`QR code d'invitation pour ${qrClasse.nom}`} /> : <span className="grind-spinner" />}
            <span className="classe-qr-security"><i className="fa-solid fa-shield-halved" /> L'accès reste vérifié par GRIND.</span>
          </section>
        </div>
      )}

      {classeASupprimer && (
        <ConfirmModal
          message="Supprimer définitivement cette classe ? Tous ses membres seront retirés."
          onConfirmer={confirmerSuppression}
          onAnnuler={() => setClasseASupprimer(null)}
        />
      )}
    </div>
  );
}
