import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import {
  BarcodeScanner,
  BarcodeFormat,
  LensFacing,
} from "@capacitor-mlkit/barcode-scanning";

const TAILLE_IMAGE_MAX = 12 * 1024 * 1024;
const COTE_IMAGE_MAX = 2200;

async function optimiserImagePourLecture(fichier) {
  if (typeof createImageBitmap !== "function") return fichier;

  let bitmap;
  try {
    bitmap = await createImageBitmap(fichier);
    const plusGrandCote = Math.max(bitmap.width, bitmap.height);

    if (plusGrandCote <= COTE_IMAGE_MAX) return fichier;

    const ratio = COTE_IMAGE_MAX / plusGrandCote;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));

    const contexte = canvas.getContext("2d", { alpha: false });
    if (!contexte) return fichier;

    contexte.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    return blob || fichier;
  } finally {
    bitmap?.close?.();
  }
}

/**
 * GRIND Scan
 * - Caméra native Android/iOS : ML Kit avec interface React personnalisée.
 * - Navigateur : caméra HTMLVideoElement via le plugin Capacitor.
 * - Capture importée : décodage local avec le ponyfill ZXing-WASM.
 * Aucun fichier image n'est envoyé au backend.
 */
export default function GrindScannerQR({ onDetected, onFermer }) {
  const estNatif = Capacitor.isNativePlatform();
  const videoRef = useRef(null);
  const fichierRef = useRef(null);
  const ecouteursRef = useRef([]);
  const lectureOccupeeRef = useRef(false);
  const callbackCodeRef = useRef(onDetected);
  const callbackFermerRef = useRef(onFermer);

  const [hotePortail, setHotePortail] = useState(null);
  const [etatCamera, setEtatCamera] = useState("initialisation");
  const [erreur, setErreur] = useState("");
  const [lectureImage, setLectureImage] = useState(false);
  const [torcheDisponible, setTorcheDisponible] = useState(false);
  const [torcheActive, setTorcheActive] = useState(false);
  const [faceCamera, setFaceCamera] = useState(LensFacing.Back);
  const [cycleCamera, setCycleCamera] = useState(0);

  callbackCodeRef.current = onDetected;
  callbackFermerRef.current = onFermer;

  useEffect(() => {
    const hote = document.createElement("div");
    hote.id = "grind-scanner-portal";
    document.body.appendChild(hote);
    setHotePortail(hote);

    return () => {
      document.body.classList.remove("barcode-scanner-active");
      hote.remove();
    };
  }, []);

  async function arreterCamera() {
    const ecouteurs = ecouteursRef.current.splice(0);
    await Promise.all(
      ecouteurs.map((ecouteur) =>
        ecouteur?.remove?.().catch(() => {})
      )
    );

    try {
      await BarcodeScanner.stopScan();
    } catch {
      // Le plugin peut signaler qu'aucune session caméra n'était active.
    }

    document.body.classList.remove("barcode-scanner-active");
  }

  async function validerCodeDetecte(valeur) {
    const code = typeof valeur === "string" ? valeur.trim() : "";
    if (!code || lectureOccupeeRef.current) return;

    lectureOccupeeRef.current = true;
    await arreterCamera();
    callbackCodeRef.current?.(code);
  }

  useEffect(() => {
    if (!hotePortail) return undefined;

    let annule = false;

    async function demarrerCamera() {
      lectureOccupeeRef.current = false;
      setErreur("");
      setEtatCamera("initialisation");
      setTorcheDisponible(false);

      try {
        if (!estNatif) {
          if (!window.isSecureContext) {
            throw new Error(
              "La caméra web exige une adresse HTTPS (ou localhost en développement)."
            );
          }

          // Le plugin Web s'appuie sur Barcode Detection API.
          // Le polyfill est chargé à la demande pour les navigateurs qui ne l'ont pas.
          await import("barcode-detector/polyfill");
        } else {
          let permission = await BarcodeScanner.checkPermissions();
          if (permission.camera !== "granted") {
            permission = await BarcodeScanner.requestPermissions();
          }
          if (permission.camera !== "granted") {
            throw new Error(
              "L'accès à la caméra est refusé. Autorise la caméra dans les paramètres de l'appareil."
            );
          }
        }

        const support = await BarcodeScanner.isSupported();
        if (!support.supported) {
          throw new Error("Aucune caméra compatible n'a été détectée sur cet appareil.");
        }

        const ecouteur = await BarcodeScanner.addListener(
          "barcodesScanned",
          (resultat) => {
            const barcode = resultat?.barcodes?.find(
              (item) => typeof item?.rawValue === "string" && item.rawValue.trim()
            );
            if (barcode?.rawValue) {
              void validerCodeDetecte(barcode.rawValue);
            }
          }
        );

        if (annule) {
          await ecouteur.remove();
          return;
        }
        ecouteursRef.current.push(ecouteur);

        if (estNatif) {
          const ecouteurErreur = await BarcodeScanner.addListener("scanError", (evenement) => {
            if (annule) return;
            const detail = typeof evenement?.message === "string" ? evenement.message.trim() : "";
            setEtatCamera("erreur");
            setErreur(detail || "La caméra a rencontré une erreur pendant la lecture du QR code.");
          });
          if (annule) {
            await ecouteurErreur.remove();
            return;
          }
          ecouteursRef.current.push(ecouteurErreur);
          // ML Kit dessine la caméra derrière la WebView. Le CSS associé rend
          // html/body transparents et laisse uniquement le portail du scanner visible.
          document.body.classList.add("barcode-scanner-active");
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          if (annule) {
            document.body.classList.remove("barcode-scanner-active");
            return;
          }
          await BarcodeScanner.startScan({
            formats: [BarcodeFormat.QrCode],
            lensFacing: faceCamera,
          });
          if (annule) {
            await arreterCamera();
            return;
          }

          try {
            const torche = await BarcodeScanner.isTorchAvailable();
            if (!annule) setTorcheDisponible(!!torche.available);
          } catch {
            if (!annule) setTorcheDisponible(false);
          }
        } else {
          if (!videoRef.current) {
            throw new Error("L'aperçu caméra web n'est pas prêt. Réessaie.");
          }
          await BarcodeScanner.startScan({
            videoElement: videoRef.current,
          });
          if (annule) {
            await arreterCamera();
            return;
          }
        }

        if (!annule) setEtatCamera("active");
      } catch (cause) {
        if (!annule) {
          setEtatCamera("erreur");
          setErreur(
            cause?.message ||
              "Impossible de démarrer le scanner. Vérifie l'autorisation caméra."
          );
        }
        await arreterCamera();
      }
    }

    void demarrerCamera();

    return () => {
      annule = true;
      void arreterCamera();
    };
  }, [hotePortail, estNatif, faceCamera, cycleCamera]);

  useEffect(() => {
    const fermerAvecEchap = (event) => {
      if (event.key === "Escape") {
        callbackFermerRef.current?.();
      }
    };
    const retourMateriel = (event) => {
      if (event.defaultPrevented) return;
      callbackFermerRef.current?.();
      event.preventDefault();
    };

    window.addEventListener("keydown", fermerAvecEchap);
    window.addEventListener("grind-back", retourMateriel);

    return () => {
      window.removeEventListener("keydown", fermerAvecEchap);
      window.removeEventListener("grind-back", retourMateriel);
    };
  }, []);

  async function basculerTorche() {
    if (!estNatif || !torcheDisponible) return;
    try {
      await BarcodeScanner.toggleTorch();
      const statut = await BarcodeScanner.isTorchEnabled();
      setTorcheActive(!!statut.enabled);
    } catch {
      setErreur("La lampe torche n'est pas disponible pour le moment.");
    }
  }

  async function ouvrirParametresCamera() {
    if (!estNatif) return;
    try {
      await BarcodeScanner.openSettings();
    } catch {
      setErreur("Impossible d'ouvrir les paramètres de l'application.");
    }
  }

  async function importerCapture(event) {
    const fichier = event.target.files?.[0];
    event.target.value = "";
    if (!fichier) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(fichier.type)) {
      setErreur("Choisis une image PNG, JPEG ou WebP.");
      return;
    }
    if (fichier.size <= 0 || fichier.size > TAILLE_IMAGE_MAX) {
      setErreur("L'image doit être non vide et ne pas dépasser 12 Mo.");
      return;
    }

    setErreur("");
    setLectureImage(true);
    await arreterCamera();

    try {
      const { BarcodeDetector } = await import("barcode-detector/ponyfill");
      const detecteur = new BarcodeDetector({ formats: ["qr_code"] });
      const image = await optimiserImagePourLecture(fichier);
      const codes = await detecteur.detect(image);
      const code = codes.find(
        (item) => typeof item?.rawValue === "string" && item.rawValue.trim()
      );

      if (!code?.rawValue) {
        setErreur("Aucun QR code lisible n'a été trouvé dans cette image.");
        setCycleCamera((valeur) => valeur + 1);
        return;
      }

      await validerCodeDetecte(code.rawValue);
    } catch (cause) {
      setErreur(
        cause?.message ||
          "La lecture de cette image a échoué. Essaie une capture plus nette."
      );
      setCycleCamera((valeur) => valeur + 1);
    } finally {
      setLectureImage(false);
    }
  }

  function fermer() {
    void arreterCamera();
    callbackFermerRef.current?.();
  }

  if (!hotePortail) return null;

  const contenu = (
    <div
      className={`grind-scanner-portal ${estNatif ? "grind-scanner-native" : "grind-scanner-web"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="grind-scanner-titre"
    >
      {!estNatif && (
        <div className="grind-scanner-camera-web" aria-hidden="true">
          <video
            ref={videoRef}
            className="grind-scanner-video"
            autoPlay
            muted
            playsInline
          />
        </div>
      )}

      <header className="grind-scanner-header">
        <button
          type="button"
          className="grind-scanner-icon-button"
          onClick={fermer}
          aria-label="Fermer GRIND Scan"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>

        <div className="grind-scanner-brand">
          <span className="grind-scanner-brand-icon">
            <i className="fa-solid fa-qrcode" aria-hidden="true" />
          </span>
          <span>
            <strong id="grind-scanner-titre">GRIND Scan</strong>
            <small>Scanner une invitation de classe</small>
          </span>
        </div>

        <div className="grind-scanner-tools">
          {estNatif && torcheDisponible && (
            <button
              type="button"
              className={`grind-scanner-icon-button ${torcheActive ? "active" : ""}`}
              onClick={basculerTorche}
              aria-label={torcheActive ? "Éteindre la lampe" : "Allumer la lampe"}
              aria-pressed={torcheActive}
            >
              <i className="fa-solid fa-bolt" aria-hidden="true" />
            </button>
          )}
          {estNatif && (
            <button
              type="button"
              className="grind-scanner-icon-button"
              onClick={() =>
                setFaceCamera((actuelle) =>
                  actuelle === LensFacing.Back ? LensFacing.Front : LensFacing.Back
                )
              }
              aria-label="Changer de caméra"
            >
              <i className="fa-solid fa-camera-rotate" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <main className="grind-scanner-main">
        <p className="grind-scanner-instruction">
          Place le QR code au centre du cadre
        </p>

        <div className="grind-scanner-viewfinder" aria-label="Zone de lecture QR">
          <span className="grind-scanner-corner top-left" />
          <span className="grind-scanner-corner top-right" />
          <span className="grind-scanner-corner bottom-left" />
          <span className="grind-scanner-corner bottom-right" />
          {etatCamera === "active" && (
            <span className="grind-scanner-scan-line" aria-hidden="true" />
          )}
          {etatCamera === "initialisation" && (
            <span className="grind-scanner-loading">
              <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
              Préparation de la caméra…
            </span>
          )}
        </div>

        <p className="grind-scanner-status" role="status">
          {lectureImage
            ? "Lecture de l'image sur cet appareil…"
            : etatCamera === "active"
              ? "Le QR code sera vérifié par GRIND avant l'accès à la classe."
              : "La caméra n'est pas encore disponible."}
        </p>

        {erreur && (
          <div className="grind-scanner-error" role="alert">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
            <span>{erreur}</span>
          </div>
        )}

        {etatCamera === "erreur" && estNatif && (
          <button
            type="button"
            className="grind-scanner-secondary"
            onClick={ouvrirParametresCamera}
          >
            <i className="fa-solid fa-gear" aria-hidden="true" />
            Paramètres de la caméra
          </button>
        )}

        <div className="grind-scanner-divider">
          <span>OU</span>
        </div>

        <input
          ref={fichierRef}
          className="grind-scanner-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/*"
          onChange={importerCapture}
          aria-label="Importer une image contenant un QR code"
        />
        <button
          type="button"
          className="grind-scanner-import"
          onClick={() => fichierRef.current?.click()}
          disabled={lectureImage}
        >
          {lectureImage ? (
            <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
          ) : (
            <i className="fa-regular fa-image" aria-hidden="true" />
          )}
          {lectureImage ? "Lecture de l'image…" : "Importer une capture d'écran"}
        </button>

        <small className="grind-scanner-privacy">
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          L'image est lue sur ton appareil. Elle n'est pas envoyée à GRIND.
        </small>
      </main>
    </div>
  );

  return createPortal(contenu, hotePortail);
}
