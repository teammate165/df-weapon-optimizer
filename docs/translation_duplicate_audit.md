# Translation duplicate audit

Checked against `delta_force_weapons.sqlite` on 2026-11-12. This checks imported catalog identities, not Global-client names.

## Findings

- 88 weapon profiles represent 69 distinct weapon IDs; 16 weapons have multiple profiles (19 additional profiles).
- Every repeated weapon ID has exactly one base profile; all additional profiles are marked variants and reference an existing attachment ID.
- Each weapon ID has one consistent original name. No original weapon name is shared across distinct weapon IDs.
- Attachment IDs are unique. One attachment name is repeated: the placeholder `(?????)` (?unnamed configuration?, provisional interpretation), across four distinct IDs. These must not be merged by name.

## Repeated weapon IDs

| Original weapon name | Weapon ID | Profiles | Variant attachment IDs |
| --- | --- | ---: | --- |
| M4A1 | `18010000001` | 2 | `13020000173` |
| AKM | `18010000006` | 2 | `13020000355` |
| ASh-12 | `18010000012` | 3 | `13020000569`, `13020000603` |
| M16A4 | `18010000014` | 2 | `13020000173` |
| M7 | `18010000016` | 2 | `13020000383` |
| CAR-15 | `18010000031` | 2 | `13020000173` |
| AS-Val | `18010000037` | 2 | `13020000561` |
| K437 | `18010000040` | 2 | `13020000543` |
| MK47 | `18010000043` | 3 | `13020000559`, `13020000560` |
| MCX-LT | `18010000044` | 2 | `13020000573` |
| P90 | `18020000002` | 2 | `13020000579` |
| MK4 | `18020000012` | 3 | `13020000563`, `13020000564` |
| 汤姆逊冲锋枪 | `18020000046` | 2 | `13050000410` |
| PKM | `18040000001` | 2 | `13020000625` |
| M250 | `18040000003` | 2 | `13020000524` |
| QJB201 | `18040000004` | 2 | `13020000529` |

## MK4 detail

Weapon ID `18020000012` has three profiles:

- `18020000012:base`: base MK4.
- `18020000012:13020000563`: associated with barrel `MK4?????`.
- `18020000012:13020000564`: associated with barrel `MK4??????`.

All three use the original weapon name `MK4`; the two variant attachments already have separate entries in the parts catalog.

## Repeated attachment placeholder

| Item ID | Slot |
| --- | --- |
| `13030000221` | `internal` |
| `13050000436` | `handguard` |
| `13050000437` | `handguard` |
| `13210000018` | `internal` |

## Translation UI implication

Present one weapon-name entry per weapon ID, while retaining profile-to-weapon mappings. Keep attachments keyed by item ID, including the four unnamed records. The UI now presents one entry per weapon ID; older profile keys map to the base entry. Migration preserves a backup and rejects conflicting translations.

## Reproduce

```sql
SELECT weapon_id, name, COUNT(*) AS profiles
FROM weapons GROUP BY weapon_id HAVING COUNT(*) > 1;

SELECT name, COUNT(DISTINCT weapon_id) AS weapon_ids
FROM weapons GROUP BY name HAVING COUNT(DISTINCT weapon_id) > 1;

SELECT name, COUNT(*) AS items, GROUP_CONCAT(item_id) AS item_ids
FROM parts GROUP BY name HAVING COUNT(*) > 1;
```
