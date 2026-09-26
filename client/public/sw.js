// KUWIFR service worker — makes the site installable as an app.
// Deliberately network-only: nothing (pages, API responses, wallet data) is
// cached, so members always see live data and every deploy is picked up
// immediately. The only thing it adds is a friendly offline screen when a
// page navigation fails because the device has no connection.
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>KUWIFR — Offline</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fdfaf5;color:#1c2a2a;text-align:center;padding:24px}
img{width:96px;height:96px;border-radius:50%}h1{font-size:20px;margin:18px 0 6px}p{color:#737373;margin:0 0 20px}
button{background:#008080;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-weight:700;font-size:15px}</style>
</head><body><div><img src="/icons/icon-192.png" alt="KUWIFR"><h1>You're offline</h1>
<p>Check your internet connection and try again.</p><button onclick="location.reload()">Retry</button></div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("kuwifr-offline-v1").then((c) => c.add("/icons/icon-192.png")).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== "kuwifr-offline-v1").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
      )
    );
    return;
  }

  if (new URL(request.url).pathname === "/icons/icon-192.png") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
  }
});
