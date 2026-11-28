# Anytime Web Worker efficiency

Timed browser Anytime now reuses validated mounted builds during calibration, coordinates a bounded set of calibration starts, and resumes partitioned ordinary traversal during feedback. Each worker owns one root-choice partition. The single-worker path uses the same tuning reuse and resumable traversal. [Optimizer](../tools/anytime_optimizer.mjs) · [Worker coordinator](../builder/static-client.js)

## Implementation follow-up

The coordinator receives up to 16 starts per worker at each calibration handoff. It assigns each configuration and its distinct submitted tuning starts to one participating worker. Imported configurations are source-replayed before calibration. A short rendezvous timeout lets workers proceed with their local starts if the exchange cannot complete. The ordinary partition is fixed for each worker for the duration of a budget. Local neighborhoods and tactical completions can still overlap.

| Two-second four-worker runs | M4A1 baseline | M4A1 upgraded | K416 baseline | K416 upgraded |
| --- | ---: | ---: | ---: | ---: |
| Repeated calibration keys | 38–41% | 20–21% | 74–75% | 13–18% |
| Distinct scored candidates | 8,086–9,293 | 11,879–14,192 | 2,790–3,290 | 11,795–12,163 |

All upgraded trial Max results matched the source calculator on replay, with the same Max loss as the baseline within each fixture. Baseline and upgraded trials ran in separate sessions with two four-worker trials per weapon in each session. These figures describe the combined change and can reflect machine load and a different mix of scored work. [Baseline results](../.scratch/anytime-worker-study/browser-results.json) · [Upgraded results](../.scratch/anytime-worker-study/browser-upgraded.json)

Local validation covered one, four and eight Chrome workers, distinct partition assignments, calibration delegation, cancellation and recovery, companion-worker startup failures, source replay, and paused enumeration parity. Fixed-work profiling and broader quality and throughput comparisons remain open. [Browser validation](../tests/parallel_search_browser.cjs) · [Traversal validation](../tests/subtree_counting.mjs)

## Baseline search

The static client gives every prepared worker the same request and compute deadline, with a different search-order variant. Each independently runs attachment search, tactical completion, calibration and feedback, then sends its retained rows for a final merge. Progress carries counters and best losses. Workers receive no peer candidates during the search. Calibration iterates its local shortlist in objective order without variant-specific scheduling. [Static client](../builder/static-client.js) · [Anytime solver](../tools/anytime_optimizer.mjs)

The earlier Chrome study used the 800-point Detonation M4A1 with Insight 3/7 locked. Median gross throughput increased from 1,387 to 11,281 scored evaluations per second between one and eight workers. All 35 trials returned the same best loss of 22.9856 under that revision's objective. The result established gross throughput scaling on that fixture. [Historical study](archive/m4a1_solver_efficiency_20261117.md)

## Browser overlap measurement

Instrumented the current local working tree (HEAD `21a446d` plus local changes) in Headless Chrome 158 on Windows. Two-second Detonation Lowest Recoil runs used the catalog cap, no locks and no detailed limits, alternating one and four workers in the order 1, 4, 4, 1 per weapon. Each trial used a fresh client. Instrumentation recorded the canonical mount-and-tune cache key on each successful source scoring call. The overlap rate is one minus the union size divided by the sum of worker-local distinct counts. It excludes repeats within one worker and can count a key in multiple phase rows. The trace adds allocation and message overhead.

| Four-worker overlap | M4A1 (18010000001) | K416 (18010000013) |
| --- | ---: | ---: |
| All scoring | 21–23% | 43–45% |
| Attachment search and feedback | 9–10% | 20–23% |
| Tactical completion | 14–15% | 22–23% |
| Calibration | 38–41% | 74–75% |

Four-worker runs scored 8,086–9,293 distinct M4A1 candidates and 2,790–3,290 distinct K416 candidates. The one- and four-worker trials found identical Max loss within each fixture (25.7856 and 39.1136). All eight Max results matched calculator stats and cost on replay, with zero source scoring errors. The sample is small and applies to these presets, weapons and deadlines. A sequential Node replay of the four variant orders also found calibration had the largest overlap on both fixtures. [Browser probe](../.scratch/anytime-worker-study/browser.cjs) · [Browser data](../.scratch/anytime-worker-study/browser-results.json) · [Node data](../.scratch/anytime-worker-study/results.json)

From the repository root, export with `python tools/build_github_pages.py --public --output .scratch/anytime-worker-study/site`. Then use `node .scratch/anytime-worker-study/browser.cjs` for Chrome or `node .scratch/anytime-worker-study/study.mjs` for the Node probe. Chrome uses the existing scratch Playwright install. The regular private export hit a pinned HiGHS LICENSE checksum mismatch. The public export succeeded and exercised the production Anytime worker path.

