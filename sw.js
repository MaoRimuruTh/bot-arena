// BoT Arena service worker: the app's own files load instantly and still open offline.
// Card data, card art, fonts and Firebase come live from their own sites and are never touched here.
const SHELL = "bot-shell-1"; // bump when an unversioned file (textures, icons) changes
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== self.location.origin) return;
  // the page, the version file and the manifest: network first, so a new deploy shows up at once
  if (u.pathname.endsWith("/") || /\.(html|json|webmanifest)$/.test(u.pathname)) {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const c = r.clone(); caches.open(SHELL).then((ca) => ca.put(req, c)); } return r; }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  // scripts and styles carry ?v=<version>, so a cached copy is never stale; older versions of the same file are dropped
  e.respondWith(caches.open(SHELL).then(async (ca) => {
    const hit = await ca.match(req); if (hit) return hit;
    const r = await fetch(req);
    if (r.ok) { await ca.put(req, r.clone()); if (u.search) for (const k of await ca.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) ca.delete(k); } }
    return r;
  }));
});
