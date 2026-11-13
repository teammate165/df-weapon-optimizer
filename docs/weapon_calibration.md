# Weapon calibration mechanics

Documentation and executable source-model validation completed on 2026-11-12 using dfttk as the requested source of truth. Data version: `20261108-an94-bd-shop.1`; runtime: `09f820e0d3ada199`. The live manifest was rechecked and still matched this snapshot. Actual game build is unknown; Global/Garena verification remains a separate task.

## Complete slider inventory

The export covers **691 distinct calibration definitions**, attached to **346 item IDs** (345 selectable attachments and one internal component), and **2,858 declared mounting-context records**. Of those context records, 2,823 are enabled and 35 disabled. These are declared contexts, not a claim that every possible combination is a legal mounted build. There are 649 continuous and 42 discrete definitions; context expansion creates many additional discrete records.

- [Every slider/context, spreadsheet-compatible CSV](../data/calibration/controls.csv): original item name/ID, tune ID, context, enabled flag, notch, range, step, default, unit, dimension, target/modifier list and associated weapon IDs.
- [Complete definitions and effect curves](../data/calibration/inventory.json): full raw metadata and each function's curve, including interpolation modes and tangents.
- [Inventory summary](../data/calibration/summary.json).
- SQLite tables `calibration_definitions` and `calibration_controls` expose the same source-backed information. Existing `part_tunes`/`part_tune_functions` remain compatibility tables; their generic ranges do not replace contextual availability.

Examples below are default-context ranges, not universal limits:

| Dimension | Range | Step | Default |
| --- | --- | --- | --- |
| Barrel length | -10 to +10 mm | 0.2 mm | 0 |
| Weight | Commonly -50 to +50 g; some -20 to +20 g | 1 or 0.4 g | 0 |
| Thickness | Commonly -20 to +20 mm; some -50 to +50 mm | 0.4 or 1 mm | 0 |
| Eye-distance adjustment | -20 to +20 mm | 0.4 mm | 0 |
| Zoom adjustment | ±0.25 or ±0.5 | 0.05 | 0 |
| Mounting/cheek-rest/butt-pad position | Context-dependent min/max | Discrete notch | Commonly 50 |
| Trajectory offset | 0 to 30 cm | 1 cm | 0 |

Source unit labels are preserved even when physically unusual. Never infer a range from the dimension name alone.

## Selecting and normalizing controls

Tuning belongs to a mounted **slot path and tune ID**, not just the attachment ID. Resolve the legal build first. Use the definition's availability for the exact socket and host item (`socketId:hostItemId`), falling back to its default context. Disabled controls contribute no calibration operation. Tunes belonging to removed/unmounted parts must be removed as well.

For discrete controls, snap around the contextual default using the notch, then clamp to min/max. JavaScript half ties round toward positive infinity. Continuous programmatic input clamps but does not snap to step; the website's UI enforces stepped input by selecting from a generated positions array. Our optimizer should enumerate those UI-reachable positions for parity, rather than exploit off-step API values.

For each enabled slider/function, evaluate its curve at the normalized slider value. Curves clamp to endpoint outputs outside their domain, use linear interpolation normally, and cubic Hermite interpolation for cubic segments. Preserve tangents and full precision.

## Stacking: base or combined stats?

There is no single universal “percentage of the base weapon” rule. For each ordinary physical target, dfttk accumulates weapon effects, mounted attachment effects, and calibration effects in modifier buckets:

```text
result = (replacement_or_base + sum(Addend))
         * (1 + sum(Mult_A))
         * product(Mult_C)
```

`Initial`/`final` replace the base (last applicable replacement wins). Ordinary percentage calibration shares the `Mult_A` sum with attachment percentages. For example, base 100, additive attachment +20, attachment percentage +10%, and calibration +5% produce `120 × 1.15 = 138`, rather than multiplying the percentages independently.

**Muzzle velocity is an explicit exception:** calibration operations targeting `GBullet_Velocity` are collected in a second bucket and applied after ordinary weapon/attachment velocity effects. Calibration percentages on that target therefore act on the already-combined velocity. Multiple velocity calibration percentages still sum within their second bucket. Source special-attachment velocity multipliers can be applied afterward by the attribute calculator.

