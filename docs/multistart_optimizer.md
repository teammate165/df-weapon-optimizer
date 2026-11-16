# Multi-start attachment refinement

Historical release: superseded by the [full-weapon SCIP optimizer](scip_optimizer.md). The previous JavaScript search does not execute on the current production site.

All presets keep the existing top-5% attachment search and its evaluated
price-target frontier, then run a shared refinement stage. Scoring formulas,
weights, prices, locks, budgets, minimum stats and category definitions stay
unchanged. Results remain **best found**, with no global optimality claim.

The [full-budget trial](full_budget_optimality.md) found stronger complete builds
for P90, Vector, SR-25 and M249 in both Detonation and Operations. This release
implements the broader search rather than publishing those fixed weapon builds.

## Search and fallback

`tools/optimizer_exploration.mjs` receives the same source resolver, candidate
evaluator, constraint comparator and optic-completion routine as the baseline.
It starts with the baseline's strongest result and never replaces it with a
worse candidate under the request's feasibility/objective/cost ordering.

Each descent scores all compatible one-slot replacements, without a top-5%
gate. Presets supply optional calibration proposal priorities. These suggest
legal joint control settings using the source curves, and every proposal is
scored by the actual preset. The better default or proposed tuning is retained.
Future presets without hints receive joint minimum/maximum-position proposals.
The final incumbent receives a full legal-position coordinate calibration sweep,
including interior positions. None of these proposals is treated as a proof or
allowed to overwrite a better baseline.

Separate descents start from default/locked equipment, up to
`max(2, floor(passes / 2))` structural alternatives that expose child sockets,
and `2 * passes` deterministic multi-slot perturbations. Structural changes
cannot remove a locked descendant. Perturbations use seed 20261116 per request;
all intermediate selections go through mounting, optic completion, quote,
hidden-item, enabled-laser and budget checks. Descents stop when no better
neighbor is found or after the requested number of passes.

Candidates still missing a stat floor may be explored under the existing
shortfall comparator, but only feasible candidates enter the final frontier.
All original candidates remain available unless dominated. Max/Balanced/Min
are selected from the expanded frontier with the existing distinctness,
50%-improvement floor and value-knee policy. A stronger Max can tighten the
relative improvement requirement for the cheaper categories; this is the same
category definition, not a price guarantee against the previous Min.

The top-5% stage's counters remain under `attachment_gate`. New `exploration`
diagnostics report evaluated candidates, configurations, passes, structural
starts and restarts. `global_optimality` remains false. Current and future
presets share the refinement without engine-specific preset branches.

## Runtime and cancellation

Resolver, objective and proposal caches are bounded to 2,048 / 20,000 / 2,048
entries respectively. Eviction changes reuse, not the candidate arithmetic.
The browser export includes the new module in the versioned worker graph.

Both baseline and refinement run in the existing static module Web Worker.
The page shows elapsed search time and exposes **Cancel search**. An
AbortSignal terminates the worker, rejects its pending tasks, then creates a
fresh worker for subsequent calculation or optimization. The UI restores its
controls and does not apply a partially searched build. The local backend also
aborts the HTTP request; its existing subprocess timeout still bounds server
work. The model itself is unchanged by cancellation.

Quick/Standard/Thorough continue to request 6/12/20 passes. Larger requests also
explore more starting builds, so they can take substantially longer. On this
Windows desktop, the initial Standard P90 Detonation check took roughly 35–40
seconds; the real six-pass browser flow took about 23 seconds. These are single
observations, not promises for mobile hardware.

## Validation and evidence

- `node tests/optimizer_exploration.mjs`: coordinated-swap local minimum,
  structural starts, locks/floors, interior tuning and deterministic repetition.
- `node tests/top5_engine.mjs`: retained baseline gate, source replay and shared
  refinement for both presets and a dynamically registered future preset.
- Existing generator/builder integration, category, laser, bipod and required
  optic tests validate all modes, price caps, missing quotes and result replay.
- `node tests/multistart_browser.cjs`: real UI cancellation/regeneration,
  AbortSignal worker recovery, both presets, exact stat/cost replay, responsive
  layout and no backend calls or page errors.
- Existing GitHub Pages and static browser suites cover stale dependency cache
  bypass, calculator parity, actual Generate/Apply, saved builds and reload.

`.scratch/multistart-release/regression.json` compares Standard searches for the
same ten full-budget cases with the frozen production baseline and offline
challenger. Every result must replay stats/costs, budgets, optic/laser policies,
category distinctness and cheaper-category improvement floors. The integrated
search can still miss an offline witness; this is not exhaustive enumeration.
`catalog-report.json` checks all 69 weapons with both presets and compares Max
scores to the previously published one-pass baseline.

The completed Standard regression improves all eight previously non-optimal
production cases and preserves both exact G18 results. Vector Operations also
beats its offline witness; SR-25 improves on production but still misses the
best offline witness. Standard run times for the ten cases range from 2 to 64
seconds. All 138 catalog runs pass, with no Max-score regressions against the
published one-pass baseline. Eight generator and four builder integration tests,
three shared-engine preset checks, the exploration regression and special-effect
and category suites pass. Local static/Pages browser checks pass for calculator
parity, both presets, cancellation/recovery, Generate/Apply/save/reload, layout
and cache versioning. Release/deployment evidence is recorded in TODO.md and
[the deployment history](github_pages.md).
