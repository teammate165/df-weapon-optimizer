import assert from 'node:assert/strict';
import {nodeNormRuntime, v8NormFloorFor} from '../docs/optimization/v8-norm-floor.mjs';

const runtime = nodeNormRuntime(process);
const lower = v8NormFloorFor(runtime);
assert(lower, 'Use --jitless on the audited Node binary');
assert.equal(v8NormFloorFor({...runtime, jitless: false}), null);
assert.equal(v8NormFloorFor({...runtime, v8: 'unknown'}), null);
assert.equal(v8NormFloorFor({...runtime, arch: 'arm64'}), null);

const values = [-Number.MAX_VALUE / 4, -(2 ** 500), -100, -2, -1, -.5, -(2 ** -600),
  -Number.MIN_VALUE, -0, 0, Number.MIN_VALUE, 2 ** -600, .5, 1, 2, 100,
  2 ** 500, Number.MAX_VALUE / 4];
let points = 0, boxes = 0;
for (const x of values) for (const y of values) {
  const actual = Math.hypot(x, y);
  assert.equal(lower([x, x], [y, y]), actual);
  points++;
}
for (let i = 0; i < values.length; i++) for (let j = i; j < values.length; j++) {
  for (let k = 0; k < values.length; k++) for (let l = k; l < values.length; l++) {
    const floor = lower([values[i], values[j]], [values[k], values[l]]);
    for (let a = i; a <= j; a++) for (let b = k; b <= l; b++) {
      assert(floor <= Math.hypot(values[a], values[b]));
      boxes++;
    }
  }
}
console.log(points + ' exact norm points and ' + boxes + ' sampled norm enclosures pass.');
