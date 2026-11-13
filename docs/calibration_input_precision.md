# Calibration precision and optimization

Investigated 2026-11-13 against dfttk snapshot `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`. Actual Global/Garena input precision is **not verified**. The seven user codes contain no accompanying slider measurements and no same-build single-slider pair, so they cannot establish precision or rounding.

## What the source accepts

The source distinguishes **UI-reachable steps** from **programmatic normalization**. A slider called `Continue` still moves through a finite array in the website UI. Its normalizer clamps finite input but does not quantize to the declared step. `Discrete` normalizes around the contextual default with a notch, then clamps. This is executable website behavior, not evidence that the game server accepts off-step input. Source symbols, URLs and SHA-256 hashes are in [the calibration trace](dfttk_calibration_source_trace.md).

A probe against the preserved source uses a continuous range -10 to 10 with step 0.2: the source generates 101 UI positions, excludes 0.1, but programmatic normalization preserves 0.1. A discrete range 0 to 100 with default 50 and notch 25 snaps 53.1 to 50. [Probe output](../.scratch/gun-codes/precision_probe.json). The builder/optimizer deliberately restricts inputs to declared UI positions until game evidence establishes something broader.

## Declared steps

Reproduce: `python tools/audit_calibration_steps.py`. [Machine-readable audit](../data/calibration/step_audit.json), based on the hash-recorded [full source inventory](../data/calibration/controls.csv). Of 2,858 declared contexts, 2,823 are enabled. These counts include different mounting contexts for the same slider; they are not independent sliders on one weapon.

| Source slider type | Effective step | Enabled contexts |
| --- | --- | --- |
| Continue | 0.05 | 44 |
| Continue | 0.2 | 158 |
| Continue | 0.4 | 125 |
| Continue | 1 | 322 |
| Discrete | 5 / 6 / 7 / 8 / 10 | 98 / 100 / 102 / 84 / 152 |
| Discrete | 12 / 16 / 20 / 25 / 50 | 524 / 357 / 1 / 698 / 58 |

Units and ranges depend on attachment and host socket. Typical source examples: barrel length 0.2 mm, weight 0.4 or 1 g, thickness/eye distance 0.4 or 1 mm, zoom 0.05. Read each actual contextual definition rather than applying a universal step. The generator produces 3 to 101 positions per enabled context; 604 contexts have 101 positions. Counts follow the source UI's rounded range-width formula, including its documented non-divisible-range edge cases.

## Can a share code bypass those steps?

No supported method has been established. The observed 21-character game suffix can be represented as a timestamp-like field, a zero byte and an opaque field; no attachment/calibration payload was recovered. Its metadata representation is insufficient to edit a slider setting or publish a changed build. The inspected official recipe exports contain attachment trees but no calibration fields. See [share-code research](weapon_import_codes.md), which distinguishes observations from the unverified server/account-field interpretation.

Do not claim that changing token characters writes decimals into tuning. Even a hypothetical client request carrying decimals could be rejected or normalized by the server; numeric transport and accepted gameplay values are separate questions.

## Effect on optimization

If the game is limited to fixed steps, each slider becomes a bounded discrete choice. We can search the correct finite domain and potentially prove an optimum with an exact formulation; we cannot treat arbitrary floating-point slider positions as playable builds. Multiple sliders and compatible attachments still create a large combinatorial search space, so finite steps do not make brute force practical.

SCIP can represent slider choices as bounded integer indices or discrete tables alongside mounting rules and nonlinear stat formulas. A piecewise-linear approximation proves only its approximation unless equivalence or explicit error bounds are established. Search-space reduction can remove provably dominated slider positions or attachment choices, but only when every scored effect, stat floor and mounting dependency is preserved. Endpoints alone are insufficient in general: intermediate settings can satisfy a handling floor while retaining recoil benefits, and source curves can be nonlinear.

Continuous relaxations can help derive bounds and guide search. Their fractional solution must be mapped back to legal steps and re-evaluated; rounding alone neither guarantees feasibility nor preserves global optimality. The current coordinate search checks legal source positions, with coarse screening for replacements, so its results remain best-found.

## Game test still needed

Record client region, platform, patch, mode and date. For one fixed weapon/build, export code A at default calibration and code B after changing exactly one slider by one visible increment. Re-import both and record reopened slider values and detailed stats. Measure the min, max and adjacent slider values. To establish off-step acceptance, a verified build publication/import mechanism must first carry a known intermediate value; then re-import/reopen and compare whether the value is preserved, snapped, clamped or rejected. A different code string alone is not proof of different accepted calibration.
