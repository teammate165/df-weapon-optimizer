# AN94 automatic-fire timing

Topic sections: [Overview](#an94-automatic-fire-timing) ? [AN94 opening recoil: source trace](#an94-recoil-source) ? [AN94 accelerated-sequence reset delay](#an94-reset-delay-research)

Implemented 2026-11-12 for weapon `18010000052`, profile `18010000052:base`.
This is automatic fire. Burst-mode fields are not used.

`data/timing/an94.json` preserves the user's report separately from imported
catalog records. `python tools/firing_timeline.py` installs that record into
`automatic_timing_overrides` in `delta_force_weapons.sqlite`. Installation is
repeatable and does not update `weapons` or `weapon_mode_stats`.

`tools/firing_timeline.py` reads the selected mode's `fire_schedule_rules`, then
applies the separate observation. AN94 has two opening intervals of 60,000/1,800
ms followed by 100 ms intervals. Relative shot times are 0, 33.333, 66.667,
166.667, 266.667 ms. The 100 ms shot 3→4 interval is a hypothesis, not a measured
boundary. The local dfttk snapshot `20261108-an94-bd-shop.1` corroborates three
opening shots at 1800 RPM and sustained 600 RPM in sol/mp/bd; see
[source sync](dfttk_database_sync.md). No upstream investigation was needed.

## Pause behavior and remaining evidence

The user reported that a minimum pause resets the opening sequence. Its duration
and reference point are unknown. Both fields remain null. Multiple trigger
windows therefore raise an explicit error until a reset rule is supplied.
The calculator supports thresholds measured from either the last shot or trigger
release, inclusive at the threshold. It carries sequence state across short
pauses and preserves the prior shot's cooldown. These semantics are model
assumptions to validate, including whether cooldown still applies after reset.
The first window assumes a fully reset weapon. Trigger windows are half-open:
a shot exactly at release time is excluded. The simulator does not model reloads,
ammo exhaustion, attachment RPM modifiers, latency, or trigger-to-first-shot delay.

To complete game validation:

1. Record patch/build, client region, mode, test date, weapon ID, all attachments
   and calibration, recording frame/audio sample rates, and input timestamps.
2. Capture repeated continuous automatic strings of at least ten shots. Extract
   shot onsets from the audio waveform, corroborating with ammo-counter changes
   and video. Retain the raw recording and onset table with uncertainty; distinguish
   echoes from shot events. Measure intervals 1→2, 2→3, 3→4, and subsequent shots.
3. Release after different shot counts and vary the re-press delay above and below
   the reset boundary. Repeat trials near the boundary. Measure both last-shot to
   re-press and release to re-press; vary release timing within the cooldown to
   distinguish the reference point. Check partial opening sequences as well as
   sustained fire. Report the bracket/uncertainty rather than false precision.
4. Preserve recordings and measured fixtures with the metadata above, update the
   observation/reset rule from evidence, and replay fixtures through the calculator.

## Software validation

The generator now also combines the accelerated schedule with AN94's nonuniform source recoil profile. See [source trace](an94_automatic_timing.md#an94-recoil-source) and [timed paths and comparison plot](timed_recoil_paths.md). Two small opening recoil kicks plus the lab's hit-before-kick ordering support a hypothesis of three tight opening aim samples; source chart points and pre-shot aim proxies remain distinct. No extra tightness coefficient or unmeasured pause reset is added.

Run `python -m unittest discover -s tests -v`.
`tests/test_firing_timeline.py` checks the opening/sustained boundary, all three
modes, catalog preservation, unknown-reset rejection, short-pause cooldown and
synthetic reset thresholds/reference points. Synthetic threshold values are not
AN94 measurements. The backlog stays open until recorded game tests validate it.

<a id="an94-recoil-source"></a>
<a id="an94-recoil-source--an94-opening-recoil-source-trace"></a>
## AN94 opening recoil: source trace

Inspected 2026-11-12 for weapon `18010000052`, local profile `18010000052:base`. This documents the dfttk/upstream source model; it does not verify Global/Garena behavior. The user's observation is three tightly grouped shots at 1800 RPM followed by 600 RPM automatic fire. Timing and spatial recoil are separate inputs.

<a id="an94-recoil-source--sources-and-provenance"></a>
### Sources and provenance

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

<a id="an94-recoil-source--spatial-recoil-is-already-encoded"></a>
### Spatial recoil is already encoded

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

<a id="an94-recoil-source--builder-dots-and-simulated-impacts-have-different-timing"></a>
### Builder dots and simulated impacts have different timing

Builder `sn` passes `result.base/current.recoil.trajectory` (hip trajectory) into the chart, even though the calculator also exposes `adsTrajectory`. `rn` converts each already cumulative point to a fixed 13.2-unit display and labels it shot `index+1`. The chart displays the accumulated recoil after applying that shot's entry, including the large third increment. AN94's hip/ADS arrays happen to match.

The shooting lab uses ADS. `y` subtracts the preceding cumulative point, yielding that shot's increment. In `Ue`, the callback computes increment `r`, snapshots impact aim `i = C.current + E.current`, then updates recoil target `w.current` with `r`; the emitted shot marker `ne.x/y` uses the snapshotted `i`. `E.current` is an animated/smoothed response toward `w.current`. Consequently the current shot's recoil affects subsequent aiming, rather than its own impact marker. The lab also adds seeded synthetic jitter in `b`, scaling and smoothing, so its impact positions are not simply raw chart points shifted one index.

**Hypothesis:** small first and second kicks can explain a tight group of three impacts because the third shot happens before its own large recoil increment moves later aim. This is consistent with lab operation and the user's observation, but does not establish the game's engine ordering. Do not silently relabel source chart dots as pre-shot impact positions; expose any impact interpretation separately.

<a id="an94-recoil-source--timing-remains-independent"></a>
### Timing remains independent

The assembled raw weapon fire-control base is Auto-only, interval `0.1` seconds (600 RPM). Raw SDK timing also contains `burstCount=2`, `burstFireInterval=0.033333`, `burstFireCd=0.17`, and `autoFireSingleInterval=0.321`; these names do not prove an automatic opening/reset rule. Current dfttk's resolved `firstShotsRpm` schedule supplies three shots at 1800 RPM with sustained 600 RPM, independently of trajectory integration. Keep the existing [automatic timing observation and limitations](an94_automatic_timing.md) and imported raw timing separate.

A nominal uninterrupted timeline is 0, 33.333, 66.667, 166.667 ms under the present interpretation of shot 3?4. That boundary and minimum pause/reset rule still need recorded game measurements. The lab resets its sequence counter on trigger start; this website convenience is not evidence for the real game's reset threshold.

<a id="an94-recoil-source--implementation-implications-and-remaining-validation"></a>
### Implementation implications and remaining validation

Consume the resolved full profiles and axis multipliers, retaining distinct hip/ADS outputs; attach firing timestamps separately. Source-model support exists for the nonuniform opening increments and accelerated schedule. There is no sourced additional three-shot recoil discount to fit or invent. Keep camera shake and gun kick separate from pattern displacement.

Global/Garena tests must record patch, region, mode, capture date, build/calibration, stance, FOV, distance, cadence and compensation. Compare shot impacts and frame-by-frame sight/camera motion, especially recoil after shots 1?3, the shot 3?4 interval and pause/reset boundary. Source comparisons alone do not complete those validation requirements.

<a id="an94-reset-delay-research"></a>
<a id="an94-reset-delay-research--an94-accelerated-sequence-reset-delay"></a>
## AN94 accelerated-sequence reset delay

Inspected 2026-11-13 for weapon `18010000052`. **No measured minimum reset pause was found in the inspected dfttk data/model.** The threshold and whether its clock starts at the last shot or trigger release remain unknown. These findings establish website behavior, not Global/Garena behavior.

Read the [repository map](delta_gun_tierlist_repo_map.md) and [previous source trace](an94_automatic_timing.md#an94-recoil-source) first. Downloaded snapshots are in `.scratch/an94-reset-research/`. Release inspected: `09f820e0d3ada199-a77003c3f09d`, data version `20261108-an94-bd-shop.1`; manifest game build is `unknown`.

<a id="an94-reset-delay-research--data-evidence"></a>
### Data evidence

The [AN94 shared core](https://dfttk.com/data/releases/09f820e0d3ada199-a77003c3f09d/v3/packs/build-shared/cores/18010000052.json) and [combat pack](https://dfttk.com/data/releases/09f820e0d3ada199-a77003c3f09d/v3/packs/combat/weapons/18010000052.json) contain an explicit `firstShotsRpm` schedule: three shots, 1800 RPM, sustained 600 RPM. No identified field supplies an automatic opening-sequence reset threshold. The AN94 rows in the mode libraries and client configuration likewise provide no identified reset rule. The uninterrupted schedule alone cannot establish a pause requirement.

Raw SDK fields preserve `burstCount=2`, `burstFireInterval=0.033333`, `burstFireCd=0.17`, `autoFireSingleInterval=0.321`, `autoFireBurstInterval=0`, `singleFireTolerant=0.2`, `fireRateMode=Auto`. No traced consumer establishes 170, 321 or 200 ms as the automatic accelerated-sequence reset pause. Field names alone are insufficient evidence.

<a id="an94-reset-delay-research--website-counter-reset-versus-cooldown"></a>
### Website counter reset versus cooldown

The live [shooting lab module](https://dfttk.com/static/WeaponRecoilLab-B3Zj9qwO.js), SHA-256 `1cdc55b3b66154a9da12a98ea3ade0003517564ce9f6f6a8ee175f9b717b5799`, implements two distinct behaviors:

- Stop callback `Q` immediately sets sequence counter `F.current=0`. Start callback `We` sets it to zero again before firing. Neither checks elapsed pause before resetting it.
- Shot callback `Ue` gets the next modeled interval from `he`, clamps it to at least 16 ms, and stores `v.current = firedAtMs + nextIntervalMs`.
- Start helper `ge` waits `max(triggerDelayMs, v.current - now, 0)`. Stopping retains this next-shot deadline.

Thus the website can defer the next trigger's first shot until the old next-shot deadline while already restarting the accelerated sequence counter. An apparent roughly 100 ms wait after a sustained shot is an inter-shot cooldown in this UI, not a measured 100 ms sequence-reset threshold. Browser timer behavior does not establish game timing.

The live [DataLibraryPage module](https://dfttk.com/static/DataLibraryPage-BVPhaY_W.js) does not contain the three candidate SDK field names above. Its trigger-delay display reads `triggerDelayMs`; its schedule summary uses explicit fire-schedule rules. The current entry module remains [index-CkyvGrtr.js](https://dfttk.com/static/index-CkyvGrtr.js), downloaded SHA-256 `bba2aac605b806743f84916937799dbc7687953093bef35730072a090c33431b`.

<a id="an94-reset-delay-research--validation-still-required"></a>
### Validation still required

Record patch, region, mode, build/calibration, date and high-frame-rate capture. Fire past the opening sequence, vary release-to-press pause, and measure both last-shot-to-next-shot and release-to-next-press durations. Determine when the next three shots regain the accelerated cadence; repeat around the transition and report a bounded threshold with frame uncertainty. Repeat after releasing during the opening sequence. Until then, preserve an unknown reset threshold. See the [measurement procedure](an94_automatic_timing.md).
