/* Offline reads only. Never cache or enqueue a write to the shared campaign. */
const CACHE = "xia-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(["/", "/favicon.svg", "/manifest.webmanifest"]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("xia-shell-") && k !== CACHE)
              .map((k) => caches.delete(k)),
          ),
        ),
    ]),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_SHELL") return;
  const urls = (event.data.urls || []).filter((url) => {
    try {
      const u = new URL(url, self.location.origin);
      return (
        u.origin === self.location.origin &&
        !u.pathname.startsWith("/api/") &&
        /\.(js|css|woff2?|svg)(\?|$)/.test(u.href)
      );
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(urls.map((url) => cache.add(url)))),
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (
    req.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  // Module documents must never replace the cached application shell.
  if (url.pathname.startsWith("/modules/")) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.ok)
            event.waitUntil(
              caches
                .open(CACHE)
                .then((cache) => cache.put(req, response.clone()))
                .catch(() => {}),
            );
          return response;
        })
        .catch(
          async () =>
            (await caches.match(req)) ||
            new Response("此资料尚未缓存，请联网后打开。", { status: 503 }),
        ),
    );
    return;
  }
  if (req.mode === "navigate") {
    const key = url.pathname === "/" ? "/" : req;
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.ok)
            event.waitUntil(
              caches
                .open(CACHE)
                .then((cache) => cache.put(key, response.clone()))
                .catch(() => {}),
            );
          return response;
        })
        .catch(
          async () =>
            (await caches.match(key)) ||
            new Response("此页面尚未缓存，请联网后打开。", { status: 503 }),
        ),
    );
    return;
  }
  if (/\.(js|css|woff2?|svg)(\?|$)/.test(url.href))
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((response) => {
            if (response.ok)
              caches
                .open(CACHE)
                .then((cache) => cache.put(req, response.clone()));
            return response;
          }),
      ),
    );
});
