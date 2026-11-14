# Base automatic-weapon horizontal spans

20-shot uninterrupted ADS, resolved base configuration, no user tuning. Span = max(x) - min(x) across all 20 post-shot source-chart points. Units are source-model units, not calibrated angles or client measurements.

Source snapshot: `20261108-an94-bd-shop.1`. Reproduce: `python tools/calculate_base_horizontal_spans.py`.

| Rank | Weapon | Weapon ID | Detonation span | Above threshold 1.5 |
| --- | --- | --- | ---: | --- |
| 1 | QJB 201 Light Machine Gun | `18040000004` | 5.0046 | Yes |
| 2 | AKM Assault Rifle | `18010000006` | 4.7276 | Yes |
| 3 | M250 General Machine Gun | `18040000003` | 4.1440 | Yes |
| 4 | RM277 Assault Rifle | `18010000049` | 4.0344 | Yes |
| 5 | M249 Light Machine Gun | `18040000002` | 3.8608 | Yes |
| 6 | QBZ95-1 Assault Rifle | `18010000008` | 3.8102 | Yes |
| 7 | MK47 Battle Rifle | `18010000043` | 3.3830 | Yes |
| 8 | CI-19 Assault Rifle | `18010000038` | 2.9700 | Yes |
| 9 | AK-12 Assault Rifle | `18010000018` | 2.9172 | Yes |
| 10 | PTR-32 Assault Rifle | `18010000024` | 2.7975 | Yes |
| 11 | PKM General Machine Gun | `18040000001` | 2.6032 | Yes |
| 12 | M4A1 Assault Rifle | `18010000001` | 2.4245 | Yes |
| 13 | CAR-15 Assault Rifle | `18010000031` | 2.3236 | Yes |
| 14 | QCQ171 Submachine Gun | `18020000011` | 1.9488 | Yes |
| 15 | Ash-12 Battle Rifle | `18010000012` | 1.8900 | Yes |
| 16 | K416 Assault Rifle | `18010000013` | 1.8900 | Yes |
| 17 | AR-57 Assault Rifle | `18010000045` | 1.8615 | Yes |
| 18 | K437 Assault Rifle | `18010000040` | 1.8260 | Yes |
| 19 | SMG-45 Submachine Gun | `18020000006` | 1.5660 | Yes |
| 20 | AKS-74 Assault Rifle | `18010000010` | 1.5386 | Yes |
| 21 | MDR Assault Rifle | `18010000051` | 1.5300 | Yes |
| 22 | KC17 Assault Rifle | `18010000042` | 1.5170 | Yes |
| 23 | AUG Assault Rifle | `18010000015` | 1.5000 | No |
| 24 | M7 Battle Rifle | `18010000016` | 1.4931 | No |
| 25 | Bizon Submachine Gun | `18020000005` | 1.2990 | No |
| 26 | Thompson Submachine Gun | `18020000046` | 1.2288 | No |
| 27 | P90 Submachine Gun | `18020000002` | 1.1880 | No |
| 28 | Vityaz Submachine Gun | `18020000009` | 1.0703 | No |
| 29 | SG 552 Assault Rifle | `18010000017` | 0.9816 | No |
| 30 | AN-94 Assault Rifle | `18010000052` | 0.9600 | No |
| 31 | MP7 Submachine Gun | `18020000010` | 0.9504 | No |
| 32 | UZI Submachine Gun | `18020000004` | 0.9276 | No |
| 33 | G3 Battle Rifle | `18010000023` | 0.9144 | No |
| 34 | SCAR-H Battle Rifle | `18010000021` | 0.7047 | No |
| 35 | MP5 Submachine Gun | `18020000001` | 0.6144 | No |
| 36 | MCX LT Assault Rifle | `18010000044` | 0.4920 | No |

36 automatic weapons calculated in Detonation; 6 automatic weapons unavailable.

- AS Val Assault Rifle (`18010000037`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- Vector Submachine Gun (`18020000003`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- SR-3M Compact Assault Rifle (`18020000008`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- VSS Marksman Rifle (`18050000003`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- M14 Marksman Rifle (`18050000005`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- G18 (`18070000005`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.

## Shorter base magazines: separate full-magazine windows

These spans use fewer shots and must not be ranked against the 20-shot threshold.

| Weapon | Shots | Horizontal span |
| --- | ---: | ---: |
| AS Val Assault Rifle | 15 | 1.8000 |
| Vector Submachine Gun | 17 | 1.7250 |
| SR-3M Compact Assault Rifle | 15 | 1.2807 |
| VSS Marksman Rifle | 15 | 1.0280 |
| M14 Marksman Rifle | 10 | 1.1583 |
| G18 | 17 | 1.0500 |

All three modes have identical metrics/status availability: True.

JSON retains all weapon/mode rows, including nonautomatic exclusions. CSV contains all automatic weapon/mode rows, including unavailable values. No magazine truncation, invented dynamics, or synthetic jitter. Base fire-mode capability is used; automatic conversions requiring attachments are excluded. Translation names remain provisional.

[All-mode CSV](../data/base_horizontal_spans.csv) | [Full JSON](../data/base_horizontal_spans.json)
