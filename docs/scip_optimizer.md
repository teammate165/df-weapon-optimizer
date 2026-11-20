# SCIP reference optimizer

Production changed to the [anytime top-K optimizer](anytime_top_k_optimizer.md) on 2026-11-16. The implementation below remains available as `generateSCIP` for reference experiments; the local preview and static Generate action now use the bounded, time-limited path.

The reference entry point `generateSCIP` in `scip_optimizer.mjs` exhaustively screens attachments in two stages, then uses a linear mixed-integer SCIP 10.0.2 model to calibrate only the surviving complete combinations. See the [historical screening contract](exhaustive_staged_screening.md). Its pinned single-threaded WebAssembly runtime remains packaged for reference use.

## Search space and source contract

`scip_mount_model.mjs` models every supported selectable attachment at every recursively available socket. Boolean constraints reproduce source default/forced rules, provider visibility, occupancy, parent dependencies, conflicts, fixed selections, mode eligibility, laser policy, required optics and priced budgets. This Boolean model also defines the legal decision domain for exhaustive screening. The calibration model accepts an internal complete-survivor table: candidate membership prevents mixing individually permitted parts into an unscreened combination. Purchases absent from every survivor are removed before compiling calibration effects.

`scip_stat_model.mjs` encodes source effect ordering, strongest tactical effects, additive main stats, detailed multiplicative effects and each relevant calibration notch. Main-stat response curves use exact finite lookups across their source domain, including above 100; irrelevant scoring controls remain at neutral. Binary products use bounded linear disjunctions. Presets expose a solver plan alongside their existing source scoring functions.

`scip_objective_model.mjs` preserves the current recoil and agility objectives. It models the fixed source chart window, five-decimal source coordinates, fire-timing regimes, horizontal speed tiers and the existing default normalization. Euclidean camera/kick terms use linear supporting cuts with iterative refinement. Returned incumbents are recalculated using the preserved source calculator; chart-rounding discrepancies add conditional cuts. This path contains no nonlinear SCIP constraints and does not invoke the WASM interval-arithmetic path rejected in the earlier [feasibility trial](archive/scip_wasm_feasibility.md).

`data/solver_starts/` supplies optional legal primal starts, including earlier search results. Starts are admitted only when their complete attachment configuration survives both screens; their tuning remains a primal hint. Starts are rescored and revalidated against the actual request; they are neither a candidate table nor an optimality certificate. The old JavaScript attachment optimizer is no longer imported or exported by the production entry point.

The screening implementation now reuses a mounting plan, counts equivalent residual subtrees, skips fixed layers, and applies native source-signature bounds before expensive full scoring. These preserve the exact screening selections; [implementation, fallbacks and benchmarks](optimizer_screening_speed.md).

## Time limits and claims

The UI provides 5, 30 and 120 second calibration budgets. Generate waits without a screening deadline for both exhaustive screens to finish before starting that timer. Counting and ranking each traverse the whole legal domain; no interrupted prefix is labeled an exact gate. Legacy API `passes` maps to a time budget only when `time_limit_seconds` is absent. Cancel terminates the Worker; a fresh Worker handles the next request. Local preview streams progress over NDJSON; disconnecting the request kills its Node subprocess, including during screening or calibration. Direct JSON API clients remain supported.

Max, Handling tie-breaks and price/category phases share the requested calibration budget (split across explicitly requested budget runs). Exhaustive screening time is additional. Different bounded runs can produce different incumbents. Distinct price alternatives can remain unavailable; Warfare has no price alternatives. Outputs retain `best_found` status and source replay data. Diagnostics expose SCIP phase status, primal/dual bounds, model gap, cut counts and elapsed time. Pending refinement cuts invalidate any apparent zero-gap completion. `global_optimality` is deliberately false: this release does not claim every weapon/request has been globally solved. A closed numerical model bound applies only to the retained calibration domain. Default-scored attachment screening can discard the globally best calibrated build, and model accuracy is separate from fidelity to the actual game.

The linear solver uses feasibility tolerance 1e-9; incumbent source-field comparisons use 1e-7. Source rounding uses conservative envelopes and conditional exact-source cuts. Norm refinement also has numerical tolerances. Inspect implementation diagnostics rather than interpreting a successful runtime load as proof.

## Validation before exhaustive screening, 2026-11-16

The results below describe the earlier unrestricted SCIP release. They are historical evidence, not validation or full-cap performance claims for the new screens. Current staged-search validation is recorded in the [screening contract](exhaustive_staged_screening.md).

- All 69 default mount graphs match source resolution.
- All 207 weapon/mode default stat encodings and 20 equipped/calibrated witnesses match source fields.
- Ten equipped chart/objective witnesses match source scores.
- All 138 weapon/preset integration requests return source-valid results without solver errors. These short requests are not 138 optimality proofs.
- Ten 30-second full-budget regressions preserve the prior Standard results, including Operations budget 5,000,000. Eight beat the earlier production baseline; both G18 results retain the separately established exact values.
- Eight generator and four backend tests pass. Unit tests cover Boolean identities, signed binary products, unique constraint names and AUG Control response above 100. Browser checks cover actual WASM download, both presets, cancellation/recovery, Operations budget 5,000,000, exact source replay and mobile layout.

[Persistent validation summary and full-budget scores](../data/optimizer_validation/scip_20261116.json). Reproduce focused tests with `node tests/scip_model.mjs`, `node tests/scip_engine.mjs`, the two Python unittest suites and `node tests/scip_browser.cjs`. Broader development evidence is retained under `.scratch/scip-full-replacement/` and `.scratch-archive/scip-release/`.

## Runtime supply

`vendor/scip-7e68f9ca/` includes the pinned loader, WASM, upstream version, provenance and third-party license notices. `python tools/fetch_scip_runtime.py` verifies downloads. The Pages exporter validates loader/WASM/version/notice hashes and copies vendor bytes unchanged into a content-addressed directory. Exported application modules remain release-versioned. Runtime size is approximately 6.4 MB plus loader; data and optional starts load per weapon.
