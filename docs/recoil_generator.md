# Experimental recoil generator

Run from the repository root with Python 3 and Node.js:

```powershell
python tools/generate_builds.py .scratch/recoil-generator/request.json --output .scratch/recoil-generator/result.json
```

Request example:

```json
{"weapon_id":"18010000001","mode":"detonation","firing":"auto","fixed":[{"slotPath":"1","itemId":"13030000109"}],"passes":4}
```

Canonical names and persistent aliases are in [GLOSSARY.md](../GLOSSARY.md).
The source identifiers remain `bd` for Detonation, `sol` for Operations, and `mp` for Warfare.
Operations accepts one maximum attachment budget, e.g. `"budget":300000`, in its own market currency. Detonation uses the full fixed weapon cap (no page budget input). The default priced-mode outputs are **No compromise**, **Cheapest**, and **Best price/performance**, with no percentage prompts. Warfare returns one unpriced best-found result. Weapon purchase cost is excluded. Existing `effectiveness_targets` requests remain supported for research/custom targets; legacy three-element `budgets` requests keep their independent budget-constrained results.

Example with constraints:

```json
{"weapon_id":"18010000001","mode":"detonation","preset":"recoil","minimum_stats":{"control":40,"handling":60,"stability":50,"accuracy":45},"passes":8}
```

**No compromise** minimizes recoil score, breaking equivalent-score ties by attachment cost. **Cheapest** minimizes cost while retaining at least **50% of the best-found improvement over default**. If default score is 100 and no compromise is 40, the gate is `100 - (100 - 40) * .50 = 70`; every qualifying cheapest result must score at most 70. The gate uses the strongest feasible build encountered across all searches, not the initial search result. A free calibrated build may legitimately qualify. If no positive improvement is found, the two value categories report unavailable/infeasible with a reason rather than claiming an arbitrary effectiveness percentage. The gate measures model improvement, not in-game quality.

**Best price/performance** selects a knee from the feasible cost/score frontier, restricted to the same 50% quality floor. Relative to the cheapest qualifying and no-compromise endpoints, normalize extra cost as `x` and recovered performance as `y`, and maximize `y - x`. Ties prefer smaller squared distance to the ideal corner `(0,1)`, then lower cost. A straight frontier uses that same deterministic tie rule; degenerate endpoints reuse the cheapest qualifying build. Categories may legitimately select the same build. This is a declared product policy, not a universally objective definition of best value or a literal improvement/cost ratio. The UI sorts by achieved effectiveness, highest first.

Calibration, attachment locks, stat floors and mode budgets apply throughout. `minimum_stats` permits only Control, Handling, Stability and Accuracy, with finite nonnegative effective points. Omitted values impose no floor; values above 100 are allowed without a claim they are attainable. Effective points differ from rounded/display-adjusted panel values. Results expose `stats`, the run exposes `baseline_stats` for the unmodified weapon in the same mode, and builder evaluation exposes matching `effective_stats`. The solution overview computes each stat percentage as `100 * (stat / baseline_stat - 1)` (N/A for a zero baseline). A failed search reports infeasible without claiming mathematical impossibility.

For compatibility, explicit `"effectiveness_targets":[60,85,95]` still returns custom categories (up to eight percentages in `(0,100]`; `[]` returns only best performance), with `selection:"custom_targets"`. Page requests use `selection:"automatic"` and `cheapest_gate_percent:50`.

## Data and classification finding

SQLite already contains the full classification inside `dfttk_raw_files.record_json` for `path='catalog/bd-shop.json'`; no dedicated tier column exists. The corresponding local source is `data/dfttk/catalog/bd-shop.json`, snapshot `20261108-an94-bd-shop.1`. Its 69 weapons have `tier`, `price`, and `gunsmithLimit`. Recorded caps: tier 1 = 200; tier 2 = 600; tier 3 = 800; tier 4 = 2,000. The generator reads each weapon's value, rather than deriving it from a hardcoded tier rule. Fixed Detonation item costs come from `partCosts`; hidden items are excluded. Operations quotes come from SQLite `prices` and retain `price_sources` provenance (currently dated 2026-11-11). These are source-model records, unverified against the Global client, and are not current market guarantees.

The cost is the sum of explicitly equipped attachments per mounted occurrence, including user-fixed selections; source-provided defaults/forced components are treated as bundled. Missing quotes exclude candidates from priced results; missing is never zero. A missing fixed quote or over-budget fixed setup returns an infeasible result. Fixed nested parts require their parent selections. Conflicting fixed selections fail explicitly. Mod budgets do not include weapon purchase cost.

## Objective and search limitations

Generator JSON now also includes [timed ADS paths, climb diagnostics and exportable comparison plots](timed_recoil_paths.md), with a `shot_count` request option (default 20). Those metrics are separate from the legacy score used by the search. AN94 consumes its tight opening profile and accelerated source timing; a separate pre-shot aim proxy preserves the distinction between chart recoil and impact interpretation.

