# Horizontal recoil: first 20 bullets

[20-bullet horizontal travel speed ranking](horizontal_recoil_speed.md). Speed is the newly proposed threshold metric; the distance table below remains a separate diagnostic.

**Current metric: maximum horizontal distance from the pre-fire origin**, `H = max(abs(x_i))`, with origin `x=0`. Use the first 20 cumulative post-shot ADS points, including the first-shot impulse without recentering. Left and right count equally. Repeated travel does not accumulate. Left-to-right span is obsolete for ranking.

Source snapshot: `20261108-an94-bd-shop.1`. Resolved base configurations with source defaults and no user tuning. Units are source-model units, not calibrated angles or client measurements. Highest distance ranks first; lower is better.

Reproduce both reports and JSON: `python tools/calculate_horizontal_recoil.py`. Requires the local SQLite/source catalog and preserved `.scratch/calibration-check/` runtime. All three modes have identical trajectories and availability in this snapshot; the table shows Detonation.

36 automatic weapons ranked; 6 automatic weapons unavailable for this uninterrupted window. Nonautomatic weapons are excluded because no prescribed single/burst cadence is modeled. No reloads or silent window shortening.

[First-10-bullet report](horizontal_recoil_first_10.md) | [All-mode data and trajectories](../data/horizontal_recoil.json)

