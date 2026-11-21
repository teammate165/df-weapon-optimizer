import assert from 'node:assert/strict';
import {createFiniteKickMinimum, foldedAddGroups, foldedProductGroups, nativeCurveRange,
  sharedKickFactors} from '../tools/branch_native_ranges.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';

const point = x => [x, x];
function* permutations(items) {
  if (!items.length) { yield []; return; }
  for (let i = 0; i < items.length; i++) {
    for (const rest of permutations(items.filter((_, j) => i !== j))) yield [items[i], ...rest];
  }
}
function* selections(groups) {
  if (!groups.length) { yield []; return; }
  for (const first of groups[0]) for (const rest of selections(groups.slice(1))) yield [...first, ...rest];
}
let folds = 0;
for (const [bound, combine, initial, examples] of [
  [foldedAddGroups, (a, b) => a + b, 0, [
    [[[2 ** 53, 1], [-(2 ** 52)]], [[-(2 ** 53)], [0]], [[.1, .2], []]],
    [[[0.1, 0.2]], [[-0.3]], [[2 ** -900], []]],
    [[[30, 17], [-12]], [[16], []], [[-3, 12]]],
  ]],
  [foldedProductGroups, (a, b) => a * b, 1, [
    [[[1.0000000000000002, 0.997], [-1.1]], [[.625], [1.2]], [[-.9, 1.03], []]],
    [[[2 ** -100, 2 ** 100]], [[1.1], [-.5]], [[.99], []]],
  ]],
]) {
  for (const groups of examples) {
    const [lo, hi] = bound(groups.map(group => group.map(atoms => atoms.map(point))));
    for (const values of selections(groups)) for (const order of permutations(values)) {
      const actual = order.reduce(combine, initial);
      assert(lo <= actual && actual <= hi);
      folds++;
    }
  }
}
assert.throws(() => foldedProductGroups([[[[-1, 1]]]]));
assert.throws(() => foldedProductGroups([[[point(Number.MIN_VALUE)]]]));
assert.deepEqual(foldedAddGroups([[[point(10)], [point(20)]], [[point(-7)]]]), [3, 13]);
assert.deepEqual(foldedAddGroups([
  [[point(.1), point(-0)], [point(.1)]], [[point(.2)]],
]), point(.1 + .2));
assert.deepEqual(foldedAddGroups([
  [[point(.1), point(.2)], [point(.2), point(.1)]], [[point(0)], []],
]), point(.1 + .2));
assert.deepEqual(foldedProductGroups([
  [[point(.9), point(1)], [point(.9)]], [[point(1.01)]],
]), point(.9 * 1.01));
assert.deepEqual(foldedProductGroups([
  [[point(-2)], [point(3)]], [[point(-4)], []],
]), [-12, 8]);

const factor = value => ({initial: [], addend: [], multA: [], multC: [point(value)]});
assert.deepEqual(sharedKickFactors(new Map([
  ['GGunkickRandom', factor(.76)], ['GGunkickSpring', factor(.76)],
])), [.76]);
assert.equal(sharedKickFactors(new Map([
  ['GGunkickRandom', factor(.76)], ['GGunkickSpring', factor(.77)],
])), null);
const exactKickFloor = createFiniteKickMinimum(Math.hypot, 1.1, .8);
const factors = [.76, 1.04, .68, .88];
const tables = [{id: 0, values: [-.04, 0, .03]}, {id: 1, values: [-.03, .01]}];
const scales = [.81, 1.02, .91];
let expectedKick = Infinity;
for (const order of permutations(factors)) {
  for (const scale of scales) for (const left of tables[0].values) for (const right of tables[1].values) {
    const product = order.reduce((a, b) => a * b, 1) * scale;
    expectedKick = Math.min(expectedKick,
      Math.hypot((1.1 * (1 + (left + right))) * product, (.8 * (1 + (left + right))) * product));
  }
}
assert.equal(exactKickFloor(factors, tables, scales), expectedKick);
assert.equal(exactKickFloor([...factors].reverse(), [...tables].reverse(), scales), expectedKick);
const threeTables = [...tables, {id: 2, values: [-.6, -.025, .15]}];
let threeWriterMinimum = Infinity;
for (const order of permutations(factors)) {
  for (const scale of scales) {
    const product = order.reduce((a, b) => a * b, 1) * scale;
    for (const left of threeTables[0].values) for (const middle of threeTables[1].values) {
      for (const right of threeTables[2].values) for (const addends of permutations([left, middle, right])) {
        const multA = 1 + addends.reduce((a, b) => a + b, 0);
        threeWriterMinimum = Math.min(threeWriterMinimum,
          Math.hypot((1.1 * multA) * product, (.8 * multA) * product));
      }
    }
  }
}
assert.equal(exactKickFloor(factors, threeTables, scales), threeWriterMinimum);
assert.equal(exactKickFloor(factors, [...threeTables].reverse(), scales), threeWriterMinimum);
assert.equal(exactKickFloor(factors, [...threeTables, tables[0]], scales), null);

const profiles = [
  {points: [
    {inputValue: -2, outputValue: -.5, leaveTangent: 9, interpolationMode: 'RCIM_Cubic'},
    {inputValue: 0, outputValue: 1, arriveTangent: -1, interpolationMode: 'RCIM_Linear'},
    {inputValue: 4, outputValue: -2, arriveTangent: 1},
  ]},
  {points: [
    {inputValue: -3, outputValue: 2, leaveTangent: -.01, interpolationMode: 'RCIM_Cubic'},
    {inputValue: 5, outputValue: .25, arriveTangent: -3},
  ]},
];
let curvesChecked = 0;
for (const curve of profiles) for (let lo = -4; lo <= 5; lo++) for (let hi = lo; hi <= 6; hi++) {
  const [lower, upper] = nativeCurveRange(curve, [lo, hi], curves.r);
  if (lo === hi) assert.deepEqual([lower, upper], point(curves.r(curve, lo)));
  for (let step = 0; step <= 100; step++) {
    const value = curves.r(curve, lo + (hi - lo) * step / 100);
    assert(lower <= value && value <= upper);
    curvesChecked++;
  }
}
console.log(folds + ' native fold orders and ' + curvesChecked + ' native curve values enclosed.');
