import assert from 'node:assert/strict';
import {deterministicHypot, deterministicNormFloor} from '../docs/optimization/deterministic-norm.mjs';

const scale = 2 ** 52;
function reference(x, y) {
  const magnitude = Math.max(Math.abs(x), Math.abs(y));
  if (magnitude === 0) return 0;
  const ratio = Math.min(Math.abs(x), Math.abs(y)) / magnitude;
  const target = BigInt((1 + ratio * ratio) * scale) * BigInt(scale);
  // Independent binary search on the half-unit rounding midpoints.
  let low = BigInt(scale), high = 2n * low;
  while (low < high) {
    const candidate = (low + high) / 2n;
    const midpoint = 2n * candidate + 1n;
    if (4n * target < midpoint * midpoint) high = candidate;
    else low = candidate + 1n;
  }
  return Number(low) / scale * magnitude;
}

const values = [-Number.MAX_VALUE / 4, -(2 ** 500), -100, -2, -1, -.5, -(2 ** -600),
  -Number.MIN_VALUE, -0, 0, Number.MIN_VALUE, 2 ** -600, .5, 1, 2, 100, 2 ** 500,
  Number.MAX_VALUE / 4];
let points = 0;
for (const a of values) for (const b of values) {
  assert.equal(deterministicHypot(a, b), reference(a, b));
  points++;
}
const sqrt = Math.sqrt;
try {
  for (const incorrectEstimate of [0, 1, 1.25, 1.999999, Infinity, NaN]) {
    Math.sqrt = () => incorrectEstimate;
    for (const a of values) for (const b of values) {
      assert.equal(deterministicHypot(a, b), reference(a, b));
      points++;
    }
  }
} finally {
  Math.sqrt = sqrt;
}
let state = 39470813;
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 2 ** 32;
}
for (let i = 0; i < 1000; i++) {
  const a = (random() * 2 - 1) * 2 ** Math.floor(2000 * random() - 1000);
  const b = (random() * 2 - 1) * 2 ** Math.floor(2000 * random() - 1000);
  assert.equal(deterministicHypot(a, b), reference(a, b));
  points++;
}
assert.equal(deterministicHypot(NaN, Infinity), Infinity);
assert(Number.isNaN(deterministicHypot(NaN, 1)));
let enclosed = 0;
for (let i = 0; i < values.length; i++) for (let j = i; j < values.length; j++) {
  for (let k = 0; k < values.length; k++) for (let l = k; l < values.length; l++) {
    const lower = deterministicNormFloor([values[i], values[j]], [values[k], values[l]]);
    for (let a = i; a <= j; a++) for (let b = k; b <= l; b++) {
      assert(lower <= deterministicHypot(values[a], values[b]));
      enclosed++;
    }
  }
}
console.log(points + ' deterministic norm oracle points and ' + enclosed + ' interval comparisons pass.');
