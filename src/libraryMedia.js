import { urlFichierDocumentLibrary } from "./api.js";
import {
  stockageAndroidDisponible,
  enregistrerMediaAndroid,
  ouvrirFichierAndroid,
  chercherMediaEnregistre,
  ecouterProgressionMedia,
  telechargerDansNavigateur,
} from "./mediaStorage.js";

const MAX_DOCUMENT_OCTETS = 30 * 1024 * 1024;

function nomFichierSecurise(value) {
  const nom = String(value || "document-grind").replace(/[\\/:*?"<>|]/g, "_").trim();
  return nom.slice(0, 180) || "document-grind";
}

export async function telechargerDocumentLibrary(sessionToken, document, onProgress = null) {
  if (!sessionToken || !document?.id) throw new Error("Document ou session invalide.");
  const nom = nomFichierSecurise(document.fichier_nom);
  const mime = String(document.fichier_type || "application/octet-stream");
  const fileName = `GRIND-${document.id}-${nom}`;

  if (stockageAndroidDisponible()) {
    const dejaEnregistre = await chercherMediaEnregistre(fileName, mime);
    if (dejaEnregistre?.path) {
      onProgress?.(100);
      await ouvrirFichierAndroid(dejaEnregistre.path, mime);
      return dejaEnregistre;
    }
    const url = await urlFichierDocumentLibrary(sessionToken, document.id);
    const requestId = `library-${document.id}-${Date.now()}`;
    const abonnement = await ecouterProgressionMedia(event => {
      if (event?.requestId === requestId) onProgress?.(event.percent === -1 ? -1 : Number(event.percent) || 0);
    });
    try {
      const local = await enregistrerMediaAndroid({
        url,
        fileName,
        mimeType: mime,
        requestId,
        maxBytes: MAX_DOCUMENT_OCTETS,
      });
      if (!local?.path) throw new Error("Le document n'a pas été enregistré sur cet appareil.");
      onProgress?.(100);
      await ouvrirFichierAndroid(local.path, mime);
      return local;
    } finally {
      await abonnement?.remove?.();
    }
  }

  const url = await urlFichierDocumentLibrary(sessionToken, document.id);
  return telechargerDansNavigateur(url, nom, onProgress, { size: Number(document.taille_octets || 0), maxBlobBytes: MAX_DOCUMENT_OCTETS });
}
