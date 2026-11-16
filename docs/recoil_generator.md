# Experimental recoil generator

Current local search: [anytime bounded top-K search and source calibration](anytime_top_k_optimizer.md). The total time budget covers ordinary attachments, patches/lasers and tuning. Legal combinations can remain unexplored; outputs are best found. The objective and constraint descriptions below remain applicable; historical percentage-gate and SCIP search descriptions are superseded locally. Legacy `passes` requests map to a total search budget. Published on 2026-11-17 as release `cb0a6cf829d3634f`.

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
Operations accepts one maximum attachment budget, e.g. `"budget":300000`, in its own market currency. Detonation uses the full fixed weapon cap (no page budget input). The default priced-mode outputs are **Max**, **Balanced**, and **Min**, with no percentage prompts. Warfare returns Max and marks Balanced/Min unavailable because price comparisons are unavailable. Weapon purchase cost is excluded. Existing `effectiveness_targets` requests remain supported for research/custom targets; legacy three-element `budgets` requests keep their independent budget-constrained results.

Example with constraints:

```json
{"weapon_id":"18010000001","mode":"detonation","preset":"recoil","minimum_stats":{"control":40,"handling":60,"stability":50,"accuracy":45},"passes":8}
```

**Max** maximizes the displayed recoil improvement score, breaking equivalent-recoil ties by Handling loss, then attachment cost. Public `score` is `100 - loss`, with default 0 and higher better; internal loss remains default 100 and lower better. **Min** minimizes cost while retaining at least **50% of the best-found improvement over default**. If Max improves recoil by 60 points (internal loss 40), Min must retain at least 30 improvement points (internal loss at most 70). The gate uses the strongest feasible build encountered across all searches, not the initial search result. A free calibrated build may legitimately qualify. If no positive improvement is found, the two value categories are unavailable rather than duplicating the best build or claiming an arbitrary effectiveness gate. The gate measures model improvement, not in-game quality.

**Balanced** selects a knee from the feasible cost/score frontier, restricted to the same 50% quality floor. Relative to the cheapest qualifying and Max endpoints, normalize extra cost as `x` and recovered performance as `y`, and maximize `y - x`. Ties prefer smaller squared distance to the ideal corner `(0,1)`, then lower cost. A straight frontier uses that same deterministic tie rule; degenerate endpoints do not invent a distinct Balanced result. Categories must be physically distinct; missing alternatives are marked unavailable instead of duplicated. This is a declared product policy, not a universally objective definition of best value or a literal improvement/cost ratio. The UI displays choices in Max, Balanced, Min order.

Calibration, attachment locks, stat floors and mode budgets apply throughout. `minimum_stats` permits only Control, Handling, Stability and Accuracy, with finite nonnegative effective points. Omitted values impose no floor; values above 100 are allowed without a claim they are attainable. Effective points differ from rounded/display-adjusted panel values. Results expose `stats`, the run exposes `baseline_stats` for the unmodified weapon in the same mode, and builder evaluation exposes matching `effective_stats`. The compact solution overview shows effective points without inline deltas. A failed search reports infeasible without claiming mathematical impossibility.

For compatibility, explicit `"effectiveness_targets":[60,85,95]` still returns custom categories (up to eight percentages in `(0,100]`; `[]` returns only best performance), with `selection:"custom_targets"`. Page requests use `selection:"automatic"` and `cheapest_gate_percent:50`.

## Data and classification finding

SQLite already contains the full classification inside `dfttk_raw_files.record_json` for `path='catalog/bd-shop.json'`; no dedicated tier column exists. The corresponding local source is `data/dfttk/catalog/bd-shop.json`, snapshot `20261108-an94-bd-shop.1`. Its 69 weapons have `tier`, `price`, and `gunsmithLimit`. Recorded caps: tier 1 = 200; tier 2 = 600; tier 3 = 800; tier 4 = 2,000. The generator reads each weapon's value, rather than deriving it from a hardcoded tier rule. Fixed Detonation item costs come from `partCosts`; hidden items are excluded. Operations quotes come from SQLite `prices` and retain `price_sources` provenance (currently dated 2026-11-11). These are source-model records, unverified against the Global client, and are not current market guarantees.

The cost is the sum of explicitly equipped attachments per mounted occurrence, including user-fixed selections; source-provided defaults/forced components are treated as bundled. Missing quotes exclude candidates from priced results; missing is never zero. A missing fixed quote or over-budget fixed setup returns an infeasible result. Fixed nested parts require their parent selections. Conflicting fixed selections fail explicitly. Mod budgets do not include weapon purchase cost.

## Objective and search limitations

Generator JSON now also includes [timed ADS paths, climb diagnostics and exportable comparison plots](timed_recoil_paths.md), with a `shot_count` request option (default 20). Those metrics are separate from the legacy score used by the search. AN94 consumes its tight opening profile and accelerated source timing; a separate pre-shot aim proxy preserves the distinction between chart recoil and impact interpretation.

