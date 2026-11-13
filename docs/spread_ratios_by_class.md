# Standing/moving spread ratios by weapon class

Audited the preserved dfttk source model, not the Global/Garena client. Data version `20261108-an94-bd-shop.1`, runtime `09f820e0d3ada199`. Reproduce with `python tools/audit_spread_ratios.py`; complete numeric output: [JSON](../data/spread_ratio_audit.json).

All 69 weapons across Operations (`sol`), Warfare (`mp`) and Detonation (`bd`) were resolved at their default loadout through the preserved source kernel (207 evaluations). All have positive idle spread. Every default profile has `runtimeScaleFactor = 1.25`; moving spread is calculated as idle spread times that source scale. No class or mode exception was found. Classes come from the SQLite catalog; blank shotgun class entries were identified by their original shotgun names and kept separate. English names are provisional translation labels; IDs and catalog classes govern this audit (for example SVD is in MR despite its English label).

| Class | Weapons | Modes per weapon | Moving / idle |
|---|---:|---:|---:|
| AR | 25 | 3 | 1.25? |
| SMG | 12 | 3 | 1.25? |
| LMG | 4 | 3 | 1.25? |
| MR | 10 | 3 | 1.25? |
| SR | 5 | 3 | 1.25? |
| Special | 1 | 3 | 1.25? |
| Pistol | 7 | 3 | 1.25? |
| Shotgun | 5 | 3 | 1.25? |

Representative Detonation values, degrees, unrounded source kernel:

| Class | Weapon | ID | Idle | Moving | Ratio |
|---|---|---|---:|---:|---:|
| AR | M4A1 Assault Rifle | `18010000001` | 2.2464 | 2.808 | 1.25? |
| AR | AKM Assault Rifle | `18010000006` | 2.3296 | 2.912 | 1.25? |
| AR | QBZ95-1 Assault Rifle | `18010000008` | 2.288 | 2.86 | 1.25? |
| SMG | MP5 Submachine Gun | `18020000001` | 1.6224 | 2.028 | 1.25? |
| SMG | P90 Submachine Gun | `18020000002` | 1.7472 | 2.184 | 1.25? |
| SMG | Vector Submachine Gun | `18020000003` | 2 | 2.5 | 1.25? |
| LMG | PKM General Machine Gun | `18040000001` | 2.7456 | 3.432 | 1.25? |
| LMG | M249 Light Machine Gun | `18040000002` | 2.5792 | 3.224 | 1.25? |
| LMG | M250 General Machine Gun | `18040000003` | 2.7455 | 3.43187 | 1.25? |
| MR | Mini-14 Marksman Rifle | `18050000002` | 3.3 | 4.125 | 1.25? |
| MR | VSS Marksman Rifle | `18050000003` | 3.25 | 4.0625 | 1.25? |
| MR | SVD Sniper Rifle | `18050000004` | 3.5 | 4.375 | 1.25? |
| SR | SV-98 Sniper Rifle | `18060000007` | 4.2 | 5.25 | 1.25? |
| SR | R93 Sniper Rifle | `18060000008` | 4 | 5 | 1.25? |
| SR | M700 Sniper Rifle | `18060000009` | 4.1 | 5.125 | 1.25? |
| Special | Compound Bow | `18150000001` | 1.2 | 1.5 | 1.25? |

The audit also follows default hip references and every `WaistShootSpreadId` attachment effect into stored hip-spread profiles: 99 weapon/profile contexts, including mode-specific replacements. Every inspected context has the same 1.25 movement scale. This is an inventory check, not a claim that every profile can be mounted in every context. Ordinary Accuracy/calibration arithmetic does not change this ratio: moving is computed from the resolved idle value and the profile scale.

There is **no independent jumping-spread value** in this contract. The current optimizer copies moving to jumping; its jumping/idle ratio is therefore 1.25 by implementation, not evidence of actual airborne mechanics. Likewise the source's moving label does not independently establish sprint/running spread.

## Consequence for agility

For all inspected profiles the current weighted score simplifies to:

`0.6 ? (1.25 ? idle) + 0.3 ? (1.25 ? idle) + 0.1 ? idle = 1.225 ? idle`.

After default normalization the 1.225 factor cancels. Thus the current three-state accuracy objective ranks builds exactly as idle spread alone, including inspected profile replacements. Class differences affect absolute spread, not this movement ratio. Independent running/jumping weights require additional validated state mechanics before they can produce different trade-offs.

Maximum/idle ratios vary by weapon and sometimes mode, unlike moving/idle; numeric values are retained for audit context only. Per user decision, maximum spread remains excluded from agility optimization. No optimizer behavior was changed by this audit.
