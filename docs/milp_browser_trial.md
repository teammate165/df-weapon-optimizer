# Bounded M4A1 browser MILP trial

2026-11-16. An exact finite-table MILP works in a single-threaded browser Worker
on plain static hosting. All eight scenarios match exhaustive enumeration and
the six returned builds replay through the backend calculator. This is a
bounded correctness experiment, not a replacement for the production search.

## Declared domain

- M4A1 `18010000001`, Detonation `bd`, preserved catalog
  `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`.
- Socket `1`: all nine visible muzzle choices plus no selected attachment;
  muzzle calibration stays at default.
- Socket `3`: all visible stock choices, with every legal position of each
  stock's first calibration control, plus no selected stock. This gives 307
  stock/tuning options. All remaining stock calibration stays at default.
- Every other socket stays at its source default. Resolver dependencies still
  apply. No hidden Detonation parts or missing/invalid price rows are admitted.
- All 10 × 307 = 3,070 combinations resolved successfully; none was rejected.

The source calculator evaluates the actual pattern/camera/kick components,
40/30/30 weights, horizontal-speed tiers and Handling objective for every row.
No independent attachment-benefit sum or piecewise approximation is substituted.
Module hashes and snapshots capture the scoring code actually tested, including
local working-copy changes present during this experiment. This is not a
game-client validation claim.

## MILP formulation and guarantee

The encoder is [tools/milp_finite_table.mjs](../tools/milp_finite_table.mjs).
Each complete configuration has a binary variable. Exactly one must be selected;
an integer-price constraint enforces budget. Rows violating a stat floor or
requested attachment lock have upper bound zero.

Rows are ordered by the existing recoil/Handling lexicographic comparison,
then cost, then a deterministic row identifier. The objective is the row's
integer ordinal rank. The encoder checks every pair for ordering inversions
and refuses to rank a domain with inconsistent relative-tolerance comparisons.
Thus minimizing rank preserves the declared policy in this enumerated domain,
without rounding recoil coefficients inside the MILP.

Reported primal/dual bounds and zero gap refer to **ordinal rank**, not physical
recoil units or a full-weapon recoil bound. The table values inherit the source
calculator's floating-point semantics. SCIP is still a numerical solver; this
is not an exact rational certificate. Independent enumeration verifies the
selected optimum or infeasibility in each finite fixture.

## Browser observations

SCIP 10.0.2 / SoPlex 8.0.2, Chrome `157.0.8103.79`, Windows;
`crossOriginIsolated=false`, no special headers, no backend requests, no page
errors and zero solver errors. Bundle provenance and notices are retained from
the [previous WASM trial](scip_wasm_feasibility.md).

| Case | Eligible rows | Result | Load + solve time |
| --- | ---: | --- | ---: |
| Budget 800, full declared domain | 3,070 | Optimal `a008_b065` | 123.0 ms |
| Budget 0 | 1 | Optimal default build | 93.3 ms |
| Budget 100 | 460 | Optimal `a000_b166` | 98.4 ms |
| Four stat floors | 1,604 | Optimal `a008_b065` | 98.7 ms |
| Muzzle `13030000109` locked | 307 | Optimal `a001_b065` | 94.6 ms |
| Stock `13040000104` locked | 70 | Optimal `a008_b007` | 92.7 ms |
| Control floor 10,000 | 0 | Infeasible | 86.6 ms |
| Lock on an optic outside this domain | 0 | Infeasible in this domain | 81.3 ms |

The best unrestricted row in this bounded domain equips muzzle `13030000187`
and stock `13040000113`, stock position `98`, cost 240. Its recoil loss is
62.55928451612903 and Handling loss is 111.30103038886277. It is not asserted to
be the best full M4A1 build. All six successful browser outputs replay with exact
equality for every recoil component, both objectives, costs and all four stats.

These are single observations, not performance guarantees for mobile devices.
Table evaluation took approximately 700 ms locally, separate from browser solve
times; JSON table size is about 2.37 MB. Encoding took roughly 27–33 ms per case
in the preceding measured run. A direct exhaustive table filter/sort took about
0.08–1.03 ms per case once scores existed, so MILP adds overhead for this encoding.

## Scaling verdict

This experiment has already enumerated and scored every candidate before SCIP
starts. It therefore does not yet demonstrate a faster global search. The
nominal Cartesian size for all tuning controls on these same two sockets alone
is 91,810 × 30,235 = **2,775,875,350** rows. That is a count derived from contextual
slider positions, not an evaluated claim that all those combinations are legal.
It excludes the other sockets entirely.

Do not expand this full-build table blindly. The next research task is a compact
exact formulation with shared intermediate stat states and small factor tables,
proving equivalence for stacking, response curves, profile changes, norms and
speed-tier boundaries. Whether that can avoid state explosion remains open.
A heuristic shortlist would prove only its shortlist. No production optimizer,
category policy or GitHub Pages deployment changed during this trial.

## Reproduction and artifacts

Local experiment: `.scratch/milp-trial/`. Archived on local branch
`prototype/milp-browser-trial-20261116` with its input pack, scorer/calculator
snapshots, WASM bundle, licenses and raw evidence; no remote publication.

To regenerate using the **current checkout's model** (requires the local database,
prepared source runtime and prior pinned WASM bundle):

```powershell
python .scratch/milp-trial/prepare.py
node .scratch/milp-trial/build.mjs
node .scratch/milp-trial/browser-check.cjs
node .scratch/milp-trial/replay.mjs
python .scratch/milp-trial/replay.py
node tests/milp_finite_table.mjs
```

To reproduce the archived model, retain its input and runtime snapshots and
start with `build.mjs`, skipping `prepare.py`. Browser collection uses the existing
Playwright installation in `.scratch/browser-qa/node_modules/`. The demo itself
needs no dependencies or backend API:

```powershell
python -m http.server 8772 --bind 127.0.0.1 --directory .scratch/milp-trial
```

Open `http://127.0.0.1:8772/index.html`. Choose a scenario and solve; Cancel
terminates the Worker. `build-summary.json`, `browser-result.json`,
`replay-result.json` and `score-replay-result.json` contain the recorded evidence.

The focused regression covers recoil/Handling/cost ordering, lock and floor
predicates, zero-cost rows, invalid inputs and nontransitive tolerance cycles.
The original production search has not been changed or revalidated by this trial.