## Raw search speed investigation

1. **Reuse a validated mounted build throughout calibration.** The evaluator resolves and checks mounts, computes cost, normalizes choices and cleans tunes before looking in the score cache. Calibration supplies the same mounts for every joint and single-control proposal. Carry the already validated build and cost into a calibration-specific evaluator, enumerate legal tune positions once per mounted layout, and reuse the candidate signature. Preserve the source calculation for new tuned states and replay final results. Add an exact-request cache ahead of resolution only if replay shows substantial benefit. Keep it scoped to the current budget and request context. Compare resolved build, canonical tunes, cost, scores and detailed-limit violations on the same proposals.
2. **Separately measure shortlist maintenance.** Calibration sorts and deduplicates the entire complete shortlist for each seed just to find one row by configuration. An indexed lookup can preserve the existing choice between score and diversity rows. Also test precomputed variant sort keys and per-config diversity hashes. A scratch index prototype produced mixed results in four alternating two-second Node runs per fixture. Median scored evaluations were 3,023 baseline versus 3,003 indexed on M4A1 and 2,111 versus 2,342 on K416. Best loss was constant within each fixture. These timed runs changed which candidates fit into each phase and leave the end-to-end gain unresolved. [Probe](../.scratch/anytime-worker-study/study.mjs) · [Raw results](../.scratch/anytime-worker-study/results.json)
3. **Preserve ordinary tree position across phases.** A deadline thrown from the mount generator's node callback closes the iterator. The next attachment phase then recompiles and restarts it. A deadline encountered between yielded leaves can also discard progress or leave a fetched leaf unscored. Add a cooperative checkpoint that can yield control among internal nodes, including long runs with zero legal leaves, and retain the iterator and any pending leaf until feedback. Track restarts and prefix overlap separately from pruning. [Anytime traversal](../tools/anytime_optimizer.mjs) · [Mount enumeration](../tools/mount_search.mjs)
4. **Profile before changing arithmetic or cache capacity.** Time resolver and policy checks, source scoring, tuning preparation, shortlist maintenance and traversal on a fixed trace. Record attempted proposals, source-score misses and distinct canonical configurations with tuning. Enlarging the existing score cache alone still leaves cache hits paying the validation and key-building costs.

## Worker cooperation investigation

1. **Assign one owner per calibration start.** At the first tactical-to-calibration handoff, send a small score- and price-diverse shortlist to a coordinator. Deduplicate starts by canonical configuration and tuning within each budget, order work using the existing comparator, and dispatch multiple short jobs per worker. Treat a whole coordinate pass on a seed as a unit so each job retains its improvements. Keep a common deadline and retain local candidates if a worker fails. Preserve a small amount of local exploration for starts outside the shared shortlist. Begin with calibration because it has the highest measured overlap.
2. **Partition broad ordinary traversal next.** Keep seed and neighborhood exploration flexible. Give ordinary tree walkers disjoint root-choice subtrees, with more jobs than workers and a queue to absorb uneven branch sizes. Reuse the exact solver's partition planner and validator with Anytime's compiled mount model after tactical and equivalence restrictions. Apply each partition to an isolated model or represent it in enumeration because the existing restriction helper can mutate constraints. Validate disjointness before normalization and measure residual duplicates after normalization. Once calibrated candidates are shared, assign tactical work by ordinary base as well. [Partition planner](../tools/exact_ordinary_partitions.mjs)
3. **Exchange candidates at phase boundaries first.** Current worker search phases run synchronously. Inbound messages wait for the worker to yield to its event loop, so sending more frequent messages alone cannot change an active phase. Expose bounded resumable jobs first and share a few config/tune pairs with their budget and request identity. Replay them before treating them as search seeds and rank them with the existing constraint-aware objective. Keep each worker's ordinary shortlist cutoff local during the first experiment. A single peer's best tuned build is insufficient to prune a tree that also feeds cheaper and structurally diverse alternatives. [HTML worker messaging](https://html.spec.whatwg.org/multipage/workers.html)

## Validation before adoption

Run alternating baseline and treatment browser trials at 1, 2, 4 and 8 workers. Cover short and long deadlines, both presets, locks, floor-constrained requests, multiple budgets where supported and representative weapons. Compare time to first feasible and best feasible objective over time, final Max/Balanced/Min outcomes, unique scored candidates per compute second by phase, duplicate fraction, phase and merge overhead, and memory. Replay final stats and costs. Verify failure recovery and cancellation when jobs are queued or in flight. Benchmark each raw-speed and coordination change independently before combining them.
