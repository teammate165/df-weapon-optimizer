# Exact DAG cache and locality follow-up

Historical population note: the subsequent user-requested bipod-grip exclusion removes Collapsible Bipod Grip `13140000038` from automatic selection. The current M4A1 allowed population is **12,268,642**, selecting **61,344** at0.5%. Measurements below retain the prior12,885,654-layout population. The historical reference cannot be reused for the newly restricted population; the runner rejects population mismatches. [New policy/count/browser validation](../data/optimizer_validation/bipod_grip_policy_20261118/validation.json).

2026-11-18. Eight actual compute workers, sequential test pools. M4A1 `18010000001`, Detonation, Lowest Recoil, 800 points, Insight 3/7 `13110000091` fixed at11. All **12,885,654 original grouped ordinary layouts** and the original **64,429 top-0.5% identities** remain represented. No dominance, score pruning, deadlines, tactical completion or calibration search.

## Implemented

- `tools/exact_dag_storage.mjs`: compact exact binary64 scorer keys (four UTF-16 code units per value), preserving signed zero without rounding or probabilistic equality. Numeric vectors and profile IDs have unambiguous framing. Nonfinite inputs fail explicitly.
- `tools/exact_recoil_scorer.mjs`: remove the additional objective-result memo, which had zero hits in the baseline. Reallocate its8 MiB per worker to the complete-input memo: **16 to24 MiB** per worker, with the same sum of scorer-cache payload budgets. Geometry/timing/pattern caches remain. Estimated payload caps are not hard V8 heap guarantees.
- `tools/exact_dag_storage.mjs`, Node runner and browser controller: deterministic remaining-program affinity queues with idle-worker stealing. Node uses recorded independent reference path counts for load weights when available; the browser uses root counts. This improves locality but does not assign each terminal scoring key a unique owner.
- `tools/optimized_exact_dag.mjs`: remove certified unread numeric operations before interning operation blocks and applying transitions. Native alias writes are checked through `c.numeric(pack,[operation])`, rather than matching source target names alone. Keep all reference replacements and the existing live dependency closure; preserve native ordering. This narrows transition programs and copy-on-write work without removing layout identities. Scope remains the pinned default-calibration M4A1 fixture without floors/ammo/part-sensitive firing.
- `tools/exact_input_diagnostics.mjs`: log every scoring-input miss to bounded buffered binary files. A hash chooses one of64 disk partitions; complete UTF-16 keys establish equality. Offline partition analysis counts global unique inputs, additional worker copies and actual revisits after eviction. No approximate distinct counter or unchecked hash equality is used.
- `tools/choice_groups.mjs`: add **barrel-bipod socket36** to the existing automatic-accessory exclusions. Rail-bipod socket10 was already excluded. Existing explicit-lock exemptions remain; dedicated bipods stay available in the manual builder. Foregrip/barrel/handguard hybrids retain their ordinary eligibility. [Bipod/default/forced-mount audit](exact_dag_further_grouping.md).

## Full-run results

| Measurement | Before | After |
| --- | ---: | ---: |
| Represented original layouts | 12,885,654 | 12,885,654 |
| Batch terminal classes | 8,865,013 | 8,865,013 |
| Actual objective computations | 3,884,405 | 2,979,656 |
| Input-cache evictions | 3,635,166 | 2,397,823 |
| Input-cache hit fraction | 56.18% | 66.39% |
| Optimized phase, including full audit and selection | 382.29s | 187.22s |
| Peak sampled aggregate process RSS | 3.615 GiB | 3.294 GiB |
| Selected identities reconstructed | 64,429 | 64,429 |

Objective computations decrease **23.29%**. Observed phase wall time decreases **51.03%**. These are one historical before run and one after run with bundled changes and different diagnostic overhead; they do not isolate each change's effect or establish a causal speedup/confidence interval. After-run complete wall time, including planning, miss-log analysis and native survivor replay, is **200.47s**. Full identity audit separately reconstructs every layout; selected reconstruction counts are not total validation identity work.

The previous completed source-resolved reference is reused after native source, preset, ranking and data SHA-256 checks and equality of all root configurations and total count. Its exact job partitions are retained, allowing all1,608 identity/objective/score/cost manifests to be compared directly. All match. The new ordered64,429 survivors match and all pass **fresh uncached native replay**. Zero planned/runtime fallback. The unchanged terminal-class count means the realized count reduction comes from score reuse, while certified dead-write removal reduces work per transition. This run establishes no new reduction in represented layouts or batch terminal classes.

[Full result](../data/optimizer_validation/exact_dag_cache_20261118/full/final.json), [reference provenance](../data/optimizer_validation/exact_dag_cache_20261118/full/reused-reference.json), [source hashes](../data/optimizer_validation/exact_dag_cache_20261118/full/source-hashes.json), [statistics](../data/optimizer_validation/exact_dag_cache_20261118/full/cache-comparison.json), [PNG](../data/optimizer_validation/exact_dag_cache_20261118/full/cache-comparison.png), [SVG](../data/optimizer_validation/exact_dag_cache_20261118/full/cache-comparison.svg).

## The sub-million opportunity is now measured

