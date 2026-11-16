# Exact screening speed layers

Production now uses the [anytime top-K optimizer](anytime_top_k_optimizer.md). The incremental mounting and score-bound helpers below are reused where useful; the exhaustive percentage gate remains a reference path.

2026-11-16. Implements cached legality/subtree counting followed by bounded scoring. The all-legal-combinations requirement, both top-5% screens, default-calibration ranking, calibration objective and Generate-waits behavior remain intact. These changes are local; no deployment has been performed.

Follow-up: [incremental legality checks and partial-build score bounds](incremental_branch_screening.md) now reduce repeated constraint scans and can reject proven losing branches before leaf scoring. The follow-up uses M4A1 for focused performance and exact-parity validation.

## Cached legality counting

`tools/mount_search.mjs` compiles one request-local mounting plan, reused by counting and ranking across both stages. The counter substitutes decided attachment flags into every remaining mounting/price constraint, simplifies the Boolean expressions, and memoizes counts for identical residual constraints at the same decision depth. Keys preserve dependencies, default/forced providers, occupancy, locks, optics, device limits and remaining budget. Equal interval ranges alone are not treated as equivalent states.

Counts use BigInt. When the remaining constraints are guaranteed satisfied, the counter multiplies the remaining choice-domain sizes. Already-assigned one-option socket layers are skipped because they cannot change the residual constraints; enumeration still emits their selected purchases. Group multiplicity is preserved.

The count memo has at most 20,000 entries and 4 Mi characters of keys; Boolean expression interning has at most 50,000 entries and 4 Mi characters. Eviction/full caches reduce reuse without changing counts. Interned IDs are never recycled. Caches are scoped to one count invocation; model/mode/budget/lock changes cannot reuse another invocation's counts.

Exact residual arithmetic requires safely bounded integer policy coefficients and bounds. Decimal/oversized numeric policies retain literal enumeration with the original comparisons. Source-dependent stat floors retain exact source-filtered tactical counting. Base-stage floors continue to participate in ranking rather than excluding bases before tactical completion. Ranking's independently visited count must equal the cached total before a gate can complete.

## Bounded source scoring

`tools/scoring_bounds.mjs` provides a bound for eligible Lowest Recoil source-chart objectives. `prepare_project_runtime.py` exposes the actual private native trajectory function only for the exact known calculator SHA-256, preserving the unmodified module in `attributes.unmodified.mjs`. Unknown calculators are left unchanged and use ordinary full scoring. Capability and native kernel function identities are checked; future presets overriding raw scoring, normalization or objectives automatically lose the inherited certificate.

The bound evaluates only the primary recoil calculation: the native 20 rounded points, source firing intervals, the same fastest 200 ms speed tiers, and camera/kick norms. A numerical guard lowers the reconstructed primary value. Equivalent primary-score groups reuse the bound: the key includes the resolved recoil profile, horizontal/vertical scales, complete firing timeline, and camera/kick norms. Budget, cost, Handling and floor priority remain separately evaluated for each member. The group cache resets for each gate, with at most 2,048 entries and 256 Ki characters of keys; turning it off or saturating it preserves results.

Once the exact top-5% heap is full, a member is skipped only when its bound proves it cannot beat the current cutoff under floor priority and the primary objective. Ties and near-ties receive full scoring, preserving Handling/cost/signature ordering. Every retained configuration receives the full source score and subsequent source-verified calibration. Unsupported protocols/configurations decline the bound and use the ordinary scorer, preserving its validation/error behavior.

This groups score-equivalent complete candidates; ranking continues to consider the legal domain. It does not introduce another top-percent heuristic or merge distinct builds with different calibration options. [Shared native stat calculation](shared_stat_calculation.md) reuses ordered effect prefixes, and [branch score bounds](incremental_branch_screening.md) can now skip proven losing subtrees. Highest Agility and legacy recoil keep their exact ordinary scoring behavior; eligible native presets also use conservative partial-build bounds.

## Validation and measurements

[Persistent validation, candidates, timings and hashes](../data/optimizer_validation/subtree_bounds_20261116.json).

- Counts agree with literal enumeration, independent source-provider references, modes, budgets and locks. The counter computes `2^60 = 1,152,921,504,606,846,976` independent configurations in one node. A closed-form 583,569-configuration constrained domain uses 298 nodes and 157 cache hits.
- Tests cover conditional bundled parents, restrictions, occupancy, hidden/missing-price exclusions, cache saturation/disabled caches, numeric fallbacks, fixed layers and cancellation. Independent G18 references preserve exact counts and both-stage selected sets.
- Bounds stay below 3,253 full native scores across all 69 weapons / three modes and low-budget configurations, including extra phase/loop, axis-scale, speed-tier and weight edge cases. Direct bounded/unbounded comparisons preserve selected configurations and both-stage counts, including floors, future-scorer overrides and unavailable bounds.
- In the P90 80-point Detonation reference, 939 scoring candidates require 228 full scoring calls: 711 are rejected by bounds. Only 20 distinct bounds are calculated; 829 bound calls reuse a group result. Disabling or limiting the group cache preserves the same selections.
- Final three-run alternating-order comparisons preserve candidate arrays against the original literal gate and a count-only/full-scoring control. Median screen times: P90 at 80 points, 8,558 ms -> 2,593 ms (3.30x); P90 at 20 points, 429 ms -> 172 ms (2.49x); G18 at its full 200-point cap, 112 ms -> 73 ms (1.54x). These are screening timings, excluding calibration.

Counting supplies most of the gain in these fixtures. Bounded scoring adds about 9% in the 80-point P90 case and little benefit where ties dominate or the ordinary scorer is already cheap. These measurements do not establish full-cap speedups for larger weapons or global calibrated optimality. The all-legal ranking pass can still be large.

The current validation also includes the 138-case small-budget generation/source-replay matrix and both local/static browser checks. The browser exercises native group-bound parity directly, including cache reuse, plus Generate/cancellation/recovery, both presets, source replay and mobile layout. The local subprocess still stops on browser disconnect.

Reproduce after `python tools/build_github_pages.py`:

```powershell
node tests/subtree_counting.mjs
node tests/scoring_bounds.mjs
node tests/bounded_gate.mjs
node tests/exhaustive_attachment_gate.mjs
node tests/scip_engine.mjs
python -m unittest discover -s tests -p test_scoring_runtime.py
python -m unittest discover -s tests -p test_exhaustive_stream.py
node tests/scip_browser.cjs
```

Browser server setup and port overrides are in the [staged screening contract](exhaustive_staged_screening.md). Extended scripts and the original literal-gate snapshot are retained under `.scratch/subtree-counting/`.
