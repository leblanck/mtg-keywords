// sw.js — MTG Keyword Encyclopedia service worker
//
// Strategy:
//   • Navigation requests (HTML)  → network-first, cache fallback
//   • Scryfall API calls          → network-first, cache fallback
//   • Google Fonts                → network-first, cache fallback
//   • Vite hashed JS/CSS assets   → NOT intercepted — let the browser handle them
//     (Vite's content-hashed filenames are their own cache-busting mechanism;
//      intercepting them risks serving stale bundles after a deploy)

const SHELL_CACHE   = "mtg-kw-shell-v2";
const API_CACHE     = "mtg-kw-api-v2";
const FONT_CACHE    = "mtg-kw-fonts-v2";
const SCRYFALL_HOST = "api.scryfall.com";

// ── Message handler — receive SKIP_WAITING from the app ──────────────────────
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ── Install ───────────────────────────────────────────────────────────────────
// Only pre-cache index.html and manifest — NOT the hashed JS/CSS bundles,
// because we don't know their names at SW install time.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache =>
      cache.addAll(["/", "/index.html", "/manifest.json"])
        .catch(() => {
          // Non-fatal: if pre-caching fails (e.g. offline install), continue
        })
    )
  );
  self.skipWaiting();
});

// ── Activate: purge old cache versions ───────────────────────────────────────
self.addEventListener("activate", event => {
  const CURRENT = new Set([SHELL_CACHE, API_CACHE, FONT_CACHE]);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !CURRENT.has(k)).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // ── Only handle GET requests ──
  if (request.method !== "GET") return;

  // ── Scryfall API → network-first ──
  if (url.hostname === SCRYFALL_HOST) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // ── Google Fonts → network-first, long-lived cache ──
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(networkFirst(request, FONT_CACHE));
    return;
  }

  // ── HTML navigation requests → network-first, fall back to cached index.html ──
  if (request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then(res => {
          // Cache a fresh copy of the HTML for offline use
          if (res.ok) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(async () => {
          // Offline — serve the cached index.html so the SPA can still boot
          const cached = await caches.match("/index.html");
          return cached ?? new Response(
            "<!doctype html><html><body style='background:#1d2021;color:#fabd2f;font-family:monospace;padding:2rem'>" +
            "<h2>-- offline --</h2><p>MTG Keywords needs a network connection on first load.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // ── Vite hashed JS / CSS bundles → DO NOT intercept ──
  // Vite fingerprints these files (e.g. index-Bx3kP9qR.js). The browser's
  // native HTTP cache handles them correctly. Intercepting them here risks
  // returning a stale bundle after a new deploy.
  if (request.destination === "script" || request.destination === "style") {
    return;
  }

  // ── Everything else (images, fonts loaded as fetch, etc.) → network only ──
  // No interception — let the browser handle it natively.
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return an empty 503 rather than letting the SW throw,
    // which would show a browser error page instead of letting
    // the app handle it gracefully.
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}