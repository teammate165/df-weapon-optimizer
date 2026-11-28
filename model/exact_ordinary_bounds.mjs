import {createOrderedAxisIntervals} from '../exact-beta/ordered-axis-intervals.mjs?v=8e593db3b6670458';
import {createNativeChartInterval} from './branch_score_bounds.mjs?v=8e593db3b6670458';
import {timedRecoil} from './timed_recoil.mjs?v=8e593db3b6670458';

const axes = ['GRecoil_H', 'GRecoil_V'];
const kickTargets = ['GGunkickRandom', 'GGunkickSpring'];
const inertTargets = new Set(['GBreathScale', 'AimMoveGunSway', 'GBullet_Velocity',
  'GMovement_ADSSpeed', 'ScopeCameraTuneDistance', 'ScopeZoomTuneRate']);
const otherTargets = new Set([...kickTargets, ...inertTargets, 'GAiming_ADSTime']);
const adsTarget = 'GAiming_ADSTime';

export function createOrdinaryChartMemo(pruning) {
  const values = new Map();
  const numberKey = value => Object.is(value, -0) ? '-0' : String(value);
  let serial = 0;
  return chart => {
    const id = serial++;
    const lower = (axis, range) => {
      const key = id + ':' + axis + ':' + numberKey(range[0]) + ':' + numberKey(range[1]);
      const cached = values.get(key);
      if (cached !== undefined) {
        pruning.chart_memo_hits++;
        return cached;
      }
      pruning.chart_memo_misses++;
      const value = axis === 'h' ? chart.horizontalLower(range).weightedDistance : chart.verticalLower(range);
      if (values.size >= 8192) values.delete(values.keys().next().value);
      values.set(key, value);
      return value;
    };
    return (horizontal, vertical) => lower('v', vertical) + lower('h', horizontal);
  };
}

// A request fixes the pack, mode, tuning preference and native runtime. The
// native control grid depends only on the mounted attachment context. Keep
// each layout's mutable control wrappers separate from the cached domains.
export function createOrdinaryControls(pack, request, curves) {
  const cache = new Map();
  return (build, seedOnly) => {
    const controls = [];
    for (const row of build.mounted) {
      const ids = pack.parts[row.itemId]?.tuneIds;
      if (!ids?.length) continue;
      const key = JSON.stringify([row.itemId, row.slotPath, row.socketId, row.hostItemId, row.source]);
      let entries = cache.get(key);
      if (!entries) {
        entries = [];
        for (const id of ids) {
          const control = curves.c(pack, row, id);
          if (!control || control.enabled === false) continue;
          const positions = curves.n(control);
          if (!positions.length) throw Error('Empty native calibration domain');
          const requested = request.tunes?.[row.slotPath]?.[id];
          const preferred = positions.includes(requested) ? requested : control.range.defaultValue;
          const ordered = positions.includes(preferred)
            ? [preferred, ...positions.filter(value => value !== preferred)] : positions;
          entries.push({path: row.slotPath, id, functions: control.functions ?? [], positions: ordered});
        }
        if (cache.size >= 2048) cache.clear();
        cache.set(key, entries);
      }
      for (const entry of entries) {
        controls.push({...entry, index: controls.length,
          positions: seedOnly ? [entry.positions[0]] : entry.positions});
      }
    }
    return controls;
  };
}

function controlIntervals({pack, build, mode, controls, fixed, kernel, tableCache, targets, fallback}) {
  const writers = controls.filter(({functions}) => functions.some(({target}) => targets.includes(target)));
  const box = writers.map(({positions}) => [0, positions.length - 1]);
  const intervals = createOrderedAxisIntervals({pack, build, mode, fixed, axes: targets,
    controls: writers.map(control => ({...control, slotPath: control.path})), kernel,
    ignoredTargets: new Set([...axes, ...otherTargets]), cache: tableCache, fallback});
  const tunes = {};
  for (const {path, id, positions} of writers) (tunes[path] ??= {})[id] = positions[0];
  const native = kernel.u(pack, build, {mode, tacticalEffective: true, tunes});
  const singleton = writers.map(() => [0, 0]);
  if (targets.some((target, index) => intervals(singleton, index)[0] !== native.value(target, fallback(target)))) {
    throw Error('Ordered tuning model and native value disagree');
  }
  return {writers, box, intervals};
}

