import {assert} from './chart-fixture-runtime.mjs';
import {searchCategories} from './category-search.mjs';
import {timedRecoil} from '../../tools/timed_recoil.mjs';
import {pack, shop, mode, resolve, modules, preset, baseline, stock, axes, request,
  split, createAxisContext} from './m4-chart-axis-boxes.mjs';

const budget = 800;
const base = [{slotPath: '1', itemId: '13030000109'}, {slotPath: '3', itemId: '13040000104'}];
const barrel = {slotPath: '2', itemId: '13020000173'};
const magazine = {slotPath: '2/6', itemId: '13130000169'};

const narrow = [base, [...base, barrel], [...base, magazine]];
function wideConfigs() {
  const stocks = ['13040000104', '13040000105', '13040000106', '13040000108',
    '13040000109', '13040000110', '13040000112', '13040000179'];
  const addOns = [[], [barrel], [magazine], [barrel, magazine]];
  return stocks.flatMap(itemId => addOns.map(extra =>
    [base[0], {slotPath: '3', itemId}, ...extra]));
}
export function benchmarkContexts({wide = false, wideFull = false, reference = null} = {}) {
  const setupStart = performance.now();
  wide ||= wideFull;
  const choosePositions = positions => wide && !wideFull ? positions.filter((_, i) => i % 5 === 0) : positions;
  const contexts = (wide ? wideConfigs() : narrow).flatMap(config => {
    const build = resolve(config);
    const legal = build.config.length === config.length && config.every(part =>
      build.config.some(row => row.slotPath === part.slotPath && row.itemId === part.itemId));
    if (!legal) {
      assert(wide);
      return [];
    }
    const cost = build.mounted.filter(part => part.source === 'equipped')
      .reduce((sum, part) => sum + shop.partCosts[part.itemId], 0);
    assert(cost > 0 && cost <= budget);
    return [{...createAxisContext(build, ['1', '3'], choosePositions),
      cost, oracle: [], tiers: new Set()}];
  });
  if (wide) assert(contexts.length >= 24);
  assert.equal(new Set(contexts.map(c => c.fixed.references.adsRecoilProfileId)).size, 2);
  assert(new Set(contexts.map(c => JSON.stringify(c.unit.map(p => p.time_ms)))).size >= 2);
  const [first] = contexts;
  assert.equal(new Set(contexts.map(c => JSON.stringify(c.build.config))).size, contexts.length);
  if (wide) {
    const last = wideFull ? 100 : 20;
    assert.deepEqual(first.full, [[0, last], [0, last]]);
  }
  assert(contexts.every(c => JSON.stringify(c.full) === JSON.stringify(first.full)));

  const setupMs = performance.now() - setupStart;
  let expected = reference;
  if (!expected) {
    const rows = [stock];
    const start = performance.now();
    for (const context of contexts) {
      const {build, cost, full, fixed, fixedRaw, unit, tunesAt, axisRange} = context;
      const times = unit.map(point => point.time_ms);
      for (let i = 0; i <= full[0][1]; i++) {
        const gains = [];
        for (let j = 0; j <= full[1][1]; j++) {
          const tunes = tunesAt([i, j]);
          const state = modules.kernel.u(pack, build, {mode, tacticalEffective: true, tunes});
          const raw = preset.raw(build, tunes, state);
          const path = timedRecoil(pack, build, tunes, request, modules, {abstractProfile: true});
          assert.equal(state.references.adsRecoilProfileId, fixed.references.adsRecoilProfileId);
          assert.deepEqual(path.points.map(p => p.time_ms), times);
          assert.equal(raw.camera, fixedRaw.camera);
          assert.equal(raw.kick, fixedRaw.kick);
          axes.forEach((target, axis) => {
            const [lo, hi] = axisRange([[i, i], [j, j]], axis);
            const value = state.value(target, 1);
            assert(value >= lo && value <= hi);
          });
          const gain = baseline - preset.score(raw);
          gains.push(gain);
          rows.push({gain, cost});
          context.tiers.add(raw.horizontal_multiplier);
        }
        context.oracle.push(gains);
      }
    }
    const oracleMs = performance.now() - start;
    const maximum = [...rows].sort((a, b) => b.gain - a.gain || a.cost - b.cost)[0];
    const minimum = rows.filter(row => row.gain >= maximum.gain / 2)
      .sort((a, b) => a.cost - b.cost || b.gain - a.gain)[0];
    const balanced = rows.filter(row => row.gain > 0)
      .sort((a, b) => b.gain / b.cost - a.gain / a.cost || b.gain - a.gain)[0];
    assert(minimum && balanced);

    let audited = 0;
    function audit(box) {
      const children = split(box).map(audit);
      const best = contexts.map((c, i) => children.length ?
        Math.max(...children.map(values => values[i])) : c.oracle[box[0][0]][box[1][0]]);
      const optimistic = contexts.map(c => c.upperGain(box));
      optimistic.forEach((bound, i) => assert(bound >= best[i]));
      assert(Math.max(...optimistic) >= Math.max(...best));
      audited++;
      return best;
    }
    assert.equal(Math.max(...audit(first.full)), maximum.gain);

    expected = {oracleTuples: rows.length - 1, oracleMs, audited, maximum, minimum, balanced};
  }
  const {maximum, minimum, balanced} = expected;
  function trial(strategy, nodeLimit = Infinity) {
    const start = performance.now();
    let chartBounds = 0, exactScores = 0;
    function bounded(box, active) {
      chartBounds += active.length;
      const alternatives = active.map(c => ({upperGain: c.upperGain(box), lowerCost: c.cost}));
      return {box, active, upperGain: Math.max(...alternatives.map(pair => pair.upperGain)),
        lowerCost: Math.min(...alternatives.map(pair => pair.lowerCost)),
        alternatives: strategy === 'paired' ? alternatives : undefined};
    }
    const result = searchCategories({root: true, upperGain: baseline, lowerCost: 0}, {
      budget, nodeLimit,
      expand(node) {
        if (node.root) return [
          {row: stock, upperGain: 0, lowerCost: 0},
          ...(strategy !== 'split' ? [bounded(first.full, contexts)] :
            contexts.map(c => bounded(c.full, [c]))).sort((a, b) => a.upperGain - b.upperGain),
        ];
        const {box, active} = node;
        const children = split(box);
        if (children.length) return children.map(child => bounded(child, active))
          .sort((a, b) => a.upperGain - b.upperGain);
        if (active.length > 1) return active.map(c => bounded(box, [c]))
          .sort((a, b) => a.upperGain - b.upperGain);
        const [context] = active;
        const tunes = context.tunesAt(box.map(range => range[0]));
        const gain = baseline - preset.score(preset.raw(context.build, tunes));
        exactScores++;
        const row = {gain, cost: context.cost, config: context.build.config, tunes};
        return [{row, upperGain: gain, lowerCost: row.cost}];
      },
    });
    const expectedRatio = balanced.gain / balanced.cost;
    assert(result.bounds.upperGain >= maximum.gain);
    assert(result.bounds.lowerCost <= minimum.cost);
    assert(result.bounds.upperEfficiency >= expectedRatio);
    if (result.minimum) assert(result.minimum.gain >= maximum.gain / 2);
    if (nodeLimit === Infinity) assert.equal(result.pending, 0);
    for (const [key, target] of Object.entries({maximum, minimum, balanced})) {
      if (nodeLimit === Infinity || result.proven[key]) {
        assert(result.proven[key]);
        assert.equal(result[key].gain, target.gain);
        assert.equal(result[key].cost, target.cost);
      }
    }
    return {strategy, chartBounds, exactScores, nodes: result.visited, elapsedMs: performance.now() - start};
  }
  const samples = [];
  const strategies = wideFull ? ['split'] : ['split', 'union', 'paired'];
  for (const strategy of strategies) {
    for (const limit of [0, 1, 10, 25, 100]) trial(strategy, limit);
  }
  for (let repeat = -1; repeat < 7; repeat++) {
    for (const strategy of repeat % 2 ? [...strategies].reverse() : strategies) {
      const sample = trial(strategy);
      if (repeat >= 0) samples.push(sample);
    }
  }
  return {wide, wideFull, budget, setupMs, positionsPerAxis: first.full.map(([, high]) => high + 1),
    ...expected, samples, contexts: contexts.map(c => ({
      config: c.build.config, cost: c.cost, profile: c.fixed.references.adsRecoilProfileId,
      finalTimeMs: c.unit.at(-1).time_ms, tiers: [...c.tiers],
    }))};
}
if (import.meta.main) {
  console.log(JSON.stringify(benchmarkContexts({
    wideFull: process.argv.includes('--wide-full'),
    wide: process.argv.includes('--wide'),
  }), null, 2));
}
