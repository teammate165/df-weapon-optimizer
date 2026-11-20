import {assert} from './chart-fixture-runtime.mjs';
import {compileMounts} from '../../tools/scip_mount_model.mjs';
import {createMountSearch} from '../../tools/mount_search.mjs';
import {timedRecoil} from '../../tools/timed_recoil.mjs';
import {searchCategories} from './category-search.mjs';
import {pack, shop, mode, resolve, modules, preset, baseline, stock, axes, request,
  split, createAxisContext} from './m4-chart-axis-boxes.mjs';

const budget = 400;
const domains = [
  ['1', ['13030000109', '13030000110', '13030000113', '13030000114']],
  ['3', ['13040000104', '13040000106', '13040000108', '13040000179']],
  ['4/8', ['13140000024', '13140000027', '13140000028']],
  ['2', [null, '13020000173']],
  ['2/6', [null, '13130000169']],
];
const tunedPaths = domains.slice(0, 3).map(([path]) => path);
const allowed = new Set(domains.flatMap(([path, ids]) => ids.filter(Boolean).map(id => path + '|' + id)));
const identity = config => JSON.stringify(config.map(part => [part.slotPath, part.itemId]).sort());
const price = build => build.mounted.filter(part => part.source === 'equipped')
  .reduce((sum, part) => sum + (shop.partCosts[part.itemId] ?? Infinity), 0);

