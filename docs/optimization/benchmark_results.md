# Optimization benchmark results

## Three-output certificate prototype

Run from the repository root with Node, installed Chrome and the Playwright 1.65.0 at `.scratch/browser-qa/node_modules/playwright`. If the dependency is absent, install it with `npm install --prefix .scratch/browser-qa playwright@1.65.0`.

```powershell
node docs/optimization/run-benchmark.cjs | Set-Content -Encoding ascii docs/optimization/benchmark-data.json
```

[Raw repeated measurements](benchmark-data.json) record Node 24.22.0 and Chrome 157.0.8103.79. Chrome ran the same modules in a single module Worker over loopback HTTP using static GETs. One warm-up per variant precedes seven measured repeats with alternating order. Times below are medians and worst observed for these local runs, in milliseconds. Chrome clock resolution limits interpretation of sub-millisecond values.

| Fixture | Cartesian leaves | Budget-feasible / threshold-feasible | Nodes, enumeration → bounded | Terminal visits, enumeration → bounded | Bounded prunes | Chrome enumeration median / worst | Chrome bounded median / worst | Node enumeration median / worst | Node bounded median / worst |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Small | 504 | 56 / 21 | 592 → 149 | 504 → 12 | 113 | 0.1 / 0.2 | 0 / 0.1 | 0.24 / 0.40 | 0.04 / 0.17 |
| Tight | 528,125 | 91 / 6,014 | 572,656 → 914 | 528,125 → 20 | 777 | 38.1 / 62.4 | 0 / 0.1 | 40.44 / 73.12 | 0.09 / 0.16 |
| Loose | 528,125 | 528,125 / 6,014 | 572,656 → 1,144 | 528,125 → 34 | 971 | 39.1 / 47.5 | 0.1 / 0.2 | 50.25 / 52.12 | 0.11 / 0.21 |

The tight and loose cases use the same item and tuning options. The last two groups each have 13 synthetic positions. Feasibility counts come from independent full traversal. Terminal visits count complete tuples reaching query evaluation after pruning. Node setup also computes a cheap interval score bound, even in the enumeration control, so terminal counts do not measure all arithmetic. Raw trials include pending-frontier high-water counts, first feasible time, last incumbent improvement (across outputs), and proof time at completion. Browser process memory and startup are unmeasured.

The independent oracle and witness replay use exact equality on small integer data. Both runtimes pass five fixed fixtures and 100 seeded small generated fixtures, with multiple forced stops. Full runs agree on the three objective values and infeasibility. The reversal fixture returns score 991 under default-core screening and 1000 with full coverage. At 100 nodes the tight fixture has a cheapest-build gap of 46 cost units, with the budget-capped queries still lacking a witness. For the loose fixture the max and balanced gaps are 16 score units and 166 utility units, and the cheapest query still lacks a witness. These are certificates from pending-node bounds. [Harness](benchmark.mjs), [solver](prototype.mjs).

## Game-model evidence

| Existing or rerun workload | Measured result | Scope |
| --- | --- | --- |
| Fresh native-bound regression | `node tests/scoring_bounds.mjs` passed against 3,253 native scores | Default screening bounds with source phases, tiers, weights and fallbacks. |
| Fresh eight-worker native/DAG regression | `node tests/optimized_exact_dag_workers.mjs` passed on all 385 rows | Default-calibration source/identity parity. |
| Fresh eight-worker Chrome run | 20,528 layouts, 9,085 objective evaluations, exact order and uncached replay of 103 survivors | Existing static export at port 8770. IndexedDB cleanup, cancellation and static-only asset requests passed. |
| Historical full M4A1, Detonation 800, Insight locked | 12,885,654 ordinary layouts, 2,979,656 objective computations, 187.22 s optimized phase, 200.47 s complete audit, 3.294 GiB sampled aggregate RSS | Eight-worker Node observation including audit work, before latest eligibility change. Current policy counts 12,268,642; full scored timing remains unmeasured. [Full evidence](../exact_dag_cache_followup.md) |
| Historical small/full-domain trial | Guarded full-domain G18 results agree with production in both modes. Eight of ten weapon/mode results overall had better feasible witnesses. | [Five-weapon trial and native replay](../full_budget_optimality.md). |
| Historical browser calibration comparison | 64 model-optimal calls, four repeats per fixed layout; exact final native values matched across SCIP and HiGHS. HiGHS lower median in seven of eight fixture/phase comparisons. | Adapter-level fixed layouts only. [Timing distributions and reproduction](../calibration_engine_benchmark.md). |

Default screening and multi-layout calibration have different work profiles. The improved DAG run is within five minutes for the measured Node screening workload, with no general claim about browser completion, native calibrated optimality or the newer allowed domain. The synthetic timings establish algorithm behavior only.

## Full-domain benchmark harness still required

Freeze the pack/runtime, objective, mounting policy, calibration domain and price hashes, with machine/browser versions and worker count. Use G18 as a small native oracle, P90/Vector and SR-25/M249 for known hard cases, and locked/unlocked M4A1 at tight and loose caps. Include fixed layouts with many slider tuples, a legal fine-tuning reversal, tactical/laser selection, and tier thresholds. Enumerate all legal mounts and slider tuples on tiny cases after independent calculator validation. Verify each returned witness and compare exact query values and feasibility. For floating results, specify reference representation and comparison before running; native binary64 code paths should agree exactly when claimed identical, while MILP tolerances need separate residual and worst-case score accounting.

Use identical snapshots for legality-only enumeration and incremental ablations for state memoization, attachment/partial dominance where allowed, bound levels, calibration tables, incumbent seeding and most-constrained versus best-bound/DFS ordering. Current DAG and dominance reports use distinct workloads or populations; they do not supply an isolated ablation for the three-output calibrated problem. Compare JS and WASM only with identical inputs, objective, legal domain and claimed certificate. Compare solver adapters both cold and warm, including compressed bytes, instantiation and serialization.

For each run record raw Cartesian size, legal mount count and exact tuning tuple count where countable, branches and pruning reasons, complete terminal checks, slider/objective evaluations, cache bytes/hits and worker peak memory, first feasible and last improvement per query, time to proof, and bound gaps through the deadline. Report cold/warm medians, worst runs and distributions across desktop and representative mobile browsers. Sample process memory or use supported browser instrumentation and label missing measurements. Node RSS and logical frontier size measure different resources. Include startup and all phases in the five-minute end-to-end clock and test cancel with in-flight work. Full calibrated source integration and native-compatible bounds remain prerequisites for that comparison.
