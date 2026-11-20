# M4A1 exhaustive ordinary-screening feasibility

2026-11-17. This replaces the [earlier timed portfolio throughput study](m4a1_solver_efficiency_20261117.md) as evidence for the user's question: **can screening finish searching every combination?** Repeated timed rounds, overlapping portfolio orders, tuning evaluations and tree-node counts were not an appropriate denominator for that question. That browser run was stopped; its historical data is preserved.

The new run is one uninterrupted, no-deadline sweep using eight ordinary browser module Web Workers. They receive disjoint barrel/stock partitions rather than overlapping portfolio orders. There are no timed rounds, automatic restarts, neighbor search, calibration proposals, result-cache skips or score-based pruning. Legality constraints and shared native stat calculations remain enabled. Browser hosting needs no backend, shared memory, cross-origin isolation or custom headers; the implementation is compatible with GitHub Pages. No publication was performed.

## Matching domain and independent count

- Weapon: M4A1 `18010000001`; mode: Detonation; objective: Lowest Recoil (the preset's native recoil/Handling hierarchy).
- Fixed optic: Insight 3/7 `13110000091`, root slot `11`. Its 40-point price is included in the **800-point attachment cap**.
- Calibration is held at source defaults. Tactical patches/lasers are absent, as in the ordinary stage. No minimum-stat floors are requested.
- Current production equivalent-choice grouping and accessory exclusions apply: interchangeable ordinary choices use their compatible source-equivalent representatives; unlocked side sights, lens hoods and standalone bipods are excluded. This is the optimizer's grouped automatic-search domain, not every concrete identity layout available in the game.
- Independent memoized residual-subtree counting finds exactly **12,885,654 legal ordinary layouts**. Its runtime was **0.997 seconds**. The count does not call the scoring function for every layout; the full sweep below does.
- Explicit root barrel (`2`) and stock (`3`) choices, each including no explicit purchase, form **102 disjoint Cartesian partitions**. Every possible ordinary layout has exactly one such pair. Each partition is assigned once, and the total scored count must equal the independent count before the run can report completion. A failed worker produces an error, not a false completion.

The prior **49,013,711,472** count was grouped full attachment layouts **without a budget constraint**, including tactical configurations. It is not the denominator of this ordinary 800-point sweep. Dividing that number by this sweep's ordinary throughput would mix domains and units.

## Measurement and statistical interpretation

This is **one fixed-work invocation**, not a set of independent repetitions. Progress samples are serially dependent; no confidence interval or significance claim is computed from them. Charts show observed cumulative work, interval throughput, changes in a rate-based finish projection, and sampled browser resources. This avoids treating worker messages as experimental replicates. Once the scan completes, actual completion time supersedes the earlier ETA.

Elapsed wall time begins before worker setup and partition planning. Source-scored layout counts include one objective evaluation per legal grouped ordinary layout; they exclude counter-only memoization work. Tree nodes are not complete combinations. The projection at time `t` is `(N - screened) / (screened / t)`; it assumes future average throughput matches the observed average and is not a guaranteed upper bound or a confidence interval. Partition costs, OS scheduling and the final worker tail can change it.

A separate read-only process monitor samples the dedicated study Chrome process tree every ten seconds. It starts partway through the run, so reported memory is the **peak sampled private memory over that observed interval**, not a guaranteed all-run peak. Summed working sets can double-count shared pages and are not used for the private-memory result. CPU equivalents use differences of summed browser-process user+system CPU time divided by elapsed seconds; intervals with changing process sets are excluded. They include the browser interface/GPU/services, not just solver worker threads. Some small validation checks and ordinary desktop work occurred during the run; this was not an isolated lab machine.

## What finishing this scan does and does not establish

A finished run demonstrates the feasibility of visiting and default-scoring every legal grouped **ordinary** layout for this one weapon, lock and cap. The final scan count is checked against the independently computed exact total, and each emitted symbolic layout is checked against source mounting resolution and the lock. Source scores use the same native preset and bounded shared-stat evaluator, without changing the objective.

The legacy exhaustive gate retains `ceil(N/20)` layouts: **644,283 top-5% survivors** for this domain. This instrumented scan retains only a best preview, so its measured memory does **not** include that survivor set, heap maintenance, candidate merging, or downstream tactical candidates. The UI estimates a serialized preview-record size scenario from up to the first 100 records of each partition. These are deterministic prefix samples, not a random sample; preview records omit some legacy heap fields, JSON bytes are not JavaScript heap bytes, and that estimate must not be presented as measured top-5% RAM consumption.

Tactical completions of retained bases, survivor selection/storage, scoring every concrete equivalent identity, legal calibration-position combinations, other weapons, larger caps and game-client fidelity remain separate questions. A completed ordinary scan is not a global-optimality proof, a finished generator pipeline, or evidence that the entire 49-billion no-budget domain is feasible.

## Reproduction and artifacts

```powershell
python tools/build_github_pages.py
python -m http.server 8770 --bind 127.0.0.1 --directory .scratch
# Separate terminal, with the existing scratch Playwright installation and Chrome:
node tools/run_exhaustive_screening_browser.cjs
# Optional read-only monitoring; use the runner's actual process ID:
python tools/monitor_screening_resources.py <runner-pid>
# Export figures/CSV after or during the run; requires NumPy and Matplotlib:
python tools/plot_exhaustive_screening.py
```

[Study page](http://127.0.0.1:8770/github-pages-site/screening-study.html), [streaming engine](../../tools/exhaustive_screening_study.mjs), [worker controller](../../builder/screening-study.js), [data and diagrams](../../data/optimizer_validation/m4a1_exhaustive_screening_20261117/).

The active run belongs to the original Chrome window. Opening the URL in another window creates a separate ready page. Stop cancels the traversal; the cancelled run is not labelled complete. The live Node runner writes `latest.json`, append-only `progress.ndjson` and eventually `final.json`; resource samples are in `resources.ndjson`. `provenance.json` records the dirty-source Git revision, release token and SHA-256 hashes.

Validation: `node tests/exhaustive_screening_study.mjs` exhaustively checks a 160-point reduced domain (395 layouts), independently counts it, visits all 102 partitions without duplicates, checks every source score and preserves the lock/cap. `node tests/exhaustive_screening_browser.cjs` completes the same domain through real module workers, reconciles the exact count, checks a 100% completion fraction, proves worker lifetime does not restart, and validates cancellation and desktop/mobile layout.

## Completed 800-point run

**The ordinary enumeration/default-scoring sweep finished in 635.17 seconds (10 minutes 35.17 seconds).** It was not stopped by a deadline. Its 102 completed partitions contain exactly the independently counted **12,885,654 layouts**, with no duplicate partitions and no source errors. All 102 partition-best previews were replayed with the uncached native source calculator and matched their full objective vectors, cost, source mounting and Insight lock.

| Measurement | Observed value |
| --- | ---: |
| Exact ordinary domain / layouts scored | 12,885,654 / 12,885,654 |
| Completed disjoint partitions | 102 / 102 |
| Wall time, including initial loading/counting/scheduling | 635.17 s |
| Average throughput | 20,286.94 unique ordinary layouts/s |
| Tree nodes visited | 229,910,186 |
| Exact counting time | 0.997 s |
| Peak sampled dedicated-browser private memory | 1.100 GiB |
| Median sampled browser CPU equivalents | 8.03 logical CPUs |
| Legacy top-5% survivor count (not retained) | 644,283 |
| Best ordinary/default-calibration preview loss / cost | 28.126674227257475 / 660 |

![Exhaustive progress, throughput, finish projections and resources](../../data/optimizer_validation/m4a1_exhaustive_screening_20261117/exhaustive_progress.png)

This is direct evidence that the grouped ordinary scan is feasible on this machine for this fixture. It does not establish a typical runtime distribution or a universal browser guarantee. The last partitions produce a visible load-balancing tail: fewer workers remain busy, so cumulative-rate projections near the end are optimistic. Runtime was otherwise roughly linear in the number of layouts processed. Resource samples cover only the latter portion of the run and include the dedicated browser's other processes.

The 10,200 deterministic prefix preview-record samples average 330.29 serialized bytes, implying a **0.198 GiB serialized minimal-preview scenario** for 644,283 rows. This is not a measured memory requirement for the legacy top-5% heap: it omits some fields, object overhead, transient allocations and merging, and the prefixes need not represent the actual survivors. The full top-5% selection/storage pass and tactical completion stage remain unmeasured; they are the next separate feasibility questions.

The ordinary preview's loss should not be compared directly with the earlier 22.9856 calibrated complete-build loss: this scan deliberately excludes tactical additions and holds calibration at defaults.

[Final result and all partition reports](../../data/optimizer_validation/m4a1_exhaustive_screening_20261117/final.json), [validation](../../data/optimizer_validation/m4a1_exhaustive_screening_20261117/validation.json), [statistics](../../data/optimizer_validation/m4a1_exhaustive_screening_20261117/statistics.json), [PNG figure](../../data/optimizer_validation/m4a1_exhaustive_screening_20261117/exhaustive_progress.png), [SVG figure](../../data/optimizer_validation/m4a1_exhaustive_screening_20261117/exhaustive_progress.svg), [CSV progress](../../data/optimizer_validation/m4a1_exhaustive_screening_20261117/progress.csv).

Run `node tools/validate_exhaustive_screening.mjs` to reproduce the full count reconciliation and all 102 uncached native best-preview replays. The completed browser window is left open for review; all search workers are terminated after natural completion.
