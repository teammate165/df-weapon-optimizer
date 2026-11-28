import {assert, readFixture} from './chart-fixture-runtime.mjs?v=2ef137a83bb81d8a';
import {nonObjectiveTargets} from './m4-active-controls.mjs?v=2ef137a83bb81d8a';
import {createOrderedAxisIntervals} from './ordered-axis-intervals.mjs?v=2ef137a83bb81d8a';
import {createNativeChartInterval} from '../model/branch_score_bounds.mjs?v=2ef137a83bb81d8a';
import {searchCategories} from './category-search.mjs?v=2ef137a83bb81d8a';
import {presets} from '../model/optimizer_presets.mjs?v=2ef137a83bb81d8a';
import {timedRecoil} from '../model/timed_recoil.mjs?v=2ef137a83bb81d8a';
import {fastestHorizontalSpeed, horizontalSpeedMultiplier} from '../model/horizontal_speed.mjs?v=2ef137a83bb81d8a';
import * as curves from '../runtime/curves.mjs?v=2ef137a83bb81d8a';
import * as kernel from '../runtime/kernel.mjs?v=2ef137a83bb81d8a';
import {t as calculate} from '../runtime/attributes.mjs?v=2ef137a83bb81d8a';

const [pack, {shop}] = await Promise.all([readFixture('weapons/18010000001.json?v=2ef137a83bb81d8a'),
  readFixture('catalog.json?v=2ef137a83bb81d8a')]);
const mode = 'bd', budget = 200;
const resolve = config => curves.o(pack, config, mode);
const modules = {kernel, curves, calculate};
export const createChartPreset = recoilNorm =>
  presets.recoil.create({pack, mode, resolve, request: {mode}, ...modules, recoilNorm});
