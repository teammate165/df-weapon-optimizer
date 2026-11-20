import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMountSearch} from '../tools/mount_search.mjs';
import {LinearModel} from '../tools/scip_linear_model.mjs';
import {partitionExactMounts, restrictExactMountPartition, exactMountPartitionContains} from '../tools/exact_ordinary_partitions.mjs';
import {solveExactOrdinary, planExactOrdinaryPartitions, combineExactOrdinaryShards} from '../tools/exact_ordinary.mjs';
import {runExactOrdinaryNodePool} from '../tools/exact_ordinary_node_pool.mjs';
import {sharedExactIncumbents} from '../tools/exact_ordinary_incumbents.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';

const modelFor = (barrels = ['A', 'B', 'C', 'D']) => {
  const model = new LinearModel(), players = new Map();
  for (const [path, choices] of [['2', barrels], ['3', ['E', 'F']], ['2/1', ['G']]]) {
    for (const item of choices) players.set(path + '|' + item, {path, item, value: model.variable('mount'), cost: 0});
  }
  model.constrain(model.add(players.get('2/1|G').value, model.scale(players.get('2|A').value, -1)), '<=', 0, 'child');
  return {model, players};
};
const signature = config => config.map(row => row.slotPath + '|' + row.itemId).sort().join(',');
function comparePartitions(barrels) {
  const plan = partitionExactMounts(modelFor(barrels), new Map(), 4);
  assert.equal(plan.length, 4);
  const all = [...createMountSearch(modelFor(barrels)).enumerate()].map(signature).sort();
  const joined = plan.flatMap(partition => {
    const compiled = modelFor(barrels);
    const restrictions = restrictExactMountPartition(compiled, new Map(), partition);
    const rows = [...createMountSearch(compiled).enumerate(restrictions)];
    assert(rows.every(config => exactMountPartitionContains(partition, config)));
    return rows.map(signature);
  }).sort();
  assert.deepEqual(joined, all);
  return all.length;
}
const syntheticLayouts = comparePartitions(['A', 'B', 'C', 'D']);
const subdividedLayouts = comparePartitions(['A', 'B']);

const size = 12 * BigUint64Array.BYTES_PER_ELEMENT;
const buffer = new SharedArrayBuffer(size);
const writer = sharedExactIncumbents(buffer), reader = sharedExactIncumbents(buffer);
assert.equal(reader.lossAt(null), Infinity);
writer.publish(null, 3.14);
writer.publish(null, 200);
writer.publish(null, 0);
writer.publish(10, 33);
writer.publish(10, 13);
writer.publish(11, 4);
assert.equal(reader.lossAt(null), 0);
assert.equal(reader.lossAt(10), 13);
assert.equal(reader.lossAt(11), Infinity);

const root = process.argv[2] ?? fileURLToPath(new URL('../.scratch/pages-public-beta/data/', import.meta.url));
const {shop, prices} = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
const pack = JSON.parse(readFileSync(join(root, 'weapons/18010000038.json'), 'utf8'));
const runtime = new URL('../.scratch/calibration-check/', import.meta.url);
const modules = {curves, kernel, calculate};
const input = {pack, shop, prices, request: {mode: 'bd', budget: 20, time_limit_seconds: 0}};
const partitions = planExactOrdinaryPartitions(input, modules, {workers: 4});
const shards = partitions.map(partition => solveExactOrdinary(input, modules, {partition, collectArchive: true}));
const serial = solveExactOrdinary(input, modules);
const merged = combineExactOrdinaryShards(partitions, shards, input, modules);
const partial = combineExactOrdinaryShards(partitions, shards.slice(0, -1), input, modules);
const expired = solveExactOrdinary(input, modules, {partition: partitions[0], collectArchive: true, deadlineEpochMs: Date.now() - 10});
const expiredMerged = combineExactOrdinaryShards(partitions, [expired, ...shards.slice(1)], input, modules);
const pooled = await runExactOrdinaryNodePool(input, modules, runtime);
const ranks = result => result.results.map(({label, proof, cost, loss, handling}) => [label, proof, cost, loss, handling]);
assert.deepEqual(ranks(merged), ranks(serial));
assert.deepEqual(ranks(pooled), ranks(serial));
assert.equal(merged.solver.layouts, serial.solver.layouts);
assert.equal(merged.solver.exhausted, true);
assert.equal(partial.solver.exhausted, false);
assert.equal(expired.solver.exhausted, false);
assert.equal(expiredMerged.solver.exhausted, false);
for (const result of [partial, expiredMerged]) {
  assert(result.results.every(row => row.proof !== 'Proven optimal'));
  assert.deepEqual(result.solver.proven, {maximum: false, minimum: false, balanced: false});
}
assert.throws(() => combineExactOrdinaryShards(partitions, [...shards, shards[0]], input, modules), /Unexpected/);
assert.throws(() => combineExactOrdinaryShards(partitions.slice(1), shards.slice(1), input, modules), /Incomplete/);
const controller = new AbortController();
const canceled = runExactOrdinaryNodePool({...input, signal: controller.signal}, modules, runtime);
controller.abort();
await assert.rejects(canceled, {name: 'AbortError'});
console.log(JSON.stringify({syntheticLayouts, subdividedLayouts, partitions, pooled: pooled.solver, rankings: ranks(pooled)}, null, 2));
