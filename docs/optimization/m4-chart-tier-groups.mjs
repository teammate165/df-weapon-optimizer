import assert from 'node:assert/strict';
import {searchCategories} from './category-search.mjs';
import {readFileSync} from 'node:fs';
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
const baseline = preset.score(preset.baseline);
const stock = {cost: 0, gain: 0, config: [], tunes: {}};
const kick = new Set(['GGunkickRandom', 'GGunkickSpring']);
const chart = new Set(['GRecoil_V', 'GRecoil_H']);
const layoutIds = [
  ['13020000350', '13030000109'],
  ['13020000351', '13030000113'],
];
const layouts = layoutIds.map(([barrelId, muzzleId]) => {
  const build = resolve([{slotPath: '2', itemId: barrelId}, {slotPath: '1', itemId: muzzleId}]);
  const cost = build.mounted.filter(part => part.source === 'equipped')
    .reduce((sum, part) => sum + shop.partCosts[part.itemId], 0);
  assert(cost > 0 && cost <= budget);
  function weight(itemId, path) {
    const mounted = build.mounted.find(part => part.slotPath === path && part.itemId === itemId);
    assert(mounted);
    const id = pack.parts[itemId].tuneIds.find(value => value.includes(':weight:'));
    const control = curves.c(pack, mounted, id);
    assert(control && control.enabled !== false);
    return {id, effects: control.functions, positions: curves.n(control),
      defaultValue: control.range.defaultValue};
  }
  const barrel = weight(barrelId, '2');
  const muzzle = weight(muzzleId, '1');
  const kickEffects = barrel.effects.filter(effect => kick.has(effect.target));
  assert.equal(new Set(kickEffects.map(effect => effect.target)).size, 2);
  assert(barrel.effects.every(effect => kick.has(effect.target) ? effect.modifier === 'Mult_A' :
    effect.target === 'GMovement_ADSSpeed' && effect.modifier === 'Addend'));
  assert(muzzle.effects.some(effect => chart.has(effect.target)));
  assert(muzzle.effects.every(effect =>
    (chart.has(effect.target) || effect.target === 'GBreathScale') && effect.modifier === 'Mult_A'));
  const state = kernel.u(pack, build, {mode, tacticalEffective: true, tunes: {}});
  const vectors = barrel.positions.map(value => kickEffects.map(effect =>
    curves.r(pack.curves[effect.curveId], value)));
  const minima = kickEffects.map((_, i) => Math.min(...vectors.map(vector => vector[i])));
  const optimum = vectors.findIndex(vector => vector.every((value, i) => value === minima[i]));
  assert(optimum >= 0);
  const groups = Map.groupBy(kickEffects.entries(), ([, effect]) => effect.target);
  for (const [target, operations] of groups) {
    const bucket = state.numeric.buckets.get(target) ?? {};
    const slope = ((bucket.initial ?? state.baseTargets[target] ?? 1) +
      (bucket.addend ?? 0)) * (bucket.multC ?? 1);
    assert(Number.isFinite(slope) && slope > 0);
    assert(1 + (bucket.multA ?? 0) + operations.reduce((sum, [i]) =>
      sum + Math.min(0, minima[i]), 0) > 0.01);
    for (const [, effect] of operations) {
      assert.equal(curves.r(pack.curves[effect.curveId], barrel.defaultValue), 0);
    }
  }
  return {build, cost, barrel, muzzle, bestBarrel: barrel.positions[optimum],
    oracle: new Map(), tiers: new Set()};
});
const tunesFor = (layout, muzzle, barrel) =>
  ({'1': {[layout.muzzle.id]: muzzle}, '2': {[layout.barrel.id]: barrel}});
const start = performance.now();
let oracleCalls = 0;
const rows = [stock];
for (const layout of layouts) {
  let affectedBarrel = false;
  for (const muzzle of layout.muzzle.positions) {
    let gain = -Infinity;
    let smallest = Infinity;
    let tier;
    let representativeGain;
    for (const barrel of layout.barrel.positions) {
      const raw = preset.raw(layout.build, tunesFor(layout, muzzle, barrel));
      tier ??= raw.horizontal_multiplier;
      assert.equal(raw.horizontal_multiplier, tier, 'Barrel affects chart tier');
      const candidate = baseline - preset.score(raw);
      oracleCalls++;
      if (barrel === layout.bestBarrel) representativeGain = candidate;
      gain = Math.max(gain, candidate);
      smallest = Math.min(smallest, candidate);
    }
    assert.equal(representativeGain, gain);
    affectedBarrel ||= smallest < gain;
    layout.oracle.set(muzzle, gain);
    layout.tiers.add(tier);
    rows.push({cost: layout.cost, gain});
  }
  assert(affectedBarrel && layout.tiers.size > 1);
}
const oracleMs = performance.now() - start;
const max = [...rows].sort((a, b) => b.gain - a.gain || a.cost - b.cost)[0];
const min = rows.filter(row => row.gain >= max.gain / 2)
  .sort((a, b) => a.cost - b.cost || b.gain - a.gain)[0];
const balanced = rows.filter(row => row.gain > 0)
  .sort((a, b) => b.gain / b.cost - a.gain / a.cost || b.gain - a.gain)[0];

function run() {
  preset.screeningBound.begin();
  const start = performance.now();
  let states = 0, scores = 0;
  const result = searchCategories({root: true, upperGain: baseline, lowerCost: 0}, {
    budget,
    expand(node) {
      if (node.root) return [{row: stock, upperGain: 0, lowerCost: 0},
        ...layouts.map(layout => ({layout, upperGain: baseline, lowerCost: layout.cost}))];
      const {layout} = node;
      if (!node.tunes) return layout.muzzle.positions.map(value => {
        const tunes = tunesFor(layout, value, layout.bestBarrel);
        const state = kernel.u(pack, layout.build, {mode, tacticalEffective: true, tunes});
        states++;
        const bound = preset.screeningBound.lower(layout.build, state);
        assert(bound !== null);
        const upperGain = baseline - bound;
        assert(upperGain >= layout.oracle.get(value));
        return {layout, tunes, state, value, lowerCost: layout.cost, upperGain};
      });
      scores++;
      const gain = baseline - preset.score(preset.raw(layout.build, node.tunes, node.state));
      assert.equal(gain, layout.oracle.get(node.value), 'Barrel representative missed its group optimum');
      return [{row: {gain, cost: layout.cost, config: layout.build.config, tunes: node.tunes},
        lowerCost: layout.cost, upperGain: gain}];
    },
  });
  assert.equal(result.pending, 0);
  assert.deepEqual(result.proven, {maximum: true, minimum: true, balanced: true});
  for (const [actual, expected] of [[result.maximum, max], [result.minimum, min], [result.balanced, balanced]]) {
    assert.equal(actual.cost, expected.cost);
    assert.equal(actual.gain, expected.gain);
  }
  return {states, scores, nodes: result.visited, elapsedMs: performance.now() - start};
}
run();
const samples = Array.from({length: 7}, run);
console.log(JSON.stringify({budget, oracleCalls, oracleMs, max, min, balanced, samples,
  layouts: layouts.map(layout => ({config: layout.build.config, cost: layout.cost,
    bestBarrel: layout.bestBarrel, tiers: [...layout.tiers]}))}, null, 2));