function kickTree(context, scorer) {
  try {
    const behavior = context.pack.handling.weaponBehaviorProfiles?.[context.pack.weapon.references.weaponBehaviorProfileId];
    const fallback = target => behavior?.kickScales?.[target === kickTargets[0] ? 'randomKickScale' : 'springKickScale'] ?? 1;
    const {writers, box, intervals} = controlIntervals({...context, targets: kickTargets, fallback});
    if (writers.some(({functions}) => functions.some(({target}) => axes.includes(target)))) return null;
    let tuples = 1, nodes = 1;
    for (const {positions} of writers) {
      tuples *= positions.length;
      nodes += tuples;
    }
    const indices = new Set(writers.map(({index}) => index));
    const programKey = intervals.programKey;
    if (nodes > 16384) {
      // Avoid materializing a large tree. An exact terminal kick still lets
      // the layout discard a tuple before running the full native scorer.
      const offsets = new Map(writers.map(({index}, offset) => [index, offset]));
      const last = writers.length - 1;
      const prefixCount = writers.slice(0, last).reduce((count, writer) => count * writer.positions.length, 1);
      const cacheKey = context.tableCache && 'large-kick-minimum:' + programKey();
      const root = {minimum: context.tableCache?.get(cacheKey) ?? 0};
      const terminal = {minimum: 0}, prefixes = new Map();
      let prefixBest = Infinity;
      const exactKick = () => scorer.norm(intervals(box, 0)[0], intervals(box, 1)[0]);
      return {
        root, indices, programKey,
        select(index, position) {
          const offset = offsets.get(index);
          box[offset] = [position, position];
          try {
            if (offset === last) {
              terminal.minimum = exactKick();
              return Number.isFinite(terminal.minimum) ? terminal : undefined;
            }
            if (offset !== last - 1 || writers[last].positions.length > 256) return undefined;
            const key = box.slice(0, last).map(range => range[0]).join(',');
            const known = prefixes.get(key);
            if (known) return known;
            let minimum = Infinity;
            for (let p = 0; p < writers[last].positions.length; p++) {
              box[last] = [p, p];
              minimum = Math.min(minimum, exactKick());
            }
            if (!Number.isFinite(minimum)) return undefined;
            if (prefixes.size >= 16384) prefixes.clear();
            const prefix = {minimum};
            prefixes.set(key, prefix);
            prefixBest = Math.min(prefixBest, minimum);
            if (prefixes.size === prefixCount) {
              root.minimum = prefixBest;
              context.tableCache?.set(cacheKey, prefixBest);
            }
            return prefix;
          } catch {
            return undefined;
          }
        },
      };
    }
    let memo = context.tableCache?.get('kick-trees');
    if (!memo && context.tableCache) {
      memo = {entries: new Map(), nodes: 0};
      context.tableCache.set('kick-trees', memo);
    }
    const trees = memo?.entries;
    const key = trees && intervals.inputKey();
    const visit = depth => {
      if (depth === writers.length) {
        const minimum = scorer.norm(intervals(box, 0)[0], intervals(box, 1)[0]);
        if (!Number.isFinite(minimum)) throw Error('Nonfinite native kick');
        return {minimum};
      }
      const children = writers[depth].positions.map((_, index) => {
        box[depth] = [index, index];
        return visit(depth + 1);
      });
      return {minimum: Math.min(...children.map(node => node.minimum)), children};
    };
    let root = trees?.get(key)?.root;
    if (!root) {
      root = visit(0);
      if (memo) {
        while (trees.size >= 32 || memo.nodes + nodes > 65536) {
          const oldest = trees.keys().next().value;
          memo.nodes -= trees.get(oldest).nodes;
          trees.delete(oldest);
        }
        trees.set(key, {root, nodes});
        memo.nodes += nodes;
      }
    }
    return {root, programKey, indices};
  } catch {
    return null;
  }
}

function handlingDominance(context) {
  const positions = new Map();
  try {
    if (!context.controls.some(({functions}) => functions.some(({target}) => target === adsTarget) &&
        functions.every(({target}) => target === adsTarget || inertTargets.has(target)))) return positions;
    const aiming = context.pack.handling.aimingProfiles[context.fixed.references.aimingProfileId];
    const {writers, box, intervals} = controlIntervals({...context, targets: [adsTarget],
      fallback: () => aiming.adsOnTimeSeconds});
    const indices = intervals.minimizingPositions(box, 0);
    if (indices) writers.forEach(({functions, index, positions: values}, offset) => {
      if (functions.every(({target}) => target === adsTarget || inertTargets.has(target))) {
        positions.set(index, values[indices[offset]]);
      }
    });
  } catch {
    // The full native tuning grid is still available.
  }
  return positions;
}

