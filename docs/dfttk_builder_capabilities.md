# DFTTK builder and data-library capability research

Inspected 2026-11-12 using public HTML, JavaScript and JSON over HTTPS. This records requirements for a future local optimizer interface; no application implementation or Global-client validation is claimed.

## Reproducible sources

- [App shell](https://dfttk.com/) loads `static/index-CkyvGrtr.js`.
- [Builder implementation](https://dfttk.com/static/WeaponBuilderV3-Lp448b0-.js), [attribute calculator](https://dfttk.com/static/weaponBuilderV3AttributeCalculator-DsSa40Fx.js), [curves and assembly resolver](https://dfttk.com/static/weaponBuilderV3Curves-xeDUt094.js), [fire control](https://dfttk.com/static/weaponBuilderV3FireControl-C-hA1uh4.js).
- [Library implementation](https://dfttk.com/static/DataLibraryPage-BVPhaY_W.js), [interactive recoil lab](https://dfttk.com/static/WeaponRecoilLab-B3Zj9qwO.js).
- [Manifest](https://dfttk.com/data/v3/manifest.json): observed runtime `09f820e0d3ada199`, data version `20261108-an94-bd-shop.1`, immutable resource root `/data/releases/09f820e0d3ada199-a77003c3f09d/v3`. Each `files[path].sha256` supplies the content integrity hash; the app verifies SHA-256 before using resources. JavaScript names above contain deployment hash suffixes, not cryptographic integrity hashes.
- [AI contract](https://dfttk.com/ai/context.json) documents public calculator input and output semantics. Its restriction to combat packs applies to that AI interface. The website builder itself reads build/sharedBuild packs; combat-only API output cannot supply its recoil and handling model.

Downloaded inspection sources are under `.scratch/dfttk-research/`; they are evidence snapshots, not the application's source of truth. Asset URLs and data versions can change independently; capture both in a reproducible integration.

Fetched and SHA-256 checked examples at the observed release root:

| Resource | SHA-256 of downloaded bytes |
|---|---|
| `packs/build/weapons/18010000001.json` | `d32ffbf13fb4d770defd83dc5c94253aa1c7a6e7b8e99d13884f66cbc64ecbed` |
| `library/sol.json` | `7897bbe804bd4e3cbb712745ccd795a63ac9b6b46f2d067f59a0564107f67b75` |

The fetched M4A1 build top-level keys are `schemaVersion`, `weaponId`, `weapon`, `parts`, `effectsByItemId`, `tunes`, `attributeRules`, `curves`, `kind`, `combat`, `handling`, `assembly`, `display`, `combatVariantItemIds`. Its `combatVariantItemIds` is keyed separately by `sol`, `mp`, `bd`. The fetched library root has `schemaVersion`, `kind`, `mode`, `weapons`, `parts`, `socketLabels`; the latter three are ID-keyed dictionaries.

## Exact mode and loadout contract

Mode keys are `sol` (Operations, 烽火地带), `mp` (Warfare, 全面战场), `bd` (Detonation, 黑潮爆破). Route prefixes are `/firefight`, `/battlefield`, `/demolition`; builder routes append `/builder`, recoil lab routes `/builder/recoil`. The calculator defaults any mode other than explicit `bd` or `mp` to `sol`; local code should validate instead of silently coercing unknown keys.

Selections are `[{slotPath: string, itemId: string}]`, with hierarchical slash-separated socket paths; tunes are `{[slotPath]: {[tuneId]: number}}`. Assembly resolution follows socket providers, mode-limited sockets, defaults, forced coupling, conditional coupling, and extra occupancy. It returns normalized config, mounted parts, displaced and rejected selections. Re-query available slots after each change. IDs and host context must survive translation and deduplication.

The manifest maps `weaponPacks[id]` to `build`, `combat`, `selection`, and optional `sharedBuild: {core, shards[]}`. Library derived entries are `entrypoints.library.sol/mp/bd`; catalogs are `entrypoints.weaponCatalog` and `ammoCatalog`. M4A1 example: `packs/build/weapons/18010000001.json`. Build calculation needs weapon base records, `assembly`, display objects/strings, attachment effects, tune definitions, attribute rules/curves, combat bullet profiles, and handling movement/aiming/spread/recoil/weapon-behavior/hold-breath profiles. Loading only weapon/part panel totals is insufficient.

## Live panels and detailed statistics

The builder exposes four parallel panels, main display attribute IDs `3` recoil control, `5` handling, `6` stability, `4` hip-fire accuracy. Keep displayed points distinct from internal effective attribute values and derived physical values. Current values are compared to the resolved empty/default loadout with empty tuning, in the selected mode. Recoil multipliers are ratios to that default baseline, not universal cross-weapon recoil units.

| Panel | Detailed fields observed in builder |
|---|---|
| Recoil control | Full-auto vertical/horizontal, single-shot vertical/horizontal multipliers, firing weapon stability |
| Handling | ADS milliseconds, sprint-to-fire milliseconds, ADS/walk/sprint speed m/s, tactical/empty reload seconds, holster/draw seconds |
| Stability | Breath sway degrees, hold-breath seconds, held recoil multiplier, hit sway multiplier, movement stability, firing camera stability |
| Hip-fire | Standing spread degrees, maximum spread degrees, movement spread degrees, UI scaling factor |

The library additionally exposes ADS-off time, silent walking, maximum carried ammo, sound travel distance, separate random/spring weapon kick, ADS initial/max spread, breath recovery, and separate hit weapon/camera stability. It presents damage, armor damage, DPS, velocity, supported fire modes, and attachment details. Its explanation explicitly distinguishes actual main attribute points from inferred display-equivalent points: e.g. single-axis recoil percentage effects are converted heuristically into display points. Those inferred conversions are not engine equations.

Builder detail labels map `holsterTime` to base `timings.equipSeconds` and `drawTime` to `timings.holsterSeconds` in this asset. Verify naming against raw schema and game behavior before copying these labels.

## Graphs and computations observed in source

1. **Attribute benefit curves:** per-weapon overrides or default attribute rules choose target mappings and mode-specific curves. Interactive SVG shows current point and selectable target effects. Curve evaluation clamps outside endpoints, linearly interpolates ordinary segments, and uses cubic Hermite interpolation for `RCIM_Cubic`, with leave/arrive tangents scaled by segment width. Preserve real main points versus display points when placing the current point.
2. **Recoil trajectory:** select `singleShot` for weapons supporting only Single; otherwise use `continuousFire`, falling back to the first single-shot point if continuous data is absent. After the initial sequence, repeat `loop`. For each shot, accumulate `x += horizontalValue * horizontalScale * horizontalModifier / 10`, `y -= verticalValue * verticalScale * verticalModifier / 10`. The source emits separate hip `trajectory` and `adsTrajectory`, defaults to 30 shots, and clamps count to 1–200. The builder graph overlays base and current trajectories. These coordinates alone do not prove screen angle, camera displacement, or hit position equivalence.
3. **Stability summaries:** `fireWeaponStabilityRaw = (GGunkickRandom + GGunkickSpring)/2`; displayed weapon stability is its ratio to baseline. `fireCameraStability = (GRecoil_HShake + GRecoil_VShake)/2`. Gun kick axes use distinct `GGunKickH/V` and `GGunkickH/V` targets, then divide by a kick reference. Preserve axes/components rather than using these simple means as a perceived-recoil objective.
4. **Other derived values:** ADS speed is resolved walk speed times `(1 + ADS movement modifier)`; hold-breath duration is `(100/drainPerSecond)/GBreathTime`; moving hip spread is standing horizontal spread times runtime scale; UI factor is runtime UI scale divided by runtime scale. The calculator rounds most visible values but supports `preservePrecision`; retain precision during optimization.
5. **Interactive shooting lab:** mouse/touch firing, magazine/reload, fire mode schedule, simulated scope magnification, distance, health and mode-dependent armor/ammo controls; target polygons distinguish head/chest/limbs. Shot elapsed time can add distance/velocity flight time. It consumes builder recoil and combat results. Unsupported/non-single-projectile configurations are disabled. The asset adds seeded synthetic jitter to each trajectory increment: amplitude `0.12 * clamp(weaponStability, .25, 2.5) * clamp(mean(gunKickH, gunKickV), .25, 2.5)`; Y noise is further multiplied by `.55`. Seed defaults to `20260813`. Cursor/camera smoothing uses exponential easing. These constants are website simulation choices, not verified game extraction.

## Requirements for the eventual local application

- Select weapon and exact mode; update compatible attachments and contextual calibration controls live, preserving defaults/forced parts/conflicts.
- Show the four panels, baseline differences, detailed statistics with units, and provenance; expose missing values instead of silently replacing missing evidence with zero.
- Provide base/current recoil trajectories with ADS/hip distinction, shot count, and explicit model labeling. Add benefit curves and separate horizontal/vertical recoil, camera shake and weapon kick views. Avoid presenting an illustrative target-range animation as a validated in-game simulation.
- Retain raw effects, curve IDs, profile IDs, mode, loadout, tuning, data version, client region, and validation status so any score or graph is reproducible. Price timestamps and missing quotes remain separate from performance.
- If an interactive lab is implemented, label synthetic jitter, target geometry, scope scaling, smoothing, and mouse compensation as assumptions. Keep chart/model comparison available independently of that lab.
- Optimize perceived recoil only after camera-shake versus shot-pattern metrics and weights are validated in controlled Global-client tests. Site arithmetic and panel similarity establish an implementable model reference, not validation of the optimizer objective.

No site inspection here establishes Global-client parity, actual recoil reset/recovery, optic/FOV rendering, full stance behavior, or verified calibration stacking. These remain hypotheses or research backlog items until in-game evidence is recorded.
