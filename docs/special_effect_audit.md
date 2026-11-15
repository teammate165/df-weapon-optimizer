# Special effects and required optic audit

Latest correction: enabled laser bonuses now use a non-stacking project policy; both presets avoid redundant unlocked lasers. The earlier source-parity results below predate this correction. [Evidence, uncertainty and runtime policy](laser_stacking.md).

Audited 2026-11-15. Local catalog data version `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`; live atlas runtime `2b90898856fd025d` reports the same data version. Game build is unknown; this is source-model validation, not Global/Garena client verification.

## Findings and corrections

- **Empty risers in generated builds: fixed.** IDs `13210000012`, `13210000013`, `13210000014` require an actual scope-category optic mounted below their own socket path. An optic elsewhere on the weapon, a tactical laser, or an empty nested riser does not satisfy the requirement. The optimizer evaluates compatible riser/optic combinations atomically, including locked risers; normal mode availability, dependencies, prices, budgets and locks apply to the complete combination. Nested risers each need a descendant optic. Manual equipment remains editable, but generated builds cannot exploit empty mounts.
- **Enabled laser effects: fixed.** Raw data already contained the benefits under `TacticalEffective`; project calculator calls omitted `tacticalEffective`, whose source default is false. Evaluation, candidate comparisons, response curves, recoil graphs and both optimizer presets now use the enabled state. Raw catalog/SQLite records remain faithful to their source conditions. Five shared devices (`13160000005`, `13160000006`, `13160000009`, `13160000010`, `13160000014`) plus JAD `13160000020` qualify under the source kernel's tactical-device test. The model does not activate deployed bipods with this switch.
- LA-3C `13160000006` on M4A1 `18010000001`: off handling 54; on handling **70 in Operations/Detonation, 61 in Warfare**. Relative to the default build, net handling is +12/+3, after its regular -4 penalty. Accuracy is +12 in all three modes. These are effective source points, not asserted milliseconds or client measurements. JAD has its own mode-specific values; do not copy LA-3C values to every laser.

## Complete catalog audit

Checked **69 weapons**, **1,745 library attachment/mode records**, and **22,075 compatible weapon/part/mode effect contexts**. All operations in the atlas library are preserved in assembled local packs: **zero missing-operation contexts**. Downloaded, SHA-256-verified live `sol`, `mp`, and `bd` atlas libraries match every local weapon and attachment record exactly (zero changed rows). The atlas's `???????` column uses its attachment-effect tooltip, which distinguishes regular and tactical/enabled effects.

[Machine-readable inventory](../data/special_effect_audit/audit.json) includes all weapon intrinsic effects and special-fire metadata, 234 parts with detailed/profile/special effects, all 16 conditional-effect items, operation targets, and affected weapon/mode contexts. [Live manifest](../data/special_effect_audit/live-manifest.json) pins the remote release and library hashes. The three `live-library-*.json` files preserve the atlas evidence. The audit compares library operations to weapon-specific packs, rather than treating globally deduplicated legacy part rows as authoritative.

**Preserved data does not establish calculator coverage.** The following remain open:

