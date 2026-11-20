# Browser constraint solvers and GitHub Pages

Research date: 2026-11-18. Scope: completely browser-executed grouped attachment screening, followed by calibration; preserve every legal layout directly or through proven lossless equivalence, exact source binary64 scores, and the original top-0.5% population. No implementation, tests or benchmarks were run. Performance remains unknown for this workload. Repository policy and ranking context: [TODO](../../TODO.md), [ranking contract](../ranking_semantics_research.md), [partial-state contract](../partial_state_merging_research.md).

## Finding

A browser CP engine can enumerate legal attachment decisions, then hand each complete layout to the existing JavaScript scoring and ranking pipeline. That is a plausible alternative **enumerator**, with no established speed advantage. No researched engine is a demonstrated replacement for the entire exact source objective and calibration pipeline. For ordinary GitHub Pages, independent single-thread worker instances are the clearest hosting fit; solver-internal pthread parallelism adds a separate deployment requirement.

## OR-Tools CP-SAT: official support and community ports

Google documents C++, Python, Java and C# distributions. Its official installation page does not advertise a supported JavaScript/WASM browser distribution. Colab examples are not evidence of client-side execution. [Google installation](https://developers.google.com/optimization/install), [official source README](https://github.com/google/or-tools/blob/stable/README.md).

