// Divido · Service Worker mínimo (estrategia network-first)
// Satisface los criterios de instalabilidad PWA en Chrome y Safari.
const CACHE_NAME = "divido-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// Notificaciones push: se muestran como notificación del sistema.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    // cuerpo no JSON: se muestra un aviso genérico
  }
  const title = payload.title || "Divido";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/logo.svg",
    badge: payload.badge || "/logo.svg",
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Al hacer clic en la notificación se abre (o se enfoca) la app en el enlace.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Solo interesa el mismo origen; la API se sirve siempre desde la red
  // para no devolver datos obsoletos.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Network-first: primero red y se guarda la respuesta en caché;
  // si no hay conexión se responde desde la caché.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === "navigate") return caches.match("/index.html");
          return undefined;
        })
      )
  );
});
