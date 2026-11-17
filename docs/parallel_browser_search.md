# Parallel browser search

Published on 2026-11-17 as release `e8255213a43243ff`.
[Successful deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/44034352389);
[release evidence](../data/optimizer_validation/parallel_release_20261117.json).

The GitHub Pages client uses a pool of ordinary module Web Workers. No backend,
SharedArrayBuffer, cross-origin isolation, secrets or custom response headers are
required. Workers exchange structured-clone messages ([Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)).

The client chooses between one and four search workers, leaves one reported CPU
core for the interface, and caps the pool at two when reported device memory is
4 GB or less. Missing hardware information defaults to one worker. The local
Python/CLI backend retains its single search; both use the same native engine.

All workers preload the weapon/catalog/solver starts, then receive one common
wall-clock compute deadline. Each worker runs the complete attachment, tactical
and calibration pipeline within that deadline. Worker zero preserves the original
search order; companions use deterministic different seed, neighborhood and tree
orders. This is parallel portfolio search: workers can overlap, and their domains
are not disjoint partitions. More threads do not guarantee a better score.

Each worker retains at most 256 ordinary and 512 complete builds, as before.
Up to four bounded complete pools are sent to a worker for merging. Duplicate
attachment configurations retain their best calibrated row; a final 512-entry
score/diversity pool feeds the existing category selection. Max/Balanced/Min and
custom targets are selected again from this merged pool. Output reconstructs
real source attachments and recoil paths. No global-optimality claim is added.
The diagnostics report per-worker scoring totals, best losses, unique candidate
configurations, final pool sizes and wall-clock elapsed time. Scoring totals can
include work repeated by other workers.

The UI thread receives aggregate progress. Cancel terminates every worker,
rejects pending requests and lazily recreates the normal calculator worker.
Companion creation/loading failures fall back to healthy workers; failure of
all workers returns an error. Extra workers are terminated after each search.
Catalog startup, message copying and final merging add a small overhead beyond
the shared compute allowance; threads do not multiply the selected wall time.

Validation includes both native presets, custom targets, three-budget requests,
Warfare, locks, infeasible floors, native stat/cost replay, deadline expiry,
1/4-worker browser runs, cancellation/recovery, worker creation/load failures,
accessory exclusions, Apply, layout and cache-version checks:

```powershell
node tests/parallel_search.mjs
node tests/parallel_search_browser.cjs
node tests/anytime_optimizer.mjs
node tests/anytime_browser.cjs
node tests/github_pages.cjs
```

The M4A1 five-second locked-Insight fixture initially scored about 4,500 builds
with one worker and 17,500 across four workers (including overlapping work), with
the same best loss in that run. This is scoped throughput evidence, not a claim
of four times better results. Persistent validation is in
`data/optimizer_validation/parallel_search_20261117.json`.
