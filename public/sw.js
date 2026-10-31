// Service worker de GRIND — sert à rendre l'app "installable" (APK via PWABuilder).
//
// IMPORTANT : stratégie "réseau d'abord". L'ancienne version servait la page
// d'accueil depuis le cache sans jamais le renouveler, ce qui bloquait le
// téléphone sur une vieille version de GRIND quoi qu'on déploie. Désormais :
// on va toujours chercher la version en ligne, et le cache ne sert qu'en secours
// quand il n'y a pas de réseau.
// Quand tu veux forcer une mise à jour chez tout le monde, change le numéro ci-dessous.

const CACHE = "grind-coquille-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["/manifest.json", "/icon-192.png", "/icon-512.png"]))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Supprime l'ancien cache (v1) qui contenait la vieille page d'accueil.
      const noms = await caches.keys();
      await Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
      // Recharge une fois les fenêtres ouvertes pour afficher la nouvelle version.
      const fenetres = await self.clients.matchAll({ type: "window" });
      fenetres.forEach((f) => {
        try {
          f.navigate(f.url);
        } catch (e) {
          /* ignoré */
        }
      });
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  const url = new URL(requete.url);

  // Jamais d'interception pour l'API, les WebSockets, un autre domaine
  // (Cloudinary, LiveKit...) ni pour autre chose qu'une lecture.
  if (
    requete.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/ws")
  ) {
    return;
  }

  event.respondWith(
    fetch(requete)
      .then((reponse) => {
        if (reponse && reponse.ok) {
          const copie = reponse.clone();
          caches.open(CACHE).then((cache) => cache.put(requete, copie)).catch(() => {});
        }
        return reponse;
      })
      .catch(() =>
        caches.match(requete).then(
          (enCache) => enCache || (requete.mode === "navigate" ? caches.match("/") : undefined)
        )
      )
  );
});
