# Four main stats: DFTTK source effects

Inspected 2026-11-12 against website data version `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`. These are website-model semantics, with no claim of Global/Garena game-engine validation. Companion numerical sweeps should retain the weapon, mode, resolved default loadout and raw base points: a fixed effective main value has different delta from base on different weapons.

## Evidence

- [Runtime common metadata](../data/dfttk/common.json) identifies Control `3`, Handling `5`, Stability `6`, Hip Accuracy `4`; SHA-256 `54297fd795b72bb32d539b9050406b60a9f97f7f40afbaa597d766dc0fc2d215`.
- [Manifest](../data/dfttk/manifest.json), SHA-256 `abdb2e6ebdd3820c22ac84da7165ab100cc7fa6e88728ebc7619e01721073f77`, gives every core/shard resource hash. All 69 payloads under `data/dfttk/packs/build-shared/cores/` were inspected. Example [M4A1 core](../data/dfttk/packs/build-shared/cores/18010000001.json), SHA-256 `40cc575534545525d5af10d61290734f66dc7d74703591357c04d2f587a0b0e4`.
- [FireControl source](https://dfttk.com/static/weaponBuilderV3FireControl-C-hA1uh4.js): symbols `F` (buckets/direct propagation), `I` (physical base values), `L` (curve mappings), `R` (numeric resolution), `j` (single-shot merge); SHA-256 `c2d3edda2a9032b91023d81f6f6c5967ccb4938574f3afb8927b2263cf88d2bc`.
- [Attribute calculator](https://dfttk.com/static/weaponBuilderV3AttributeCalculator-DsSa40Fx.js): `p` (outputs), `m` (ratios), `f` (trajectories), `h` (public API); SHA-256 `a4ef0082b4b18ab9deb0039699f6ffc228f52a8abb1d035e12d323dc18be2b69`. Executable inspection copies: `.scratch/calibration-check/{kernel,attributes,curves}.mjs`.
- [Curve evaluator](https://dfttk.com/static/weaponBuilderV3Curves-xeDUt094.js), SHA-256 `6b93bc42e7c3a6fbec755b1306a946f60260ffc7096ea6b5541e5a84b7e8e7a1`; [calibration source trace](dfttk_calibration_source_trace.md) specifies arithmetic, interpolation, precision and ordering in detail.

## Actual target coverage

All 69 cores have the following same target/mapping topology. Their `weaponOverrides` do not override these four rules; weapon-specific curve families are embedded in `defaults`. Resolve the selected pack's rules rather than assuming a universal default curve.

| Main stat | Curve targets and mapping | Public performance effects |
|---|---|---|
| Control `3` | `GRecoil_H`, `GRecoil_V`, `GGunkickSpring`, `GGunkickRandom`: DeltaMappingThenScale | Automatic and single-shot horizontal/vertical recoil multipliers; ADS and hip trajectory increments; mean random/spring weapon stability |
| Handling `5` | `GAiming_ADSTime`: AbsoluteMapping; `GSprintToFireTime`: DeltaMappingThenScale; `GMovement_ADSSpeed`, `GMovement_SilentWalkSpeed`: DeltaMapping | ADS time; sprint-to-fire time; ADS movement speed. Silent-walk bucket changes but the public attribute calculator does not expose a silent-walk output. |
| Stability `6` | `GBreathScale`, `GBreathTime`, `GBreathRecoil`, `BehitGunSway`, `AimMoveGunSway`, `GRecoil_HShake`, `GRecoil_VShake`: DeltaMappingThenScale | Breath sway/legend; hold-breath duration and held recoil; hit sway; movement stability; mean firing camera shake |
| Hip Accuracy `4` | `GSpread_Hip`, `GSpread_Hip_Continuous`: DeltaMappingThenScale | Standing and maximum hip spread; moving hip-spread legend follows standing spread times the profile runtime scale |

Curve coverage means a target is evaluated, not that every weapon/mode/input changes its public value. Flat curve sections, endpoint clamping, zero physical bases and output quantization can suppress changes.

Control curve families: `recoilControlDefault` 65 weapons; `Variant5` M4A1 `18010000001`; `Variant2` `18010000043`; `Variant4` `18020000011`; `Variant3` `18040000004`. Handling: `handlingDefault` 64; `Variant2` `18010000012` and `18010000016`; `Variant5` `18010000040`; `Variant3` `18020000008`; `Variant4` `18050000005`. Stability: `stabilityDefault` all 69. Hip: `hipFireAccuracyDefault` 68; `Variant2` `18020000012`. Each mapping selects a separate `sol`/`mp`/`bd` curve ID; family equality alone does not establish mode equality.

## Interpretation and invariants

Control changes random/spring kick, whose arithmetic mean is `fireWeaponStabilityRaw`. It does not change the separately named gun-kick axes `GGunKickH/V` times `GGunkickH/V`, nor camera shake targets. Single-shot results combine the general recoil bucket with only the matching single/burst bucket's `Mult_A`; inspect the asymmetric merge before interpreting attachment combinations. Both public trajectory families scale their profile increments with general horizontal/vertical recoil, including for Single-only weapons; the specialized single-shot multipliers are reported separately and do not directly scale these trajectory calls.

Handling main points do not alter tactical/empty reload, holster/draw, walk speed or sprint speed in this model. Those outputs can change through independent attachment effects or profile replacements. ADS movement is walk speed multiplied by `(1 + resolved GMovement_ADSSpeed)`. ADS and sprint-to-fire milliseconds use `floor(fround(seconds)*1000)`, even with precision enabled. Holster/draw names in the UI require caution: `holsterTime` reads `equipSeconds`, and `drawTime` reads `holsterSeconds`.

Stability is the stat with explicit firing camera-shake mappings: public `fireCameraStability = (GRecoil_HShake + GRecoil_VShake)/2`. This mean is a model multiplier, not a measured camera angle or camera rendering simulation. Stability does not directly change ordinary recoil-pattern multipliers or random/spring weapon-kick targets. Its held recoil is a separate `heldRecoilScale * GBreathRecoil` output; the public trajectories do not apply this factor. Hold-breath duration is `(100 / drainPerSecond) / GBreathTime`, and breath range starts from `baseBreathRangeDegrees * GBreathScale`; a direct standing-breath-factor operation wraps that computed value and may supersede it.

Hip points do not change ADS spread, the spread UI factor, or the recoil trajectory in this calculator. Moving hip spread changes indirectly from standing spread. The UI factor is profile `runtimeUiScaleFactor/runtimeScaleFactor`, independent of the main hip points.

## Declared targets without demonstrated output consumers

Main-stat operations are also copied to `directRuleTargets`, except targets that already have a curve mapping. For Control these additional targets are `GGunkick_ADSRecoilH` and `GRecoilRecovery`; for Hip Accuracy it is `GRecoil_Hip`. They acquire numeric buckets, but neither the inspected attribute calculator nor its trajectory implementation reads them. Do not call these effects zero in the actual game, equate `GGunkick_ADSRecoilH` with the differently spelled consumed gun-kick axis targets, or infer a recovery benefit from them. Handling's listed direct targets all already have curves; Stability has no direct targets. `GMovement_SilentWalkSpeed` is likewise retained/resolved but absent from the public calculator output.

Displayed panel points use independent `DisplayAttrValues.ID` buckets and integer rounding; effective points use `WeaponMainAttribute.MainAttrValues.ID`. Changing the latter alone need not change the displayed panel. Raw base points must stay unchanged during numerical probes, because three of the four stats predominantly use delta-from-base curves. Endpoints clamp in the curve evaluator; the numeric bucket does not impose a universal main-point clamp.

For a sustained-fire perceived-recoil score, retain separate pattern, camera and weapon-kick components. Source recovery buckets and breath-hold mechanics do not establish post-firing scoring requirements or measured in-game camera behavior. Controlled Global/Garena tests remain necessary.
