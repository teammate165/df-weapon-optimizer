import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchCategories} from './category-search.mjs';
import {presets} from '../../tools/optimizer_presets.mjs';
import * as curves from '../../.scratch/calibration-check/curves.mjs';
import * as kernel from '../../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../../.scratch/calibration-check/attributes.mjs';

const read = name => JSON.parse(readFileSync('.scratch/github-pages-site/data/' + name, 'utf8'));
const pack = read('weapons/18010000001.json');
const {shop} = read('catalog.json');
const mode = 'bd';
const budget = 200;
const resolve = config => curves.o(pack, config, mode);
const preset = presets.recoil.create({pack, request: {mode}, mode, resolve, kernel, curves, calculate});
assert.equal(preset.baseline.pattern_model, 'ads-chart-speed-tier-v2');
assert(preset.screeningBound);
const score = (build, tunes, state) => preset.score(preset.raw(build, tunes, state));
const baseline = score(resolve([]), {});
const candidates = [];
const slot = resolve([]).slots.find(row => row.slotPath === '1');
const rootItems = slot.options.filter(itemId =>
  shop.partCosts[itemId] > 0 && shop.partCosts[itemId] <= budget && !shop.hiddenItemIds.includes(itemId));
for (const itemId of rootItems) {
  const build = resolve([{slotPath: slot.slotPath, itemId}]);
  const mounted = build.mounted.find(part => part.slotPath === slot.slotPath && part.itemId === itemId);
  if (!mounted) continue;
  const controlId = (pack.parts[itemId]?.tuneIds ?? []).find(id => {
    const control = curves.c(pack, mounted, id);
    return control?.enabled !== false && control?.functions.some(f => f.target.startsWith('GRecoil_'));
  });
  if (!controlId) continue;
  const cost = build.mounted.filter(part => part.source === 'equipped')
    .reduce((sum, part) => sum + (shop.partCosts[part.itemId] ?? Infinity), 0);
  if (cost > budget) continue;
  candidates.push({build, cost, controls: curves.n(curves.c(pack, mounted, controlId))
    .map(value => ({[mounted.slotPath]: {[controlId]: value}}))});
  if (candidates.length === 4) break;
}
assert(candidates.length >= 2, 'Expected at least two chart layouts with tuning');

const stock = {cost: 0, gain: 0, config: [], tunes: {}};
const measurements = [];
const oracle = [stock];
for (const {build, cost, controls} of candidates) {
  for (const tunes of controls) oracle.push({cost, gain: baseline - score(build, tunes), config: build.config, tunes});
}
const descendingGain = (a, b) => b.gain - a.gain;
const max = [...oracle].sort((a, b) => descendingGain(a, b) || a.cost - b.cost)[0];
const eligible = oracle.filter(row => row.gain > 0);
const min = eligible.filter(row => row.gain >= max.gain / 2)
  .sort((a, b) => a.cost - b.cost || descendingGain(a, b))[0];
const balanced = eligible.sort((a, b) => b.gain / b.cost - a.gain / a.cost || descendingGain(a, b))[0];
assert(min && balanced);
const oracleByTuple = new Map(oracle.map(row => [JSON.stringify([row.config, row.tunes]), row]));

function trial(useBound) {
  let fullScores = 0, boundCalls = 0, unsupported = 0;
  const start = performance.now();
  preset.screeningBound.begin();
  const result = searchCategories({root: true, upperGain: baseline, lowerCost: 0}, {
    budget,
    expand(node) {
      if (node.root) return [{upperGain: 0, lowerCost: 0, row: stock},
        ...candidates.map(layout => ({layout, upperGain: baseline, lowerCost: layout.cost}))];
      const {layout, tuple} = node;
      if (!tuple) return layout.controls.map(tunes => {
        let state;
        let upperGain = baseline;
        if (useBound) {
          state = kernel.u(pack, layout.build, {mode, tacticalEffective: true, tunes});
          const lower = preset.screeningBound.lower(layout.build, state);
          boundCalls++;
          if (lower === null) unsupported++;
          else upperGain = baseline - lower;
          assert(upperGain >= oracleByTuple.get(JSON.stringify([layout.build.config, tunes])).gain);
        }
        return {layout, tuple: {tunes, state}, lowerCost: layout.cost, upperGain};
      });
      const {tunes, state} = tuple;
      fullScores++;
      const gain = baseline - score(layout.build, tunes, state);
      return [{lowerCost: layout.cost, upperGain: gain,
        row: {cost: layout.cost, gain, config: layout.build.config, tunes}}];
    },
  });
  const elapsedMs = performance.now() - start;
  assert.equal(result.pending, 0);
  assert.deepEqual(result.proven, {maximum: true, minimum: true, balanced: true});
  for (const [actual, expected] of [[result.maximum, max], [result.minimum, min], [result.balanced, balanced]]) {
    assert.equal(actual.gain, expected.gain);
    assert.equal(actual.cost, expected.cost);
  }
  return {useBound, fullScores, boundCalls, unsupported, elapsedMs,
    visited: result.visited, cache: preset.screeningBound.getStats()};
}
for (let repeat = -1; repeat < 7; repeat++) {
  for (const useBound of repeat % 2 ? [true, false] : [false, true]) {
    const result = trial(useBound);
    if (repeat >= 0) measurements.push(result);
  }
}
console.log(JSON.stringify({budget, layouts: candidates.map(({build, cost, controls}) =>
  ({config: build.config, cost, positions: controls.length})), tuples: oracle.length,
  maximum: max, minimum: min, balanced, measurements}, null, 2));
