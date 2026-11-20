# Browser MILP engines for grouped screening and calibration

Research date: 2026-11-18. Primary-source review only; no implementation changes, solves, tests or benchmarks. Browser package capabilities below describe the linked current sources, not guarantees about older npm releases. Pin the exact package, native solver and WASM artifact before implementation.

## Recommendation

Keep the custom JavaScript exhaustive evaluator/DAG for the mandated complete grouped-layout screening and exact percentile ranking. Keep SCIP as the working reference calibration backend. **HiGHS through `lovasoa/highs-js` is the strongest immediate alternative MILP backend to evaluate for calibration**, because its current browser wrapper supports the required linear/integer model and offers persistent models and direct sparse input. This is an engineering-fit recommendation, **not evidence that HiGHS runs faster or proves more optima on this workload**. No comparative measurements exist in this research.

GLPK.js is a technically feasible browser LP/MILP alternative, but its documented wrapper has a narrower control surface for repeated source-replay/cut refinement. Replacing SCIP solely because another engine runs in a browser is unnecessary: the repository already has a pinned single-threaded SCIP WASM artifact.

## What this repository actually runs

- [`tools/optimizer_engine.mjs`](../../tools/optimizer_engine.mjs) exports `generateAnytime` as production `generate`. A different solver backend would not automatically replace production search.
- [`tools/scip_optimizer.mjs`](../../tools/scip_optimizer.mjs) exposes the separate reference `generateSCIP`. It first runs exhaustive ordinary and per-survivor tactical gates; then SCIP optimizes calibration over survivors. It explicitly records `global_optimality:false`, because default-calibration screening can discard the best calibrated build.
- [`tools/scip_linear_model.mjs`](../../tools/scip_linear_model.mjs) emits linear CIP constraints and continuous/integer/binary variables. [`tools/scip_objective_model.mjs`](../../tools/scip_objective_model.mjs) represents norms with supporting cuts, rounded recoil-chart coordinates with integers, and speed tiers with binaries. [`tools/scip_optimizer.mjs`](../../tools/scip_optimizer.mjs) replays incumbents through the source evaluator and adds norm/rounding cuts.
- [`tools/scip_runtime.mjs`](../../tools/scip_runtime.mjs) creates a fresh runtime, writes CIP/start files to its virtual filesystem, invokes SCIP's command interface and parses solution/statistics output. It requests zero relative/absolute MIP gap and feasibility tolerance `1e-9`; source replay has separate tolerances. A HiGHS adapter would replace this boundary plus CIP serialization, while retaining the formulation and replay checks.
- [`vendor/scip-7e68f9ca/VERSION.txt`](../../vendor/scip-7e68f9ca/VERSION.txt) identifies SCIP 10.0.2, Emscripten 6.0.2, pthreads OFF, oneTBB OFF and PaPILO OFF. Native SCIP benchmarks or features enabled in other builds do not characterize this artifact.

The original ordinary grouped domain is 12,885,654 layouts, with exact `ceil(N/200)` = 64,429 top-0.5% survivors for the documented M4A1 fixture. See [`TODO.md`](../../TODO.md) and [`docs/ranking_semantics_research.md`](../ranking_semantics_research.md). Those are existing results, not rerun here.

## Engine comparison

| Engine/build | Relevant mathematical class | Browser integration | Fit and limits |
|---|---|---|---|
| Existing SCIP 10.0.2 WASM | Current project emits MILP only | Already vendored JS/WASM; synchronous CLI execution can live inside a Worker; virtual filesystem, no server solver | Existing source replay/cut loop; known adapter. Native SCIP's broader capabilities do not establish nonlinear reliability in this build. |
| HiGHS via current `highs-js` | LP, MILP, continuous convex QP; no general nonlinear model or MIQP | JS loader + WASM; synchronous model operations inside a Web Worker; single-threaded solve | Best alternative for the current linearized calibration model; persistent sparse model API could avoid repeated parse/setup. Actual gain unmeasured. |
| GLPK.js | LP/MILP, including named binary/general integer columns | Browser API uses a Web Worker and returns promises | Suitable basic MILP interface; documented callback is LP-only and ignored for MIP. Repeated refinement requires more adapter care. |

