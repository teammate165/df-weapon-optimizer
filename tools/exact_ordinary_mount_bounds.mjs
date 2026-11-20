import {createBranchScoreBound} from './branch_score_bounds.mjs';

const chartTargets = new Set(['GRecoil_H', 'GRecoil_V']);
const kickTargets = ['GGunkickRandom', 'GGunkickSpring'];
const recoilTargets = new Set([...chartTargets, 'GRecoil_HShake', 'GRecoil_VShake', ...kickTargets]);
const otherTargets = new Set(['GGunkickRandom', 'GGunkickSpring', 'GBreathScale', 'GAiming_ADSTime',
  'AimMoveGunSway', 'GBullet_Velocity', 'GMovement_ADSSpeed', 'ScopeCameraTuneDistance', 'ScopeZoomTuneRate']);

function calibrationEnvelope(pack, node, mode, curves, collector, boundedTargets, captureKick) {
  const ranges = new Map();
  let kickValues;
  const mounted = {itemId: node.item, slotPath: node.path, socketId: Number(node.socketId),
    hostItemId: node.host, source: 'equipped'};
  for (const id of pack.parts[node.item]?.tuneIds ?? []) {
    const control = curves.c(pack, mounted, id);
    if (!control || control.enabled === false) continue;
    const writers = new Set();
    for (const effect of control.functions ?? []) {
      if (!boundedTargets.has(effect.target) && otherTargets.has(effect.target)) continue;
      if (!boundedTargets.has(effect.target) || effect.modifier !== 'Mult_A' ||
          ranges.has(effect.target) || writers.has(effect.target)) {
        throw Error('Unsupported mount calibration write');
      }
      writers.add(effect.target);
      ranges.set(effect.target, [Infinity, -Infinity]);
    }
    if (!writers.size) continue;
    const kickWriter = captureKick && kickTargets.some(target => writers.has(target));
    const shared = new Set();
    const positions = curves.n(control);
    if (!positions.length) throw Error('Empty mount calibration domain');
    for (const position of positions) {
      const {operations} = collector.collect(pack, {mounted: [mounted]}, {
        mode, tacticalEffective: true, tunes: {[node.path]: {[id]: position}},
        includeAmmo: false, ammoItemId: null,
      });
      const effects = operations.filter(operation => operation.sourceTuneId === id);
      const boundedEffects = effects.filter(effect => boundedTargets.has(effect.target));
      if (boundedEffects.length !== writers.size ||
          new Set(boundedEffects.map(effect => effect.target)).size !== writers.size) {
        throw Error('Unexpected native mount calibration write count');
      }
      for (const effect of boundedEffects) {
        if (!writers.has(effect.target) || effect.operation !== 'StaticAttributeModify' ||
            effect.scope !== 'NONE' || effect.modifier !== 'Mult_A' || !Number.isFinite(effect.value)) {
          throw Error('Unexpected native mount calibration write');
        }
        const range = ranges.get(effect.target);
        range[0] = Math.min(range[0], effect.value);
        range[1] = Math.max(range[1], effect.value);
      }
      if (kickWriter) {
        const [a, b] = kickTargets.map(target => boundedEffects.find(effect => effect.target === target)?.value);
        if (a === undefined || a !== b) kickValues = null;
        else shared.add(a);
      }
    }
    if (kickWriter && kickValues !== null) kickValues = kickValues === undefined ? [...shared] : null;
  }
  return {ranges, kickValues};
}

