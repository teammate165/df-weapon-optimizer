# Experimental agility preset

Select **Agility: accuracy → handling → recoil** in the optimizer, or supply
`"preset": "agility"` to `tools/generate_builds.py` / the optimize API.
The existing recoil preset remains the default.

The shared coordinate search compares these lower-is-better objectives in order:

1. Accuracy: idle hip-fire spread, normalized to the weapon/mode's default build (100). Maximum spread is excluded by user decision.
2. Handling: the equal-weight average of default-normalized ADS and sprint-to-fire durations (100 at default).
3. The existing recoil preset's provisional ADS-only pattern/camera/kick score (default weights 30/40/30), not a validated perceived recoil measure. Hip-fire spread belongs exclusively to Accuracy; hip recoil profiles and hip trajectories do not enter this tie-breaker.

Comparison is strictly lexicographic. A higher-priority loss cannot be offset
by a lower-priority gain. Equality uses a relative floating-point tolerance of
`1e-12 × max(1, |a|, |b|)`; this is not a gameplay compromise allowance.
Cost breaks ties after all three objectives. Constraints, fixed attachments,
mode prices/caps and legal calibration positions use the shared engine.
Results are best found, not globally proven optimal.

Automatic output includes Max, Balanced and Min category slots. Max follows strict priorities. Balanced and Min use the shared 50% primary-improvement floor to find lower-cost, physically distinct builds. If there is no distinct eligible alternative, that slot is unavailable instead of cloned. Custom effectiveness-target requests remain unsupported for agility.
The scalar `score` equals `improvement_percent`: percent reduction in idle spread from default (default 0; higher is better). `loss` retains the lower-is-better primary objective (default 100);
`objectives` supplies accuracy, handling and recoil losses in priority order.

## Source coverage and assumptions

Source snapshot: dfttk `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`.
For example, M4A1 is weapon ID `18010000001`. Computation follows the preserved
`.scratch/calibration-check/attributes.mjs` and `kernel.mjs` contracts:

- Standing spread: resolved `GSpread_Hip`, falling back to the resolved hip spread profile's `baseSpreadDegrees.horizontal`.
- Moving spread is proportional to idle (1.25 in all inspected weapon/mode/profile contexts), so the former 60/30/10 moving/jumping/standing score ranked builds identically after normalization. Those redundant score components are removed. Jumping is not represented as a separately measured statistic; see [class audit](spread_ratios_by_class.md).
- ADS: unrounded `GAiming_ADSTime`, falling back to the resolved aiming profile's `adsOnTimeSeconds`.
- Sprint-to-fire: unrounded `GSprintToFireTime`, falling back to the weapon's `timings.sprintToFireSeconds`.

Per user clarification, ordinary ADS time also ranks airborne ADS under the
assumption that airborne ADS scales by a build-independent multiplier. This
preserves relative ADS ranking without inventing an airborne duration. That
assumption remains unverified against Global/Garena. Handling includes both
panel-stat curves and direct attachment/calibration effects through the kernel.
Equal handling weights are an explicit provisional implementation choice.

Range-aware hit probability/accuracy sufficiency remains pending: effective
range alone does not establish a useful spread threshold without target geometry
and spread distribution. This version minimizes angular spread without claiming
measured hit probabilities or reliable hip fire within effective range.
If a default denominator is zero, that component uses its absolute value rather
than dividing by zero; default = 100 applies to positive baselines.

## Validation

`node tests/agility_optimizer.mjs` checks priority preservation despite arbitrarily
large secondary gains, numerical comparison, cost ties, idle-only spread,
handling normalization and resolved profile replacements.

`python -m unittest discover -s tests -p test_recoil_generator.py` includes real
M4A1 generation in Detonation, Operations and Warfare, source-calculator stat/cost
replay and rejection of scalar targets. Browser reproduction:
`.scratch/browser-qa/agility-check.cjs`; report:
`.scratch/browser-qa/agility-report.json`.

## Solution presentation

Use the [shared six-cell preview standard](solution_preview.md): relative score/cost above Control, Handling, Stability and Accuracy effective points. Cells show titles and one number only. The preset-heading information icon explains the idle-spread relative score; the result Accuracy cell shows raw points without additional information. The overall scalar is Accuracy improvement, not a weighted combination of lexicographic priorities.

The recoil preset choices remain Max (strongest), Balanced (value knee), Min (cheapest above the 50% improvement gate). Agility returns all three category slots, with distinct cost/performance alternatives subject to the 50% accuracy-improvement floor. It never clones a build into another category; missing alternatives are explicitly unavailable. Historical labels map to the new names without changing saved configurations.
