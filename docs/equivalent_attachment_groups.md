# Equivalent sights, lasers and patch counts

Implemented and published on 2026-11-17 after a fixed-work speedup was measured. Source `8ea7734`, generated `711f24b`, release `0a828ed25f230959`. [Successful Pages deployment](https://github.com/teammate165/df-weapon-optimizer/actions/runs/43940285040). Both native optimizer presets use `tools/choice_groups.mjs`; manual selection still offers the concrete attachments, and every result reconstructs real source IDs.

Sight and laser classes compare the actual mode-specific source operations, including reference changes, passive penalties and enabled benefits. Price and slot compatibility determine the cheapest representative available in each context. Items involved in coupling/occupancy/fire-control dependencies, child providers, bound ammunition or score-affecting calibration remain distinct. Exact identity locks override grouping.

For native objectives, `ScopeCameraTuneDistance` and `ScopeZoomTuneRate` change the view rather than the optimized stats. Those controls do not distinguish search classes and are skipped during calibration. Controls affecting either objective remain separate and are fully searched. A changed scorer or unknown runtime disables grouping. This is equivalence for the modeled objectives, not a claim that sights have identical magnification or appearance in the game.

Patch choices become a vector of quantities **per effect type**, not just a total number of patches. The five M4A1 handguard panel types have different control, handling, stability and accuracy effects. The same panels fit both dedicated patch sockets and two shared rails; those rail-panel choices now belong to tactical search too.

The tactical generator enumerates count vectors and laser classes, then uses a bounded, cached minimum-cost matching to assign them to compatible physical sockets. A laser using a shared rail consumes patch capacity. Fixed items and occupied ordinary slots remain fixed. Sockets that override a bundled part remain separate, since removing its effects can change the result; replacing a bundled laser also updates the enabled-device limit. Non-integer stat accumulation disables cross-slot merging to preserve floating-point order. Unsupported items retain slot-specific classes.

Ordinary neighborhoods, required-riser completion, symbolic mounting constraints, source-result caching and retained pools use compatible representatives. A canonicalization step prevents interchangeable placements consuming extra shortlist entries. Caches are capped at 2,048 option sets, 2,048 normalized configurations and 1,024 assignment results. The existing 256 ordinary / 16 per-base tactical / 512 complete caps and total time budget remain intact.

## M4A1 reduction

On the default M4A1 handguard, five panel types fit five patch-capable sockets, including two shared rails. Standard PEQ/LA-3C/PERST/DBAL devices share one modeled class; OLIGHT remains distinct because its penalties differ. With no locks and an 800-point cap:

| Search component | Concrete choices | Grouped choices |
| --- | ---: | ---: |
| Root sights, excluding risers | 28 | 12 |
| Patch/laser layouts on the default ordinary base | 51,840 | 630 |

The tactical reduction is **82.3x**, or about **98.8% fewer configurations**. All 630 source-stat/cost states are preserved. A fixed workload evaluates every raw and grouped layout using the same native resolver and stat calculator; observed timings are in [the validation report](../data/optimizer_validation/choice_groups_20261117.json). This is not an overall optimizer wall-time multiplier: a five-second search still runs against its five-second total budget, using the saved work to search/refine more distinct builds.

The classes and reduction depend on the weapon, installed parents, mode, prices, remaining budget and locks. Four nominally equivalent standard lasers can have different Operations prices, so the cheapest compatible representative is chosen. Total patch count alone would incorrectly merge different effects. This grouping does not eliminate the separate structural attachment search.

## Validation

Checks compare all 51,840 M4A1 tactical layouts with grouped source states and cost, including canonical reconstruction samples. Additional tests cover 324 native sight/objective/tuning comparisons across both presets and three modes, a smaller tactical budget, locks, two locked lasers, shared slots, bundled replacements, dependency-sensitive IDs, scored calibration, fractional arithmetic and unknown-scorer fallback. Focused anytime, backend/CLI, source-effect, cancellation and local/static browser checks verify concrete generated builds.

```powershell
node tests/choice_groups.mjs
node tests/anytime_optimizer.mjs
node tests/special_effects.mjs
python tools/build_github_pages.py
node tests/scip_browser.cjs
$env:LOCAL_SITE_URL='http://127.0.0.1:8766/'
node tests/exhaustive_local_browser.cjs
```

The fixed-work benchmark and raw reports are retained under `.scratch/tactical-grouping/`. [Public release verification](../data/optimizer_validation/choice_groups_release_20261117.json) confirms grouping is active on the live site.
