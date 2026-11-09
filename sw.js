/* ============================================================
   LA JUNGLA · Service Worker (PWA)
   - App shell en caché: la app abre sin conexión.
   - Supabase/CDN: caché con actualización en segundo plano (stale-while-revalidate).
   - La API de Supabase nunca se cachea por POST/auth.
   ============================================================ */

const CACHE = 'la-jungla-v1';

// Si el service worker se registró sobre file:// (app abierta con doble
// clic), la API Cache no funciona: no se intercepta nada.
const ES_FILE = self.location.protocol === 'file:';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/lib/db.js',
  './js/lib/ui.js',
  './js/lib/icons.js',
  './js/lib/formato.js',
  './js/lib/permisos.js',
  './js/views/login.js',
  './js/views/panel.js',
  './js/views/caballos.js',
  './js/views/alimentacion.js',
  './js/views/inventario.js',
  './js/views/herrajes.js',
  './js/views/veterinario.js',
  './js/views/competencias.js',
  './js/views/usuarios.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/flaticon/cabeza-de-caballo.png',
  './icons/flaticon/herradura.png',
  './public/logo.webp',
  './public/logo.png',
];

self.addEventListener('install', (evento) => {
  if (ES_FILE) return;
  evento.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(APP_SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  if (ES_FILE) return;
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** ¿Es un recurso de datos que jamás debe quedar guardado? */
function esDinamico(url) {
  return url.pathname.includes('/auth/v1/') ||
         url.pathname.includes('/rest/v1/') ||
         url.pathname.includes('/realtime/v1/') ||
         url.pathname.includes('/storage/v1/');
}

self.addEventListener('fetch', (evento) => {
  if (ES_FILE) return;
  const { request } = evento;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // La API Cache solo admite http(s). Si la app se abrió con doble clic
  // (file://), no se intercepta nada: mejor dejar que el navegador falle
  // a su manera antes que reventar con "Request scheme 'file' is unsupported".
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navegaciones: red primero, app shell como respaldo (funciona offline)
  if (request.mode === 'navigate') {
    evento.respondWith(
      fetch(request)
        .then((r) => {
          const copia = r.clone();
          // Nunca propagar fallos de caché: no son críticos
          caches.open(CACHE).then((c) => c.put('./index.html', copia)).catch(() => {});
          return r;
        })
        .catch(() => caches.match('./index.html').then((r) => r || Response.error())),
    );
    return;
  }

  // Datos / API: siempre red (sin cachear)
  if (url.origin !== self.location.origin || esDinamico(url)) return;

  // Estáticos: caché primero, luego red (y actualizar caché en segundo plano)
  evento.respondWith(
    caches.match(request).then((cachada) => {
      const red = fetch(request)
        .then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put(request, copia)).catch(() => {});
          }
          return r;
        })
        .catch(() => cachada || Response.error());
      return cachada || red;
    }),
  );
});
