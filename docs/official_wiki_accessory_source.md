# Official wiki accessory source

Retrieved 2026-11-12 (Asia/Bangkok) from [Delta Force Official Wiki accessories](https://www.playdeltaforce.com/act/officialwiki/en/#/accessory/), using HTTP requests without login. This establishes official website names and identifiers, not a verified current Global client patch or in-game test.

## Transport and snapshots

The page loads [main-Dby1Scop.js](https://www.playdeltaforce.com/act/officialwiki/assets/main-Dby1Scop.js) and [Milo SDK](https://www.playdeltaforce.com/act/milo-next/milo.js). Bundle configuration specifies activity `4005360_Qa9W4x`, instance `4005360`, and public flow token `nkxYQl`. The [activity configuration](https://sg-apps.vasdgame.com/amside/page/4005360_Qa9W4x) resolves that token to flow `100005405` and explicitly describes the flow as requiring no login.

POST URL: `https://sg-apps.vasdgame.com/ide/`, content type `application/x-www-form-urlencoded`. Common form fields:

```text
iChartId=100005405
sIdeToken=nkxYQl
sLanguage=en
instanceid=4005360
```

Requests and local snapshots:

| method field | param field (JSON string) | Snapshot |
| --- | --- | --- |
| `projectd_oversea/config.list` | `{"configType":"all"}` | [configuration](../.scratch/official-wiki/config_response.json) |
| `projectd_oversea/object.list` | `{"primary":"acc","second":"","third":"","objectID":""}` | [accessories](../.scratch/official-wiki/accessories_response.json) |

Responses returned `iRet=0` and `jData.data.code=0`. Configuration is under `jData.data.data.config`; accessories are under `jData.data.data.list`. The accessory response contains 433 records with 433 distinct `objectID` values. `id` is a separate wiki record identifier; preserve `objectID` for catalog matching. Example: `objectID=13020000173`, `objectName={{13020000173.name}}`, `secondClass=accBarrel`.

## Localization

Configuration supplies the complete localization URLs. The frontend merges a static UI dictionary with these external dictionaries, resolving item names using their `objectID` keys:

- [English data dictionary](https://deltaforcewiki.vasdgame.com/playerhub/40001/language/language_en_2025012019.json), snapshot [language_en.json](../.scratch/official-wiki/language_en.json).
- [Traditional Chinese data dictionary](https://deltaforcewiki.vasdgame.com/playerhub/40001/language/language_zh-tw_2025012019.json), snapshot [language_zh-tw.json](../.scratch/official-wiki/language_zh-tw.json).

These are JSON objects keyed by string item IDs; each item's `name` is its localized name. All 433 accessory IDs have a nonempty `name` in both dictionaries. Example: `13020000173.name` is `AR SpecOps Integrally Suppressed Combo` in English and `AR特勤一體消音組合` in Traditional Chinese. Other fields contain localized effect text (`adv_*`, `dis_*`), descriptions, and source text.

The configuration advertises `en`, `fr`, `es`, `ru`, `de`, `ar`, `zh-tw`, `pt`, `ko`, `ja`, and `tr`. Simplified Chinese (`cn` or `zh-cn`) is absent. The bundle contains a static `cn` UI dictionary but excludes it from supported route languages; that static dictionary does not establish Simplified Chinese item data. Two exploratory filenames, `language_cn_2025012019.json` and `language_zh-cn_2025012019.json` under the same localization directory, both returned HTTP 404. This does not prove that no other Chinese service exists.

The `2025012019` URL suffix is preserved as a source identifier; it is not treated as a verified data version or current client patch. Wiki coverage is incomplete relative to the local selectable-attachment catalog, so missing IDs must remain unmatched. An exact shared ID supports an official-wiki mapping, but does not replace the backlog's Global-client validation requirement.
