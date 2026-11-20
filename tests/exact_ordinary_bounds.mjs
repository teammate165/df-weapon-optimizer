import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {solveExactOrdinary} from '../tools/exact_ordinary.mjs';
import {createOrdinaryControls, prepareOrdinaryBound} from '../tools/exact_ordinary_bounds.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';

const data = process.argv[2];
if (!data) throw Error('Pass the data directory of a local Pages export');
const read = filename => JSON.parse(readFileSync(join(data, filename), 'utf8'));
const {shop, prices} = read('catalog.json');
const modules = {curves, kernel, calculate};
const reports = [];
function compare(input, runtime) {
  const {pack, request: {mode, budget, pattern_reduction_percent: cap}} = input;
  const direct = solveExactOrdinary(input, runtime, {pruneCalibration: false});
  const pruned = solveExactOrdinary(input, runtime, {pruneMounts: false});
  const combined = solveExactOrdinary(input, runtime);
  assert(combined.solver.exhausted && pruned.solver.exhausted && direct.solver.exhausted);
  assert.equal(pruned.solver.layouts, direct.solver.layouts);
  assert(combined.solver.layouts <= direct.solver.layouts);
  assert.deepEqual(pruned.pattern_constraint, direct.pattern_constraint);
  assert.deepEqual(pruned.results, direct.results);
  assert.deepEqual(combined.results, direct.results);
  reports.push({id: pack.weaponId, mode, budget, cap, layouts: pruned.solver.layouts, direct: direct.solver.evaluated,
    pruned: pruned.solver.evaluated, combined: combined.solver.evaluated, proof: pruned.results[0].proof,
    cuts: pruned.solver.pruning, mountCuts: combined.solver.mount_pruning?.cuts});
  return pruned;
}

for (const [id, mode, budget, cap] of [
  ['18010000038', 'bd', 20, 5],
  ['18010000038', 'bd', 20],
  ['18010000001', 'bd', 20, 5],
  ['18010000001', 'bd', 20],
  ['18070000005', 'bd', 20, 5],
  ['18010000038', 'sol', 0, 5],
]) {
  const pack = read(`weapons/${id}.json`);
  const request = {mode, budget, time_limit_seconds: 0, pattern_reduction_percent: cap};
  compare({pack, request, shop, prices}, modules);
}

// Exercise multiple active recoil and kick controls on a tractable native grid.
const pack = read('weapons/18010000038.json');
const parts = new Set(['13030000189', '13040000110', '13140000042']);
for (const [id, display] of Object.entries(pack.display.objects)) {
  if (!parts.has(id)) display.playerSelectable = false;
}
const threePositions = control => {
  const positions = curves.n(control);
  return [...new Set([positions[0], positions.find(value => value === control.range.defaultValue), positions.at(-1)])]
    .filter(Number.isFinite);
};
const result = compare({pack, shop, prices,
  request: {mode: 'bd', budget: 2000, time_limit_seconds: 0, pattern_reduction_percent: 5}},
{...modules, curves: {...curves, n: threePositions}});
assert.equal(result.results[0].proof, 'Proven optimal');
assert(result.results[0].components.pattern < result.pattern_constraint.maximum);
for (const id of ['18010000038', '18070000005']) {
  const warfare = read(`weapons/${id}.json`);
  for (const [part, display] of Object.entries(warfare.display.objects)) {
    if (!parts.has(part)) display.playerSelectable = false;
  }
  compare({pack: warfare, shop, prices, request: {mode: 'mp', time_limit_seconds: 0}},
    {...modules, curves: {...curves, n: threePositions}});
}
assert(reports.some(row => row.cuts.pattern_cuts > 0));
assert(reports.some(row => row.cuts.loss_cuts > 0));
assert(reports.some(row => row.cuts.handling_controls > 0));
assert(reports.some(row => row.mountCuts > 0));

// This production CI-19 barrel/stock pair exceeds the original kick-tree limit.
{
  const ci19 = read('weapons/18010000038.json');
  const mode = 'bd';
  const request = {mode};
  const resolve = config => curves.o(ci19, config, mode);
  const build = resolve([{slotPath: '2', itemId: '13020000514'}, {slotPath: '3', itemId: '13040000179'}]);
  const scorer = presets.recoil.create({pack: ci19, mode, request, resolve, ...modules});
  const controls = createOrdinaryControls(ci19, request, curves)(build, false);
  const bound = prepareOrdinaryBound({pack: ci19, build, mode, controls, modules, scorer, tableCache: new Map()});
  assert(bound?.kick);
  const [barrel, stock] = controls.filter(({index}) => bound.kick.indices.has(index));
  assert.equal(barrel.positions.length * stock.positions.length, 10201);
  const kickScales = ci19.handling.weaponBehaviorProfiles?.[ci19.weapon.references.weaponBehaviorProfileId]?.kickScales;
  const prefixMinima = barrel.positions.map(barrelValue => {
    let minimum = Infinity;
    for (const stockValue of stock.positions) {
      const tunes = {[barrel.path]: {[barrel.id]: barrelValue}, [stock.path]: {[stock.id]: stockValue}};
      const state = kernel.u(ci19, build, {mode, tacticalEffective: true, tunes});
      const random = state.value('GGunkickRandom', kickScales?.randomKickScale ?? 1);
      const spring = state.value('GGunkickSpring', kickScales?.springKickScale ?? 1);
      minimum = Math.min(minimum, Math.hypot(random, spring));
    }
    return minimum;
  });
  assert.deepEqual(bound.kick.root.children.map(({minimum}) => minimum), prefixMinima);
  assert.equal(bound.kick.root.minimum, Math.min(...prefixMinima));
  reports.push({id: ci19.weaponId, mode, kickTuples: 10201, kickPrefixes: prefixMinima.length});
}
console.log(JSON.stringify(reports, null, 2));
