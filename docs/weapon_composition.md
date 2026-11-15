# Attachment-aware weapon portraits

Topic sections: [Overview](#attachment-aware-weapon-portraits) ? [Portrait loading and browser caching](#image-loading) ? [Builder portrait audit](#portrait-audit)

The builder now composes the actual resolved attachment layout, including bundled components and conditional adapters. Attachment previews, equipped builds and optimizer solution previews share this renderer. Calibration sliders do not reposition the artwork.

The implementation uses DFTTK's [public layer catalogs](https://dfttk.com/data/weapon-layers/m4/index.json) and follows its [current builder's](https://dfttk.com/static/WeaponBuilderV3-DNrXxWog.js) socket/visibility/pose rules. Catalog transitions resolve each mounted item to a pose. Conditional rules supply connector/sight geometry; source-specific stock/optic ambiguity rules retain their original IDs. Pose tiles are drawn in band order with tight cropping and a small margin. These are layered source images, not a 3D renderer or a generated approximation of the build.

[Renderer](../builder/weapon-layers.js) loads per-weapon metadata, caches eight catalogs and limits retained image tiles to approximately 32 million pixels. Images stay on DFTTK's host. Metadata is saved locally because that host does not provide the cross-origin fetch headers required by independently hosted pages. Both local backend and static exports serve the same metadata. No remote rendering POSTs are made.

The [catalog manifest](../builder/assets/weapon-layers/manifest.json) records source URLs, retrieval date and SHA-256 hashes for 71 catalogs: 69 base weapon directories plus PKM/SR25 variant directories. AN94 uses its source experience directory. Refresh with:

```powershell
python tools/sync_weapon_layers.py --refresh
python tools/build_github_pages.py
```

Without `--refresh`, the metadata fetcher reuses the saved catalogs. Image tiles remain external requests and can fail independently. During loading, both the old canvas and static base image are hidden; only the loading indicator is shown. The current weapon's static base reference appears only after an actual composition failure and is clearly labeled. Failed composites can be retried with click, Enter or Space. A request serial prevents late results from replacing a newer preview. Composition cannot be exported from canvas when source images lack CORS permission; display and build JSON saves still work.

## Validation and source limitations

- All 69 default weapon layouts resolve.
- 690 sampled default/replacement mount graphs exactly match the isolated DFTTK reference resolver. One context is unsupported by DFTTK itself: QJB 201 `18040000004` with magazine `13120000380` introduces unsupported part `13050000401`. The builder shows the labeled reference fallback for unsupported geometry.
- [Resolver check](../tests/weapon_layers.mjs), [parity evidence](../.scratch/laser-portrait/assembly-parity.json).
- [Browser regression](../.scratch/browser-qa/weapon-layers-check.cjs) checks visible pixel changes, attachment preview/cancel/equip and desktop/tablet/mobile layouts. Screenshots: `.scratch/browser-qa/weapon-layers-{1440,1024,390}.png`.

The reference resolver is extracted for local research under `.scratch/laser-portrait/reference-assembly.mjs`; production uses the readable project renderer. Its metadata-backed composition may inherit source artwork/coverage limits and is not proof of in-game visual or stat correctness.

The image-only service worker deliberately bypasses `/data/weapon-layers/` tiles. Their host lacks CORS headers; the portrait cache's speculative CORS fetch followed by an opaque retry caused duplicate traffic and AN94 assembly timeouts. A service-worker-disabled comparison isolated that cause; tiles now use ordinary browser HTTP caching without the duplicate fetch. Portrait caching for ordinary weapon/attachment cards remains unchanged.

## Static thumbnail versus composed art

The static catalog portrait (usually `https://playerhub.df.qq.com/playerhub/60004/object/<weapon_id>.png`, with DFTTK-hosted overrides for some IDs) and the DFTTK `/data/weapon-layers/` tiles are different asset sets and may differ in lighting/style. Both enter the project through DFTTK's catalog/renderer sources; they are not the same image. The fully loaded default workbench build and equipped builds both use the same layer compositor. Catalog/picker thumbnails and the failure fallback retain the static art. The static art is never shown as a loading placeholder.

<a id="image-loading"></a>
<a id="image-loading--portrait-loading-and-browser-caching"></a>
## Portrait loading and browser caching

Portraits remain external assets. The open attachment list and equipped portraits load eagerly in parallel; the weapon gallery remains lazy. Preconnect hints reduce connection setup to the two source hosts. This is multiple overlapping requests, not one bundled download, and does not eagerly download the entire catalog.

Portrait cutouts and the weapon image show an animated loading indicator until load/error settles. Failed portraits retain the existing socket fallback. Reduced-motion preferences disable the animation.

`builder/image-cache-sw.js` caches only image requests to `playerhub.df.qq.com` and `dfttk.com`. It stores up to 160 readable image responses for seven days, deduplicates simultaneous requests, and bypasses non-images, HTML, scripts, API and model data. The worker requests CORS-readable images; sources without CORS fall back to ordinary image loading without persistent storage. Failed responses are not cached. Storage failures do not prevent normal image loading. This cache lives on the visitor's browser, can be cleared or evicted, and is separate for localhost and the deployed Pages origin. It improves repeat visits; it does not reduce source latency for an uncached image.

Registration uses a relative scope so repository-subpath hosting works. The Pages exporter copies the worker and loader as ordinary JS files, and versions their references with the release token. No hosting configuration, image upload or backend is required. Local preview assets retain `no-store`; the service worker intercepts only external images.

Compatibility evidence: [GitHub Pages supports HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https), and [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) provide browser-side request handling and Cache Storage over secure contexts. Thus browser-side image caching works with Pages static hosting. Source headers checked on 2026-11-15 for portrait `13110000099`: `Access-Control-Allow-Origin: *`, `Content-Length: 324159`, `Cache-Control: max-age=3600`.

Validation: `.scratch/browser-qa/image-loading-check.cjs` mocks delayed image responses and checks overlapping requests, loading indicators, persistent entries and offline cache hits. It uses a fresh browser context so normal HTTP cache cannot disguise the initial behavior. The generated export is additionally checked under a repository-style subpath.

<a id="portrait-audit"></a>
<a id="portrait-audit--builder-portrait-audit"></a>
## Builder portrait audit

The weapon workbench now uses an [attachment-aware layer compositor](weapon_composition.md). The static portraits audited below remain the picker art and labeled failure fallback.

Checked 2026-11-13 at `2026-11-13T02:24:52.243Z`, against preserved dfttk snapshot `20261108-an94-bd-shop.1`.

The inventory covers all 69 weapons and 583 selectable attachment/ammo entries across Operations, Warfare and Detonation. Sources come from all preserved build-pack display objects plus the mode libraries, matched by ID. Source-relative URLs resolve against `https://dfttk.com/`. Four entries have no declared portrait; their existing legacy CDN fallback URLs were also checked.

Each URL was fetched, decoded in Chrome, and checked for nonzero image dimensions and visible pixels using a downsampled canvas. This checks availability and image content, not whether the art depicts the correct item or an exact equipped build.

| Inventory | Valid portraits | Missing |
| --- | ---: | ---: |
| Weapons | 69 | 0 |
| Attachments / special ammo | 581 | 2 |
| Total | 650 | 2 |

The two missing images are `.300 BLK TIV` (`13550000003`) and `5.56×45mm CINDER` (`13550000004`). Neither has a declared source portrait; their legacy CDN image URLs return HTTP 404. The interface now deliberately uses the matching dfttk ammo socket icon for both instead of requesting a missing image. These are fallback glyphs, not replacement item portraits. The exception list is [unavailable-portraits.json](../builder/assets/unavailable-portraits.json).

The AN94 source portrait loads successfully. The weapon picker now shares the complete canonical [portrait map](../builder/assets/portraits.js) with the current build so the dfttk-hosted AN94 override is available before selecting the weapon, too. Browser checks confirmed that the picker loads the image and the CINDER entry displays an ammo glyph without making its broken image request.

Reproduction:

```powershell
python tools/prepare_portrait_audit.py
node .scratch/portrait-audit/check.cjs
```

The audit requires the scratch Playwright installation and Chrome. [Detailed results](../.scratch/portrait-audit/report.json) retain per-item URL, status, content hash, decoded dimensions and visible-pixel samples; [inventory](../.scratch/portrait-audit/inventory.json) records source versus fallback paths. Re-running the audit can identify whether an unavailable source has recovered; update the explicit exception list only after verifying the image, then regenerate the portrait map.
