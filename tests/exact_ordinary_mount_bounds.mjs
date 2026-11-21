import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {compileMounts} from '../tools/scip_mount_model.mjs';
import {createChoiceGroups} from '../tools/choice_groups.mjs';
import {createExactOrdinaryMountBound} from '../tools/exact_ordinary_mount_bounds.mjs';
import {createMountSearch} from '../tools/mount_search.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import * as nativeCurves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';

const data = process.argv[2];
if (!data) throw Error('Pass a local Pages export data directory');
const read = filename => JSON.parse(readFileSync(join(data, filename), 'utf8'));
const {shop, prices} = read('catalog.json');
const curves = {...nativeCurves, n(control) {
  const positions = nativeCurves.n(control);
  return [...new Set([positions[0], control.range.defaultValue, positions.at(-1)])]
    .filter(value => positions.includes(value));
}};
const modules = {curves, kernel, calculate};

function runFixture(weaponId, allowed, mode) {
  const pack = read(`weapons/${weaponId}.json`);
  for (const [id, row] of Object.entries(pack.display.objects)) {
    if (!allowed.includes(id)) row.playerSelectable = false;
  }
  const resolve = config => curves.o(pack, config, mode);
  const request = {mode, budget: mode === 'sol' ? 5e6 : shop.weapons[weaponId].gunsmithLimit};
  const scorer = presets.recoil.create({pack, mode, request, resolve, ...modules});
  const compiled = compileMounts({pack, shop, prices, request}, kernel);
  const groups = createChoiceGroups({pack, mode, shop, prices, ...modules, preset: scorer});
  groups.constrain(compiled, {preserveIdentities: true});
  const restrictions = new Map([...compiled.players.values()]
    .filter(player => typeof player.value === 'string' && groups.isTactical(player.path, player.item))
    .map(player => [player.value, 0]));
  const search = createMountSearch(compiled, {priorityPaths: ['2', '3', '1', '4/8', '2/6', '2/47', '11']});
  const report = [];
  function scan(maximum, prune, priceBudget, maximumLoss) {
    const hits = [];
    let layouts = 0, tuples = 0;
    for (const config of search.enumerate(restrictions, undefined, {prune, priceBudget})) {
      const build = resolve(config);
      const quotes = mode === 'bd' ? shop.partCosts : prices;
      const cost = mode === 'mp' ? null : build.mounted.filter(row => row.source === 'equipped')
        .reduce((sum, row) => sum + quotes[row.itemId], 0);
      const controls = build.mounted.flatMap(mounted => (pack.parts[mounted.itemId]?.tuneIds ?? [])
        .map(id => ({id, path: mounted.slotPath, control: curves.c(pack, mounted, id)})))
        .filter(row => row.control && row.control.enabled !== false);
      const tunes = {};
      function visit(index) {
        if (index === controls.length) {
          tuples++;
          const raw = scorer.raw(build, tunes);
          const {pattern} = raw;
          const loss = scorer.score(raw);
          if (pattern <= maximum && (!maximumLoss || loss <= maximumLoss(cost))) {
            hits.push({pattern, loss, cost, key: JSON.stringify([config, tunes])});
          }
          return;
        }
        const {id, path, control} = controls[index];
        for (const position of curves.n(control)) {
          (tunes[path] ??= {})[id] = position;
          visit(index + 1);
        }
      }
      visit(0);
      layouts++;
    }
    return {layouts, tuples, hits};
  }
  const direct = scan(Infinity);
  for (const fraction of [0.2, 0.45, 0.55, 0.75, 0.95]) {
    const maximum = scorer.baseline.pattern * fraction;
    const bound = createExactOrdinaryMountBound({pack, request, compiled, modules, scorer,
      patternConstraint: {maximum}});
    assert(bound, 'The fixture must have native chart support');
    const expected = direct.hits.filter(row => row.pattern <= maximum).map(row => row.key);
    const pruned = scan(maximum, bound.prune);
    assert.deepEqual(pruned.hits.map(row => row.key), expected);
    report.push({weaponId, mode, fraction, nativeTuples: direct.tuples, visitedTuples: pruned.tuples,
      hits: expected.length, ...bound.getStats()});
  }
  if (mode !== 'mp') {
    const best = new Map();
    for (const {cost, loss} of direct.hits) best.set(cost, Math.min(loss, best.get(cost) ?? Infinity));
    const getPriceLoss = cost => best.get(cost) ?? Infinity;
    const bound = createExactOrdinaryMountBound({pack, request, compiled, modules, scorer, getPriceLoss});
    const pruned = scan(Infinity, bound.prune, bound.priceBudget, getPriceLoss);
    assert.deepEqual(pruned.hits, direct.hits.filter(({cost, loss}) => loss === best.get(cost)));
    report.push({weaponId, mode, priceWitnesses: best.size, ...bound.getStats()});
  }
  const losses = direct.hits.map(row => row.loss).sort((a, b) => a - b);
  for (const position of [0, Math.floor(losses.length / 2)]) {
    const cutoff = losses[position];
    const bound = createExactOrdinaryMountBound({pack, request, compiled, modules, scorer,
      phaseCut: lower => lower > cutoff});
    const pruned = scan(Infinity, bound.prune, undefined, () => cutoff);
    assert.deepEqual(pruned.hits, direct.hits.filter(({loss}) => loss <= cutoff));
    report.push({weaponId, mode, cutoff, ...bound.getStats()});
  }
  const cutoff = losses[Math.floor(losses.length / 2)];
  const maximum = scorer.baseline.pattern * 0.75;
  const joint = createExactOrdinaryMountBound({pack, request, compiled, modules, scorer,
    patternConstraint: {maximum}, phaseCut: lower => lower > cutoff, finiteKick: true});
  const jointPruned = scan(maximum, joint.prune, undefined, () => cutoff);
  const expected = direct.hits.filter(row => row.pattern <= maximum && row.loss <= cutoff);
  assert.deepEqual(jointPruned.hits, expected);
  report.push({weaponId, mode, combined: true, hits: expected.length, ...joint.getStats()});
  return report;
}

