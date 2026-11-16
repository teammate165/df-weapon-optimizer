# Documentation index

Use the maintained contracts below for current behavior. Research findings describe
pinned source snapshots; they do not establish Global/Garena-client verification.
[TODO](../TODO.md) owns open requirements and progress; it is not a runtime specification.

## Setup and maintained contracts

- [Builder setup, interaction and validation](../builder/README.md)
- [Deployment workflow and release evidence](github_pages.md)
- [Lowest Recoil objective, constraints and search](recoil_generator.md)
- [Production SCIP model, runtime and validation](scip_optimizer.md)
- [Highest Agility objective](agility_optimizer.md)
- [Shared solution presentation and context lifecycle](solution_preview.md)
- [Calibration workflow](weapon_calibration.md), [input precision](weapon_calibration.md#calibration-input-precision), [deployed source trace](weapon_calibration.md#dfttk-calibration-source-trace)
- [Laser stacking policy](laser_stacking.md), [special-effect coverage and gaps](special_effect_audit.md)
- [Weapon composition](weapon_composition.md), [image loading/cache](weapon_composition.md#image-loading), [catalog portrait audit](weapon_composition.md#portrait-audit)
- [Operations price refresh](operation_prices.md), [database synchronization](dfttk_database_sync.md)
- [Translation desk](../translation/README.md), [weapon identity/duplicate audit](translation_duplicate_audit.md)
- [Terminology](../GLOSSARY.md), [local issue conventions](agents/issue-tracker.md), [triage labels](agents/triage-labels.md), [domain document layout](agents/domain.md)

## Source research and reproducible reports

- [Upstream repository map](delta_gun_tierlist_repo_map.md): the single maintained map; the older root copy was removed after verifying it was a strict subset.
- [Builder capabilities](dfttk_builder_capabilities.md)
- [Main-stat effects](dfttk_stat_effects_source.md): mappings, independent detailed effects and points above 100
- [Response curves and exports](weapon_stat_response_curves.md)
- [Hip accuracy and airborne ADS](hip_accuracy_source_research.md), [class spread ratios](spread_ratios_by_class.md)
- [AN94 timing](an94_automatic_timing.md), [spatial recoil trace](an94_automatic_timing.md#an94-recoil-source), [reset-delay evidence](an94_automatic_timing.md#an94-reset-delay-research): separate timing, spatial and unresolved reset questions.
- [Timed recoil diagnostics](timed_recoil_paths.md)
- Horizontal recoil: [20-shot origin distance](horizontal_recoil.md), [10-shot comparison](horizontal_recoil_first_10.md), [total travel speed diagnostic](horizontal_recoil_speed.md), [selected fastest-200ms metric and earlier window trials](horizontal_window_speed_trial.md). The optimizer contract owns production scoring; these reports have different metrics and units.
- Accessory names: [source transport/localization](official_wiki_accessory_matching.md#official-wiki-accessory-source), [generated ID-matching report](official_wiki_accessory_matching.md)
- Firearm names: [preserved community-source snapshot](firearms_wiki_matching.md#firearms-wiki-source), [generated matching report](firearms_wiki_matching.md). Each report includes its preserved source evidence; refresh scripts retain that appendix.
- [Garena data-fetching assessment](garena_data_fetching_assessment.md)

## Proposals, experiments and withdrawn features

These retain evidence and reproduction instructions; their historical results do
not override the maintained contracts above.

- [Perceived-recoil score proposal](perceived_recoil_score.md): unfinished measurement definition, separate from implemented optimizer loss.
- [Attachment screening experiment](attachment_gate_trial.md), [five-weapon comparison](attachment_gate_five_weapons.md): bounded experiment results; current shared search is specified in the recoil contract.
- [Browser MILP trial](milp_browser_trial.md), [SCIP/WASM feasibility](scip_wasm_feasibility.md): solver experiments.
- [Native weapon-code research and withdrawn implementation](weapon_import_codes.md): retained evidence; cookie saved builds are documented in the builder guide.
- [Manual calibration checklist](throwaway/calibration-game-checklist.md), [translation worksheet remainder](throwaway/untranslated-items.md): working evidence, with outstanding client checks tracked in TODO.

Historical span-based scoring is retained only in the [horizontal report appendix](horizontal_recoil.md#historical-decisions-and-optimizer-trials-obsolete-span-metric).
Dated deployment sections in the deployment guide record past releases; follow its
opening workflow for publication. Generated reports should be refreshed through
their documented scripts, which preserve any consolidated source appendix.
