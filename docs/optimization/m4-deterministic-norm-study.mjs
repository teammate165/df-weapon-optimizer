import {assert} from './chart-fixture-runtime.mjs';
import {runMountStream} from './m4-chart-mount-stream.mjs';
import {createChartPreset, resolve, shop} from './m4-chart-axis-boxes.mjs';
import {deterministicNorm} from './deterministic-norm.mjs';

const settings = {
  fast: true, cachePreparation: true, budgetBound: true, gainBound: true,
  nativeChartIntervals: true, nativeStatIntervals: true, nativeContexts: true,
  portableScore: true, deterministic: true, auditMounts: false,
};

export function compareDeterministicNorm({largest = false, eightPaths = false, auditGain = true, reference = null, progress = () => {}} = {}) {
  const runs = [];
  for (const name of eightPaths ? ['eight-paths'] : largest ? ['all-five-paths'] : ['reference', 'tight-expanded']) {
    const baseline = reference?.runs.find(run => run.name === name)?.baseline ??
      runMountStream({...settings, name, deterministicFloor: false, mountGainCuts: !eightPaths,
        auditGain: auditGain && eightPaths});
    progress(name, 'baseline', baseline);
    assert.equal(baseline.normVersion, 'binary64-normalized-hypot-v1');
    assert.equal(baseline.gainPrunes, 0);
    if (auditGain && eightPaths) assert.equal(baseline.audited, baseline.prepared);
    const bounded = runMountStream({...settings, name, reference: baseline,
      auditGain: auditGain && name === 'reference'});
    progress(name, 'bounded', bounded);
    if (eightPaths) {
      const scorer = createChartPreset(deterministicNorm);
      const stockLoss = scorer.score(scorer.baseline);
      for (const key of ['maximum', 'minimum', 'balanced']) {
        assert.equal(bounded.outputs[key].gain, baseline.outputs[key].gain);
        assert.equal(bounded.outputs[key].cost, baseline.outputs[key].cost);
        for (const result of [baseline.outputs[key], bounded.outputs[key]]) {
          const build = resolve(result.config);
          assert.deepEqual(build.config, result.config);
          const cost = build.mounted.filter(part => part.source === 'equipped')
            .reduce((sum, part) => sum + shop.partCosts[part.itemId], 0);
          assert.equal(cost, result.cost);
          assert.equal(stockLoss - scorer.score(scorer.raw(build, result.tunes)), result.gain);
        }
      }
    } else {
      assert.deepEqual(bounded.outputs, baseline.outputs);
    }
    assert(bounded.gainPrunes > 0 && bounded.prepared < baseline.prepared);
    if (bounded.gainAudit) {
      assert.equal(bounded.audited, baseline.prepared);
      assert.equal(bounded.gainAudit.omitted, baseline.prepared - bounded.prepared);
    }
    runs.push({name, baseline, bounded});
  }
  return {runs};
}

if (import.meta.main) console.log(JSON.stringify(compareDeterministicNorm({
  largest: process.argv.includes('--largest'),
  eightPaths: process.argv.includes('--eight-paths'),
  progress: (name, variant, result) => console.error(
    name + ' ' + variant + ' completed, ' + result.prepared + ' layouts, ' +
    result.solveMs.toFixed(1) + ' ms'),
}), null, 2));
