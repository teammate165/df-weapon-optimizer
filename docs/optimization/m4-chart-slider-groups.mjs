import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchCategories} from './category-search.mjs';
import {presets} from '../../tools/optimizer_presets.mjs';
import * as curves from '../../.scratch/calibration-check/curves.mjs';
import * as kernel from '../../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../../.scratch/calibration-check/attributes.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const pack = read('../../.scratch/github-pages-site/data/weapons/18010000001.json');
const {shop} = read('../../.scratch/github-pages-site/data/catalog.json');
const fixture = read('./m4-chart-data.json');
const mode = 'bd';
const resolve = config => curves.o(pack, config, mode);
const preset = presets.recoil.create({pack, request: {mode}, mode, resolve, kernel, curves, calculate});
assert.equal(preset.baseline.pattern_model, 'ads-chart-speed-tier-v2');
assert(preset.screeningBound);
const loss = (build, tunes, state) => preset.score(preset.raw(build, tunes, state));
const baseline = loss(resolve([]), {});
const stock = {cost: 0, gain: 0, config: [], tunes: {}};
const layouts = fixture.layouts.map(({config, cost}) => {
  const build = resolve(config);
  assert.deepEqual(build.config, config);
  assert.equal(build.mounted.filter(part => part.source === 'equipped')
    .reduce((sum, part) => sum + shop.partCosts[part.itemId], 0), cost);
  const mounted = build.mounted.find(part => part.slotPath === '1');
  const controls = pack.parts[mounted.itemId].tuneIds.map(id => ({
    id, definition: curves.c(pack, mounted, id),
  })).filter(({definition}) => definition?.enabled !== false);
  const irrelevant = new Set(['GAiming_ADSTime', 'AimMoveGunSway']);
  const projected = controls.filter(({definition}) => definition.functions.length > 0 &&
    definition.functions.every(f => irrelevant.has(f.target) && f.modifier === 'Mult_A'));
  assert.equal(controls.length, 2);
  assert.equal(projected.length, 1);
  const [omit] = projected;
  const keep = controls.find(control => control !== omit);
  const keepValues = curves.n(keep.definition);
  const omitValues = curves.n(omit.definition);
  assert(omitValues.includes(omit.definition.range.defaultValue));
  return {build, cost, keep, omit, keepValues, omitValues, exactByWeight: new Map()};
});

const checkStart = performance.now();
let oracleEvaluations = 0;
const oracle = [stock];
for (const layout of layouts) {
  const {build, cost, keep, omit, keepValues, omitValues, exactByWeight} = layout;
  for (const weight of keepValues) {
    for (const thickness of omitValues) {
      const tunes = {'1': {[keep.id]: weight, [omit.id]: thickness}};
      const gain = baseline - loss(build, tunes);
      oracleEvaluations++;
      if (thickness === omitValues[0]) {
        exactByWeight.set(weight, gain);
        oracle.push({cost, gain});
      } else {
        assert.equal(gain, exactByWeight.get(weight), 'A projected setting changed the score');
      }
    }
  }
}
const oracleMs = performance.now() - checkStart;
const max = [...oracle].sort((a, b) => b.gain - a.gain || a.cost - b.cost)[0];
const min = oracle.filter(row => row.gain >= max.gain / 2)
  .sort((a, b) => a.cost - b.cost || b.gain - a.gain)[0];
const balanced = oracle.filter(row => row.gain > 0)
  .sort((a, b) => b.gain / b.cost - a.gain / a.cost || b.gain - a.gain)[0];

function trial() {
  preset.screeningBound.begin();
  const start = performance.now();
  let states = 0, scores = 0;
  const result = searchCategories({root: true, upperGain: baseline, lowerCost: 0}, {
    budget: fixture.budget,
    expand(node) {
      if (node.root) return [{upperGain: 0, lowerCost: 0, row: stock},
        ...layouts.map(layout => ({layout, upperGain: baseline, lowerCost: layout.cost}))];
      const {layout} = node;
      if (!node.tunes) return layout.keepValues.map(weight => {
        const tunes = {'1': {[layout.keep.id]: weight,
          [layout.omit.id]: layout.omit.definition.range.defaultValue}};
        const state = kernel.u(pack, layout.build, {mode, tacticalEffective: true, tunes});
        states++;
        const lower = preset.screeningBound.lower(layout.build, state);
        assert(lower !== null);
        const upperGain = baseline - lower;
        assert(upperGain >= layout.exactByWeight.get(weight));
        return {layout, tunes, state, upperGain, lowerCost: layout.cost};
      });
      scores++;
      const gain = baseline - loss(layout.build, node.tunes, node.state);
      const row = {cost: layout.cost, gain, config: layout.build.config, tunes: node.tunes};
      return [{row, upperGain: gain, lowerCost: row.cost}];
    },
  });
  assert.equal(result.pending, 0);
  assert.deepEqual(result.proven, {maximum: true, minimum: true, balanced: true});
  for (const [actual, expected] of [[result.maximum, max], [result.minimum, min], [result.balanced, balanced]]) {
    assert.equal(actual.cost, expected.cost);
    assert.equal(actual.gain, expected.gain);
  }
  return {elapsedMs: performance.now() - start, states, scores, visited: result.visited};
}
trial();
const samples = Array.from({length: 7}, trial);
console.log(JSON.stringify({oracleEvaluations, oracleMs, max, min, balanced, samples}, null, 2));
