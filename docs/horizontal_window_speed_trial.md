# Selected horizontal speed: fastest 200 ms, 20 bullets

**User-selected metric:** maximum absolute net horizontal speed over any complete 200 ms window within the 20-bullet trace. Rank directly in model units/second; no P90 reference, percentile selection or default normalization. 100/300 ms values are sensitivity diagnostics. Raw total-travel speed remains a jitter diagnostic. Selected horizontal multipliers: 1x for speed <=3, 2x for >3 through 4, 3x for >4 through 5, 5x for >5 model units/s. This supersedes the earlier P90 selection. Lowest Recoil now applies these tiers to each candidate build; this table ranks base builds.

`selected_speed = max_t(abs(x(t + 200 ms) - x(t)) / 0.2 s)`

The fastest window is evaluated exactly for the piecewise-linear trace at its endpoints and all knots of x(t) and x(t+200 ms). It does not depend on the diagnostic sampling grid. Reported window timestamps are relative to the first post-shot point (0 ms). This measures net window displacement, not total back-and-forth travel inside that window.

For comparison only, retain 100, 200 and 300 ms diagnostics using the 90th percentile (P90) of absolute window speeds. Rank 1 means greatest speed; lower is better. Only uninterrupted 20-bullet automatic ADS base traces are used.

`v(t, Δ) = abs(x(t + Δ) - x(t)) / (Δ / 1000)`

P90 diagnostic method: piecewise linear interpolation of source post-shot coordinates; sample window starts every 1 ms from the first shot through the last valid full window. No padding, origin-to-first-shot interval, shortened windows or extrapolation. Use the linearly interpolated sample percentile at index `(n-1)*0.9`. Equal time sampling avoids weighting slow/fast fire sections equally by shot. Interpolation is an explicit analysis assumption, not a measured continuous recoil path.

