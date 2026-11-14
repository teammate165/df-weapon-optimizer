# Perceived recoil score: proposed definition v0.2

Status: draft definition; not validated against Global/Garena measurements or player judgments.

## What the score means

Perceived recoil is how fast recoil climbs and how much the camera and weapon/sight move **during continued ADS firing**. The optimizer assumes the user holds down fire with no aim compensation, corrective input, or reaction. Player effort, predictability and learnability are not objectives. A lower score means less perceived recoil. The score covers sustained automatic fire and repeated/spam trigger fire as separate test conditions. It does not score damage, accuracy from spread, handling speed, cost, or post-firing settling and target reacquisition.

This is a proposed project objective, not an extracted game formula or a claim about human perception. Component definitions, normalization and weights must be versioned together. The separate camera-shake/pattern backlog item is incorporated here; component outputs remain required.

## Components

| Component | Meaning | Proposed measurement |
|---|---|---|
| Recoil climb speed (R) | How fast uncompensated recoil moves the aim upward during firing | Mean upward angular displacement per second over the declared firing window |
| Camera shake (C) | Recoil-induced movement of the world view | RMS horizontal/vertical angular camera shake during firing, separated from the underlying aim path |
| Weapon/sight kick (K) | Recoil-induced movement of the weapon/sight relative to the camera | RMS horizontal/vertical angular sight movement relative to the camera during firing |

Compensation demand and unpredictability are merged into R. Repeatable and random recoil both contribute to the actual uncompensated trace; neither receives a separate player-effort or reaction penalty. The earlier 40/20/25/15 proposal is withdrawn. Weights for R/C/K remain unset pending agreement and validation. Retain horizontal and vertical measurements in output; do not collapse camera shake and sight kick into a single Stability value or use displayed Control points as physical measurements.

### Recoil climb speed

For trial r, let `y_r(t)` be the vertical angular aim displacement caused by recoil, with upward positive and ballistic spread excluded. Let `t0` and `t1` be the declared start/end of the firing analysis window and `T = t1 - t0`:

```text
climb_r = (y_r(t1) - y_r(t0)) / T
R = mean_r(max(0, climb_r))       # degrees/second; lower is better
```

This draft uses net upward climb per second, not the total distance traveled along a zigzag and not the amount of correction a player would need. For example, an uncompensated rise of 6 degrees over 2 seconds is 3 degrees/second regardless of whether the path was predictable. Compute each trial's upward climb before averaging so upward and downward trials do not cancel. Report signed climb, trial variation, horizontal drift, peak displacement and the continuous trace as diagnostics. Horizontal movement and trial variation have no separate weight in this draft; camera/sight shake remain separate visual components. A downward-drifting build gets zero upward-climb contribution rather than negative credit; record its signed drift so that limitation is visible.

Random recoil is included through its effect on measured climb in each trial. Do not invent a randomness penalty or substitute dfttk shooting-lab synthetic jitter. A deterministic source trajectory yields a modeled climb estimate, not measured trial variation. A bullet-impact pattern alone cannot separate aim recoil from ballistic spread.

The proposed initial window remains first-to-last shot, so the scalar does not yet include the first-shot impulse or the final-shot visual response; retain those diagnostics and resolve the boundary before freezing v1. Retain continuous between-shot movement, especially in spam fire. Recovery mechanics may affect the active trace but receive no separate recovery score. Automatic fire is the primary hold-trigger condition; spam-fire tests use a prescribed input cadence without reactive compensation.

### Camera and sight motion

With camera-shake channel `c(t)` and weapon/sight movement relative to camera `k(t)`, both in angular units:

```text
C_H = sqrt(mean_t(c_H(t)^2)); C_V = sqrt(mean_t(c_V(t)^2))
C   = hypot(C_H, C_V)
K_H = sqrt(mean_t(k_H(t)^2)); K_V = sqrt(mean_t(k_V(t)^2))
K   = hypot(K_H, K_V)
```

Remove the pre-fire static offset, not the firing-induced mean displacement: a sustained sight offset must remain visible. Use time-weighted samples at a fixed sampling rate. If camera movement, base aim and sight kick cannot be isolated reliably, mark the affected component unavailable. Do not assign zero or count the same screen-space trace as both C and K. Any filtering or camera/aim decomposition needs a documented transfer function, parameters and validation clips; no arbitrary smoothing is part of this definition.

Store angular motion and observed screen motion with FOV, aspect ratio and optic settings. Initial comparisons use the same optic and zoom where compatible. The primary score represents angular recoil at that fixed viewing condition; different optics or zoom are separate comparison conditions until their effect on perceived motion has been validated. Do not reward camera-distance or magnification changes using unsupported model consumers.

## Normalization and combined score

For component vector `x = (R,C,K)`, use fixed positive reference scales `s` for a specified mode, patch and firing protocol:

```text
S = 100 * (w_R * R/s_R + w_C * C/s_C + w_K * K/s_K)
w_R + w_C + w_K = 1; all weights nonnegative; values not yet chosen
```

The reference build has score 100 when `s` is its measured component vector. Choose and freeze a reference with measurable nonzero components before publishing rankings; otherwise select documented positive scales from the measurement cohort. Scales are currently unset. A zero or unavailable reference component blocks normalization until an explicit scale is established. Missing build components produce an incomplete result, not a renormalized full score. Retain absolute metrics, normalized metrics, weights, reference identity, repeat variation and score version.