Main attribute effects and display-point effects are separate. After accumulating main attribute changes, dfttk evaluates per-weapon/per-mode mappings into physical targets; those mappings then modify the physical-target buckets. A calibration effect targeting physical recoil or gun kick need not change the displayed Control or Stability score.

The inventory's functions use `Mult_A` or `Addend`. The inspected resolver also supports `Mult_C` and replacement modifiers; it ignores unsupported modifier types such as `Mult_B`. This documents website behavior, not an inferred game-engine rule.

## Defaults, comparisons and rounding

The website's calibration dialog compares the **same mounted build** at explicit contextual defaults with the tuned build. Per-slider text resets just that slider while retaining the others; those individual effects need not sum to the total. Every function's contextual default output was tested across this snapshot, and all are neutral. That property was measured from data, not assumed for future releases.

Keep full precision while optimizing, with these parity exceptions:

- Velocity calibration curve output is converted to float32 before stacking.
- ADS and sprint-to-fire milliseconds retain float32-and-integer quantization even with `preservePrecision:true`.
- Panel points remain rounded and magazine/carried counts remain floored.
- Recoil trajectory coordinates retain five-decimal rounding in the inspected public calculator.
- Calibration dialog formatting uses truncation and its own small-change threshold; visible text is not suitable as the optimization input.

Detailed code paths, formulas, availability behavior, curve mapping variants and display quirks are recorded in [the source trace](dfttk_calibration_source_trace.md).

## Executed reference case

Weapon `18010000001` (M4A1), barrel `13020000173` at slot `2`, grip `13030000109` at slot `1`, other resolved defaults unchanged. Below, only the barrel-length slider changes; other calibration values are at default.

| Mode | Length | Muzzle velocity, m/s | ADS, ms |
| --- | ---: | ---: | ---: |
| sol | -10 mm | 617.4349975734949 | 317 |
| sol | 0 | 678.5 | 327 |
| sol | +10 mm | 739.5650024265051 | 337 |
| mp | -10 mm | 545.544997856021 | 299 |
| mp | 0 | 599.5000000000001 | 308 |
| mp | +10 mm | 653.4550021439792 | 317 |
| bd | -10 mm | 570.3424977585674 | 317 |
| bd | 0 | 626.7500000000001 | 327 |
| bd | +10 mm | 683.1575022414328 | 337 |

The length curve at +10 emits `+0.09` for velocity before float32 conversion; the applied value is `0.09000000357627869`. In sol, the resulting velocity is `678.5 × (1 + 0.09000000357627869)`, explaining the retained precision above.

## Validation and reproduction

```powershell
uv run --no-project tools/document_calibration.py
uv run --no-project tools/verify_calibration_reference.py
```

The first command validates cached source hashes and regenerates the complete inventory and its SQLite tables. The second downloads the identified deployed source assets, records SHA-256 hashes, removes the unrelated React UI prefix from the resolver, and executes its unchanged calculation functions under Node.js. No game or browser is involved.

Checks passed: **38,864 assertions**, covering every declared context's default/endpoints and finite curve outputs; default neutrality; analytic modifier stacking; clamping, continuous off-step behavior and discrete tie rounding; linear/cubic interpolation; same-build default-versus-omitted tuning; 12 recorded barrel endpoint comparisons across three modes; multiple sliders/parts together; ordinary shared buckets; separate velocity calibration; unchanged mounted parts.

[Execution results and source hashes](../data/calibration/reference_checks.json) retain the exact build, emitted operations, outputs and scope. Tests are source-model verification, not a complete implementation of the final optimizer or a proof of live-client equivalence.

## Remaining Global-client checks

The documentation/source-model todo is complete. Before treating the model as live Global/Garena truth, record screenshots/tests for the same builds at default and non-default calibration, with game patch, mode, date and item IDs. Compare displayed totals, detailed physical values and slider limits. Hidden effects may require firing recordings rather than screenshots alone. Keep dfttk and game evidence separate, and log disagreements.

Scope-camera distance, zoom and aim-offset functions are present in source data but lack demonstrated consumers in the inspected numeric output. They must not be discarded or assigned zero gameplay effect. Their visual behavior still requires separate investigation. Perceived-recoil scoring remains limited to sustained/spam firing, with no separate post-firing recovery component.