The [proposed perceived-recoil definition](perceived_recoil_score.md) now incorporates component-score research and validation in one task. Its climb-speed/camera/sight draft is not implemented here; this generator retains the experimental three-component proxy described below.

This is an experimental within-weapon proxy, pending the existing controlled-test score-validation backlog. Default score is 100. Pattern, firing-camera shake, and random/spring weapon kick are normalized to the mode's default build, weighted 0.3/0.4/0.3. Override with `weights: {"pattern":0.3,"camera":0.4,"kick":0.3}`. Each component uses the Euclidean norm of its two source multipliers. All component values and weights are returned. `firing: "auto"` uses continuous recoil; `"spam"` uses source single/burst modifiers. This does not measure cadence, trajectory irregularity, rendered sight movement, optic magnification, or actual camera displacement. No post-fire recovery term is scored. Do not use these scores to rank different weapons.

Coordinate search re-resolves source sockets, dependencies, coupling, occupancy and mode restrictions, preserving fixed parts. It calibrates the initial build before purchases and screens replacement parts with source-declared endpoints, quartiles and default positions. Accepted incumbents search every declared position for each slider. Calibration has no attachment cost in this source model, so equally effective builds prefer lower cost, including the best-performance category. Replacements discard displaced tuning and validate retained positions against contextual ranges.

Automatic search uses internal improvement targets at 50/60/70/80/90% to explore the frontier from both the calibrated best build and the fixed-only build. These are search probes, not output thresholds for Best price/performance. A shared frontier retains non-dominated feasible candidates from every probe. Final category selection and the 50% gate are reapplied against the strongest candidate discovered. The selector is exact over evaluated candidates; the frontier itself is an approximation from coordinate search.

No global optimality guarantee: coordinated swaps, parent/child changes, intermediate calibration positions during replacement screening, and local minima can hide better builds. `passes` defaults to 8 (maximum 20); the page offers 4 / 8 / 16. Convergence describes coordinate search only. Fixed attachments do not lock calibration. The [workshop](../builder/README.md) applies results with their tuning.

Implementation: [shared engine](../tools/optimizer_engine.mjs) handles mounting, tuning, costs and search; [policy](../tools/optimizer_policy.mjs) validates targets/stat floors and compares feasibility/cost; [presets](../tools/optimizer_presets.mjs) own objective measurement, normalization, weights and score description. Automatic category choice lives in [selection](../tools/optimizer_selection.mjs), independent of the search method. A preset's `create` returns `raw(build,tunes,state)`, `score(components)`, `baseline` and optional `weights`; scores use 100 as the default and lower is better. Add future objectives there and reuse the same constraints/search. [recoil_generator.mjs](../tools/recoil_generator.mjs) remains the compatible CLI/export entry point.

The offline wrapper assembles packs from the preserved manifest and uses extracted source modules in `.scratch/calibration-check`; if absent, run `python tools/verify_calibration_reference.py` to prepare the reference. That preparation fetches versioned source assets. Model calculation and assembly are shared with the existing calibration checks; no new approximation to stat stacking is introduced.

Validation: `python -m unittest discover -s tests -p test_recoil_generator.py`. Covers real M4A1 tier cap, budget feasibility, fixed attachment retention, deterministic replay, custom percentage targets, all four effective stat floors, source-model result replay, impossible/invalid constraints, invalid fixed slot, and cap rejection. Full Global-client validation and validated perceived-recoil weights remain open.

## Solver upgrade assessment

The leading candidate to benchmark is **SCIP global mixed-integer nonlinear optimization**, seeded with the current search's feasible builds. Selection and mounting dependencies become integer constraints; calibration positions retain their legal discrete steps; the actual stacking, stat response curves and weighted norm objective must be faithfully represented as nonlinear or exact piecewise expressions. SCIP supports mixed-integer nonlinear problems and spatial branch-and-cut ([official overview](https://scipopt.org/doc/html/), [global-method paper](https://optimization-online.org/wp-content/uploads/2016/05/5433.pdf)). This makes it a closer initial fit than direct CP-SAT for the current nonlinear floating-point calculator. CP-SAT constraints are integer-based ([official guide](https://developers.google.com/optimization/cp/cp_solver/)); an integer/table approximation would prove only that transformed model unless its equivalence/error bounds were established.

This is an engineering recommendation, not a benchmark result. Validate a solver encoding against source-model calculations and exhaustive small fixtures first. Solve No compromise, then minimize price with the 50% improvement constraint; explore additional constrained solves for the value frontier. Return objective bounds and numerical tolerances. A time limit without a closed gap remains best-found; any proof covers the encoded catalog, mode, calibration grid and dated prices, not game-client accuracy. No solver dependency or global guarantee is added by the category change.
