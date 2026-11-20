import assert from 'node:assert/strict';
import {combineEndpoints, balancedWindow, sharedBalancedSeed, combineBalanced} from '../builder/exact-beta-pool.js';
import {runFullOrdinaryPhase} from '../docs/optimization/m4-full-ordinary-study.mjs';

const row = (cost, gain) => ({cost, gain});
const shard = (maximum, archive, pending = 0, upperGain = maximum.gain) =>
  ({outputs: {maximum}, archive, pending, certificate: {upperGain, lowerCost: 1}});
const a = shard(row(20, 64), [row(10, 45), row(20, 64)]);
const b = shard(row(50, 100), [row(25, 65), row(35, 91), row(50, 100)]);
const endpoints = combineEndpoints([a, b], 0.6);
assert.deepEqual(endpoints.outputs.minimum, row(20, 64));
assert(endpoints.proven.maximum && endpoints.proven.minimum);
const partial = combineEndpoints([a, shard(row(50, 100), b.archive, 1, 110)], 0.6);
assert.deepEqual(partial.outputs.minimum, row(35, 91));
assert(!partial.proven.maximum && !partial.proven.minimum);
assert.equal(balancedWindow(partial), null);
const window = balancedWindow(endpoints);
const seed = sharedBalancedSeed(endpoints.archive, window);
assert.deepEqual(seed, row(35, 91));
const completed = {outputs: {balanced: seed}, proven: {balanced: true}, pending: 0, certificate: {upperEfficiency: 9}};
const unfinished = {...completed, proven: {balanced: false}, pending: 1, certificate: {upperEfficiency: 20}};
const merged = combineBalanced(endpoints, [completed, unfinished], window);
assert(!merged.proven.balanced && merged.pending === 1 && merged.certificate.upperEfficiency === 20);

const plan = runFullOrdinaryPhase({partitionCount: 4});
assert.equal(plan.length, 4);
const items = plan.flatMap(partition => partition.items);
assert(items.includes(null));
assert.equal(new Set(items).size, items.length);
assert.equal(plan.reduce((sum, partition) => sum + partition.layouts, 0), 12268642);
for (const partition of plan) {
  const result = runFullOrdinaryPhase({partition, deadlineMs: 1, endpointArchive: true});
  assert.equal(Number(result.expectedMountCount), partition.layouts);
}
console.log('Four disjoint partitions and the global endpoint, shared seed and timeout certificates pass.');
