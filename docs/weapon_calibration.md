# Weapon calibration mechanics

Topic sections: [Overview](#weapon-calibration-mechanics) ? [Calibration precision and optimization](#calibration-input-precision) ? [DFTTK calibration: deployed source trace](#dfttk-calibration-source-trace)

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

Detailed code paths, formulas, availability behavior, curve mapping variants and display quirks are recorded in [the source trace](weapon_calibration.md#dfttk-calibration-source-trace).

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

<a id="calibration-input-precision"></a>
<a id="calibration-input-precision--calibration-precision-and-optimization"></a>
## Calibration precision and optimization

Investigated 2026-11-13 against dfttk snapshot `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`. Actual Global/Garena input precision is **not verified**. The seven user codes contain no accompanying slider measurements and no same-build single-slider pair, so they cannot establish precision or rounding.

<a id="calibration-input-precision--what-the-source-accepts"></a>
### What the source accepts

The source distinguishes **UI-reachable steps** from **programmatic normalization**. A slider called `Continue` still moves through a finite array in the website UI. Its normalizer clamps finite input but does not quantize to the declared step. `Discrete` normalizes around the contextual default with a notch, then clamps. This is executable website behavior, not evidence that the game server accepts off-step input. Source symbols, URLs and SHA-256 hashes are in [the calibration trace](weapon_calibration.md#dfttk-calibration-source-trace).

A probe against the preserved source uses a continuous range -10 to 10 with step 0.2: the source generates 101 UI positions, excludes 0.1, but programmatic normalization preserves 0.1. A discrete range 0 to 100 with default 50 and notch 25 snaps 53.1 to 50. [Probe output](../.scratch/gun-codes/precision_probe.json). The builder/optimizer deliberately restricts inputs to declared UI positions until game evidence establishes something broader.

<a id="calibration-input-precision--declared-steps"></a>
### Declared steps

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

<a id="calibration-input-precision--can-a-share-code-bypass-those-steps"></a>
### Can a share code bypass those steps?

No supported method has been established. The observed 21-character game suffix can be represented as a timestamp-like field, a zero byte and an opaque field; no attachment/calibration payload was recovered. Its metadata representation is insufficient to edit a slider setting or publish a changed build. The inspected official recipe exports contain attachment trees but no calibration fields. See [share-code research](weapon_import_codes.md), which distinguishes observations from the unverified server/account-field interpretation.

Do not claim that changing token characters writes decimals into tuning. Even a hypothetical client request carrying decimals could be rejected or normalized by the server; numeric transport and accepted gameplay values are separate questions.

<a id="calibration-input-precision--effect-on-optimization"></a>
### Effect on optimization

If the game is limited to fixed steps, each slider becomes a bounded discrete choice. We can search the correct finite domain and potentially prove an optimum with an exact formulation; we cannot treat arbitrary floating-point slider positions as playable builds. Multiple sliders and compatible attachments still create a large combinatorial search space, so finite steps do not make brute force practical.

SCIP can represent slider choices as bounded integer indices or discrete tables alongside mounting rules and nonlinear stat formulas. A piecewise-linear approximation proves only its approximation unless equivalence or explicit error bounds are established. Search-space reduction can remove provably dominated slider positions or attachment choices, but only when every scored effect, stat floor and mounting dependency is preserved. Endpoints alone are insufficient in general: intermediate settings can satisfy a handling floor while retaining recoil benefits, and source curves can be nonlinear.

Continuous relaxations can help derive bounds and guide search. Their fractional solution must be mapped back to legal steps and re-evaluated; rounding alone neither guarantees feasibility nor preserves global optimality. The current coordinate search checks legal source positions, with coarse screening for replacements, so its results remain best-found.

<a id="calibration-input-precision--game-test-still-needed"></a>
### Game test still needed

Record client region, platform, patch, mode and date. For one fixed weapon/build, export code A at default calibration and code B after changing exactly one slider by one visible increment. Re-import both and record reopened slider values and detailed stats. Measure the min, max and adjacent slider values. To establish off-step acceptance, a verified build publication/import mechanism must first carry a known intermediate value; then re-import/reopen and compare whether the value is preserved, snapped, clamped or rejected. A different code string alone is not proof of different accepted calibration.

<a id="dfttk-calibration-source-trace"></a>
<a id="dfttk-calibration-source-trace--dfttk-calibration-deployed-source-trace"></a>
## DFTTK calibration: deployed source trace

Inspected 2026-11-12. These are verified website source semantics, not Global/Garena game-engine validation. The release associated with the existing research snapshot is `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`. Per-slider catalog ranges, functions and reproducible execution cases are recorded separately by the calibration inventory work; do not substitute a universal slider range for those records.

<a id="dfttk-calibration-source-trace--evidence-and-symbol-map"></a>
### Evidence and symbol map

All assets are public under `https://dfttk.com/static/`; the downloaded snapshots are in `.scratch/dfttk-research/`. Minified files have one line, so symbol names and literal anchors are more useful than line numbers.

| Asset | Relevant local symbols | SHA-256 |
|---|---|---|
| [weaponBuilderV3Curves-xeDUt094.js](https://dfttk.com/static/weaponBuilderV3Curves-xeDUt094.js) (local filename has `static_` prefix) | `c` contextual tune definition; `S` normalization (export `t`); `C` UI positions (export `n`); `x` curve evaluation (export `r`); `v` assembly resolver (export `o`) | `6b93bc42e7c3a6fbec755b1306a946f60260ffc7096ea6b5541e5a84b7e8e7a1` |
| [weaponBuilderV3FireControl-C-hA1uh4.js](https://dfttk.com/static/weaponBuilderV3FireControl-C-hA1uh4.js) | `N` collects effects; `k/O/A/j` numeric buckets; `F` direct rules/main attributes; `L` main-attribute curves; `R` complete numeric resolver (export `u`); `b` decimal rounding | `c2d3edda2a9032b91023d81f6f6c5967ccb4938574f3afb8927b2263cf88d2bc` |
| [weaponBuilderV3AttributeCalculator-DsSa40Fx.js](https://dfttk.com/static/weaponBuilderV3AttributeCalculator-DsSa40Fx.js) | `p` detailed stats; `m` baseline ratios; `h` public result (export `t`) | `a4ef0082b4b18ab9deb0039699f6ffc228f52a8abb1d035e12d323dc18be2b69` |
| [weaponBuilderV3Loadout-D0qRtmF-.js](https://dfttk.com/static/weaponBuilderV3Loadout-D0qRtmF-.js) | `r` sanitizes tune map after resolving assembly; `a` sets tune | `e5e17a437a9461eca3e7cde601c10726aba9cfab1c867d2c99467083357f3ca4` |
| [WeaponBuilderV3-Lp448b0-.js](https://dfttk.com/static/WeaponBuilderV3-Lp448b0-.js) | `vn` calibration dialog; `fn/mn` summaries; `gn/Zt/Qt` displayed effects | `c749a4e4dcb7927a3b15668d627db37bafd19713d9873e0e83b6f50d83c968f3` |
| [UniversalSlider-DzsTXNjn.js](https://dfttk.com/static/UniversalSlider-DzsTXNjn.js) | component `n` (export `t`) indexes supplied positions | fetched during this trace |

<a id="dfttk-calibration-source-trace--slider-contract"></a>
### Slider contract

Tune values are keyed by exact mounted `slotPath`, then `tuneId`; a global attachment ID alone is insufficient. The resolver considers only tune IDs listed by that mounted part and skips absent values, missing definitions and disabled definitions. An omitted tune contributes no operation. An explicitly supplied default evaluates its functions; equality between omission and default therefore depends on neutral default curve outputs and must be checked against data.

`c(pack,mounted,tuneId)` selects `tune.availability || tune.availabilityByItem[mounted.itemId]`. If present, it selects `contexts[`${socketId}:${hostItemId}`] || default`, replacing `enabled`, `positions`, `notch` and range with the context's `dflt/min/max/step`. It does not merge individual missing context fields with fallback fields. No mode argument is passed: mode differences come from the selected pack and mounted configuration. Missing both context and default would cause property access failure. The explicit `positions` field is carried but is not consumed by position generator `C`.

Normalization `S` coerces minimum/maximum/default with `Number`; default uses `Number(defaultValue)||0`. Disabled returns default immediately. Nonfinite input uses default. Only `sliderType === 'Discrete' && notch > 0` snaps:

```text
x = default + Math.round((input-default)/notch) * notch
result = min(maximum, max(minimum, x))
```

Finite bounds are applied after snapping. JavaScript ties round toward positive infinity, including negative half steps. Continuous sliders clamp but do not snap to `range.step`. UI generator `C` enumerates from minimum using `notch ?? 12.5` for Discrete, otherwise numeric `range.step`, with `round((max-min)/step)+1` positions rounded to six decimals. Invalid ranges/steps yield only default. Disabled yields only default. The actual slider uses integer indices with HTML `step=1` into this array; thus normal UI continuous input is stepped even though programmatic normalization accepts off-step values. Non-divisible ranges could generate an out-of-range final position; normalization clamps it. A value absent from the positions array displays its supplied text but places the thumb at index zero.

Loadout sanitizer `r` resolves assembly first, removes tunes for unmounted slots/unknown part tune IDs and disabled definitions, then normalizes surviving values. It preserves explicit defaults. The calculator itself also normalizes and skips disabled tunes, but callers bypassing sanitizer can retain irrelevant keys in fingerprints.

<a id="dfttk-calibration-source-trace--curve-evaluation-and-effect-order"></a>
### Curve evaluation and effect order

Each tune function provides `target`, `modifier`, `curveId`. `N` evaluates `x(pack.curves[curveId], normalizedSliderValue)` and emits `StaticAttributeModify` with scope `NONE`, `sourceItemId`, `sourceTuneId`. Missing/nonfinite curve output is omitted. Velocity tune output is converted to float32 with `Math.fround` before emission.

Curve `x` sorts points by input, clamps to endpoint outputs, linearly interpolates unless the segment's left point is `RCIM_Cubic`, then uses cubic Hermite interpolation with left leave/right arrive tangents multiplied by segment width. No monotonicity or output clipping is imposed. Empty curve or nonfinite input returns null.

The numeric resolver collects weapon operations, two explicit stock-reference corrections for weapon IDs `18040000002` and `18040000004`, then each mounted part's operations followed by that part's tune operations. Optional ammo is last; the public attribute calculator disables ammo inclusion. Tactical operations are filtered according to the tactical toggle and recognition of the paired hip/handling tactical attributes. Tune operations themselves have scope `NONE`.

For each target the bucket starts `{initial:undefined, addend:0, multA:0, multC:1}`:

```text
Initial or final: replace initial (last wins)
Addend:         addend += value
Mult_A:         multA += value
Mult_C:         multC *= value
evaluate(base) = ((initial ?? base) + addend) * (1 + multA) * multC
```

Only finite numeric values participate. `Mult_B`, `Mult_D` and any unknown modifier are silently ignored; their meaning in the game cannot be inferred from this implementation. `StaticAttributeReplace` is admitted to numeric processing but still requires a recognized modifier, while profile-reference replacement is processed independently.

Ordinary calibration percentages and attachment percentages share `Mult_A`: they add before multiplication. With base 100, attachment Addend 20 and Mult_A 0.10, tune Mult_A 0.05 yields `120*1.15=138`; it does not yield `120*1.10*1.05=138.6`. Initial replacement and additive contributions likewise precede that common percentage factor. Mult_C effects multiply each other and the resulting whole expression.

**Velocity exception:** `R` splits operations having both `sourceTuneId` and target `GBullet_Velocity` into a separate bucket. Ordinary attachment/weapon effects are evaluated first, and the velocity calibration bucket uses their result as its base. Thus velocity tune Mult_A applies to combined weapon/attachment velocity sequentially. Legacy special-attachment velocity multipliers are then applied in attribute calculator `p`. This is a source-specific exception, not a general rule for calibration.

`F` propagates operations targeting `WeaponMainAttribute.MainAttrValues.ID` to that attribute rule's `directRuleTargets`, except targets already listed in `curveMappings`. It computes effective main attributes and independent display attributes. Then `L` evaluates main-attribute curve mappings; mapped operations join the same physical-target buckets. Therefore tune changes to main attributes enter curves together with attachment changes. A physical-target tune is not automatically a change to Control/Stability display points.

Let `c` be combined main attribute, `b` weapon base main attribute, `d=c-b`, and `f` the mode-specific curve:

| Mapping | Inserted physical-target operation |
|---|---|
| AbsoluteMapping | Initial `f(c)` |
| AbsoluteMappingThenScale | Initial `f(c) * (basePhysical/f(b))`; factor defaults to 1 if `f(b)` is falsy |
| DeltaMapping | Addend `f(d+offset0)` |
| DeltaMappingThenScale | Mult_C `f(d+offset1)` |

For independent curves offsets are zero. Otherwise offset0 is a curve knot whose output is within `1e-9` of zero, nearest input zero; offset1 similarly selects output one. Missing match gives zero. Curve Initial is inserted after direct effects, so it can overwrite their Initial. Multiple mappings targeting the same target accumulate or overwrite according to the same bucket rules.

Single-shot recoil helper `j` combines general recoil bucket with only the matching `GRecoil_H/V_singleorburst` bucket's Mult_A. It ignores that secondary bucket's Initial, Addend and Mult_C. This asymmetry should be retained in source replication and flagged for game verification.

<a id="dfttk-calibration-source-trace--rounding-and-ui-comparisons"></a>
### Rounding and UI comparisons

No blanket integer rounding or main-attribute clamp is performed during bucket accumulation. Default decimal helper `b(x,digits=3)` uses `Math.round((x+2**-52)*10**digits)/10**digits`, returning zero for nonfinite input. `preservePrecision:true` bypasses many final decimal rounds but not all: main panel points remain Math.round; capacities remain Math.floor; ADS and sprint-to-fire milliseconds remain `floor(fround(seconds)*1000)`; tune velocity remains float32. Public recoil trajectories always round coordinates to five decimals because calculator `p` does not forward precision to trajectory helper `f`, despite that helper supporting it. Hip-spread moving legend consumes previously rounded standing spread unless precision is preserved.

Public recoil multipliers are ratios to the resolved default loadout with empty tuning, rounded to two decimals unless precision is preserved. Gun-kick ratios instead use the weapon kick reference. These are not absolute cross-weapon recoil units.

Calibration dialog `vn` requests `preservePrecision:true`, computes a same-build reference with all displayed sliders explicitly set to contextual defaults, and compares current tuning against that reference. Its per-slider effect reverts only that slider to default while leaving all other sliders at their current values. Nonlinear/shared-target interactions mean these individual deltas need not sum to the total. A slider at default has its effect text forced empty even if explicit default differs from omission.

UI `gn` converts a ratio delta to `delta*100` followed by `%`; this is a difference in the reported multiplier, not a percent change relative to the pre-calibration value. `Zt` converts to 15 significant digits then truncates toward zero at four decimals for calibration display. Hidden below-threshold changes (`1e-9`) and combined vertical/horizontal recoil labels are presentation behavior.

<a id="dfttk-calibration-source-trace--boundaries-and-source-quirks"></a>
### Boundaries and source quirks

Verified here: deployed source arithmetic, control normalization, ordering, interpolation, display behavior and code paths. Executed representative catalog cases and coverage counts belong in the companion calibration evidence. No website code establishes actual game-engine modifier semantics, camera rendering, region parity, patch parity, hidden precision or whether unsupported Mult_B/Mult_D should matter. These are explicit pending game validation, without preventing completion of source-model documentation.

The tune data also contains `ScopeCameraTuneDistance`, `ScopeZoomTuneRate` and `ParallelBulletAimOffsetCm`. Generic numeric buckets can retain these targets, but a literal search of the attribute calculator, FireControl resolver and builder asset finds no named consumers. Therefore absence of an exposed numeric-stat change does not establish a neutral calibration: scope-camera/zoom/aim-offset rendering is outside the demonstrated output contract. Preserve the raw target/function/curve instead of dropping it or assigning zero gameplay effect.

Implementation hazards to preserve or make explicit: continuous off-step inputs accepted by API; asymmetric tie snapping; explicit defaults versus omitted operations; availability missing-context crash; positions field ignored by UI generator; velocity-only second-stage bucket/float32; unsupported modifiers ignored; single-shot partial bucket merge; curve Initial overwriting prior Initial; precision option leaving timing/panel/trajectory quantization; calibration percentages and conditional per-slider summaries differing from a naive independent percentage interpretation. These are observed behavior, not automatically proven defects in game modeling.
