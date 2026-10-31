// Copia offline dell'app. Cambia VERSIONE quando aggiorni i file.
// I file dell'app vengono sempre chiesti prima al server (senza usare copie vecchie).
// La copia salvata sul dispositivo si usa quando manca internet oppure quando il sito
// non risponde correttamente (per esempio se la pubblicazione è sospesa): così l'app
// installata continua a funzionare.
const VERSIONE = 'vetrate-v16';
const FILE = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'three.module.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSIONE)
      .then(c => c.addAll(FILE.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

// Safari rifiuta le pagine servite dal service worker se la risposta ha subito un reindirizzamento
function pulita(r) {
  if (!r.redirected) return r;
  return r.blob().then(b => new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers }));
}

function dallaCopia(req) {
  return caches.match(req, { ignoreSearch: true })
    .then(r => r || (req.mode === 'navigate' ? caches.match('index.html').then(x => x || caches.match('./')) : undefined));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(pulita)
        .then(r => {
          if (r.ok) {
            const c = r.clone();
            caches.open(VERSIONE).then(x => x.put(e.request, c));
            return r;
          }
          // sito non disponibile (es. pagina non trovata): meglio la copia salvata
          return dallaCopia(e.request).then(c => c || r);
        })
        .catch(() => dallaCopia(e.request))
    );
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        if (res.ok || res.type === 'opaque') { const c = res.clone(); caches.open(VERSIONE).then(x => x.put(e.request, c)); }
        return res;
      }))
    );
  }
});
