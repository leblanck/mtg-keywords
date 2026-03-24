// sw.js — MTG Keyword Encyclopedia service worker
// Strategy:
//   • App shell (HTML, JS, CSS, fonts) → cache-first, update in background
//   • Scryfall API calls              → network-first, fall back to cache
//   • Everything else                 → network only

const SHELL_CACHE   = "mtg-kw-shell-v1";
const API_CACHE     = "mtg-kw-api-v1";
const SCRYFALL_HOST = "api.scryfall.com";

// Files that make up the app shell — adjust paths to match your Vite build output
const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clear old caches ────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: route requests ─────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Scryfall API → network-first, cache fallback
  if (url.hostname === SCRYFALL_HOST) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Google Fonts → network-first (don't block on failure)
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // App shell assets → cache-first
  if (request.destination === "document" || request.destination === "script" || request.destination === "style") {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // Everything else → network only
  // (no-op: browser handles it normally)
});

// ── Strategies ────────────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not cached — return a simple offline page for navigations
    if (request.destination === "document") {
      return new Response("<h1 style='font-family:monospace;color:#fabd2f;background:#1d2021;padding:2rem'>-- offline --<br>MTG Keywords needs a connection on first load.</h1>", {
        headers: { "Content-Type": "text/html" },
      });
    }
    throw new Error("Offline and not cached");
  }
}

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
    throw new Error("Network failed and no cache available");
  }
}