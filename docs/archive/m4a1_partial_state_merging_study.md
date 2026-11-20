# M4A1 equivalent partial-state investigation

Follow-up: a separate [implemented DAG and rank-preserving 16-worker full run](../m4a1_merged_ranked_screening.md) now validates ordinary/default-screening compression and complete survivor identity parity. This document retains the earlier root-only census; the old research kernel's leaf path is still not the implementation used by the validated run.

2026-11-18. Research only; production search remains unchanged. Fixture: M4A1, Detonation, Lowest Recoil, budget 800, Insight 3/7 locked at root optic `11`. See the [equivalence contract and primary-source research](../partial_state_merging_research.md).

## Measured root-prefix collisions

The follow-up census used **16 actual Node compute workers**, all of which processed 157–158 inputs. It reused 2,520 previously enumerated structural prefixes, then recomputed native state and continuation signatures in the worker pool. This is a census of these inputs, not an independently repeated enumeration or a completed-layout benchmark. [Raw results, worker participation, signatures and exclusions](../../data/optimizer_validation/m4a1_partial_state_20261118/root-census.json). Reproduction: `node tools/investigate_partial_state_roots.mjs`; requires the existing `.scratch/calibration-check` runtime, static weapon/catalog exports and `.scratch/partial-state-merging/root-census-refined.json` input census.

Native mounting order interleaves child and root attachments for **252 prefixes**. The root-first prototype rejects these: folding roots before their intervening children can change the native sequential floating-point calculation. They require an ordered traversal or conservative fallback. Among the remaining **2,268** prefixes, across 36 continuation shapes:

| Key requirements, cumulatively | Distinct classes | Prefixes sharing another state |
| --- | ---: | ---: |
| Objective-channel accumulators and ordered replacements | 1,992 | 276 |
| Plus exact purchase cost | 1,998 | 270 |
| All numeric accumulator channels | 2,010 | 258 |
| Matching legal calibration profiles | 2,166 | 102 |
| Matching calibration insertion programs | 2,246 | 22 |

Every row includes the normalized future mounting/tactical interface and retained identity dependencies. Full canonical strings are compared, without probabilistic hash equality. These are **candidate equivalences**, not validated equality of every future calibrated result. Legal calibration profiles include sampled native functions on the generator's legal position grid. The insertion program preserves relevant operation order rather than treating floating-point arithmetic as commutative.

Only 22/2,268 prefixes (0.97%) share another state under the strongest current signature. This does not measure the reduction in complete layouts: suffix populations differ, and later leaf choices may introduce further collisions. It provides no evidence yet that the existing 1,696,710-layout dominance domain can be represented by fewer than one million terminal states.

Total census wall time was 10.45 seconds; the measured dispatch/compute/result interval was 9.38 seconds, including serialization of full canonical signatures. Individual worker computation ranged from 0.35 to 0.64 seconds. These one-run figures describe this diagnostic implementation, not a solver speedup, throughput benchmark or estimate of exhaustive solve time. No confidence interval is meaningful from this single census run.

## Implementation direction

Use a layered exact decision diagram in native operation order. Each node needs the exact resumable numeric/replacement state, residual legality/budget and downstream calibration/tactical interface. Preserve all incoming choice arcs and path multiplicities so shared suffixes retain distinct layout identities. Existing dominance elimination has already removed different-score layouts, so this cannot recover the original pre-dominance top-5% population.

The experimental [kernel](../../tools/partial_state_merging_study.mjs) contains a leaf-DAG prototype, but that path has **not been run or validated**. Before enabling it, reconcile weighted terminal paths to 1,696,710 with excluded-prefix fallback, replay reconstructed aliases against native mounting and objective calculations, and validate tuning insertion correspondence. Measure terminal classes, transitions, peak memory and full elapsed time using 16 workers. Root collision counts alone must not be presented as a completed search or a certified reduction.
