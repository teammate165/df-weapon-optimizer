# Exhaustive-preserving screening improvements

2026-11-18. Consolidated parallel source research. Dominance is disabled in the active ordinary-screening and merged-screening study engines, their runners and local browser study. Explicit attempts to enable it are rejected. Historical reduced-domain results are retained as historical evidence.

Implementation follow-up: the [optimized custom exact DAG](optimized_exact_dag.md) implements the seven work areas below, with bounded worker-local reuse rather than global frontier ownership. The latest user directive is **8 workers for new tests**. Sixteen-worker requirements and measurements in this research snapshot are historical. Full-domain implementation validation is tracked in the follow-up report and TODO.md.

## Restored contract and validation

The population is the existing **grouped ordinary** domain: M4A1 `18010000001`, Detonation, Lowest Recoil, 800 points, Insight 3/7 `13110000091` fixed at root `11`. Existing grouping, exclusions and tactical-stage boundaries remain unchanged. Every legal layout must receive its exact default-calibration score directly or through proven equivalence; incoming path identities/multiplicity remain complete. Score-based subtree pruning and heuristic shortlists are excluded from these proposals.

With **16 actual compute workers**, the current independent exact counter reconfirms **12,885,654 layouts** and **64,429 top-0.5% survivors**, using `ceil(N/200)`. All workers also compare the entire 160-point population: all **395** native/DAG score-identity rows and survivor order match. Explicit dominance requests fail in both study engines. [Native policy/count validation](../data/optimizer_validation/exhaustive_population_policy_20261118/validation.json). The rebuilt browser study passes its complete 395-layout traversal, 16-worker lifecycle, disabled-dominance UI, cancellation and desktop/mobile checks. [Browser validation](../data/optimizer_validation/exhaustive_population_policy_20261118/browser-validation.json).

These checks are **not a new full 12,885,654-layout scored run**. No proposed optimization below has been implemented or benchmarked in this research turn. The prior 12.55% merging reduction and 5.86 GiB memory observation belong to the smaller dominance-reduced population and cannot predict gains here. The under-one-million target now concerns distinct scoring computations; represented layout count remains 12,885,654. Reaching fewer than one million scorer evaluations from that baseline requires more than 92.2% reuse/compression, which has not been established.

## Proposed implementation order

| Order | Improvement | Concrete design | Exhaustiveness safeguard |
| --- | --- | --- | --- |
| 1 | Compact state storage | Native-contract copy-on-write for touched buckets; intern exact bucket tuples and replacement chains; pack provenance arcs. | Preserve binary64, signed zero, undefined initial values, native operation order and BigInt mass; resolve hash collisions by exact comparison. |
| 2 | Score accumulated state | Finalize raw numeric state through native reference/target/mapping functions once; reuse actual native trajectory/timeline algorithms. | Certify scorer and validity dependencies against pinned source; retain native fallback and uncached replay oracle. |
| 3 | Exact trajectory caches | Bounded worker-local caches for native rounded geometry, timing, pattern and full objectives with separate complete keys. | Every required input belongs to its key; eviction means recomputation; no approximate scores or score bounds are reused as exact values. |
| 4 | Smaller proven keys | Start with resolved reference state, then compute backward closure of every live scoring, validity and future-transition dependency. | Keep all four raw bucket fields for live targets; unknown dependencies retain full key/fallback; never use current displayed stats alone. |
| 5 | Sharing beyond batches | First persist a byte-capped terminal score memo across jobs; later assign canonical states to owners and share whole layer frontiers. | Cache hits still emit every correlated path; bounded queues and spill/recomputation preserve all requests; barriers/delta mass account for late arrivals. |
| 6 | Deferred identities | Score all terminal classes, sort exact rank prefixes with BigInt mass, then reconstruct selected blocks and stream the global boundary's smallest signatures. | Exactly 64,429 original identities in total-order sequence; boundary ties reconcile across all classes/jobs/workers. |
| 7 | Native-order event DAG | Interleave fixed root operations with child choices, keyed by program position and the remaining fixed/choice program. | No arithmetic reordering; retain existing legality guards and complete exhaustive fallback for unsupported cases. |

This sequence improves the existing full-key engine first, then changes equivalence boundaries and ranking representation. The rows are proposals with different outcomes: compact storage and state-based scoring mainly reduce work per state; smaller keys and sharing can reduce repeated scorer calls; deferred reconstruction reduces identity work while still scoring every class. None promises a particular runtime or state-count reduction.

## Important findings

The current preset accepts shared state but its chart branch still calls `timedRecoil`, which calls the complete calculator and `kernel.u` again. The full calculator also computes base/current state. A native-contract scoring seam can remove this duplication; simply adding another result cache does not remove the repeated work inside each miss. [Source trace and API proposal](exhaustive_scoring_research.md).

Native chart points are rounded to **five decimals**, even with `preservePrecision:true`, because the internal trajectory caller omits its precision argument. Scaling an unrounded unit trajectory changes the source result. Secondary Handling uses unrounded source seconds, so displayed rounded handling values are unsuitable for exact rank reuse. The existing bound cache subtracts a numerical guard and lacks the secondary objective; it cannot be used as an exact score cache. [Scoring research](exhaustive_scoring_research.md).

Timing is part of recoil scoring: source fire rate and schedules change the fastest-200-ms horizontal-speed tier. Keep fire-control/profile dependencies and native validity checks when designing live-state keys. Equal current scalar values do not imply equal future behavior when their initial/addend/multiplicative components differ. [State-equivalence research](exhaustive_state_sharing_research.md).

A compact rank-prefix selector can avoid reconstructing most losing identities **after every class is scored**. It must keep the original denominator and correlated provenance. Canonical signature order differs from native operation order and backpointer traversal, so arbitrary arc sorting does not provide the correct tie boundary. Validation manifests may still deliberately traverse every identity even when the production selector defers it. [Storage and ranking research](exhaustive_storage_order_research.md).

## Evidence required for implementation

All executable tests and measurements use **16 compute workers**. First test individual storage/scoring changes against independent full sorting, source replay, immutable ancestor snapshots, exact-key edge cases and cache eviction/collision behavior. Then compare complete original-domain path counts and per-job score/identity manifests, exact ordered top-0.5% identities, and fresh uncached replay of every survivor. Test interleaved defaults/providers and ties crossing workers. Report legal paths, scored classes, native calls, cache hits, allocations/memory, reconstruction work and phase time separately.

One measured run establishes descriptive timing only. Randomized paired repetitions, with whole runs as units, are needed for comparative uncertainty. Progress samples and heterogeneous batches are not independent replicates. Browser/Pages performance and any browser storage contract require separate validation.

## Research outputs and shared cache

- [Live keys and cross-batch sharing](exhaustive_state_sharing_research.md).
- [Accumulated-state scoring and exact trajectory caching](exhaustive_scoring_research.md).
- [Compact storage, deferred ranking and native-order DAG](exhaustive_storage_order_research.md).

Agents wrote incremental findings to `.scratch-archive/exhaustive-research-cache/`. Its common line-numbered source snapshot, SHA-256 manifest and topic-owned notes reduce repeated source-read calls. Reports cite the owning source files; the cache is a reusable research aid, not independent evidence.