const results = [
  ...runFixture('18010000038', ['13030000189', '13040000110', '13140000042', '13110000099'], 'bd'),
  ...runFixture('18010000038', ['13030000189', '13040000110', '13140000042'], 'sol'),
  ...runFixture('18010000001', ['13030000109', '13020000173', '13130000169'], 'bd'),
  ...runFixture('18010000001', ['13020000349', '13040000114', '13290000001'], 'bd'),
  ...runFixture('18010000038', ['13020000514', '13130000169', '13390000002', '13390000003',
    '13110000099'], 'bd'),
  ...runFixture('18010000038', ['13030000189', '13040000110', '13140000042'], 'mp'),
];
assert(results.some(row => row.cuts > 0));
console.log(JSON.stringify(results, null, 2));
assert(results.some(row => row.cuts > 0 && row.hits > 0));
assert(results.some(row => row.price_cuts > 0));
assert(results.some(row => row.phase_cuts > 0 && row.price_bound?.discrete_norms > 0));
assert(results.some(row => row.combined && row.price_bound?.finite_kick_bounds > 0));
assert(results.some(row => row.combined && row.price_bound?.optional_kick_bounds > 0));
assert(results.some(row => row.combined && row.price_bound?.two_optional_kick_bounds > 0));

// The expensive first choice leaves 4,096 distinct suffix prices, beyond the table cap.
const priceChoices = [4096, ...Array.from({length: 12}, (_, i) => 2 ** i)].map((cost, i) => ({
  path: String(i).padStart(2, '0'), item: String(cost), value: `choice${i}`, cost,
}));
const priceSearch = createMountSearch({
  model: {variables: new Map(priceChoices.map(({value}) => [value, {type: 'binary'}])),
    booleanNodes: new Map(), constraints: []},
  players: new Map(priceChoices.map(choice => [choice.value, choice])),
});
const maxPrice = 7;
let uncappedDepthSeen = false;
const expectedLayouts = [...priceSearch.enumerate(new Map(), undefined, {
  priceBudget: 8191,
  prune(branch) {
    if (branch.selectedCost === 4096 && branch.suffixCosts === undefined) uncappedDepthSeen = true;
    return false;
  },
})].filter(layout => layout.reduce((cost, {itemId}) => cost + Number(itemId), 0) <= maxPrice);
const priceStats = {};
const cheapLayouts = [...priceSearch.enumerate(new Map(), undefined, {
  priceBudget: 8191, priceCeiling: () => maxPrice, stats: priceStats,
})];
assert(uncappedDepthSeen);
assert(priceStats.price_ceiling_cuts > 0);
assert.deepEqual(cheapLayouts, expectedLayouts);