The earlier audit reproduced all 207 weapon/mode statuses and old available spans. Switching to origin distance changed 30 of 36 ranks. The old span threshold is obsolete. Lowest Recoil now uses pattern = V + multiplier * H, with H equal to origin distance and candidate fastest-200ms speed selecting multiplier 1 (<=3), 2 (>3), 3 (>4), or 5 (>5) model units/s. Default normalization and 40/30/30 component weights remain. See [current optimizer contract](recoil_generator.md#current-horizontal-speed-tiers-2026-11-15). This table ranks base horizontal distance, not combined scores.

| Rank | Weapon | Weapon ID | Horizontal distance | Min x | Max x |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | QJB 201 Light Machine Gun | `18040000004` | 5.2871 | -5.2871 | -0.2825 |
| 2 | AKM Assault Rifle | `18010000006` | 4.3435 | -0.3841 | 4.3435 |
| 3 | MK47 Battle Rifle | `18010000043` | 3.9270 | 0.5440 | 3.9270 |
| 4 | M250 General Machine Gun | `18040000003` | 3.6785 | -3.6785 | 0.4655 |
| 5 | QBZ95-1 Assault Rifle | `18010000008` | 3.6609 | -0.1493 | 3.6609 |
| 6 | M249 Light Machine Gun | `18040000002` | 3.4428 | -0.4180 | 3.4428 |
| 7 | RM277 Assault Rifle | `18010000049` | 3.3683 | -0.6661 | 3.3683 |
| 8 | AK-12 Assault Rifle | `18010000018` | 2.6455 | -0.2717 | 2.6455 |
| 9 | PKM General Machine Gun | `18040000001` | 2.2840 | -2.2840 | 0.3192 |
| 10 | PTR-32 Assault Rifle | `18010000024` | 2.1015 | -2.1015 | 0.6960 |
| 11 | AR-57 Assault Rifle | `18010000045` | 1.9465 | 0.0850 | 1.9465 |
| 12 | M4A1 Assault Rifle | `18010000001` | 1.8213 | -1.8213 | 0.6032 |
| 13 | KC17 Assault Rifle | `18010000042` | 1.7810 | 0.2640 | 1.7810 |
| 14 | QCQ171 Submachine Gun | `18020000011` | 1.5948 | -1.5948 | 0.3540 |
| 15 | CAR-15 Assault Rifle | `18010000031` | 1.5898 | -0.7338 | 1.5898 |
| 16 | CI-19 Assault Rifle | `18010000038` | 1.5696 | -1.5696 | 1.4004 |
| 17 | MDR Assault Rifle | `18010000051` | 1.4840 | -0.0460 | 1.4840 |
| 18 | K437 Assault Rifle | `18010000040` | 1.4630 | -1.4630 | 0.3630 |
| 19 | K416 Assault Rifle | `18010000013` | 1.3332 | -1.3332 | 0.5568 |
| 20 | SMG-45 Submachine Gun | `18020000006` | 1.3074 | -0.2586 | 1.3074 |
| 21 | M7 Battle Rifle | `18010000016` | 1.2096 | -1.2096 | 0.2835 |
| 22 | Thompson Submachine Gun | `18020000046` | 1.1940 | -0.0348 | 1.1940 |
| 23 | Ash-12 Battle Rifle | `18010000012` | 1.0500 | -0.8400 | 1.0500 |
| 24 | AUG Assault Rifle | `18010000015` | 0.9823 | -0.9823 | 0.5177 |
| 25 | AKS-74 Assault Rifle | `18010000010` | 0.9527 | -0.5859 | 0.9527 |
| 26 | AN-94 Assault Rifle | `18010000052` | 0.9520 | -0.9520 | 0.0080 |
| 27 | Bizon Submachine Gun | `18020000005` | 0.9413 | -0.3578 | 0.9413 |
| 28 | UZI Submachine Gun | `18020000004` | 0.7140 | -0.7140 | 0.2136 |
| 29 | P90 Submachine Gun | `18020000002` | 0.7095 | -0.4785 | 0.7095 |
| 30 | Vityaz Submachine Gun | `18020000009` | 0.6979 | -0.3724 | 0.6979 |
| 31 | G3 Battle Rifle | `18010000023` | 0.6696 | -0.6696 | 0.2448 |
| 32 | SG 552 Assault Rifle | `18010000017` | 0.6248 | -0.3568 | 0.6248 |
| 33 | MCX LT Assault Rifle | `18010000044` | 0.6120 | -0.6120 | -0.1200 |
| 34 | MP5 Submachine Gun | `18020000001` | 0.5970 | -0.0174 | 0.5970 |
| 35 | MP7 Submachine Gun | `18020000010` | 0.5676 | -0.3828 | 0.5676 |
| 36 | SCAR-H Battle Rifle | `18010000021` | 0.5209 | -0.1838 | 0.5209 |

## Unavailable automatic weapons

- AS Val Assault Rifle (`18010000037`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- Vector Submachine Gun (`18020000003`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- SR-3M Compact Assault Rifle (`18020000008`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- VSS Marksman Rifle (`18050000003`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- M14 Marksman Rifle (`18050000005`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- G18 (`18070000005`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.

Validation: all weapon/mode rows evaluated; exact cross-mode trajectory/status agreement; finite distances; asymmetric, one-sided and zero synthetic checks; 10/20-point prefix identity and distance monotonicity. Human perception and Global/Garena client validation remain open.
<!-- historical-decisions -->

## Historical decisions and optimizer trials (obsolete span metric)

The following records preserve prior formulas, constraints, IDs, validation and evidence paths. Their span values and rankings are superseded by the origin-distance metric above. Statements such as "latest" or "current" below apply only to their historical experiment. They do not define the current research metric. The origin-distance migration was pending at the time of those records; the current speed-tier contract above supersedes them.

### Historical scoring contract

# Horizontal recoil penalty anchors (2026-11-15)

Status: production implementation prepared; validation and release recorded in TODO.md.

User selected the base PTR-32 and MK47 builds as examples of excessive horizontal recoil. Resolved default loadouts with no selected attachments or tuning, automatic ADS, 20 shots, preserved source calculator via tools/timed_recoil.mjs. Results agree across bd/sol/mp in the current local snapshot.

| Weapon ID | Weapon | Horizontal span, model units |
| --- | --- | --- |
| 18010000024 | PTR-32 | 2.7975 |
| 18010000043 | MK47 | 3.3830 |
| 18010000001 | M4A1 comparison | 2.4245 |

All three default GRecoil_H/GRecoil_V multipliers equal 1/1. The existing multiplier norm cannot distinguish their underlying trajectory magnitudes. Horizontal net drift is unsuitable for measuring side-to-side excursion because reversals cancel. These spans describe cumulative post-shot source-chart coordinates; they are not angular measurements, randomness measurements or Global/Garena validation.

## Agreed threshold and shared formula

Latest user decision: REVERT the base-span gate. Check candidate horizontal span instead, with threshold 1.5 and 2.5x marginal horizontal weight above it.

```text
pattern = V + H + 1.5 * max(0, H - 1.5)
```

H is the updated candidate horizontal span; V is vertical excursion over the same fixed 20-shot automatic ADS trace. Below 1.5, marginal vertical:horizontal weight is 1:1; above 1.5 it is 1:2.5. No weapon-name exceptions or persistent base-derived weight. Normalize by the default pattern evaluated with this same formula, then retain 30/40/30 pattern/camera/kick weights and strict Handling tie-breaking. Shorter base magazines and nonautomatic firing need compatible protocols before production implementation.

Production Lowest Recoil now implements the formula for supported automatic base configurations. Eligibility is fixed per run using the default 20-shot timed path; unsupported protocols (including base magazines below 20 and spam/burst/single) retain the legacy multiplier proxy with explicit run limitations. Highest Agility retains its previous recoil tie-breaker. Candidate chart scoring always uses 20 points, independently of UI graph shot count; a candidate magazine below 20 is an abstract profile evaluation, not a continuous firing claim. No implicit Handling floor is added: 50/55 were experiment constraints. Global/Garena validation remains open. See docs/horizontal_recoil.md for historical experiments.


Reproduction: assemble each weapon pack with tools/sync_dfttk_database.py assemble(load('manifest.json')['weaponPacks'][weapon_id]); resolve curves.o(pack, [], mode); run timedRecoil(pack, build, {}, {mode, shot_count:20}, {curves,kernel,calculate}) using preserved .scratch/calibration-check modules. Inspect metrics.horizontal_span_model_units. Runtime/source-model limitations in docs/timed_recoil_paths.md remain applicable.


### Historical experiment log

# Horizontal penalty optimizer trial

Detonation; full weapon attachment cap; eight coordinate-search passes; no locks or stat floors; best-performance endpoint only. Source model, not globally proven or client-validated. Production scoring unchanged.

Trial formula: V + H + 0.5 * max(0, H - 2.5), normalized to the same weapon default; camera/kick weights remain 30/40/30 overall; Handling breaks recoil ties. V = max(y)-min(y) over the same 20 post-shot ADS chart points.

| Weapon | Model | Foregrip | Item ID | Horizontal span | Cost | Converged |
| --- | --- | --- | --- | ---: | ---: | --- |
| PTR-32 | old | Practical Vertical Foregrip | `13140000021` | 1.58228 | 600 | True |
| PTR-32 | trial | Practical Vertical Foregrip | `13140000021` | 1.58228 | 600 | True |
| MK47 | old | X25U Angled Combat Grip | `13140000035` | 1.17176 | 940 | True |
| MK47 | trial | Dawn Angled Flashlight Grip | `13140000042` | 1.40889 | 940 | True |

Validation: replayed output trajectories match H/V used in trial scoring; combined loss matches declared weights/default normalization; both runs respect attachment caps. All four searches converge. Scores across the old and trial formulas are not directly comparable.

Experiment code and complete inputs/results: `.scratch/horizontal-optimizer-trial/` (run.mjs plus copied engine/presets and per-weapon JSON). The original shared production modules were not modified.

## Threshold 2.0, Thorough rerun

Latest user decision: threshold 2.0, 1.5x marginal horizontal weight. Detonation/full cap, 16 passes (Thorough), no locks/stat floors, Max endpoint only. Same 20-shot protocol and camera/kick weights.

| Weapon | Foregrip | Horizontal span | Vertical excursion | Cost | Converged |
| --- | --- | ---: | ---: | ---: | --- |
| PTR-32 | Practical Vertical Foregrip (`13140000021`) | 1.58228 | 5.65460 | 600 | Yes |
| MK47 | Dawn Angled Flashlight Grip (`13140000042`) | 1.40889 | 5.85255 | 940 | Yes |

Both full configurations and tuning match the earlier threshold-2.5/eight-pass trial. Both selected horizontal spans fall below 2.0. Validated exact pattern arithmetic against output paths, default penalty normalization, weighted loss, budget compliance and search convergence. No global-optimality claim.

Artifacts: `.scratch/horizontal-optimizer-trial/run-thorough.mjs` and `*-thorough-t2.json`. Production scoring remains unchanged; this is an isolated trial.

## Threshold 2.0, 2x marginal weight, Thorough rerun

Latest user preference: `pattern = V + H + max(0, H - 2.0)`. Reran both weapons with 16 passes in Detonation/full cap, no locks/stat floors, Max endpoint only. Both searches converge and retain the complete configurations/tuning from the 1.5x trial: PTR-32 Practical Vertical Foregrip, horizontal span 1.58228/cost 600; MK47 Dawn Angled Flashlight Grip, horizontal span 1.40889/cost 940. Both spans are below 2.0. Validated default and candidate pattern arithmetic, output horizontal spans, combined normalized loss and budget compliance. Artifacts: `.scratch/horizontal-optimizer-trial/run-thorough-w2.mjs` and `*-thorough-t2-w2.json`. Production scoring unchanged; best-found, not a global proof.

## Threshold 2.0, 2.5x marginal weight, Thorough rerun

Latest preference: `pattern = V + H + 1.5 * max(0, H - 2.0)`. Detonation, 16 passes, full attachment cap, no locks/stat floors, Max only. Both converge with full configurations/tuning unchanged from the 2x trial: PTR-32 Practical Vertical Foregrip (H 1.58228, cost 600); MK47 Dawn Angled Flashlight Grip (H 1.40889, cost 940). Default/candidate formula, trajectory H, normalized loss and budget checks pass. Artifacts: `.scratch/horizontal-optimizer-trial/run-thorough-w2p5.mjs`, `*-thorough-t2-w2p5.json`. Production scoring unchanged; best-found only.

## Handling strictly above 55

Threshold 2.0; marginal horizontal weight 2.5x; Thorough/16 passes; Detonation full cap; Max endpoint only. Handling minimum set to 55.0001 effective points to enforce the requested strict >55 condition with the existing inclusive floor API. No locks or other stat floors.

| Weapon | Foregrip | Handling | Horizontal span | Vertical excursion | Cost |
| --- | --- | ---: | ---: | ---: | ---: |
| PTR-32 | None | 58.0000 | 1.97735 | 7.06642 | 600 |
| MK47 | Phase Combat Foregrip | 58.0000 | 1.53793 | 10.32002 | 960 |

Both converge and pass strict Handling, budget, source-trajectory span and normalized score checks. PTR-32 has no mounted foregrip in this best-found result. Artifacts: `.scratch/horizontal-optimizer-trial/run-thorough-h55.mjs`, `*-h55-input.json` and `*-thorough-t2-w2p5-h55.json`. Production scoring unchanged; not a global-optimality proof.

## Base-span threshold correction

User correction: threshold checks the resolved base weapon, not each candidate. Freeze `horizontal_weight = 2.5 if base_H > 2.0 else 1`; candidate pattern = `V + horizontal_weight * H`. The elevated weight persists below candidate H=2.0. This supersedes all candidate-excess hinge formulas above.

Reran Detonation/full cap, Thorough/16 passes, Handling minimum 55.0001 (>55), no locks.

| Weapon | Base H | Weight | Foregrip | Handling | Candidate H |
| --- | ---: | ---: | --- | ---: | ---: |
| PTR-32 | 2.7975 | 2.5 | None | 58 | 1.97735 |
| MK47 | 3.3830 | 2.5 | Phase Combat Foregrip | 58 | 1.53793 |

Both converge with full builds/tuning unchanged from the candidate-hinge Handling-constrained run. Validated frozen base-derived weights, candidate/default formula, trajectory span, normalized score, Handling and budget. No forced-foregrip comparison has been performed; absence of a foregrip remains a best-found outcome, not proof of its global superiority.

Artifacts: `.scratch/horizontal-optimizer-trial/run-basegate-h55.mjs` and `*-basegate-t2-w2p5-h55.json`. Production scoring remains unchanged.

## Candidate threshold 1.8: base gate reverted

Latest correction reverts the base-span gate and uses `pattern = V + H + 1.5 * max(0, H - 1.8)`. Reran Detonation full-cap Max, Thorough/16 passes, Handling minimum 55.0001. Both converge with unchanged complete builds/tuning: PTR-32 no foregrip, Handling 58, H=1.97735; MK47 Phase Combat Foregrip, Handling 58, H=1.53793. PTR-32 now has an excess H of 0.17735 (additional pattern penalty 0.266025); MK47 has zero excess. Validated candidate/default formula, trajectory span, normalized loss, Handling and budget compliance. Artifacts: `.scratch/horizontal-optimizer-trial/run-candidate-t1p8-h55.mjs`, `*-candidate-t1p8-w2p5-h55.json`. Production scoring unchanged; coordinate search is best-found only.

## PTR-32 Handling minimum 50

Latest PTR-32 constraint: Handling >=50 (MK47 unchanged). Detonation/full cap, Thorough/16 passes, candidate threshold 1.8 and 2.5x marginal weight. Best-found foregrip: Practical Vertical Foregrip (`13140000021`); effective Handling 50; H 1.65627; V 5.91900; cost 600. Search converges; default/candidate formula, trajectory span, normalized loss, Handling floor and budget verified. Artifacts: `.scratch/horizontal-optimizer-trial/run-ptr-h50.mjs`, `18010000024-h50-input.json`, `18010000024-candidate-t1p8-w2p5-h50.json`. Production scoring unchanged; best-found only.

## Production formula: candidate threshold 1.5

User requested production release with threshold reduced to 1.5; marginal weight remains 2.5x. Production Lowest Recoil now uses `V + H + 1.5 * max(0, H - 1.5)` for supported automatic base protocols. No default Handling floor. Rechecked the prior constrained examples at 16 passes/full Detonation cap:

| Weapon | Handling minimum | Achieved Handling | Foregrip | Horizontal span |
| --- | ---: | ---: | --- | ---: |
| PTR-32 | 50 | 50 | Practical Vertical Foregrip | 1.65627 |
| MK47 | 55.0001 | 58 | Phase Combat Foregrip | 1.53793 |

All 207 weapon/mode default evaluations normalize to loss 100; 108 use chart scoring, 99 retain explicitly labeled legacy fallback. Fixed 20-point scoring is independent of graph shot count; Highest Agility retains its original recoil tie-breaker. Actual-client validation remains open.


### Legacy data

The old span-based [JSON](../data/base_horizontal_spans.json), [CSV](../data/base_horizontal_spans.csv) and [transition audit](../data/horizontal_origin_audit.json) are historical evidence only. Current rankings and raw trajectories are in [horizontal_recoil.json](../data/horizontal_recoil.json).