Every new key must miss on its first request, so the union of exact miss keys covers all scoring inputs requested during the complete scan:

| Exact decomposition of objective computations | Count |
| --- | ---: |
| Globally distinct certified scoring inputs | **695,267** |
| Additional first computations on other workers | 1,406,582 |
| Recomputations of a worker's previously computed key after eviction | 877,807 |
| Total | **2,979,656** |

[Exact diagnostic output](../data/optimizer_validation/exact_dag_cache_20261118/full/input-diagnostics.json). All full-run entries fit the cache admission limit, the input cache starts once and is not cleared during the phase, and there are no guard fallbacks; repeated misses of a worker's same key therefore identify eviction/recomputation here.

**Actual sub-million computation is not achieved yet.** The measured global key set shows that this fixture can in principle score each exact input once in **695,267 evaluations**, preserving every layout and rank position. The next targeted design is batched terminal-key ownership across the existing8 workers, with exact result retention or spill. Key hashing routes requests; full keys resolve collisions. Duplicate requests must wait for/reuse the same completed result, then return it to every requesting class. Retaining results and accounting for concurrent arrivals are necessary; ownership alone does not prevent evicted results being recomputed. Message volume, buffering, memory and IndexedDB overhead require browser measurement before claiming a faster implementation.

Increasing independent caches cannot eliminate the1,406,582 additional worker-first computations. LRU can change the877,807 revisits, but no LRU comparison was run. The current FIFO policy remains. Geometry caches have no evictions; further geometry capacity is not the evident bottleneck.

## Further grouping and allowed-domain changes

Dedicated bipod removal does **not** lower this M4A1 population: socket10 was already excluded and the weapon has no36 socket. The new36 policy covers AUG `18010000015` / bipod `13170000005` and AK-12 `18010000018` / bipod `13170000008`, at path`2/36`. Compiled exclusions also constrain source defaults/forced mounts; provider combinations requiring forbidden parts can become unavailable rather than losing a required attachment silently. Explicit locked bipods remain a user override. This authorized policy restriction is separate from equivalence merging.

Further exact opportunities, not implemented in this follow-up:

1. **Separate numeric state from cost distributions.** Different costs fragment current DAG keys even when effects match. One numeric node could carry an exact cost-indexed provenance/mass distribution, checking every budget transition and final cost tie separately. Never retain only the cheapest cost: expensive identities still contribute percentile population.
2. **Normalize continuation programs with label mappings.** Equivalent numeric/cost choice programs at different paths can share work if a proven bijection reconstructs each original identity and respects defaults/legality. Dropping path/item labels without that mapping is unsafe.
3. **Fold interior deterministic event runs.** Apply consecutive fixed operations in native order through one transition, reducing frontiers and provenance overhead. Keep their attachment identities in their source root configuration.
4. **Per-component suffix liveness.** Forget a raw component only when every continuation provably overwrites it before any consumer. Additive/multiplicative updates generally retain prior state; identical displayed values are insufficient.

These reduce computational nodes/branches while preserving all represented layouts. Reducing the allowed-layout count itself requires an explicit eligibility restriction, such as dedicated bipod exclusion. Neither dominance nor arbitrary representative removal is reintroduced.

## Validation and reproduction

Eight-worker component checks pass all395 native/reference/DAG rows, signed-zero/exact key cases, native alias-aware projection, ancestor immutability, forced cache eviction, transition reuse, BigInt selection, exact diagnostic partitioning, locality job coverage and AUG/AK-12 bipod exclusions/explicit locks. [Components](../data/optimizer_validation/exact_dag_cache_20261118/component-validation.json).

The rebuilt static browser passes all21,556 fixture layout manifests, exact108-survivor order and native replay,8 actual worker lifecycle, packed/BigInt IndexedDB round-trip, cleanup after completion/cancel, same-origin static GET-only operation and desktop/mobile layout. [Browser validation](../data/optimizer_validation/exact_dag_cache_20261118/browser-validation.json). Full-domain browser/device performance is not established by this fixture.

```powershell
$env:EXACT_DAG_VALIDATION_OUTPUT='data/optimizer_validation/exact_dag_cache_20261118'
node tests/optimized_exact_dag_workers.mjs
$env:EXACT_DAG_BUDGET='800'
$env:EXACT_DAG_OUTPUT='data/optimizer_validation/exact_dag_cache_20261118/full'
$env:EXACT_DAG_REFERENCE='data/optimizer_validation/optimized_exact_dag_20261118/full'
node tools/run_optimized_exact_dag.mjs
python tools/build_github_pages.py
node tests/optimized_exact_dag_browser.cjs
python tools/report_optimized_exact_dag.py data/optimizer_validation/exact_dag_cache_20261118/full
python tools/report_exact_dag_cache.py
```

Run sequentially; the browser test expects the existing localhost8770 static server. The local study remains `http://127.0.0.1:8770/github-pages-site/exact-dag-study.html`. Use a fresh output directory when retaining an earlier run; exact miss logs and provenance use unique task-owned scratch directories. No public publication or production Generate engine replacement is part of this follow-up; shared automatic accessory eligibility now includes socket36.
