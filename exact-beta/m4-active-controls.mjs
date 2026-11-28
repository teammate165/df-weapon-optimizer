import {assert} from './chart-fixture-runtime.mjs?v=5f2833d4b3fd3a0a';
import {createOrderedAxisIntervals} from './ordered-axis-intervals.mjs?v=5f2833d4b3fd3a0a';
import {deterministicNormFloor} from './deterministic-norm.mjs?v=5f2833d4b3fd3a0a';

export const kickAxes = ['GGunkickRandom', 'GGunkickSpring'];
const chartAxes = ['GRecoil_H', 'GRecoil_V'];
export const nonObjectiveTargets = new Set(['GBreathScale', 'GAiming_ADSTime', 'AimMoveGunSway',
  'GBullet_Velocity', 'GMovement_ADSSpeed', 'ScopeCameraTuneDistance', 'ScopeZoomTuneRate']);

export function activeControls(pack, mounted, curves) {
  const controls = [];
  for (const id of pack.parts[mounted.itemId]?.tuneIds ?? []) {
    const control = curves.c(pack, mounted, id);
    if (!control || control.enabled === false) continue;
    const functions = control.functions ?? [];
    const writes = functions.filter(row => !nonObjectiveTargets.has(row.target));
    const pair = [chartAxes, kickAxes].find(axes =>
      writes.length === axes.length && axes.every(axis => writes.some(row =>
        row.target === axis && row.modifier === 'Mult_A')));
    assert(!writes.length || pair, 'Unsupported active recoil control ' + id);
    const axisTargets = pair ?? [];
    controls.push({slotPath: mounted.slotPath, id, positions: curves.n(control), axisTargets});
  }
  return controls;
}

export function minimizeKick({pack, build, mode, controls, fixed, kernel, norm, split, cache}) {
  const behavior = pack.handling.weaponBehaviorProfiles?.[pack.weapon.references.weaponBehaviorProfileId];
  const fallbacks = new Map([
    [kickAxes[0], behavior?.kickScales?.randomKickScale ?? 1],
    [kickAxes[1], behavior?.kickScales?.springKickScale ?? 1],
  ]);
  const range = createOrderedAxisIntervals({pack, build, mode, controls, fixed, axes: kickAxes,
    kernel, cache, ignoredTargets: nonObjectiveTargets, fallback: axis => fallbacks.get(axis)});
  const full = controls.map(({positions}) => [0, positions.length - 1]);
  const nodes = [{box: full, lower: deterministicNormFloor(range(full, 0), range(full, 1))}];
  let minimum = Infinity, best = null, visited = 0;
  while (nodes.length) {
    const {box, lower} = nodes.pop();
    visited++;
    if (lower >= minimum) continue;
    const children = split(box);
    if (children.length) {
      nodes.push(...children.map(child => ({box: child,
        lower: deterministicNormFloor(range(child, 0), range(child, 1))}))
        .sort((a, b) => b.lower - a.lower));
      continue;
    }
    const value = norm(range(box, 0)[0], range(box, 1)[0]);
    if (value < minimum) {
      minimum = value;
      best = box.map(([index]) => index);
    }
  }
  assert(best && Number.isFinite(minimum));
  const tunes = {};
  controls.forEach(({slotPath, id, positions}, index) => {
    (tunes[slotPath] ??= {})[id] = positions[best[index]];
  });
  return {tunes, minimum, visited};
}
