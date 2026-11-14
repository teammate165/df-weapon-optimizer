# Internal component identity audit

Snapshot audited 2026-11-14 against the local SQLite catalog and dfttk snapshot `20261108-an94-bd-shop.1`.

The translation desk calls parts with `selectable=false` internal components. The importer derives that flag from the source display object's `playerSelectable`. This is a source-model classification, not proof of what the Global client exposes. The placeholder original name means internal accessory followed by that component's own item ID, not its weapon ID.

Join item ID to `weapon_socket_options.item_id`, then join `profile_key` to `weapons` to find associated weapon IDs. Combine those with `parts.slot` for a descriptive identity. Retain `provider_item_id`, `socket_id`, and `is_default`: a component can belong to another attachment and its default status is contextual. Do not infer a particular variant, retail attachment name, or installed configuration from slot alone.

Of 510 internal records, 435 associate with one weapon, 70 with multiple weapons, and five have no socket association. 272 are default options somewhere. 40 have modeled effects and one has calibration, so removing these records from calculations would be unjustified.

Examples:

| Component item ID | Source association | Safe descriptive identity |
| --- | --- | --- |
| 13020000344 | M4A1, barrel, default option | M4A1 default barrel component |
| 13020000582 | M4A1, barrel, nondefault option | M4A1 barrel component; exact variant unresolved |
| 13040000143 | AKM, stock, default option | AKM default stock component |
| 13050000385 | M4A1, handguard, nondefault option | M4A1 handguard component; exact variant unresolved |

[All 510 inferred identities and contextual associations](internal-component-identities.csv). These labels are hypotheses/descriptions, not verified translations. The CSV preserves original names and IDs and does not overwrite translation entries.

Implementation evidence: `tools/vendor/delta_gun_tierlist/normalize.py` in `normalize_parts` derives selectable from `display.objects[item_id].playerSelectable`; `tools/translation_server.py` in `catalog` names nonselectable rows Internal component. Raw source placeholders are present in `data/dfttk/locales/zh-CN/items.json`. The database is local and excluded from git; this export records the queried associations for remote review.

Prioritize the 150 selectable attachments missing English names for manual translation. Keep the 510 internal records in a separate identification list; they are not 510 confirmed shop attachments requiring translation.
