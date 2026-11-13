# Archived weapon import-code research

**Scope decision:** the user removed game-code lookup/publication and workshop-code support from the project because native lookup requires server contact. The app now offers cookie-backed saved builds. The observations below are retained as research, not an implementation backlog.

Investigated 2026-11-13. No actual-client import, publication, calibration round-trip or off-step test was performed.

## Integration conclusion

No verified offline encoder from arbitrary attachments/tuning to working game codes was found. The official website copies supplied codes and retrieves published schemes by a separate catalog ID. Known official codes can supply attachment layouts, but the fetched records omit calibration. Arbitrary-code resolution and generation remain unsupported by the inspected evidence. Decimal acceptance in the game remains unverified.

Keep app JSON export/import for arbitrary builds, including numeric tuning, clearly named as app data. A known-official-code lookup can import attachments with an explicit **calibration unknown** status. Unknown codes must report missing catalog coverage. Copying a stored original code is provenance; it cannot be described as exporting an edited or optimized build. Even identical attachment layouts do not establish tuning equality.

## Official Global/Garena catalog

The [official HQ](https://www.playdeltaforce.com/events/hq/en/) loads four public exports:

| Export | Mode/channel | First supplied code |
| --- | --- | --- |
| [op_sol_en.js](https://www.playdeltaforce.com/gun-codes/op_sol_en.js) | Operations / LI | `M14 Marksman Rifle-Operations-6JUP4P40FV996DITL6AIU` |
| [op_mp_en.js](https://www.playdeltaforce.com/gun-codes/op_mp_en.js) | Warfare / LI | `AKM Assault Rifle-Warfare-6K50M4G066D6R0SSVVE4K` |
| [op_sol_ga_en.js](https://www.playdeltaforce.com/gun-codes/op_sol_ga_en.js) | Operations / GA | `AS Val Assault Rifle-Operations-6K0BFI000PCLSC7KHDQMK` |
| [op_mp_ga_en.js](https://www.playdeltaforce.com/gun-codes/op_mp_ga_en.js) | Warfare / GA | `M7 Battle Rifle-Warfare-6JSATOS0CPOFVGO390QA8` |

The frontend selects GA for Garena and otherwise LI. Preserve channel; this separation alone does not prove cross-channel import failure. Each export has five weapon groups, together 30 scheme rows / 29 distinct suffixes. These are recommendations, not the complete code registry.

Each scheme supplies `gun_code`, `channel`, `scheme_id`, author/title/panel metadata, and `config_data.guncode_result` with `gun_id` and recursive `components`. Component shape is `{slot, prop_data:{id, components, attachment_info}}`. For the first AKM example, root slot 2 holds `13020000355`, with child slot 6 holding `13130000209`. Retain ancestry when mapping to builder slot paths; flattening by item ID loses mounting context. Validate assembly/version compatibility.

A recursive key audit of all 30 rows found **no tuning/calibration keys**. It found 372 component nodes. `config_data.attachments` is empty in these records. This establishes missing information, not default tuning. Preserve source URL/hash, channel, mode, original text and scheme ID with any imported attachment layout.

## Official APIs inspected

[main-BkQGP7X_.js](https://www.playdeltaforce.com/events/hq/assets/main-BkQGP7X_.js) copies `gun_code` verbatim. It calls `fetchGunCodeSchemeList` with mode/channel/gun/category/price/page filters and `fetchGunCodeSchemeDetail` with **scheme_id**, typically a separate 32-character hexadecimal catalog ID.

[wand-P9vBIOpK.js](https://www.playdeltaforce.com/events/hq/assets/wand-P9vBIOpK.js) implements public catalog POST routes `/api/proxy_direct/logicial/DfTools/ListGunCodeSchemes` and `/api/proxy_direct/logicial/DfTools/GetGunCodeSchemeDetail`, plus login variants under `/api/proxy/`. Public calls set `needLogin:false`, but the website request layer still signs requests through `GetSign`. These API functions were inspected, not remotely executed. No raw-game-token resolver or arbitrary-build publication function was found in these assets. This bounded inspection does not establish that private/client endpoints do not exist. Static exports suffice for a limited catalog import without credentials/signing.

The HQ changelog reports Detonation share-code support in version 1.5, 2026-09-28. The four inspected exports cover Operations/Warfare only; first-party Detonation attachment mapping remains unestablished here.

## Token representation and hypotheses

The [unofficial decoder source](https://github.com/Overraingit/DeltaForce_Guncode_decoder/blob/65af5d4abd32cdeadbbf9fd4b0ea13d55da44575/decode.py) uses base32hex alphabet `0123456789ABCDEFGHIJKLMNOPQRSTUV`. Its code and MIT license are preserved at commit `65af5d4abd32cdeadbbf9fd4b0ea13d55da44575`. This is primary evidence for that implementation, not official protocol confirmation.

Independent arithmetic on all 30 official rows confirms:

- Every suffix has 21 characters in that alphabet and fits a 13-byte integer `v = int(token,32)`.
- The middle byte `(v >> 64) & 255` is zero in every sample.
- The high field `v >> 72`, interpreted as Unix seconds, gives plausible dates from 2026-04-08 through 2026-08-06.
- The remaining `v & (2**64-1)` is an opaque 64-bit field. Re-encoding the integer reproduces the token, proving representation round-trip only.

The decoder interprets the high field as creation/modification time and transforms the low field to an account ID using `29999999999999999999 - field`. Those meanings, the subtraction constant, server lookup, saved-scheme identity and expiry are **unverified interpretations** here. No authenticated account/client/server response confirmed them. No encryption is required for the observed base32 conversion; any cryptographic meaning inside fields is unknown.

The structure is consistent with a remote lookup identifier and provides no evidenced way to encode attachment/tuning values. A metadata decoder is therefore insufficient for arbitrary-build import/export. Do not fabricate tokens or imply that changing bits changes calibration.

## DFTTK scope

[RecommendationHome-CkfuJ9ul.js](https://dfttk.com/static/RecommendationHome-CkfuJ9ul.js) fetches supplied recommendation codes rather than encoding current builder state. Snapshots contain 852 [Operations solutions](https://dfttk.com/data/recommendations/loadouts.json), 358 [Warfare solutions](https://dfttk.com/data/recommendations/loadouts-mp.json), and 191 [Detonation solutions](https://dfttk.com/data/recommendations/loadouts-bd.json), attributed to Chinese service 三角洲小涛查. Chinese mode prefixes are 烽火地带 / 全面战场 / 黑潮爆破. Some rows have `partItemIds`, `loadoutConfig`, `assemblyValid` and completeness fields; calibration is absent. Some rows are explicitly assembly-invalid. These Chinese-server records must not be silently mixed into Global/Garena catalogs.

[WeaponBuilderV3-Lp448b0-.js](https://dfttk.com/static/WeaponBuilderV3-Lp448b0-.js) and [weaponBuilderV3Storage-CV9gQaCc.js](https://dfttk.com/static/weaponBuilderV3Storage-CV9gQaCc.js) save local structured builds (`weaponId`, `mode`, `config`, numeric `tunes`). Storage preserves finite decimal tune values. That is website persistence, not a game-code codec, and does not establish client acceptance of off-step tuning.

## Required client evidence

The user supplied seven real codes during this investigation, preserved in `.scratch/gun-codes/user_code_samples.json`. They include English Detonation, English Operations (Extraction Mode), Vietnamese Chiến Dịch (Thoát Hiểm), and Vietnamese Kích Nổ prefixes. All seven suffixes pass the same 21-character base32hex parsing and zero middle-byte check. Their labels suggest localized mode aliases; Vietnamese labels alone do not establish account region/channel. Client version, tuning values and import results were not supplied. These samples are not covered by the small official recommendation snapshot, and metadata parsing cannot recover their attachments or calibration. Parse the suffix from the final hyphen rather than assuming a fixed number of hyphens in weapon names (AN-94, ASh-12).

Obtain Global/Garena codes at known default and nondefault calibration, with patch/mode/date, attachment IDs and screenshots. Re-import and reopen calibration to verify round-trip. A separate off-step import/reopen test must check whether the client preserves, rejects, clamps or snaps the value. Code lifetime, channel compatibility and current attachment mappings require their own observations. No such validation is claimed here.

Fetched sources, pinned decoder commit/license and SHA-256 hashes are preserved in [.scratch/gun-codes/manifest.json](../.scratch/gun-codes/manifest.json). `token_audit.json` records every official sample, arithmetic fields and recursive key counts; `official_api_excerpts.json` preserves minified symbol anchors. No calculation engine files were changed.

## Withdrawn implementation

The temporary published-recipe importer and `DFWO1` workshop code UI, API routes, codecs, sync script, data and tests were removed at the user's request. Earlier source observations and audits under `.scratch/gun-codes/` remain historical evidence. Do not restore native lookup/publication without a new scope decision. See [cookie-backed saved builds](../builder/README.md) for the replacement.
