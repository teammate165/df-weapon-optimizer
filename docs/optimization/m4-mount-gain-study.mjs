import {nodeNormRuntime, v8NormFloorFor} from './v8-norm-floor.mjs';
import {assert} from './chart-fixture-runtime.mjs';
import {runMountStream} from './m4-chart-mount-stream.mjs';

export function compareCalibratedMountBounds({auditGain = true, nativeChartIntervals = false, nativeStatIntervals = false, nativeContexts = false, portableScore = false, normRuntime = null} = {}) {
  const runs = [];
  for (const name of ['reference', 'tight-expanded']) {
    const settings = {name, fast: true, cachePreparation: true, budgetBound: true};
    const baseline = runMountStream(settings);
    const bounded = runMountStream({...settings, reference: baseline, gainBound: true,
      auditMounts: false, nativeChartIntervals, nativeStatIntervals, nativeContexts, portableScore, normRuntime, auditGain: auditGain && name === 'reference'});
    assert.deepEqual(bounded.outputs, baseline.outputs);
    if (!portableScore || normRuntime) assert(bounded.gainPrunes > 0 && bounded.prepared < baseline.prepared);
    if (bounded.gainAudit) {
      assert.equal(bounded.audited, baseline.audited);
      assert.equal(bounded.gainAudit.omitted, baseline.prepared - bounded.prepared);
    }
    runs.push({name, baseline, bounded});
  }
  return {runs};
}
if (import.meta.main) {
  const v8Norm = process.argv.includes('--v8-norm-floor');
  const normRuntime = v8Norm ? nodeNormRuntime(process) : null;
  assert(!v8Norm || v8NormFloorFor(normRuntime), 'Run the audited Node binary with --jitless');
  const portableScore = v8Norm || process.argv.includes('--portable-score');
  const nativeContexts = portableScore || process.argv.includes('--native-contexts');
  const nativeStatIntervals = nativeContexts || process.argv.includes('--native-stat-intervals');
  const nativeChartIntervals = nativeStatIntervals || process.argv.includes('--native-chart-intervals');
  if (process.argv.includes('--largest')) {
    const {readFileSync} = await import('node:fs');
    const {runs: [reference]} = JSON.parse(readFileSync(
      new URL('./m4-chart-mount-stream-grouped.json', import.meta.url), 'utf8'));
    const result = runMountStream({name: 'all-five-paths', fast: true, cachePreparation: true,
      budgetBound: true, gainBound: true, nativeChartIntervals, nativeStatIntervals, nativeContexts, portableScore, normRuntime, auditMounts: false, reference});
    assert.deepEqual(result.outputs, reference.outputs);
    console.log(JSON.stringify({runs: [result]}, null, 2));
  } else {
    console.log(JSON.stringify(compareCalibratedMountBounds({nativeChartIntervals, nativeStatIntervals, nativeContexts, portableScore, normRuntime}), null, 2));
  }
}
