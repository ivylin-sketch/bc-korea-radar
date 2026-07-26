const CACHE_NAME = "bc-korea-radar-phase0-v3";
const APP_URL = new URL("./index.html", self.registration.scope).href;
const APP_SHELL = [
  APP_URL,
  new URL("./manifest.webmanifest", self.registration.scope).href,
  new URL("./icon-192.png", self.registration.scope).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches
        .match(event.request)
        .then((cached) => cached || caches.match(APP_URL)),
    ),
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "BC Korea Radar",
    body: "新的韩国 X 审美趋势简报已更新。",
    url: "./index.html",
    type: "normal",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: new URL("./icon-192.png", self.registration.scope).href,
      badge: new URL("./badge-96.png", self.registration.scope).href,
      tag: `bc-radar-${payload.type}`,
      renotify: true,
      data: { url: payload.url || "./index.html" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "./index.html",
    self.registration.scope,
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === targetUrl);
      if (existing && "focus" in existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
