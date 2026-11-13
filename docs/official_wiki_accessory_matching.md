# Official wiki accessory matching

Source: [https://www.playdeltaforce.com/act/officialwiki/en/#/accessory/](https://www.playdeltaforce.com/act/officialwiki/en/#/accessory/). Retrieved 2026-11-12T08:42:42.323093+00:00.

433 official accessories; 433 exact ID matches; 150 selectable catalog accessories absent from this source.

Applied: 340 missing names filled provisionally; all 162 existing entries preserved. 5 existing accessory names differ from the official name and were kept.

Names are linked by shared item ID, not fuzzy text translation. The official Chinese locale is Traditional Chinese; the local original is Simplified Chinese. Official-source matching does not establish current in-game patch verification. Internal components and weapons are outside this import.

Machine-readable pairs, source links, unmatched IDs, and existing-name differences: `data/official_accessory_names.json` (written on apply). Source discovery: [official_wiki_accessory_source.md](official_wiki_accessory_source.md).

Reproduce: `uv run --no-project tools/match_official_accessories.py` (preview); add `--apply` to fill missing names. Existing names/status/notes are preserved.

## Examples

| Item ID | Catalog original | Official English | Official Chinese (Traditional) |
| --- | --- | --- | --- |
| `13020000167` | .357口径左轮长枪管 | .357 Revolver Long Barrel | .357口徑左輪長槍管 |
| `13020000173` | AR特勤一体消音组合 | AR SpecOps Integrally Suppressed Combo | AR特勤一體消音組合 |
| `13020000230` | SV98升华超长枪管 | SV-98 Sublime Ultra-Long Barrel | SV-98昇華超長槍管 |
| `13020000231` | SV98龙萤轻枪管 | SV-98 Dragonfly Light Barrel | SV-98龍螢輕槍管 |
| `13020000239` | M249犀牛长枪管 | M249 Rhino Long Barrel | M249犀牛長槍管 |
| `13020000291` | SV98灵巧短枪管 | SV-98 Agile Short Barrel | SV-98靈巧短槍管 |
| `13020000311` | M249海湾短枪管 | M249 Gulf Short Barrel | M249海灣短槍管 |
| `13020000320` | SG552骑士重枪管 | SG552 Knight Heavy Barrel | SG552騎士重槍管 |
