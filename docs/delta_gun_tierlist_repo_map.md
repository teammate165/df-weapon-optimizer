# Delta Force tier list repository map

Upstream: [AVA-2568/delta-gun-tierlist](https://github.com/AVA-2568/delta-gun-tierlist). Paths verified against commit `c8f3d254e914df1a3509c2be9660c854796f274b`. This is the repository's Python model of Delta Force, based on synchronized game data and separate third-party market data. Global-client equivalence and camera rendering behavior require in-game verification.

## Instructions for future repository requests

Open this map first. Pick the smallest set of files and symbols relevant to the question, then fetch only those files or look up the requested record by ID. Use the pinned commit for reproducibility. For requests about current upstream data, check the latest commit and refresh only relevant paths. Use the SQLite database for catalog lookups within its snapshot. Follow code only when the question depends on how data is interpreted. Update this map when a lookup verifies a new path or a path has moved.

## Data lookup

| Question | Read first | Look for |
|---|---|---|
| Weapon stats, names, defaults, variants | `data/tables/weapons/<weapon_id>.json` | `base.name`, `base.display_name`, `base.panel_attributes`, `rpm`, `damage_profile`, `falloff_segments`, `timings`, `aiming`; `variants[]` shallow-overlays `base`. Use `<weapon_id>:base` or `<weapon_id>:<variant_item_id>` for resolved profiles. |
| Part stats and hidden effects | `data/tables/parts/<slot>.json` | `parts[]` by `item_id`. Common slots include `muzzle`, `barrel`, `foregrip`, `stock`, `optic`. Read `effects[]` for target, modifier, value, and profile reference. |
| Fit, defaults, dependency, conflicts | Weapon table | `default_items`, `sockets[].options`, `provider_sockets`, `coupling`, `extra_occupancy`. Slot labels categorize parts. Socket IDs identify mounting positions. |
| Innate recoil, sway, spread | Weapon table and `data/game/profiles.json` | `base.recoil/spread/sway` summaries; for resolver inputs follow `base.references.waist_recoil_profile_id` for hip and `aiming_profile_id` → `ads_recoil_profile_id` for ADS. Lookup under `profiles`. Recoil records have `continuousFire` and `loop` arrays/scales. |
| Panel stat effect curves | Weapon table and `data/game/mechanism.json` | `base.attribute_rules` → `directRuleTargets`, `curveMappings` → mode-specific `curveIds` → `curves`. Panel IDs 2 range, 3 control, 4 hip-fire accuracy, 5 handling, 6 stability. |
| Calibration | Part table | `tunes[]` gives bounds, step, default and `functions[]` with target, modifier, and curve. |
| Market prices | `data/reference/{weapon,part,ammo}_prices.json` | Join on `weapon_id`, `part_id` (= part `item_id`), or `ammo_item_id`. Check `updated_at`, `window`, `currency`, and `source`. Null means no quote. Weapon prices are for the base gun. |
| Ammo, armor, combat scenario inputs | `data/tables/{ammo,armor,scenarios}.json` | Current calculator tables at the pinned commit. |
| Snapshot provenance and validation | `data/game/{provenance,validation_samples}.json` | Snapshot version, source and integrity metadata. `data/game/{weapons,parts,ammo,armor}.json` are audit snapshots. Runtime loader reads those catalogs from `data/tables/`. |
| Flattened integration exports | `data/export/{weapons,parts,links}.json` | `links[]` is one part installed on a default base weapon. `after` and `state_changed` cover exported fields only and omit recoil profiles and shake multipliers. |
| Published rankings and weapon pages | `data/榜单/`, `docs/榜单/`, `docs/武器/<weapon_id>.md` | Scenario TTK outputs and rendered guides. |

## Code lookup

| File | Entry points |
|---|---|
| `src/engine/game_data.py` | `GameData`, `_load_table_weapons`, `_load_table_parts`, `get_profile`. Source-of-truth rationale in `docs/adr/0004-data-source-of-truth.md`. |
| `src/engine/weapon_state.py` | `build_loadout`, `occupancy_conflict`, `WeaponStateResolver.resolve`, `_resolve_rules`, `_resolve_profiles`. Takes socket → item selections and item → tune ID → setting. Empty selections use the default loadout. Output includes panel, recoil profiles, recoil multipliers, and raw modifier maps. |
| `src/engine/modifiers.py` | `apply_attribute_effects`, `part_effect_layer`, `part_tuning_layer`, `accumulate`. `DisplayAttrValues.*` are UI fields. `WeaponMainAttribute.MainAttrValues.*` modify the modeled panel. Named targets modify behavior. Some `Initial` effects with `value_ref` replace a profile. |
| `src/engine/curves.py` | `Curve.evaluate`, `CurveLibrary`, `modifier_factor`, `apply_modifier`. Start here for interpolation and modifier semantics. |
| `src/engine/loadout.py` | `build_socket_specs`, `LoadoutSolver`, `target_affects_ttk`, `_prune_options`. TTK pruning can discard recoil or shake options. |
| `src/engine/{ballistics,engagement}.py` | `DamageContext`, `build_context_from_state`, `ttk_at`, `ttk_curve`. |
| `src/export.py` | `export_weapons`, `export_parts`, `export_links`, `_state_summary`. |
| `src/collectors/{game_data_sync,normalize,orzice_price_sync}.py` | Upstream sync, normalization, and third-party prices. See `tools/tables_diff.py` for snapshot comparison. |

## Recoil anchors and project database

- M4A1 weapon ID `18010000001`. Its attribute 3 maps to `GRecoil_H`, `GRecoil_V` and gun-kick targets. Attribute 6 maps to `GRecoil_HShake` and `GRecoil_VShake`, among other sway-related targets. Check each weapon's own rules.
- Muzzle part `13130000167` (堡垒水平补偿器) has separate `GRecoil_H`, `GRecoil_HShake`, and `GGunkickH` effects. Keep those targets distinct when validating perceived recoil.
- [delta_force_weapons.sqlite](https://chatgpt.com/library?file_id=libfile_7d6782785f20819195d5ca52207099ea&account_id=personal) contains the pinned catalog and November 11, 2026 price snapshot. Start with `weapons_with_prices`, `parts_with_prices`, `part_effects`, `part_tune_functions`, `weapon_socket_options`, `profiles`, and `mechanism_curves`. Weapon stats are catalog inputs before loadout resolution.

## Local dfttk source refresh (2026-11-12)

AN94-specific paths above (`data/tables/weapons/18010000052.json`, `data/game/profiles.json`, `src/engine/weapon_state.py`) were reverified against upstream commit `67abdb7a2e9472bd13dc3fe091fcb6b724e12d69`. This does not update the initial-import revision for other paths. See [AN94 source trace](an94_automatic_timing.md#an94-recoil-source) for hashes and comparison with dfttk's builder chart/lab.

The project database now also contains direct dfttk snapshot `09f820e0d3ada199-abdb2e6ebdd3`, data version `20261108-an94-bd-shop.1`. The original upstream revision above remains the initial-import provenance. For current mode-specific local stats, use `weapon_mode_stats`, `part_mode_stats`, `weapon_library_stats`, and raw context inputs; see [database sync documentation](dfttk_database_sync.md). User direction gives dfttk precedence on catalog conflicts. Prices and manual translations remain separately sourced; Garena-client equivalence is unverified.

## Hip accuracy and airborne ADS audit (2026-11-13)

Relevant paths reverified at upstream HEAD `1dbd155b864257edb1c261a7d547a8ae521a0ce3`: `data/tables/weapons/18010000001.json`, `data/game/profiles.json`, and `src/engine/weapon_state.py`. These preserve base/max hip spread and ordinary ADS rules, but do not establish airborne ADS or a shot-by-shot hip-spread growth/recovery law. See [source research](hip_accuracy_source_research.md) for scope, source citations and implications for agility. This audit does not refresh the project catalog or assert Global/Garena verification.
