# M4A1: partial-state merging with rank-preserving selection

Historical reduced-population result. The user subsequently required removing dominance: active study engines now reject it and restore the original 12,885,654-layout grouped population. See [current policy, count validation and improvement research](exhaustive_screening_improvements.md). The numbers below remain historical; they do not describe a full run of the restored population.

2026-11-18. The combined implementation is [merged_screening.mjs](../tools/merged_screening.mjs), with an incremental [ranking heap](../tools/ranked_screening_heap.mjs) and [16-worker runner](../tools/run_merged_screening_study.mjs). Both features were implemented before the integration runs. This is the ordinary/default-calibration feasibility study, not a change to production Generate.

## Completed 800-point result

Both phases completed with **all 16 workers participating**, no deadline and no restart. Full per-batch score/identity manifests match, and exactly the same **8,484** survivor identities appear in the same order. Every survivor also passed a separate fresh-worker, **uncached native** objective/cost/lock replay. [Run evidence](../data/optimizer_validation/m4a1_merged_ranked_20261118/final.json), [independent heap/native validation](../data/optimizer_validation/m4a1_merged_ranked_20261118/component-validation.json), [statistics](../data/optimizer_validation/m4a1_merged_ranked_20261118/statistics.json), [source hashes](../data/optimizer_validation/m4a1_merged_ranked_20261118/source-sha256.json).

| Metric | Exhaustive control | Partial-state DAG + rank preservation |
| --- | ---: | ---: |
| Represented layout paths | 1,696,710 | 1,696,710 |
| Source-scored states | 1,696,710 | **1,483,796** |
| Retained top-0.5% identities | 8,484 | **8,484**, identical order |
| Phase wall time | 425.80 s | **368.57 s** |

Merging saves **212,914 scored states (12.55%)**. The observed phase time falls by **13.44%**, a control/merged ratio of 1.155, for this single ordered pair. Total setup, both phases and replay take 799.41 seconds. The **under-one-million goal is not reached**: another 483,797 scored evaluations would have to be eliminated to get strictly below one million.

The DAG covers 1,552,350 paths; 144,360 paths use planned exhaustive fallback for unsupported root/child ordering. There are **zero runtime native-state guard fallback jobs**. The engine merges 248 root states and 33,126 later partial states within its bounded batches. These intermediate merge counters are not the number of saved terminal scores: a shared prefix can represent many suffixes. Raw traversal counters also mix DFS-node visits in fallback with DAG edges and must not be compared as uniform work units.

Peak sampled process RSS is **5.86 GiB** across the entire control/merged process and its 16 worker threads. The host reports 14 logical CPUs and about 15.2 GiB of OS-reported RAM. A monitor started partway through the control phase observes an average 7.09 logical CPU equivalents over its 551-second window, with available system memory falling to 0.66 GiB. These partial-window observations do not establish whole-run CPU efficiency or an optimal worker count. This is a Node measurement; GitHub Pages/browser-worker performance is not established by it.

![Complete census, phase wall time and sampled memory](../data/optimizer_validation/m4a1_merged_ranked_20261118/merging_ranking_comparison.png)

[SVG diagram](../data/optimizer_validation/m4a1_merged_ranked_20261118/merging_ranking_comparison.svg). No confidence bands are shown because there is only one execution pair. Full reconstructed selections are stored in [merged-survivors.json](../data/optimizer_validation/m4a1_merged_ranked_20261118/merged-survivors.json); the [control selection](../data/optimizer_validation/m4a1_merged_ranked_20261118/control-survivors.json) matches.

## Population and ranking

The repeated fixture is M4A1 `18010000001`, Detonation, Lowest Recoil, 800 points, root optic `11` locked to Insight 3/7 `13110000091`. Existing grouping/exclusions and the experimental dominance profile are held fixed. The independently counted population is **1,696,710 layout paths**. Both the exhaustive control and merged run retain **8,484 layouts**, exact BigInt `ceil(N/200)`. Neither merging nor the smaller number of scored representatives changes that denominator.

This is the **dominance-reduced** ranking population. It is not the original 12,885,654-layout grouped population, whose top 0.5% would contain 64,429 rows. Dominance has already removed different-score layouts; weights cannot recover their original rank positions. [Ranking research](ranking_semantics_research.md).

