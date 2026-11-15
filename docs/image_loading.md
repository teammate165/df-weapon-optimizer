# Portrait loading and browser caching

Portraits remain external assets. The open attachment list and equipped portraits load eagerly in parallel; the weapon gallery remains lazy. Preconnect hints reduce connection setup to the two source hosts. This is multiple overlapping requests, not one bundled download, and does not eagerly download the entire catalog.

Portrait cutouts and the weapon image show an animated loading indicator until load/error settles. Failed portraits retain the existing socket fallback. Reduced-motion preferences disable the animation.

`builder/image-cache-sw.js` caches only image requests to `playerhub.df.qq.com` and `dfttk.com`. It stores up to 160 readable image responses for seven days, deduplicates simultaneous requests, and bypasses non-images, HTML, scripts, API and model data. The worker requests CORS-readable images; sources without CORS fall back to ordinary image loading without persistent storage. Failed responses are not cached. Storage failures do not prevent normal image loading. This cache lives on the visitor's browser, can be cleared or evicted, and is separate for localhost and the deployed Pages origin. It improves repeat visits; it does not reduce source latency for an uncached image.

Registration uses a relative scope so repository-subpath hosting works. The Pages exporter copies the worker and loader as ordinary JS files, and versions their references with the release token. No hosting configuration, image upload or backend is required. Local preview assets retain `no-store`; the service worker intercepts only external images.

Compatibility evidence: [GitHub Pages supports HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https), and [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) provide browser-side request handling and Cache Storage over secure contexts. Thus browser-side image caching works with Pages static hosting. Source headers checked on 2026-11-15 for portrait `13110000099`: `Access-Control-Allow-Origin: *`, `Content-Length: 324159`, `Cache-Control: max-age=3600`.

Validation: `.scratch/browser-qa/image-loading-check.cjs` mocks delayed image responses and checks overlapping requests, loading indicators, persistent entries and offline cache hits. It uses a fresh browser context so normal HTTP cache cannot disguise the initial behavior. The generated export is additionally checked under a repository-style subpath.