CP-SAT handles finite integer constraints and provides all-solutions callbacks. For exhaustive identity enumeration, build a satisfaction model without an objective, enumerate to completion, and emit the decision variables defining the layout. Auxiliary variables must be functionally determined or deduplicated by a proved projection, or they can multiply the apparent layout count. Its all-solutions parameter affects presolve: official parameter comments discuss preserving feasible solutions and warn that completion/order must not be inferred from callback order. Ordinary optimization callbacks report improving incumbents, not every layout. [CP-SAT guide](https://developers.google.com/optimization/cp/cp_solver/), [parameter source](https://github.com/google/or-tools/blob/stable/ortools/sat/sat_parameters.proto).

Two independently maintained public source projects provide concrete browser port evidence, rather than an assumption that C++ portability implies an available package:

| Project | First-party project evidence | Implication |
|---|---|---|
| [owen-lacey/cpsat-js](https://github.com/owen-lacey/cpsat-js) | README, TypeScript API, tests and build sources; separate portable and threaded variants; portable defaults in browsers | Candidate for ordinary Pages workers without shared memory |
| [Axelwickm/or-tools-wasm](https://github.com/Axelwickm/or-tools-wasm) | Fork of Google repository; JavaScript bridge, standalone CP-SAT package, documented browser WASM and browser CI workflows | Another community distribution to audit; not an official Google browser API |

The first project's README documents `enumerateAllSolutions` with `onSolution`, no objective, one solver worker, and a synchronous solve. Its portable build clamps internal workers to one. Running the call in an ordinary browser Worker keeps the UI responsive. These are upstream interface claims, not locally verified package behavior. Neither project's unrelated timing claims establish this optimizer's speed. Current source/build infrastructure is evidence of an available maintained port, not a maintenance guarantee. Pin a release/commit and inspect packaged assets before integration. [cpsat-js API/build documentation](https://raw.githubusercontent.com/owen-lacey/cpsat-js/main/README.md), [or-tools-wasm distribution documentation](https://raw.githubusercontent.com/Axelwickm/or-tools-wasm/stable/README.md).

Integer modeling fits socket existence, parent-child legality, locks, one-of choices and exact integer budgets where those match source semantics. Scaling decimal coefficients does not automatically preserve source binary64 addition order, nonlinear recoil transformations, floors or strict ranking boundaries. Even a proven optimum of a surrogate model certifies only that surrogate. Full bit-level circuit encoding is theoretically another direction, but no such source-equivalent CP-SAT encoding exists in this research.

## Z3: actual browser binding, different deployment burden

Z3 has official JavaScript/TypeScript bindings published as `z3-solver`. Its documentation explicitly requires threads and SharedArrayBuffer, plus suitable browser response headers. Long-running calls execute on background workers, and certain calls cannot overlap within a context. Setting search threads to one does not remove this package-level runtime requirement. Generated worker/loading assets also need correct bundler paths. [Official JS API](https://z3prover.github.io/api/html/js/index.html), [official binding source](https://github.com/Z3Prover/z3/blob/master/src/api/js/README.md).

Z3's IEEE floating-point theory is relevant: it models rounding modes and nonassociative FP operations. A faithful encoding would need the actual source operation order, binary64 constants, branches, conversions and all used mathematical functions. Real arithmetic or rearranged algebra is insufficient. Availability of FP theory does not prove that this full JavaScript pipeline, its library operations or its lexicographic top-percentile selection are encoded. [Microsoft Z3 IEEE Floats guide](https://microsoft.github.io/z3guide/docs/theories/IEEE%20Floats/).

Inference: Z3 is a stronger candidate for targeted equivalence counterexample/proof work than for replacing an already structured exhaustive screening loop. No project measurement supports either a speedup or a slowdown. An all-model legality enumerator would need layout-projected blocking clauses and complete exhaustion; it still requires native scoring unless objective equivalence is established.

## Workers, shared memory and Pages

GitHub Pages publishes static HTML/CSS/JavaScript and supports repository project paths. Static hosting does not prevent browser computation; ship worker scripts, model/data assets and WASM at correct relative paths. [GitHub Pages definition](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

There are two distinct architectures:

1. **Sixteen independent ordinary Workers:** each owns a single-thread JS or nonshared WASM instance and a disjoint enumeration shard; communicate by messages, copied payloads or transferred ArrayBuffers. Ordinary Workers do not inherently require SharedArrayBuffer or cross-origin isolation. Per-instance solver memory remains a potential cost. [MDN Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).
2. **One solver using pthreads/shared WASM memory:** Emscripten uses SharedArrayBuffer, gated by secure context and cross-origin isolation. Standard deployment uses COOP `same-origin` and COEP `require-corp` (or suitable supported alternatives); cross-origin resource policy becomes relevant. Sixteen solver pthreads is not the same topology as sixteen independently partitioned exhaustive workers. [Emscripten pthreads](https://emscripten.org/docs/porting/pthreads), [MDN SharedArrayBuffer security](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer).

Do not confuse Emscripten's specifically named **Wasm Workers API**, which shares module memory and needs isolation, with ordinary browser Workers hosting isolated WASM instances. Emscripten explicitly recommends its message-oriented Worker API when shared memory/isolation is undesirable. [Emscripten comparison](https://emscripten.org/docs/api_reference/wasm_workers.html).

The inspected GitHub documentation provides no supported per-site custom-header configuration; GitHub's public COOP/COEP feature request includes a staff response describing custom headers as a future scenario without an ETA. A later custom-header request remains public. This supports treating direct Pages isolation as unavailable in the current plan, without pretending an old discussion proves an immutable hosting limitation. An `_headers` file is not a documented GitHub Pages feature, and HTML meta tags cannot substitute for all required response policies. [GitHub COOP/COEP request](https://github.com/orgs/community/discussions/13309), [custom-header request](https://github.com/orgs/community/discussions/199121).

The official Z3 JS documentation links a service-worker isolation workaround for Pages and cautions against using it in more complex applications. That remains entirely client-side hosting in one sense, but adds registration/control/reload and resource-policy complexity; it is not native Pages header support. A proxy/other host that adds headers changes the hosting arrangement. No deployment workaround was tested here.

## Exactness and adoption boundary

For this requirement, accept only direct complete enumeration or a proof that merged state preserves all continuations, native event order, cost, calibration correspondence and identity multiplicity. Disable symmetry breaking or solution-removing presolve unless proven harmless for the required identity population. Never use dominance, top-choice shortlists, approximate objectives or incomplete optimization incumbents to stand in for exhaustive coverage.

Keep scoring/ranking outside a legality solver: replay exact JavaScript evaluation, count original identities with BigInt, retain `ceil(N/200)`, and merge shard results under the existing total order including canonical identity. For N=12,885,654, K=64,429; weighted equivalent states must reconstruct identities crossing the boundary. Later calibration must use the original legal control positions and source evaluator; a CP/SMT optimum is not a calibrated guarantee without matching that domain and evaluation.

Conclusion: **portable community CP-SAT is a technically credible browser enumeration experiment, not a demonstrated upgrade; official Z3 JS is browser-capable but adds an isolation obstacle on direct Pages and has no established throughput advantage.** Retaining the current exhaustive JavaScript worker architecture while improving proved state reuse is presently the least disruptive exact path. SAT/Kissat was not promoted: encoding legality alone would retain the native-scoring workload, while exact binary64 objective circuits would add a substantial unproved translation. No claim is made that a production-quality official Kissat browser package is available.

Any future validation must use the user's required 16 participating workers and separately establish coverage, identity multiplicities, every exact score/rank boundary, calibration-domain correspondence, browser lifecycle, cancellation and memory. This report performs none of those tests and makes no performance claim.
