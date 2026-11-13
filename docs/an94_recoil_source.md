# AN94 opening recoil: source trace

Inspected 2026-11-12 for weapon `18010000052`, local profile `18010000052:base`. This documents the dfttk/upstream source model; it does not verify Global/Garena behavior. The user's observation is three tightly grouped shots at 1800 RPM followed by 600 RPM automatic fire. Timing and spatial recoil are separate inputs.

## Sources and provenance

Read [repository map](delta_gun_tierlist_repo_map.md) before upstream inspection. GitHub's [main commit API](https://api.github.com/repos/AVA-2568/delta-gun-tierlist/commits/main) returned commit `67abdb7a2e9472bd13dc3fe091fcb6b724e12d69`; fetched the following exact paths successfully over HTTPS:

- [AN94 weapon table](https://github.com/AVA-2568/delta-gun-tierlist/blob/67abdb7a2e9472bd13dc3fe091fcb6b724e12d69/data/tables/weapons/18010000052.json), SHA-256 `283d7ec7c287ae3fa16ddf1fe7b9e9d4786cb74464f7403738ad09877c1cf20f`.
- [Profiles](https://github.com/AVA-2568/delta-gun-tierlist/blob/67abdb7a2e9472bd13dc3fe091fcb6b724e12d69/data/game/profiles.json), SHA-256 `1b622be3a56a54e2f820e936256f7d164a0c6381da9d1c395c7b746f7904b050`.
- [Engine resolver](https://github.com/AVA-2568/delta-gun-tierlist/blob/67abdb7a2e9472bd13dc3fe091fcb6b724e12d69/src/engine/weapon_state.py), SHA-256 `439f4333ba3585d8d3a72070f7d146fd8129cb2110599fe24727c398a093ef22`.

The local [dfttk manifest](../data/dfttk/manifest.json), [download provenance](../data/dfttk/download_provenance.json) and `tools/sync_dfttk_database.py:assemble` reconstruct the AN94 core plus its declared shards. Assembled inspection copy: `.scratch/an94-research/pack.json`. Release data version is `20261108-an94-bd-shop.1`. The [release AN94 core](https://dfttk.com/data/releases/09f820e0d3ada199-a77003c3f09d/v3/packs/build-shared/cores/18010000052.json) was downloaded again and matched local SHA-256 `240da416db4bba59223d3d3c73ad0836d214198e6bd4207ed60c4417918b4bcf`.

The live [dfttk entry page](https://dfttk.com/) referenced `/static/index-CkyvGrtr.js`; its module graph identifies:

| Module | SHA-256 | Relevant symbols |
|---|---|---|
| [Attribute calculator](https://dfttk.com/static/weaponBuilderV3AttributeCalculator-DsSa40Fx.js) | `a4ef0082b4b18ab9deb0039699f6ffc228f52a8abb1d035e12d323dc18be2b69` | `d` profile entry selection; `f` cumulative trajectory; `p` resolved stats |
| [Builder UI](https://dfttk.com/static/WeaponBuilderV3-Lp448b0-.js) | `c749a4e4dcb7927a3b15668d627db37bafd19713d9873e0e83b6f50d83c968f3` | `rn` layout; `an` chart; `sn` selects `recoil.trajectory` |
| [Shooting lab](https://dfttk.com/static/WeaponRecoilLab-B3Zj9qwO.js) | `1cdc55b3b66154a9da12a98ea3ade0003517564ce9f6f6a8ee175f9b717b5799` | `y` differences cumulative points; `b` adds synthetic jitter; `Ue` fires a shot |

These modules and the upstream responses are saved in `.scratch/an94-research/`. Local `.scratch/calibration-check/attributes.mjs` contains the same trajectory implementation, with rewritten module import paths. The original downloaded calculator matches the live module hash above. See [stat effect trace](dfttk_stat_effects_source.md) for control/stability modifier provenance.

## Spatial recoil is already encoded

Upstream base references point hip recoil to `authoring:weapon:18010000052:hipRecoil`, and aiming to `authoring:weapon:18010000052:aiming`; that aiming profile points ADS recoil to `authoring:weapon:18010000052:adsRecoil`. Both recoil profiles and the inline weapon summary have the same opening arrays as assembled dfttk:

- `continuousFire.horizontalValues`: `[0, 0.08, -0.9, -1.2, -0.8, ...]`.
- `continuousFire.verticalValues`: `[0.3, 0.45, 5.2, 5.4, 5.2, ...]`.
- Continuous scales: horizontal `1`, vertical `1.5`; both arrays contain 40 entries.
- Loop horizontal array has 40 entries; loop vertical is `[4.44, 4.42, 4.44, 4.43, 4.43, 4.3]`, both loop scales `1`.

The upstream resolver `_resolve_profiles` retrieves the hip reference directly and ADS via the aiming profile. It exposes profiles and separate resolved recoil multipliers; it does not integrate firing dynamics or establish impact timing. General horizontal/vertical targets are `GRecoil_H` / `GRecoil_V`; camera shake targets remain separate.

Calculator `f` chooses continuousFire for this Auto weapon and iterates shot index from zero. Each step adds `value * axisScale * resolvedAxisMultiplier / 10`; vertical screen coordinates subtract that increment. There is no timing argument or extra AN94 tightness coefficient. At unit multipliers:

| Shot index (one based) | Increment x | Increment y | Cumulative x | Cumulative y |
|---|---:|---:|---:|---:|
| 1 | 0 | -0.045 | 0 | -0.045 |
| 2 | 0.008 | -0.0675 | 0.008 | -0.1125 |
| 3 | -0.09 | -0.78 | -0.082 | -0.8925 |
| 4 | -0.12 | -0.81 | -0.202 | -1.7025 |

Thus the source has **two small opening recoil increments**, followed by the large third increment. Do not replace this with three artificially reduced entries. These are website chart units, not established degrees or measured pixels. Preserve the calculator's loop selection: initial count is max continuous axis length (40); loop period is vertical length if nonempty (6), otherwise horizontal length. Both axes use that period, so a cleaner independent-axis loop would disagree with this source after entry 40.

## Builder dots and simulated impacts have different timing

Builder `sn` passes `result.base/current.recoil.trajectory` (hip trajectory) into the chart, even though the calculator also exposes `adsTrajectory`. `rn` converts each already cumulative point to a fixed 13.2-unit display and labels it shot `index+1`. The chart displays the accumulated recoil after applying that shot's entry, including the large third increment. AN94's hip/ADS arrays happen to match.

The shooting lab uses ADS. `y` subtracts the preceding cumulative point, yielding that shot's increment. In `Ue`, the callback computes increment `r`, snapshots impact aim `i = C.current + E.current`, then updates recoil target `w.current` with `r`; the emitted shot marker `ne.x/y` uses the snapshotted `i`. `E.current` is an animated/smoothed response toward `w.current`. Consequently the current shot's recoil affects subsequent aiming, rather than its own impact marker. The lab also adds seeded synthetic jitter in `b`, scaling and smoothing, so its impact positions are not simply raw chart points shifted one index.

**Hypothesis:** small first and second kicks can explain a tight group of three impacts because the third shot happens before its own large recoil increment moves later aim. This is consistent with lab operation and the user's observation, but does not establish the game's engine ordering. Do not silently relabel source chart dots as pre-shot impact positions; expose any impact interpretation separately.

## Timing remains independent

The assembled raw weapon fire-control base is Auto-only, interval `0.1` seconds (600 RPM). Raw SDK timing also contains `burstCount=2`, `burstFireInterval=0.033333`, `burstFireCd=0.17`, and `autoFireSingleInterval=0.321`; these names do not prove an automatic opening/reset rule. Current dfttk's resolved `firstShotsRpm` schedule supplies three shots at 1800 RPM with sustained 600 RPM, independently of trajectory integration. Keep the existing [automatic timing observation and limitations](an94_automatic_timing.md) and imported raw timing separate.

A nominal uninterrupted timeline is 0, 33.333, 66.667, 166.667 ms under the present interpretation of shot 3?4. That boundary and minimum pause/reset rule still need recorded game measurements. The lab resets its sequence counter on trigger start; this website convenience is not evidence for the real game's reset threshold.

## Implementation implications and remaining validation

Consume the resolved full profiles and axis multipliers, retaining distinct hip/ADS outputs; attach firing timestamps separately. Source-model support exists for the nonuniform opening increments and accelerated schedule. There is no sourced additional three-shot recoil discount to fit or invent. Keep camera shake and gun kick separate from pattern displacement.

Global/Garena tests must record patch, region, mode, capture date, build/calibration, stance, FOV, distance, cadence and compensation. Compare shot impacts and frame-by-frame sight/camera motion, especially recoil after shots 1?3, the shot 3?4 interval and pause/reset boundary. Source comparisons alone do not complete those validation requirements.
