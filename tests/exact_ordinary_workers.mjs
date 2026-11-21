import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMountSearch} from '../tools/mount_search.mjs';
import {LinearModel} from '../tools/scip_linear_model.mjs';
import {partitionExactMounts, restrictExactMountPartition, exactMountPartitionContains,
  validateExactMountPartitions} from '../tools/exact_ordinary_partitions.mjs';
import {solveExactOrdinary, planExactOrdinaryPartitions, combineExactOrdinaryShards,
  advanceExactOrdinaryPhases} from '../tools/exact_ordinary.mjs';
import {runExactOrdinaryNodePool} from '../tools/exact_ordinary_node_pool.mjs';
import {sharedExactIncumbents} from '../tools/exact_ordinary_incumbents.mjs';
import {createExactOrdinaryPhase} from '../tools/exact_ordinary_phase.mjs';
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
function comparePartitions(barrels, jobs = 4) {
  const plan = partitionExactMounts(modelFor(barrels), new Map(), 4, undefined, jobs);
  assert.equal(plan.length, jobs);
  validateExactMountPartitions(modelFor(barrels), new Map(), plan);
  assert.throws(() => validateExactMountPartitions(modelFor(barrels), new Map(), plan.slice(1)), /Incomplete/);
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
assert.equal(comparePartitions(['A', 'B'], 9), subdividedLayouts);

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

const balanced = createExactOrdinaryPhase({kind: 'balanced', maximum: {score: 80, cost: 100},
  minimum: {score: 50, cost: 50}, incumbent: {score: 74, cost: 75}}, 120);
assert.equal(balanced.priceCeiling(), 85);
assert.equal(balanced.costCut({selectedCost: 80, suffixCosts: [5]}), false);
assert.equal(balanced.costCut({selectedCost: 80, suffixCosts: [6]}), true);
assert.equal(balanced.mountCut(20, {minimumCompletionCost: 85}), false);
assert.equal(balanced.mountCut(20, {minimumCompletionCost: 86}), true);
balanced.observe({score: 79, cost: 75});
assert.equal(balanced.priceCeiling(), 76);

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
const queued = await runExactOrdinaryNodePool(input, modules, runtime, {workers: 2, jobs: 12});
const ranks = result => result.results.map(({label, proof, cost, loss, handling}) => [label, proof, cost, loss, handling]);
assert.deepEqual(ranks(merged), ranks(serial));
assert.deepEqual(ranks(pooled), ranks(serial));
assert.deepEqual(ranks(queued), ranks(serial));
assert.equal(queued.solver.workers, 2);
assert.equal(queued.solver.partition_count, 12);
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

const starts = JSON.parse(readFileSync(new URL('../data/solver_starts/18010000038.json', import.meta.url), 'utf8'));
const stocked = {...input, solver_starts: starts, request: {...input.request, budget: 2000}};
const advance = (candidate, reports = []) => advanceExactOrdinaryPhases(
  planExactOrdinaryPartitions(candidate, modules, {staged: true}), reports, candidate, modules,
);
assert.equal(advance(stocked).phase.incumbent.cost, 940);
const withoutProof = advance(stocked, [[]]).result;
assert.equal(withoutProof.solver.exhausted, false);
assert(withoutProof.results.every(row => row.proof === 'Best found'));
assert.equal(advance({...stocked, request: {...stocked.request, minimum_stats: {handling: 60}}}).phase.incumbent, undefined);
const invalid = structuredClone(starts.ordinary_starts[0]);
invalid.tunes[Object.keys(invalid.tunes)[0]]['invalid calibration control'] = 1;
assert.equal(advance({...stocked, solver_starts: {...starts, ordinary_starts: [invalid]}}).phase.incumbent, undefined);
console.log(JSON.stringify({syntheticLayouts, subdividedLayouts, partitions, pooled: pooled.solver, rankings: ranks(pooled)}, null, 2));
