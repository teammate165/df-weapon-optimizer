# Hip accuracy, airborne ADS and spread dynamics: source audit

Inspected 2026-11-13. Repository map consulted first. Current upstream `main` resolved through GitHub's commits API to `1dbd155b864257edb1c261a7d547a8ae521a0ce3`; citations below pin that revision. This is an audit of a third-party model, not measured Global/Garena mechanics.

## Findings

The inspected upstream model has static hip-spread endpoints and separate multipliers for ordinary hip spread and continuous-fire hip spread. It does not provide a temporal hip-bloom/recovery simulation or an airborne ADS formula in the relevant resolver, weapon profiles and engagement calculator. The distinction matters: a maximum spread value does not specify how many shots reach it, whether it changes instantly when moving/jumping, or how quickly it recovers.

- [Weapon state resolver, lines 549–553](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/src/engine/weapon_state.py#L549): ADS time is the resolved absolute `GAiming_ADSTime`, otherwise `aiming.ads_on_s`. No airborne argument or airborne multiplier appears in that calculation. Ordinary ADS therefore ranks airborne ADS only under an explicitly assumed shared scaling rule; the repository does not establish that rule.
- [Resolver, lines 691–724](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/src/engine/weapon_state.py#L691): it resolves `GSpread_ADS`, `GSpread_Hip`, and `GSpread_Hip_Continuous` and retains hip/ADS profiles. This code does not advance spread shot by shot or over elapsed time.
- [Profiles](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/data/game/profiles.json): all 198 records with `kind: spread` have only `profile_id`, `kind`, `base_degrees`, `max_degrees`, and `runtime_scale`. There is no shot increment, bloom rate, recovery delay/rate, airborne field, or distribution in those records. This is a scoped absence finding about the published model, not a claim those mechanics do not exist in the game.
- [Ballistics](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/src/engine/ballistics.py) and [engagement](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/src/engine/engagement.py) do not consume spread profiles as a temporal hip-fire simulation. A ranked TTK or a recoil trajectory is not evidence of such a simulation.

## Dfttk website calculator cross-check

The preserved [attribute calculator](https://dfttk.com/static/weaponBuilderV3AttributeCalculator-DsSa40Fx.js), SHA-256 `a4ef0082b4b18ab9deb0039699f6ffc228f52a8abb1d035e12d323dc18be2b69`, source data version `20261108-an94-bd-shop.1`, exposes:

```text
idle = resolved GSpread_Hip(profile.baseSpreadDegrees.horizontal)
maximum = resolved GSpread_Hip_Continuous(profile.maximumSpreadDegrees.horizontal)
moving = idle * profile.runtimeScaleFactor
```

Its `waist.legend` contains `idle`, `moving`, and `max`. These are static outputs; `max` is a separate endpoint, not an animation or a per-shot rule. The ordinary output rounds idle/max to two decimals before computing its displayed moving legend; `preservePrecision` avoids this output rounding. Independent jump spread and airborne ADS time are absent from this output contract. See the existing [four-stat source audit](dfttk_stat_effects_source.md) for source hashes, mappings and limitations.

## Reproducible M4A1 example

Weapon ID `18010000001`, base profile. The [weapon table, lines 110–149](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/data/tables/weapons/18010000001.json#L110) gives ADS on/off `0.28 s`; hip base horizontal/vertical `2.2464°`; hip maximum horizontal/vertical `5.6°`; runtime scale `1.25`. Default panel hip accuracy is 55. Using the website's static legend convention at the unmodified endpoint:

| Endpoint | Preserved-precision value |
|---|---:|
| Idle hip | 2.2464° |
| Moving hip | 2.808° |
| Maximum hip | 5.6° |

The same source table stores ADS base spread `0°` and maximum `180°`. These are raw profile values; they do not prove actual ADS shots bloom to a 180° cone. The source has no transition law establishing that interpretation.

[M4A1 Accuracy mappings](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/data/tables/weapons/18010000001.json#L1807) send both hip targets through the same `DeltaMappingThenScale` curve family. The [mechanism table](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/data/game/mechanism.json) gives the Detonation curve's delta/control points `(-40,1.5), (0,1), (10,0.83), (32,0.6), (100,0.3)`, with cubic tangents. Consequently Accuracy generally improves both endpoints together, and profile-replacing attachments can change the endpoint ratio. A subsequent complete local-pack scan found no direct numeric hip/max-spread attachment targets or calibration targets; see the follow-up below.

## Consequences for the experimental agility objective

The existing moving-as-jumping approximation does not become validated by this audit. Static moving spread is a supported website output; jumping spread is unknown. Maximum spread should be preserved as an independent available measurement when defining a sustained-fire accuracy objective. There is insufficient evidence to choose how much idle versus maximum matters during a burst, or to derive a time-averaged cone.

Range-aware hit probability additionally requires target size/shape, aim distribution, the angular convention (half-angle versus full width), spread distribution, shot cadence/window, and movement state. Projecting the reported degrees into a hit circle or assigning a saturation threshold without those inputs would introduce another assumption. A useful next experiment records patch/client/mode, same build, distance, stance/movement/jump phase, frame timing and enough shots: compare idle first shots, sustained bursts, and delayed shots after release; separately time ADS while grounded and airborne. Record observations independently of source values.

## Reproduction

Downloaded only mapped relevant paths into `.scratch/hip-source/`: weapon table, profiles, mechanism, resolver, ballistics, engagement, and collector. GitHub recursive tree was inspected for potentially relevant source filenames. Count/check spread schema with `profiles.values()` filtered by `kind == "spread"`; resolve the M4A1 profile using `base.references.waist_spread_profile_id`. This audit does not assert exhaustive absence from every historical upstream revision or from the actual game client.

## Follow-up: modification, calibration and proportionality

Scanned all 69 assembled local weapon packs from `20261108-an94-bd-shop.1`:

- Every default Accuracy rule pair uses the same mapping type and per-mode curve IDs for `GSpread_Hip` and `GSpread_Hip_Continuous`. With the spread profile fixed, both endpoints receive the same Accuracy factor: idle = baseIdle ? f(Accuracy), max = baseMax ? f(Accuracy). Thus max/idle remains constant for a fixed profile.
- No direct numeric attachment effects targeting `GSpread_Hip_Continuous` were found. No calibration functions targeting `GSpread_Hip`, `GSpread_Hip_Continuous`, or effective Accuracy `WeaponMainAttribute.MainAttrValues.4` were found. Calibration therefore does not change these endpoints in this preserved model. Do not interpret this as actual-client proof.
- Attachments that increase effective Accuracy can reduce maximum spread through that shared factor.
- Profile replacement is an exception to a universal idle/max ratio. Part `13020000173` replaces `WaistShootSpreadId`; the local resolved hip profile has base 0.35? and max 5?, versus M4A1 base 2.2464? and max 5.6?. These are profile inputs before any main-stat multiplier. Its replacement is also present in the [pinned upstream barrel table](https://github.com/AVA-2568/delta-gun-tierlist/blob/1dbd155b864257edb1c261a7d547a8ae521a0ce3/data/tables/parts/barrel.json#L369). Therefore maximum is not derived solely from idle: it has its own profile baseline, although both normally share Accuracy scaling.

This narrows the earlier theoretical direct-modifier concern: the observed independent mechanism here is profile replacement, not a found direct maximum-spread calibration slider.
