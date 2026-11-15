# Four main stats: DFTTK source effects

Topic sections: [Overview](#four-main-stats-dfttk-source-effects) ? [Detailed stats and independent adjustment in the dfttk model](#detailed-stat-independence) ? [Effective stat points above 100](#stat-points-above-100)

For actual attachment/calibration routes that adjust detailed metrics independently of main points, see the [detailed-stat independence audit](dfttk_stat_effects_source.md#detailed-stat-independence), including concrete part IDs, paired effects, mode/scope restrictions and executable output checks.

Inspected 2026-11-12 against website data version `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`. These are website-model semantics, with no claim of Global/Garena game-engine validation. Companion numerical sweeps should retain the weapon, mode, resolved default loadout and raw base points: a fixed effective main value has different delta from base on different weapons.

## Evidence

- [Runtime common metadata](../data/dfttk/common.json) identifies Control `3`, Handling `5`, Stability `6`, Hip Accuracy `4`; SHA-256 `54297fd795b72bb32d539b9050406b60a9f97f7f40afbaa597d766dc0fc2d215`.
- [Manifest](../data/dfttk/manifest.json), SHA-256 `abdb2e6ebdd3820c22ac84da7165ab100cc7fa6e88728ebc7619e01721073f77`, gives every core/shard resource hash. All 69 payloads under `data/dfttk/packs/build-shared/cores/` were inspected. Example [M4A1 core](../data/dfttk/packs/build-shared/cores/18010000001.json), SHA-256 `40cc575534545525d5af10d61290734f66dc7d74703591357c04d2f587a0b0e4`.
- [FireControl source](https://dfttk.com/static/weaponBuilderV3FireControl-C-hA1uh4.js): symbols `F` (buckets/direct propagation), `I` (physical base values), `L` (curve mappings), `R` (numeric resolution), `j` (single-shot merge); SHA-256 `c2d3edda2a9032b91023d81f6f6c5967ccb4938574f3afb8927b2263cf88d2bc`.
- [Attribute calculator](https://dfttk.com/static/weaponBuilderV3AttributeCalculator-DsSa40Fx.js): `p` (outputs), `m` (ratios), `f` (trajectories), `h` (public API); SHA-256 `a4ef0082b4b18ab9deb0039699f6ffc228f52a8abb1d035e12d323dc18be2b69`. Executable inspection copies: `.scratch/calibration-check/{kernel,attributes,curves}.mjs`.
- [Curve evaluator](https://dfttk.com/static/weaponBuilderV3Curves-xeDUt094.js), SHA-256 `6b93bc42e7c3a6fbec755b1306a946f60260ffc7096ea6b5541e5a84b7e8e7a1`; [calibration source trace](weapon_calibration.md#dfttk-calibration-source-trace) specifies arithmetic, interpolation, precision and ordering in detail.

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

<a id="detailed-stat-independence"></a>
<a id="detailed-stat-independence--detailed-stats-and-independent-adjustment-in-the-dfttk-model"></a>
## Detailed stats and independent adjustment in the dfttk model

Inspected 2026-11-13. Scope: dfttk data `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`, all 69 weapon packs and their Operations (`sol`), Warfare (`mp`) and Detonation (`bd`) records. This is source-model evidence, not Global/Garena verification. English attachment names below are catalog labels and may be provisional; IDs and original names identify the records.

Detailed stats are not determined solely by their main stat. Attachments and calibration can address named physical targets directly. However, **independent of the main stat** does not mean **independent of every other detailed stat**: a real attachment or slider commonly bundles several effects. Separate target keys alone do not prove an attainable isolated adjustment.

<a id="detailed-stat-independence--reproducible-evidence"></a>
### Reproducible evidence

- [Machine-readable attachment/calibration inventory](../data/detailed_stat_target_audit.json), produced by [audit script](../tools/audit_detailed_stat_targets.py), retains mode, scope, sibling effects/functions, curves and compatible weapon IDs. Read sibling effects before claiming isolation.
- Primary runtime sources: [attribute calculator](https://dfttk.com/static/weaponBuilderV3AttributeCalculator-DsSa40Fx.js), functions `p` (physical outputs), `m` (normalization), `f` (trajectory), and [FireControl resolver](https://dfttk.com/static/weaponBuilderV3FireControl-C-hA1uh4.js), functions `F`, `I`, `L`, `R`, `j`. Preserved executable inspection copies are `.scratch/calibration-check/{attributes,kernel,curves}.mjs`. Hashes and baseline mapping coverage are recorded in [four-stat source trace](dfttk_stat_effects_source.md).
- Source catalog: [manifest](../data/dfttk/manifest.json), [M4A1 core](../data/dfttk/packs/build-shared/cores/18010000001.json), and shared records under `data/dfttk/packs/build-shared/shards/`. [Full calibration inventory](../data/calibration/inventory.json) preserves source definitions, complete curves and contexts; [reference checks](../data/calibration/reference_checks.json) preserve same-build output checks.
- Upstream paths were consulted after the [repository map](delta_gun_tierlist_repo_map.md). Relevant pinned source: [weapon resolver](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/src/engine/weapon_state.py), [M4A1 table](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/data/tables/weapons/18010000001.json), [mechanism](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/data/game/mechanism.json). Local verification copies are `.scratch/hip-source/`. The Python resolver exposes recoil H/V, shake H/V, random/spring and reload scales; the richer website calculator owns the output formulas described below. Do not assume the two expose identical output contracts.

<a id="detailed-stat-independence--control--recoil"></a>
### Control / Recoil

Control effective points use `WeaponMainAttribute.MainAttrValues.3`. Curves map them to general H/V recoil and random/spring kick; displayed points separately use `DisplayAttrValues.3`. The following outputs and distinctions come from calculator `p`, with actual interventions in the catalog inventory.

| Detailed metric | Consumed target / output | Actual adjustment and limits |
|---|---|---|
| Automatic horizontal recoil | `GRecoil_H` → `autoHorizontalRaw` and H trajectory increments | Bastion compensator `13130000167` directly modifies H without Control points or V; bundles H camera shake and H kick. |
| Automatic vertical recoil | `GRecoil_V` → `autoVerticalRaw` and V trajectory increments | Sandstorm compensator `13130000168` similarly addresses V without Control or H; bundles V shake and V kick. |
| Single/burst horizontal and vertical recoil | General H/V buckets plus matching `GRecoil_H_singleorburst` / `GRecoil_V_singleorburst` | Silent suppressor `13130000169` adds specialized `Mult_A -0.32` on both axes in Operations. This changes reported single/burst multipliers without modifying general recoil targets or Control points, but changes kick, Handling, Stability and Range too. The example does not isolate single H from single V. |
| Horizontal / vertical gun-kick axes | `GGunKickH * GGunkickH`, `GGunKickV * GGunkickV` with behavior-profile kick reference | Consumed keys are case-sensitive. Bastion/Sandstorm directly multiply their respective lower-case-k target by `0.88`; no family main curve maps to these axes. They remain coupled to same-axis recoil/shake on those actual muzzles. |
| Random / spring kick | `GGunkickRandom`, `GGunkickSpring` → individual raw values and arithmetic mean `fireWeaponStabilityRaw` | Separate targets and unequal real effects exist: G3 barrel `13020000512` has spring `Mult_C 0.88` and random `0.92` in Operations/Detonation. This also adds Control +8 and other main stats, so it proves unequal behavior, not an isolated random-only intervention. Calibration below changes the pair without Control points, but together. |
| ADS-recoil/recovery declarations | `GGunkick_ADSRecoilH`, `GRecoilRecovery` | Main operations propagate to these numeric buckets, but no demonstrated public attribute/trajectory consumer exists. Do not reinterpret them as the consumed gun-kick axis or an observed recovery-time output. |

Concrete H/V evidence: `13130000167` **堡垒水平补偿器 / Bastion Horizontal Compensator** has `GRecoil_H Mult_A -0.24`, `GRecoil_HShake Mult_C 0.76`, `GGunkickH Mult_C 0.88`, with no effective main-stat operation in this effect set. `13130000168` **沙暴垂直补偿器 / Sandstorm Vertical Compensator** has the corresponding V-only trio. Both are catalog-compatible with M4A1 `18010000001` among other weapons. This establishes axis-selective interventions and main-stat independence; it does not establish independent recoil-versus-shake-versus-kick controls. Source: inventory `direct`, matching item/mode records and `sibling_effects`.

The single/burst merge is asymmetric: resolver `j` incorporates only the specialized bucket's `multA` into the general target's additive-percent term; it does not multiply the fully resolved general value by an independently resolved single bucket. Public ADS/hip trajectories use general H/V even on Single-only weapons. Therefore a specialized single-shot reduction can change the reported single-shot detail without changing those plotted trajectories. Source: FireControl `j`, calculator `p`/`f`.

<a id="detailed-stat-independence--handling"></a>
### Handling

Handling main points (`WeaponMainAttribute.MainAttrValues.5`) curve-map ADS time, sprint-to-fire, ADS movement and silent-walk targets. They do not map reload, walk/sprint speed or equip/holster. Actual independent targets and bundled interventions follow; these are not promises that every weapon offers each intervention.

| Detailed metric | Calculator consumer | Independence supported by actual data |
|---|---|---|
| ADS time | `GAiming_ADSTime`; `floor(fround(seconds)*1000)` | Direct and calibration effects without Handling-point changes exist. Resonant stock and barrel-length examples below. |
| Sprint-to-fire | `GSprintToFireTime`; same millisecond conversion; `SprintToFireSpeed` aliases to it in `F` | AKM Performance Barrel `13020000355` has `Initial 0.11` in Warfare only. Its main-stat bundle includes Handling +2; this is a separate physical override, not evidence of an equip choice that leaves Handling unchanged. Its curve multiplier still applies. |
| ADS movement speed | `GMovement_WalkSpeed` / 100 times `(1 + resolved GMovement_ADSSpeed)` | Resonant stock directly adds `0.08`; barrel-weight calibration directly adds ±0.04 without main points. Can vary apart from ADS time with that slider, but kick varies too. |
| Walk / sprint speed | `GMovement_WalkSpeed`, `GMovement_SprintSpeed`, based on selected movement profile | No direct/tune numeric effects found in audited packs; actual `MovementSpeedId` / Warfare `BattlefieldMovementSpeedId` replacements exist, e.g. `13020000173`. Inspect profile values rather than treating every replacement as a numeric improvement. Main Handling does not change these outputs. |
| Tactical reload | `GReload_Time(ChangeClipTime(base reload))` | Direct magazine effects exist. M4 45-round mag `13120000234` directly adds reload `Mult_A +0.15`, paired with Handling -9; reload is not caused by that Handling loss. |
| Empty reload | `GReload_Time(ChangeClipTimewhenEmpty(ChangeClipTime(base empty reload)))` | AKM 70-round drum `13120000241` has `ChangeClipTime Mult_A +0.247` and empty-specific `Mult_A +0.186`, paired with Handling -15. Distinct factors exist, but this real attachment bundles them; `ChangeClipTime` also affects the empty result through the nested fallback. |
| Equip / holster | `holsterTime = weapon.timings.equipSeconds`; `drawTime = weapon.timings.holsterSeconds` | No target resolution occurs in these two output expressions. No demonstrated attachment/calibration adjustment of these public outputs. Preserve the reversed-looking source labels when interpreting the UI. |
| Silent walking | `GMovement_SilentWalkSpeed` main mapping | Numeric bucket resolves, but public calculator exposes no silent-walk output. No direct/tune intervention found in audited packs. |

`13030000178` **共振二代一体枪托 / Resonant 2 Integral Stock** directly applies ADS `Mult_A -0.16` and ADS speed `Addend +0.08` in the audited modes, with no Handling effective-point effect. It instead bundles Control +11, Hip Accuracy +4 and Stability -6 in Operations. Thus equal Handling does not imply equal ADS time or movement. Source: inventory `direct`, item/mode `sibling_effects`; physical formula from calculator `p`.

<a id="detailed-stat-independence--stability"></a>
### Stability

Stability effective points (`WeaponMainAttribute.MainAttrValues.6`) map to all seven targets listed below. They do not map general recoil or random/spring kick. The public camera result is an arithmetic mean of multipliers, not camera angle or a measured render trace. Source: calculator `p`; curve topology retained in each core.

| Detailed metric | Consumed target / formula | Actual adjustment and limits |
|---|---|---|
| Breath sway range | Base breath degrees × `GBreathScale`, then outer `WeaponAppearanceTable.HoldBreathId.StandBreathFactor` | Grip-weight calibration changes `GBreathScale` without Stability points, bundled with recoil H/V. Tactical bipod has outer factor `0.2`, subject to scope caveat below. |
| Hold-breath duration | `(100 / drainPerSecond) / GBreathTime` | Separate target consumed; no direct attachment/tune effect found in audited packs. Main Stability changes this with other mapped details. No demonstrated isolated duration control. |
| Recoil while holding breath | Profile `heldRecoilScale * GBreathRecoil` | Consumed as a separate detailed output; no direct attachment/tune effect found. Public recoil trajectories do not apply it. No demonstrated isolated held-recoil intervention. |
| Hit sway | Base `gunSwayBeHitScale * BehitGunSway` | Consumed; no direct attachment/tune effect found. Main Stability remains a bundled route. |
| Movement sway | `AimMoveGunSway` → `moveStability` and raw `gsMovementCameraScale` | Grip-thickness calibration directly changes it without Stability points, but trades ADS time. |
| Firing camera horizontal / vertical shake | `GRecoil_HShake`, `GRecoil_VShake`; public `fireCameraStability = (H + V) / 2` | Bastion/Sandstorm directly address separate axes without Stability points, bundled with same-axis recoil/kick. The mean hides which axis changed. |

`13140000038` **伸缩脚架握把 / Collapsible Bipod Grip** has `StandBreathFactor Mult_C 0.2`, general H/V `0.5`, random/spring `0.5` and H/V shake `0.75`, all marked `TacticalEffective`; ordinary ADS speed is `Addend -0.08`, Handling +3 and Hip Accuracy -12. **Scope matters:** preserved resolver `N` admits TacticalEffective operations only when the tactical option is enabled and the part satisfies its `C` predicate (TacticalEffective operations for both main IDs 4 and 5). This part's listed effects do not satisfy that predicate. The raw catalog factor is therefore not proof that the preserved public calculator applies deployed-bipod breath reduction. Treat it as a declared scoped source effect until its intended runtime path or in-game deployment is verified. Source: inventory `sibling_effects`; resolver `C`/`N`.

<a id="detailed-stat-independence--concrete-calibration-interventions"></a>
### Concrete calibration interventions

All examples use unchanged mounted attachments and main-point buckets; only the named slider varies. Values below are emitted operations, not percentages to apply to a displayed main stat. `Mult_A` sums with other additive-percent operations before multiplication; see [calibration stacking trace](weapon_calibration.md#dfttk-calibration-source-trace).

| Attachment and slider | Actual range and emitted endpoint effects | What remains coupled |
|---|---|---|
| `13020000173` **AR特勤一体消音组合 / AR SpecOps Integrally Suppressed Combo**, `length:0` | -10…+10, step 0.2, default 0: ADS `Mult_A -0.03…+0.03`, velocity `Mult_A -0.09…+0.09` | ADS can change without Handling or other Handling details, but velocity changes. Preserved M4A1 same-build Operations check: 327 ms at default → 317 ms at -10, 337 ms at +10. |
| Same barrel, `weight:1` | -50…+50, step 1, default 0: random and spring each `Mult_A +0.04…-0.04`; ADS speed `Addend +0.04…-0.04` | Kick changes without Control, general recoil or camera-shake targets, but random/spring stay paired and ADS movement changes. |
| `13030000109` **416实用后握把 / 416 practical rear grip** (English provisional), `thickness:0` | -20…+20, step 0.4, default 0: ADS `Mult_A -0.04…+0.04`; `AimMoveGunSway Mult_A +0.16…-0.16` | Movement sway changes without Stability points, but ADS time trades against it. |
| Same grip, `weight:1` | -50…+50, step 1, default 0: H/V recoil each `Mult_A +0.06…-0.06`; `GBreathScale Mult_A -0.18…+0.18` | Breath range changes without Stability; recoil changes without Control. H/V remain paired and breath changes in the opposite direction. |

Source: calibration inventory definitions `authoring:part:<item>:tune:<slider>`, corresponding `curves`, and [same-build reference outputs](../data/calibration/reference_checks.json). Both items are present in the retained M4A1 reference-check configuration. These demonstrate actual catalog interventions rather than arbitrary manual target edits.

<a id="detailed-stat-independence--interpretation-and-remaining-game-validation"></a>
### Interpretation and remaining game validation

<a id="detailed-stat-independence--additional-declared-targets-with-no-demonstrated-public-output-consumer"></a>
#### Additional declared targets with no demonstrated public output consumer

The full target-name scan also found declarations outside the consumed keys in the tables:

- Grip patch `13540000003`, original name **AR轻薄握把片**, directly emits `GunSwayBeHitscale Mult_A +0.5` and `CameraSwayBeHitScale Mult_A +0.5`. These are not the public hit-sway target `BehitGunSway`. The preserved calculator reads the weapon's base gun-hit sway multiplied by `BehitGunSway`; it does not read either of those direct named buckets. Thus hit response has separately addressed catalog effects, but they are not demonstrated adjustments of the current displayed hit-sway metric. Do not conclude the actual game ignores them.
- AKM barrel `13020000355` also declares `SuperSprintToFireSpeed Initial 0.11` in Warfare. The preserved public consumer reads `GSprintToFireTime` and has no separate super-sprint output/consumer. Do not extend the observed ordinary sprint-to-fire result to a verified super-sprint mechanic.
- Bipod `13140000038` declares crouch/prone breath-factor targets alongside standing. The public breath result consumes standing only; the declarations and tactical activation limitation do not establish displayed stance-specific effects.

These observed declarations are retained in the inventory rather than silently merged into similarly named consumed targets.

<a id="detailed-stat-independence--executable-output-checks"></a>
#### Executable output checks

Run `python tools/verify_detailed_stat_examples.py`; outputs are preserved in [ten calculator checks](../data/detailed_stat_examples.json). Seven direct-target removal diagnostics retain the exact same mounted build, calibration and main points while removing only one named operation from a cloned pack. These are explanatory counterfactuals, not legal alternative builds; they demonstrate that a target actually reaches the public output. They cover separate H/V recoil, horizontal shake, horizontal gun kick, ADS, Warfare sprint-to-fire and empty-specific reload.

Two additional checks vary legal calibration on the same M4A1 grip `13030000109`, retaining every main point:

| Slider | Default → legal positive endpoint | Public changes |
|---|---|---|
| Thickness | 0 → 20 | ADS 289 → 301 ms; movement sway multiplier 1 → 0.84 |
| Weight | 0 → 50 | H/V recoil multipliers 1 → 0.94; breath sway 0.4 → 0.472° |

The tenth check removes the bipod's standing-breath operation with `tacticalEffective: true`. It produces **no** public-output change, confirming the activation-predicate caveat rather than treating the raw factor as an active benefit. Resolver `C` requires TacticalEffective main-stat operations for IDs 4 and 5; the inspected bipod effect set lacks them.

An optimizer or explanation must retain effective main points **and** direct effects, profile replacements, calibration, scope and mode. Same main points can produce different detailed values. Conversely, a separate exposed target may have no attainable independent slider, may share every observed slider with another metric, or may have no consumer at all. This inventory establishes specific interventions, not full mathematical independent control of all detail axes or a guarantee that compensating attachment combinations exist.

For Global/Garena verification, record patch, mode, date, weapon/item IDs and complete tuning. Compare the same build at default and one changed slider endpoint; capture visible main/detailed stats. For hidden H/V recoil, camera shake and kick, use fixed stance, FOV, distance, cadence, duration/shot count and uncompensated firing recordings. Breath tests need matching meter/held state and hit/movement tests need matching stimulus. Compare declared scoped effects with the actual deployed state. Until those tests exist, camera, kick and hidden-bucket interpretations remain source-model findings or hypotheses about the game.

<a id="stat-points-above-100"></a>
<a id="stat-points-above-100--effective-stat-points-above-100"></a>
## Effective stat points above 100

Source-model audit: 2026-11-13, dfttk snapshot `20261108-an94-bd-shop.1`. No Global/Garena client test or hidden-stat-cap verification is claimed.

The response chart's default 0–150 domain comes from the earlier exploratory sweep, not an engine limit. The current implementation extends it when necessary to include the current effective value plus 20. Neither 100 nor 150 is a universal clamp in the preserved numeric main-attribute resolver. Individual response curves clamp at their endpoints. Display buckets and effective main points are separate; a capped graphical bar does not establish how the game clamps its underlying performance calculation.

<a id="stat-points-above-100--concrete-default-build-probes"></a>
### Concrete default-build probes

Detonation, effective points, other stats and default equipment held fixed:

| Weapon / response | At 100 | At 110 | Effective point at final source endpoint |
| --- | ---: | ---: | ---: |
| AUG (`18010000015`), ordinary vertical/horizontal recoil multiplier | 0.5249365317× | 0.4460406933× | 115 |
| M4A1 (`18010000001`), initial hip spread | 1.1307861034° | 0.9906712219° | 155 |

AUG's raw Control base is 60 and its ordinary recoil delta curve ends at +55 (`DeltaMappingThenScale`): 60 + 55 = 115. M4A1's raw Hip Accuracy base is 55 and its spread delta curve ends at +100: 55 + 100 = 155. The current default 150-point chart therefore does not display the final five points of that hip-spread curve.

For comparison, M4A1 ordinary recoil reaches its endpoint at Control 41 + 45 = 86; its random/spring kick curves end at 41 + 55 = 96. Thus some metrics stop improving before 100 while other weapon/stat curves extend past it.

Across the saved Detonation responses, 23 of 69 weapons have at least one Control metric that changes between effective 100 and 150; all 69 have a Hip Accuracy metric that changes. No sampled Handling or Stability metrics change after 100 in this default-build cohort. This is a statement about these model probes, not proof that builds can reach each point, or that attachments cannot improve plateaued metrics through independent effects.

<a id="stat-points-above-100--evidence-and-limits"></a>
### Evidence and limits

- [Saved numeric response export](../data/stat_curves/responses.json): filter by weapon ID, `mode=bd`, stat, and series key (`auto_vertical`, `auto_horizontal`, `hip_deg`). Compare the entries at `xs=100` and `xs=110`.
- [Probe methodology](weapon_stat_response_curves.md), [source/model distinction](dfttk_stat_effects_source.md).
- Curve definitions and raw base values are reproducible through `tools.sync_dfttk_database.assemble()` using the preserved manifest's build pack for the given weapon. Select the mode's curve ID from `attributeRules.weaponOverrides` or `attributeRules.defaults`; inspect `curves[id].points` and the mapping type.
- [Current chart domain](../tools/builder_stat_response.mjs).

These findings do not establish whether the Global/Garena game accepts hidden effective values above 100, whether only its displayed bar is capped, or whether any particular above-100 configuration is attainable under compatibility and mode budgets. A same-build in-game comparison with visible stats plus recoil/spread measurements remains necessary for that claim.
