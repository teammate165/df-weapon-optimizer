# Category rules and calibrated G18 reference

The category rules below supersede the fixed threshold and linear utility used in the [initial research prototype](problem_definition.md). All three results use the selected budget. For recoil, performance means improvement over the stock build in native modeled loss points. For the normalized recoil preset this is G = 100 − loss.

- **Maximum Performance** maximizes G. On an exact gain tie, prefer the cheaper build.
- **Minimum Acceptable** minimizes attachment cost among builds with G ≥ 0.5 × the maximum achievable G. On a cost tie, prefer the larger gain.
- **Balanced** maximizes G / cost among builds with positive gain. Positive gain at zero cost takes precedence, with the larger gain preferred. A 0/0 default has no meaningful ratio. When nothing improves on stock, the reference reports no Minimum Acceptable or Balanced upgrade. Outputs may coincide.

For the current full ordinary M4A1 research solver, Balanced uses a strict price window between the two certified endpoint builds and maximizes gain per point within it. The unrestricted Balanced rule above describes the historical reference runs. [Current rule and evidence](#strict-balanced-price-window).

The current exact M4A1 solver and the builder automatic optimizer use a 60% Minimum Acceptable threshold. The exact search uses the proven attainable gain and the anytime optimizer uses the best gain found. The following benchmark sections preserve their original thresholds. [Current results](#minimum-acceptable-at-60-percent).

## Reference results

| G18 mode and budget | Maximum cost / gain | Half-max gain | Minimum cost / gain | Balanced cost / gain |
| --- | ---: | ---: | ---: | ---: |
| Detonation, 200 points | 200 / 30.8980 | 15.4490 | 80 / 20.2041 | 80 / 20.2041 |
| Operations, 5,000,000 | 142,335 / 35.1758 | 17.5879 | 27,323 / 20.2041 | 3,227 / 3.0903 |

The Operations maximum uses the lower-cost witness at the same primary loss. The earlier trial broke primary ties by Handling before cost. Balanced can fall below half-max because the threshold belongs to Minimum Acceptable.

Run `node docs/optimization/g18-reference.mjs` against the frozen inputs and certified configuration files from the [prior G18 study](../full_budget_optimality.md#evidence-and-reproduction). The script enumerates every legal UI slider tuple on a restricted stock/two-muzzle fixture, **20,403 tuples per mode**, and checks the native minimum of each tuned layout and all three category values against the analytically reduced reference. It also replays all **582 Detonation and 3,360 Operations** certified layout representatives through native mount, tune, cost and recoil evaluation. Since the G18 guard establishes that each representative maximizes gain at its fixed attachment cost, the same representatives suffice for all three category values. Full-domain coverage relies on the prior study's recorded mount enumeration and guarded reduction. These results apply to that frozen domain.

## Certificate implications

The cheapest threshold depends on the true maximum. If Max currently has a feasible gain L and a proved upper bound H, the true threshold lies in [L/2, H/2]. A build qualifying at H/2 is certainly acceptable. The cheapest cost at L/2 gives a lower bound on true minimum cost if that relaxed search is certified. When the incumbent's cost matches the cost lower bound, the cheapest feasible cost is proven even before Max closes. A simpler first implementation can certify Max and then solve Cheapest with the fixed threshold, or keep an archive of nondominated gain/cost pairs for this lookup. On timeout, distinguish a result relative to the current best gain from one certified against the achievable maximum.

For Balanced, a subtree with gain upper bound H and strictly positive cost lower bound C has efficiency at most H/C when H > 0. If C is zero, check zero-cost improvements or use an unrestrictive bound. Nonpositive gain cannot win the positive-upgrade query. Apply conservative floating bounds before pruning or claiming exact ties.

[The joint research driver](category-search.mjs) now tracks the three outputs, a nondominated archive and bounds over the live frontier. The G18 runner verifies complete results and forced stops at 0, 1, 10, 100 and 1,000 visited nodes on both the exhaustive small fixtures and the certified full layout references. It also checks an expired clock, exact half-max equality, a positive zero-cost upgrade, an over-budget contender and a stock-only case.

The G18 adapter builds its tree from evaluated reference rows. This validates the category logic and interruption certificates on native values. It does not measure search savings or prove bounds from a partial mount or slider assignment. The next step is a lazy native mount/calibration adapter with admissible bounds computed before native evaluation, then an end-to-end browser deadline test.

## First native test without a deadline

The same runner now performs a separate lazy search on the stock/two-muzzle fixture. It resolves each layout and generates legal slider branches as needed. Before a complete tuple is scored, the node uses its fixed layout cost and the stock loss as an upper bound on gain. The latter follows from the legacy recoil score being a weighted sum of nonnegative norms. The lazy search compares all three category values against the independent exhaustive result.

| Mode | Native tuned evaluations | Nodes visited | Observed lazy search time | Outputs certified |
| --- | ---: | ---: | ---: | ---: |
| Detonation | 20,402 | 41,010 | 395 ms | 3 of 3 |
| Operations | 20,402 | 41,010 | 462 ms | 3 of 3 |

Stock is scored separately as the baseline. The search exhausted both frontiers with no node or time cutoff. These are single Node timings for the restricted fixture. The loose bound saved zero tuned evaluations. Stronger bounds and lazy mount traversal over the full catalog are the next experiments.

## Guarded calibration bound

For the frozen G18 legacy recoil objective, each unfinished slider is completed with a legal position that minimizes every one of its ordered primary recoil contributions. The runner requires a common minimum, neutral defaults, an explicit whitelist for irrelevant targets, and nonnegative resolved slopes with a positive multiplier margin. The optimistic tuple is scored with the native evaluator. A cache reuses scores when different prefixes lead to the same optimistic tuple. Every generated bound is checked against the true best gain for that prefix from an independent exhaustive pass. That pass is validation work and is excluded from the search timings.

| Mode | Native evaluations, loose → guarded | Visited nodes, loose → guarded | Observed Node time, loose → guarded |
| --- | ---: | ---: | ---: |
| Detonation | 20,402 → 202 | 41,010 → 206 | 429 ms → 4.17 ms |
| Operations | 20,402 → 202 | 41,010 → 206 | 442 ms → 3.59 ms |

Both searches ran without a deadline and certified all three results against the oracle. The guarded count includes all native evaluations made to construct bounds. Timings are single local observations and exclude fixture preparation, guard construction and exhaustive validation. This is a restricted legacy-score result. The guards have not been tested on every G18 layout in this lazy driver, and the bound does not cover chart-based speed tiers. Next, add lazy mount traversal and validate the calibration guard across the full frozen G18 population.

## Full frozen G18 mount traversal

The deadline-free driver now resolves mount choices as it traverses the frozen G18 domain. After mount resolution it applies the calibration guard and scores one legal minimizing tuning tuple per layout. It reconciles every layout identity, cost and primary loss with the certified reference and checks all three category values.

| Mode | Legal layouts and native tuned evaluations | Search nodes | Latest local Node time |
| --- | ---: | ---: | ---: |
| Detonation, 200 points | 582 | 1,314 | 131 ms |
| Operations, 5,000,000 | 3,360 | 7,333 | 892 ms |

The observed times include mount resolution, calibration guards, native scoring and output certification. They exclude the separate oracle replay and small exhaustive test. Every legal attachment layout in this frozen study was scored once. The reduction comes from calibration. The driver retains the frozen study's partial affordability and legality filters, and the legacy recoil guard does not cover chart-based objectives. The next extension is a chart-scored fixture with independently validated completion bounds.

## Deadline-free M4A1 chart fixture

The fixture contains stock and four single-muzzle layouts for M4A1 Detonation at 200 points. One recoil-affecting slider per muzzle varies across all 101 legal UI positions. Other controls remain at default. The native preset uses its 20-shot ADS chart and 200 ms speed tiers. The exhaustive oracle scores all 405 stock and calibrated tuples before the paired comparison.

The bounded driver constructs the native tuned kernel state for each tuple and asks the existing chart screening helper for a lower loss bound. Subtracting that lower bound from stock loss gives an optimistic gain. The experiment checks every such gain bound against the oracle, falling back to the stock-loss bound if the helper cannot handle the state. All 404 tuned bounds passed and none required fallback. This is a bound for a fully specified tune tuple. It still visits all slider positions and constructs every tuned kernel state.

| Variant | Full tuned score calls | Chart bound calls | Search nodes | Node median / worst |
| --- | ---: | ---: | ---: | ---: |
| Loose gain bound | 404 | 0 | 814 | 127.9 / 138.2 ms |
| Chart loss bound | 2 | 404 | 412 | 31.4 / 39.5 ms |

Each variant ran seven measured times after a warm-up pair, alternating order. The chart timings include the per-tuple oracle assertions and exclude construction of the exhaustive oracle. All runs matched the three exact reference values. Maximum gained 17.1856 modeled recoil-loss points at 120 points. Minimum Acceptable and Balanced both gained 16.2349 at 40 points. The observed speedup is for this restricted Node fixture.

Run from the root after preparing the same calibration runtime and static catalog as `tests/scoring_bounds.mjs`. [Runner](m4-chart-reference.mjs), [raw samples and fixture IDs](m4-chart-data.json).

A chart-aware bound over several still-unassigned sliders is the next test. It needs to cover sign changes, threshold crossings and reference or timing changes before it can prune whole calibration subtrees.

## M4A1 two-slider groups

The deadline-free two-slider test varies both muzzle weight and thickness across all 101 legal positions on each of the same four M4A1 layouts. For this source snapshot, the thickness functions affect only ADS time and movement sway through Mult_A. Neither target enters the primary chart loss or build price. With no stat floor or Handling tie-break in these three queries, each fixed-weight group can therefore use its legal default-thickness representative. The guard checks the declared target and modifier list. It applies to these fixtures and this category contract.

The independent native oracle scored all **40,804 tuned tuples** plus stock. At each weight it checked exact gain equality across all thickness positions. The grouped solver built **404 tuned states**, computed a chart bound per state, and ran **two full tuned scores**. All three outputs matched the exhaustive oracle. Seven Node runs after warm-up had a median of **43.5 ms** and a worst of **44.9 ms**. The separate native oracle took **12.56 s** in this run. The timings exclude fixture setup and the grouped timings exclude exhaustive validation.

This test bypasses 40,400 tuned state constructions by removing a score-invariant dimension. It still enumerates every weight position. Bounds for multiple score-affecting sliders, including boxes crossing a horizontal speed tier, remain open. A Handling tie-break or a floor affected by thickness would require accounting for thickness in the state.

Reproduce with `node docs/optimization/m4-chart-slider-groups.mjs` from the repository root using the same pinned runtime and catalog as the one-slider test. [Runner](m4-chart-slider-groups.mjs), [raw samples](m4-chart-slider-groups.json).

## Two recoil-affecting sliders across a chart tier

The deadline-free M4A1 fixture pairs barrel 13020000350 with muzzle 13030000109 and barrel 13020000351 with muzzle 13030000113. The Detonation budget is 200. Both weight sliders have 101 legal positions, both change the native score, and both layouts cross between horizontal multipliers 4 and 1 as muzzle weight varies. Other controls remain at default.

The source guard checks that barrel weight writes additive multiplier contributions to the two gun-kick targets and an unrelated movement-speed addend, while muzzle weight writes to the chart axes and breath scale. It checks neutral barrel defaults, nonnegative resolved kick values, and a single legal barrel setting that minimizes both ordered kick contributions. For each fixed muzzle position, that setting minimizes the nonnegative kick norm. The chart and its tier are computed for that muzzle position, so the solver can bound a group without assuming the tier is constant across muzzle positions.

The independent exhaustive pass checked **20,402 tuned tuples** plus stock. The barrel representative matched the exact best native score at every muzzle position. The complete grouped search built **202 tuned states**, computed 202 chart bounds, and called the full tuned scorer twice. All three outputs were certified against the oracle. They coincide at **160 points** and **20.1750 modeled recoil-loss points of improvement** in this fixture. Seven warm Node searches had a **21.1 ms median** and **22.1 ms worst**. The exhaustive oracle took **3.64 s**. Search timings exclude fixture and guard setup and exhaustive validation.

This reduction uses separability between chart axes and the kick norm. It still enumerates all muzzle positions. When two unassigned controls both affect chart axes, timing, or the same conditional operation, this guard cannot certify the group. Bounding those interacting controls remains open.

Reproduce with `node docs/optimization/m4-chart-tier-groups.mjs` from the repository root. [Runner](m4-chart-tier-groups.mjs), [raw samples](m4-chart-tier-groups.json).

## Shared chart-axis slider bounds

The deadline-free Detonation fixture pairs muzzle 13030000109 and stock 13040000104 at a combined cost of 80 points under a 200-point budget. Each weight slider has 101 legal positions and changes both horizontal and vertical recoil. Exhaustive replay observed horizontal speed multipliers 4 and 1. It also verified that the reference profile, shot timing, camera norm and kick norm stayed fixed across the fixture.

The driver bisects ranges of slider indices. Bounds enclose the two sliders' additive multiplier contributions to each chart axis. The source's unrounded unit trajectory and fixed shot times give lower bounds on horizontal displacement, vertical excursion and fastest 200 ms speed after subtracting a numerical allowance from the existing attachment-bound implementation. If a box could reach a lower speed tier, the score bound uses that lower multiplier. The driver visits the most promising child first and evaluates the full native score only when it reaches a surviving singleton.

The independent oracle scored **10,201 tuned tuples**. All **20,401 boxes** in the fixed binary partition, including skipped descendants, passed the admissibility check against their exhaustive maxima. The grouped search computed **25 box bounds**, visited 28 nodes, and scored **one complete tuned tuple**. The three outputs coincided at 80 points and **17.7949 modeled recoil-loss points of gain**, matching exhaustive enumeration. Seven warm Node runs had a **0.78 ms median** and **3.05 ms worst**. The exhaustive validation took **4.23 s**. Search timings exclude fixture preparation and exhaustive validation.

The certificate applies to this fixture, where every box was independently validated. Broader deployment requires a source-level floating-point error bound across supported profiles and explicit coverage for changing references, shot timing, stat curves or mixed modifiers. No browser deadline or full-catalog performance was measured in this test.

Reproduce with `node docs/optimization/m4-chart-axis-boxes.mjs` from the repository root. [Runner](m4-chart-axis-boxes.mjs), [raw samples](m4-chart-axis-boxes.json).

## Changing recoil profiles and shot timing

The deadline-free M4A1 study kept the same muzzle and stock weight sliders across three legal Detonation layouts. The base layout costs 80 points. Adding barrel 13020000173 costs 320 total and selects a different native ADS recoil profile. Adding magazine 13130000169 costs 240 total and changes the 20-shot chart end time from 1,425 to 1,638.75 ms. The budget is 800. All three contexts encounter horizontal multipliers 4 and 1.

Each context uses its own chart geometry, shot times, recoil-axis coefficients, camera norm and kick norm. The exhaustive oracle checked their invariants within each context and scored all **30,603** tuned tuples. It independently checked **20,401** calibration boxes, each against the exhaustive optimum in all three contexts and over their union. A union bound uses the highest gain upper bound and lowest cost lower bound among its contexts. Those may come from different layouts, which weakens pruning for Minimum Acceptable and Balanced.

| Traversal | Context bound calculations | Search nodes | Full tuned scores | Node median / worst |
| --- | ---: | ---: | ---: | ---: |
| Split contexts before sliders | 51 | 55 | 2 | 1.59 / 2.40 ms |
| Keep contexts grouped until the slider ranges are singletons | 90,846 | 50,448 | 2 | 347.87 / 354.30 ms |

Seven measured runs per strategy alternated after warm-up. Search timings exclude context setup, exhaustive scoring and box validation. Both strategies certified the same three values. Maximum achieved **24.3664 gain at 240 points**. Minimum Acceptable and Balanced both achieved **17.7949 gain at 80 points**.

For this fixture, split the mount decisions that determine profile or timing before branching on calibration. A future grouped variant should maintain paired gain and cost bounds per context through all three query tests. The tested contexts are fixed once their layout is resolved. Calibration that itself changes timing or reference, full-catalog performance, and browser timing remain open.

Reproduce with `node docs/optimization/m4-chart-contexts.mjs` from the repository root using Node 24 and the previous fixture's runtime. [Runner](m4-chart-contexts.mjs), [raw samples](m4-chart-contexts.json).

## Paired bounds for grouped contexts

The joint search now accepts several gain and cost bound pairs for a node. Each legal descendant must be covered by at least one pair. The solver prunes the whole node only if every pair rules out improvements to all three outputs. At interruption it computes the frontier certificate from the individual pairs. This preserves the relationship between each context's gain and cost, including the relationship used to bound gain per cost.

The same deadline-free M4A1 comparison now includes three strategies. All three matched the exhaustive results. The runner also checked the gain upper bound, minimum cost lower bound, ratio upper bound, and any certified witness at five forced interruption points per strategy.

| Traversal | Context bound calculations | Nodes | Full tuned scores | Node median / worst |
| --- | ---: | ---: | ---: | ---: |
| Split contexts first | 51 | 55 | 2 | 1.44 / 1.86 ms |
| Group with one union bound | 90,846 | 50,448 | 2 | 334.99 / 347.08 ms |
| Group with paired context bounds | 78 | 32 | 2 | 1.46 / 2.00 ms |

Seven measured runs per strategy alternated forward and reverse order after warm-up. Timings exclude exhaustive validation and context setup. The paired representation removed most of the union-bound overhead and matched the split-first median at this scale. The G18 regression also passed with the shared search change. The next comparison is on a wider fixture where there are enough contexts for per-node bound calculation and retention costs to matter.

Reproduce with `node docs/optimization/m4-chart-contexts.mjs`. [Raw three-strategy samples](m4-chart-contexts-paired.json).

## Wider M4A1 context comparison

The wider deadline-free fixture crossed eight stocks with four barrel/magazine combinations. Native mount resolution retained **24 of 32** layouts. The test selected every fifth legal position on both weight sliders, including the endpoints, giving 21 positions per axis. The certificate covers this restricted slider grid. It retains two native ADS profiles and two shot schedules under an 800-point Detonation budget.

The exhaustive oracle scored **10,584 tuned tuples**, plus stock, and verified all 881 calibration boxes against their native maxima in each context and across the union. All three traversal strategies matched the oracle and passed five forced interruptions each.

| Traversal | Context bound calculations | Nodes | Full tuned scores | Node median / worst |
| --- | ---: | ---: | ---: | ---: |
| Split contexts first | 88 | 94 | 4 | 2.49 / 3.81 ms |
| Group with paired context bounds | 432 | 47 | 4 | 4.10 / 4.85 ms |
| Group with one union bound | 31,728 | 11,471 | 4 | 116.28 / 127.31 ms |

Maximum Performance achieved **33.5601 modeled recoil-loss points of gain at 200 points**. Minimum Acceptable and Balanced both achieved **17.7949 gain at 80 points**. Seven measured runs per strategy alternated forward and reverse order after warm-up. Search timings exclude setup and exhaustive checks. The oracle took 5.82 s. Peak browser memory was unmeasured.

Split-first is the baseline for widening these resolved-context fixtures. Paired grouping visited half as many search nodes, with almost five times as many context-bound calculations and a higher median latency. A next useful test is the full 101-by-101 slider grid on this layout set with per-context splitting, followed by a browser run and a separate mount-domain scaling experiment.

Reproduce with `node docs/optimization/m4-chart-contexts.mjs --wide`. [Raw samples and layout IDs](m4-chart-contexts-wide.json).

## Full slider grid and Chrome Worker

The full-grid test restores all 101 legal positions on each weight slider for the same 24 resolved M4A1 layouts. It uses split-first traversal, the fastest strategy on the sampled fixture. The Node oracle and search have no time cutoff. Chrome runs the same search and scoring modules in one module Worker and checks the returned category values and search counts against Node. The static harness loads the pinned catalog and runtime from loopback HTTP using same-origin GET requests.

Run the Node oracle first, then the Chrome comparison from the repository root:

```powershell
node docs/optimization/m4-chart-contexts.mjs --wide-full | Set-Content -Encoding ascii docs/optimization/m4-chart-contexts-full.json
node docs/optimization/run-m4-chart-contexts-browser.cjs | Set-Content -Encoding ascii docs/optimization/m4-chart-contexts-full-browser.json
```

The fixture varies two controls per resolved layout. All other controls remain at default. This covers neither the full M4A1 mount catalog nor all its calibration controls.

The exhaustive Node oracle evaluated **244,824 tuned tuples** and checked **20,401 boxes in each of 24 contexts**. The oracle took **204.0 s**, including its per-tuple chart and timing checks. Both runtimes certified all three results and matched the search counts exactly.

| Runtime | Context bounds | Search nodes | Full tuned scores | Median / worst search |
| --- | ---: | ---: | ---: | ---: |
| Node 24 | 120 | 126 | 4 | 3.05 / 6.81 ms |
| Chrome module Worker | 120 | 126 | 4 | 1.40 / 2.20 ms |

Each runtime had seven measured runs after warm-up. The Worker also passed five forced interruption checks. The Chrome Worker was ready in **39.2 ms** including module and fixture data loading. Worker execution after readiness took **41.6 ms** for setup, interruption checks, warm-up and seven measured searches, including return of the result. Fixture setup within that interval took **23.9 ms**. These startup and batch figures are single local observations. Peak memory was unmeasured.

Maximum achieved **33.5601 gain at 200 points**. Minimum Acceptable and Balanced both achieved **17.7949 gain at 80 points**. The next scaling step is a broader mount-domain search with more active controls. [Raw Node results](m4-chart-contexts-full.json), [raw Chrome results](m4-chart-contexts-full-browser.json).

## Broader mount search with three active sliders

The deadline-free M4A1 Detonation fixture uses four muzzles, four stocks, three foregrips, an optional barrel and an optional magazine, with a 400-point cap. Mount enumeration compiled the existing legality model and fixed all purchases outside the fixture domain to zero. An independent Cartesian sweep sent all **192** requests through native mount resolution and cost checks. The two methods matched on all **94 legal layouts**. Stock was evaluated separately.

The three weight sliders each change both chart axes in every tested layout. Each uses five legal positions selected at evenly spaced indices across its range. The fixture spans two recoil profiles, two shot schedules, and all four chart speed multipliers. For each layout the native oracle independently scored all 125 selected slider tuples and verified the reference, timing, camera and kick invariants. All **23,406** calibration boxes passed admissibility checks against their exhaustive subtree maxima over **11,750 tuned tuples**.

The joint search calculated **142 bounds**, visited **148 nodes**, and scored **four complete tuned tuples**. It certified all three outputs and passed five forced interruption checks.

| Output | Cost in points | Modeled recoil-loss gain |
| --- | ---: | ---: |
| Maximum Performance | 320 | 36.0600 |
| Minimum Acceptable | 120 | 19.7204 |
| Balanced | 160 | 28.4358 |

Seven warm Node runs had a **3.27 ms median** and **5.29 ms worst** for the search. The same recorded run took **43.8 ms** to compile and enumerate the mount fixture, **67.1 ms** to prepare the resolved contexts, and **5.96 s** for the exhaustive oracle and bound audit. Setup and audit are outside the search timing. Every legal layout was prepared before calibration search. The certificate covers the selected slider grid. This experiment did not time the expanded fixture in a browser. The earlier full-grid Chrome regression still passed after generalizing the interval code to three dimensions.

Reproduce with `node docs/optimization/m4-chart-mount-scaling.mjs`. [Runner](m4-chart-mount-scaling.mjs), [raw samples and winning builds](m4-chart-mount-scaling.json).

## Full three-slider grid and Chrome Worker

The same 94 M4A1 layouts were searched with all **101 legal positions per slider**, for **96,848,294** tuned combinations in the declared mount domain. The split-first bounded search exhausted its frontier without a deadline. Node and one Chrome module Worker agreed exactly on layout counts, bound and score counts, and the returned attachment IDs, slider positions, cost and gain. The five-position subset still matches its independent native exhaustive oracle in both runtimes. The full grid was not independently exhaustively scored. Its certificate is conditional on the chart-axis interval and numerical-error assumptions documented for the prototype.

| Three-slider grid | Runtime | Bounds | Full tuned scores | Median / worst search |
| --- | --- | ---: | ---: | ---: |
| Five positions per slider | Node | 142 | 4 | 3.27 / 5.29 ms |
| Five positions per slider | Chrome Worker | 142 | 4 | 1.10 / 1.90 ms |
| All legal positions | Node | 238 | 4 | 4.39 / 7.55 ms |
| All legal positions | Chrome Worker | 238 | 4 | 3.00 / 4.00 ms |

Seven warm searches per run. For the full-grid Chrome batch, Worker readiness was **56.3 ms**, mount enumeration **39.2 ms**, and context setup **61.9 ms**. The Worker took **153.9 ms after readiness** to prepare the fixture, run interruption checks and warm-up, execute seven measured searches and return results. These startup and setup numbers are single local observations. The search table excludes setup. The full-grid winners retain the subset's costs and gains: Maximum 320 / 36.0600, Minimum Acceptable 120 / 19.7204, and Balanced 160 / 28.4358. The test still materializes all 94 resolved layout contexts before tuning and leaves the other calibration dials at default. Full mount-domain scaling and peak memory remain open.

```powershell
node docs/optimization/m4-chart-mount-scaling.mjs --full-grid | Set-Content -Encoding ascii docs/optimization/m4-chart-mount-scaling-full.json
node docs/optimization/run-m4-chart-contexts-browser.cjs --mount-scaling | Set-Content -Encoding ascii docs/optimization/m4-chart-mount-scaling-full-browser.json
```

Add `--sampled` to the Chrome runner to use the five-position reference. [Full-grid Node results](m4-chart-mount-scaling-full.json), [full-grid Chrome results](m4-chart-mount-scaling-full-browser.json), [sampled Chrome results](m4-chart-mount-scaling-browser.json).

## Streaming the mount search

The deadline-free driver now consumes the existing compiled mount enumerator in batches. Each batch prepares at most 64 layout contexts and searches its calibration boxes before requesting more. The unresolved mount stream stays on the search frontier under a loose gain bound. This keeps interruption certificates conservative and avoids retaining the full set of prepared chart contexts. The logical batch size excludes the native catalog, mount model, solver archive and browser runtime memory.

The three levels use the muzzle, stock, foregrip, barrel and magazine paths. Muzzle, stock and foregrip are mandatory inside each tuned mount domain. Stock alone is evaluated separately. One chart-axis control per mandatory part varies over all legal positions. Other controls remain at default. The optional barrel and magazine change the recoil profile and firing schedule in supported contexts. The largest level uses all available supported choices from these paths in the selected base mount context, with the project bipod-grip exclusion. It does not cover every M4A1 mount path. The completed-layout calibration bound remains conditional on the source and numerical-error assumptions described above.

The faster preparation path computes firing schedules and fixed camera/kick values directly through the same native kernel primitives used by the chart scorer. Each prepared chart, fixed norm, and root bound matched the original native preparation on all 94 reference and 3,888 expanded layouts. Full scoring for retained witnesses continues through the native preset.

| Mount level | Requested layouts | Legal layouts | Possible tuned tuples | Bounds / full tuned scores |
| --- | ---: | ---: | ---: | ---: |
| Reference, 400 points | 192 | 94 | 96,848,294 | 346 / 7 |
| Expanded, 800 points | 5,184 | 3,888 | 2,199,009,168 | 6,356 / 77 |
| All five paths, 800 points | 302,940 | 255,420 | 164,171,017,620 | 258,680 / 92 |

Independent native Cartesian mount audits reconciled the exact identities for every level. The reference also matched the previous materialized search's gain and cost for all three outputs. The expanded stream passed interruption checks at 0, 1, 10, 100 and 1,000 visited nodes. Changing its batch size from 1 to 256 reduced bound calculations from 7,200 to 5,428 and full scores from 101 to 48, with identical final values. The larger batch retains more prepared contexts. These individual batch runs were not a controlled wall-time comparison.

The largest stage matched exact mount counts, search counts and winning builds across full native preparation, direct kernel preparation and cached preparation. The cache stored **134 calibration tables** keyed by mounted item and host context and **three geometry entries** keyed by reference profile and all shot times. The 3,888-layout audit also checked the cached tables, geometry, camera/kick norms and root bounds against the full native preparation.

| Preparation | Node solve | Node context preparation within solve |
| --- | ---: | ---: |
| Full native chart | 403.2 s | 381.4 s |
| Direct kernel | 187.0 s | 169.6 s |
| Direct kernel with table and geometry caches | 78.3 s | 65.1 s |

These are single local observations with other benchmark processes active during parts of the runs. They include streamed mount enumeration, context preparation and calibration search. Model compilation and the separate Cartesian audit are outside the solve timings. [Reference and expanded Node](m4-chart-mount-stream.json), [largest native preparation](m4-chart-mount-stream-largest.json), [largest direct kernel](m4-chart-mount-stream-largest-fast.json), [largest cached](m4-chart-mount-stream-largest-cache.json), [batch counts](m4-chart-mount-stream-batches.json), [preparation audit](m4-chart-mount-stream-cache-audit.json).

The largest stage returned Maximum at **720 points / 70.7942 modeled gain**, and both Minimum Acceptable and Balanced at **200 points / 44.8636 modeled gain**. Every legal layout enters preparation, so the result isolates calibration pruning and streaming. The search did not exhaustively score the complete tuning grid. The optimum claims remain conditional on the chart bounds and their source-model assumptions.

```powershell
node docs/optimization/m4-chart-mount-stream.mjs reference expanded
node docs/optimization/m4-chart-mount-stream.mjs all-five-paths
node docs/optimization/m4-chart-mount-stream.mjs all-five-paths --fast --audit-mounts
node docs/optimization/m4-chart-mount-stream.mjs all-five-paths --fast --cache-preparation
node docs/optimization/run-m4-chart-contexts-browser.cjs --stream=all-five-paths --cache-preparation
```

The browser command compares with the stored Node reference. For scaling beyond these five paths, the next bottleneck is preparing completed mounts. A useful next prototype needs admissible calibrated completion bounds over unresolved attachment choices, including all reachable recoil profiles and firing schedules. Peak process memory and general five-minute coverage remain open.

Chrome ran the largest deadline-free fixture in one static module Worker, using only same-origin GET requests. Direct preparation took **109.2 s** and cached preparation took **60.6 s**. Chrome matched Node on every reported search count and on all three builds and slider settings. Cached Worker readiness took **56.4 ms**, and the solve took **60.56 s**, of which **48.44 s** was context preparation. The complete request after readiness took **60.58 s**, including model compilation and result delivery. Each is a single browser observation on this machine. [Expanded Chrome run](m4-chart-mount-stream-browser.json), [largest direct Chrome run](m4-chart-mount-stream-largest-browser.json), [largest cached Chrome run](m4-chart-mount-stream-largest-cache-browser.json).

## Shared grouping and accessory policy in the streamed search

The streamed driver uses the same `createChoiceGroups` policy as the existing exact screening studies. It filters selectable options through the shared policy and applies the shared constraints to both requested and source-resolved active mounts. Automatic search omits dedicated bipod sockets 10 and 36, side-sight socket 31, lens-hood socket 45, and Collapsible Bipod Grip 13140000038. The shared policy and its manual/explicit-lock behavior remain unchanged.

The five-path fixture excluded accessory paths by construction and already skipped the bipod grip. Its muzzle, stock, foregrip, barrel and magazine choices are distinct within the shared grouping rules, so applying those rules preserves the fixture population. Broader option sets use the same policy. In the M4A1 Detonation regression, for example, the shared policy reduced the 28 ordinary sight choices to 12 compatible representatives and omitted the side-sight socket.

`node tests/choice_groups.mjs` passed 264 native sight and calibration comparisons and the lock, tactical and compatibility checks. `node tests/bipod_grip_policy.mjs` passed all eight worker checks, including automatic exclusion in three modes, manual mounting, explicit locks and compiled eligibility.

The grouped Node run independently reconciled all **255,420** layout identities and matched the prior 258,680 bounds, 92 full tuned scores and all three winning builds. The compiled plan examined 224 option occurrences across its ordinary option sets and retained 154 after grouping. These are option-set counts, not layout counts. [Grouped Node evidence](m4-chart-mount-stream-grouped.json).

Chrome completed the same grouped run in **62.6 s** in one module Worker. It matched the Node grouping statistics, compiled mount counts, calibration counts and exact winning attachments and settings. [Grouped Chrome evidence](m4-chart-mount-stream-grouped-browser.json).

## Proven budget pruning before mount resolution

The streamed M4A1 research driver can apply a budget bound to complete attachment subtrees before native layout preparation. Each fixture requires exactly one purchase in each of the muzzle, stock and foregrip paths. For each mandatory path, take the cheapest purchase whose binary decision can still be true. Add the costs of optional purchases only when their decisions are forced true.

For any legal completion, its mandatory choice at each path belongs to the corresponding possible set, so its cost there is at least the minimum. The forced optional costs are unavoidable. The sets are disjoint and the compiled budget sums those same integer quotes. The sum is therefore a lower bound for every completion, even if some of the cheapest choices cannot coexist. An empty mandatory set has no completion. Pruning uses strict `lower > budget`, so equality stays eligible. Calibration has no additional modeled charge in this fixture and does not affect the proof. The rule requires the mandatory exactly-one constraints, nonnegative safe-integer quotes and a safe-integer total. Optional paths that remain undecided contribute zero.

| Grouped 400-point fixture | Legal layouts | Mount nodes, baseline → bounded | Additional budget cuts |
| --- | ---: | ---: | ---: |
| Reference | 94 | 298 → 286 | 2 |
| Tight expanded | 2,087 | 4,430 → 3,820 | 54 |

Both Node and Chrome matched the same complete mount identities against the independent Cartesian audit and returned identical tuned builds for all three categories. The new pruning removes only infeasible mount branches. Every legal layout still enters chart preparation. The tight Chrome observation was 305 ms without the new bound and 284 ms with it, with one run per variant. Those observations do not establish an end-to-end speedup.

The remaining work is recoil-gain pruning of **budget-feasible** mount branches. The existing default-tuning attachment score bound is insufficient for that decision. It must include contextual calibration ranges, all reachable chart profiles and schedules, and a source-level numerical error enclosure before it can preserve global calibrated optimality.

```powershell
node docs/optimization/m4-mount-budget-bound.mjs | Set-Content -Encoding ascii docs/optimization/m4-mount-budget-bound.json
node docs/optimization/run-m4-chart-contexts-browser.cjs --budget-study | Set-Content -Encoding ascii docs/optimization/m4-mount-budget-bound-browser.json
```

[Node evidence](m4-mount-budget-bound.json), [Chrome evidence](m4-mount-budget-bound-browser.json).

## Experimental calibrated gain pruning at mount branches

The opt-in driver now computes a recoil-gain bound before resolving a complete layout. It enumerates the legal single-slider positions through the native operation collector for each actual item and provider context. The guard accepts the fixture's additive multipliers on chart axes and its known non-scoring targets. It adds the extrema to the attachment stat intervals. A bound then considers the union of reachable recoil profiles and firing schedules, carries the lower attainable speed tier through the chart enclosure, and combines optimistic gain with the proven mount cost lower bound. Unsupported preparation or incomparable bounds leave the branch live. The three-output discard test also preserves the dynamic half-max threshold.

The argument for the new calibration step is by enclosure. For any legal completion, each selected occurrence contributes a value inside its interval. The extended bucket hull includes the sum of all such contributions. A score enclosure covering that enlarged bucket region covers all legal combinations of those sliders. The interval code still relies on the existing guards for native folding, stat curves and reference/timing coverage, plus the chart's explicit numerical allowances. This experiment adds calibration coverage to that model. It does not establish a new source-level floating-point proof for those allowances or a guarantee for other dials and mount paths.

| Grouped fixture | Prepared layouts, baseline → bounded | Gain-pruned branches | Node solve, baseline → bounded |
| --- | ---: | ---: | ---: |
| Reference | 94 → 77 | 5 | 54 → 61 ms |
| Tight expanded | 2,087 → 797 | 141 | 393 → 196 ms |
| All five paths | 255,420 → 109,626 | 6,581 | 95.4 → 38.1 s |

All runs matched the unpruned full-grid winning attachments and settings. The reference audit matched every omitted layout to its cut and independently scored **2,125** sampled native combinations over the 17 omitted layouts. Every sampled gain and layout cost was enclosed. The largest run used 12,302 mount gain-bound evaluations and 94 full tuned scores, with no declined score-bound evaluations. Scope is three active chart-axis sliders under the five-path Detonation fixture. Full-grid baseline and bounded search both rely on the existing calibrated interval assumptions. Neither exhaustively scored every tuple in the largest grid.

Node and Chrome matched both small fixture variants. Tight-expanded Chrome solve was 254 ms without the gain bound and 126 ms with it. Timings in this section are single local observations. The mount gain bound is opt-in, and the budget-only pruning and production paths retain their original behavior.

```powershell
node docs/optimization/m4-mount-gain-study.mjs
node docs/optimization/m4-mount-gain-study.mjs --largest
node docs/optimization/run-m4-chart-contexts-browser.cjs --gain-study
node docs/optimization/run-m4-chart-contexts-browser.cjs --stream=all-five-paths --cache-preparation --gain-bound
```

[Small Node comparisons](m4-mount-gain-study.json), [small Chrome comparisons](m4-mount-gain-study-browser.json), [largest Node comparison](m4-mount-gain-largest.json).

The largest Chrome Worker run matched Node's **109,626** prepared layouts, **6,581** gain cuts, bound and score counts, and exact winning builds. The observed deadline-free solve fell from **62.6 s** in the grouped reference to **26.6 s** with gain pruning. These observations are from separate runs. [Largest Chrome evidence](m4-mount-gain-largest-browser.json).

## Native binary64 chart bounds

The opt-in chart bound now replays native trajectory and interpolation arithmetic using interval endpoints. This removes the empirical geometry margin for fixed profiles and supplied shot times. The [ordered chart interval proof](pruning_proofs.md#ordered-native-chart-interval-proof) explains why this enclosure includes the native five-decimal rounding and horizontal speed tiers. It assumes valid incoming axis intervals and complete profile/timeline coverage.

Node and Chrome returned the same winning attachments and settings as the unpruned reference. The independent cut audit checked 2,000 sampled native tuples on the 16 omitted layouts in the reference fixture and 147,625 on the 1,181 omitted layouts in tight-expanded. Every sampled tuple stayed within its discarded branch bound. The existing native default-score regression also passed 3,253 comparisons.

| Five-path variant | Prepared layouts | Gain cuts | Full tuned scores | Node / Chrome solve |
| --- | ---: | ---: | ---: | ---: |
| Grouped reference, no gain pruning | 255,420 | 0 | 92 | 95.4 / 62.6 s |
| Previous geometry allowance | 109,626 | 6,581 | 94 | 38.1 / 26.6 s |
| Ordered native chart intervals | 128,656 | 5,732 | 93 | 45.8 / 31.7 s |

These are individual deadline-free observations. The chart interval can lose correlation between coordinates in the same speed window, so it is looser on this fixture. It still avoids preparing 126,764 layouts. Default production and research paths keep their existing behavior. A complete calibrated mount proof still needs source-level enclosures for upstream stat operations and final norm/score rounding, plus coverage of all reachable profiles and schedules. The exhaustive cut audits use sampled legal slider grids.

Select the new chart enclosure with `--native-chart-intervals` on the gain study and its browser runner. [Largest Node run](m4-mount-gain-largest-native-chart.json), [largest Chrome run](m4-mount-gain-largest-native-chart-browser.json), [native cut audit](m4-mount-gain-native-chart-cut-audit.json).

## Ordered stat and score enclosure on resolved layouts

The opt-in ordered-axis path uses the native operation collector at every legal slider position and replays the recoil-axis fold in source order. It combines that with the ordered native chart interval and the exact fixed camera/kick outputs. This removes the recoil-axis regrouping allowance and the final score pad within these resolved-layout bounds. [Proof](pruning_proofs.md#ordered-recoil-axis-fold-for-resolved-layouts).

- The two-slider fixture matched both native axis values exactly on all 10,201 tuples and enclosed every one of its 20,401 calibration boxes. [Two-slider evidence](m4-chart-ordered-axes.json).
- The 94-layout three-slider fixture matched both native axis values exactly on every one of 11,750 sampled tuples and passed all 23,406 box checks. [Sampled evidence](m4-chart-mount-scaling-ordered-axes.json).
- On the full 96,848,294-tuple grid, Node and Chrome matched the earlier winners and used 238 bounds and four full tuned scores. Median search was 4.50 ms in Node and 2.90 ms in Chrome, excluding setup. Setup took 171 ms and 120 ms respectively in the recorded runs. The full grid was not independently exhaustively scored. [Full Node evidence](m4-chart-mount-scaling-full-ordered-axes.json), [full Chrome evidence](m4-chart-mount-scaling-full-ordered-axes-browser.json).

The largest partially resolved mount search still uses the earlier upstream enclosure. The next proof requirement is allowing or enclosing every native event order and mapped-stat value for unresolved mount branches, while retaining useful bounds. The current option is experimental and does not change production search.

```powershell
node docs/optimization/m4-chart-axis-boxes.mjs --ordered-axes
node docs/optimization/m4-chart-mount-scaling.mjs --ordered-axes
node docs/optimization/m4-chart-mount-scaling.mjs --full-grid --ordered-axes
node docs/optimization/run-m4-chart-contexts-browser.cjs --mount-scaling --ordered-axes
```

## Upstream intervals on unresolved mounts

The new opt-in branch variant bounds arbitrary native addition and multiplication orders and replays native stat curves over intervals. The [proof](pruning_proofs.md#order-independent-stat-buckets-and-native-stat-curves) describes the arithmetic guards and fallback cases. Independent tests enclosed **872 native fold orders** and **13,130 native curve values**, including cancellation, extreme operands, clamps and cubic segments. The static export includes the new dependency. The native default-score regression still passes.

The discarded-layout audit enclosed all **146,500** sampled native tuning combinations across the reference and tight-expanded fixtures. Node and Chrome matched the unpruned reference winners and exact winning settings. On the largest five-path fixture the guarded branch search prepared **137,412 of 255,420 layouts**, with **5,364 gain cuts**, **140,740 calibration bounds** and **94 full tuned scores**. The observed solve took **45.6 s in Node** and **34.2 s in Chrome**. The earlier ordered-chart-only variant prepared 128,656 layouts and took 31.7 s in Chrome. The new curve and fold intervals are more conservative on this fixture.

The stat and chart stages now have explicit enclosures for their guarded inputs. The entire branch gain bound remains experimental until it covers the final norm and score rounding by proof and establishes profile and timing coverage across all admitted source contexts. Production behavior remains on the original path.

```powershell
node tests/branch_native_ranges.mjs
node docs/optimization/m4-mount-gain-study.mjs --native-stat-intervals
node docs/optimization/m4-mount-gain-study.mjs --largest --native-stat-intervals
node docs/optimization/run-m4-chart-contexts-browser.cjs --stream=all-five-paths --cache-preparation --gain-bound --native-stat-intervals
```

[Cut audit](m4-mount-gain-native-stats-cut-audit.json), [largest Node evidence](m4-mount-gain-largest-native-stats.json), [largest Chrome evidence](m4-mount-gain-largest-native-stats-browser.json).

## Reachable contexts and conservative native score

The opt-in context guard now derives its schedule representatives through the full native timed scorer. It includes the weapon and barrel recoil profiles and the presence/absence of the one legal timing writer in the largest five-path domain. The source coverage argument is in the [context proof](pruning_proofs.md#native-profile-and-timing-coverage-for-the-guarded-mount-domain). Independent tests matched every chart timestamp and reference across **7,964 native replays** of 3,982 legal layouts. The largest context-aware Node and Chrome runs matched the prior 137,412 prepared layouts, 5,364 gain cuts, 94 tuned scores and winning builds. Chrome observed **34.8 s**. [Independent audit](m4-native-context-audit.json), [largest Node run](m4-mount-gain-largest-native-contexts.json), [largest Chrome run](m4-mount-gain-largest-native-contexts-browser.json).

A separate conservative score mode uses the native norm for fixed norm arguments and a zero floor when they vary. This removes the need for an unproved Math.hypot error radius. It uses the native weighted score and the resolved-layout ordered calibration proof. The bound kept the exact winners in the reference and tight-expanded tests in both Node and Chrome. It cut **zero** feasible mount branches in those two fixtures. [Score proof](pruning_proofs.md#conservative-final-score-without-a-norm-tolerance), [small Node comparison](m4-mount-gain-study-portable-score.json), [small Chrome comparison](m4-mount-gain-study-portable-score-browser.json).

```powershell
node docs/optimization/m4-native-context-audit.mjs
node docs/optimization/m4-mount-gain-study.mjs --largest --native-contexts
node docs/optimization/m4-mount-gain-study.mjs --largest --portable-score
node docs/optimization/run-m4-chart-contexts-browser.cjs --stream=all-five-paths --cache-preparation --gain-bound --portable-score
```

On the largest **255,420-layout** fixture, the conservative score mode preserved all three winning attachments, slider values, and scores in Node and Chrome. It made zero feasible-mount gain cuts, prepared every legal layout, and used **259,704 calibration bounds** and **93 full tuned scores**. Node completed the deadline-free solve in **105.3 s** and Chrome in **86.1 s**, single observations including mount iteration and context preparation. This gives a stronger calibration certificate in the declared fixture with a slower mount search. The tighter nonzero-norm branch bounds still need an implementation-specific error proof or a versioned deterministic norm. [Largest conservative Node results](m4-mount-gain-largest-portable-score.json), [largest conservative Chrome results](m4-mount-gain-largest-portable-score-browser.json).

## Source-pinned V8 norm floor

The [V8 norm proof](pruning_proofs.md#tighter-native-norm-bound-on-audited-v8-builds) restores positive camera and kick lower bounds without replacing the native objective or adding an empirical error margin. The harness restricts this variant to the two source-audited Windows x64 builds with JIT disabled. The norm regression matched **324 exact points** and enclosed **1,299,600 sampled points in interval boxes** on the audited Node build. Cases include signed inputs, signed zero, subnormal values and large magnitudes.

| Fixture | Prepared layouts, zero floor → V8 floor | V8 gain cuts | Chrome solve, zero floor → V8 floor |
| --- | ---: | ---: | ---: |
| Reference | 94 → 78 | 10 | 122 → 151 ms |
| Tight expanded | 2,087 → 1,075 | 134 | 1.88 → 1.45 s |

The two floor modes ran in separate JIT-disabled browser batches. These are single observations. Node and Chrome matched mount counts, bounds, full scores and exact winning builds for the V8 variant. The reference cut audit independently enclosed all 2,000 tested native settings across the 16 omitted layouts. [V8 Node results](m4-mount-gain-study-v8-norm.json), [V8 Chrome results](m4-mount-gain-study-v8-norm-browser.json), [zero-floor Chrome comparison](m4-mount-gain-study-portable-jitless-browser.json).

```powershell
node --jitless tests/v8-norm-floor.mjs
node --jitless docs/optimization/m4-mount-gain-study.mjs --v8-norm-floor
node docs/optimization/run-m4-chart-contexts-browser.cjs --gain-study --v8-norm-floor
node docs/optimization/run-m4-chart-contexts-browser.cjs --stream=all-five-paths --cache-preparation --gain-bound --v8-norm-floor
```

The largest JIT-disabled Chrome Worker run returned the same three native builds, gains, costs and slider settings as the conservative full-grid reference. It prepared **175,538 of 255,420 legal layouts**, avoiding 79,882 preparations, and made **3,631 gain cuts**. It used 179,824 calibration bounds and **93 full tuned scores**. The measured deadline-free solve took **306.8 s**, about seven seconds over the intended five-minute target. Worker readiness and post-ready batch time were 52.5 ms and 306.85 s. The earlier 86.1 s zero-floor Chrome result used ordinary JIT settings, so it is a separate runtime observation. The version-pinned proof is useful for an audited reference and requires an externally verified launch. Production hosted JavaScript still needs a portable norm proof or a versioned deterministic norm. [Largest audited Chrome result](m4-mount-gain-largest-v8-norm-browser.json).

## Deterministic norm in ordinary browser mode

The opt-in `binary64-normalized-hypot-v1` scorer and bound share the [specified binary64 and integer arithmetic](pruning_proofs.md#versioned-deterministic-norm-and-interval-bound). The normal browser launch uses JIT and relies on neither DevTools runtime attestation nor a native norm error radius. The native production objective remains the default. The new objective version makes cross-runtime comparisons explicit.

An independent integer oracle passed **3,268 norm checks**, including deliberately poor Math.sqrt estimates, and **1,299,600 interval comparisons**. Node and Chrome matched the norm-version winners and search counts on the smaller fixtures. The tight fixture prepared **1,075 of 2,087** layouts and made 134 certified gain cuts. The reference audit verified every native test tuple in the 16 skipped layouts against its recorded branch bound, for 2,000 tested tuples.

```powershell
node tests/deterministic-recoil-norm.mjs
node docs/optimization/m4-deterministic-norm-study.mjs
node docs/optimization/m4-deterministic-norm-study.mjs --largest
node docs/optimization/run-m4-chart-contexts-browser.cjs --deterministic-norm --largest
```

[Small Node results](m4-deterministic-norm-study.json), [small Chrome results](m4-deterministic-norm-study-browser.json).

| Largest five-path run | Zero norm floor | Deterministic norm floor |
| --- | ---: | ---: |
| Prepared layouts | 255,420 | 175,538 |
| Gain-based branch cuts | 0 | 3,631 |
| Calibration bounds | 259,704 | 179,824 |
| Full tuned scores | 93 | 93 |
| Node solve | 109.1 s | 81.6 s |
| Ordinary Chrome Worker solve | 77.4 s | 61.2 s |

The largest comparison uses the same deterministic objective in both variants. Node and Chrome match exactly on all search counts, winning attachments, slider settings, costs and gains. The winners also match the earlier native-score conservative reference on this fixture. Chrome Worker readiness was 53.9 ms. It ran both deadline-free variants in one Worker; the timings include mount iteration and context preparation. These are single local observations with some overlapping benchmark work. The portability proof removes the runtime-pinned launch requirement. The mount and calibration certificate remains limited to the guarded five-path domain and three active controls. [Largest Node evidence](m4-deterministic-norm-largest.json), [largest Chrome evidence](m4-deterministic-norm-largest-browser.json).

Firefox 159.0 matched Node and Chrome on all smaller-fixture counts and exact winners in a normal module Worker. The tight fixture took 571 ms with the zero floor and 316 ms with the deterministic norm floor in that single run. The Firefox test used Playwright's managed browser. [Firefox evidence](m4-deterministic-norm-study-firefox.json).

```powershell
node .scratch/browser-qa/node_modules/playwright/cli.js install firefox
node docs/optimization/run-m4-chart-contexts-browser.cjs --deterministic-norm --firefox
```

## Eight-path deterministic fixture and full-catalog preflight

The wider fixture adds ordinary optics at path 11, magazines at path 5 and the dependent magwell at 5/44 to the original five paths. Its mounted muzzle, stock and foregrip are still required. Each varies its existing chart control over all legal positions. It admits all 12 grouped ordinary optic representatives, all five listed magazine options and the grouped magwell representative. The shared policy still excludes side sights and bipods. The other five-path options are the declared restricted lists. This widens path and dependency coverage while keeping the domain manageable.

The independent native resolver reconciled **61,167 legal layouts** from **89,856 requests**. Those layouts represent **11,855,326,773** legal tuning tuples in the guarded three-control domain. The comparison uses the same deterministic objective and ordered calibration search in both variants. The baseline disables gain-based mount cuts entirely. The bounded variant prepared **1,008 layouts**, made **9,900 gain cuts**, and ran **156 full tuned scores**. Node observed **37.18 s** for the unpruned mount solve and **2.71 s** for the bounded solve. Solve times exclude the separate Cartesian identity audit. These are single measurements.

| Output | Cost | Modeled recoil-loss gain |
| --- | ---: | ---: |
| Maximum Performance | 680 | 59.9559 |
| Minimum Acceptable | 160 | 37.9538 |
| Balanced | 160 | 37.9538 |

The variants matched exactly on gains and costs. The initial comparison incorrectly required identical attachment IDs on ties. The corrected harness replays both witnesses with the source mounting resolver and deterministic scorer and accepts tied optics when costs and gains agree. Both branches of the study remain deadline-free. [Node comparison and witnesses](m4-deterministic-norm-eight-paths.json).

The full ordinary catalog preflight independently reproduced **12,268,642** grouped legal M4A1 layouts at 800 points with Insight 3/7 locked. The preflight counted those layouts and inspected **304 provider contexts** across the compiled source choices, including contexts potentially eliminated by downstream mount constraints. It did not optimize the full population.

| Control type in the screened provider contexts | Count |
| --- | ---: |
| Shared-axis controls supported by the current slider guard | 137 |
| Controls writing only non-objective targets | 145 |
| Gun-kick controls outside the three-slider solver | 22 |

The preflight passed all **13,675 legal positions** of the 145 non-objective controls through the native operation collector and verified their bucket targets. These controls write neither recoil nor timing inputs of the scalar objective. The argument assumes no Handling tie-break, stat floor or calibration charge. The same census found one timing item identity and one mounted ADS recoil-profile writer in the screened ordinary context set. The next proof work is exact handling of the gun-kick dials and optional mounts with varying active-control counts. Current full-catalog coverage is an eligibility census and exact mount count. [Preflight data](m4-full-catalog-preflight.json).

```powershell
node docs/optimization/m4-full-catalog-preflight.mjs
node docs/optimization/m4-deterministic-norm-study.mjs --eight-paths
node docs/optimization/run-m4-chart-contexts-browser.cjs --deterministic-norm --eight-paths
```

Ordinary Chrome matched Node on the legal population, cut count, calibration work and exact objective values. It reduced the eight-path solve from **16.82 s** to **2.21 s**. The Worker was ready in 82.9 ms. Both variants ran locally in one static module Worker. [Chrome comparison](m4-deterministic-norm-eight-paths-browser.json).

## Optional mounts and gun-kick controls

The optional eight-path fixture uses the same grouped automatic policy and deterministic objective. All eight paths can be empty when the resolver permits it. Each resolved build supplies its active scoring controls, including the gun-kick dials. The separate kick search combines its exact native-order minimum with each chart candidate. The mount bound includes every declared legal value of both control groups. The tuned tuple count uses integer arithmetic. [Separation proof](pruning_proofs.md#separating-gun-kick-and-chart-calibration).

An independent native kernel oracle enumerated **2,337 kick tuples** across seven tested chart/kick count combinations, including layouts with two kick controls. It matched every kick optimum. Fourteen additional chart endpoint checks confirmed that applying the chosen kick settings preserves chart, camera and tier results. All reported three-output witnesses replay at legal settings through the native mount resolver and versioned scorer.

| Optional fixture | Audited legal layouts | Prepared with pruning | Feasible gain cuts | Full tuned scores | Chrome without → with mount gain cuts |
| --- | ---: | ---: | ---: | ---: | ---: |
| Eight paths | 5,670 | 820 | 1,193 | 125 | 1.43 → 0.33 s |
| Wider eight paths | 21,921 | 1,439 | 3,948 | 157 | 13.11 → 1.76 s |

The wider fixture includes layouts with zero through five active controls and **741,921,488,049** possible tuned tuples. Its two native recoil profiles share one shot schedule. Node independently reconciled every legal mount identity. Node and Chrome matched all three objective values, cuts, calibration counts and active-control counts. Timings are single deadline-free observations and exclude the separate native Cartesian verification.

Both fixtures returned Maximum **500 points / 57.7362 modeled gain**, Minimum Acceptable **80 / 33.1110**, and Balanced **40 / 17.3610**. The certificate covers these declared optional mount domains. Extending the guarded source model and evaluating the full catalog remain separate scaling work. [Node results and exact witnesses](m4-active-control-study.json), [Chrome results](m4-active-control-study-browser.json).

```powershell
node docs/optimization/m4-active-control-study.mjs
node docs/optimization/run-m4-chart-contexts-browser.cjs --active-control-study
```

## Full grouped ordinary M4A1 solve

The full ordinary research driver compiles the existing grouped mount model for M4A1 Detonation at 800 points, with Insight 3/7 locked at path 11. It admits contextual ordinary choices throughout the compiled mount graph and keeps the existing automatic exclusions. It measures recoil improvement against the stock weapon and charges the locked optic in every search result. The layout count is independently reproduced as **12,268,642** before gain pruning. Tactical completions, other optics at the locked path, and other modes lie outside this fixture.

The driver discovers each resolved layout's scoring controls, encloses their legal positions in unresolved mount branches, and searches chart and kick settings with the deterministic norm. It seeds the search with prior fixture builds only after validating their source-resolved identity, compiled legality, price and tuning positions under the full fixture. The source guard covers the two ADS profiles and the ordinary/extended firing schedules from the known timing item. The final witnesses replay through the same versioned scorer.

The Chrome timeout harness uses a 299-second compute deadline with reserve for Worker startup and result delivery. It checks the deadline both in the category search and inside long mount scans. At a stop, the unresolved mount stream stays on the frontier under its original conservative bound. The small interruption regression retained a valid unfinished certificate. [Interruption evidence](m4-full-ordinary-interruption.json).

With the original cache, Chrome returned at **299.10 seconds after Worker readiness**. It visited 1,976,832 mount nodes, made 1,371,463 gain cuts, prepared 1,357 layouts and ran 123 full tuned scores. The returned builds replayed at 600 points / 73.3960 gain for Maximum, 240 / 52.4973 for Minimum Acceptable, and 80 / 33.1110 for Balanced. None was independently certified optimal at that stop. The live frontier allowed maximum gain up to 100, minimum cost as low as 40, and efficiency up to 2.5 gain per point. The 240-point witness passed the half-max threshold even at that optimistic maximum. [Capped Chrome run](m4-full-ordinary-browser.json).

The ordered variant resolves the recoil profile and timing choices earlier, uses the bounded gain-cache eviction policy, and cuts branches that cannot beat a cheaper build already guaranteed to meet the half-max threshold. [Minimum Acceptable pruning proof](pruning_proofs.md#guaranteed-half-max-incumbent).

| Chrome variant | Solve time | Prepared layouts | Full tuned scores | Outputs proven |
| --- | ---: | ---: | ---: | ---: |
| Original | 299.10 s | 1,357 | 123 | 0 of 3 |
| Bounded eviction | 299.06 s | 1,715 | 129 | 0 of 3 |
| Bounded eviction, prioritized paths and half-max cut | 55.74 s | 3,720 | 54 | 3 of 3 |

The eviction-only run improved the Maximum witness to **720 points / 73.47482202854772 gain** and ended with 52 pending frontier entries. The ordered run exhausted the frontier. Node took **67.62 s** and matched Chrome on all winning settings and search counts, including **356,914 mount nodes** and **265,445 gain cuts**. Chrome's Worker was ready in 78.7 ms. These are single local measurements with overlapping experiments. The ordered run measures the changes together. Peak browser process memory was unmeasured. [Eviction-only Chrome](m4-full-ordinary-browser-large-cache.json), [ordered Chrome](m4-full-ordinary-browser-ordered.json), [ordered Node](m4-full-ordinary-node-ordered.json).

| Proven solution | Cost (points) | Modeled recoil gain |
| --- | ---: | ---: |
| Maximum | 760 | 73.55468986548121 |
| Minimum Acceptable (threshold 36.777344932740605) | 120 | 41.334177114554535 |
| Balanced (highest gain per point) | 80 | 33.110984181083865 |

```powershell
node tests/full-ordinary-search-pruning.mjs
node docs/optimization/m4-full-ordinary-study.mjs --minimum-share=0.5 --large-gain-cache --ordered-search
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --deadline-ms=299000 --large-gain-cache --ordered-search
```

## Strict Balanced price window

The full ordinary M4A1 research solver first certifies the Maximum Performance and Minimum Acceptable picks, then searches for the best gain per point strictly between their prices. The second pass searches the same compiled domain with its own price and ratio bounds. It can certify that the window has no build. A timeout before the endpoint prices are known leaves Balanced unresolved. A timeout in the second pass retains any feasible in-window witness and reports the remaining ratio bound. Historical unrestricted-ratio results above use a different objective. [Proof](pruning_proofs.md#balanced-with-certified-price-endpoints).

The certified endpoints were **120 points / 41.334177114554535 gain** and **760 / 73.55468986548121**. Balanced was **140 / 41.334177114554535**, or **0.2952441222468181 gain per point**. The price is strictly intermediate. Minimum Acceptable and Balanced have equal modeled recoil gain under the requested price-only eligibility rule.

```powershell
node tests/full-ordinary-search-pruning.mjs
node docs/optimization/m4-full-ordinary-study.mjs --minimum-share=0.5 --deadline-ms=299000 --large-gain-cache --ordered-search
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --deadline-ms=299000 --large-gain-cache --ordered-search
```

| Runtime | Elapsed | Balanced pass | Outputs certified |
| --- | ---: | ---: | ---: |
| Chrome module Worker | 65.28 s | 7.81 s | 3 of 3 |
| Node.js | 77.53 s | 8.80 s | 3 of 3 |

Both runtimes returned identical attachments, legal calibration positions, objective values and counts. The Balanced pass visited 31,361 mount nodes, cut 28,211 gain branches, prepared 79 layouts and ran five full tuned scores. The first Chrome development run took 67.59 s with the same winners and counts. The timed results are local observations with overlapping work. The certificate covers the same grouped ordinary Detonation fixture, Insight lock and 800-point budget as above. [Chrome](m4-balanced-window-chrome.json), [Node](m4-balanced-window-node.json), [forced endpoint timeout](m4-balanced-window-timeout.json).

### Strict performance improvement for Balanced

The research solver also requires gain strictly above Minimum Acceptable's resolved gain. This excludes upgrades that spend more points for the same modeled recoil. A branch whose gain upper bound is at or below that floor is ineligible. The earlier price-only benchmark remains historical evidence. A strict gain increase is evaluated on the model's full precision. No additional practical improvement margin has been chosen.

Chrome certified **160 points / 45.53637007348432 modeled gain** for Balanced in **67.85 seconds** on the full grouped ordinary fixture. This is **4.202192958929785** more gain than the 120-point Minimum Acceptable build. Maximum remained 760 points / 73.55468986548121. The search exhausted its frontier and replayed all three builds natively. [Chrome result](m4-balanced-strict-gain-chrome.json).

### Balanced efficiency and browser checks

The incremental efficiency experiment measures the gain above Minimum Acceptable divided by the points above Minimum Acceptable. It certified the same 160-point build as the strict total-efficiency rule, at **4.2022 extra gain for 40 points**. It closed the full frontier in 115.02 s in Chrome while other browser tests were running. Maximizing either ratio alone can favor a small upgrade. [Incremental browser evidence](m4-balanced-incremental-chrome.json).

A fresh local static export passed the production UI smoke tests for both presets, desktop/mobile viewport layout, and versioned same-origin module loading. The existing optimizer passed 1- and 4-worker completion, cancellation and recovery, companion failure recovery, and native replay. In a separate mobile-sized Chrome context the research Worker was terminated during a solve and restarted. The restarted solve returned an open frontier after a one-second compute deadline in 1.021 s from Worker readiness. Balanced stayed unresolved. These are local checks. Physical mobile peak memory and integration of the exact solver and its proofs into production Generate remain open. [Local Pages QA](balanced-local-pages-qa.json), [research Worker lifecycle](m4-balanced-browser-lifecycle.json).

The second experiment maximizes gain above the straight line between the two certified endpoint builds. The score subtracts the gain a build would receive at the endpoint-average upgrade rate from its actual gain. This balances the size of the improvement with the extra points spent. Chrome certified a **400-point / 64.0178 gain** build in **129.73 s**, including 73.53 s for the Balanced pass. It captures **70.4%** of the gain from Minimum Acceptable to Maximum for **43.75%** of the extra cost. The winner is **8.5871 gain** above the line at that price. Both experiments use the same strict price and gain rules. The line-based rule is the stronger beta candidate for a substantial middle option. [Chrome evidence](m4-balanced-tradeoff-chrome.json).

```powershell
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --deadline-ms=299000 --large-gain-cache --ordered-search --incremental-balanced
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --deadline-ms=299000 --large-gain-cache --ordered-search --tradeoff-balanced
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --lifecycle --deadline-ms=1000 --large-gain-cache --ordered-search
```

### Approved Balanced rule across runtimes and interruptions

The endpoint-line utility was checked against exhaustive selection on 100 deterministic synthetic trees. Each tree ran with node limits of 0, 3, 13 and unlimited. The oracle checks feasibility of returned witnesses, equality of the exact winner's gain and utility, and that the frontier upper bound still covers the true utility at a stop.

With a deliberate 2.5-second Balanced-phase deadline, Chrome certified the same 120- and 760-point endpoints and replayed a feasible **240-point / 51.7099 gain** Balanced candidate. Its utility was **4.3344**. The live frontier gave an upper bound of **58.6155**, which covers the independently certified optimum of **8.5871**. Balanced remained unproven, and 18 frontier entries were open. The reported bound is valid but wide. [Forced Balanced timeout](m4-balanced-tradeoff-timeout-chrome.json).

| Browser run | Elapsed | Balanced phase | Outputs certified |
| --- | ---: | ---: | ---: |
| Chrome initial | 129.73 s | 73.53 s | 3 of 3 |
| Chrome repeat | 132.71 s | 74.02 s | 3 of 3 |
| Firefox | 183.77 s | 99.92 s | 3 of 3 |

Both browsers returned identical attachments, calibration settings, bounds and search counts, including **475,267 mount nodes** in the Balanced phase. The repeat and Firefox runs overlapped. These desktop observations cover the same grouped ordinary M4A1 fixture, 800-point budget and Insight lock. The research harness establishes browser parity. Production Generate integration and physical mobile resource measurements remain open. [Chrome repeat](m4-balanced-tradeoff-chrome-repeat.json), [Firefox](m4-balanced-tradeoff-firefox.json).

```powershell
node tests/full-ordinary-search-pruning.mjs
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --firefox --deadline-ms=299000 --large-gain-cache --ordered-search --tradeoff-balanced
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --deadline-ms=299000 --large-gain-cache --ordered-search --tradeoff-balanced --balanced-deadline-ms=2500
```

### Static builder preview integration check

The browser harness can mount the GitHub Pages export at a project-style subpath and load the research Worker from the same origin. The Worker reads the exported catalog and weapon pack. The browser blocks external assets during this check, so search and replay depend on local static requests. The exported builder's existing static client evaluates the returned attachments and calibration settings. The harness checks the quote and missing-price list and verifies that the optimizer tab is usable. The research Worker is launched by the test harness. The production Generate action still uses the existing optimizer.

In a 390-pixel Chrome viewport, the test terminated an active research Worker, restarted it, and observed the one-second compute timeout after **1.022 s** from Worker readiness. The static client reproduced both returned witnesses and Balanced remained unresolved. A separate 390-pixel static client replay of all three proven builds preserved every explicit attachment, requested calibration value, and cost. A resized desktop browser measures viewport behavior. Physical mobile memory and runtime remain unmeasured. [Static preview lifecycle](m4-balanced-static-preview-lifecycle.json), [mobile viewport replay](m4-balanced-static-client-mobile-replay.json).

The full solve certified all three outputs in **134.15 s** from Worker readiness. The **400-point / 64.0178 gain** Balanced build, the two endpoints, and the proof counts match the standalone browser runs. The exported evaluator reproduced all three costs and reported no missing prices. Worker initialization took 123.8 ms. [Full static preview run](m4-balanced-static-preview-chrome.json).

```powershell
python tools/build_github_pages.py --output .scratch/balanced-production-qa
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --deadline-ms=299000 --large-gain-cache --ordered-search --tradeoff-balanced --static-export=.scratch/balanced-production-qa
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --lifecycle --deadline-ms=1000 --large-gain-cache --ordered-search --tradeoff-balanced --static-export=.scratch/balanced-production-qa
```

### Worker count on the static export

The single-Worker research baseline used one dedicated compute Worker. The exported builder's existing anytime optimizer chooses one fewer than the browser's reported logical core count, bounded to 1–8 Workers. The cap is two when reported device memory is at most 4 GB. This Chrome session reported 14 logical cores and 16 GB and selected eight automatically.

| Forced Workers | Peak active compute Workers | Summed evaluations | Elapsed |
| --- | ---: | ---: | ---: |
| 1 | 1 | 4,112 | 5.12 s |
| 4 | 4 | 16,604 | 5.17 s |
| 8 | 8 | 23,211 | 5.27 s |

All Workers contributed, and the best reported recoil loss was identical across the three five-second anytime runs. The sums count worker evaluations and may include duplicated work. Each group disposed cleanly. Cancellation, recovery after companion failure, and native stat and cost replay passed. These measurements describe the existing anytime search on the local static export. Exact parallel search would require disjoint domain coverage and a certificate over all unfinished work. [Worker counts and measurements](static-preview-worker-counts.json).

### Generate-to-builds preview

The local static preview uses an opt-in research client to route the validated 20-shot ordinary M4A1 Detonation request with locked Insight 3/7 to one compute Worker. The fixture uses the 800-point cap and the approved endpoint-line Balanced rule. Playwright equips and locks Insight through the normal builder controls, presses Generate, waits for progress and selects the three result cards. Proof status is displayed per build. The preview replays each build through the exported evaluator before rendering the cards. Applying Balanced returns to the builder. The standard export uses its usual client when served outside the preview harness.

The cancellation case waits for an exact-search progress update before pressing the real Cancel button. The test checks that Generate is re-enabled, that no stale result card appears and that the Worker returned no completed report. The default static export also passed its both-preset smoke test after the proof-label rendering change.

```powershell
python tools/build_github_pages.py --output .scratch/generate-research-qa
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --static-export=.scratch/generate-research-qa --generate
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --minimum-share=0.5 --static-export=.scratch/generate-research-qa --generate --cancel-generate
```

Add `--replay-generate` to the full test command to feed stored certified results through the same renderer and apply/download flow without running the search. The replay was used to validate the UI assertions independently. [Renderer replay](m4-generate-renderer-replay.json), [active cancellation](m4-generate-e2e-cancel.json), [default static smoke test](m4-generate-default-smoke.json).

A live desktop Chrome run showed progress in **5.21 s**, completed all three cards in **135.58 s**, and finished applying Balanced in **135.94 s** from the Generate click. The Worker used **134.97 s**, including **74.18 s** in the Balanced pass. The downloaded build matched the certified attachments, requested calibration values, and cost. Outputs, certificates and search counts matched the standalone run. This is one desktop timing from the opt-in test harness. [Live Generate run](m4-generate-e2e-chrome.json).

## Minimum Acceptable at 60 percent

The exact ordinary M4A1 solver uses 60% of the attainable modeled improvement over stock. The builder's anytime optimizer applies the same share to the best improvement found. The exact preview certifies the maximum before fixing the Balanced price and gain window. It then maximizes the approved gain above the endpoint line. Historical G18 and 50% M4A1 benchmarks keep their original inputs.

The exact gain cutoff is **44.13281391928872**. Chrome certified all three cards at **155.83 s** after Generate on one compute Worker. It applied Balanced and verified its cost, attachments and tune positions by download. The minimum-gain equality tests, eight generator integration tests and both-preset Chrome smoke test passed.

| Build | Cost | Modeled recoil gain |
| --- | ---: | ---: |
| Minimum Acceptable | 160 | 45.53637007348432 |
| Balanced | 440 | 65.92662168886626 |
| Maximum Performance | 760 | 73.55468986548121 |

[Chrome Generate evidence](m4-generate-60-chrome.json), [standard static export smoke](m4-60-default-smoke.json), [relative-threshold proof](pruning_proofs.md#relative-minimum-acceptable-threshold).

```powershell
node tests/optimizer_selection.mjs
node tests/full-ordinary-search-pruning.mjs
python -m unittest discover -s tests -p test_recoil_generator.py
python tools/build_github_pages.py --output .scratch/generate-60-qa
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --static-export=.scratch/generate-60-qa --generate
```

Node independently reproduced the same complete proof, attachments, calibration and search counts. The single Node run overlapped the Chrome test, so these local timings are descriptive. [Node parity](m4-full-ordinary-60-node.json).

### Five-minute cutoff and mobile viewport

A normal desktop Chrome run at **390 × 844** reached all three proven cards in **150.22 s** after Generate and verified Apply Build. The witnesses, certificates and search counts match the 60% desktop reference. From 71 two-second samples, the Chrome process tree peaked at **604.9 MiB of private bytes** and a **866.2 MiB summed working set**. Summing working sets can count shared pages more than once. The sampler began shortly after launch, so these are observed desktop peaks. No physical phone was available for a device measurement. [Mobile viewport run](m4-generate-mobile-viewport-chrome.json).

For the cutoff test the harness inserts short stalls only after Balanced search progress messages. It keeps the real five-minute Generate budget and the same mount and tune domains. The regular Worker budget reserves time for native result replay and rendering. The normal mobile-sized run has no synthetic stalls.

```powershell
python tools/build_github_pages.py --output .scratch/anytime-60-qa
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --static-export=.scratch/anytime-60-qa --generate --generate-deadline-test
node docs/optimization/run-m4-chart-contexts-browser.cjs --full-ordinary --static-export=.scratch/anytime-60-qa --generate --mobile-viewport
```

For concurrent Windows memory sampling, run `python tools/monitor_screening_resources.py <runner-pid> --runner run-m4-chart-contexts-browser.cjs --interval 2 --output <existing-output-directory>`.

The cutoff test rendered all three cards at **298.47 s** after Generate. Max and Min stayed **Proven optimal**. The **480-point / 67.5926 gain** Balanced candidate was labeled **Best found** with **8** frontier entries still open. Apply Build and native replay passed. The remaining upper bound covers the independently certified optimum. [Five-minute cutoff evidence](m4-generate-300s-chrome.json), [desktop memory samples](m4-generate-desktop-resource-samples.json).

### Static-client beta implementation

The static exporter includes the validated M4A1 proof modules, catalog and runtime checks, and a versioned Worker entry point. The beta is exposed by `?exact-beta=1` and the 300-second exact option. The ordinary M4A1 Detonation scope requires Insight 3/7 as the sole lock, Lowest Recoil on the 20-shot fixture, and no stat floors or custom budgets. Lock-free and other unsupported requests follow the normal anytime route. Missing Worker assets and changed proof inputs keep the exact route from issuing a certificate.

The browser tests load the real exported app at a project subpath and use Generate, Cancel, result cards, Apply Build and download. The complete case first cancels an active exact search, then starts a fresh Worker and compares the proven build, calibration and cost for each category with the audited 60% reference. The unsupported-request test launches zero exact Workers. Blocking the exact Worker URL tests fallback on startup failure. The unflagged static smoke test verifies that the beta option is absent.

Two normal Chrome runs completed from Generate to all proof labels in **166.84 s** and **157.08 s** with identical winners and applied the 440-point Balanced build. The full deadline test deliberately slowed the Balanced pass, then displayed cards after **298.18 s**. The endpoint proofs survived and the **440-point Balanced** card displayed Best found with 24 frontier entries open. Apply and native replay passed on both cutoff cases. The Worker startup failure, unlocked-request fallback and unflagged static smoke checks passed. [Browser evidence](static-exact-beta-browser.json).

### Four-Worker exact beta

The live opted-in Generate route uses four compute Workers per solve. It counts legal alternatives by barrel, distributes them once, and runs the four non-overlapping partitions under one deadline. The coordinator merges endpoint candidates, computes the global 60% threshold and shares the resulting Balanced window and a feasible starting build with every Worker. Bound and scoring caches are local to each Worker. [Coverage and merge proof](pruning_proofs.md#exact-search-across-four-partitions).

The shared starting point was the **400-point / 64.0178 gain** build. All four Workers searched both passes. Chrome displayed the same three proven results as the one-Worker reference in **33.20 s** and applied the **440-point / 65.9266 gain** winner. The historical one-Worker observation was **157.08 s**. This comparison covers the whole change, including partition pruning and the shared seed. It does not isolate the effect of Worker count.

With an intentionally shortened Balanced phase, the global Maximum and Minimum proofs survived. The 400-point shared incumbent displayed **Best found** and replayed successfully while ten frontier entries remained open.

The repeat run through the previously shared demo URL completed in **32.73 s** and matched the first four-Worker run on the certified values and both passes' node counts. Cancellation and restart proved that both groups of four Workers were terminated. Blocking Worker startup exercised the normal anytime fallback. [Browser evidence](static-exact-four-workers.json).

A controlled code-path check withheld only the shared Balanced incumbent. The four partitions reached the same proven results with the same **849,123 endpoint nodes**. They visited **564,763 Balanced nodes** without the seed and **389,935** with it, a **31.0%** reduction. The unshared run displayed cards in 34.69 s. The logical node comparison isolates the seed. The local wall-clock observations came from separate runs. Reproduce the seed check with `node tests/exact_beta_browser.cjs unshared`.

The full-deadline test held one Balanced partition until the end of its shared compute budget. Chrome displayed usable cards after **298.34 s**. Both endpoints remained proven and the Balanced card was Best found with 1 frontier entries open. Apply Build and native replay passed. [Browser evidence](static-exact-four-workers.json).
