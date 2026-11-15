# Shared top-5% attachment search

All current and future presets using `optimizer_engine.mjs` inherit the same
attachment gate. No preset-specific opt-in or recoil-only condition exists.
Preset objectives, normalization, weights and category selection are unchanged.

Each pass builds complete compatible one-slot replacements around the current
incumbent. Required raised optics are completed before scoring; locks, mode
restrictions, hidden parts, enabled-laser policy, missing quotes and budget caps
are checked before ranking. The gate evaluates these configurations at default
calibration, deduplicates mounted-build signatures and retains the best
`ceil(0.05 * N)` under the current search comparator. A nonempty neighborhood
therefore retains at least one candidate.

Performance searches rank feasibility, then preset objectives and cost.
Price-target searches preserve their existing feasibility and cheaper-build
priorities. Candidates that currently miss a stat floor can still be ranked;
the gate does not declare them globally impossible. The incumbent stays outside
the pruning decision and cannot be overwritten by a worse survivor.

Survivors restore legal tuning on unchanged parts and search every legal position
of changed controls, one control at a time. Accepted incumbents also undergo
coordinate calibration across all controls. Displaced tuning is removed and
contextual positions revalidated. Screening-only builds do not enter the final
calibrated candidate frontier. Default, fixed and accepted incumbent calibration
continues to work even when there are no unlocked replacements.

This production implementation gates a **per-pass replacement neighborhood**.
It does not enumerate every full-weapon attachment combination, and its
coordinate calibration is not joint Cartesian enumeration of all tuning sliders.
The earlier bounded brute-force experiments are not a global proof for this
production adaptation. Better calibrated builds can be discarded at screening;
coordinated swaps and local minima can hide improvements. Results remain
**best found**, without a global optimality guarantee.

Responses report `attachment_gate` with fraction, screening mode, neighborhood
scope and aggregate screened/retained counts. Counts include all internal price
target searches. `global_optimality` is false. The page displays the shared gate
and best-found status without changing each preset's scoring label.

The browser export copies `attachment_gate.mjs` into the versioned model graph.
The calculator and gated search run entirely in the static module worker, with
no backend service or custom response headers. Live source and deployable export
remain on separate `source` and `main` branches.

Validation:

```powershell
node tests/attachment_gate.mjs
node tests/top5_engine.mjs
python -m unittest discover -s tests -p test_recoil_generator.py
python -m unittest discover -s tests -p test_builder_server.py
node tests/optimizer_selection.mjs
node tests/special_effects.mjs
node tests/laser_stacking.mjs
```

The future-preset regression dynamically adds an objective to the preset registry
and verifies automatic gating, the exact top-5% count for a single neighborhood,
legal optics and stat replay without editing the engine's preset handling.
Integration checks cover both current presets, all three modes, locks, budgets,
floors, distinct categories, deterministic repeated output and source replay.
Full-catalog and static/live browser evidence is recorded in TODO.md and the
[deployment history](github_pages.md).
