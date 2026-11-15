// Cache only portraits, never application code, model data, API responses or navigation.
const CACHE = 'df-portraits-v1';
const LIMIT = 160;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const pending = new Map();
let writes = Promise.resolve();
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function portrait(request) {
  let cache;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(request.url);
    if (hit && Date.now() - Number(hit.headers.get('x-df-cached-at')) < MAX_AGE) return hit;
    if (hit) await cache.delete(request.url);
  } catch { /* Private browsing or quota restrictions must not block images. */ }
  let response;
  try {
    response = await fetch(new Request(request.url, {mode: 'cors', credentials: 'omit'}));
  } catch {
    return fetch(request); // Hosts without CORS still load normally; opaque results are not stored.
  }
  if (cache && response.ok && response.headers.get('content-type')?.startsWith('image/')) {
    const headers = new Headers(response.headers);
    headers.set('x-df-cached-at', String(Date.now()));
    const stored = new Response(await response.clone().blob(), {status: response.status, headers});
    writes = writes.catch(() => {}).then(async () => {
      await cache.put(request.url, stored);
      const keys = await cache.keys();
      for (const key of keys.slice(0, Math.max(0, keys.length - LIMIT))) await cache.delete(key);
    });
    await writes.catch(() => {});
  }
  return response;
}
self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.destination !== 'image' ||
      !['playerhub.df.qq.com', 'dfttk.com'].includes(url.hostname)) return;
  // Layer tiles have immutable hash URLs but no CORS headers. A speculative
  // CORS fetch followed by an opaque retry doubles requests and stalls assembly.
  // Let normal browser HTTP caching handle these tiles directly.
  if(url.hostname==='dfttk.com'&&url.pathname.startsWith('/data/weapon-layers/'))return;
  event.respondWith((async () => {
    let work = pending.get(url.href);
    if (!work) {
      work = portrait(request);
      pending.set(url.href, work);
    }
    try { return (await work).clone(); }
    finally { if (pending.get(url.href) === work) pending.delete(url.href); }
  })());
});