export function benchmarkMountScaling({fullGrid = false, reference = null, expectedLayouts, orderedAxes = false} = {}) {
  const mountStart = performance.now();
  const compiled = compileMounts({pack, shop, request: {mode, budget}}, modules.kernel);
  const restrictions = new Map([...compiled.players].flatMap(([key, part]) =>
    typeof part.value === 'string' && !allowed.has(key) ? [[part.value, 0]] : []));
  const mountStats = {};
  let mountNodes = 0;
  const compiledRows = [...createMountSearch(compiled).enumerate(restrictions, () => mountNodes++, {stats: mountStats})]
    .filter(config => tunedPaths.every(path => config.some(part => part.slotPath === path)));
  const mountMs = performance.now() - mountStart;

  // Independent direct product, using only the native mount resolver and costs.
  const allRequests = domains.reduce((rows, [slotPath, items]) =>
    rows.flatMap(config => items.map(itemId => itemId ? [...config, {slotPath, itemId}] : config)), [[]]);
  const nativeRows = new Map();
  for (const config of allRequests) {
    const build = resolve(config);
    if (identity(build.config) !== identity(config) || price(build) > budget) continue;
    if (build.mounted.some(part => shop.hiddenItemIds.includes(part.itemId))) continue;
    nativeRows.set(identity(config), price(build));
  }
  assert.deepEqual(compiledRows.map(identity).sort(), [...nativeRows.keys()].sort());
  if (expectedLayouts !== undefined) assert.equal(compiledRows.length, expectedLayouts);
  assert(compiledRows.length > 24);

  const setupStart = performance.now();
  const layouts = compiledRows.map(config => {
    const build = resolve(config);
    const cost = price(build);
    assert.equal(cost, nativeRows.get(identity(config)));
    const context = createAxisContext(build, tunedPaths, positions => fullGrid ? positions :
      [0, 1, 2, 3, 4].map(i => positions[Math.round((positions.length - 1) * i / 4)]),
        null, null, orderedAxes);
    if (!fullGrid) assert.deepEqual(context.full, [[0, 4], [0, 4], [0, 4]]);
    return {context, cost};
  });
  const setupMs = performance.now() - setupStart;

  function points(box) {
    return box.reduce((rows, [lo, hi]) => rows.flatMap(row =>
      Array.from({length: hi - lo + 1}, (_, i) => [...row, lo + i])), [[]]);
  }
  const gridTuples = layouts.reduce((sum, {context}) =>
    sum + context.full.reduce((total, [, hi]) => total * (hi + 1), 1), 0);
  let oracle = null;
  if (!fullGrid && !reference) {
    const rows = [stock];
    const tiers = new Set();
    const profileIds = new Set();
    const schedules = new Set();
    let audited = 0;
    const oracleStart = performance.now();
    for (const {context, cost} of layouts) {
      const {build, full, tunesAt, fixed, fixedRaw, unit, axisRange, upperGain} = context;
      const profile = fixed.references.adsRecoilProfileId;
      const times = unit.map(point => point.time_ms);
      profileIds.add(profile);
      schedules.add(JSON.stringify(times));
      const gains = new Map();
      const axisSamples = full.map(() => axes.map(() => new Set()));
      for (const indices of points(full)) {
        const tunes = tunesAt(indices);
        const state = modules.kernel.u(pack, build, {mode, tacticalEffective: true, tunes});
        const raw = preset.raw(build, tunes, state);
        const chart = timedRecoil(pack, build, tunes, request, modules, {abstractProfile: true});
        assert.equal(state.references.adsRecoilProfileId, profile);
        assert.deepEqual(chart.points.map(point => point.time_ms), times);
        assert.equal(raw.camera, fixedRaw.camera);
        assert.equal(raw.kick, fixedRaw.kick);
        axes.forEach((target, axis) => {
          const [lo, hi] = axisRange(indices.map(index => [index, index]), axis);
          const value = state.value(target, 1);
          assert(value >= lo && value <= hi);
          if (orderedAxes) {
            assert.equal(lo, value);
            assert.equal(hi, value);
          }
          for (const [control, samples] of axisSamples.entries()) {
            if (indices.every((index, i) => i === control || index === 0)) samples[axis].add(value);
          }
        });
        const gain = baseline - preset.score(raw);
        rows.push({gain, cost});
        gains.set(indices.join(','), gain);
        tiers.add(raw.horizontal_multiplier);
      }
      assert(axisSamples.every(samples => samples.every(values => values.size > 1)));
      function audit(box) {
        const children = split(box);
        const best = children.length ? Math.max(...children.map(audit)) :
          gains.get(box.map(range => range[0]).join(','));
        assert(upperGain(box) >= best);
        audited++;
        return best;
      }
      audit(full);
    }
    const oracleMs = performance.now() - oracleStart;
    const maximum = [...rows].sort((a, b) => b.gain - a.gain || a.cost - b.cost)[0];
    const minimum = rows.filter(row => row.gain > 0 && row.gain >= maximum.gain / 2)
      .sort((a, b) => a.cost - b.cost || b.gain - a.gain)[0];
    const balanced = rows.filter(row => row.gain > 0)
      .sort((a, b) => b.gain / b.cost - a.gain / a.cost || b.gain - a.gain)[0];
    assert(minimum && balanced && tiers.size > 1);
    oracle = {maximum, minimum, balanced, audited, oracleMs,
      profiles: profileIds.size, schedules: schedules.size, tiers: [...tiers].sort((a, b) => a - b)};
  }
  const expected = reference ?? oracle;
  function trial(nodeLimit = Infinity) {
    const start = performance.now();
    let bounds = 0, nativeScores = 0;
    function bound(layout, box) {
      bounds++;
      return {layout, box, upperGain: layout.context.upperGain(box), lowerCost: layout.cost};
    }
    function byGain(a, b) { return a.upperGain - b.upperGain; }
    const result = searchCategories({root: true, upperGain: baseline, lowerCost: 0}, {
      budget, nodeLimit,
      expand(node) {
        if (node.root) return [{row: stock, upperGain: 0, lowerCost: 0}, ...layouts.map(layout =>
          bound(layout, layout.context.full)).sort(byGain)];
        const {layout, box} = node;
        const children = split(box);
        if (children.length) return children.map(child => bound(layout, child)).sort(byGain);
        const {cost, context} = layout;
        const tunes = context.tunesAt(box.map(range => range[0]));
        const gain = baseline - preset.score(preset.raw(context.build, tunes));
        nativeScores++;
        return [{row: {gain, cost, tunes, config: context.build.config}, upperGain: gain, lowerCost: cost}];
      },
    });
    if (expected) {
      const {maximum, minimum, balanced} = expected;
      assert(result.bounds.upperGain >= maximum.gain);
      assert(result.bounds.lowerCost <= minimum.cost);
      assert(result.bounds.upperEfficiency >= balanced.gain / balanced.cost);
      if (result.minimum) assert(result.minimum.gain >= maximum.gain / 2);
      for (const [key, target] of Object.entries({maximum, minimum, balanced})) {
        if (nodeLimit === Infinity || result.proven[key]) {
          assert(result.proven[key]);
          assert.equal(result[key].gain, target.gain);
          assert.equal(result[key].cost, target.cost);
        }
      }
    }
    if (nodeLimit === Infinity) {
      assert.equal(result.pending, 0);
      assert.deepEqual(result.proven, {maximum: true, minimum: true, balanced: true});
      assert(result.minimum.gain >= result.maximum.gain / 2);
    }
    return {bounds, nativeScores, nodes: result.visited, elapsedMs: performance.now() - start,
      maximum: result.maximum, minimum: result.minimum, balanced: result.balanced};
  }
  if (expected) for (const limit of [0, 1, 10, 50, 100]) trial(limit);
  trial();
  const samples = Array.from({length: 7}, () => trial());
  return {fullGrid, orderedAxes, budget, domains, mountRequests: allRequests.length, legalLayouts: layouts.length,
    mountNodes, mountStats, mountMs, setupMs, tunedTuples: gridTuples,
    ...(oracle ?? {}), samples};
}
if (import.meta.main) {
  console.log(JSON.stringify(benchmarkMountScaling({
    fullGrid: process.argv.includes('--full-grid'),
    orderedAxes: process.argv.includes('--ordered-axes'),
  }), null, 2));
}
