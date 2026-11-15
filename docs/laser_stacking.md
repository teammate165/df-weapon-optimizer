# Laser bonus stacking investigation

Investigated 2026-11-15. Catalog `20261108-an94-bd-shop.1`; game patch/region equivalence is unknown.

Player tests support the claim that enabled laser benefits do not stack, while each device's ordinary Handling penalty remains. This is not conclusively verified for the current Global/Garena client. [An ADS/handling firing-range report](https://www.reddit.com/r/DeltaForceGlobal/comments/1esv21g/does_stacking_laser_sight_give_you_more_handling/) and [multiple-device accuracy/penalty observations](https://www.reddit.com/r/DeltaForceGlobal/comments/1idq63e/ladies_and_gentlemen_after_extensive_testing_i/) support non-stacking. A [conflicting discussion](https://www.reddit.com/r/DeltaForceGlobal/comments/1iroh5k/laserlight_questions/) includes disagreement about Handling and a separate accuracy test. These are player reports, not an official mechanics specification.

DFTTK's source is not evidence of non-stacking: both preserved kernel `weaponBuilderV3FireControl-C-hA1uh4.js` and [current kernel](https://dfttk.com/static/weaponBuilderV3FireControl-D3BGW0CJ.js) accumulate each mounted device's `TacticalEffective` operations. The project reproduced the overcount in its own evaluator before correction:

| Mode | LA-3C enabled bonus, one device | Two devices before | Two/three devices after |
| --- | --- | --- | --- |
| Detonation/Operations | Handling +16, Accuracy +12 | Handling +32, Accuracy +24 | Handling +16, Accuracy +12 |
| Warfare | Handling +7, Accuracy +12 | Handling +14, Accuracy +24 | Handling +7, Accuracy +12 |

Weapon `18010000001`; LA-3C `13160000006`; mount paths `4/19`, `4/20`, `4/17`. These are conditional ON-minus-OFF effective-point differences; ordinary attachment penalties are present in both endpoints and still accumulate. See [regression](../tests/laser_stacking.mjs).

## Project policy

To prevent unsupported optimizer gains, keep the strongest enabled additive bonus for each target, once across all mounted qualifying devices. This strongest-per-stat rule for mixed devices is explicitly a provisional modeling policy. It is not confirmed client precedence behavior. It preserves all ordinary operations, calibration, prices and source records. Only conditional operations admitted by the source kernel's laser predicate are deduplicated; deployed bipods remain OFF. Accuracy and Handling, including their display counterparts, are corrected together before curve mapping. Single-device source behavior is unchanged.

Both optimizer presets reject additional unlocked lasers beyond one. Explicitly locked multi-device setups remain legal, but cannot multiply their enabled bonuses. The same policy feeds evaluation, candidate comparisons, curves, paths and the exported worker, so generated totals replay consistently. The picker explains that only the strongest enabled bonus applies.

[Policy helper](../tools/laser_effects.mjs) filters operations in a narrow, reproducible patch to the generated kernel. [Preparation](../tools/prepare_project_runtime.py) saves `kernel.unmodified.mjs`; downloaded source JavaScript remains untouched. Unknown generated-kernel signatures and unsupported new conditional operation types fail explicitly rather than silently changing behavior. Backend, CLI and export preparation install/copy the same helper. Source-reference checks run before the project overlay is applied.

Validation commands:

```powershell
python tools/prepare_project_runtime.py
node tests/laser_stacking.mjs --optimizer
node tests/special_effects.mjs
node tests/horizontal_speed.mjs
python -m unittest discover -s tests -p test_builder_server.py
```

For client confirmation, record patch, region, platform, mode, weapon/loadout IDs, laser enabled states and frame rate. Compare one, two and three identical devices, plus mixed laser/light combinations. Measure ADS duration and hip-fire cone in repeated fixed-condition captures; separate ordinary penalties from enabled bonuses and declare the uncertainty. Mixed-device precedence remains open until this is done.
