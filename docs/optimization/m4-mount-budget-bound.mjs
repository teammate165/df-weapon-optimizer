import {assert} from './chart-fixture-runtime.mjs';
import {runMountStream} from './m4-chart-mount-stream.mjs';

export function compareMountBounds() {
  const runs = [];
  for (const name of ['reference', 'tight-expanded']) {
    const settings = {name, fast: true, cachePreparation: true};
    const baseline = runMountStream(settings);
    const bounded = runMountStream({...settings, reference: baseline, budgetBound: true});
    assert.equal(bounded.audited, baseline.audited);
    assert.deepEqual(bounded.outputs, baseline.outputs);
    assert.equal(bounded.bounds, baseline.bounds);
    assert.equal(bounded.scores, baseline.scores);
    assert(bounded.budgetPrunes > 0);
    assert(bounded.mountNodes < baseline.mountNodes);
    runs.push({name, baseline, bounded});
  }
  return {runs};
}
if (import.meta.main) console.log(JSON.stringify(compareMountBounds(), null, 2));
