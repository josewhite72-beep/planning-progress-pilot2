const CACHE_NAME = 'planning-pilot-v2.3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png',
  '/sw.js',
  // Google Fonts - CSS
  'https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;600;700&family=Outfit:wght@800;900&display=swap'
];

// Instalación: cachear recursos esenciales
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos esenciales');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Todos los archivos cacheados');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Error al cachear:', err);
      })
  );
});

// Activación: limpiar caches antiguos
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Cache limpio, tomando control');
      return self.clients.claim();
    })
  );
});

// Fetch: estrategia cache-first con network fallback y caché dinámico
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Estrategia especial para Google Fonts
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then(response => {
        if (response) {
          return response;
        }
        
        return fetch(request).then(networkResponse => {
          // Cachear las fuentes dinámicamente
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Si falla, la app usará fuentes del sistema
          console.log('[SW] Fuentes no disponibles, usando fallback del sistema');
          return new Response('', { status: 200 });
        });
      })
    );
    return;
  }
  
  // Estrategia cache-first para todos los demás recursos
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Cache hit - retornar respuesta cacheada
        if (response) {
          console.log('[SW] Sirviendo desde cache:', request.url);
          return response;
        }
        
        // No está en cache - ir a la red
        console.log('[SW] Fetching desde red:', request.url);
        return fetch(request).then(networkResponse => {
          
          // Verificar si es una respuesta válida
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          
          // Clonar la respuesta para guardar en cache
          const responseToCache = networkResponse.clone();
          
          // Guardar en cache dinámicamente
          caches.open(CACHE_NAME)
            .then(cache => {
              console.log('[SW] Cacheando recurso nuevo:', request.url);
              cache.put(request, responseToCache);
            });
          
          return networkResponse;
        }).catch(error => {
          console.error('[SW] Fetch falló:', error);
          
          // Offline fallback para navegación
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          
          // Para otros recursos, retornar respuesta vacía
          return new Response('Offline - Recurso no disponible en cache', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// Mensaje desde el cliente
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Mensaje recibido: SKIP_WAITING');
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker cargado');
