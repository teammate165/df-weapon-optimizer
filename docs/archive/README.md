# Research archive

These reports record earlier experiments, benchmark configurations, and withdrawn work. For current behavior and open validation, see the [documentation index](../README.md) and [project backlog](../../TODO.md).

## Attachment screening and solver experiments

- [Attachment screening trial](attachment_gate_trial.md) and [five-weapon comparison](attachment_gate_five_weapons.md)
- [Browser MILP trial](milp_browser_trial.md) and [SCIP/WASM feasibility](scip_wasm_feasibility.md)
- [Browser MILP engines](browser_milp_engine_research.md) and [browser CP/SMT and hosting](browser_cp_hosting_research.md). The [solver-engine decision](../browser_solver_engine_decision.md) summarizes the comparison.

## Earlier M4A1 screening studies

- [Exhaustive screening feasibility](m4a1_exhaustive_screening_feasibility.md), [layout reduction options](m4a1_layout_reduction_options.md), and [dominance prototype](m4a1_dominance_prototype.md). The [restored-population study](../exhaustive_screening_improvements.md) records the subsequent policy and validation.
- [Worker efficiency study](m4a1_solver_efficiency_20261117.md) and [partial-state merging census](m4a1_partial_state_merging_study.md). See the [merged ranked screening report](../m4a1_merged_ranked_screening.md) for the implemented repeat run.

## Withdrawn work

- [Native weapon-code research and withdrawn implementation](weapon_import_codes.md)

## Local artifacts

The repository-local `.scratch-archive/` holds archived issues and experiment bundles, earlier release exports, the documentation consolidation records, the exhaustive research cache, and generated exact-cache test fixtures. It is Git-ignored and available in the checkout where the cleanup was performed. Current issues and working evidence remain under `.scratch/`. Some archived scripts and logs embed the original paths or URLs. For historical replay, restore the relevant bundle to its original location under `.scratch/`.
