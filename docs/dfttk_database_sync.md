# DFTTK database synchronization

Completed 2026-11-12 against dfttk data version `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`, snapshot `09f820e0d3ada199-abdb2e6ebdd3`. The source reports `gameBuildVersion: unknown`. Per user instruction, dfttk takes precedence over conflicting imported catalog fields. This does not establish Garena-client parity or measured recoil behavior.

## Results

- 69 weapons × 3 modes = **207 weapon/mode rows**.
- **1,745 library attachment/mode rows**: 581 `sol`, 583 `mp`, 581 `bd`. Preserve these availability differences instead of copying an attachment into every mode.
- **201 downloaded source files**, each SHA-256 checked, retained as raw JSON in SQLite and cached under `data/dfttk/`.
- Existing compatibility catalog retained: 88 weapon profiles, 1,162 parts, 1,186 normalized profiles, and 102 normalized mechanism curves. Legacy weapon/part columns describe `sol` input data; they are not a substitute for mode-aware calculations.
- Eight existing fields/structures changed; 792 fields were added to existing weapon records to retain mode, schedules, raw inputs, and library statistics. New mode tables are additional data, not 207 replacements for distinct weapons.
- No dfttk catalog-versus-combat consistency disagreements were found by the reused normalizer. No conflicting normalized profile IDs or mechanism curves were found.
- Prices, their timestamps and unknown-price status, and the separate translation file were preserved. Detonation shop information is archived separately; its prices must not overwrite market quotes in a different mode/currency.

Source discovery and final-app requirements: [builder capabilities](dfttk_builder_capabilities.md).

## Database access

| Table/view | Purpose |
| --- | --- |
| `weapon_mode_stats` | Explicit `(weapon_id, mode)` key, queryable base combat/panel columns, normalized input `record_json`, and faithful source `library_json`. |
| `weapon_library_stats` | Convenience view for library ADS/sprint-to-fire milliseconds, reload seconds, movement m/s, spread and sway degrees. |
| `part_mode_stats` | Full mode-specific library entry: contextual effects, weapon associations and display data. One `(item_id, mode)` row, shared across compatible weapons. |
| `dfttk_part_effects` | Raw effects keyed by `(weapon_id, item_id, mode)`, preserving weapon context and all three modes. Missing and empty source effects remain distinct JSON `null` and `[]`. |
| `dfttk_raw_files` | Complete source JSON, exact source URL, SHA-256 and snapshot ID. Includes shared build cores/shards, combat packs, library indexes, runtime UI data, library insights, ammo, defense, client config, and Detonation shop. |
| `dfttk_snapshots` | Manifest, source provenance, version and import timestamp. |
| `dfttk_conflicts` | Field-level before/after values, entity, mode, resolution (`dfttk`), source URL, and synchronization run. |

Mode keys: `sol` Operations (烽火地带), `mp` Warfare (全面战场), `bd` Detonation (黑潮爆破). Validate the key; do not silently fall back to `sol`.

```sql
SELECT mode, flesh_damage, armor_damage, muzzle_velocity_mps,
       recoil_control, handling, stability, hip_fire_accuracy
FROM weapon_mode_stats WHERE weapon_id = '18010000001';

SELECT mode, ads_ms, sprint_to_fire_ms, ads_move_mps, hip_spread_degrees
FROM weapon_library_stats WHERE weapon_id = '18010000001';

SELECT entity, entity_id, mode, field_path, previous_json, incoming_json
FROM dfttk_conflicts WHERE change_kind = 'changed';
```

Raw versus resolved values are deliberately separate. For example, M4A1 raw aiming-profile ADS-on is 0.28 seconds while its library resolved ADS is 302 milliseconds; those are different calculation stages, not a units conversion error. The library's resolved baseline uses source defaults/modifiers and rounding. Keep full precision for optimization, then format for display. Displayed points and effective main attributes also differ; the raw weapon stores both.

All `weapon_mode_stats.record_json` entries include the raw catalog summary, raw weapon data, schedule rules, full mode references, normalized rules and base stats, plus library stats. Use archived build inputs for behavior/hold-breath profiles, full tune availability, mode-limited socket metadata, and source modifier fields not represented in the compatibility tables. Rebuild the selected weapon's pack from its core plus the keys in `sharedRecordKeys`; do not indiscriminately attach all shared records.

## Conflicts resolved to dfttk

The production import run is `20261112T100726099520Z`.

| Entity | Field | Previous | Dfttk |
| --- | --- | --- | --- |
| AN94 `18010000052:base` | `sdk_timing.burst_fire_cd_s` | 0.18 | 0.17 |
| AN94 `18010000052:base` | `sdk_timing.burst_fire_interval_s` | 0.333333 | 0.033333 |
| AN94 `18010000052:base` | `sdk_timing.burst_interval_s` | 0.333333 | 0.033333 |
| AN94 `18010000052:base` | coupling rules | Five default mounts | Also two forced handguard rules for barrels `13020000628`/`13020000629` |
| QJB201 `18040000004:base` | combat variant item IDs | Prior list | Adds `13120000380` |
| QJB201 `18040000004:13020000529` | combat variant item IDs | Prior list | Adds `13120000380` |
| Part `13120000380` | original name | Internal placeholder | `HVK风怒供弹套件` |
| Part `13040000252` | effects / `GRateOfFire`, `Mult_A` | -0.5 | -0.05340485436893211 |

The last value is a source modifier, not an asserted final percentage change in firing rate. The exact modifier algebra must be used.

Dfttk additionally now publishes AN94 `fireScheduleRules` for all modes: `firstShotsRpm`, `rpm:1800`, `shots:3`, `sustainedRpm:600`. This is a new explicit contract, separate from the changed Burst fields above. It agrees with the user's accelerated-opening observation, but does not settle the measured 3→4 interval or pause/reset threshold. The AN94 validation backlog remains open.

Full logs:

- [Field-level JSONL](../data/dfttk_sync_logs/20261112T100726099520Z.jsonl)
- [Run summary](../data/dfttk_sync_logs/20261112T100726099520Z.summary.json)
- Pre-update database: `data/backups/delta_force_weapons.before-dfttk-20261112T100726099520Z.sqlite`.

## Reproduction and validation

```powershell
uv run --no-project tools/fetch_dfttk.py
uv run --no-project tools/sync_dfttk_database.py
uv run --no-project python -m unittest discover -s tests -v
```

Fetcher resolves the current manifest once, then uses its immutable release root and expected hashes. The importer verifies cached hashes before writing, backs up the existing database using SQLite's backup API, and commits data changes together. Re-running an unchanged snapshot causes no field changes. Prior snapshots and conflict runs remain available; `metadata.dfttk_snapshot_id` identifies the current one. Prefer a single active writer while synchronizing.

Compatibility normalizers are vendored from upstream revision `c8f3d254e914df1a3509c2be9660c854796f274b`, under `tools/vendor/delta_gun_tierlist/`, with its MIT license and only the internal import path adjusted. The importer explicitly selects the summary and profile mode, retains source zeros, adds newer schedules, and archives full source data beyond that older normalization schema. Raw per-weapon mode effects are authoritative when a globally deduplicated legacy part is insufficient.

Validation compared all 207 library weapon entries and all 1,745 attachment entries to source JSON; checked combat scalar values for every mode, SQLite integrity/foreign keys, every legacy tune range, repeated-import stability, deliberate mismatch logging, corrupt-cache rejection, and unchanged prices/translations. Shared-core reconstruction was compared against the complete M4A1 build pack. End-to-end live builder recalculation and actual-game behavior are not validated by a data import.
