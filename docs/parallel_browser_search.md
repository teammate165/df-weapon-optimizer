# Parallel browser search

Published on 2026-11-17 as release `e8255213a43243ff`.
[Successful deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/44034352389);
[release evidence](../data/optimizer_validation/parallel_release_20261117.json).

The GitHub Pages client uses a pool of ordinary module Web Workers. No backend,
SharedArrayBuffer, cross-origin isolation, secrets or custom response headers are
required. Workers exchange structured-clone messages ([Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)).

The client chooses between one and eight search workers, leaves one reported CPU
core for the interface, and caps the pool at two when reported device memory is
4 GB or less. Missing hardware information defaults to one worker. The local
Python/CLI backend retains its single search; both use the same native engine.

All workers preload the weapon/catalog/solver starts, then receive one common
wall-clock compute deadline. For timed Anytime runs, each worker searches a
different root-choice partition of the broad ordinary tree and resumes that tree
in attachment feedback. Seed and neighborhood exploration and tactical
completion can still overlap. At each calibration handoff, workers offer up to
16 starts to the coordinator. A participating worker owns each shared
configuration and its distinct tuning starts. Other retained starts can be
calibrated locally. The handoff waits at most 50 ms within the phase deadline
and can proceed with the starts available from healthy workers.
[Implementation study](anytime_worker_efficiency.md).

Each worker retains at most 256 ordinary and 512 complete builds, as before.
Up to eight bounded complete pools are sent to a worker for merging. Duplicate
attachment configurations retain their best calibrated row; a final 512-entry
score/diversity pool feeds the existing category selection. Max/Balanced/Min and
custom targets are selected again from this merged pool. Output reconstructs
real source attachments and recoil paths. No global-optimality claim is added.
The diagnostics report per-worker scoring totals, best losses, unique candidate
configurations, final pool sizes and wall-clock elapsed time. Scoring totals can
include work repeated by other workers.

## Local worker study and continuous diagnostics (2026-11-17)

The pool ceiling is now eight, retaining the two-worker ceiling for reported
device memory of 4 GB or less. The original four-worker publication and its
measurements below are historical. Browser hardware reports are hints, not a
guarantee of available CPU or memory; see [hardware concurrency](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency)
and [approximate device memory](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory).
Explicit diagnostic pool sizes are clamped to 1..8.

The static export includes `solver-diagnostics.html`: a fixed M4A1 (`18010000001`),
Detonation, Lowest Recoil fixture with Insight 3/7 (`13110000091`) locked in optic
slot `11`, at the 800-point attachment cap. It runs in ordinary module workers
on GitHub Pages-compatible static hosting. There is no overall deadline: each
30/60/120-second round reaches tactical search and calibration, replays the
result against the native calculator, saves the best lexicographic objective,
and seeds the next round with that build and a new portfolio-order offset.
These are repeated finite rounds, distinct from the local backend's unlimited
single enumeration. Stop terminates current workers and preserves completed
checkpoints; the download includes measurements and the best configuration.
No hosting publication is required to run the local static export.

Progress includes correct aggregate counts and per-worker phase, score,
calibration, tree and pruning counters. Complete-pool best loss is separate from
ordinary-pool loss. Timing separates worker preparation, common-deadline compute
wall time and candidate merging; final reports retain each worker's diagnostics.
`evaluated` counts source-scored cache misses, including tuning proposals and
possible repeated configurations. `evaluation_attempts` also counts invalid and
cache-hit proposals; `cache_hits` counts result-cache reuse. Retained candidate
uniqueness is exact only for the final retained pools, not the entire traversal.
Summed worker-phase wall time is not CPU time. Percentage complete, global
coverage and remaining time are unknown.

Reproduce the performance study with `node tools/benchmark_solver_browser.cjs`
(requires the scratch Playwright installation, Chrome, an exported site and the
local static server). It first runs seven randomized complete blocks of
1/2/4/6/8 workers at five seconds per trial, excluding separate warm-ups, then
starts a visible continuous solver with the smallest pool within 90% of maximum
median gross throughput. Each selected result is source-replayed. The ongoing
run saves completed checkpoints to the study directory. Generate PNG/SVG figures
and CSV/statistics with `python tools/plot_solver_study.py` (NumPy/Matplotlib).
The [study report](archive/m4a1_solver_efficiency_20261117.md) records the measured scope,
uncertainty and limits.

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
