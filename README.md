# Delta Weapon Workshop

Static weapon builder and experimental recoil optimizer. Calculations run in a
browser module Web Workers (one to eight, sized to the device). No backend,
credentials, game-server API, special response headers, or image files.

Weapon/attachment portraits use the external URLs supplied by dfttk.com (including
its Tencent playerhub image URLs). Socket icons load directly from dfttk.com.
External assets may change or become unavailable. These assets belong to their
respective owners. This is an independent, unofficial project.

Source model: dfttk snapshot `20261108-an94-bd-shop.1`. Global/Garena validation,
prices and translations remain provisional. Both presets use parallel time-limited top-K search in browser workers.
Ordinary builds, patch/laser completions and source-scored calibration share the total search budget.
Each worker retains at most 256 ordinary and 512 complete builds; the merged pool is capped at 512.
Workers share one compute deadline and can overlap in the builds explored. Legal combinations can remain unexplored.
Results are best found, with no global-optimum claim. Lowest Recoil uses the experimental 40/20/40 Recoil Pattern, Camera Stability and Gun Stability weights.
Saved builds stay in this browser's cookies; JSON export provides a backup.

Published with GitHub Actions to GitHub Pages. Local preview:
`python -m http.server 8080` then visit http://localhost:8080/.
