# Horizontal recoil: first 10 bullets

[20-bullet horizontal travel speed ranking](horizontal_recoil_speed.md). Speed is the newly proposed threshold metric; the distance table below remains a separate diagnostic.

**Current metric: maximum horizontal distance from the pre-fire origin**, `H = max(abs(x_i))`, with origin `x=0`. Use the first 10 cumulative post-shot ADS points, including the first-shot impulse without recentering. Left and right count equally. Repeated travel does not accumulate. Left-to-right span is obsolete for ranking.

Source snapshot: `20261108-an94-bd-shop.1`. Resolved base configurations with source defaults and no user tuning. Units are source-model units, not calibrated angles or client measurements. Highest distance ranks first; lower is better.

Reproduce both reports and JSON: `python tools/calculate_horizontal_recoil.py`. Requires the local SQLite/source catalog and preserved `.scratch/calibration-check/` runtime. All three modes have identical trajectories and availability in this snapshot; the table shows Detonation.

42 automatic weapons ranked; 0 automatic weapons unavailable for this uninterrupted window. Nonautomatic weapons are excluded because no prescribed single/burst cadence is modeled. No reloads or silent window shortening.

[Consolidated 20-bullet report and scoring history](horizontal_recoil.md) | [All-mode data and trajectories](../data/horizontal_recoil.json)

This is an opening-window diagnostic, not a replacement optimizer firing protocol. The 20-bullet threshold is not applied to this shorter window. All available 10-point paths exactly match the first 10 points of their corresponding 20-point paths, and their maximum distances cannot exceed the 20-point values.

| Rank | Weapon | Weapon ID | Horizontal distance | Min x | Max x |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | MK47 Battle Rifle | `18010000043` | 3.9270 | 0.5440 | 3.9270 |
| 2 | QJB 201 Light Machine Gun | `18040000004` | 2.5511 | -2.5511 | -0.2825 |
| 3 | AS Val Assault Rifle | `18010000037` | 1.9770 | 0.1770 | 1.9770 |
| 4 | AKM Assault Rifle | `18010000006` | 1.7549 | -0.3841 | 1.7549 |
| 5 | QCQ171 Submachine Gun | `18020000011` | 1.5948 | -1.5948 | 0.1896 |
| 6 | CI-19 Assault Rifle | `18010000038` | 1.5696 | -1.5696 | 0.2844 |
| 7 | M250 General Machine Gun | `18040000003` | 1.4140 | -1.4140 | 0.4655 |
| 8 | KC17 Assault Rifle | `18010000042` | 1.3430 | 0.2640 | 1.3430 |
| 9 | AR-57 Assault Rifle | `18010000045` | 1.2665 | 0.0850 | 1.2665 |
| 10 | M14 Marksman Rifle | `18050000005` | 1.0985 | -0.0598 | 1.0985 |
| 11 | M7 Battle Rifle | `18010000016` | 1.0395 | -1.0395 | 0.2835 |
| 12 | PKM General Machine Gun | `18040000001` | 0.9696 | -0.9696 | 0.3192 |
| 13 | AN-94 Assault Rifle | `18010000052` | 0.8960 | -0.8960 | 0.0080 |
| 14 | MDR Assault Rifle | `18010000051` | 0.8450 | -0.0460 | 0.8450 |
| 15 | Ash-12 Battle Rifle | `18010000012` | 0.8400 | -0.8400 | 0.4200 |
| 16 | QBZ95-1 Assault Rifle | `18010000008` | 0.8240 | -0.1493 | 0.8240 |
| 17 | Vector Submachine Gun | `18020000003` | 0.7675 | -0.7675 | 0.3488 |
| 18 | VSS Marksman Rifle | `18050000003` | 0.7530 | -0.7530 | 0.2750 |
| 19 | CAR-15 Assault Rifle | `18010000031` | 0.7338 | -0.7338 | -0.1045 |
| 20 | UZI Submachine Gun | `18020000004` | 0.7140 | -0.7140 | 0.2136 |
| 21 | PTR-32 Assault Rifle | `18010000024` | 0.6960 | 0.0930 | 0.6960 |
| 22 | SR-3M Compact Assault Rifle | `18020000008` | 0.6750 | -0.3168 | 0.6750 |
| 23 | G3 Battle Rifle | `18010000023` | 0.6696 | -0.6696 | 0.2448 |
| 24 | RM277 Assault Rifle | `18010000049` | 0.6661 | -0.6661 | 0.1514 |
| 25 | P90 Submachine Gun | `18020000002` | 0.6330 | -0.4785 | 0.6330 |
| 26 | MCX LT Assault Rifle | `18010000044` | 0.6120 | -0.6120 | -0.1200 |
| 27 | M4A1 Assault Rifle | `18010000001` | 0.6032 | 0.0806 | 0.6032 |
| 28 | AKS-74 Assault Rifle | `18010000010` | 0.5859 | -0.5859 | -0.2191 |
| 29 | K416 Assault Rifle | `18010000013` | 0.5568 | 0.0744 | 0.5568 |
| 30 | Thompson Submachine Gun | `18020000046` | 0.5496 | -0.0348 | 0.5496 |
| 31 | SCAR-H Battle Rifle | `18010000021` | 0.5209 | -0.1838 | 0.5209 |
| 32 | AUG Assault Rifle | `18010000015` | 0.5177 | 0.0892 | 0.5177 |
| 33 | MP7 Submachine Gun | `18020000010` | 0.5064 | -0.3828 | 0.5064 |
| 34 | G18 | `18070000005` | 0.4500 | -0.4500 | 0.3000 |
| 35 | M249 Light Machine Gun | `18040000002` | 0.4180 | -0.4180 | 0.4180 |
| 36 | Vityaz Submachine Gun | `18020000009` | 0.3724 | -0.3724 | 0.1897 |
| 37 | K437 Assault Rifle | `18010000040` | 0.3630 | -0.0900 | 0.3630 |
| 38 | Bizon Submachine Gun | `18020000005` | 0.3578 | -0.3578 | 0.1507 |
| 39 | SG 552 Assault Rifle | `18010000017` | 0.3568 | -0.3568 | 0.0448 |
| 40 | MP5 Submachine Gun | `18020000001` | 0.2748 | -0.0174 | 0.2748 |
| 41 | AK-12 Assault Rifle | `18010000018` | 0.2717 | -0.2717 | 0.2106 |
| 42 | SMG-45 Submachine Gun | `18020000006` | 0.2586 | -0.2586 | 0.1860 |

## Unavailable automatic weapons

None.

Validation: all weapon/mode rows evaluated; exact cross-mode trajectory/status agreement; finite distances; asymmetric, one-sided and zero synthetic checks; 10/20-point prefix identity and distance monotonicity. Human perception and Global/Garena client validation remain open.
