# Solver recommendation

The [current category rules and calibrated G18 reference](category_rules.md) supersede the category decisions in this initial roadmap.

## Production readiness

Start with a scoped beta for grouped ordinary M4A1 Detonation, under the source version and request guards that the exact search has actually tested. Let other requests use the existing anytime solver with feasible replayed results labeled Best Found. Extend exact support by validating new domains one at a time. A catalog-wide exact release requires broader coverage before shipping that claim.

| Release gate | Acceptance evidence |
| --- | --- |
| Category behavior | Minimum Acceptable must achieve 60% of the maximum modeled gain. Balanced must cost strictly between the certified endpoint prices and improve strictly on Minimum Acceptable. Verify strict comparisons, empty windows, and partial results. Decide whether players need a meaningful gain floor beyond a strict increase, using in-game measurement and clear units. |
| Scope and formulas | Exhaustively check small cases against the native resolver, legal tuning grid, prices and scorer. Cover unlockable optics, tactical effects, explicit locks, stat floors, other weapons and modes before advertising exact support for them. A guard failure must route to a conservative search or a best-found fallback. |
| Browser budget | Test desktop browsers from the actual static export. Measure end-to-end wall time, peak memory, responsiveness and time to first witness. Verify cancel, restart, initialization failure, and a 300-second wall-clock cap with final updates and termination. |
| Certificates and UI | Verify per-output proof against oracle values after forced stops. Distinguish proven optimality, bounded results, best found, proved absence and unresolved results. Replay every returned build with the pinned source model. |
| Game validation | Check recoil and camera movement against reproducible in-game comparisons and document the game build, region, score units and price snapshot. Describe the published score as modeled recoil gain until the perception proxy is validated. |

The Balanced beta candidate maximizes modeled gain above the line between the certified endpoints, within the strict price and gain window. The ordinary M4A1 fixture reached 70.4% of the additional gain for 43.75% of the additional cost. Local production smoke tests passed for the existing optimizer and the research Worker passed a separate cancellation and timeout test. [Comparison and test scope](category_rules.md#balanced-efficiency-and-browser-checks).

The narrow fixture establishes feasibility of the custom JavaScript worker. Start by integrating it behind an eligibility flag and exercising the actual production request, deadline and result lifecycle. Engine replacement and more workers can wait for profiling that shows a launch bottleneck.

## Initial research roadmap (historical)

Use a custom JavaScript module in a Web Worker for a **joint, completion-aware branch-and-bound** prototype over the native mount graph and finite slider domain. The current codebase uses JavaScript; TypeScript is compatible with the design if the project adopts that toolchain. Keep the existing anytime search as an incumbent generator and the current lossless DAG for exact default-calibration screening. Add fixed-layout SCIP/HiGHS subproblems only where the model gives a justified native bound or complete value representation. [Engine comparison](algorithm_comparison.md).

Search once for maximum performance, minimum acceptable cost and balanced utility. Maintain three incumbents and per-query bounds, optionally sharing exact computation across equivalent states. The prototype uses fixed order and an interval bound on a nonlinear score; the independent oracle certifies its results on the declared fixture domain. Existing native workload evidence supports lossless state sharing for default layouts. It does not establish that the proposed calibrated bounds will be tight. Full calibrated browser performance under five minutes remains open. [Measurements](benchmark_results.md), [proof obligations](pruning_proofs.md).

A rank cutoff before tuning can certify the requested results only with a separate proof that excluded cores cannot supply a better legal completion, or with complete coverage. The current exact DAG certifies its declared default-calibration ranking. The project has actual feasible counterexamples to production optimality and the synthetic prototype isolates how a later decision can reverse the core ranking. [Native witnesses](../full_budget_optimality.md).

## Roadmap

1. Freeze versioned data and native objective/price contracts. Agree on the performance threshold, currency-specific utility penalty, hard floors and tie ordering. Keep request validation and cap semantics explicit per query.
2. Build a fully calibrated tiny source oracle using the current mount resolver, legal-position generator and native scorer. Add tactical, reference overwrite, float-order, mode/price and tuning crossover fixtures. Use the current G18 guard as an independent comparison.
3. Wire a native search adapter using only sound structural feasibility and cost lower bounds initially. Precompute legal slider operation tables by actual mount context. Evaluate slider choices in the joint search or a fully covered fixed-layout subproblem. Extend interval bounds through native numeric operations and score branches and fall back to an unrestrictive bound for unsupported domains.
4. Add incumbent seeding, bounded exact caches, and compare fixed order, most-constrained-first and promising-first traversal under identical workloads. Preserve calibration context and native operation order in state keys. Enable objective dominance only for the scalar-output query and only after a continuation proof. Measure before porting score kernels to Rust/WASM.
5. Partition provably disjoint subtrees across a bounded worker pool. Benchmark single worker against the existing eight-worker configuration and tune memory limits for mobile. Use same-origin module workers and independent single-thread WASM runtimes where needed. Shared-memory threads require cross-origin isolation; current static deployment should rely on independent workers unless hosting support is verified.
6. Enforce the 300-second wall-clock cap from the solve request, including initialization, seeding and result delivery. Publish provisional feasible incumbents and consolidated bound snapshots during the solve. Keep bounds for assigned work until completion or an atomic replacement by its covered children. Reserve time to publish a final snapshot, then terminate workers at the cap or on cancel.
7. Display per-output optimal, bounded with a numerical interval, best found, proved infeasible, or unresolved as appropriate. If the exact engine fails or has no usable bound, retain replayed feasible heuristic witnesses and label them best found. Missing witnesses stay unresolved unless coverage proves infeasibility. Avoid percentage gaps when the score scale can cross zero; use score, currency or utility units.

## Unresolved

- Confirm whether the cheapest acceptable build may exceed the budget and whether Balanced must also meet the performance threshold. Choose λ per mode and decide whether duplicate outputs or specific tie-breaks are desired.
- Confirm client build/region, exact calibration acceptance and any costs, explicit price staleness rules, and in-game validation of camera/sight movement and score scales. The implementation currently evaluates the pinned source proxy.
- Prove native calibrated interval coverage for floors, profile changes, tactical completion and timing-sensitive effects. Determine where intervals or exact calibration envelopes pay for themselves and measure memory, worker startup, message costs, and worst-device runtime.
- For the separate ranked screening contract, preserve path identity and multiplicity. A top-percentile survivor set can seed this solver, while its ranks and the interactive three-output proof remain separate workloads.
