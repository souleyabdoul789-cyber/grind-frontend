import { Capacitor, registerPlugin } from "@capacitor/core";

const GrindMedia = registerPlugin("GrindMedia");

export function stockageAndroidDisponible() {
  return Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform();
}

export function sourceLocaleMedia(path) {
  if (!path) return null;
  return Capacitor.convertFileSrc(path);
}

export async function nettoyerCacheMediaAndroid() {
  if (!stockageAndroidDisponible()) return null;
  return GrindMedia.cleanupExpired();
}

export async function effacerCacheClasseMediaAndroid(userKey, classId) {
  if (!stockageAndroidDisponible()) return null;
  return GrindMedia.clearClassCache({ userKey, classId });
}

export async function chercherMediaTemporaire(fileName, mimeType) {
  if (!stockageAndroidDisponible()) return null;
  const result = await GrindMedia.findCached({ fileName, mimeType });
  return result?.exists ? result : null;
}

export async function chercherMediaEnregistre(fileName, mimeType) {
  if (!stockageAndroidDisponible()) return null;
  const result = await GrindMedia.findSaved({ fileName, mimeType });
  return result?.exists ? result : null;
}

export async function enregistrerMediaCacheAndroid(sourceFileName, targetFileName, mimeType) {
  if (!stockageAndroidDisponible()) return null;
  return GrindMedia.saveCached({ sourceFileName, targetFileName, mimeType });
}

export async function mettreEnCacheMedia({ url, fileName, mimeType, requestId, maxBytes }) {
  if (!stockageAndroidDisponible()) return null;
  return GrindMedia.downloadToTemp({ url, fileName, mimeType, requestId, maxBytes });
}

export async function enregistrerMediaAndroid({ url, fileName, mimeType, requestId, maxBytes }) {
  if (!stockageAndroidDisponible()) return null;
  return GrindMedia.downloadToSaved({ url, fileName, mimeType, requestId, maxBytes });
}

export async function ouvrirFichierAndroid(path, mimeType) {
  if (!stockageAndroidDisponible()) return null;
  return GrindMedia.openFile({ path, mimeType });
}

export async function ecouterProgressionMedia(callback) {
  if (!stockageAndroidDisponible()) return { remove: async () => {} };
  return GrindMedia.addListener("downloadProgress", callback);
}

export async function telechargerDansNavigateur(url, fileName, onProgress = null, options = {}) {
  const maxBlobBytes = Math.max(0, Number(options.maxBlobBytes ?? 32 * 1024 * 1024));
  const knownSize = Number(options.size || 0);
  const nativeDownload = () => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName || "fichier-grind";
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return { success: true, delegated: true };
  };
  if (knownSize > maxBlobBytes) return nativeDownload();

  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    let detail = "";
    try { const data = await response.clone().json(); detail = typeof data.detail === "string" ? data.detail : ""; } catch {}
    if (response.status === 401 || response.status === 403) throw new Error("Le lien de téléchargement a expiré. Relance le téléchargement depuis GRIND.");
    if (response.status === 404) throw new Error("Ce fichier n'est plus disponible.");
    throw new Error(detail || "Le fichier n'a pas pu être récupéré. Réessaie plus tard.");
  }

  const total = Number(response.headers.get("content-length") || knownSize || 0);
  if (total > maxBlobBytes) {
    try { await response.body?.cancel(); } catch {}
    return nativeDownload();
  }
  const reader = response.body?.getReader?.();
  if (!reader) {
    // Sans streaming natif, le navigateur gère directement la sauvegarde :
    // ne jamais construire un Blob potentiellement volumineux en mémoire.
    return nativeDownload();
  }
  const chunks = [];
  let received = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBlobBytes) {
        await reader.cancel().catch(() => {});
        return nativeDownload();
      }
      chunks.push(value);
      onProgress?.(total > 0 ? Math.min(99, Math.round(received * 100 / total)) : -1);
    }
  } else {
    const blob = await response.blob();
    if (blob.size > maxBlobBytes) return nativeDownload();
    chunks.push(blob); received = blob.size;
  }
  const blob = new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
  onProgress?.(100);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl; anchor.download = fileName || "fichier-grind";
  anchor.style.display = "none"; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  return { success: true, size: blob.size };
}
