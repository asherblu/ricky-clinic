// Service Worker בסיסי — נדרש כדי שהדפדפן יאפשר "התקנה" (Add to Home Screen / Install) של האפליקציה.
// שומר עותק מקומי (cache) של קבצי האפליקציה כדי שתיפתח מהר יותר ותעבוד גם בלי אינטרנט לרגע.
// כשיוצאת גרסה חדשה של index.html, כדאי לעדכן את מספר הגרסה כאן (CACHE_NAME) כדי שהדפדפן ימשוך את הגרסה החדשה.
const CACHE_NAME = "ricky-clinic-cache-v2.6";
const ASSETS = ["./", "./index.html", "./sign.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