The total order is the versioned exact floor-shortfall/objectives/cost/canonical-identity order. This fixture has no minimum floors. The objectives are strict recoil loss, then Handling. Every compute worker maintains the **global K**, not 0.5% of its local assignments. The coordinator keeps K from their union. Selected rows include complete reconstructed attachment identities, rather than an independently recombined union of per-slot options.

## Actual partial-state merging

Structural root prefixes are independently enumerated from the mounting model. Compatible continuations are grouped into bounded cohorts, with up to 16 root prefixes per batch to limit memory. At each ordinary leaf decision layer, the engine folds the next part's operations in native source order and merges states only when all of these match:

- Full resumable raw numeric accumulator buckets, before stat-curve mapping, preserving IEEE-754 values and signed zero.
- Ordered reference-replacement operations, retained conditional/fire identities and exact purchase cost.
- The same layer and ordered future leaf domains/defaults, under a checked closed mounting boundary.

One merged state expands its suffix once. Incoming arcs and BigInt path mass preserve every correlated sequence of attachment choices. Reconstruction traverses those arcs to recover all original identities; a terminal class is source-scored once and each reconstructed alias contributes its own ranked row. Thus this is prefix/suffix sharing before enumeration, rather than only a complete-result score cache.

The screen intentionally does **not** demand matching tuning profiles: tuning is empty in this phase, and every selected alias is restored individually for subsequent tactical/calibration processing. This permits more sharing than the earlier conservative 22-alias calibration-correspondence census. No claim is made that default-score-equivalent aliases have interchangeable tuning domains or calibrated objectives.

The source can interleave children with later root parts. Those prefixes use exhaustive fallback. The same applies to unsupported nested providers, live coupling/occupancy, device selection and bound ammunition. Every terminal representative additionally checks its complete raw state, replacement order, source mounting, lock and cost against native resolution. A runtime guard failure discards that batch's provisional rows and reruns its complete original population through exhaustive fallback. It never silently drops a batch.

Batch boundaries conservatively limit sharing; reported scored states are evaluations across batches, not a claim to have found the globally minimal decision diagram.

## Validation and measurement design

The 160-point precursor completed with **16 participating workers**: 313 paths, 217 scored states, exactly two survivors, identical complete per-batch score/identity manifests and native survivor replay. [Evidence](../data/optimizer_validation/m4a1_merged_ranked_smoke_20261118/final.json). An initial attempt produced only eight batches and failed its worker-participation assertion; the splitter was fixed, and the full 16-batch precursor was repeated before starting the 800-point run. The failed attempt remains recorded separately.

For the full run, the control and merged phases use the same input, job partition, 16-worker pool, source scorer and global K. The control enumerates and scores every path. For each batch, both phases sort a canonical manifest of **every** identity, objective vector, score and cost, including aliases; SHA-256 checks compare the complete manifests under the standard cryptographic collision assumption. Independent exact counts must reconcile, all 16 workers must participate in each phase, survivor arrays must match in exact order, all retained identities must be unique, and every survivor receives native replay.

One control-then-merged execution pair gives descriptive timings, not an estimate with confidence bounds. Jobs have heterogeneous structural workloads; progress/resource samples are serially dependent, and are not independent replicates. Warm caches, CPU contention and memory pressure can affect timings. All phases include correctness checks, alias reconstruction, rank retention and manifest work, so their times are not directly comparable to the earlier best-preview-only browser scan. RSS is sampled for the entire Node process, including all worker threads, rather than browser private memory.

## Reproduction

Requires the current local source runtime under `.scratch/calibration-check` and catalog/weapon exports under `.scratch/github-pages-site`.

```powershell
node tools/run_merged_screening_study.mjs
node tests/merged_screening_components.mjs
python tools/report_merged_screening.py
```

The runner always uses 16 compute workers, has no solve deadline or automatic restart, and stores full selected configurations. Current `MERGED_BUDGET` and `MERGED_OUTPUT` select a separate fixture/output directory. Dominance is now disabled and `MERGED_DOMINANCE=1` is rejected; current default commands target the restored original grouped population, not this historical reduced run. Tactical completion, calibration search, other weapons and browser-worker performance are outside this historical run.
