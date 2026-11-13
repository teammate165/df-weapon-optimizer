# AN94 automatic-fire timing

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

The generator now also combines the accelerated schedule with AN94's nonuniform source recoil profile. See [source trace](an94_recoil_source.md) and [timed paths and comparison plot](timed_recoil_paths.md). Two small opening recoil kicks plus the lab's hit-before-kick ordering support a hypothesis of three tight opening aim samples; source chart points and pre-shot aim proxies remain distinct. No extra tightness coefficient or unmeasured pause reset is added.

Run `python -m unittest discover -s tests -v`.
`tests/test_firing_timeline.py` checks the opening/sustained boundary, all three
modes, catalog preservation, unknown-reset rejection, short-pause cooldown and
synthetic reset thresholds/reference points. Synthetic threshold values are not
AN94 measurements. The backlog stays open until recorded game tests validate it.
