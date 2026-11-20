# Development handoff

The `source` branch contains the builder, solver, studies and validation code. Read the [project backlog](../TODO.md) for the remaining requirements and the [documentation index](README.md) for current contracts.

## Restore the local environment

1. Install Python 3 and Node.js. Download the synced SQLite dataset from the project Library links in [AGENTS.md](../AGENTS.md) and place it at `delta_force_weapons.sqlite` in the repository root. If the Library copy predates the pinned snapshot, copy the working database from the original machine or follow the [database sync guide](dfttk_database_sync.md).
2. Run `python tools/verify_calibration_reference.py` to prepare the model runtime under `.scratch/calibration-check/`. For an identical offline run, copy that directory from the original machine.
3. Run `python tools/builder_server.py` for the local builder. For a local static preview, run `python tools/build_github_pages.py --public --output .scratch/pages-catalog-exact`. The research export without `--public` also needs `python tools/fetch_highs_runtime.py`.
4. For browser checks, use the [deployment and browser validation guide](github_pages.md#catalog-exact-ordinary-preview).

## Resume catalog certification

The staged exact preview proves Max first, then Min and Balanced against the certified endpoints. It keeps the normal recoil scoring, locks and stat floors. It supports the optional 5% reduction relative to the equipped build. Warfare has one unpriced Max. The existing public M4A1 beta is a separate, scoped route.

- The [tuned CI-19 Detonation case](../data/optimizer_validation/catalog_handoff_20261121/ci19-release-gate-request.json) certified Max at 940 points, Min at 560 and Balanced at 640 in 159.64 seconds. [Strict report](../data/optimizer_validation/catalog_handoff_20261121/ci19-strict-finite-kick.json)
- Unrestricted M4A1 Detonation at 800 points hit 300 seconds with all four Max partitions still open. That first case stopped the fail-fast catalog gate. Start with this case, compare per-partition work and timing, and rerun the catalog gate after it passes. [Gate report](../data/optimizer_validation/catalog_handoff_20261121/catalog-release-gate-final.json)
- The reduced native oracle covered 207 weapon and mode pairs, and the short full-budget smoke covered 138 priced cases. Full-budget catalog certification and rollout remain open. [Native oracle](../data/optimizer_validation/catalog_handoff_20261121/catalog-exact-final-new-native.json) · [Smoke report](../data/optimizer_validation/catalog_handoff_20261121/catalog-exact-full-budget-smoke.json)

Run these after building the static preview. The first command isolates the open M4A1 case. The second repeats the CI-19 control case.

```powershell
node tests/exact_ordinary_native_oracle.mjs .scratch/pages-catalog-exact/data --full-budget-catalog --staged --require-certificates --weapon=18010000001 --mode=bd
node tests/exact_ordinary_native_oracle.mjs .scratch/pages-catalog-exact/data --full-budget-catalog --staged --require-certificates --weapon=18010000038 --mode=bd --request-overrides=data/optimizer_validation/catalog_handoff_20261121/ci19-release-gate-request.json
```

The validation files linked here travel with the source branch. Older backlog links into `.scratch/` and `.scratch-archive/` refer to artifacts on the original machine.

The raw partial-state census and three full exact-DAG survivor exports remain local. The study documents and compact validation summaries are included.
