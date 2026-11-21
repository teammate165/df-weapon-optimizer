import {assert} from './chart-fixture-runtime.mjs?v=bd5393207c0bd66b';
import {createBranchScoreBound} from '../model/branch_score_bounds.mjs?v=bd5393207c0bd66b';
import {activeControls, nonObjectiveTargets} from './m4-active-controls.mjs?v=bd5393207c0bd66b';
import {pack, mode, modules, preset, axes, axisControlFor} from './m4-chart-axis-boxes.mjs?v=bd5393207c0bd66b';

// Optional, restricted to the shared-axis tuning fixture. All positions are
// passed through the native collector with their actual provider context.
export function createCalibratedMountBound(compiled, interval, tunedPaths, allowed, nativeChartIntervals = false, nativeStatIntervals = false, nativeContexts = false, portableScore = false, variableNormLower = null, scorer = preset, variableControls = false, cacheOptions = {}) {
  const baseline = scorer.score(scorer.baseline);
  const collector = modules.kernel.u.screeningStateContract;
  const nodes = compiled.nodes.filter(node => interval(node.active)[1]);
  const envelope = new Map();
  try {
    for (const node of nodes) {
      if (!variableControls &&
          (!tunedPaths.includes(node.path) || !allowed.has(node.path + '|' + node.item))) continue;
      const mounted = {itemId: node.item, slotPath: node.path, socketId: +node.socketId,
        hostItemId: node.host, source: 'equipped'};
      const controls = variableControls ? activeControls(pack, mounted, modules.curves) : (() => {
        const {id, control} = axisControlFor(mounted);
        return [{id, positions: modules.curves.n(control), axisTargets: axes}];
      })();
      const ranges = new Map();
      for (const {id, positions, axisTargets} of controls) {
        const targets = new Set(axisTargets);
        const inert = variableControls ? nonObjectiveTargets : new Set(['GBreathScale', 'GAiming_ADSTime']);
        for (const target of targets) {
          // Each interval is attached to one atomic native Mult_A write.
          assert(!ranges.has(target), 'Repeated scored tune target on one occurrence');
          ranges.set(target, [0, 0]);
        }
        for (const value of positions) {
          const {operations} = collector.collect(pack, {mounted: [mounted]}, {
            mode, tacticalEffective: true, tunes: {[node.path]: {[id]: value}},
            includeAmmo: false, ammoItemId: null,
          });
          const effects = operations.filter(op => op.sourceTuneId);
          assert(effects.every(op => op.sourceTuneId === id && op.operation === 'StaticAttributeModify' &&
            Number.isFinite(op.value) && op.scope === 'NONE' &&
            (targets.has(op.target) ? op.modifier === 'Mult_A' : inert.has(op.target))));
          for (const target of targets) assert.equal(effects.filter(op => op.target === target).length, 1);
          const {buckets} = collector.numeric(pack, effects);
          for (const [target, bucket] of buckets) {
            assert(targets.has(target) || inert.has(target));
            if (!targets.has(target)) continue;
            assert((bucket.addend ?? 0) === 0 && (bucket.multC ?? 1) === 1 && bucket.initial === undefined);
            const range = ranges.get(target);
            range[0] = Math.min(range[0], bucket.multA ?? 0);
            range[1] = Math.max(range[1], bucket.multA ?? 0);
          }
        }
      }
      if (ranges.size) envelope.set(node, ranges);
    }
  } catch {
    return null;
  }
  const bound = createBranchScoreBound({pack, request: {mode}, compiled: {...compiled, nodes},
    preset: scorer, ...modules, nativeChartIntervals, nativeStatIntervals, nativeContexts, portableScore, variableNormLower, ...cacheOptions, calibrationRanges: node => envelope.get(node)});
  if (!bound) return null;
  return {
    envelopeCount: envelope.size,
    contexts: bound.nativeContextManifest,
    upperGain(branch) {
      const lower = bound.lower(branch);
      return lower === null ? Infinity : Math.min(baseline, baseline - lower);
    },
    stats: bound.getStats,
  };
}