| Area | Finding / affected IDs |
| --- | --- |
| Deployed bipods | 10 conditional items: `13140000038`, `13170000004`, `13170000005`, `13170000008`, `13170000002`, `13050000325`, `13170000011`, `13170000003`, `13170000001`, `13170000013`. Source kernel requires tactical accuracy and handling fields together before applying any tactical operations; these bipods have recoil/kick/sway operations instead. They are intentionally OFF. Per user requirement, deployed bonuses must never contribute to optimizer scoring, minimum-stat checks or generated totals; selection-panel descriptions are informational only. This exclusion is required behavior, not an optimizer modeling gap. |
| Shotgun ADS spread | `GSpread_ADS` is stored but the current attribute calculator returns base ADS spread without reading that modifier. Affects `13020000453`, `13130000189`, `13130000190`, `13020000448`, `13020000451`, `13040000135`, `13130000216`. |
| Incoming-hit sway | `CameraSwayBeHitScale` / `GunSwayBeHitscale` on `13540000003`, `13050000370`, `13050000334` are stored; current hit-sway output reads `BehitGunSway` instead. Semantics/aliasing need verification before changing arithmetic. |
| Other mechanics outside current outputs | Supersprint-to-fire (`13020000355`), velocity-only range (`13020000572`), bow charge (`13470000002`), optic zoom (`13370000001`), crouch/prone breath factors. These targets have no direct consumer in the preserved kernel/attribute calculator. |
| Combat profile/shot behavior review | Head multiplier (`13020000173`), attacker damage-profile replacements, projectile/ammo/hit-count changes (`13020000603`) require profile-aware checks. Absence of a literal target consumer is **not proof** these effects are wholly missing: source special-fire overrides/reference resolution can encode them separately. Full affected IDs/weapon/mode contexts are in `consumer_review`. |
| Weapon timing | Weapon `18030000006` explicitly reports `legacySourceHasNoSinglePumpSchedule`; retained as unmodeled. All 69 weapons' intrinsic operations and overrides are inventoried. No missing weapon catalog record was found. |

The consumer scan flags 16 target groups for review. It is a conservative code-reference scan, not an assertion that all 16 groups need new arithmetic. The report also inventories every runtime game-text caption, its attachment IDs and explicit source mode mappings. The local picker presents computed numerical changes; it does not expose those source capability descriptions. Optical zoom/clarity, sound/flash suppression, laser visibility to enemies, tactical stance and active flash/blinding are examples of missing capability presentation/gameplay modeling. Numeric captions can already correspond to the calculated stats; caption absence alone does not mean their numerical effects are missing. The numerical operation audit cannot validate these capabilities mechanically.

## Reproduce and validate

```powershell
python tools/audit_special_effects.py --live
python -m unittest discover -s tests -p test_special_effects.py -v
python -m unittest discover -s tests -p test_builder_server.py -v
node tests/agility_optimizer.mjs
node tests/optimizer_selection.mjs
python tools/build_github_pages.py --output .scratch/special-effects-site
```

Without `--live`, the audit verifies and reuses the saved live snapshot, when present. It never replaces the primary catalog or database. Runtime files under `.scratch/calibration-check` are the same preserved source runtime required by the builder.

Validation: laser benefits in all three modes, all six devices including JAD, picker comparison parity, curve current-point parity, all three risers, nested risers, laser-only rejection, locked optics, missing quotes/insufficient optic budget, generated fixed riser/laser builds and independent evaluator round-trip. Existing four backend builder tests pass. Manual locked-riser generation in Warfare and Detonation passed; Detonation returned valid Max/Balanced/Min builds at 800/440/240 cost. Exported all 69 weapon packs and verified the browser worker with the [local browser regression](../.scratch/browser-qa/special-effects-check.cjs). Production deployment is separate.

Source pages: [DFTTK atlas/app](https://dfttk.com/), [live manifest](https://dfttk.com/data/v3/manifest.json), [atlas implementation](https://dfttk.com/static/DataLibraryPage-C8bzJk_b.js), [effect tooltip](https://dfttk.com/static/V3AttachmentEffectTooltip-18reGFDc.js). No upstream repository investigation was needed.

## Attachment picker follow-up (2026-11-15)

Attachment cards and hover details now expose positive conditional numeric effects, using mode-specific `TacticalEffective` operations from the shared model. These are ON-versus-OFF bonuses, separate from the existing comparison against the equipped part. Lasers are labeled ?When ON ? Included in totals?; bipods are labeled ?When deployed ? Not included in totals.? Equipped attachments retain the conditional-benefit description when their replacement delta is zero. Non-numeric capability descriptions and the remaining mechanics above remain open.

## Bipod policy clarification

User confirmed that bipods default OFF and deployed stats must never be considered by the optimizer. Existing source filtering already excludes their `TacticalEffective` operations while allowing their ordinary mounted effects. Regression checks cover real mounted rail and foregrip bipods in Operations, Warfare and Detonation: both optimizer preset objectives equal explicit OFF-state objectives, evaluated totals equal OFF totals, and picker metadata marks deployment bonuses excluded. Lasers remain ON.
