# M4A1 dominance reduction prototype

2026-11-18. Implements the first pass proposed in [layout-reduction options](m4a1_layout_reduction_options.md). The profile is deliberately opt-in: **experimental dominance** on the local [screening study page](http://127.0.0.1:8770/github-pages-site/screening-study.html), or `request.experimental_dominance:true` in that study's module-worker actions. Normal Generate and the original exhaustive study remain unchanged when the flag is absent. No publication was performed.

## Domain and result

M4A1 `18010000001`, Detonation, Lowest Recoil, Insight 3/7 `13110000091` locked at root optic `11`, attachment budget 800. Ordinary attachments are screened at default calibration. The independent counter now reports **1,696,710** layouts, down from **12,885,654**. **The below-one-million target is not met.** No fixed top-N part shortlist was introduced.

The source and tuning-witness suite passes **1,108 default comparisons** and **26,830 tuning comparisons**, with matching mounting, budget and lock checks in each supported context. Source guards decline unsupported weapons, modes, protocols, stat floors, missing Insight identity lock, unknown source contracts, altered main-stat dependencies, unsafe coefficient signs and nonmonotone objective curves. The final uninterrupted eight-worker browser scan completed in **95.05 seconds**; all 102 partitions reconcile to the exact reduced count. All 84 nonempty partition-best previews replay their uncached native objective vectors, cost and Insight lock. The original best ordinary objective `[28.126674227257475, 183.10392706384434]` and 660-point cost are unchanged. No source errors were observed.

## Measured comparison

| Profile | Layouts | Observed wall time |
| --- | ---: | ---: |
| Original grouped ordinary sweep | 12,885,654 | 635.17 s |
| All-component dominance | 2,192,034 | 125.33 s |
| Recoil-first dominance | 1,884,381 | 104.45 s |
| Optional-child compatibility | **1,696,710** | **95.05 s** |

![Dominance count and wall-time comparison](../../data/optimizer_validation/m4a1_dominance_20261118/dominance_comparison.png)

The final profile has **86.83% fewer layouts** and an observed **6.68x wall-time improvement** over the baseline. Per-layout throughput falls from 20,287 to 17,851 layouts/s because rule/model setup and extra legality constraints have costs; the benefit comes from less work, not faster source evaluation. These are exact counts and one successful duration per profile, under ordinary desktop load. They are descriptive observations, not an estimated runtime distribution or a statistically established universal speedup. Startup failures before any scoring are preserved separately and excluded from successful-run durations.

Another **41.06%** reduction of the remaining domain is needed to get strictly below one million. This prototype does not claim that target has been achieved.

## Reduction rules

The implementation is [dominance_reduction.mjs](../../tools/dominance_reduction.mjs), used only by [the exhaustive-study adapter](../../tools/exhaustive_screening_study.mjs). It produces concrete replacement rules and tuning witnesses before applying constraints to the mounting model.

- **Cost and compatibility:** replacement cost cannot increase. Dependency-sensitive parts, bound ammunition and unsupported child/tuning structures are kept. Explicit identity locks and locked descendants prevent parent elimination. Future child slots must match, except that extra optional children may be offered where the old part has none and there are no corresponding default/forced rules. The replacement can leave those extra sockets empty. This removes a detrimental extended-magazine choice without losing any continuation available to that choice in the current 20-shot objective.
- **Actual source inputs:** coefficients come from the native source contract. Control, Handling and Stability are treated separately from direct H/V recoil, shake, kick and timing multipliers. Displayed Control alone is not a dominance key. Other reference changes and unknown effects remain distinct. Accuracy/range/visual/magazine/reload fields ignored by the current fixed-20-shot Lowest Recoil objective are omitted only in this scoped research profile; stat floors disable the profile.
- **Legal tuning envelope:** enumerate the optimizer's legal notch/step positions using `curves.c/n/r`, then construct a nondominated coefficient frontier. Each discarded part's frontier point must have a concrete no-worse replacement witness. Independent controls that affect only unused attributes do not distinguish the scoring envelope. This is the generator's finite tuning-position domain, not a claim about arbitrary off-grid values or the live game client.
- **Source arithmetic checks:** relevant point-to-effect curves must be positive and nonincreasing, including the exact quadratic derivative extrema of the source cubic interpolation. Whole-domain conservative lower bounds check that multiplier signs cannot invert as other parts/tuning are added. Unsupported mappings or aliases fail closed.
- **Lexicographic recoil-first comparison:** a replacement may worsen Handling only when a nonzero recoil-axis gain establishes a strict primary improvement under the supported native profile and default 40/30/30 weights. Otherwise Handling must also be no worse. The strict rule requires nondegenerate source trajectories and a minimum coefficient gap. All retained rules are checked by uncached native objective comparisons in applicable source contexts.
- **Joint rear-grip/stock rules:** compare combinations as well as individual parts while retaining future behavior and concrete tuning witnesses. Two joint rules supplement 96 host-specific atomic rules. Counts are rules over mounting contexts, not 98 universally interchangeable attachment identities.

The initial all-component dominance pass produced **2,192,034** layouts and completed a browser scan in **125.33 s**. Recoil-first handling of the primary objective reached **1,884,381** and **104.45 s**. Allowing the validated extra-optional-child case reaches the final **1,696,710** profile. Intermediate traces are preserved in the sibling evidence directories. A wider four-slot prototype added substantial complexity for little additional reduction in its initial test; it was not integrated. A more elaborate uniform paired H/V interval experiment also did not improve the accepted domain and was left out.

## Guarantees and remaining work

These are best-solution dominance rules, **not a certificate that the original top-5% population or exact ranked list is unchanged**. Taking 5% of the smaller population produces a different gate. The legacy top-5% survivor set is not materialized by this study, and downstream tactical/calibration searches are not completed here.

Tuning-envelope coverage and source comparisons provide evidence for the scoped replacement rules; they are not a universal proof that the full generator's calibrated result is unchanged across every future model, lock, floor and weapon. Other stat requirements disable the prototype. The experimental flag remains off by default.

The known best ordinary baseline objective must match after a full reduced sweep. Additional source-context and calibration checks are recorded in `validation.json`; exact traversal reconciliation and uncached partition-best replays are recorded separately in `scan-validation.json`. The one-million target remains open: stronger context-aware partial-state compression or pruning would be needed. Restricting the choices to the earlier heuristic lists would meet the count target but would change the search promise, so those lists were not silently enabled.

## Validation and reproduction

```powershell
node tests/dominance_reduction.mjs
node tests/exhaustive_screening_study.mjs
python tools/build_github_pages.py
node tests/exhaustive_screening_browser.cjs
# Start the already-served static study with the experimental profile:
$env:SCREENING_DOMINANCE='1'
node tools/run_exhaustive_screening_browser.cjs
Remove-Item Env:SCREENING_DOMINANCE
# Once the scan finishes:
node tools/validate_exhaustive_screening.mjs data/optimizer_validation/m4a1_dominance_20261118
```

The browser integration suite still completes the baseline 395-layout reduced-budget fixture. With the prototype enabled, that fixture has **313** layouts; both independently counted domains finish exactly once through real workers. It also checks cancellation, no automatic worker restarts and responsive layout. The native suite checks source objective vectors, concrete tuning witnesses, cost/locks, unsupported-request fallback, altered dependency fallback and curve overshoot rejection.

[Evidence directory](../../data/optimizer_validation/m4a1_dominance_20261118/), [rule/witness validation](../../data/optimizer_validation/m4a1_dominance_20261118/validation.json). Some browser startup attempts failed before screening began while concurrent browser checks were running. Their error traces are preserved with `startup_failure_` names and are excluded from the successful scan's measurements. An isolated worker-load check and sequential browser integration run passed before the successful retry. The specific underlying startup failure was not established; it is not counted as completed work or hidden by a partial-worker result.


[Final scan](../../data/optimizer_validation/m4a1_dominance_20261118/final.json), [scan reconciliation/native replay](../../data/optimizer_validation/m4a1_dominance_20261118/scan-validation.json), [statistics](../../data/optimizer_validation/m4a1_dominance_20261118/statistics.json), [source/data hashes](../../data/optimizer_validation/m4a1_dominance_20261118/provenance.json), [SVG chart](../../data/optimizer_validation/m4a1_dominance_20261118/dominance_comparison.svg). The completed browser window remains open; all its search workers terminated naturally.