Use the **same** scales for every weapon/build in a cross-weapon ranking under the same protocol. For within-weapon optimization, the default build can instead define local reference scales, with its score 100; label those results relative and do not compare their numbers across weapons. Improvement is `100 * (1 - S_build/S_default)` percent under unchanged scales and protocol. No upper bound or clamp applies to S.

Publish automatic and spam-fire scores separately. Do not silently average them. If one combined usage score is later needed, it requires an explicit user-selected firing mix and compatible validated scales. Different cadence is a different condition; source single/burst multipliers alone do not simulate spam-fire dynamics.

## Reproducible validation protocol

1. Record patch, client region, date, mode (Operations/Detonation/Warfare), weapon/profile and attachment IDs, calibration values, stance, ADS/optic/FOV, resolution/aspect ratio, distance, input behavior, frame rate and capture rate. Stand still, use a fixed aim point, disable intentional recoil compensation, and keep held-breath state consistent. Record idle motion so recoil-induced signals can be distinguished from sway.
2. Initial automatic protocol: 20 shots without release, analyzing first-to-last-shot motion; retain the final-shot visual response as a separately reported diagnostic until an active-window boundary is agreed. Weapons unable to fire 20 rounds continuously need a separately labeled protocol, not a reload or silently shortened window. Record actual shot timestamps and duration. Different RPM therefore affects movement per second. Test opening and sustained segments separately as diagnostics; AN94 timing uncertainty must remain flagged.
3. Initial spam protocol: 20 shots at a fixed declared cadence achievable by every build in the comparison. Report achieved timestamps, missed inputs and cadence tolerance. Do not compare different requested cadences in one ranking. Burst weapons require a separately labeled burst protocol rather than being silently treated as single shots.
4. Capture at least 10 identical trials per build as an initial collection target. Retain all trials and exclusion reasons; increase the count if uncertainty changes the ranking. Use continuous recordings for camera/sight motion and shot-resolved angular aim/recoil traces for R. Impact locations alone are insufficient. Never use dfttk shooting-lab synthetic jitter as measured recoil variation.
5. Compare default, a pattern-focused change, a camera-focused change, a kick-focused change, and a tuned combination. Include distinct recoil profiles and rates of fire. Where the data cannot isolate one component, document the limitation rather than claiming an isolated test.
6. Collect blinded, randomized A/B judgments under matching conditions and retain ties. Use a training set to fit nonnegative weights summing to one; reserve builds and participants for held-out evaluation. Publish agreement, uncertainty, disagreements and sensitivity to weights/scales. Set numerical acceptance thresholds before examining held-out results. Evaluate visible uncompensated firing behavior, not player correction effort or reactions. Weight values remain unset until agreed and validated.

The 20-shot and 10-trial choices are proposed collection defaults, not established perceptual constants. First-shot treatment, the final-shot response boundary, camera/aim separation and continuous between-shot movement remain explicit definition questions to resolve with pilot recordings before freezing v1. Until then this is a reviewable definition draft, not a production scoring contract.

## Relationship to the current generator

[Timed source-chart diagnostics](timed_recoil_paths.md) now compute R in model units/second with source firing timestamps, horizontal span, peak displacement and opening/sustained summaries. They are separate from the optimizer's combined score. No measured angular calibration, player reaction or new R/C/K weights are assumed.

`tools/recoil_generator.mjs` currently uses source multiplier norms and weights 30/40/30 for pattern/camera/kick, normalized within one weapon. That is a legacy experimental proxy, not this proposed three-component score. It has no measured angular climb speed, cadence integration, camera rendering or sight-motion signal. Keep its results labeled experimental; do not relabel multiplier norms as v0.2 climb measurements. Replacing its objective requires validated component inputs and a versioned scoring implementation.

Source-model limitations are traced in [stat effects](dfttk_stat_effects_source.md), [builder capabilities](dfttk_builder_capabilities.md), and [calibration mechanics](weapon_calibration.md). Current generator behavior is documented in [generator usage](recoil_generator.md). These local sources support what the available model computes; the metric choices above are project proposals.

## Completion requirements

- Freeze component definitions, axes, units, protocol, first/final-shot treatment and camera/aim decomposition after pilot review.
- Establish reproducible measured inputs and positive, versioned normalization scales; preserve missing/uncertain data.
- Fit and validate weights with recorded comparisons, report held-out performance and uncertainty, and document any revision.
- Implement the validated score and test monotonic component changes, reference behavior, missing data, protocol mismatches and reproducibility.
- Rank Global default weapon configurations under identical protocols, publishing components, scores, confidence and evidence IDs alongside each ranking.

Definition drafting is progress. The combined TODO item remains open until validation and ranking requirements are met.

## Experimental generator revision (2026-11-15)

The Lowest Recoil proxy now replaces multiplier-norm pattern loss with `V + H + 1.5 * max(0, H - 1.5)` for supported automatic base protocols, using fixed 20-point ADS source-chart excursions. Pattern/camera/kick weights remain 30/40/30 and per-weapon default normalization remains. Unsupported base protocols retain explicitly labeled legacy scoring; Highest Agility keeps its previous recoil tie-breaker. This supersedes the legacy-only generator description above, not the proposed measured R/C/K definition. The new pattern is spatial excursion, not angular climb speed or a validated perceptual score. [Current implementation contract](horizontal_recoil_penalty.md), [trials](horizontal_optimizer_trial.md).
