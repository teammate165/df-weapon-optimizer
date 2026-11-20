# Reducing the M4A1 ordinary domain below one million

2026-11-17. Same fixture as the [completed exhaustive scan](m4a1_exhaustive_screening_feasibility.md): M4A1, Detonation, 800-point attachment cap, Insight 3/7 (`13110000091`) locked at optic slot `11`, ordinary attachments at default calibration. Baseline **12,885,654** grouped layouts. Getting strictly below one million requires removing **92.24%**, a little over a 12.89x reduction.

These are read-only count experiments. No production grouping, objective, tuning, mounting or selection policy was changed.

## What the exact counter says

| Experiment | Counted layouts | Interpretation |
| --- | ---: | --- |
| Current production grouping | 12,885,654 | Completed baseline domain |
| Broader full-source-effect grouping of eligible ordinary leaf parts | 12,880,006 | Only 0.044% fewer; candidate rule still needs source/context validation |
| 4 stock choices, 3 rear-grip choices | 881,849 | Heuristic shortlist; all foregrips remain eligible |
| 4 stock choices, 3 paid foregrips plus empty | 547,502 | Heuristic shortlist; all rear grips remain eligible |
| 3 stock choices, 3 paid foregrips plus empty | 422,055 | More restrictive heuristic shortlist |

![Exact counts for candidate reductions](../../data/optimizer_validation/m4a1_layout_reduction_20261117/reductions.png)

Stock and rear-grip counts include the no-explicit-purchase/default choice. That choice does not physically remove a bundled/default weapon component. Foregrip experiments explicitly preserve empty in addition to the paid choices. All three sub-million examples retain the exact best **ordinary/default-calibration** build from the full scan. This is membership in the restricted domain, not proof that the shortlists preserve the calibrated winner, budget/quality frontier or original top-5% survivors.

The illustrative lists are chosen using the best observed primary default-screening loss for each choice in the earlier 102-partition scan. Ties follow deterministic source order. They are not an independently established top-N attachment ranking or Pareto frontier; ranking a part by its best favorable surrounding build can favor expensive choices and overlook cheaper tradeoffs.

Specific counted choices:

- **Four stock choices:** no explicit purchase/default; UR Spec Ops Tactical Stock `13040000110`; Invasion Core Stock `13040000108`; 416 Light Stock `13040000112`. The three-choice experiment omits the last item.
- **Three rear-grip choices:** no explicit purchase/default; Invasion Rear Grip `13030000112`; AR MOE Rear Grip `13030000187`.
- **Three paid foregrips:** Daybreak Vertical Flashlight Grip `13140000041`; Dawn Angled Flashlight Grip `13140000042`; Resonant MK III Grip `13140000044`, plus empty.

The conservative additional-equivalence prototype examines only leaves without source mounting/fire-control dependencies, bound ammunition, child sockets or scored calibration. It groups matching ordered source operations, retains a compatible minimum-cost representative, and leaves locked identities alone. Existing grouping has already captured most easy duplicates. This result does not prove that no stronger exact equivalence exists. A more speculative objective-target-filtered variant reaches only **12,878,568** and also needs dependency validation; it is not an answer to the one-million target.

## Recommended exact-preserving investigation

**Start with calibrated, context-aware dominance; then merge equivalent partial states before expanding combinations.** The numerical target is not yet proven attainable with those rules, so do not advertise a guaranteed sub-million exact domain from this experiment.

1. **Dominance within a mounting context.** Compare choices only when their future sockets, bundled replacements, occupancy, tactical capacity and identity-lock behavior match. A removable choice must have a replacement with no greater cost and no worse relevant outcome throughout the permitted tuning domain and later compatible additions. Include minimum-stat requirements when present, the native recoil objective, its Handling tie-breaker and the cost/quality alternatives. Keep a choice when the proof is unsupported. Higher Control alone is insufficient: Stability contributes camera recoil, source curves and rounding matter, and calibration can reverse a default-only ranking.
2. **Merge partial build states with the same future behavior.** Key by remaining legal choices, source reference/profile/fire-control state, unrounded numeric operation state and folding order, tactical capacity and calibration capabilities. Do not key only by displayed Control/Handling/Stability: equal rounded stats need not stay equal after another attachment or tuning step. For an optimization frontier, retain the cheapest equivalent reconstruction or all needed nondominated cost/quality alternatives. Concrete configurations and locked IDs must remain reconstructable. This is a proposal to test against the native calculator, not an implemented certificate. A related exact-search approach is described in [decision-diagram branch-and-bound with cached dominance/suboptimality thresholds](https://arxiv.org/abs/2211.13118); its published results are not measurements of this project.
3. **Keep screening semantics explicit.** Removing a dominated configuration can preserve a best solution while changing an exact top-K or top-5% list. If the contract remains the original best 5% of layouts, use multiplicities/backpointers or proven cutoff bounds that preserve the original ranked population. One better replacement does not by itself justify removing a member of a top-644,283 set. Default-calibration dominance also does not establish dominance after calibration.
4. **Validate on this finished baseline.** Reconcile counted domains and reconstruction, replay all discarded/replacement pairs in affected contexts and legal tuning positions, preserve locks/floors/tactical compatibility, and compare selected outputs and known complete calibrated incumbents. Measure full screening wall time and survivor-memory requirements separately from the number of scored groups.

Score caching and conservative branch bounds can reduce work without reducing the literal domain. Report a target of fewer than one million **source evaluations** separately from a target of fewer than one million **grouped layouts**. The previous exhaustive scan makes the latter denominator available; do not relabel cached evaluations as distinct configurations.

## Practical choice

For an immediate, explicitly heuristic fast mode, the **881,849-layout** rear-grip/stock example meets the target while leaving all foregrip choices open. It retains the known ordinary winner, but it needs calibrated/tactical comparisons before being recommended as a default restriction. At the old aggregate throughput, its enumeration alone would project to roughly 43 seconds; that is a rough projection, not a measured new runtime.

For preserving exhaustive optimization guarantees, the next prototype is dominance and partial-state merging, with the exact baseline retained as a fallback. Reaching a numerical cap by fixed slot shortlists changes the search promise and should remain a visibly named restricted mode rather than silently replacing the exhaustive domain.

## Reproduction

`node tools/analyze_layout_reductions.mjs` reproduces all counts using the existing source runtime/catalog. It asserts that the baseline is still 12,885,654, records the concrete shortlisted IDs, and verifies that the known ordinary best configuration belongs to each restricted domain. Results are deterministic counts, so confidence intervals and statistical significance tests are not appropriate.

[Machine-readable counts](../../data/optimizer_validation/m4a1_layout_reduction_20261117/counts.json), [code/data hashes](../../data/optimizer_validation/m4a1_layout_reduction_20261117/provenance.json), [PNG chart](../../data/optimizer_validation/m4a1_layout_reduction_20261117/reductions.png), [SVG chart](../../data/optimizer_validation/m4a1_layout_reduction_20261117/reductions.svg).


Implemented follow-up (2026-11-18): the [opt-in dominance prototype](m4a1_dominance_prototype.md) reaches **1,696,710** layouts with source/tuning validation and a completed reduced sweep. It has not reached one million and does not preserve the original top-5% population by certificate.
