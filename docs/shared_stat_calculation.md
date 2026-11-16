# Shared native stat calculation

Implemented locally on 2026-11-16. Default-calibration screening reuses ordered attachment-operation prefixes and complete stat cores through `tools/shared_stats.mjs`. Both native presets opt in as read-only consumers. The all-legal domain, top-5% thresholds, separate tactical completions and calibration candidates are unchanged.

The native collector supplies each occurrence's operations under the actual weapon, mode and tactical policy. The complete stream passes through the native strongest-per-stat laser selector before reuse. Prefix identities contain ordered operation semantics; distinct attachment occurrences retain their source operations and calibration identities. Identical numeric states can share computation while remaining separate ranked builds.

Numeric effects are never pre-summed. A narrow, hash-pinned runtime shim lets the original numeric folding function resume from a privately cloned prefix Map. It executes the same source operations in the same order, including duplicate aliases and non-associative floating-point additions. The ordinary two-argument calculator behavior is unchanged. Ordered reference replacements are cached separately; native main-stat curves are applied after the whole operation stream, using private writable buckets. Source value fallback behavior is preserved.

Cached buckets, attributes and references are read-only. Each returned state has fresh Maps and occurrence lists. A preset replacing its raw scoring function loses the reuse opt-in; arbitrary mutable consumers continue through the ordinary evaluator. Calibration, tuning, requested ammo, changed contexts, unsupported operation values and unknown runtime revisions use native whole-state evaluation. Cache saturation computes uncached results exactly.

The contract is pinned to kernel SHA-256 `fdb5afdc78af20d5d4c88eb2af17dfd6a20652b18677cc8d5824edb42b5a9d09` after the project laser policy, and laser-policy SHA-256 `1898c81a9ea892c3f4cac806595ab0884d67209e9286abb5fa6462b5e6d4692c`. `tools/prepare_project_runtime.py` preserves the original kernel in `kernel.state-cache-base.mjs`, installs idempotently, and restores ordinary evaluation if the recognized owned shim's laser policy changes. Unknown source is never given a compatibility accessor.

Per-screen cache limits are 2,048 part occurrences / 32,768 part operations; 2,048 prefixes / 256 KiB of prefix keys; 512 reference groups / 64 KiB of keys; and 4,096 semantic tokens / 512 KiB of keys. They are local to one weapon/mode/screen; source packs must remain immutable during evaluation. Diagnostics expose hits, misses, fallbacks, peaks and saturation.

Validation compares 5,343 states across all 69 weapons and three modes against the saved before-shim native calculator, including every state/value field. Additional cases cover the full G18 domain, zero/tiny caches, duplicate/reordered lasers, reference order, non-associative aliases, context fallback and cache isolation. Gate comparisons check exact candidate arrays and both-stage counts for both presets, three modes, Operations budgets and stat floors. Runtime tests verify source preservation, idempotence and rejection of changed sources/policies.

Reproduce after preparing runtime and building the static preview:

```powershell
python tools/prepare_project_runtime.py
python tools/build_github_pages.py
node tests/shared_stats.mjs
node tests/shared_gate.mjs
python -m unittest discover -s tests -p test_shared_runtime.py
node tests/scip_browser.cjs
```

Three alternating timed pairs, following a warmup pair, compare the identical gate with stat reuse disabled/enabled. These are screening times, excluding calibration:

| Fixture | Ordinary state calculation | Shared state calculation |
| --- | ---: | ---: |
| P90, Detonation 80, Recoil | 1,633 ms | 1,462 ms |
| P90, Detonation 80, Agility | 1,515 ms | 1,290 ms |
| G18, full Detonation 200, Recoil | 32.9 ms | 30.2 ms |
| G18, full Detonation 200, Agility | 32.0 ms | 27.3 ms |
| G18, Operations 5,000,000, Agility | 179.8 ms | 112.9 ms |
| M4, Detonation 40, Recoil | 1,669 ms | 1,725 ms |

The gain is workload-dependent. M4 shows a small regression in this sample; a sub-millisecond G18 Operations-200 case also has negligible extra overhead. An initial instrumented profile put native stat folding at only 3% of P90 screening time, versus 38% for G18. Whole-screen timing includes allocation/GC and host variability, so these local measurements are scoped observations rather than universal guarantees. A stale optimizer subprocess was stopped before the reported timing run; earlier contaminated trials were excluded.

See [persistent validation and scoped timings](../data/optimizer_validation/shared_stats_20261116.json). Exhaustive ranking still visits every legal configuration, and large original-cap completion times remain unvalidated.
