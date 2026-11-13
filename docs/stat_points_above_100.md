# Effective stat points above 100

Source-model audit: 2026-11-13, dfttk snapshot `20261108-an94-bd-shop.1`. No Global/Garena client test or hidden-stat-cap verification is claimed.

The response chart's default 0–150 domain comes from the earlier exploratory sweep, not an engine limit. The current implementation extends it when necessary to include the current effective value plus 20. Neither 100 nor 150 is a universal clamp in the preserved numeric main-attribute resolver. Individual response curves clamp at their endpoints. Display buckets and effective main points are separate; a capped graphical bar does not establish how the game clamps its underlying performance calculation.

## Concrete default-build probes

Detonation, effective points, other stats and default equipment held fixed:

| Weapon / response | At 100 | At 110 | Effective point at final source endpoint |
| --- | ---: | ---: | ---: |
| AUG (`18010000015`), ordinary vertical/horizontal recoil multiplier | 0.5249365317× | 0.4460406933× | 115 |
| M4A1 (`18010000001`), initial hip spread | 1.1307861034° | 0.9906712219° | 155 |

AUG's raw Control base is 60 and its ordinary recoil delta curve ends at +55 (`DeltaMappingThenScale`): 60 + 55 = 115. M4A1's raw Hip Accuracy base is 55 and its spread delta curve ends at +100: 55 + 100 = 155. The current default 150-point chart therefore does not display the final five points of that hip-spread curve.

For comparison, M4A1 ordinary recoil reaches its endpoint at Control 41 + 45 = 86; its random/spring kick curves end at 41 + 55 = 96. Thus some metrics stop improving before 100 while other weapon/stat curves extend past it.

Across the saved Detonation responses, 23 of 69 weapons have at least one Control metric that changes between effective 100 and 150; all 69 have a Hip Accuracy metric that changes. No sampled Handling or Stability metrics change after 100 in this default-build cohort. This is a statement about these model probes, not proof that builds can reach each point, or that attachments cannot improve plateaued metrics through independent effects.

## Evidence and limits

- [Saved numeric response export](../data/stat_curves/responses.json): filter by weapon ID, `mode=bd`, stat, and series key (`auto_vertical`, `auto_horizontal`, `hip_deg`). Compare the entries at `xs=100` and `xs=110`.
- [Probe methodology](weapon_stat_response_curves.md), [source/model distinction](dfttk_stat_effects_source.md).
- Curve definitions and raw base values are reproducible through `tools.sync_dfttk_database.assemble()` using the preserved manifest's build pack for the given weapon. Select the mode's curve ID from `attributeRules.weaponOverrides` or `attributeRules.defaults`; inspect `curves[id].points` and the mapping type.
- [Current chart domain](../tools/builder_stat_response.mjs).

These findings do not establish whether the Global/Garena game accepts hidden effective values above 100, whether only its displayed bar is capped, or whether any particular above-100 configuration is attainable under compatibility and mode budgets. A same-build in-game comparison with visible stats plus recoil/spread measurements remains necessary for that claim.