// Each instance belongs to one enumeration. Its first call sees the branch
// root after attachment restrictions, so every later node is a descendant.
export function createExactOrdinaryMountBound({pack, request, compiled, modules, scorer, patternConstraint,
  getIncumbentLoss, getPriceLoss, phaseCut, finiteKick = false}) {
  const {curves, kernel} = modules;
  const collector = kernel.u?.screeningStateContract;
  const chart = scorer.solverPlan.chartPattern;
  const usePattern = Boolean(patternConstraint && chart);
  const useLoss = !patternConstraint && request.mode === 'mp' && typeof getIncumbentLoss === 'function';
  const usePrices = Number.isSafeInteger(compiled.budget) && request.mode !== 'mp' && typeof getPriceLoss === 'function';
  if ((!usePattern && !useLoss && !usePrices && !phaseCut) || collector?.version !== 1 || collector.evaluate !== kernel.u ||
      request.firing === 'spam') return null;

  let nodes, bound, priceBound;
  const stats = {status: 'uninitialized', cuts: 0, price_cuts: 0, phase_cuts: 0, envelopes: 0};
  const priceStats = {};
  function prepare(nodes, patternOnly, diagnostics) {
    const envelopes = new Map(), kickTables = new Map(), kickTableIds = new Map();
    const captureKick = finiteKick && !patternOnly && chart;
    try {
      for (const node of nodes) {
        const {ranges, kickValues} = calibrationEnvelope(pack, node, request.mode, curves, collector,
          patternOnly ? chartTargets : recoilTargets, captureKick);
        if (ranges.size) envelopes.set(node, ranges);
        if (kickValues === null) kickTables.set(node, null);
        else if (kickValues) {
          const key = JSON.stringify(kickValues);
          if (!kickTableIds.has(key)) kickTableIds.set(key, {id: kickTableIds.size, values: kickValues});
          kickTables.set(node, kickTableIds.get(key));
        }
      }
    } catch (error) {
      diagnostics.status = 'unsupported_calibration';
      diagnostics.reason = error.message;
      return null;
    }
    diagnostics.envelopes = envelopes.size;
    const prepared = createBranchScoreBound({pack, request, compiled: {...compiled, nodes}, ...modules,
      preset: scorer, calibrationRanges: node => envelopes.get(node), nativeChartIntervals: chart,
      kickCalibrationTable: captureKick ? node => kickTables.get(node) : null,
      nativeStatIntervals: true, discreteStatCurves: Boolean(phaseCut), nativeContexts: chart, patternOnly, portableScore: !patternOnly,
      nativeTimingOrders: chart,
      maxEntries: 8192, maxKeyChars: 4 * 1024 * 1024, refreshCache: true,
      onUnsupported: reason => { diagnostics.reason = reason; }});
    diagnostics.status = prepared ? 'bounded' : 'unsupported_context';
    return prepared;
  }
  return {
    priceBudget: usePrices ? compiled.budget : undefined,
    prune(branch) {
      // Keep root coverage even when a witness only becomes available later.
      nodes ??= compiled.nodes.filter(node => branch.interval(node.active)[1]);
      let phaseLower;
      if (phaseCut) {
        if (priceBound === undefined) priceBound = prepare(nodes, false, priceStats);
        phaseLower = priceBound?.lowerComponents(branch);
        if (phaseLower && usePattern) {
          stats.status = 'bounded';
          if (phaseLower.pattern > patternConstraint.maximum) {
            stats.cuts++;
            return true;
          }
        }
      }
      if ((usePattern && !phaseLower) || useLoss) {
        if (bound === undefined) bound = prepare(nodes, usePattern, stats);
        const cutoff = usePattern ? patternConstraint.maximum : getIncumbentLoss();
        if (bound && Number.isFinite(cutoff)) {
          const lower = bound.lower(branch);
          if (lower !== null && lower > cutoff) {
            stats.cuts++;
            return true;
          }
        }
      }
      if (phaseLower && phaseCut(phaseLower.loss, branch)) {
        stats.phase_cuts++;
        stats.cuts++;
        return true;
      }
      if (!usePrices || !branch.suffixCosts) return false;
      let cutoff = -Infinity;
      for (const suffix of branch.suffixCosts) {
        if (suffix > compiled.budget - branch.selectedCost) break;
        const loss = getPriceLoss(branch.selectedCost + suffix);
        if (!Number.isFinite(loss)) return false;
        cutoff = Math.max(cutoff, loss);
      }
      if (cutoff === -Infinity) return false;
      if (priceBound === undefined) priceBound = prepare(nodes, false, priceStats);
      const lower = priceBound?.lower(branch);
      if (lower == null || lower <= cutoff) return false;
      stats.price_cuts++;
      stats.cuts++;
      return true;
    },
    getStats: () => ({...stats, ...bound?.getStats(),
      ...(usePrices || phaseCut ? {price_bound: {...priceStats, ...priceBound?.getStats()}} : {})}),
  };
}
