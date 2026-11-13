# Detailed stats and independent adjustment in the dfttk model

Inspected 2026-11-13. Scope: dfttk data `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`, all 69 weapon packs and their Operations (`sol`), Warfare (`mp`) and Detonation (`bd`) records. This is source-model evidence, not Global/Garena verification. English attachment names below are catalog labels and may be provisional; IDs and original names identify the records.

Detailed stats are not determined solely by their main stat. Attachments and calibration can address named physical targets directly. However, **independent of the main stat** does not mean **independent of every other detailed stat**: a real attachment or slider commonly bundles several effects. Separate target keys alone do not prove an attainable isolated adjustment.

## Reproducible evidence

- [Machine-readable attachment/calibration inventory](../data/detailed_stat_target_audit.json), produced by [audit script](../tools/audit_detailed_stat_targets.py), retains mode, scope, sibling effects/functions, curves and compatible weapon IDs. Read sibling effects before claiming isolation.
- Primary runtime sources: [attribute calculator](https://dfttk.com/static/weaponBuilderV3AttributeCalculator-DsSa40Fx.js), functions `p` (physical outputs), `m` (normalization), `f` (trajectory), and [FireControl resolver](https://dfttk.com/static/weaponBuilderV3FireControl-C-hA1uh4.js), functions `F`, `I`, `L`, `R`, `j`. Preserved executable inspection copies are `.scratch/calibration-check/{attributes,kernel,curves}.mjs`. Hashes and baseline mapping coverage are recorded in [four-stat source trace](dfttk_stat_effects_source.md).
- Source catalog: [manifest](../data/dfttk/manifest.json), [M4A1 core](../data/dfttk/packs/build-shared/cores/18010000001.json), and shared records under `data/dfttk/packs/build-shared/shards/`. [Full calibration inventory](../data/calibration/inventory.json) preserves source definitions, complete curves and contexts; [reference checks](../data/calibration/reference_checks.json) preserve same-build output checks.
- Upstream paths were consulted after the [repository map](delta_gun_tierlist_repo_map.md). Relevant pinned source: [weapon resolver](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/src/engine/weapon_state.py), [M4A1 table](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/data/tables/weapons/18010000001.json), [mechanism](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/data/game/mechanism.json). Local verification copies are `.scratch/hip-source/`. The Python resolver exposes recoil H/V, shake H/V, random/spring and reload scales; the richer website calculator owns the output formulas described below. Do not assume the two expose identical output contracts.

## Control / Recoil

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

## Handling

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

## Stability

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

## Concrete calibration interventions

All examples use unchanged mounted attachments and main-point buckets; only the named slider varies. Values below are emitted operations, not percentages to apply to a displayed main stat. `Mult_A` sums with other additive-percent operations before multiplication; see [calibration stacking trace](dfttk_calibration_source_trace.md).

| Attachment and slider | Actual range and emitted endpoint effects | What remains coupled |
|---|---|---|
| `13020000173` **AR特勤一体消音组合 / AR SpecOps Integrally Suppressed Combo**, `length:0` | -10…+10, step 0.2, default 0: ADS `Mult_A -0.03…+0.03`, velocity `Mult_A -0.09…+0.09` | ADS can change without Handling or other Handling details, but velocity changes. Preserved M4A1 same-build Operations check: 327 ms at default → 317 ms at -10, 337 ms at +10. |
| Same barrel, `weight:1` | -50…+50, step 1, default 0: random and spring each `Mult_A +0.04…-0.04`; ADS speed `Addend +0.04…-0.04` | Kick changes without Control, general recoil or camera-shake targets, but random/spring stay paired and ADS movement changes. |
| `13030000109` **416实用后握把 / 416 practical rear grip** (English provisional), `thickness:0` | -20…+20, step 0.4, default 0: ADS `Mult_A -0.04…+0.04`; `AimMoveGunSway Mult_A +0.16…-0.16` | Movement sway changes without Stability points, but ADS time trades against it. |
| Same grip, `weight:1` | -50…+50, step 1, default 0: H/V recoil each `Mult_A +0.06…-0.06`; `GBreathScale Mult_A -0.18…+0.18` | Breath range changes without Stability; recoil changes without Control. H/V remain paired and breath changes in the opposite direction. |

Source: calibration inventory definitions `authoring:part:<item>:tune:<slider>`, corresponding `curves`, and [same-build reference outputs](../data/calibration/reference_checks.json). Both items are present in the retained M4A1 reference-check configuration. These demonstrate actual catalog interventions rather than arbitrary manual target edits.

## Interpretation and remaining game validation

### Additional declared targets with no demonstrated public output consumer

The full target-name scan also found declarations outside the consumed keys in the tables:

- Grip patch `13540000003`, original name **AR轻薄握把片**, directly emits `GunSwayBeHitscale Mult_A +0.5` and `CameraSwayBeHitScale Mult_A +0.5`. These are not the public hit-sway target `BehitGunSway`. The preserved calculator reads the weapon's base gun-hit sway multiplied by `BehitGunSway`; it does not read either of those direct named buckets. Thus hit response has separately addressed catalog effects, but they are not demonstrated adjustments of the current displayed hit-sway metric. Do not conclude the actual game ignores them.
- AKM barrel `13020000355` also declares `SuperSprintToFireSpeed Initial 0.11` in Warfare. The preserved public consumer reads `GSprintToFireTime` and has no separate super-sprint output/consumer. Do not extend the observed ordinary sprint-to-fire result to a verified super-sprint mechanic.
- Bipod `13140000038` declares crouch/prone breath-factor targets alongside standing. The public breath result consumes standing only; the declarations and tactical activation limitation do not establish displayed stance-specific effects.

These observed declarations are retained in the inventory rather than silently merged into similarly named consumed targets.

### Executable output checks

Run `python tools/verify_detailed_stat_examples.py`; outputs are preserved in [ten calculator checks](../data/detailed_stat_examples.json). Seven direct-target removal diagnostics retain the exact same mounted build, calibration and main points while removing only one named operation from a cloned pack. These are explanatory counterfactuals, not legal alternative builds; they demonstrate that a target actually reaches the public output. They cover separate H/V recoil, horizontal shake, horizontal gun kick, ADS, Warfare sprint-to-fire and empty-specific reload.

Two additional checks vary legal calibration on the same M4A1 grip `13030000109`, retaining every main point:

| Slider | Default → legal positive endpoint | Public changes |
|---|---|---|
| Thickness | 0 → 20 | ADS 289 → 301 ms; movement sway multiplier 1 → 0.84 |
| Weight | 0 → 50 | H/V recoil multipliers 1 → 0.94; breath sway 0.4 → 0.472° |

The tenth check removes the bipod's standing-breath operation with `tacticalEffective: true`. It produces **no** public-output change, confirming the activation-predicate caveat rather than treating the raw factor as an active benefit. Resolver `C` requires TacticalEffective main-stat operations for IDs 4 and 5; the inspected bipod effect set lacks them.

An optimizer or explanation must retain effective main points **and** direct effects, profile replacements, calibration, scope and mode. Same main points can produce different detailed values. Conversely, a separate exposed target may have no attainable independent slider, may share every observed slider with another metric, or may have no consumer at all. This inventory establishes specific interventions, not full mathematical independent control of all detail axes or a guarantee that compensating attachment combinations exist.

For Global/Garena verification, record patch, mode, date, weapon/item IDs and complete tuning. Compare the same build at default and one changed slider endpoint; capture visible main/detailed stats. For hidden H/V recoil, camera shake and kick, use fixed stance, FOV, distance, cadence, duration/shot count and uncompensated firing recordings. Breath tests need matching meter/held state and hit/movement tests need matching stimulus. Compare declared scoped effects with the actual deployed state. Until those tests exist, camera, kick and hidden-bucket interpretations remain source-model findings or hypotheses about the game.
