# Timed uncompensated recoil paths

Implemented 2026-11-12 in [timed_recoil.mjs](../tools/timed_recoil.mjs). Each generator result now includes `baseline_recoil_path` and per-build `recoil_path`, independent of the experimental combined score. No player compensation or reaction is modeled.

## Reproduce and inspect

```powershell
python tools/generate_builds.py data/recoil_examples/an94_detonation.request.json --output data/recoil_examples/an94_detonation.json
uv run --no-project --with matplotlib tools/plot_recoil_paths.py data/recoil_examples/an94_detonation.json --output data/recoil_examples/an94_detonation
python -m unittest discover -s tests -v
```

The request adds `shot_count` (default 20, integer 2–200). JSON contains exact source chart samples, source-resolved schedules, timestamps, profile IDs, capacity, diagnostics and verification status. The [saved comparison](../data/recoil_examples/an94_detonation.png) and [exportable SVG](../data/recoil_examples/an94_detonation.svg) show default/cheap/mid/expensive paths over time, horizontal movement, ADS recoil shape, and opening pre-shot aim proxies. Lines join discrete shot samples; they do not establish continuous motion between shots.

![AN94 Detonation timed source-model comparison](../data/recoil_examples/an94_detonation.png)

## Calculation and boundaries

Use the same pinned `attributes.mjs` calculator as the existing stat/calibration checks for the ADS trajectory. This preserves mode effects, profile replacement, attachment/calibration stacking, initial/loop arrays and the source's rounding/indexing. Coordinates are source **model units**, not verified degrees. Camera rendering and ballistic spread are excluded.

Resolve the firing schedule through the source fire-control kernel, including SDK intervals, attachment rate changes and explicit schedule rules. Attach timestamps using the source interval evaluator, starting the first shot at time zero. Trigger delay is available in source metadata but excluded from the first-to-last-shot window. AN94 automatically consumes `firstShotsRpm`: two 33.333 ms intervals followed by 100 ms intervals. Do not use its unrelated two-round Burst SDK fields to simulate this automatic opening.

For first/last post-shot chart points, `climb = max(0, (first.y - last.y) / elapsed_seconds)` because source chart y is negative upward. Report signed climb too. Horizontal span is max x minus min x across sampled points; maximum distance from starting aim is max hypot(x,y) relative to pre-fire zero. Peak upward displacement and the first impulse are separate diagnostics. Climb therefore excludes the first impulse; it includes subsequent source increments through the last sampled shot. Timing means different RPM affects the climb rate. The metric implements the draft [climb-speed definition](perceived_recoil_score.md) in model units; no cross-weapon angular equivalence is claimed.

An `opening` section separates accelerated-opening metrics from sustained metrics where enough samples exist. For AN94, source increments 1/2 are small and increment 3 is large. Chart points remain post-shot. A separate `pre_shot_aim_proxy` uses the previous cumulative impulse, matching the lab's hit-before-kick ordering in a simplified instantaneous-kick model. It omits lab smoothing, random jitter, spread and actual between-shot recovery. This explains how three tight aim samples can coexist with two small kicks as a hypothesis; it is not a fitted three-shot discount or a verified game-impact simulator. See the [full AN94 source trace](an94_automatic_timing.md#an94-recoil-source).

The current saved 20-shot AN94 default Detonation path has 1,766.667 ms between first/last shot and climb 7.002 model units/second. This is a reproducible source-model result, not an in-game measurement.

## Availability and remaining work

### Special source encoding: simulation versus ranking

| Source behavior | Timed simulation | Current search objective |
|---|---|---|
| Nonuniform per-shot recoil arrays, including AN94's tight opening kicks | Uses resolved full ADS profile through the source calculator | Uses axis multiplier norms, so does not directly score the per-shot shape |
| Initial/loop recoil sections and profile replacements | Preserves the source calculator's indexing and resolved references | Does not directly score replaced path geometry |
| `firstShotsRpm` accelerated opening and `intervalScaleSequence` | Uses resolved source schedule and shot-index interval evaluator | Does not directly score changing shot times |
| Attachment/calibration recoil modifiers | Applied by source resolver | Included as multiplier effects |
| Repress/reset thresholds | Unknown AN94 threshold is not guessed; timed paths accept one uninterrupted string | No paused/restarted firing optimization |
| Unmodeled schedules and prescribed single/burst input | Reports unavailable rather than inventing a hold-trigger simulation | Legacy proxy may still return builds; that does not establish timing support |

The implementation handles recognized source data structures; it does not execute arbitrary game behaviors. Full optimizer readiness requires using timed metrics during candidate evaluation, not merely attaching them to the selected builds. That integration remains pending the final objective definition. Unknown-reset safeguards in `tools/firing_timeline.py` remain applicable.

Return `status: unavailable` with a reason for unmodeled schedules, single/burst trigger requirements, spam-fire dynamics without measured cadence/reset behavior, or requests exceeding the selected build's magazine. Do not simulate a reload or shorten the comparison silently. A magazine-changing build may be unavailable even if the default supports the requested count. Invalid counts fail explicitly.

Pause/reset remains unmeasured for AN94. Timed paths cover one fully reset uninterrupted automatic string; they do not reset the opening sequence on arbitrary pauses. The existing Python timing simulator retains its explicit unknown-reset rejection. No new permanent game-data override is installed for tight recoil: it already exists in the source arrays.

The existing optimizer's 30/40/30 multiplier score still selects builds; timed climb and its improvement percentage are separate diagnostics. R/C/K weights remain undecided and are not silently inferred from those legacy weights. Timed metrics provide inspectable inputs for deciding the final objective. Next validation needs recorded angular/visual motion under fixed conditions and verification of first/final-shot semantics, inter-shot dynamics, camera/sight separation and AN94's boundary/reset.

Software checks include independent climb arithmetic, AN94 golden coordinates and timestamps, exact parity with source chart points for default/attachment builds in all modes, hit-before-kick proxy ordering, capacity failures and unsupported cadence rejection. Source-model tests do not complete Global/Garena validation.

Catalog smoke check on the pinned 69-weapon × three-mode snapshot: all 207 default requests completed without exceptions; 108 produced 20-shot timed paths, 78 required a prescribed single/burst cadence, 18 exceeded magazine capacity, and three had unmodeled schedules. Full Python suite: nine tests passed; the AN94 integration test also executes `tests/timed_recoil.mjs` against all modes. Output provenance includes hashes of the actual extracted calculator modules used.