const preset = createChartPreset();
assert.equal(preset.baseline.pattern_model, 'ads-chart-speed-tier-v2');
const baseline = preset.score(preset.baseline);
const stock = {cost: 0, gain: 0, config: [], tunes: {}};
const axes = ['GRecoil_H', 'GRecoil_V'];
export {pack, shop, mode, resolve, modules, preset, baseline, stock, axes};
export const request = {mode, shot_count: 20};
export function axisControlFor(mounted) {
  const {itemId} = mounted;
  const candidates = pack.parts[itemId].tuneIds.map(id => ({id, control: curves.c(pack, mounted, id)}));
  const eligible = candidates.filter(({control}) => control && control.enabled !== false &&
    axes.every(target => control.functions.some(effect => effect.target === target)));
  const {id, control} = eligible.find(row => row.id.includes(':weight:')) ?? eligible[0] ?? {};
  assert(control && control.enabled !== false);
  assert(control.functions.every(effect =>
    [...axes, 'GBreathScale', 'GAiming_ADSTime'].includes(effect.target) && effect.modifier === 'Mult_A'));
  return {id, control};
}
export function createAxisContext(build, tunePaths, selectPositions = positions => positions, prepareChart = null, cache = null, orderedAxes = false, scorer = preset, activeChart = null) {
  assert(scorer === preset || orderedAxes);
  const controls = activeChart ?? build.config.filter(part => tunePaths.includes(part.slotPath)).map(({slotPath, itemId}) => {
    const mounted = build.mounted.find(part => part.slotPath === slotPath && part.itemId === itemId);
    const key = cache ? JSON.stringify([itemId, slotPath, mounted.socketId, mounted.hostItemId]) : null;
    if (cache?.controls.has(key)) return cache.controls.get(key);
    const {id, control} = axisControlFor(mounted);
    const effects = axes.map(target => {
      const matches = control.functions.filter(effect => effect.target === target);
      assert.equal(matches.length, 1);
      const curve = pack.curves[matches[0].curveId];
      assert.equal(curves.r(curve, control.range.defaultValue), 0);
      return curve;
    });
    const positions = selectPositions(curves.n(control));
    const table = {slotPath, id, positions,
      vectors: positions.map(value => effects.map(curve => curves.r(curve, value)))};
    cache?.controls.set(key, table);
    return table;
  });
  if (!activeChart) assert.equal(controls.length, tunePaths.length);
  const tunesAt = indices => {
    const tunes = Object.fromEntries(Object.entries(chartContext.kickTunes ?? {})
      .map(([path, values]) => [path, {...values}]));
    controls.forEach(({slotPath, id, positions}, i) => {
      (tunes[slotPath] ??= {})[id] = positions[indices[i]];
    });
    return tunes;
  };
  const fixed = kernel.u(pack, build, {mode, tacticalEffective: true, tunes: {}});
  const coefficients = axes.map(target => {
    const bucket = fixed.numeric.buckets.get(target) ?? {};
    const base = (bucket.initial ?? fixed.baseTargets[target] ?? 1) + (bucket.addend ?? 0);
    const multA = bucket.multA ?? 0, multC = bucket.multC ?? 1;
    assert(base > 0 && multC > 0);
    return {base, multA, multC};
  });
  const profile = pack.handling.recoilProfiles[fixed.references.adsRecoilProfileId];
  let chartContext;
  if (prepareChart) {
    chartContext = prepareChart(fixed);
  } else {
    const path = timedRecoil(pack, build, {}, request, modules, {abstractProfile: true});
    assert.equal(path.status, 'modeled');
    chartContext = {times: path.points.map(point => point.time_ms),
      fixedRaw: scorer.raw(build, {}, fixed)};
  }
  const {times, fixedRaw} = chartContext;
  const profileKey = cache ? JSON.stringify([fixed.references.adsRecoilProfileId, times]) : null;
  let geometry = cache?.geometry.get(profileKey);
  if (!geometry) {
    const unit = calculate.screeningChartContract.trajectory(profile, 1, 1, false, 20, true)
      .map((point, i) => ({...point, time_ms: times[i]}));
    assert.equal(unit.length, 20);
    const maxX = Math.max(...unit.map(p => Math.abs(p.x)));
    const spanY = Math.max(...unit.map(p => p.y)) - Math.min(...unit.map(p => p.y));
    const unitSpeed = fastestHorizontalSpeed(unit).speed;
    const variation = unit.reduce((sum, p, i) => sum + Math.abs(p.x - (unit[i - 1]?.x ?? 0)) +
      Math.abs(p.y - (unit[i - 1]?.y ?? 0)), 0);
    geometry = {unit, maxX, spanY, unitSpeed, variation};
    cache?.geometry.set(profileKey, geometry);
  }
  const {unit, maxX, spanY, unitSpeed, variation} = geometry;

  function paddedAxisRange(box, axis) {
    const {base, multA, multC} = coefficients[axis];
    const ranges = box.map(([lo, hi], i) => {
      const values = controls[i].vectors.slice(lo, hi + 1).map(row => row[axis]);
      return [Math.min(...values), Math.max(...values)];
    });
    return [0, 1].map(side => {
      const inner = ranges.reduce((total, range) => total + range[side], 1 + multA);
      assert(inner > 0.01);
      const value = base * inner * multC;
      const allowance = 512 * Number.EPSILON *
        Math.max(1, Math.abs(base * multC) * (1 + Math.abs(multA) +
          ranges.reduce((sum, range) => sum + Math.max(...range.map(Math.abs)), 0)));
      return side ? value + allowance : Math.max(0, value - allowance);
    });
  }
  const axisRange = orderedAxes ?
    createOrderedAxisIntervals({pack, build, mode, controls, fixed, axes, kernel, cache: cache?.orderedTables,
      ignoredTargets: activeChart ? nonObjectiveTargets : undefined}) : paddedAxisRange;
  const nativeChart = orderedAxes ? createNativeChartInterval(profile, times) : null;
  const referenceLoss = scorer === preset ? baseline : scorer.score(scorer.baseline);
  function upperGain(box) {
    const h = axisRange(box, 0), v = axisRange(box, 1);
    if (nativeChart) {
      const {pattern} = nativeChart.lower(h, v);
      // Camera and kick are exact native constants for this resolved context.
      return referenceLoss - scorer.score({...fixedRaw, pattern});
    }
    // Same conservative chart error allowance as the existing attachment bound.
    const error = 1e-5 + 8192 * Number.EPSILON * Math.max(1, variation) * Math.max(1, h[1], v[1]);
    const speed = Math.max(0, unitSpeed * h[0] - 10 * error);
    const pattern = Math.max(0, spanY * v[0] - 2 * error) +
      horizontalSpeedMultiplier(speed) * Math.max(0, maxX * h[0] - error);
    const lower = preset.score({...fixedRaw, pattern});
    return baseline - (lower - 1e-7 * Math.max(1, Math.abs(lower)));
  }

  const full = controls.map(({positions}) => [0, positions.length - 1]);
  return {build, full, tunesAt, fixed, unit, fixedRaw, axisRange, upperGain, calibrationTables: controls};
}
export function split(box) {
  if (!box.length) return [];
  const axis = box.reduce((best, [lo, hi], i) =>
    hi - lo > box[best][1] - box[best][0] ? i : best, 0);
  const [lo, hi] = box[axis];
  if (lo === hi) return [];
  const mid = Math.floor((lo + hi) / 2);
  return [[lo, mid], [mid + 1, hi]].map(range => box.map((old, i) => i === axis ? range : old));
}
if (import.meta.main) {
  const build = resolve([{slotPath: '1', itemId: '13030000109'},
    {slotPath: '3', itemId: '13040000104'}]);
  assert.deepEqual(build.config.map(part => part.itemId).sort(), ['13030000109', '13040000104']);
  const cost = build.mounted.filter(part => part.source === 'equipped')
    .reduce((sum, part) => sum + shop.partCosts[part.itemId], 0);
  assert(cost > 0 && cost <= budget);
  const orderedAxes = process.argv.includes('--ordered-axes');
  const {full, tunesAt, fixed, unit, fixedRaw, axisRange, upperGain} =
    createAxisContext(build, ['1', '3'], undefined, null, null, orderedAxes);
  const oracle = [];
  const tiers = new Set();
  const start = performance.now();
  for (let i = 0; i <= full[0][1]; i++) {
    const row = [];
    for (let j = 0; j <= full[1][1]; j++) {
      const tunes = tunesAt([i, j]);
      const state = kernel.u(pack, build, {mode, tacticalEffective: true, tunes});
      const raw = preset.raw(build, tunes, state);
      const chart = timedRecoil(pack, build, tunes, request, modules, {abstractProfile: true});
      assert.equal(state.references.adsRecoilProfileId, fixed.references.adsRecoilProfileId);
      assert.deepEqual(chart.points.map(p => p.time_ms), unit.map(p => p.time_ms));
      assert.equal(raw.camera, fixedRaw.camera);
      assert.equal(raw.kick, fixedRaw.kick);
      for (const [axis, target] of axes.entries()) {
        const [lo, hi] = axisRange([[i, i], [j, j]], axis);
        const value = state.value(target, 1);
      assert(value >= lo && value <= hi);
      if (orderedAxes) {
        assert.equal(lo, value);
        assert.equal(hi, value);
      }
      }
      tiers.add(raw.horizontal_multiplier);
      row.push({gain: baseline - preset.score(raw), horizontal: state.value(axes[0], 1),
        vertical: state.value(axes[1], 1)});
    }
    oracle.push(row);
  }
  const oracleMs = performance.now() - start;
  assert(tiers.size > 1);
  for (const axis of ['horizontal', 'vertical']) {
    assert(oracle.some((row, i) => row[0][axis] !== oracle[0][0][axis]), axis + ' unchanged by slider 1');
    assert(oracle[0].some(row => row[axis] !== oracle[0][0][axis]), axis + ' unchanged by slider 2');
  }
  const expected = Math.max(...oracle.flat().map(row => row.gain));
  assert(expected > 0);

  // Check every box in the binary partition, including descendants that search skips.
  let checked = 0;
  function audit(box) {
    const children = split(box);
    const best = children.length ? Math.max(...children.map(audit)) :
      oracle[box[0][0]][box[1][0]].gain;
    assert(upperGain(box) >= best);
    checked++;
    return best;
  }
  assert.equal(audit(full), expected);

  function trial() {
    const start = performance.now();
    let scores = 0, bounds = 0;
    function bound(box) {
      bounds++;
      return {box, upperGain: upperGain(box), lowerCost: cost};
    }
    const result = searchCategories({root: true, upperGain: baseline, lowerCost: 0}, {
      budget,
      expand(node) {
        if (node.root) return [{row: stock, upperGain: 0, lowerCost: 0}, bound(full)];
        const children = split(node.box);
        if (children.length) return children.map(bound).sort((a, b) => a.upperGain - b.upperGain);
        const tunes = tunesAt(node.box.map(range => range[0]));
        const gain = baseline - preset.score(preset.raw(build, tunes));
        scores++;
        return [{row: {gain, cost, config: build.config, tunes}, upperGain: gain, lowerCost: cost}];
      },
    });
    assert.equal(result.pending, 0);
    assert.deepEqual(result.proven, {maximum: true, minimum: true, balanced: true});
    for (const row of [result.maximum, result.minimum, result.balanced]) {
      assert.equal(row.gain, expected);
      assert.equal(row.cost, cost);
    }
    return {scores, bounds, nodes: result.visited, elapsedMs: performance.now() - start,
      maximum: result.maximum};
  }
  trial();
  const samples = Array.from({length: 7}, trial);
  console.log(JSON.stringify({orderedAxes, budget, cost, config: build.config, tiers: [...tiers],
    tuples: oracle.flat().length, checked, oracleMs, samples}, null, 2));

}
