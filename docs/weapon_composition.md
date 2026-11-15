# Attachment-aware weapon portraits

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