HiGHS's own site identifies LP/MIP/QP and the base solver's MIT licensing. This does not mean its native parallel algorithms are available in the browser build. [HiGHS official site](https://highs.dev/).

The wrapper's current overview explicitly limits its supported scope to LP/MILP/continuous convex QP, with single-threaded browser execution; it describes MIP starts, SOS1/SOS2, callbacks and incremental model mutation. Those are wrapper-maintainer claims, not an official HiGHS-maintained JavaScript distribution. [highs-js overview](https://lovasoa.github.io/highs-js/).

Its API reference documents asynchronous WASM initialization followed by synchronous operations, recommends Workers, and provides `locateFile` for a self-hosted `highs.wasm`. It offers both one-shot `solve(lpText)` and persistent model access. [highs-js API](https://lovasoa.github.io/highs-js/docs/). The package identifies itself as MIT and currently declares version 1.15.4; package version and underlying solver version must be recorded separately. [package manifest](https://github.com/lovasoa/highs-js/blob/main/package.json).

GLPK.js describes itself as a partial browser/Node WASM port exposing JSON LP/MILP models, with `binaries` and `generals` arrays. [Maintainer README](https://raw.githubusercontent.com/jvail/glpk.js/master/README.md). Its browser interface is asynchronous and has worker termination; its shared types expose time limit/MIP gap and an LP-only iteration callback, rather than a documented general MIP callback or MIP-start argument. [Browser interface](https://github.com/jvail/glpk.js/blob/master/src/index.d.ts), [shared types](https://raw.githubusercontent.com/jvail/glpk.js/master/src/types.d.ts).

## Static hosting and threading

The current highs-js build sets `HIGHS_NO_DEFAULT_THREADS=ON`, links a single-threaded WASM binary, supports `web,worker,node`, and enables memory growth. Thus it can be deployed as static JS/WASM assets and instantiated independently in ordinary Workers without solver pthreads. This conclusion follows from the build configuration; a deployment smoke test is still required. [Build source](https://raw.githubusercontent.com/lovasoa/highs-js/main/build.sh).

Its demo mentions `SharedArrayBuffer` for an optional interrupt flag read inside synchronous callbacks. That is distinct from solver threading or normal solving: do not infer a shared-memory requirement for the basic single-threaded solve from the cancellation example. Without shared-memory cancellation, terminate/recreate the Worker or use solver time limits. [Demo and callback explanation](https://lovasoa.github.io/highs-js/).

GLPK.js's build targets Node/Worker and contains no pthread option; the maintained browser API manages the worker. This supports static hosting of this single-threaded implementation, rather than promising a multithreaded solver. [Build source](https://raw.githubusercontent.com/jvail/glpk.js/master/Makefile). The existing SCIP artifact explicitly disables pthreads, as its local version file records.

Independent Worker instances can process independent calibration survivors or partitions. They do not share a branch-and-bound tree automatically. Sixteen Workers also imply up to sixteen solver heaps and model copies, so worker count and batch sizing need memory measurements. This is architectural inference, not a benchmark. Any future validation or benchmark in this project must use **16 actual participating workers** under the user's requirement.

## Exact screening, ranking and numerical guarantees

An MILP optimizer normally proves an optimum without visiting every feasible assignment. That is useful for calibration; it does not meet a requirement to score every grouped layout through the native JavaScript evaluator and preserve each incoming identity/rank position. A solution pool or repeated no-good constraints is not automatically the existing complete population or canonical top-K order.

To enumerate binary decisions, a no-good cut can exclude one exact assignment after each solve. Doing this millions of times adds solve/cut overhead, and it still requires correct treatment of equivalent numeric states, incoming multiplicities, calibration decisions and source-specific scoring. No claim that it is faster is justified. Exhaustive native scoring plus shared-state computation and exact global-K ranking remains the direct fit for the screening contract. This is reasoning from the task requirements and local implementation.

The current calibration representation is linear, so HiGHS's lack of MIQP/general nonlinear support does not by itself disqualify it. Conversely, changing a Euclidean norm into a squared norm or substituting a convenient quadratic model can change a weighted multi-component or lexicographic objective; do not do so without an equivalence proof. Retain the existing norm-cut refinement and fresh source replay when evaluating alternate MILP engines.

Zero requested MIP gap is a solver stopping configuration, not exact agreement with JavaScript floating-point ranking. Preserve the strict ranking contract, source order, rounding behavior, feasibility replay and status/bound reporting independently of engine. A time-limited feasible incumbent remains best found. Any proof concerns the modeled, screened calibration domain only.

## Licensing and support boundaries

SCIP has used Apache-2.0 since 8.0.3; its official license table warns that optional linked dependencies add licenses. [SCIP official license information](https://www.scipopt.org/). The existing artifact's full component notices and source details live beside its WASM; keep them when deploying. HiGHS core and highs-js state MIT, but audit the exact compiled dependency set rather than transferring the core label to arbitrary optional builds. GLPK.js is GPL-3.0. [GLPK.js license](https://github.com/jvail/glpk.js/blob/master/LICENSE). This is a dependency inventory, not legal advice.

No official SCIP-maintained browser JavaScript package was established by this review. The actual local artifact is concrete evidence of browser compilation; its provenance, enabled features and numerical limitations are the relevant support boundary. Do not describe a community/custom WASM distribution as official browser support.

## Next decision gate

First finish the exact-screening improvements independently of solver choice. Then, if calibration is material in measured end-to-end time, implement a small HiGHS adapter for the *same linear model*, same survivors, same objectives/cut loop and source replay. Compare pinned SCIP versus pinned HiGHS with 16 actual participating workers on identical cohorts, recording startup/model-transfer/solve/cut/replay time, solved status, primal/dual bounds, final source ranks, memory, cancellation and total wall time. Include bounded/time-limited cases and difficult numerical/rounding fixtures. Choose only after that evidence; this report cannot establish a performance winner.
