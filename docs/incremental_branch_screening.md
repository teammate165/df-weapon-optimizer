# Incremental legality and branch score bounds

Implemented locally on 2026-11-16, using M4A1 (`18010000001`) for focused validation and timing. Both changes preserve the all-legal domain, exact counts, ceil(N/20) retention in both stages, source-scored survivors and the existing calibration process. No deployment performed.

`tools/mount_search.mjs` precomputes reverse Boolean dependencies and the constraints affected by each attachment-choice group. A choice or restore invalidates only those bounds and constraints. Unchanged bounds and known failed constraints remain cached; a failed constraint is discarded when one of its dependencies changes. Dirty constraints left after an early failure are still checked before accepting a later branch. Counting retains its complete residual-policy keys and BigInt counts. A full-scan control remains available for parity tests.

`tools/branch_score_bounds.mjs` encloses every completion's score using intervals for source numeric bucket fields, conditional mounted nodes and native main-stat curves. Alternatives at a mounted path are mutually exclusive. Initial replacements use conservative hulls; additive/multiplicative fields use outward-enclosed arithmetic. Tactical fields allow omission of enabled bonuses, covering the global strongest-device selector. Cubic curve bounds use a restricted Bezier hull, including possible overshoot.

For chart recoil, the pinned native trajectory function supplies unrounded profile coefficients. The lower bound accounts for coordinate rounding, numeric error and each possible firing-feature timeline, including the horizontal speed tiers. Reference replacements remain alternatives until determined. Norm components use the minimum possible absolute axis values. Highest Agility additionally bounds handling and hip spread through its existing normalized scorer.

Only the native opted-in scorer identities can use these bounds. Unknown runtimes, changed scorers, spam firing, unsupported schedules, repeated firing-feature occurrences, excessive firing states and unsafe numeric inputs retain ordinary traversal. Bound cache keys describe score-equivalent relaxed states rather than merging attachment/calibration candidates. The cache holds at most 2,048 entries and 256 KiB of keys; saturation computes uncached bounds.

Pruning begins only after the retained heap is full. A branch must have a strictly worse primary lower bound, including numeric guards; ties are fully ranked. If the cutoff still has a material stat-floor violation, branch pruning declines. Exact legality counts are computed independently before ranking, so skipped branches do not change thresholds or reported domain sizes. Visited ranking rows can be fewer than the counted domain.

Bound evaluation is deliberately selective: the current implementation checks branches with two to four remaining nontrivial choice layers and budgets bound work against 5% of elapsed screening time. Source setup is included in that accounting; one initial check is permitted. This is a work scheduling limit, not an approximation: skipping a bound check means ordinary exact traversal. Small domains and weak relaxations can gain little from branch bounds; incremental legality supplies most of the observed M4A1 speedup.

Validation includes M4A1 exact candidate/count parity against full constraint scans and a frozen pre-change gate; both presets, Detonation budgets 20/40/60, Operations 20,000, locks and floors. An independent partial Boolean evaluator checks bounds against 70,968 exact legal completion scores from 2,120 source-scored rows, including tactical combinations and disabled/tiny caches. Existing G18 all-domain/mode/lock, subtree-counting, source group-bound, future-preset, SCIP calibration and cancellation regressions also pass.

Final alternating runs, with one warmup pair and three timed pairs, give these M4A1 40-point Detonation screening medians:

| Preset | Frozen pre-change gate | Both new layers | Speedup |
| --- | ---: | ---: | ---: |
| Lowest Recoil | 1,367 ms | 394 ms | 3.47x |
| Highest Agility | 1,192 ms | 338 ms | 3.52x |

Incremental-only controls measure 399 ms and 321 ms respectively, confirming that incremental legality provides most of the improvement; branch bounds do not show a consistent additional timing gain at this small budget. Rank constraint checks fall from about 8.2 million to 348,000. The final browser independently compares M4A1 survivors against full scans and native scoring.

Measured timings and final browser evidence are in [the persistent report](../data/optimizer_validation/branch_screening_20261116.json). Measurements cover the stated M4A1 budgets; original-cap M4A1 completion and global calibrated optimality remain unvalidated. The earlier 138-case catalog matrix was not repeated for this focused change.

Reproduce:

```powershell
python tools/build_github_pages.py
node tests/branch_screening.mjs
node tests/subtree_counting.mjs
node tests/exhaustive_attachment_gate.mjs
node tests/bounded_gate.mjs
node tests/scoring_bounds.mjs
node tests/scip_engine.mjs
python -m unittest discover -s tests -p test_exhaustive_stream.py
node tests/scip_browser.cjs
```

The focused timing script and frozen baseline are retained under `.scratch/branch-screen/`.
