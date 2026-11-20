import assert from 'node:assert/strict';
import {searchCategories} from '../docs/optimization/category-search.mjs';
import {runMountStream} from '../docs/optimization/m4-chart-mount-stream.mjs';
const leaf = (gain, cost) => ({row: {gain, cost}, upperGain: gain, lowerCost: cost});
const root = {upperGain: 100, lowerCost: 0, nodes: [leaf(45,4),
  {upperGain: 70, lowerCost: 10, nodes: [leaf(70,10)]}, leaf(80,90), leaf(60,5)]};
const run = (guaranteedMinimumBound, nodeLimit = Infinity) => searchCategories(root, {
  budget: 100, expand: node => node.nodes, guaranteedMinimumBound, nodeLimit,
});
const original = run(false), bounded = run(true);
for (const key of ['maximum','minimum','balanced']) {
  assert.deepEqual(original[key], bounded[key]);
  assert(bounded.proven[key]);
}
assert.equal(bounded.minimum.cost, 4);
assert(bounded.visited < original.visited);
assert.equal(run(true, 2).minimum.cost, 5);
const options = {name:'optional-eight-paths',fast:true,cachePreparation:true,budgetBound:true,
  gainBound:true,nativeChartIntervals:true,nativeStatIntervals:true,nativeContexts:true,
  portableScore:true,deterministic:true,auditMounts:false};
const baseline = runMountStream({...options,mountGainCuts:false,auditGain:true});
const reordered = runMountStream({...options,mountGainCuts:false,auditGain:true,
  priorityPaths:['2','2/6','1','3','4','4/8']});
assert.equal(baseline.audited,reordered.audited);
assert.equal(baseline.gridTuples,reordered.gridTuples);
for(const key of ['maximum','minimum','balanced']){
  assert.equal(baseline.outputs[key].gain,reordered.outputs[key].gain);
  assert.equal(baseline.outputs[key].cost,reordered.outputs[key].cost);
}
console.log('Guaranteed-threshold and alternate mount ordering oracle checks pass.');

const middleRoot = {upperGain: 90, lowerCost: 0, nodes: [
  leaf(90, 20), leaf(47, 5), leaf(60, 6), leaf(12, 1),
  leaf(70, 7), leaf(40, 10), leaf(90, 30),
]};
const middleRun = (min, max, nodeLimit = Infinity) => searchCategories(middleRoot, {
  budget: 30, expand: node => node.nodes, balancedWindow: {min, max, gainFloor: 47}, nodeLimit,
});
const expected = middleRoot.nodes.map(node => node.row)
  .filter(row => row.cost > 5 && row.cost < 20 && row.gain > 47)
  .sort((a, b) => b.gain / b.cost - a.gain / a.cost || b.gain - a.gain)[0];
assert.deepEqual(middleRun(5, 20).balanced, expected);
assert.deepEqual(expected, {cost: 7, gain: 70});
assert.equal(middleRun(5, 20).proven.balanced, true);
assert.equal(middleRun(6, 7).balanced, null);
assert.equal(middleRun(6, 7).proven.balanced, true);
assert.equal(middleRun(5, 20, 1).proven.balanced, false);
assert(middleRun(5, 20, 1).bounds.upperEfficiency >= expected.gain / expected.cost);

const negativeRoot = {upperGain: -3, lowerCost: 6, nodes: [leaf(-3, 6), leaf(-4, 10)]};
const negative = searchCategories(negativeRoot, {
  budget: 20, expand: node => node.nodes, balancedWindow: {min: 5, max: 20, gainFloor: -5},
});
assert.deepEqual(negative.balanced, {cost: 10, gain: -4});
assert.equal(negative.proven.balanced, true);
const dominated = {upperGain: 90, lowerCost: 5, nodes: [
  leaf(90, 20), leaf(47, 5), leaf(47, 6), leaf(49, 10),
]};
const dominatedResult = searchCategories(dominated, {
  budget: 20, expand: node => node.nodes, balancedWindow: {min: 5, max: 20, gainFloor: 47},
});
assert.deepEqual(dominatedResult.balanced, {cost: 10, gain: 49});
assert.equal(dominatedResult.proven.balanced, true);
console.log('Strict Balanced price window, empty window and timeout checks pass.');

