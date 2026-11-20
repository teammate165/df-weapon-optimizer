import assert from 'node:assert/strict';
import {createNativeChartInterval} from '../tools/branch_score_bounds.mjs';
import {fastestHorizontalSpeed, horizontalSpeedMultiplier} from '../tools/horizontal_speed.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';

const trajectory = calculate.screeningChartContract.trajectory;
const profiles = [
  {continuousFire: {horizontalValues: [0, 1, -2, 3], verticalValues: [1, -2],
    horizontalScale: 0, verticalScale: 1.2},
  loop: {horizontalValues: [1, -3], verticalValues: [2, -1, 3], horizontalScale: .75, verticalScale: -1}},
  {singleShot: {horizontalValues: [1, 9], verticalValues: [-2, 9],
    horizontalScale: .8, verticalScale: .9}, loop: {horizontalValues: [], verticalValues: []}},
  ...[3, 4, 5].map(speed => ({continuousFire: {horizontalValues: [speed * .75],
    verticalValues: [.125], horizontalScale: 1}})),
];
const intervals = [
  Array.from({length: 20}, (_, i) => i * 75),
  Array.from({length: 20}, (_, i) => Math.floor(i / 3) * 260 + (i % 3) * 70),
  Array.from({length: 20}, (_, i) => i === 1 ? 0.25 : i * 75),
];
const values = [-1.25, -1, -0.01, 0, 0.99999999, 1, 1.00000001, 1.01, 2];
let singletons = 0, enclosures = 0;
for (const profile of profiles) for (const times of intervals) {
  const bound = createNativeChartInterval(profile, times);
  const pointsAt = (h, v) => trajectory(profile, h, v, false, 20)
    .map((point, i) => ({...point, time_ms: times[i]}));
  function exact(h, v) {
    const points = pointsAt(h, v);
    const speed = fastestHorizontalSpeed(points).speed;
    const distance = Math.max(...points.map(p => Math.abs(p.x)));
    const ys = points.map(p => p.y);
    return {speed, pattern: Math.max(...ys) - Math.min(...ys) +
      horizontalSpeedMultiplier(speed) * distance};
  }
  const grid = values.map(h => values.map(v => {
    const result = exact(h, v);
    assert.deepEqual(bound.lower([h, h], [v, v]), result);
    singletons++;
    return result;
  }));
  for (let a = 0; a < values.length; a++) for (let b = a; b < values.length; b++) {
    for (let c = 0; c < values.length; c++) for (let d = c; d < values.length; d++) {
      const lower = bound.lower([values[a], values[b]], [values[c], values[d]]);
      for (let i = a; i <= b; i++) for (let j = c; j <= d; j++) {
        assert(lower.speed <= grid[i][j].speed && lower.pattern <= grid[i][j].pattern);
        enclosures++;
      }
    }
  }
}
for (const [index, tier] of [3, 4, 5].entries()) {
  const bound = createNativeChartInterval(profiles[index + 2], intervals[0]);
  for (const range of [[1.01, 2], [-2, -1.01]]) {
    assert(bound.horizontalLower(range).speed > tier);
  }
  assert(bound.horizontalLower([1, 2]).speed <= tier);
  assert.equal(bound.horizontalLower([-2, 2]).speed, 0);
}
const steadyVertical = createNativeChartInterval({continuousFire: {verticalValues: [1]}}, intervals[0]);
assert(steadyVertical.verticalLower([1, 4]) > 1.89998);
assert(steadyVertical.verticalLower([-4, -1]) > 1.89998);
assert.equal(steadyVertical.verticalLower([-4, 4]), 0);
console.log(singletons + ' exact singleton charts and ' + enclosures + ' interval checks pass.');