// The allowed writes leave the chart profile, timing, and main-stat mappings
// fixed. Unknown writes and unproved native contexts use the direct scorer.
export function prepareOrdinaryBound({pack, build, mode, controls, modules, scorer, tableCache, memoChart, firing}) {
  const {kernel, calculate} = modules;
  const stateContract = kernel.u?.screeningStateContract;
  const chartContract = calculate?.screeningChartContract;
  const chartPattern = scorer.solverPlan.chartPattern;
  if (stateContract?.version !== 1 || stateContract.evaluate !== kernel.u || firing === 'spam') return null;
  if (chartPattern && (chartContract?.version !== 1 || chartContract.calculate !== calculate ||
      !['s', 'r', 'n', 't', 'd', 'u'].every(key => chartContract.kernel?.[key] === kernel[key]))) return null;
  const chartControls = [];
  let variableKick = false;
  for (const {path, id, positions, functions, index} of controls) {
    if (functions.some(({target}) => !axes.includes(target) && !otherTargets.has(target))) return null;
    if (functions.some(({target}) => kickTargets.includes(target))) variableKick = true;
    if (!functions.some(({target}) => axes.includes(target))) continue;
    if (!axes.every(axis => functions.filter(effect => effect.target === axis && effect.modifier === 'Mult_A').length === 1)) return null;
    chartControls.push({slotPath: path, id, positions, index});
  }
  try {
    const fixed = kernel.u(pack, build, {mode, tacticalEffective: true, tunes: {}});
    let patternKey = 'legacy', project, patternBound, raw;
    if (chartPattern) {
      const profile = pack.handling.recoilProfiles[fixed.references.adsRecoilProfileId];
      const path = timedRecoil(pack, build, {}, {mode, shot_count: 20}, modules,
        {abstractProfile: true, state: fixed, pointsOnly: true});
      if (path.status !== 'modeled' || !profile) return null;
      const times = path.points.map(point => point.time_ms);
      // The native profile and shot times determine the chart enclosure.
      patternKey = 'chart:' + JSON.stringify([fixed.references.adsRecoilProfileId, times]);
      patternBound = tableCache?.get(patternKey);
      if (!patternBound) {
        const bounds = createNativeChartInterval(profile, times);
        patternBound = memoChart ? memoChart(bounds) : (h, v) => bounds.lower(h, v).pattern;
        tableCache?.set(patternKey, patternBound);
      }
      raw = scorer.raw(build, {}, fixed, () => path);
      const values = axes.map(axis => fixed.value(axis, 1));
      const points = chartContract.trajectory(profile, ...values, false, 20);
      if (points.length !== path.points.length || points.some((point, index) =>
        point.x !== path.points[index].x || point.y !== path.points[index].y)) return null;
      if (patternBound(...values.map(value => [value, value])) > raw.pattern) return null;
      project = state => {
        if (state.references.adsRecoilProfileId !== fixed.references.adsRecoilProfileId) return null;
        return {status: 'modeled', points: chartContract.trajectory(
          profile, state.value(axes[0], 1), state.value(axes[1], 1), false, 20
        ).map((point, index) => ({...point, time_ms: times[index]}))};
      };
    } else {
      raw = scorer.raw(build, {}, fixed);
      // Only call the native norm at an exact pair. Zero encloses a varying pair.
      patternBound = (h, v) => h[0] === h[1] && v[0] === v[1] ? scorer.norm(h[0], v[0]) : 0;
    }
    const intervals = createOrderedAxisIntervals({pack, build, mode, controls: chartControls,
      fixed, axes, kernel, ignoredTargets: otherTargets, cache: tableCache});
    const box = chartControls.map(({positions}) => [0, positions.length - 1]);
    const byIndex = new Map(chartControls.map(({index}, axisIndex) => [index, axisIndex]));
    const context = {pack, build, mode, controls, fixed, kernel, tableCache};
    let kick;
    const getKick = () => {
      if (kick === undefined) kick = variableKick ? kickTree(context, scorer) : null;
      return kick;
    };
    let previousBox, previousPattern;
    const patternLower = () => {
      if (!previousBox || box.some(([lo, hi], index) => lo !== previousBox[index][0] || hi !== previousBox[index][1])) {
        previousPattern = patternBound(intervals(box, 0), intervals(box, 1));
        previousBox = box.slice();
      }
      return previousPattern;
    };
    const patternProgramKey = () => patternKey + ':' + intervals.programKey();
    return {
      get kick() { return getKick(); },
      get handlingPositions() { return handlingDominance(context); },
      byIndex, box, inert: new Set(controls.filter(({functions}) =>
        functions.every(({target}) => inertTargets.has(target))).map(({index}) => index)),
      project,
      patternLower,
      patternProgramKey,
      lossProgramKey() {
        const kick = getKick();
        return JSON.stringify([patternProgramKey(), raw.camera,
          kick ? kick.programKey() : (variableKick ? 0 : raw.kick)]);
      },
      lossLower(pattern, minimumKick = getKick()?.root.minimum ?? (variableKick ? 0 : raw.kick)) {
        return scorer.score({...raw, pattern, kick: minimumKick});
      },
    };
  } catch {
    return null;
  }
}
