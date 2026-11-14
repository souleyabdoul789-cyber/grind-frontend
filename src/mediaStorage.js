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

export async function telechargerDansNavigateur(url, fileName, onProgress = null) {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    // Ne jamais naviguer vers la réponse JSON du serveur ni exposer sa structure brute.
    let detail = "";
    try {
      const data = await response.clone().json();
      detail = typeof data.detail === "string" ? data.detail : "";
    } catch { /* réponse non JSON */ }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Ta session n'autorise plus l'accès à ce fichier. Reconnecte-toi.");
    }
    if (response.status === 404) throw new Error("Ce fichier n'est plus disponible.");
    throw new Error(detail || "Le fichier n'a pas pu être récupéré. Réessaie plus tard.");
  }

  const total = Number(response.headers.get("content-length") || 0);
  let blob;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const morceaux = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      morceaux.push(value);
      received += value.byteLength;
      onProgress?.(total > 0 ? Math.min(99, Math.round(received * 100 / total)) : -1);
    }
    blob = new Blob(morceaux, { type: response.headers.get("content-type") || "application/octet-stream" });
    onProgress?.(100);
  } else {
    blob = await response.blob();
    onProgress?.(100);
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName || "fichier-grind";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  return { success: true, size: blob.size };
}
