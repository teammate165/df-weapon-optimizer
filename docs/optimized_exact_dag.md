# Optimized custom exact screening DAG

2026-11-18. The latest directive is **eight compute workers**, superseding the earlier sixteen-worker studies for new tests. This is a separate local/static exact-screening study; the production Generate search remains unchanged.

Subsequent implementation and measurements: [cache/locality follow-up](exact_dag_cache_followup.md). It replaces string input keys with exact packed keys, reallocates the objective memo, adds locality/dead-write projection and measures **695,267 globally distinct inputs**. Results below are the original implementation baseline, retained as historical evidence.

## Exhaustive contract

The fixed study is M4A1 `18010000001`, Detonation (`bd`), Lowest Recoil, 800 attachment points, with Insight 3/7 `13110000091` locked at root socket `11`. The existing grouped ordinary domain contains **12,885,654 legal layouts**. Existing automatic-accessory exclusions and ordinary/tactical stage boundaries remain unchanged. This is not enumeration of all raw attachment aliases, tactical completions or calibration settings.

Dominance, score-based pruning, heuristic shortlists and time limits are disabled. Every original grouped layout receives its exact default-calibration score, directly or through exact equivalence. BigInt path mass and correlated provenance preserve multiplicity. The selection denominator remains the full original population: `ceil(12,885,654 / 200) = 64,429`. Ranking uses strict preset objectives, cost, then canonical code-unit signature order, as specified by `tools/screening_rank.mjs`.

The sub-one-million goal concerns actual full-objective computations, including repeated cache misses across workers and after eviction. It does not change the represented population. Terminal classes, scorer computations, geometry computations and selected identity reconstruction are separate counters.

## Implemented changes

| Change | Implementation | Exactness condition |
| --- | --- | --- |
| Compact state storage | Copy-on-write native bucket maps, immutable interned tuples, monotonic IDs; packed UInt32 provenance arcs. | Preserve binary64, signed zero, undefined values and native operation order. Exact canonical keys resolve identity; IDs are never recycled. |
| Accumulated-state scoring | Finalize raw state with native reference/target/mapping functions and invoke native recoil/timing routines. | Same preset objective functions and unrounded Handling seconds; pinned source contract checked at construction. |
| Layered exact caches | Complete scorer-input, geometry, timing, pattern, objective and resolved-reference caches. | Native trajectory rounding to five decimal places remains intact. Every actual native timing read belongs to the input key. Eviction recomputes. |
| Smaller certified keys | Backward closure of live target mappings; retain all raw fields of live buckets, resolved references and cost. | Future immutable event programs capture conditional effects. Unknown callback reads or part-sensitive fire behavior are rejected; no displayed-stat approximations. |
| Reuse beyond a batch | Worker-local persistent transition cache keyed by exact live state and the remaining operation program; persistent scoring caches. | Reused numerical successors still emit the current job's incoming arcs and mass. No shared mutable provenance. |
| Deferred identities | Score every terminal class, retain weighted quality groups, reconcile the global boundary, reconstruct qualifying identities and apply exact signature ordering. | Whole boundary groups survive until identity reconciliation. No representative signature replaces all aliases. |
| Native-order event DAG | Interleave fixed attachment operations and nested leaf decisions in the source's actual assembly order. | Compare the event schedule with native mounted order; unsupported cases retain full enumeration fallback. |

The implementation lives in `tools/optimized_exact_dag.mjs`, `tools/exact_recoil_scorer.mjs` and `tools/exact_dag_storage.mjs`. The source dependency certificate covers this immutable M4A1 default-calibration context, without ammo, stat floors or spam controls. It is not a general proof for every weapon or request.

Cross-batch reuse is bounded and worker-local. A global state-owner routing system and shared whole-layer frontiers are not implemented. The numeric state uses immutable bucket tuples and maps, rather than a full Float64 matrix. Cache byte caps estimate retained payload; they are not hard V8 heap guarantees.

## Validation and measurement

`node tools/run_optimized_exact_dag.mjs` runs eight actual Node worker threads with fresh caches for each reference/optimized phase. Structural planning independently counts the complete domain. The source-resolved reference uses no DAG/live-state merging; it memoizes complete scorer inputs and checks each new input against the native scorer. It is therefore a memoized validation reference, not an uncached baseline.

The optimized phase checks each batch's weighted path count against that reference. Both phases produce sorted SHA-256 manifests of every identity, objective vector, scalar score and cost. All batch manifests must match under the usual cryptographic collision assumption. The complete ordered survivor lists must match, and all 64,429 selected identities must pass fresh uncached native replay.

For this full audit, all identities are deliberately reconstructed once to compute manifests. That audit is separate from deferred survivor reconstruction; its overhead remains in measured wall time. Selection reconstruction counts must not be described as total validation identity work.

Small and intermediate eight-worker checks already cover 395 and 21,556 complete layouts. At 300 points, both passes retain exactly the same 108 identities; the DAG handles 77 interleaved prefixes without fallback and reconstructs 109 identities for selection. Complete identity/score audits still visit all 21,556 layouts. [Intermediate validation](../data/optimizer_validation/optimized_exact_dag_20261118/intermediate/final.json).

