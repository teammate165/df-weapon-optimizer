# Weapon stat response curves

The dfttk source-model research task is complete as of 2026-11-12. Data version `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`. The live manifest still matched this snapshot when this work began. The outputs describe dfttk's calculated performance, not independently measured Global/Garena behavior.

## Builder integration

The [local workshop](../builder/README.md) now has small info buttons beside the four stat titles. Unlike the default-build exports below, its response popup probes the currently displayed build and calibration, holding other main attributes and equipment fixed. It marks current effective points and shows +5/+10 increments and local marginal gains. The probe arithmetic follows the source method described here; raw recoil multipliers avoid cancellation from the attribute calculator's within-build recoil normalization. Implementation: [probe](../tools/builder_stat_response.mjs), [UI](../builder/stat-response-view.js). Tests compare default M4A1 samples at 0/50/100/150 in all modes against these exports and check tuned-build and AN94 current points. Global-client verification remains separate.

## Curves and exports

- [Interactive curve explorer](../data/stat_curves/index.html): open locally in a browser; choose any of 69 weapons and the `sol`, `mp` or `bd` mode. No server is needed. Each chart lets you inspect raw values as well as response relative to that weapon/mode's default build.
- [Reference four-panel figure: PNG](../data/stat_curves/m4a1_sol_response_curves.png), [SVG](../data/stat_curves/m4a1_sol_response_curves.svg), [PDF](../data/stat_curves/m4a1_sol_response_curves.pdf).
- [All numerical responses: CSV](../data/stat_curves/responses.csv), [JSON with mappings/provenance](../data/stat_curves/responses.json).

Coverage: **828 weapon/mode/stat response sets**, **4,140 metric series**, **625,140 numerical samples**. The selected domain is effective main attribute 0–150, plus the exact default point where needed. This is an exploratory domain, not a claim that 150 is an engine cap or that every sampled point is attainable through a legal build.

![M4A1 Operations response curves](../data/stat_curves/m4a1_sol_response_curves.png)

## Brief: what each stat affects

| Stat | Performance affected in dfttk | Important boundary |
| --- | --- | --- |
| **Control / 后坐力控制** (`3`) | Horizontal and vertical recoil multipliers for automatic and single/burst fire; random and spring weapon-kick multipliers. Lower multipliers mean less modeled disturbance. | These multipliers scale weapon-specific recoil profiles; the same multiplier does not imply equal recoil across guns. Separate camera-shake multipliers are driven by Stability. |
| **Handling / 操控速度** (`5`) | ADS time, sprint-to-fire time, ADS movement speed, and a resolved silent-movement-speed target. | Changing Handling alone does not change reload, empty reload, draw/holster, ordinary walk or sprint speed in the inspected model. Attachments can modify those independently. |
| **Stability / 据枪稳定性** (`6`) | Breathing sway, hold-breath duration and held recoil, hit-induced weapon sway, movement camera sway, and horizontal/vertical firing camera shake. | It does not alter the ordinary recoil-pattern multipliers. Camera-shake values are scale factors, not measured screen displacement. Hold-breath effects are conditional. |
| **Hip-fire accuracy / 腰际射击精度** (`4`) | Initial and maximum hip-fire spread; moving hip-fire spread follows initial spread and the profile's runtime scale. | The main stat does not alter resolved ADS spread or the ordinary recoil pattern in this calculator. Angular spread does not directly give hit probability without distance, target geometry and a shot-distribution model. |

The explorer marks whether lower or higher is favorable for each metric. A 100% horizontal reference means the selected gun/mode's default value; it is not a combined score. For example, reduced ADS time is favorable while increased ADS movement speed is favorable, even though those curves move in opposite directions.

## How the response curves were measured

1. Reconstruct each weapon's complete build pack from the manifest's shared core and shards, with source hashes checked.
2. Resolve that weapon's default mounted build, without calibration or ammo effects, in each game mode.
3. Vary exactly one `WeaponMainAttribute.MainAttrValues.ID`, retaining the original raw weapon base point and all other effective main attributes. A controlled additive probe compensates for any existing main-attribute percentage/product factor so the effective x value is exact. Other stat values and mounted parts are asserted unchanged.
4. Run dfttk's numeric resolver and mode-specific mappings. Export raw multipliers, degrees, seconds/milliseconds and movement speeds; timing quantization follows the source.
5. Normalize each metric to its own default value for the visual comparison. The original numeric series remains available. A zero baseline has no meaningful ratio and is not plotted as a fabricated percentage.

