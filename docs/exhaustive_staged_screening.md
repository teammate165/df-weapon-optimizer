# Exhaustive staged attachment screening

Historical/reference path: the user replaced this production contract with the [anytime top-K optimizer](anytime_top_k_optimizer.md) on 2026-11-16. The exact gate remains available for reference tests; Generate no longer waits for these exhaustive screens.

2026-11-16. Implemented locally; not deployed. User chose to make Generate wait for all legal combinations rather than sampling or precomputing offline.

## Current search contract

Every current and future preset using the shared engine runs these stages for each requested budget. Native read-only presets also use [shared stat calculation](shared_stat_calculation.md), preserving exact ordered source effects and candidate identities:

Traversal also uses [incremental legality checks and conservative branch score bounds](incremental_branch_screening.md). Exact domain counting remains independent of score pruning.

1. Count all legal ordinary attachment configurations with unlocked patches and enabled lasers excluded. Rank the complete domain at default calibration and retain exactly `ceil(N/20)` configurations. Patches include grip socket 30 and directional sockets 32-35. Locked tactical parts remain present.
2. For each retained ordinary configuration, count and rank all legal patch/laser completions at default calibration. Retain `ceil(N/20)` per ordinary configuration. All minimum stat floors must be satisfied before a tactical completion enters this ranking. The base screen ranks floor shortfalls without excluding a base that tactical parts could improve.
3. Build a SCIP calibration model limited to the complete surviving configurations. Sparse one-hot membership prevents recombining individually allowed purchases into an unscreened build. Shipped starts and the equipped build can contribute tuning hints only if their complete attachment configuration survived. There is no unrestricted fallback.

The source mounting model preserves recursive providers, defaults/forced rules, occupancy, fixed mounted selections, mode restrictions, hidden items, required optics, enabled-laser limits and priced budgets. The current catalog's calibration does not change main-stat points. Lowest Recoil retains its 1/4/6/10 horizontal speed tiers and strict recoil/Handling ordering; Highest Agility keeps its existing objective. Categories optimize within the screened domain.

`tools/exhaustive_attachment_gate.mjs` enumerates the Boolean mounting model's explicit choices. Conservative interval bounds prune only prefixes that cannot satisfy mounting constraints; the traversal does not reject a prefix merely because a later sibling has not yet enabled a bundled parent. Every yielded configuration replays through the source resolver. Counting now uses [cached residual subtrees and bounded source scoring](optimizer_screening_speed.md). Counting accounts for the full domain without visiting every configuration; ranking visits legal configurations and can reject proven losing score groups before full source scoring. The ranking max-heap stores only the winning 5%. Integer counts use BigInt. Incomplete or cancelled traversal produces no claimed exact gate.

The current 69-weapon / three-mode catalog has no selectable descendants of patches/lasers. A future catalog introducing such descendants fails explicitly until the second-stage domain supports them.

## Waiting, progress and cancellation

Generate has no screening deadline. The 5/30/120 second selector is labeled **Calibration budget** and starts only after both screens finish. Explicit multi-budget requests split that calibration allowance across their budget runs; screening remains additional for every run. Responses report complete counts, per-base tactical counts, screening/calibration timings, and solver bounds scoped to the screened calibration model. `global_optimality` remains false: an exact default-tuned screen can discard the best calibrated build.

Static Pages uses progress messages from the module Worker. Cancel terminates that Worker and the next request starts a fresh one. Local preview uses an optional NDJSON progress stream; heartbeat writes detect a cancelled browser and kill the Node subprocess, including during calibration. JSON-only API callers still work. The local backend no longer imposes a wall-clock optimize timeout. The CLI likewise waits for complete screens.

## Validation

[Persistent results, full candidate/source replay evidence, release and code hashes](../data/optimizer_validation/exhaustive_staged_20261116.json).

