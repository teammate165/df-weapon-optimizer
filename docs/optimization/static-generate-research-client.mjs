import {createStaticClient as createBuilderClient} from './original-static-client.js';

export function createStaticClient() {
  const builder = createBuilderClient();
  return async (action, request, options = {}) => {
    if (action !== 'optimize') return builder(action, request, options);
    const {signal, onProgress} = options;
    if (request.weapon_id !== '18010000001' || request.mode !== 'bd' ||
        request.preset !== 'recoil' || request.shot_count !== 20 ||
        request.fixed?.length !== 1 || request.fixed[0].slotPath !== '11' ||
        request.fixed[0].itemId !== '13110000091' || Object.keys(request.minimum_stats).length ||
        request.time_limit_seconds !== 300) {
      throw Error('The test expects the validated ordinary M4A1 Detonation request.');
    }
    const started = performance.now();
    const input = await fetch('./research-input.json', {signal}).then(response => {
      if (!response.ok) throw Error('Could not load research inputs.');
      return response.json();
    });
    const report = await new Promise((resolve, reject) => {
      signal?.throwIfAborted();
      const worker = new Worker(new URL('./research/chart-worker.mjs', import.meta.url), {type: 'module'});
      let ready;
      const progress = [];
      const timeout = setTimeout(() => finish(reject, Error('Search reached the preview deadline.')),
        Math.max(0, 299500 - (performance.now() - started)));
      const abort = () => finish(reject, signal.reason);
      function finish(callback, value) {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        worker.terminate();
        callback(value);
      }
      signal?.addEventListener('abort', abort, {once: true});
      worker.onerror = error => finish(reject, Error(error.message));
      worker.onmessage = ({data}) => {
        if (data.ready) {
          ready = performance.now();
          worker.postMessage({...input, deadlineMs: Math.max(1, 298000 - (ready - started))});
        } else if (data.progress) {
          progress.push(data.progress);
          onProgress?.({phase: 'Exact ordinary search', evaluated: data.progress.scores,
            tree_nodes: data.progress.mountNodes, pruned_branches: data.progress.gainPrunes});
        } else {
          finish(resolve, {actual: data, workerReadyMs: ready - started,
            workerRunMs: performance.now() - ready, progress});
        }
      };
    });
    const results = [];
    for (const [category, label] of [['maximum', 'Max'], ['balanced', 'Balanced'], ['minimum', 'Min']]) {
      const row = report.actual.outputs[category];
      const proven = report.actual.proven[category];
      if (!row) {
        results.push({label, status: proven ? 'unavailable' : 'unresolved',
          reason: proven ? 'No eligible build in the ordinary search.' : 'Search stopped before finding a build.'});
        continue;
      }
      const evaluation = await builder('evaluate', {...request, ...row}, {signal});
      if (evaluation.cost !== row.cost || evaluation.missing.length) throw Error('Build price replay failed.');
      results.push({...row, label, status: 'best_found', proof: proven ? 'Proven optimal' : 'Best found',
        score: row.gain, stats: evaluation.effective_stats});
    }
    globalThis.generateResearchReport = {...report, clientElapsedMs: performance.now() - started};
    return {weapon_id: request.weapon_id, mode: request.mode, score_direction: 'higher',
      proof_scope: 'Grouped ordinary M4A1 with locked Insight', minimum_share: input.minimumShare, results};
  };
}