The [proposed perceived-recoil definition](perceived_recoil_score.md) now incorporates component-score research and validation in one task. Its climb-speed/camera/sight draft is not implemented here; this generator retains the experimental three-component proxy described below.

This is an experimental within-weapon proxy, pending the existing controlled-test score-validation backlog. Default score is 100. Pattern, firing-camera shake, and random/spring weapon kick are normalized to the mode's default build, weighted 0.4/0.3/0.3. Override with `weights: {"pattern":0.4,"camera":0.3,"kick":0.3}`. Each component uses the Euclidean norm of its two source multipliers. All component values and weights are returned. `firing: "auto"` uses continuous recoil; `"spam"` uses source single/burst modifiers. This does not measure cadence, trajectory irregularity, rendered sight movement, optic magnification, or actual camera displacement. No post-fire recovery term is scored. Do not use these scores to rank different weapons.

Every preset now uses [exhaustive two-stage attachment screening](exhaustive_staged_screening.md): rank all legal ordinary attachment combinations at default calibration, retain their best 5%, then rank all legal patch/laser completions per retained base and retain their best 5%. Patches include grip socket 30 and directional sockets 32-35. SCIP optimizes legal calibration positions only for complete surviving configurations. This is shared automatically by current and future presets.

Generate waits until both screens finish; the selected time budget starts at calibration. Complete enumeration makes the default-tuned screens exact within their stated domains; it does not make the calibrated result globally optimal. A build discarded before calibration may calibrate better than a survivor. Returned `attachment_gate` diagnostics contain complete counts, per-base tactical counts and timing. Locks, source defaults, mode restrictions, occupancy, complete optics, quotes and budgets remain enforced. Base-stage floors rank shortfalls without excluding builds that tactical additions can improve; final floors are enforced on tactical completions before ranking.

Automatic search uses internal improvement targets at 50/60/70/80/90% to explore the frontier from both the calibrated best build and the fixed-only build. These are search probes, not output thresholds for Balanced. A shared frontier retains non-dominated feasible candidates from every probe. Final category selection and the 50% gate are reapplied against the strongest candidate discovered. The selector is exact over evaluated candidates; the frontier itself is an approximation from coordinate search.

No global optimality guarantee: default-tuning ranking can discard a better calibrated build; coordinated swaps, parent/child changes, joint or interior calibration effects, and local minima can hide better builds. `passes` defaults to 8 (maximum 20); the page offers 6 / 12 / 20. Convergence describes this gated coordinate search only. Fixed attachments do not lock calibration. The [workshop](../builder/README.md) applies results with their tuning.

Implementation: [shared engine](../tools/optimizer_engine.mjs) handles mounting, tuning, costs and search; [policy](../tools/optimizer_policy.mjs) validates targets/stat floors and compares feasibility/cost; [presets](../tools/optimizer_presets.mjs) own objective measurement, normalization, weights and score description. Automatic category choice lives in [selection](../tools/optimizer_selection.mjs), independent of the search method. A preset's `create` returns `raw(build,tunes,state)`, `score(components)`, `baseline` and optional `weights`; scores use 100 as the default and lower is better. Add future objectives there and reuse the same constraints/search. [recoil_generator.mjs](../tools/recoil_generator.mjs) remains the compatible CLI/export entry point.

The offline wrapper assembles packs from the preserved manifest and uses extracted source modules in `.scratch/calibration-check`; if absent, run `python tools/verify_calibration_reference.py` to prepare the reference. That preparation fetches versioned source assets. Model calculation and assembly are shared with the existing calibration checks; no new approximation to stat stacking is introduced.

Validation: `python -m unittest discover -s tests -p test_recoil_generator.py`. Covers real M4A1 tier cap, budget feasibility, fixed attachment retention, deterministic replay, custom percentage targets, all four effective stat floors, source-model result replay, impossible/invalid constraints, invalid fixed slot, and cap rejection. Full Global-client validation and validated perceived-recoil weights remain open.

## Solver upgrade assessment

The leading candidate to benchmark is **SCIP global mixed-integer nonlinear optimization**, seeded with the current search's feasible builds. Selection and mounting dependencies become integer constraints; calibration positions retain their legal discrete steps; the actual stacking, stat response curves and weighted norm objective must be faithfully represented as nonlinear or exact piecewise expressions. SCIP supports mixed-integer nonlinear problems and spatial branch-and-cut ([official overview](https://scipopt.org/doc/html/), [global-method paper](https://optimization-online.org/wp-content/uploads/2016/05/5433.pdf)). This makes it a closer initial fit than direct CP-SAT for the current nonlinear floating-point calculator. CP-SAT constraints are integer-based ([official guide](https://developers.google.com/optimization/cp/cp_solver/)); an integer/table approximation would prove only that transformed model unless its equivalence/error bounds were established.

This is an engineering recommendation, not a benchmark result. Validate a solver encoding against source-model calculations and exhaustive small fixtures first. Solve Max, then minimize price with the 50% improvement constraint; explore additional constrained solves for the value frontier. Return objective bounds and numerical tolerances. A time limit without a closed gap remains best-found; any proof covers the encoded catalog, mode, calibration grid and dated prices, not game-client accuracy. No solver dependency or global guarantee is added by the category change.

