# Horizontal recoil travel speed: 20 bullets

Historical candidate retained as a jitter diagnostic: mean absolute horizontal travel speed, lower is better. The selected research metric is now [fastest 200 ms speed](horizontal_window_speed_trial.md). Rank 1 has the greatest speed. Base configuration, automatic ADS, no user tuning.

`speed = sum(abs(x[i] - x[i-1]), i=2..20) / ((t[20] - t[1]) / 1000)`

Times are source firing timestamps in milliseconds. The window covers 19 inter-shot intervals between the first and twentieth post-shot points. The first-shot displacement is excluded: the source impulse has no measured duration, so assigning it a speed would require an extra assumption. Direction reversals count toward travel; signed net drift and maximum distance from origin are different metrics.

Source snapshot: `20261108-an94-bd-shop.1`. Units: source-model units/second. This is a discrete trajectory travel-rate estimate, not measured instantaneous camera/aim velocity. It does not model between-shot recovery, rendering or random motion. Angular calibration and client validation remain open.

36 automatic weapons ranked. All three modes have identical metrics and availability. Only the 20-bullet window is used; no shorter-window substitutes. No numerical speed cutoff has been chosen. The old distance cutoff of 1.5 has different units and cannot be reused directly. Production scoring is unchanged.

Refresh source trajectories and all reports: `python tools/calculate_horizontal_recoil.py`. Recalculate speed alone: `python tools/calculate_horizontal_speed.py`.

[Origin-distance report](horizontal_recoil.md) | [All-mode speed data](../data/horizontal_recoil_speed.json) | [100/200/300 ms P90 trial](horizontal_window_speed_trial.md)

| Rank | Weapon | Weapon ID | Horizontal speed | Total travel | Duration (s) |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | M249 Light Machine Gun | `18040000002` | 4.7234 | 6.2732 | 1.3281 |
| 2 | QJB 201 Light Machine Gun | `18040000004` | 3.5541 | 5.1591 | 1.4516 |
| 3 | QCQ171 Submachine Gun | `18020000011` | 3.5348 | 5.2788 | 1.4934 |
| 4 | CI-19 Assault Rifle | `18010000038` | 3.5175 | 5.6808 | 1.6150 |
| 5 | P90 Submachine Gun | `18020000002` | 3.3789 | 4.2885 | 1.2692 |
| 6 | M250 General Machine Gun | `18040000003` | 3.2685 | 6.7690 | 2.0710 |
| 7 | MP7 Submachine Gun | `18020000010` | 2.8590 | 3.4308 | 1.2000 |
| 8 | AR-57 Assault Rifle | `18010000045` | 2.8386 | 3.5955 | 1.2667 |
| 9 | MK47 Battle Rifle | `18010000043` | 2.7867 | 5.0830 | 1.8240 |
| 10 | Thompson Submachine Gun | `18020000046` | 2.6519 | 3.3588 | 1.2665 |
| 11 | AKM Assault Rifle | `18010000006` | 2.6244 | 4.9864 | 1.9000 |
| 12 | PKM General Machine Gun | `18040000001` | 2.5836 | 4.4032 | 1.7043 |
| 13 | QBZ95-1 Assault Rifle | `18010000008` | 2.5364 | 4.2601 | 1.6796 |
| 14 | MDR Assault Rifle | `18010000051` | 2.3448 | 4.1121 | 1.7537 |
| 15 | RM277 Assault Rifle | `18010000049` | 2.2081 | 4.5730 | 2.0710 |
| 16 | M4A1 Assault Rifle | `18010000001` | 2.0207 | 2.8795 | 1.4250 |
| 17 | AK-12 Assault Rifle | `18010000018` | 2.0065 | 3.1109 | 1.5504 |
| 18 | UZI Submachine Gun | `18020000004` | 1.9481 | 2.8464 | 1.4611 |
| 19 | M7 Battle Rifle | `18010000016` | 1.9055 | 3.3453 | 1.7556 |
| 20 | PTR-32 Assault Rifle | `18010000024` | 1.8427 | 3.3225 | 1.8031 |
| 21 | K416 Assault Rifle | `18010000013` | 1.7827 | 2.3100 | 1.2958 |
| 22 | Ash-12 Battle Rifle | `18010000012` | 1.7500 | 3.9900 | 2.2800 |
| 23 | MCX LT Assault Rifle | `18010000044` | 1.6984 | 2.3040 | 1.3566 |
| 24 | CAR-15 Assault Rifle | `18010000031` | 1.6377 | 2.9529 | 1.8031 |
| 25 | K437 Assault Rifle | `18010000040` | 1.4544 | 2.1250 | 1.4611 |
| 26 | G3 Battle Rifle | `18010000023` | 1.4135 | 3.0240 | 2.1394 |
| 27 | KC17 Assault Rifle | `18010000042` | 1.4067 | 2.1670 | 1.5405 |
| 28 | AN-94 Assault Rifle | `18010000052` | 1.3857 | 2.4480 | 1.7667 |
| 29 | Vityaz Submachine Gun | `18020000009` | 1.3722 | 2.2344 | 1.6283 |
| 30 | SMG-45 Submachine Gun | `18020000006` | 1.2466 | 2.3496 | 1.8848 |
| 31 | MP5 Submachine Gun | `18020000001` | 1.2075 | 1.6794 | 1.3908 |
| 32 | Bizon Submachine Gun | `18020000005` | 1.1885 | 2.0550 | 1.7290 |
| 33 | SCAR-H Battle Rifle | `18010000021` | 1.1788 | 2.2979 | 1.9494 |
| 34 | SG 552 Assault Rifle | `18010000017` | 1.1703 | 1.4720 | 1.2578 |
| 35 | AUG Assault Rifle | `18010000015` | 1.1155 | 1.8735 | 1.6796 |
| 36 | AKS-74 Assault Rifle | `18010000010` | 1.0932 | 2.3387 | 2.1394 |

## Unavailable automatic weapons

- AS Val Assault Rifle (`18010000037`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- Vector Submachine Gun (`18020000003`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- SR-3M Compact Assault Rifle (`18020000008`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- VSS Marksman Rifle (`18050000003`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- M14 Marksman Rifle (`18050000005`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.
- G18 (`18070000005`): Requested shots exceed this build magazine; no reload or silent truncation is modeled.

Validation: 20 points per available path, strictly increasing source timestamps, finite speeds, cross-mode equality, and a reversal example whose net drift is zero but travel speed is positive.
