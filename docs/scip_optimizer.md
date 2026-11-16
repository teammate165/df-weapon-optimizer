# SCIP production optimizer

The production entry point `tools/optimizer_engine.mjs` delegates directly to `scip_optimizer.mjs`. Both presets use a full-weapon linear mixed-integer model in SCIP 10.0.2. Visitors run the pinned single-threaded WebAssembly runtime in a module Worker; GitHub Pages needs no Python backend or cross-origin isolation.

## Search space and source contract

`scip_mount_model.mjs` models every supported selectable attachment at every recursively available socket. Boolean constraints reproduce source default/forced rules, provider visibility, occupancy, parent dependencies, conflicts, fixed selections, mode eligibility, laser policy, required optics and priced budgets. No top-5% screening or coordinate attachment search executes in production.

`scip_stat_model.mjs` encodes source effect ordering, strongest tactical effects, additive main stats, detailed multiplicative effects and each relevant calibration notch. Main-stat response curves use exact finite lookups across their source domain, including above 100; irrelevant scoring controls remain at neutral. Binary products use bounded linear disjunctions. Presets expose a solver plan alongside their existing source scoring functions.

`scip_objective_model.mjs` preserves the current recoil and agility objectives. It models the fixed source chart window, five-decimal source coordinates, fire-timing regimes, horizontal speed tiers and the existing default normalization. Euclidean camera/kick terms use linear supporting cuts with iterative refinement. Returned incumbents are recalculated using the preserved source calculator; chart-rounding discrepancies add conditional cuts. This path contains no nonlinear SCIP constraints and does not invoke the WASM interval-arithmetic path rejected in the earlier [feasibility trial](scip_wasm_feasibility.md).

`data/solver_starts/` supplies optional legal primal starts, including earlier search results. SCIP can select any model attachment/calibration combination regardless of these starts. Starts are rescored and revalidated against the actual request; they are neither a candidate table nor an optimality certificate. The old JavaScript attachment optimizer is no longer imported or exported by the production entry point.

## Time limits and claims

The UI replaces passes with 5, 30 and 120 second solve budgets. Legacy API `passes` maps to a time budget only when `time_limit_seconds` is absent. Cancel terminates the Worker; a fresh Worker handles the next request.

Max, Handling tie-breaks and price/category phases share the requested time budget. Different bounded runs can produce different incumbents. Distinct price alternatives can remain unavailable; Warfare has no price alternatives. Outputs retain `best_found` status and source replay data. Diagnostics expose SCIP phase status, primal/dual bounds, model gap, cut counts and elapsed time. Pending refinement cuts invalidate any apparent zero-gap completion. `global_optimality` is deliberately false: this release does not claim every weapon/request has been globally solved. Even a closed numerical model bound is separate from fidelity to the actual game.

The linear solver uses feasibility tolerance 1e-9; incumbent source-field comparisons use 1e-7. Source rounding uses conservative envelopes and conditional exact-source cuts. Norm refinement also has numerical tolerances. Inspect implementation diagnostics rather than interpreting a successful runtime load as proof.

## Validation, 2026-11-16

- All 69 default mount graphs match source resolution.
- All 207 weapon/mode default stat encodings and 20 equipped/calibrated witnesses match source fields.
- Ten equipped chart/objective witnesses match source scores.
- All 138 weapon/preset integration requests return source-valid results without solver errors. These short requests are not 138 optimality proofs.
- Ten 30-second full-budget regressions preserve the prior Standard results, including Operations budget 5,000,000. Eight beat the earlier production baseline; both G18 results retain the separately established exact values.
- Eight generator and four backend tests pass. Unit tests cover Boolean identities, signed binary products, unique constraint names and AUG Control response above 100. Browser checks cover actual WASM download, both presets, cancellation/recovery, Operations budget 5,000,000, exact source replay and mobile layout.

[Persistent validation summary and full-budget scores](../data/optimizer_validation/scip_20261116.json). Reproduce focused tests with `node tests/scip_model.mjs`, `node tests/scip_engine.mjs`, the two Python unittest suites and `node tests/scip_browser.cjs`. Broader development evidence is retained under `.scratch/scip-full-replacement/` and `.scratch/scip-release/`.

## Runtime supply

`vendor/scip-7e68f9ca/` includes the pinned loader, WASM, upstream version, provenance and third-party license notices. `python tools/fetch_scip_runtime.py` verifies downloads. The Pages exporter validates loader/WASM/version/notice hashes and copies vendor bytes unchanged into a content-addressed directory. Exported application modules remain release-versioned. Runtime size is approximately 6.4 MB plus loader; data and optional starts load per weapon.
