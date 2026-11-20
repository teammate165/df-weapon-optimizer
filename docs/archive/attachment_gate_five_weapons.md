# Five random weapons: gated Lowest Recoil vs brute force

For the commands below, restore the local bundle from `.scratch-archive/attachment-gate-five-weapons/` to `.scratch/attachment-gate-five-weapons/` and run from the repository root.

2026-11-16. Both tested attachment gates returned the **identical build and
calibration** as exhaustive search for all five randomly drawn weapons: 10/10
comparisons match, with zero recoil/Handling regret and identical cost.
This is exhaustive only within the bounded domain below.

## Sampling and common search domain

Python `random.Random(20261116).sample(pool, 5)` over all 69 catalog base weapons
sorted by weapon ID. No eligibility filtering, rerolling or outcome-based
selection. Draw order: P90 `18020000002`, Vector `18020000003`, SR-25
`18050000007`, M249 `18040000002`, G18 `18070000005`.

Each run uses Detonation and the weapon's preserved attachment cap, the current
Lowest Recoil objective (40/30/30), Handling tie-breaker, then cost and a
deterministic build/tuning identifier. Catalog `20261108-an94-bd-shop.1`, runtime
`09f820e0d3ada199`. Scoring/calculator modules and inputs are frozen and hashed.

Domain for both algorithms: every visible choice in base socket `1` (muzzle)
and `3` (stock), including leaving each at default; **all legal positions of all
equipped-stock tuning controls**. All muzzle tuning, other components and other
tuning remain at source defaults. A missing socket remains at default. Hidden
parts, rejected selections and missing-price configurations are excluded through
the source resolver/price checks. Search is bounded by the actual Detonation cap.

The brute-force reference evaluates every legal calibrated row in that domain.
Gated searches calculate their own screening samples and calibrate survivors;
they do not read the brute-force winner or reuse its evaluated rows.

Gates are the [previously tested policies](attachment_gate_trial.md):

- Default top 5% of attachment combinations.
- Sparse slider probes, top 10%, plus price-band/stat/Handling diversity.

## Outcomes and timings

Single local Node 24.22.0 runs on Windows. Times include screening/selection and
calibration, but exclude imports and pack/setup preparation. Execution order
alternates between brute-force-first and gates-first by weapon to reduce a
systematic order bias. These are not repeated or mobile/browser benchmarks.

| Weapon | Attachment combinations | Brute-force rows | Brute force | Default top 5% | Sparse top 10% + diversity | Exact build match, both gates |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| P90 | 2 | 10,202 | 1,425.6 ms | 1,312.1 ms | 1,789.0 ms | Yes |
| Vector | 21 | 43,309 | 1,001.8 ms | 45.0 ms | 332.7 ms | Yes |
| SR-25 | 160 | 200,340 | 5,245.9 ms | 167.2 ms | 705.4 ms | Yes |
| M249 | 42 | 86,618 | 16,746.2 ms | 528.0 ms | 3,540.8 ms | Yes |
| G18 | 4 | 4 | <1 ms | <1 ms | <1 ms | Yes |

Total brute-force source evaluations: **340,473**. Default top 5% retains
1/2/8/3/1 attachment combinations respectively; sparse top 10% with diversity
retains 2/7/21/13/4. P90's conservative gate retains everything, so it adds
overhead rather than accelerating search. G18 has no stock calibration in this
domain; its four-row match is trivial, and sub-millisecond timing ratios are
not meaningful.

All 15 returned rows (five weapons × three methods) replay exactly through the
frozen scoring runtime, including both objective values, stats and cost. All five
distinct winners also replay with identical cost and all four effective stats
through the separate backend evaluation bridge. The brute-force call counts
match the independently counted Cartesian slider cardinalities.

## Scoring protocol limits

P90 and M249 use the 20-shot source-chart speed-tier recoil model. The current
production preset falls back to its existing legacy recoil multiplier proxy for:

- Vector: the base magazine cannot provide the requested 20-shot protocol.
- SR-25: continuous hold is unsupported; a prescribed single/burst trigger cadence
  would be required.
- G18: the base magazine cannot provide the requested 20-shot protocol.

Both algorithms use the **same** frozen source objective and fallback for each
weapon. This experiment does not silently substitute a different firing protocol.
Reasons are captured verbatim in `report.json`.

## Meaning of the result

No missed optimum was observed among these bounded comparisons. That does not
establish the best complete weapon build, other modes, interior tuning behavior
on excluded parts, or a numerical probability of missing a future optimum.
Two of the drawn domains are very small, and three use a legacy objective.
The random draw is reproducible; it is not five independent, equally difficult
tests of the full attachment space. Gates remain heuristic outside an exhaustive
reference domain. Production optimizer and GitHub Pages deployment are unchanged.

## Reproduction and evidence

Local directory: `.scratch-archive/attachment-gate-five-weapons/`; archive branch
`experiment/attachment-gate-five-weapons-20261116` (local only).
`selection.json` contains the full sampling pool and seed. `plan.json` lists
domain sizes before execution. `report.json` contains all equipment/tuning,
objective values, times, counts, input hashes and comparisons. `progress.txt`,
`replay-js.json` and `replay-backend.json` retain verification evidence.

```powershell
python .scratch/attachment-gate-five-weapons/prepare.py
node .scratch/attachment-gate-five-weapons/run.mjs
node .scratch/attachment-gate-five-weapons/verify.mjs
python .scratch/attachment-gate-five-weapons/replay.py
```

For exact archived-model reproduction, retain archived input files and runtime
snapshots and skip `prepare.py`. Preparing again captures the current checkout's
model and may change scores if that model has changed.