The x-axis is the **effective main attribute**, not the independently rounded `DisplayAttrValues` panel. The probe intentionally changes the main value without changing the independent display bucket. Normal attachments often change both, but direct/hidden effects can make the panel an imperfect proxy. Every response records both default main and displayed values.

Most mappings use a change from the weapon's raw base main attribute, not the absolute point value. Handling ADS time uses an absolute mapping. Curves use endpoint clamping, linear or cubic Hermite segments, and source modifier stacking; their shapes are not assumed linear. See [calibration arithmetic and mapping order](dfttk_calibration_source_trace.md).

## Weapon and mode differences

All 69 weapons share the same target topology, but several use different curve families:

- Control has the default family plus four exceptions, including M4A1, MK47, QCQ171 and QJB201.
- Handling has the default family plus exceptions for ASh-12, M7, K437, SR-3M and M14.
- Stability uses the same named family across all 69 weapons, but its effect still depends on mode curves, raw base points, profiles and existing modifiers.
- Hip accuracy has a separate family for MK4.

Each family has explicit mode curve IDs. Family names alone do not establish equal outputs. Plateau regions indicate source curve behavior/clamping for that target; do not interpret them as a universal cap on the displayed stat or all benefits of an attachment.

## Concrete M4A1 example

Default build in `sol`; vary only the listed main stat to 75 points:

| Stat | Default points | Selected performance at default | At 75 points |
| --- | ---: | --- | --- |
| Control | 41 | Vertical automatic recoil multiplier 1.0 | 0.4155326969 |
| Handling | 58 | ADS 302 ms | 212 ms |
| Stability | 55 | Horizontal firing camera-shake multiplier 1.0 | 0.12 |
| Hip accuracy | 55 | Initial hip spread 2.2464° | 1.5843895396° |

These are one-variable probes, not a proposed attachment build that attains all four values simultaneously. Control's recoil and random/spring kick curves differ; improving one metric by a percentage does not imply the same improvement in every other metric.

## Interpretation limits

Some declared direct targets have no demonstrated consumer in the inspected output: Control's `GGunkick_ADSRecoilH` and `GRecoilRecovery`, and Hip Accuracy's `GRecoil_Hip`. They are retained in source data and the resolver, but a flat/absent public response is not evidence of zero real-game effect. Silent movement is exported here from its resolved numeric target, although the public attribute-result object omits it.

The public recoil trajectory uses general horizontal/vertical multipliers rather than its separate single/burst-specific reported multipliers; it also does not apply the held-breath recoil factor. Those source limitations must not be silently interpreted as validated game behavior. Full findings, formulas and asset hashes: [stat effects source trace](dfttk_stat_effects_source.md).

For our sustained/spam-fire objective, use separate recoil-pattern, random/spring weapon-kick and firing camera-shake components. Handling and hip accuracy remain useful builder outputs but do not automatically become weights in perceived recoil. Post-firing recovery has no independent weight. Breathing, movement and held-breath conditions need an explicit test condition rather than an assumed universal benefit.

## Validation and reproduction

```powershell
uv run --no-project tools/verify_calibration_reference.py
uv run --no-project --with matplotlib tools/generate_stat_curves.py
```

Node.js runs the source resolver locally. Matplotlib is supplied through UV's command environment for PNG/SVG/PDF generation; no global Python packages are installed.

The sweep passed **1,203,285 assertions**: exact effective x values; fixed other main stats; finite metric values; unchanged mounted builds; and agreement with the full deployed attribute calculator at 0, 50, 100, 150 and the exact default (deduplicated where equal) for every response set. All series return their measured baseline at the exact default point. The silent-speed metric is checked as a resolved source target, not against a nonexistent public output.

Static figures were visually inspected. The standalone explorer's chart creation and weapon/mode switching were checked through DOM execution; full browser interaction has not been exercised. Actual-game testing remains separately tracked: screenshots for displayed/detailed stats and controlled sustained/spam firing recordings for recoil and camera behavior, with patch, mode, FOV, stance, cadence, distance and build recorded.
