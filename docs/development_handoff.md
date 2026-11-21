# Development handoff

The `source` branch contains the builder, solver, studies and validation code. Read the [project backlog](../TODO.md) for the remaining requirements and the [documentation index](README.md) for current contracts.

## Restore the local environment

1. Install Python 3 and Node.js. Download the synced SQLite dataset from the project Library links in [AGENTS.md](../AGENTS.md) and place it at `delta_force_weapons.sqlite` in the repository root. If the Library copy predates the pinned snapshot, copy the working database from the original machine or follow the [database sync guide](dfttk_database_sync.md).
2. Run `python tools/verify_calibration_reference.py` to prepare the model runtime under `.scratch/calibration-check/`. For an identical offline run, copy that directory from the original machine.
3. Run `python tools/builder_server.py` for the local builder. For a local static preview, run `python tools/build_github_pages.py --public --output .scratch/pages-catalog-exact`. The research export without `--public` also needs `python tools/fetch_highs_runtime.py`.
4. For browser checks, use the [deployment and browser validation guide](github_pages.md#catalog-exact-ordinary-preview).

## Resume catalog certification

The staged exact preview proves Max first, then Min and Balanced against the certified endpoints. It keeps the normal recoil scoring, locks and stat floors. It supports the optional 5% reduction relative to the equipped build. Warfare has one unpriced Max. The existing public M4A1 beta is a separate, scoped route.

### Continue the unlimited full arsenal sweep

The sweep is halted at the user's request. On explicit resume, continue the same 204-case plan in catalog order, running Detonation (`bd`), Operations (`sol`) and Warfare (`mp`) serially for each weapon. Exclude Compound Bow (`18150000001`). The original run used the frozen solver and catalog under `.scratch/arsenal-unlimited-batch-01/source`, eight workers, and 32 requested partitions. Detonation uses the weapon's own cap, Operations uses the gate's default budget of 300,000, and Warfare is unpriced.

| Case | Recorded result |
|---|---|
| M4A1 Detonation | Certified in 692.57 s |
| M4A1 Operations | Certified in 1,921.49 s, the first 20-minute overrun |
| M4A1 Warfare | Halted during Max. Restart this case from the beginning. |

The [status manifest](../.scratch/arsenal-unlimited/status.json) records the two certificates and the first overrun. Keep both completed JSON reports, the manifest, and the [progress log](../.scratch/arsenal-unlimited/progress.log). There are 202 cases left. The interrupted search has no saved solver state.

Before restarting the batch, add resume handling to the [local sweep runner](../.scratch/arsenal-unlimited/run.py). It currently starts with empty results and opens case output files for writing. Initialize from the halted manifest, retain the existing overrun history, skip certified weapon/mode pairs, and save each new result and overrun as it happens. Preserve prior output and use fresh files for the restarted Warfare attempt. Check that the old runner and solver PIDs are gone before launch. If moving machines, copy the manifest, certificates and frozen snapshot together so the resumed cases use the same inputs.

Each case uses `--seconds=0`. Count a case when it first reaches 1,200 seconds. Let the first two such cases run to completion. At the third, terminate the active solver and end the sweep, preserving completed reports and recording the canceled case. With one overrun already recorded, the **second new overrun** triggers cancellation. Verify the resume and stop behavior with a short process test before launching the long run.

The next pending case uses this command from the frozen snapshot. The batch runner applies the overrun rule around this command.

```powershell
node tests/exact_ordinary_native_oracle.mjs .scratch/pages-catalog-exact/data --full-budget-catalog --staged --require-certificates --weapon=18010000001 --mode=mp --seconds=0 --workers=8 --partitions=32
```

### Earlier five-minute release checks

- The [tuned CI-19 Detonation case](../data/optimizer_validation/catalog_handoff_20261121/ci19-release-gate-request.json) certified Max at 940 points, Min at 560 and Balanced at 640 in 159.64 seconds. [Strict report](../data/optimizer_validation/catalog_handoff_20261121/ci19-strict-finite-kick.json)
- Unrestricted M4A1 Detonation at 800 points hit 300 seconds with all four Max partitions still open in the earlier fail-fast gate. With eight workers and 32 partitions, the updated solver found the eventual certified Max within five minutes and completed all proofs in the unlimited run. [Earlier gate report](../data/optimizer_validation/catalog_handoff_20261121/catalog-release-gate-final.json) · [Updated proof](../.scratch/solver-core-scaling/m4a1-three-kick/full-unlimited.json)
- The reduced native oracle covered 207 weapon and mode pairs, and the short full-budget smoke covered 138 priced cases. Full-budget catalog certification and rollout remain open. [Native oracle](../data/optimizer_validation/catalog_handoff_20261121/catalog-exact-final-new-native.json) · [Smoke report](../data/optimizer_validation/catalog_handoff_20261121/catalog-exact-full-budget-smoke.json)

Run these after building the static preview to repeat the five-minute M4A1 and tuned CI-19 checks.

```powershell
node tests/exact_ordinary_native_oracle.mjs .scratch/pages-catalog-exact/data --full-budget-catalog --staged --require-certificates --weapon=18010000001 --mode=bd
node tests/exact_ordinary_native_oracle.mjs .scratch/pages-catalog-exact/data --full-budget-catalog --staged --require-certificates --weapon=18010000038 --mode=bd --request-overrides=data/optimizer_validation/catalog_handoff_20261121/ci19-release-gate-request.json
```

The validation files linked here travel with the source branch. Older backlog links into `.scratch/` and `.scratch-archive/` refer to artifacts on the original machine.

The raw partial-state census and three full exact-DAG survivor exports remain local. The study documents and compact validation summaries are included.
