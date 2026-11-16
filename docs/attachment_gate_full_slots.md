# Full-slot attachment gate comparison

2026-11-16. Extended the same seeded five-weapon draw to **every recursively
available attachment slot**, including sockets supplied by replacement parts.
The production top-5% optimizer matched the exhaustive full-calibration optimum
for all five weapons at a **20-point Detonation budget**. Original-cap full
joint-calibration search did not complete and is not claimed optimal.

Follow-up: [full-budget checks in Detonation and Operations](full_budget_optimality.md)
subsequently found better production-ranked builds for four weapons in both
modes and completed a guarded exact G18 calibration reduction in both modes.
The measurements below retain the scope of this earlier literal-enumeration trial.

## Domain and methods

Same draw as [the earlier trial](attachment_gate_five_weapons.md): P90, Vector,
SR-25, M249 and G18. Current source calculator and Lowest Recoil preset; catalog
and runtime provenance, input hashes and scorer hashes are in the reports.
The new trial captures the current implementation, rather than assuming the
earlier frozen scorer is interchangeable with it.

Every visible compatible source option and leaving a socket at its source
default is considered. Parent choices expose their own descendant sockets.
The source resolver enforces mounting, occupancy, forced and default components;
requested choices must survive resolution. Hidden items, missing prices, empty
risers and more than one enabled laser are excluded consistently with unlocked
production searches. Lasers are ON; deployed bipods remain OFF. No locks or stat
floors were requested. Costs include every explicitly equipped component.

The independent reference walks attachment choices without reading the optimizer
answer. For each accepted configuration it counts the Cartesian product of every
legal position of **every enabled calibration control on every mounted part**,
not just the stock. Counts use arbitrary-precision integers. Joint enumeration
evaluates those positions directly when the completed counted domain has at most
500,000 rows. It does not substitute coordinate calibration for brute force.

Production runs independently with its real top-5% neighborhood gate, eight
passes, coordinate tuning and normal Max/Balanced/Min generation. Comparisons
use Max: lexicographic recoil, Handling, then cost, with the production numerical
tolerance. Equal-value alternative equipment is accepted as an optimal tie.
Balanced/Min category optimality is not tested. A separate production run fixes
all calibration to defaults for a like-for-like attachment-only comparison.

## Completed full-slot and full-tuning comparisons

All sockets remain eligible, but the 20-point cap excludes most expensive parts
and simultaneous purchases. These are easier constrained cases, not substitutes
for the original caps. Both forward and reversed sibling enumeration orders
complete and agree on attachment counts, tuning cardinalities and optimal values.

| Weapon | Attachment configurations | Joint calibrated rows | Production matches optimum |
| --- | ---: | ---: | --- |
| P90 | 21 | 25,251 | Yes |
| Vector | 24 | 25,254 | Yes |
| SR-25 | 51 | 25,281 | Yes |
| M249 | 21 | 25,251 | Yes |
| G18 | 9 | 6,669 | Yes |

Total: **107,706 exhaustive rows per enumeration order**, 5/5 optimal-value
matches. All five distinct exhaustive winners replay with exact four-stat and
cost equality through the separate backend bridge. Existing firing-protocol
limitations/fallbacks remain; the experiment does not invent a new protocol.

## Original-cap attempts

Each attachment walk was allowed 30 seconds, with a separate 100,000-configuration
guard. Every result below stopped for time except G18, which completed. These
are single observations and partial walks are traversal-order dependent.

| Weapon | Cap | Accepted configurations visited | Joint tuning rows represented | Attachment walk complete |
| --- | ---: | ---: | ---: | --- |
| P90 | 800 | 38,712 | 2,973,997,730,522,592 | No |
| Vector | 2,000 | 86,621 | 70,460,049,944,621 | No |
| SR-25 | 2,000 | 93,775 | 93,775 | No |
| M249 | 800 | 29,971 | 55,344,022,675 | No |
| G18 | 200 | 582 | 4,166,133,103,842 | Yes |

For incomplete walks, counts are **lower bounds**, not full-domain sizes.
In particular, the SR-25 prefix visits uncalibrated accessory combinations before
reaching tunable purchases; its count does not mean SR-25 lacks calibration.
The production results beat the visited default-tuned prefixes for the four
incomplete walks; this says nothing about unseen configurations.

For G18, the default-calibration production search matches the exact best among
all 582 legal attachment configurations. An independent Cartesian enumeration
of raw-provider options checks 3,360 syntactic selections, then applies source
rejection and policy filters, reproducing both the 582 count and the joint tuning
cardinality. Production with tuning improves on the default-only optimum, but
the **4.17 trillion-row full-tuning domain was not enumerated**.

Literal calibration counts can include objective-equivalent settings. They are
not a proof that an exact solver must visit every row; validated equivalence
reduction or sound bounds might reduce the work. Neither is established here.

## Reproduction and limits

Local artifacts: `.scratch/full-slot-gate/`. `report.json` records original-cap
attempts; `budget20-report.json` and `budget20-reverse-report.json` record completed
joint comparisons. `verification.json` records backend replay/order checks and
`g18-independent-count.json` records the independent count. Logs retain timings.

```powershell
python .scratch/full-slot-gate/prepare.py
node .scratch/full-slot-gate/run.mjs
$env:BUDGET = '20'
$env:REPORT = 'budget20-report.json'
node .scratch/full-slot-gate/run.mjs
$env:ORDER = 'reverse'
$env:REPORT = 'budget20-reverse-report.json'
node .scratch/full-slot-gate/run.mjs
Remove-Item Env:BUDGET, Env:ORDER, Env:REPORT
python .scratch/full-slot-gate/verify.py
node .scratch/full-slot-gate/verify-g18.mjs
```

Preparation refreshes inputs/runtime from the current checkout. Retain recorded
inputs for the measured catalog. Scripts import project scorer modules; recorded
hashes must match for exact scored-model reproduction. Time-limited prefix counts
vary by hardware and load. Later script revisions add safe prefix-cost pruning,
so original partial-walk counts also need not reproduce exactly.

No production files or live deployment were changed. The warranted claim is
optimality within the completed recorded constrained domains. Full-weapon
optimality at original caps, all modes, all presets and category correctness
remain open.
