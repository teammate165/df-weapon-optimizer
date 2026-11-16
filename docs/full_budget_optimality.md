# Full-budget optimality checks: Detonation and Operations

2026-11-16. Follow-up to the [full-slot trial](attachment_gate_full_slots.md).
Tests cover the same five seeded weapons, every legal selectable attachment slot
and legal calibration choices. Detonation uses each weapon's original cap;
Operations uses the user-requested **5,000,000 attachment budget**, excluding the
weapon purchase price, as in the production UI.

**Result: production optimality is disproved in eight of ten cases.** P90,
Vector, SR-25 and M249 each have a better feasible build in both modes. G18
matches a guarded exact full-domain optimum in both modes. The larger-weapon
witnesses are not themselves claimed globally optimal.

The table shows **modeled recoil loss**, where lower is better. These numbers
are not measured in-game recoil percentages.

| Weapon | Detonation production → witness | Operations production → witness |
| --- | ---: | ---: |
| P90 | 44.58779723 → 32.66052901 | 44.58779723 → 32.66052901 |
| Vector | 50.75083805 → 40.09679116 | 50.75083805 → 45.00793681 |
| SR-25 | 44.37156118 → 37.62995688 | 44.37156118 → 37.62995688 |
| M249 | 22.57144868 → 19.56325886 | 22.57144868 → 18.44946173 |
| G18 | 69.10201828 = exact optimum | 64.82422828 = exact optimum |

Detonation witness costs are respectively 720/800, 860/2,000, 920/2,000 and
780/800. Operations witnesses cost 293,171, 292,124, 420,898 and 276,652, all
below 5,000,000. G18 optimum costs are 200 and 181,655 respectively.

Several witnesses have substantially worse Handling. They still outrank the
production result under the requested **strict recoil-first** preset; no
Handling floor was imposed. The evidence records both objective values and all
stats so these trade-offs remain visible. Twenty-four result rows (production,
witness and exact-reference rows) pass separate backend stat/cost and tuning
legality replay.

The baseline is the frozen production **Lowest Recoil / 12 Standard passes**
search, including its normal target searches and final Max selection. No locks
or minimum-stat floors are imposed. Comparisons use its recoil-first, Handling
second, cost-third ordering and numerical tolerance. Enabled lasers are limited
to one, risers require sights and deployed bipod effects remain OFF. Missing
quotes exclude a purchase; recorded catalog prices and provenance are preserved.

## What is being tested

A single feasible build ranked above a production result disproves optimality
for that result. Finding that witness does not require finding the global best
build. Conversely, repeated agreement with a heuristic challenger does not prove
optimality. This trial uses separate methods for these two kinds of evidence.

For the four larger weapons, a standalone challenger evaluates every compatible
one-slot replacement around each incumbent without top-5% pruning. It proposes
primary-minimizing tune settings and sweeps legal positions of ambiguous
controls. It also explores the default seed and 24 reproducible perturbation
restarts, with source-compatible riser completion. This remains a heuristic.
Every reported witness is evaluated with the **unchanged source calculator and
production scoring formula**, rather than an approximate surrogate.

The challenger changes both screening and initialization/search coverage.
Counterexamples therefore do **not** isolate top-5% pruning as the sole cause;
coordinated attachment choices and local minima can also account for differences.
No production search or live deployment is changed by this experiment.

## Exact full-domain G18 check

G18 retains the production legacy recoil-multiplier objective because its base
magazine cannot provide the required 20-shot chart protocol. That objective
reads six recoil targets and two Handling targets. Its calibration functions
never change main-stat points, reference profiles or firing schedules.

For every legal attachment configuration, the checker verifies these conditions:

- Relevant tune effects are `Mult_A` contributions with neutral defaults. Other
  targets are in an explicit whitelist unused by this legacy objective.
- For each relevant target, the kernel's resolved value is a positive-slope
  affine function of the summed tune contributions. The complete allowed tune
  range cannot cross below zero, so each recoil norm is monotone in its inputs.
- Each control has at least one legal position simultaneously minimizing all
  affected primary targets. Among these positions, a common minimum for the
  affected Handling targets also exists. A failed guard aborts certification.

Consequently one representative per configuration attains its minimum primary
loss, then minimum Handling loss. Neutral slider dimensions and positions
dominated in this ordering can be eliminated without changing the optimum.
This is an analytic reduction over the full legal calibration domain, **not**
an assumption that slider endpoints always suffice and not a claim that every
Cartesian row was executed.

The checker enumerates all attachment configurations and compares their reduced
optima. Independent raw-provider Cartesian enumeration confirms the attachment
counts and original joint-calibration cardinalities. Both modes pass:

| Mode | Budget | Legal attachment configurations | Original joint calibration rows | Production optimal |
| --- | ---: | ---: | ---: | --- |
| Detonation | 200 | 582 | 4,166,133,103,842 | Yes |
| Operations | 5,000,000 | 3,360 | 124,895,047,640,160 | Yes |

All 3,942 reduced optima replay through the frozen scorer. A supplementary 20
random joint-tuning comparisons per configuration gives 78,840 successful
dominance checks; the algebraic guards, rather than these samples alone, justify
the reduction. G18's proof applies to this finite recorded catalog, prices,
unlocked/no-floor request and legacy model, not to other weapons or client recoil.

## Evidence and reproduction

Persistent machine-readable evidence:
[full_budget_20261116.json](../data/optimizer_validation/full_budget_20261116.json).
It includes every production result and challenger witness with equipment,
calibration, objective components, effective stats, cost and budget; exact G18
results, validation records, runtime/input hashes and source revision are included.

Local runnable artifacts and frozen model/input snapshots are in
`.scratch/full-budget-validation/`. Reports are `challenge-report.json`,
`exact-g18-report.json`, `exact-verification.json` and
`backend-verification.json`; raw logs retain improvements and timings. Preparing
again captures the current checkout and prices, so retain recorded snapshots for
the measured model.

```powershell
python .scratch/full-budget-validation/prepare.py
node .scratch/full-budget-validation/exact-g18.mjs
node .scratch/full-budget-validation/challenge.mjs
node .scratch/full-budget-validation/verify-exact.mjs
python .scratch/full-budget-validation/replay.py
python .scratch/full-budget-validation/finalize.py
```

The backend bridge independently replays effective stats, costs and the legality
of every supplied tuning position. Source-model checks do not establish actual
game performance, and no optimality claim is made for Highest Agility, other
budgets, locked/floored requests or Balanced/Min category selection.
