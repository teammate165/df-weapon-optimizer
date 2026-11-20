# Attachment screening before calibration

For the commands below, restore the local bundle from `.scratch-archive/attachment-gate/` to `.scratch/attachment-gate/` and run from the repository root.

2026-11-16. A bounded M4A1 trial found substantial savings from screening whole
attachment combinations before enumerating calibration. All 42 feasible
gate/scenario comparisons retained the exhaustive optimum in this fixture.
Seven comparisons with an impossible stat floor returned no feasible build.
This is empirical evidence for a heuristic, not a general optimality guarantee.
Production search and the public site are unchanged.

## Exact reference domain

M4A1 `18010000001`, Detonation `bd`, all visible muzzle and stock choices,
including leaving either socket at default: **170 attachment combinations**.
Both stock calibration controls vary over every legal source position. Muzzle
calibration and every other component/tuning remain at default. The complete
reference evaluates **302,350 calibrated builds**. This expands the previous
[MILP trial](milp_browser_trial.md), which varied only the first stock slider.

The source resolver enforces the mounting rules in this domain. Hidden parts
and missing/invalid price combinations are excluded before screening. The
preserved calculator provides the current 40/30/30 recoil objective, speed tiers,
Handling tie-breaker, costs and effective stats. Catalog version is
`20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`; input and module hashes are
recorded with frozen runtime/scorer snapshots. This does not establish accuracy
against the game client.

Seven requests exercise budgets 800/100/200, four simultaneous stat floors,
a Handling floor of 62, locked stock `13040000104`, and an impossible Control
floor. The constrained exhaustive reference is computed independently of
screening. Screening never consults the calibrated optimum.

## Gates implemented

[tools/attachment_gate.mjs](../../tools/attachment_gate.mjs) selects whole attachment
combinations from source-evaluated samples. It is an experimental helper, not an
option in the production optimizer.

- **Default top 5% / 10%:** rank default-tuned combinations, then calibrate the
  retained fraction completely.
- **Sparse probes:** evaluate defaults, each slider's minimum/midpoint/maximum
  individually, and joint corners. Duplicate/default samples are deduplicated.
- **Diversity:** retain the best sampled candidate in each 40-cost price band,
  sampled champions for requested minimum stats, and a Handling champion.
- **Threshold:** retain combinations whose best sampled loss is within 2 or 5
  normalized loss points of the best sampled candidate, plus a 1% minimum seed
  and diversity candidates. These are percentage points of normalized loss,
  not a relative percentage of recoil improvement.

Budget and attachment locks apply before sampling. Stat-floor violations rank
samples but do not themselves exclude a combination: calibration could recover
feasibility. The best sample is chosen by violation, recoil/Handling priority,
cost, then deterministic ID. Threshold comparisons use that same violation
level. These are heuristic choices, not optimistic bounds on future tuning.

Calibration reuses evaluated probe points. A progressive demo mode widens sparse
probe gates through 5%, 10%, 25%, 50%, and 100%, retaining completed combinations
and never recalibrating them. Stable answers at consecutive levels do not trigger
automatic early stopping. Only the 100% endpoint exhausts this declared domain.

## Measured Node search times

Single observations on this Windows workspace, Node `24.22.0`. Gates include
screening, selection and calibration; module loading/setup is excluded. Separate
single-request exhaustive baselines were measured after the gated runs. The
initial oracle also evaluates multiple constraint cases per row, so its timing
is not used for the speedup figures below. Warm-up/order/hardware effects remain.

| Request | Exhaustive | Default top 5% | Sparse top 10% + diversity | Sparse within 5 points + diversity |
| --- | ---: | ---: | ---: | ---: |
| Budget 800 | 59.06 s | 1.65 s (**35.7×**) | 8.65 s (**6.8×**) | 7.23 s (**8.2×**) |
| Budget 100 | 9.98 s | 1.87 s (**5.3×**) | 5.09 s (**2.0×**) | 5.57 s (**1.8×**) |
| Four stat floors | 66.55 s | 3.63 s (**18.3×**) | 15.53 s (**4.3×**) | 11.87 s (**5.6×**) |

