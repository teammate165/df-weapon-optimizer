# DFTTK calibration: deployed source trace

Inspected 2026-11-12. These are verified website source semantics, not Global/Garena game-engine validation. The release associated with the existing research snapshot is `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`. Per-slider catalog ranges, functions and reproducible execution cases are recorded separately by the calibration inventory work; do not substitute a universal slider range for those records.

## Evidence and symbol map

All assets are public under `https://dfttk.com/static/`; the downloaded snapshots are in `.scratch/dfttk-research/`. Minified files have one line, so symbol names and literal anchors are more useful than line numbers.

| Asset | Relevant local symbols | SHA-256 |
|---|---|---|
| [weaponBuilderV3Curves-xeDUt094.js](https://dfttk.com/static/weaponBuilderV3Curves-xeDUt094.js) (local filename has `static_` prefix) | `c` contextual tune definition; `S` normalization (export `t`); `C` UI positions (export `n`); `x` curve evaluation (export `r`); `v` assembly resolver (export `o`) | `6b93bc42e7c3a6fbec755b1306a946f60260ffc7096ea6b5541e5a84b7e8e7a1` |
| [weaponBuilderV3FireControl-C-hA1uh4.js](https://dfttk.com/static/weaponBuilderV3FireControl-C-hA1uh4.js) | `N` collects effects; `k/O/A/j` numeric buckets; `F` direct rules/main attributes; `L` main-attribute curves; `R` complete numeric resolver (export `u`); `b` decimal rounding | `c2d3edda2a9032b91023d81f6f6c5967ccb4938574f3afb8927b2263cf88d2bc` |
| [weaponBuilderV3AttributeCalculator-DsSa40Fx.js](https://dfttk.com/static/weaponBuilderV3AttributeCalculator-DsSa40Fx.js) | `p` detailed stats; `m` baseline ratios; `h` public result (export `t`) | `a4ef0082b4b18ab9deb0039699f6ffc228f52a8abb1d035e12d323dc18be2b69` |
| [weaponBuilderV3Loadout-D0qRtmF-.js](https://dfttk.com/static/weaponBuilderV3Loadout-D0qRtmF-.js) | `r` sanitizes tune map after resolving assembly; `a` sets tune | `e5e17a437a9461eca3e7cde601c10726aba9cfab1c867d2c99467083357f3ca4` |
| [WeaponBuilderV3-Lp448b0-.js](https://dfttk.com/static/WeaponBuilderV3-Lp448b0-.js) | `vn` calibration dialog; `fn/mn` summaries; `gn/Zt/Qt` displayed effects | `c749a4e4dcb7927a3b15668d627db37bafd19713d9873e0e83b6f50d83c968f3` |
| [UniversalSlider-DzsTXNjn.js](https://dfttk.com/static/UniversalSlider-DzsTXNjn.js) | component `n` (export `t`) indexes supplied positions | fetched during this trace |

## Slider contract

Tune values are keyed by exact mounted `slotPath`, then `tuneId`; a global attachment ID alone is insufficient. The resolver considers only tune IDs listed by that mounted part and skips absent values, missing definitions and disabled definitions. An omitted tune contributes no operation. An explicitly supplied default evaluates its functions; equality between omission and default therefore depends on neutral default curve outputs and must be checked against data.

`c(pack,mounted,tuneId)` selects `tune.availability || tune.availabilityByItem[mounted.itemId]`. If present, it selects `contexts[`${socketId}:${hostItemId}`] || default`, replacing `enabled`, `positions`, `notch` and range with the context's `dflt/min/max/step`. It does not merge individual missing context fields with fallback fields. No mode argument is passed: mode differences come from the selected pack and mounted configuration. Missing both context and default would cause property access failure. The explicit `positions` field is carried but is not consumed by position generator `C`.

Normalization `S` coerces minimum/maximum/default with `Number`; default uses `Number(defaultValue)||0`. Disabled returns default immediately. Nonfinite input uses default. Only `sliderType === 'Discrete' && notch > 0` snaps:

```text
x = default + Math.round((input-default)/notch) * notch
result = min(maximum, max(minimum, x))
```

Finite bounds are applied after snapping. JavaScript ties round toward positive infinity, including negative half steps. Continuous sliders clamp but do not snap to `range.step`. UI generator `C` enumerates from minimum using `notch ?? 12.5` for Discrete, otherwise numeric `range.step`, with `round((max-min)/step)+1` positions rounded to six decimals. Invalid ranges/steps yield only default. Disabled yields only default. The actual slider uses integer indices with HTML `step=1` into this array; thus normal UI continuous input is stepped even though programmatic normalization accepts off-step values. Non-divisible ranges could generate an out-of-range final position; normalization clamps it. A value absent from the positions array displays its supplied text but places the thumb at index zero.

Loadout sanitizer `r` resolves assembly first, removes tunes for unmounted slots/unknown part tune IDs and disabled definitions, then normalizes surviving values. It preserves explicit defaults. The calculator itself also normalizes and skips disabled tunes, but callers bypassing sanitizer can retain irrelevant keys in fingerprints.

## Curve evaluation and effect order

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

## Rounding and UI comparisons

No blanket integer rounding or main-attribute clamp is performed during bucket accumulation. Default decimal helper `b(x,digits=3)` uses `Math.round((x+2**-52)*10**digits)/10**digits`, returning zero for nonfinite input. `preservePrecision:true` bypasses many final decimal rounds but not all: main panel points remain Math.round; capacities remain Math.floor; ADS and sprint-to-fire milliseconds remain `floor(fround(seconds)*1000)`; tune velocity remains float32. Public recoil trajectories always round coordinates to five decimals because calculator `p` does not forward precision to trajectory helper `f`, despite that helper supporting it. Hip-spread moving legend consumes previously rounded standing spread unless precision is preserved.

Public recoil multipliers are ratios to the resolved default loadout with empty tuning, rounded to two decimals unless precision is preserved. Gun-kick ratios instead use the weapon kick reference. These are not absolute cross-weapon recoil units.

Calibration dialog `vn` requests `preservePrecision:true`, computes a same-build reference with all displayed sliders explicitly set to contextual defaults, and compares current tuning against that reference. Its per-slider effect reverts only that slider to default while leaving all other sliders at their current values. Nonlinear/shared-target interactions mean these individual deltas need not sum to the total. A slider at default has its effect text forced empty even if explicit default differs from omission.

UI `gn` converts a ratio delta to `delta*100` followed by `%`; this is a difference in the reported multiplier, not a percent change relative to the pre-calibration value. `Zt` converts to 15 significant digits then truncates toward zero at four decimals for calibration display. Hidden below-threshold changes (`1e-9`) and combined vertical/horizontal recoil labels are presentation behavior.

## Boundaries and source quirks

Verified here: deployed source arithmetic, control normalization, ordering, interpolation, display behavior and code paths. Executed representative catalog cases and coverage counts belong in the companion calibration evidence. No website code establishes actual game-engine modifier semantics, camera rendering, region parity, patch parity, hidden precision or whether unsupported Mult_B/Mult_D should matter. These are explicit pending game validation, without preventing completion of source-model documentation.

The tune data also contains `ScopeCameraTuneDistance`, `ScopeZoomTuneRate` and `ParallelBulletAimOffsetCm`. Generic numeric buckets can retain these targets, but a literal search of the attribute calculator, FireControl resolver and builder asset finds no named consumers. Therefore absence of an exposed numeric-stat change does not establish a neutral calibration: scope-camera/zoom/aim-offset rendering is outside the demonstrated output contract. Preserve the raw target/function/curve instead of dropping it or assigning zero gameplay effect.

Implementation hazards to preserve or make explicit: continuous off-step inputs accepted by API; asymmetric tie snapping; explicit defaults versus omitted operations; availability missing-context crash; positions field ignored by UI generator; velocity-only second-stage bucket/float32; unsupported modifiers ignored; single-shot partial bucket merge; curve Initial overwriting prior Initial; precision option leaving timing/panel/trajectory quantization; calibration percentages and conditional per-slider summaries differing from a naive independent percentage interpretation. These are observed behavior, not automatically proven defects in game modeling.