Source snapshot: `20261108-an94-bd-shop.1`. Units: model units/second. 36 weapons ranked; six short-magazine automatic weapons excluded. Three modes agree exactly. See the [optimizer contract](recoil_generator.md#current-horizontal-speed-tiers-2026-11-15) for default normalization and unsupported-protocol fallback.

Reproduce: `python tools/calculate_horizontal_recoil.py` (all reports), or `python tools/audit_horizontal_window_speed.py` (this trial from retained trajectories).

[Raw travel-speed report](horizontal_recoil_speed.md) | [All-mode trial JSON](../data/horizontal_window_speed.json)

P90 window speed and mean absolute travel speed summarize different distributions. A window P90 can exceed the raw mean; their difference is not a measured jitter percentage. Rapid reversals can cancel within a window, while sustained sideways movement remains. Repeated reversals are not necessarily jitter; real directional snaking can also be suppressed.

## Fastest 200 ms ranking

| Rank | Weapon | Weapon ID | Speed (model units/s) | Multiplier | Window start (ms) | Window end (ms) |
| ---: | --- | --- | ---: | ---: | ---: | ---: |
| 1 | M250 General Machine Gun | `18040000003` | 6.8554 | 5 | 1871.0000 | 2071.0000 |
| 2 | MK47 Battle Rifle | `18010000043` | 6.4954 | 5 | 184.0000 | 384.0000 |
| 3 | M249 Light Machine Gun | `18040000002` | 6.2654 | 5 | 838.8000 | 1038.8000 |
| 4 | QJB 201 Light Machine Gun | `18040000004` | 4.8270 | 3 | 1222.4000 | 1422.4000 |
| 5 | QBZ95-1 Assault Rifle | `18010000008` | 4.5453 | 3 | 1302.8000 | 1502.8000 |
| 6 | QCQ171 Submachine Gun | `18020000011` | 4.5093 | 3 | 628.8000 | 828.8000 |
| 7 | CI-19 Assault Rifle | `18010000038` | 4.4259 | 3 | 565.0000 | 765.0000 |
| 8 | P90 Submachine Gun | `18020000002` | 4.3340 | 3 | 133.6000 | 333.6000 |
| 9 | PKM General Machine Gun | `18040000001` | 4.2960 | 3 | 1504.3000 | 1704.3000 |
| 10 | AR-57 Assault Rifle | `18010000045` | 4.2713 | 3 | 1066.6540 | 1266.6540 |
| 11 | Thompson Submachine Gun | `18020000046` | 4.1101 | 3 | 533.2800 | 733.2800 |
| 12 | KC17 Assault Rifle | `18010000042` | 4.0203 | 3 | 43.2430 | 243.2430 |
| 13 | MP7 Submachine Gun | `18020000010` | 3.6360 | 2 | 126.3140 | 326.3140 |
| 14 | AKM Assault Rifle | `18010000006` | 3.5650 | 2 | 200.0000 | 400.0000 |
| 15 | AK-12 Assault Rifle | `18010000018` | 3.4477 | 2 | 942.4000 | 1142.4000 |
| 16 | RM277 Assault Rifle | `18010000049` | 3.3778 | 2 | 1635.0000 | 1835.0000 |
| 17 | M4A1 Assault Rifle | `18010000001` | 3.2933 | 2 | 750.0000 | 950.0000 |
| 18 | MDR Assault Rifle | `18010000051` | 3.1203 | 2 | 184.6000 | 384.6000 |
| 19 | PTR-32 Assault Rifle | `18010000024` | 3.0032 | 2 | 949.0000 | 1149.0000 |
| 20 | AN-94 Assault Rifle | `18010000052` | 2.9650 | 1 | 966.6667 | 1166.6667 |
| 21 | UZI Submachine Gun | `18020000004` | 2.8322 | 1 | 569.0000 | 769.0000 |
| 22 | SMG-45 Submachine Gun | `18020000006` | 2.7135 | 1 | 1288.0000 | 1488.0000 |
| 23 | K416 Assault Rifle | `18010000013` | 2.5833 | 1 | 686.6000 | 886.6000 |
| 24 | M7 Battle Rifle | `18010000016` | 2.5024 | 1 | 184.8000 | 384.8000 |
| 25 | CAR-15 Assault Rifle | `18010000031` | 2.4866 | 1 | 1328.6000 | 1528.6000 |
| 26 | K437 Assault Rifle | `18010000040` | 2.4707 | 1 | 845.9000 | 1045.9000 |
| 27 | Bizon Submachine Gun | `18020000005` | 2.3732 | 1 | 637.0000 | 837.0000 |
| 28 | Vityaz Submachine Gun | `18020000009` | 2.1762 | 1 | 257.1000 | 457.1000 |
| 29 | G3 Battle Rifle | `18010000023` | 1.9704 | 1 | 112.6000 | 312.6000 |
| 30 | MP5 Submachine Gun | `18020000001` | 1.9000 | 1 | 585.6000 | 785.6000 |
| 31 | AKS-74 Assault Rifle | `18010000010` | 1.8468 | 1 | 1013.4000 | 1213.4000 |
| 32 | AUG Assault Rifle | `18010000015` | 1.8235 | 1 | 684.0000 | 884.0000 |
| 33 | SG 552 Assault Rifle | `18010000017` | 1.8180 | 1 | 660.6000 | 860.6000 |
| 34 | Ash-12 Battle Rifle | `18010000012` | 1.7500 | 1 | 0.0000 | 200.0000 |
| 35 | MCX LT Assault Rifle | `18010000044` | 1.6807 | 1 | 0.0000 | 200.0000 |
| 36 | SCAR-H Battle Rifle | `18010000021` | 1.6463 | 1 | 102.6000 | 302.6000 |

## P90 sensitivity comparison (diagnostic only)

| Weapon | Weapon ID | Raw speed (rank) | 100 ms P90 (rank) | 200 ms P90 (rank) | 300 ms P90 (rank) |
| --- | --- | ---: | ---: | ---: | ---: |
| M250 General Machine Gun | `18040000003` | 3.2685 (6) | 5.2930 (3) | 3.7743 (8) | 2.8088 (13) |
| MK47 Battle Rifle | `18010000043` | 2.7867 (9) | 5.9886 (2) | 6.0394 (1) | 5.6787 (2) |
| M249 Light Machine Gun | `18040000002` | 4.7234 (1) | 7.2758 (1) | 6.0170 (2) | 6.1730 (1) |
| QJB 201 Light Machine Gun | `18040000004` | 3.5541 (2) | 5.0068 (4) | 4.4447 (3) | 4.1570 (4) |
| QBZ95-1 Assault Rifle | `18010000008` | 2.5364 (13) | 3.9733 (9) | 3.4320 (9) | 3.6630 (6) |
| QCQ171 Submachine Gun | `18020000011` | 3.5348 (3) | 4.4699 (6) | 4.4085 (4) | 4.2940 (3) |
| CI-19 Assault Rifle | `18010000038` | 3.5175 (4) | 4.5014 (5) | 3.8204 (7) | 3.7304 (5) |
| P90 Submachine Gun | `18020000002` | 3.3789 (5) | 4.3872 (7) | 3.9090 (6) | 3.1650 (10) |
| PKM General Machine Gun | `18040000001` | 2.5836 (12) | 3.9588 (10) | 2.5906 (17) | 1.7777 (27) |
| AR-57 Assault Rifle | `18010000045` | 2.8386 (8) | 4.0778 (8) | 3.9636 (5) | 2.5567 (15) |
| Thompson Submachine Gun | `18020000046` | 2.6519 (10) | 3.5876 (13) | 3.0473 (15) | 2.7658 (14) |
| KC17 Assault Rifle | `18010000042` | 1.4067 (27) | 3.4131 (15) | 1.9156 (28) | 1.1444 (35) |
| MP7 Submachine Gun | `18020000010` | 2.8590 (7) | 3.7063 (12) | 3.1961 (14) | 2.4254 (18) |
| AKM Assault Rifle | `18010000006` | 2.6244 (11) | 3.7357 (11) | 3.2906 (12) | 3.1363 (11) |
| AK-12 Assault Rifle | `18010000018` | 2.0065 (17) | 3.4412 (14) | 3.3898 (10) | 3.3614 (7) |
| RM277 Assault Rifle | `18010000049` | 2.2081 (15) | 3.3219 (16) | 3.2662 (13) | 3.2380 (9) |
| M4A1 Assault Rifle | `18010000001` | 2.0207 (16) | 3.2933 (17) | 3.2933 (11) | 3.2933 (8) |
| MDR Assault Rifle | `18010000051` | 2.3448 (14) | 3.1203 (18) | 2.5062 (20) | 2.2778 (21) |
| PTR-32 Assault Rifle | `18010000024` | 1.8427 (20) | 3.0032 (19) | 3.0032 (16) | 3.0032 (12) |
| AN-94 Assault Rifle | `18010000052` | 1.3857 (28) | 2.2044 (27) | 2.0660 (25) | 1.8161 (26) |
| UZI Submachine Gun | `18020000004` | 1.9481 (18) | 2.9462 (20) | 2.5615 (19) | 2.3406 (20) |
| SMG-45 Submachine Gun | `18020000006` | 1.2466 (30) | 2.2384 (26) | 2.2174 (23) | 2.0864 (22) |
| K416 Assault Rifle | `18010000013` | 1.7827 (21) | 2.5877 (21) | 2.5658 (18) | 2.5433 (16) |
| M7 Battle Rifle | `18010000016` | 1.9055 (19) | 2.3572 (24) | 2.1298 (24) | 2.0318 (23) |
| CAR-15 Assault Rifle | `18010000031` | 1.6377 (24) | 2.4866 (22) | 2.4866 (21) | 2.4866 (17) |
| K437 Assault Rifle | `18010000040` | 1.4544 (25) | 2.4707 (23) | 2.4707 (22) | 2.4167 (19) |
| Bizon Submachine Gun | `18020000005` | 1.1885 (32) | 2.2556 (25) | 2.0533 (26) | 1.9622 (24) |
| Vityaz Submachine Gun | `18020000009` | 1.3722 (29) | 2.0996 (28) | 2.0072 (27) | 1.8168 (25) |
| G3 Battle Rifle | `18010000023` | 1.4135 (26) | 1.7904 (29) | 1.6763 (30) | 1.5817 (29) |
| MP5 Submachine Gun | `18020000001` | 1.2075 (31) | 1.6551 (35) | 1.4045 (35) | 1.2977 (34) |
| AKS-74 Assault Rifle | `18010000010` | 1.0932 (36) | 1.7003 (32) | 1.4817 (34) | 1.4877 (32) |
| AUG Assault Rifle | `18010000015` | 1.1155 (35) | 1.6622 (34) | 1.6259 (32) | 1.5809 (30) |
| SG 552 Assault Rifle | `18010000017` | 1.1703 (34) | 1.7752 (30) | 1.6615 (31) | 1.5746 (31) |
| Ash-12 Battle Rifle | `18010000012` | 1.7500 (22) | 1.7500 (31) | 1.7500 (29) | 1.7500 (28) |
| MCX LT Assault Rifle | `18010000044` | 1.6984 (23) | 1.6807 (33) | 1.5765 (33) | 1.0114 (36) |
| SCAR-H Battle Rifle | `18010000021` | 1.1788 (33) | 1.4931 (36) | 1.3872 (36) | 1.3110 (33) |

## Largest rank drops: raw travel to fastest 200 ms

Positive drops mean lower horizontal severity relative to other weapons.

- Ash-12 Battle Rifle: 22 → 34.
- MCX LT Assault Rifle: 23 → 35.
- MP7 Submachine Gun: 7 → 13.
- M7 Battle Rifle: 19 → 24.
- MDR Assault Rifle: 14 → 18.
- AKM Assault Rifle: 11 → 14.
- SCAR-H Battle Rifle: 33 → 36.
- G3 Battle Rifle: 26 → 29.

## Sensitivity and limits

Maximum absolute P90 difference when halving the sampling step to 0.5 ms: 0.014819 model units/second.

- 100 ms: 0 rank positions change on the finer grid.
- 200 ms: 0 rank positions change on the finer grid.
- 300 ms: 2 rank positions change on the finer grid.

A synthetic constant 2-unit/second drift remains 2 for all windows. A synthetic alternating 100 ms reversal has raw travel speed 10 but zero 200 ms net speed. This demonstrates a cancellation blind spot: a particular window can hide periodic motion. The selected 200 ms window retains this limitation; other windows remain sensitivity checks. Longer windows can hide genuine short directional kicks. The selected maximum retains brief events that P90 can downweight and may therefore remain sensitive to a sharp one-direction kick. Keep raw travel and origin-distance diagnostics. This metric lacks perceptual/client validation.