- Independent reverse-order raw-provider Cartesian enumeration agrees with the full G18 mounting domain: 582 Detonation configurations and 3,360 each in Operations/Warfare. Both exact screening stages agree with independent full sorting for both presets, all modes and locks. G18 retains 23/84/84 ordinary bases respectively before tactical screening.
- A separate synthetic patch/laser Cartesian reference covers grip/directional patches, nontrivial per-base top-5% rounding, minimum floors and locked multi-device limits. Mounting cases cover conditional bundled parents, occupancy, hidden parts and missing prices. Actual SCIP membership solves reject an unscreened cross-combination of individually permitted parts.
- Five weapons at the previously checked 20-point cap reproduce all legal counts (21/24/51/21/9), then complete screening/calibration for both presets.
- All 69 weapons / both presets pass at a 20-point Detonation budget (138 searches) with exact returned source stat/cost replay. This bounded matrix is not a full-cap runtime or optimality claim.
- Current/future preset integration, three explicit budgets and impossible floors pass. All-mode local stream replay, cancellation beyond a one-second calibration allowance and actual subprocess cleanup pass. Static and local browser tests pass progress, cancellation/recovery and complete G18 generation; static tests also cover WASM, both presets, Operations replay, mobile overflow and no backend calls/page errors.
- SCIP primitive/above-100 lookup checks, all 207 default scoring evaluations, horizontal boundaries/audit parity, laser stacking and category selection pass.

Larger original-cap exhaustive screens and end-to-end speed/quality comparisons remain unvalidated. The legacy full-budget generator/backend regression suites were not rerun: their exhaustive domains can now take much longer than the former solve-time budget. The retained timing trial below measures only traversal prefixes, not production completion time.

Reproduce after `python tools/build_github_pages.py`:

```powershell
node tests/exhaustive_attachment_gate.mjs
node tests/scip_engine.mjs
python -m unittest discover -s tests -p test_exhaustive_stream.py
node tests/scip_browser.cjs
node tests/exhaustive_local_browser.cjs
```

Browser tests expect the generated static site served under `.scratch/` at port 8770 and local preview at 8774 (override `STATIC_SITE_URL` / `LOCAL_SITE_URL`). The current main local preview is running at port 8766. Extended catalog/five-weapon scripts and raw outputs remain in `.scratch/staged-exact-screen/`; their results are copied into the persistent report.

## Earlier feasibility prototype

A timing prototype in `.scratch/staged-exact-screen/benchmark.mjs` adapts the existing full-slot reference traversal and uses the current source calculator and preset, including 1/4/6/10 horizontal penalties. The initial walk excludes patch sockets 32/33/34/35 and enabled lasers, respects Detonation caps, hidden/missing-price policies, source-resolved explicit selections and required optics. All attachments use default calibration. These measurements cover unlocked builds without stat floors. The walker needs further coupling/forced-default and independent completeness validation before it can be used as a production exact enumerator.

| Weapon | Original cap | Base combinations visited | Complete within 10 seconds? |
| --- | ---: | ---: | --- |
| P90 | 800 | 15,753 | No |
| Vector | 2,000 | 45,860 | No |
| SR-25 | 2,000 | 11,442 | No |
| M249 | 800 | 12,025 | No |
| G18 | 200 | 458 | Yes |

Incomplete counts are traversal-prefix lower bounds, not domain sizes. The measurements do not establish total runtime or a comparison against current SCIP solution quality. They establish that even this reduced stage can consume more than a short interactive solve budget, before tactical ranking or calibration.

A second G18-only run completes both prototype screens in about 79 ms: 458 base combinations retain 23; all 24 tactical completions across those survivors are evaluated; per-base rounding retains 23 completed configurations. Calibration has not been implemented in this prototype. The per-base rule avoids automatically dropping every completion of a retained base during the tactical stage; it remains an implementation interpretation to confirm when finalizing the contract.

[Recorded results, candidates and scorer hashes](../data/optimizer_validation/staged_screening_20261116.json). Existing [full-slot evidence](attachment_gate_full_slots.md) also records incomplete larger-weapon exhaustive walks.