const tiedOnly = {upperGain: 47, lowerCost: 6, nodes: [leaf(47, 6), leaf(46, 7)]};
const noMiddle = searchCategories(tiedOnly, {
  budget: 20, expand: node => node.nodes, balancedWindow: {min: 5, max: 20, gainFloor: 47},
});
assert.equal(noMiddle.balanced, null);
assert.equal(noMiddle.proven.balanced, true);

const incrementalWinner = searchCategories(middleRoot, {
  budget: 30, expand: node => node.nodes,
  balancedWindow: {min: 5, max: 20, gainFloor: 47, incremental: true},
});
assert.deepEqual(incrementalWinner.balanced, {cost: 6, gain: 60});
assert.equal(incrementalWinner.proven.balanced, true);

const tradeoffWinner = searchCategories(middleRoot, {
  budget: 30, expand: node => node.nodes,
  balancedWindow: {min: 5, max: 20, gainFloor: 47, tradeoffSlope: (90 - 47) / (20 - 5)},
});
assert.deepEqual(tradeoffWinner.balanced, {cost: 7, gain: 70});
assert.equal(tradeoffWinner.proven.balanced, true);

let seed = 227831;
const next = (limit) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed >>> 8) % limit;
};
for (let fixture = 0; fixture < 100; fixture++) {
  const priceLow = next(8) + 1;
  const priceHigh = priceLow + next(18) + 2;
  const floor = next(25) - 5;
  const slope = (next(50) + 1) / (priceHigh - priceLow);
  const branches = Array.from({length: 5}, () => {
    const nodes = Array.from({length: 7}, () => leaf(next(51) - 10, next(32)));
    return {nodes, lowerCost: Math.min(...nodes.map(node => node.lowerCost)),
      upperGain: Math.max(...nodes.map(node => node.upperGain))};
  });
  const root = {nodes: branches, lowerCost: 0, upperGain: 40};
  const utility = row => row.gain - floor - slope * (row.cost - priceLow);
  const candidates = branches.flatMap(branch => branch.nodes.map(node => node.row))
    .filter(row => row.cost > priceLow && row.cost < priceHigh && row.gain > floor);
  const oracle = candidates.sort((a, b) => utility(b) - utility(a) || b.gain - a.gain)[0];
  for (const nodeLimit of [0, 3, 13, Infinity]) {
    const result = searchCategories(root, {
      budget: priceHigh, expand: node => node.nodes, nodeLimit,
      balancedWindow: {min: priceLow, max: priceHigh, gainFloor: floor, tradeoffSlope: slope},
    });
    assert(result.bounds.upperEfficiency >= (oracle ? utility(oracle) : -Infinity));
    if (result.balanced) assert(candidates.includes(result.balanced));
    if (result.proven.balanced || nodeLimit === Infinity) {
      assert(result.proven.balanced);
      assert.equal(result.balanced?.gain, oracle?.gain);
      assert.equal(result.balanced && utility(result.balanced), oracle ? utility(oracle) : null);
    }
  }
}
console.log('100 seeded Balanced trees match exhaustive utility and interrupted bound checks.');

const sixtyRoot = {upperGain: 100, lowerCost: 0, nodes: [
  leaf(50, 2), leaf(60, 3), leaf(85, 7), leaf(100, 10),
]};
for (const nodeLimit of [0, 3, Infinity]) {
  const result = searchCategories(sixtyRoot, {
    budget: 10, expand: node => node.nodes, guaranteedMinimumBound: true,
    minimumShare: 0.6, nodeLimit,
  });
  assert(result.bounds.lowerCost <= 3);
  if (result.minimum) assert(result.minimum.gain >= 60);
  if (nodeLimit === Infinity) {
    assert(result.proven.minimum);
    assert.deepEqual(result.minimum, {gain: 60, cost: 3});
  }
}
console.log('60% threshold includes equality and certifies the minimum cost.');
