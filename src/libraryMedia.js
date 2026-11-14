import { urlFichierDocumentLibrary } from "./api.js";
import {
  stockageAndroidDisponible,
  enregistrerMediaAndroid,
  ouvrirFichierAndroid,
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
  const url = urlFichierDocumentLibrary(sessionToken, document.id);

  if (stockageAndroidDisponible()) {
    const local = await enregistrerMediaAndroid({
      url,
      fileName: `GRIND-${document.id}-${nom}`,
      mimeType: mime,
      requestId: `library-${document.id}`,
      maxBytes: MAX_DOCUMENT_OCTETS,
    });
    if (!local?.path) throw new Error("Le document n'a pas été enregistré sur cet appareil.");
    onProgress?.(100);
    await ouvrirFichierAndroid(local.path, mime);
    return local;
  }

  return telechargerDansNavigateur(url, nom, onProgress);
}
