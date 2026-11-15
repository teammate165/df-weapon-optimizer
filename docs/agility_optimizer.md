# Experimental agility preset

Select **Highest Agility** or supply `"preset": "agility"` to the generator/API.

As of 2026-11-16, agility minimizes one weighted, default-normalized loss:

`loss = 0.50 * handling + 0.30 * hip_spread + 0.20 * recoil`

- Handling: 50 times the sum of build/default ADS and sprint-to-fire duration ratios.
- Hip spread: 100 times build/default idle hip-fire spread. Maximum spread is excluded.
- Recoil: existing legacy ADS-only pattern/camera/kick proxy, default-normalized with internal weights 40/30/30.

Each component is 100 at default. Improvements can compensate for regressions in another component; there are no strict component priorities. Cost breaks equal weighted-loss ties. Public score and improvement_percent equal `100 - loss`; objectives contains only weighted_agility. Returned weights.objectives records 50/30/20. Explicit recoil weight overrides affect only the internal recoil proxy.

Max minimizes weighted loss. Balanced and Min retain at least 50% of Max's weighted improvement and must be physically distinct. Missing alternatives remain unavailable. Budgets, locks, stat floors, legal tuning and mounting remain mandatory. Custom effectiveness targets remain unsupported. Search is best found, without a global guarantee.

This supersedes the previous strict Accuracy ? Handling ? recoil hierarchy and accuracy-only score/category floor.

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

`node tests/agility_optimizer.mjs` checks independent 50/30/20 contributions, cross-component compensation, idle-only spread, handling normalization and resolved profile replacements.

`python -m unittest discover -s tests -p test_recoil_generator.py` includes real
M4A1 generation in Detonation, Operations and Warfare, source-calculator stat/cost
replay and rejection of scalar targets. Browser reproduction:
`.scratch/browser-qa/agility-check.cjs`; report:
`.scratch/browser-qa/agility-report.json`.

## Solution presentation

Use the [shared six-cell preview standard](solution_preview.md): relative score/cost above Control, Handling, Stability and Accuracy effective points. Cells show titles and one number only. The preset-heading information icon explains the weighted relative score; the result Accuracy cell shows raw points without additional information. The overall scalar is weighted improvement using 50/30/20 handling/hip accuracy/recoil.

The recoil preset choices remain Max (strongest), Balanced (value knee), Min (cheapest above the 50% improvement gate). Agility returns all three category slots, with distinct cost/performance alternatives subject to the 50% weighted-improvement floor. It never clones a build into another category; missing alternatives are explicitly unavailable. Historical labels map to the new names without changing saved configurations.
