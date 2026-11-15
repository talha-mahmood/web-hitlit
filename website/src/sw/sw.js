/* HitLit service worker (built by the hitlit-site plugin in vite.config.ts).
 *
 * - App shell + every JS/CSS chunk of this build are cached on install, so
 *   the site opens offline (live scoring already queues its writes offline).
 * - Page loads go to the network first; offline they get the cached shell
 *   of this same build (so the shell always matches its cached chunks).
 * - Images and other same-origin files: cache first, kept to a fixed count.
 * - Anything cross-origin (Supabase, maps, fonts CDN…) is never touched.
 */
const BUILD = "__BUILD_ID__";
const PRECACHE = __PRECACHE__;
const SHELL_CACHE = `hitlit-shell-${BUILD}`;
const MEDIA_CACHE = "hitlit-media";
const MEDIA_LIMIT = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(["/", ...PRECACHE]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("hitlit-shell-") && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MEDIA_LIMIT; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/.well-known/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/", { cacheName: SHELL_CACHE })));
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          // A file that no longer exists (an old build's chunk) comes back as
          // the SPA's index.html with a 200: never store that under its URL.
          const isHtml = (response.headers.get("content-type") || "").includes("text/html");
          if (response.ok && response.type === "basic" && !isHtml && !url.pathname.endsWith(".map")) {
            const copy = response.clone();
            caches.open(MEDIA_CACHE).then((cache) => cache.put(request, copy).then(() => trim(cache)));
          }
          return response;
        })
    )
  );
});