For budget 800, default top 5% retains 9/170 combinations and requires 7,130
source evaluations including screening/reuse, versus 302,350 exhaustive calls
(*42.4× fewer*). Sparse top 10% plus diversity retains 22/170, using 36,914 calls
(*8.2× fewer*). Different combinations have different calibration grid sizes,
so call savings need not equal the inverse retained fraction.

All 49 combinations of seven gate settings and seven requests matched the
reference result/absence of a feasible result. No nonzero recoil or Handling
regret was observed. Six successful constraint-case winners replay through the
independent backend bridge with exact cost and four-stat equality. Nine timed
gated searches reproduce the independently diagnosed winning builds and exact
evaluator-call counts. Focused regression includes a synthetic ranking reversal
that an aggressive gate misses; that explicitly demonstrates the absence of
a general guarantee even though this real fixture had no misses.

Browser verification also passes in Chrome `157.0.8103.79`, without special
headers (`crossOriginIsolated=false`) or page errors. Budget-100 live Worker
searches took 1.02 s for default top 5%, 2.37 s for sparse top 10% plus diversity,
and 6.25 s for exhaustive calibration. All selected the same reference winner.
Progressive widening took 6.86 s through its 100% endpoint; its total 45,760
evaluations exactly match the budget-100 exhaustive count. Earlier progress
checkpoints retain 4, 5, 7 and 11 combinations before all 18 at 100%. Setup and
module loading are excluded from these search times. They are single runs.

## Interpretation and limits

This experiment supports trying gates for a **best-found** optimizer. The most
aggressive gate is fastest here, but the fixture is small in attachment variety,
includes only one weapon/mode, and fixes every muzzle slider and all other slots.
It does not cover profile-changing parts, optic dependencies, multiple lasers,
all-price-category selection, or full-weapon coordinated swaps. These successful
cases do not establish that sparse probes see every interior calibration optimum.

The gate still needs to enumerate and sample whole attachment combinations;
it does not solve the combinatorial cost of generating every full-weapon setup.
The experiment directly selects the best calibrated survivor rather than adding
MILP overhead to that finite set. A future MILP over survivors could prove only
the restricted survivor domain unless discarded combinations have valid bounds.

Sampled-stat/price diversity preserves useful alternatives but does not prove
Cheapest or Balanced category correctness. Results without a feasible survivor
must say **no feasible build found**, not claim full-space infeasibility.
Progressive widening can return a usable candidate early; repeated agreement
between levels is not an optimality certificate.

## Reproduction and review

Local experiment `.scratch-archive/attachment-gate/`; archived on local branch
`prototype/attachment-gate-20261116` with inputs, runtime snapshots, scripts,
demo and results. No remote publication. Recompute with current source using:

```powershell
python .scratch/attachment-gate/prepare.py
node .scratch/attachment-gate/run.mjs
node .scratch/attachment-gate/time-baselines.mjs
node .scratch/attachment-gate/browser-check.cjs
python .scratch/attachment-gate/replay.py
node tests/attachment_gate.mjs
```

For archived-model reproduction, retain archived input/runtime snapshots and
skip `prepare.py`. Existing local Playwright is required only for browser QA.
`report.json` contains all 49 comparisons, measured runs and separate baselines;
`oracle.json` contains per-combination optima, not every calibrated row.
`progress.txt`, `baseline-progress.txt`, `browser-result.json` and
`replay-result.json` retain execution evidence.

The browser demo performs live source calculations in Workers, without a backend
or precomputed winners guiding selection. Serve it with:

```powershell
python -m http.server 8773 --bind 127.0.0.1 --directory .scratch/attachment-gate
```

Open `http://127.0.0.1:8773/index.html`. Select constraints and a gate, a complete
reference search, or progressive widening. Cancel terminates the Worker.
