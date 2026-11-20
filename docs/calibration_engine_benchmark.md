# Browser calibration adapter benchmark

2026-11-18. Implemented an experimental [persistent HiGHS adapter](../tools/highs_runtime.mjs), a [paired calibration driver](../tools/calibration_engine_benchmark.mjs), and a local static [browser study](../builder/calibration-engine-study.html). Production Generate, exhaustive screening, grouping and the source objective remain unchanged. No release was published.

## Result

All **16 browser workers** participated. Across four fixed-layout M4A1 examples (four repeats each), both engines reported model optimality in all **64 calls**, covering primary recoil and conditional Handling phases. Every incumbent passed native mounting/tune/stat/target replay and model row/bound checks. Final native objective vectors match exactly in all16 pairs. This is a numerical-model benchmark, not a new global optimality proof.

| Fixture | Primary SCIP / HiGHS median | Handling SCIP / HiGHS median |
| --- | ---: | ---: |
| Insight only, no scored tuning controls | 213.1 / 138.1 ms | 524.9 / 5.3 ms |
| Barrel/muzzle,2 controls | 527.6 / 176.6 ms | 287.4 / 21.2 ms |
| Grip/magazine,2 controls | 520.8 / 386.4 ms | 151.3 / 34.8 ms |
| Recorded660-point ordinary best,10 controls | 305.8 / 649.7 ms | 199.7 / 76.2 ms |

HiGHS's persistent adapter was especially effective for the second solve. SCIP was quicker on the primary solve of the most complex fixture. **Keep SCIP as the reference; these examples do not establish a universal replacement.** The comparison includes fresh SCIP runtime/CIP parsing versus persistent HiGHS sparse-model loading, so its differences are not attributable solely to the native solver engines.

![Paired browser solve timings](../data/optimizer_validation/calibration_engines_20261118/calibration_engine_comparison.png)

[Raw results](../data/optimizer_validation/calibration_engines_20261118/raw.json), [statistics and limitations](../data/optimizer_validation/calibration_engines_20261118/statistics.json), [validation](../data/optimizer_validation/calibration_engines_20261118/validation.json), [environment](../data/optimizer_validation/calibration_engines_20261118/environment.json), [source hashes](../data/optimizer_validation/calibration_engines_20261118/source-sha256.json).

## Protocol and limits

Both engines receive the same fixed attachment domain and model at each paired round; the CIP input hash is recorded and the model is checked for intervening mutation. Any native chart/Euclidean refinement cuts found by either engine are applied to both after the pair. The next Handling phase uses the same primary bound plus1e-8, following the reference model tolerance. Engine order is counterbalanced within each fixture and reversed between phases.

The fixed examples are legal workload fixtures, not newly computed members of a complete top-0.5% population. This run does not enumerate12,885,654 layouts, calibrate64,429 ordinary survivors, run tactical screening or test price categories. Source scoring uses the existing native calculator unchanged. No supporting/rounding cuts were needed for these cases, so complex iterative refinement remains insufficiently exercised; append synchronization is checked both by the shared primary row and by a contradictory-row primitive in each worker.

Each solve has a two-second benchmark allowance and each phase allows at most six refinement pairs. These are calibration benchmark bounds, not a screening deadline. A primary-only0.5-second pilot with fixture-confounded order is archived under `pilot-primary-only/` and excluded from the table. The final browser cohort completed in3.19 seconds including initialization/validation; solver totals overlap across workers and cannot be summed into that wall time.

This is one concurrent cohort, not16 independent whole-machine experiments. Bars show medians and points show individual repeats; no inferential confidence bands or broad solver speedup claim are justified. The current code did not measure peak solver memory, large survivor-table behavior or larger multi-layout calibration cohorts. The optic-only control mainly measures setup and adapter overhead.

The pinned npm package is highs-js1.15.4, whose loaded native solver reports HiGHS1.15.1. [Pinned provenance](../vendor/highs-1.15.4/provenance.json) includes registry tarball integrity and per-file SHA256; installation ran no package scripts. SCIP remains the existing pinned10.0.2 artifact. Native API models are disposed explicitly and the high-level adapter appends compatible new rows while rebuilding when columns change.

All compute ran in browser Workers from locally served static assets. Network validation permits only same-origin GET requests; no backend solver, SharedArrayBuffer or cross-origin isolation was needed. Sixteen-worker startup, signed-product/infeasibility checks and cancellation passed. Asset loading is representative of static hosting, not a fresh deployment verification on public GitHub Pages.

## Screening-engine decision

This calibration result does not change the initial-screening recommendation. Keep the custom lossless decision DAG and native scorer. The most credible off-the-shelf enumerator experiment is portable CP-SAT in satisfaction/all-solutions mode, with16 disjoint outer Workers and exact scoring/ranking retained outside the solver. Its enumeration throughput and effect on score reuse remain unmeasured. [Browser engine research](browser_solver_engine_decision.md), [CP/hosting details](archive/browser_cp_hosting_research.md).

Reproduce after `python tools/build_github_pages.py` and serving `.scratch` on port8770:

```powershell
node tools/run_calibration_engine_browser.cjs
python tools/report_calibration_engines.py
```
