# Delta Weapon Workshop

Static weapon builder and experimental recoil optimizer. Calculations run in a
browser Web Worker. No backend, credentials, game-server API, or image files.

Weapon/attachment portraits use the external URLs supplied by dfttk.com (including
its Tencent playerhub image URLs). Socket icons load directly from dfttk.com.
External assets may change or become unavailable. These assets belong to their
respective owners. This is an independent, unofficial project.

Source model: dfttk snapshot `20261108-an94-bd-shop.1`. Global/Garena validation,
prices and translations remain provisional. All presets use the full-weapon SCIP MILP in a single-threaded browser worker.
All attachment slots, source calibration, budgets, floors and locks are modeled.
Time-limited results remain best found; model gaps are reported. Lowest Recoil uses the experimental 40/30/30 proxy.
Saved builds stay in this browser's cookies; JSON export provides a backup.

Published with GitHub Actions to GitHub Pages. Local preview:
`python -m http.server 8080` then visit http://localhost:8080/.
