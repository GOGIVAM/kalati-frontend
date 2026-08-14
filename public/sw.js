/*
 * Service worker KALATI Chat.
 *
 * Rôle volontairement limité : mettre en cache la coquille applicative pour que
 * l'interface se charge hors connexion et puisse afficher l'indicateur hors-ligne
 * ainsi que la file d'attente des questions.
 *
 * Le pipeline RAG s'exécute intégralement côté serveur : aucune réponse ne peut
 * être produite hors ligne. Les requêtes /api/ ne sont donc JAMAIS mises en cache
 * — ni les réponses, ni les extraits du corpus, ni les journaux — afin de ne pas
 * laisser de données normatives sur le poste de l'agent.
 */

const SHELL_CACHE = 'kalati-shell-v1';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Jamais de mise en cache des appels d'API ni des données du corpus.
  if (url.pathname.startsWith('/api/')) return;
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Navigation : réseau d'abord, coquille en cache si l'intranet est injoignable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    );
    return;
  }

  // Ressources statiques : cache d'abord, puis réseau.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
