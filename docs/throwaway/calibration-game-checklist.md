# Temporary calibration test checklist

Prepared 2026-11-14. Six attachments cover all ten slider types in the local dataset; an exact minimum-set search over enabled calibration definitions found no smaller set. This covers types, not every range/step variant. Names come from the local official-wiki matching snapshot unless marked provisional. The original expected steps below are dfttk model values. User-reported game names, steps and ranges are recorded separately below.

| Done | Attachment | Sliders | Expected steps |
| --- | --- | --- | --- |
| [ ] | AR SpecOps Integrally Suppressed Combo (`13020000173`) | Barrel length; weight | 0.2 mm; 1 g |
| [ ] | Cardinal Stable Stock (`13040000107`) | Cheek-rest position; butt-pad position | 16; 20 source units |
| [ ] | Holographic Sight (`13110000040`) | Eye distance; zoom adjustment | 0.4 mm; 0.05x |
| [ ] | Practical Vertical Foregrip (`13140000021`) | Thickness; mounting position | 0.4 mm; mounting depends on host rail |
| [ ] | HVK double-shot barrel (provisional; `13020000603`, original: HVK双发枪管) | Trajectory offset | 1 cm |
| [ ] | M14 EBR Stock (`13040000176`) on M14 Adv. Frame System (`13050000183`) | Stock extension; another cheek-rest variant | 16; 25 source units |

The first four list M4A1 compatibility in the source catalog; this does not establish simultaneous build legality. The HVK barrel is listed under ASh-12 (`18010000012`). The M14 stock requires M14 (`18050000005`) and its frame system. Mounting-position availability depends on the exact host rail: the attachment alone does not establish a step. Source position coordinates may differ from game labels or notch counts.

## User-reported game slider names and stops

Reported 2026-11-14 in the project conversation. Step means the gap between adjacent slider stops; ± means the reported range about zero. Blank limits were not supplied. “Collapsible Stock Placement” replaces “Stock Extension”; the repeated Cheek Pad Placement entry is one slider type.

[Machine-readable observations](calibration-game-observations.csv)

| Slider name | Step | Minimum | Maximum |
| --- | ---: | ---: | ---: |
| Barrel Weight | 1 g | Not supplied | Not supplied |
| Barrel Length | 0.2 mm | Not supplied | Not supplied |
| Stock Pad Placement | 1 slot | -4 slot | +4 slot |
| Cheek Pad Placement | 1 slot | -2 slot | +2 slot |
| Zoom | 0.05 x | Not supplied | Not supplied |
| Eye Relief (Distance) | 0.4 mm | Not supplied | Not supplied |
| Foregrip Position | 1 slot | -2 slot | +2 slot |
| Thickness | 0.4 mm | Not supplied | Not supplied |
| Collapsible Stock Placement | 1 slot | -3 slot | +3 slot |

Eye Relief (Distance) is **0.4 mm per stop**, matching the source expectation. The user corrected the earlier 0.04 mm report as a typo on 2026-11-15. Placement values are game slots, while the dfttk inventory includes source-coordinate units and host-dependent variants. Do not equate these coordinates without a per-control mapping. Trajectory offset remains unreported. Patch, mode, exact attachment/weapon/host context, and screenshots were not supplied; record them in the evidence table before treating these observations as fully reproduced validation.

These observations are retained separately from `data/calibration/controls.csv` and the calculation model; runtime mapping and verification remain follow-up work.

For each slider record attachment/weapon IDs, host rail or frame, patch, mode, capture date, min/max and two adjacent values. Save screenshots. Leave mismatches as evidence; do not overwrite expected source values with assumptions.

| Weapon / attachment / host | Slider | Game min | Game max | Adjacent values | Actual step | Patch / mode / date / evidence |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

Sources: [full calibration inventory](../../data/calibration/controls.csv), [calibration model guide](../weapon_calibration.md), [English-name matching](../../data/official_accessory_names.json).

See [untranslated items](untranslated-items.md) for the remaining name-entry checklist. These temporary documents do not complete either in-game calibration validation or translation verification.
