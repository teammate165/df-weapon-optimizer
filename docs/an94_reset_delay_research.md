# AN94 accelerated-sequence reset delay

Inspected 2026-11-13 for weapon `18010000052`. **No measured minimum reset pause was found in the inspected dfttk data/model.** The threshold and whether its clock starts at the last shot or trigger release remain unknown. These findings establish website behavior, not Global/Garena behavior.

Read the [repository map](delta_gun_tierlist_repo_map.md) and [previous source trace](an94_recoil_source.md) first. Downloaded snapshots are in `.scratch/an94-reset-research/`. Release inspected: `09f820e0d3ada199-a77003c3f09d`, data version `20261108-an94-bd-shop.1`; manifest game build is `unknown`.

## Data evidence

The [AN94 shared core](https://dfttk.com/data/releases/09f820e0d3ada199-a77003c3f09d/v3/packs/build-shared/cores/18010000052.json) and [combat pack](https://dfttk.com/data/releases/09f820e0d3ada199-a77003c3f09d/v3/packs/combat/weapons/18010000052.json) contain an explicit `firstShotsRpm` schedule: three shots, 1800 RPM, sustained 600 RPM. No identified field supplies an automatic opening-sequence reset threshold. The AN94 rows in the mode libraries and client configuration likewise provide no identified reset rule. The uninterrupted schedule alone cannot establish a pause requirement.

Raw SDK fields preserve `burstCount=2`, `burstFireInterval=0.033333`, `burstFireCd=0.17`, `autoFireSingleInterval=0.321`, `autoFireBurstInterval=0`, `singleFireTolerant=0.2`, `fireRateMode=Auto`. No traced consumer establishes 170, 321 or 200 ms as the automatic accelerated-sequence reset pause. Field names alone are insufficient evidence.

## Website counter reset versus cooldown

The live [shooting lab module](https://dfttk.com/static/WeaponRecoilLab-B3Zj9qwO.js), SHA-256 `1cdc55b3b66154a9da12a98ea3ade0003517564ce9f6f6a8ee175f9b717b5799`, implements two distinct behaviors:

- Stop callback `Q` immediately sets sequence counter `F.current=0`. Start callback `We` sets it to zero again before firing. Neither checks elapsed pause before resetting it.
- Shot callback `Ue` gets the next modeled interval from `he`, clamps it to at least 16 ms, and stores `v.current = firedAtMs + nextIntervalMs`.
- Start helper `ge` waits `max(triggerDelayMs, v.current - now, 0)`. Stopping retains this next-shot deadline.

Thus the website can defer the next trigger's first shot until the old next-shot deadline while already restarting the accelerated sequence counter. An apparent roughly 100 ms wait after a sustained shot is an inter-shot cooldown in this UI, not a measured 100 ms sequence-reset threshold. Browser timer behavior does not establish game timing.

The live [DataLibraryPage module](https://dfttk.com/static/DataLibraryPage-BVPhaY_W.js) does not contain the three candidate SDK field names above. Its trigger-delay display reads `triggerDelayMs`; its schedule summary uses explicit fire-schedule rules. The current entry module remains [index-CkyvGrtr.js](https://dfttk.com/static/index-CkyvGrtr.js), downloaded SHA-256 `bba2aac605b806743f84916937799dbc7687953093bef35730072a090c33431b`.

## Validation still required

Record patch, region, mode, build/calibration, date and high-frame-rate capture. Fire past the opening sequence, vary release-to-press pause, and measure both last-shot-to-next-shot and release-to-next-press durations. Determine when the next three shots regain the accelerated cadence; repeat around the transition and report a bounded threshold with frame uncertainty. Repeat after releasing during the opening sequence. Until then, preserve an unknown reset threshold. See the [measurement procedure](an94_automatic_timing.md).
