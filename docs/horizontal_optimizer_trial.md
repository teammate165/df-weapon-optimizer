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