The full original-domain run **passed** with eight workers: all 1,608 batch identity/score manifests match, all 64,429 survivors match in exact order, and all 64,429 pass uncached native replay. All 612 interleaved prefixes are supported, with zero planned or runtime guard fallback. [Complete result](../data/optimizer_validation/optimized_exact_dag_20261118/full/final.json), [component checks](../data/optimizer_validation/optimized_exact_dag_20261118/component-validation.json).

| Measurement | Observed value |
| --- | ---: |
| Represented original grouped layouts | 12,885,654 |
| Batch terminal classes (not global unique states) | 8,865,013 |
| Actual objective computations across eight workers | 3,884,405 |
| Native rounded geometry computations | 8,283 |
| Selection identities reconstructed | 64,429 |
| Additional full-audit identities reconstructed | 12,885,654 |
| Memoized reference validation phase | 2,356.80 seconds |
| Optimized validation phase, including full audit and selection | 382.29 seconds |
| Complete paired run, planning and native replay | 2,755.30 seconds |
| Peak sampled aggregate Node RSS | 3.615 GiB |
| Actual packed provenance written | 1.220 GiB |
| Provenance read during selection | 0.692 GiB |

**The under-one-million objective-computation goal is not met.** The optimized input cache has 4,980,608 hits, 3,884,405 misses and 3,635,166 evictions. Its objective cache has zero hits beyond the complete-input memo; worker duplication, eviction and genuinely distinct inputs remain possible contributors. These counters do not establish the globally distinct scorer-input count. Only 59,731 transitions were reused against 37,772,993 computed transitions, so the bounded cross-batch cache contributes little in this scheduling arrangement. This points to compact persistent input storage, locality/ownership scheduling and measurement of global unique inputs as the next exact-preserving investigations; it does not establish that a larger cache alone will reach the goal.

The optimized pass represents about 33,707 layouts per wall second in this run. Its lower observed time primarily comes from a different scoring path and validation workload; the reference invokes native witnesses for 3,854,265 input misses, while the optimized pass uses the direct scorer and later replays the selected survivors. This is not a controlled estimate of the benefit of DAG merging alone. Objective computations are slightly higher in the optimized pass than in the reference, despite fewer terminal classes; worker assignment and cache churn matter.

[Statistics and source hashes](../data/optimizer_validation/optimized_exact_dag_20261118/full/analysis.json), [PNG diagram](../data/optimizer_validation/optimized_exact_dag_20261118/full/efficiency.png), [SVG diagram](../data/optimizer_validation/optimized_exact_dag_20261118/full/efficiency.svg).

`python tools/report_optimized_exact_dag.py` consumes a successful full result and writes descriptive statistics, source/data SHA-256 hashes, and standalone PNG/SVG figures. One ordered pair of passes supports descriptive timing only. Heterogeneous batches and progress samples are not independent experimental replicates, and no confidence intervals or causal speedup estimate are inferred from them. RSS samples cover the Node process and all its worker threads; CPU utilization was not sampled.

## Local static browser study

Build with `python tools/build_github_pages.py`, serve `.scratch`, then open `github-pages-site/exact-dag-study.html`. With the current local server this is `http://127.0.0.1:8770/github-pages-site/exact-dag-study.html`. The default run uses eight Web Workers, the full 800-point population, no deadline, and the same DAG/scorer modules as Node. It performs deferred selection without reconstructing losing identities for a full audit. Each selected identity still passes uncached native replay.

Packed graphs are stored in per-run, per-worker IndexedDB databases and read back only for qualifying packets. Storage failure stops the run as incomplete; it never silently trims paths. Completion and cancellation remove only the uniquely named databases owned by that run. Caches evict and recompute; numerical frontiers can be released while spilled provenance remains reconstructable.

The study needs only static same-origin assets and ordinary Web Workers/IndexedDB. No backend solver, SharedArrayBuffer, threaded WASM or custom hosting headers are required. The eight-worker browser integration check passes all 21,556 fixture layouts, complete score/identity manifests, exact 108-survivor order, uncached replay, packed/BigInt IndexedDB round-trip, cleanup after completion/cancellation and desktop/mobile layout. It reconstructs 109 selection identities. [Browser validation](../data/optimizer_validation/optimized_exact_dag_20261118/browser-validation.json). Browser memory/quota/device limits still affect feasibility; this reduced-domain check does not establish full-domain browser runtime on every device. No public deployment is part of this change.

## Reproduction

Run these sequentially so only one eight-worker test pool is active:

```powershell
node tests/optimized_exact_dag_workers.mjs
node tools/run_optimized_exact_dag.mjs
python tools/build_github_pages.py
node tests/optimized_exact_dag_browser.cjs
python tools/report_optimized_exact_dag.py
```

The browser test expects the static server above. `EXACT_DAG_BUDGET` and `EXACT_DAG_OUTPUT` select a smaller Node fixture and separate output directory. The full default writes `data/optimizer_validation/optimized_exact_dag_20261118/full/`; packed Node provenance is retained in its recorded task-local spill directory. An earlier interrupted reference pass is explicitly archived as incomplete under `full/v1-reference-incomplete/` and is not success evidence.

The design follows the [consolidated exhaustive-screening research](exhaustive_screening_improvements.md), [scorer findings](exhaustive_scoring_research.md), [state-equivalence findings](exhaustive_state_sharing_research.md), and [storage/ranking findings](exhaustive_storage_order_research.md).
