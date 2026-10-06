// Service worker minimal — son seul but est de rendre GRIND "installable"
// (critère technique requis par Android/PWABuilder pour générer l'APK).
// Il ne met en cache QUE la coquille de l'app, jamais les appels API —
// ceux-ci passent toujours directement au réseau, sans interception.

const CACHE = "grind-coquille-v1";
const FICHIERS_COQUILLE = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS_COQUILLE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Jamais d'interception pour l'API, les WebSockets, ou un autre domaine
  // (Cloudinary, TURN...) — uniquement la coquille statique du même site.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((reponse) => reponse || fetch(event.request))
  );
});
