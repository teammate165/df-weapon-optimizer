# Browser solver choice for this optimizer

Follow-up: [16-worker browser adapter benchmark](calibration_engine_benchmark.md) now measures four fixed-layout calibration examples. Both engines match final native vectors; HiGHS wins most observed adapter-latency medians while SCIP wins the complex primary fixture. This supports further calibration evaluation, without establishing a screening-engine speedup or a universal replacement.

2026-11-18. Source research only; no solver installation, replacement, tests or benchmarks. The current exhaustive contract preserves all 12,885,654 grouped ordinary layouts directly or by proven score equivalence, then selects 64,429 exact top-0.5% identities. Dominance and score-based pruning remain disabled in the active study.

## Recommendation

Keep the custom exact enumerator/DAG for screening. Keep the existing SCIP WASM as the reference calibration backend. **HiGHS/highs-js is the first alternative calibration backend to benchmark**, while portable community CP-SAT is a separate legality-enumeration experiment. None has a measured advantage on this project, and changing the solver engine does not establish fewer than one million exact scorer evaluations.

## Why these are separate decisions

[`optimizer_engine.mjs`](../tools/optimizer_engine.mjs) exports the bounded anytime production generator. The exhaustive study is implemented in [`merged_screening.mjs`](../tools/merged_screening.mjs) and [`mount_search.mjs`](../tools/mount_search.mjs). These do not invoke SCIP. [`generateSCIP`](../tools/scip_optimizer.mjs) is a separate reference path: it performs attachment/tactical screening first and then uses SCIP to calibrate the surviving complete configurations.

Our score is an ordered native binary64 calculation with curve lookups, rounded chart coordinates, firing timelines, speed tiers, Euclidean components and lexicographic Handling. Generic integer/linear optimization does not automatically reproduce that score or all original identities. A solver optimum for a translated model is distinct from complete source scoring and from a globally calibrated optimum over layouts discarded by screening. [Exact scoring source trace](exhaustive_scoring_research.md).

## Practical alternatives

| Engine | Browser/static-host evidence | Role here |
| --- | --- | --- |
| Custom JS DAG/enumerator | Current browser worker traversal is locally validated; full merged timing was Node-only. | Best current architectural fit for exhaustive source scoring and multiplicity-preserving reuse. |
| Existing SCIP WASM | Vendored 10.0.2 artifact, pthreads OFF, already deployed/reference-tested in this repository. | Keep as calibration reference; no demonstrated reason to replace it yet. |
| HiGHS/highs-js | Maintainer documents browser WASM, Workers and persistent sparse MILP models. | Strongest immediate alternate backend for the current linearized calibration formulation. |
| Portable CP-SAT community port | `cpsat-js` documents portable browser WASM without SharedArrayBuffer and all-solutions callbacks. | Credible exact legality-enumeration experiment; retain native JS scoring/ranking outside it. |
| GLPK.js | Maintained browser/Node LP/MILP WASM interface. | Feasible secondary MILP candidate; narrower documented controls for repeated calibration refinement. |
| Z3 official JS | Official browser WASM bindings require shared-memory threading support. | Targeted equivalence/proof experiments; additional Pages isolation setup and no demonstrated screening throughput advantage. |

### HiGHS and SCIP

The current calibration compiler emits only linear constraints with continuous/integer/binary variables. Norms use iterative supporting cuts and chart rounding uses integer variables. SCIP's broader nonlinear feature set is not used here. The model-builder data structures are generic, but serialization currently emits SCIP CIP and the adapter parses SCIP-specific text output. [Model builder](../tools/scip_linear_model.mjs), [objective compiler](../tools/scip_objective_model.mjs), [runtime adapter](../tools/scip_runtime.mjs).

HiGHS supports LP/MIP/QP. Its independent `highs-js` wrapper documents a persistent model API with sparse inputs, model mutation, starts/callbacks and explicit disposal; solves are synchronous after asynchronous WASM loading and should run in Workers. Our current SCIP adapter creates a new runtime and reads model text for each solve. Persistent access is therefore a concrete integration opportunity, not a proven speedup. Preserve the same MILP, cut loop, survivor population and native replay when comparing. [HiGHS official](https://highs.dev/), [highs-js API](https://lovasoa.github.io/highs-js/docs/).

### CP-SAT and GLPK

Google documents integer CP-SAT constraints and all-solutions enumeration; its official distributions advertise C++/Python/Java/C#. Community browser ports must be audited and pinned independently. The inspected portable `cpsat-js` variant documents enumeration without an objective and one internal solver worker. Sixteen disjoint ordinary worker instances could enumerate legal choices and feed the existing scorer. This changes the enumerator, not the native objective implementation, and requires coverage/projection tests. [Google CP-SAT guide](https://developers.google.com/optimization/cp/cp_solver/), [Google installation](https://developers.google.com/optimization/install), [portable port source](https://github.com/owen-lacey/cpsat-js).

GLPK.js offers browser LP/MILP through a JSON interface. It is technically usable, but its documented callback is LP-only rather than a general MIP callback. That makes it a lower-priority candidate for our refinement loop; no performance ordering has been established. [GLPK.js](https://jvail.github.io/glpk.js/).

## GitHub Pages architecture

Pages hosts static files; browser-side compute can load pinned JS/WASM/data assets and work without a solver server. Use 16 ordinary message-passing Workers with single-thread instances for the required tests. This does not require a shared solver heap or imply internal 16-thread search. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [MDN Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

Emscripten pthread builds require SharedArrayBuffer and cross-origin isolation. This introduces a hosting requirement beyond ordinary Workers. Z3's official JS package explicitly needs that setup and mentions a client-side Pages workaround; it is not a straightforward header-free drop-in. Do not label browser execution impossible, but budget for deployment complexity. [Emscripten pthreads](https://emscripten.org/docs/porting/pthreads), [official Z3 package README](https://raw.githubusercontent.com/Z3Prover/z3/master/src/api/js/PUBLISHED_README.md).

Sixteen independent solver instances also mean sixteen heaps/model copies. The earlier memory measurements make per-worker budgets and model reuse important. No native parallel-solver benchmark or package author's unrelated timing example predicts our browser throughput.

## Decision gate

Improve exhaustive state/scoring reuse independently of the backend. If calibration then proves material, compare pinned SCIP and HiGHS on identical survivor cohorts and linear formulations, using **16 participating workers**, fresh native replay, identical status/bound interpretation and matched treatment of model construction, cut refinement, cancellation and memory. CP-SAT merits a separate satisfaction-only enumeration comparison if mount legality is a measured bottleneck. No engine replacement is made by this research.

Detailed source audits: [MILP engines](archive/browser_milp_engine_research.md), [CP/SMT and hosting](archive/browser_cp_hosting_research.md). Incremental findings and source URLs are cached under `.scratch-archive/exhaustive-research-cache/browser-*-notes.md`.
