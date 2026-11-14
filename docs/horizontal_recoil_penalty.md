# Horizontal recoil penalty anchors (2026-11-15)

Status: production implementation prepared; validation and release recorded in TODO.md.

User selected the base PTR-32 and MK47 builds as examples of excessive horizontal recoil. Resolved default loadouts with no selected attachments or tuning, automatic ADS, 20 shots, preserved source calculator via tools/timed_recoil.mjs. Results agree across bd/sol/mp in the current local snapshot.

| Weapon ID | Weapon | Horizontal span, model units |
| --- | --- | --- |
| 18010000024 | PTR-32 | 2.7975 |
| 18010000043 | MK47 | 3.3830 |
| 18010000001 | M4A1 comparison | 2.4245 |

All three default GRecoil_H/GRecoil_V multipliers equal 1/1. The existing multiplier norm cannot distinguish their underlying trajectory magnitudes. Horizontal net drift is unsuitable for measuring side-to-side excursion because reversals cancel. These spans describe cumulative post-shot source-chart coordinates; they are not angular measurements, randomness measurements or Global/Garena validation.

## Agreed threshold and shared formula

Latest user decision: REVERT the base-span gate. Check candidate horizontal span instead, with threshold 1.5 and 2.5x marginal horizontal weight above it.

```text
pattern = V + H + 1.5 * max(0, H - 1.5)
```

H is the updated candidate horizontal span; V is vertical excursion over the same fixed 20-shot automatic ADS trace. Below 1.5, marginal vertical:horizontal weight is 1:1; above 1.5 it is 1:2.5. No weapon-name exceptions or persistent base-derived weight. Normalize by the default pattern evaluated with this same formula, then retain 30/40/30 pattern/camera/kick weights and strict Handling tie-breaking. Shorter base magazines and nonautomatic firing need compatible protocols before production implementation.

Production Lowest Recoil now implements the formula for supported automatic base configurations. Eligibility is fixed per run using the default 20-shot timed path; unsupported protocols (including base magazines below 20 and spam/burst/single) retain the legacy multiplier proxy with explicit run limitations. Highest Agility retains its previous recoil tie-breaker. Candidate chart scoring always uses 20 points, independently of UI graph shot count; a candidate magazine below 20 is an abstract profile evaluation, not a continuous firing claim. No implicit Handling floor is added: 50/55 were experiment constraints. Global/Garena validation remains open. See docs/horizontal_optimizer_trial.md for historical experiments.


Reproduction: assemble each weapon pack with tools/sync_dfttk_database.py assemble(load('manifest.json')['weaponPacks'][weapon_id]); resolve curves.o(pack, [], mode); run timedRecoil(pack, build, {}, {mode, shot_count:20}, {curves,kernel,calculate}) using preserved .scratch/calibration-check modules. Inspect metrics.horizontal_span_model_units. Runtime/source-model limitations in docs/timed_recoil_paths.md remain applicable.
