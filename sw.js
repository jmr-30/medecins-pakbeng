// Service worker — Les Médecins de Pakbeng
// Rôle : faire fonctionner l'application sans connexion, et récupérer les nouvelles versions quand le réseau revient.
// Les données (consultations, stock…) ne passent jamais par ici : elles restent dans la base locale de la tablette.
const CACHE = 'medecins-pakbeng-v1';
const COEUR = ['./', './index.html', './manifest.webmanifest', './lib/xlsx.full.min.js', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
const EXTERNES = [];   // tout est livré avec l'application (y compris la bibliothèque Excel dans lib/)

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(COEUR);
    // La bibliothèque Excel est utile mais pas indispensable : son échec ne bloque pas l'installation
    await Promise.all(EXTERNES.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function prevenirNouvelleVersion() {
  for (const cl of await self.clients.matchAll({ type: 'window' })) cl.postMessage({ type: 'nouvelle-version' });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // La page de l'application : version en cache tout de suite (hors ligne garanti),
  // puis mise à jour en arrière-plan si le réseau répond. La nouvelle version sert au démarrage suivant.
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const enCache = await c.match('./index.html');
      const copie = enCache ? enCache.clone() : null;   // la réponse servie à la page ne peut plus être relue ensuite
      const reseau = fetch('./index.html', { cache: 'no-cache' }).then(async r => {
        if (r.ok) {
          const nouveau = await r.clone().text();
          const ancien = copie ? await copie.text() : null;
          await c.put('./index.html', r.clone());
          if (ancien !== null && ancien !== nouveau) prevenirNouvelleVersion();
        }
        return r;
      }).catch(() => null);
      if (enCache) { e.waitUntil(reseau); return enCache; }
      return (await reseau) || new Response('Application indisponible hors ligne : ouvrez-la une première fois avec une connexion.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  // Le reste (icônes, bibliothèque Excel, polices) : cache d'abord, réseau sinon, puis mise en cache
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const enCache = await c.match(req, { ignoreSearch: url.origin === location.origin });
    if (enCache) return enCache;
    try {
      const r = await fetch(req);
      if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
      return r;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