## Strict Lowest Recoil priorities

Lowest Recoil uses the shared lexicographic comparator (Highest Agility now supplies a single 50/30/20 weighted loss):

1. Minimize the existing ADS-only pattern/camera/kick proxy (40/30/30 by default).
2. Among equal recoil results, minimize `50 * (ADS_seconds / default_ADS_seconds + sprint_to_fire_seconds / default_sprint_to_fire_seconds)`.
3. Among equal objective vectors, prefer lower cost.

The two timing ratios use the resolved physical kernel values, including Handling curves, direct effects and legal calibration. This is the same Handling definition used by Highest Agility. No amount of Handling gain can compensate for worse recoil in the performance search. Floating-point equality uses the shared relative 1e-12 tolerance; it is not a gameplay trade-off allowance. Public `score` still reports recoil improvement only, with default 0 and higher better; `objectives` contains lower-is-better recoil and Handling losses. The source-model recoil proxy remains provisional.

Max follows that strict ordering. Min and Balanced retain their explicit price/performance policies and 50% primary-improvement floor; they do not claim to match Max's recoil. Handling is used for equal-recoil comparisons within the search and frontier, not added as a weighted penalty to recoil. Custom effectiveness-target CLI requests remain supported for Lowest Recoil.

Reproduction: `node tests/agility_optimizer.mjs`, `node tests/optimizer_selection.mjs`, and the generator/backend integration suites. Tests prove that faster Handling can win at higher cost when recoil is tied, but cannot offset a real recoil loss. The shared preview uses Control for main attribute 3; detailed recoil metrics retain their own recoil labels.

## Historical horizontal-span pattern update (superseded)

Lowest Recoil uses `pattern = V + H + 1.5 * max(0, H - 1.5)` for supported automatic base builds: H is horizontal span and V is vertical excursion of exactly 20 post-shot ADS source-chart points. The threshold checks each candidate, not the base weapon. Marginal H weight is 1 below 1.5 and 2.5 above it. Normalize the resulting pattern by the default build evaluated with the same formula; preserve 30/40/30 pattern/camera/kick weights, Handling tie-breaking, price policies, locks and user-entered stat floors. This supersedes the multiplier-norm description above for eligible Lowest Recoil runs only. No automatic Handling minimum is introduced.

Protocol eligibility is fixed from the base timed path. Short default magazines, single/burst/spam or unsupported source schedules retain the legacy multiplier score and an explicit limitation. Highest Agility retains its prior recoil tie-breaker. The chart score uses 20 points even if the display graph shot count changes; candidate magazines under 20 represent an abstract profile comparison. Returned components include pattern model/version, H, V, excess, threshold, marginal weight and window size. Source-model comparison only, not a validated perceived-recoil measurement.

## Current horizontal-speed tiers (2026-11-16)

For eligible Lowest Recoil runs, `pattern = V + multiplier(speed) * H`. H is `max(abs(x))` from the pre-fire origin; V is `max(y)-min(y)`. Both use exactly 20 post-shot ADS points. Speed is the candidate build's fastest complete 200 ms net-displacement window, using source firing cadence and exact piecewise-linear breakpoint evaluation: `max_t(abs(x(t+200ms)-x(t))/0.2s)`. P90 is not used.

| Candidate speed (model units/s) | Horizontal multiplier |
| --- | ---: |
| Up to and including 3.0 | 1 |
| Above 3.0, up to and including 4.0 | 4 |
| Above 4.0, up to and including 5.0 | 6 |
| Above 5.0 | 10 |

Apply the multiplier to the whole H term, not just excess over a threshold. Tiers are discrete, so crossing a threshold produces a step in pattern loss. Candidate attachments/calibration and firing-rate effects can change the tier. Normalize against the default pattern computed with the same formula; preserve pattern/camera/kick weights 40/30/30, Handling ties, costs, locks, stat floors and legacy fallback eligibility. Highest Agility keeps its legacy recoil proxy as its 20% component. Source timing starts at the first post-shot point; the first impulse has no assigned duration. Short candidate magazines remain abstract 20-point profile comparisons for eligible base weapons. Returned diagnostics include speed, multiplier, distance, span, vertical excursion and peak-window timestamps.

Implementation: [exact speed helper](../tools/horizontal_speed.mjs), [preset](../tools/optimizer_presets.mjs). Validation: `node tests/horizontal_speed.mjs` and generator integration replay against the independent Python window analysis. This is a source-model heuristic, pending client/perception validation.

## ADS recoil weights (2026-11-16)

Default pattern/camera/weapon-kick weights are **40/30/30**, superseding earlier 30/40/30 defaults in historical records. Loss is `100 * (0.4 * pattern/default_pattern + 0.3 * camera/default_camera + 0.3 * kick/default_kick)`. This shared default also applies to Highest Agility's recoil component. Explicit request weight overrides remain supported.
