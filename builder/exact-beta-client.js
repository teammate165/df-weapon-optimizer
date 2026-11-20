import {balancedWindow, combineBalanced, combineEndpoints, sharedBalancedSeed} from './exact-beta-pool.js';

const scope = 'Grouped ordinary M4A1 Detonation with Insight 3/7 locked';

export function exactBetaEligible(request) {
  const {fixed, minimum_stats: floors} = request;
  return request.weapon_id === '18010000001' && request.mode === 'bd' &&
    request.preset === 'recoil' && request.shot_count === 20 && request.time_limit_seconds === 300 &&
    fixed?.length === 1 && fixed[0].slotPath === '11' && fixed[0].itemId === '13110000091' &&
    !Object.keys(floors ?? {}).length && request.budget === undefined &&
    request.budgets === undefined && request.effectiveness_targets === undefined &&
    request.pattern_reduction_percent === undefined;
}

export async function runExactBeta(evaluate, request, {signal, onProgress} = {}) {
  const deadline = performance.now() + 300000;
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  const clock = setTimeout(() => controller.abort(Error('The exact search reached its deadline.')), 300000);
  signal?.addEventListener('abort', cancel, {once: true});
  if (signal?.aborted) cancel();
  const {signal: searchSignal} = controller;
  try {
    const workerCount = 4;
    const progress = new Map();
    const workers = [];
    function spawn(index) {
      const worker = new Worker(new URL('./exact-beta-worker.js', import.meta.url), {type: 'module'});
      let pending;
      let failure;
      let stopped = false;
      const receive = () => new Promise((resolve, reject) => {
        if (failure) { reject(failure); return; }
        pending = {resolve, reject};
      });
      const ready = receive();
      ready.catch(() => {}); // A later Worker constructor can fail before the pool awaits readiness.
      const fail = error => {
        failure = error;
        pending?.reject(error);
        pending = undefined;
      };
      worker.onerror = event => fail(Error(event.message || 'Exact Worker failed.'));
      worker.onmessageerror = () => fail(Error('Exact Worker message failed.'));
      worker.onmessage = ({data}) => {
        if (data.progress) {
          const p = data.progress;
          progress.set(index, p);
          const sum = key => [...progress.values()].reduce((total, row) => total + row[key], 0);
          onProgress?.({phase: p.phase === 'balanced' ? 'Proving Balanced' : 'Proving Maximum and Minimum',
            evaluated: sum('scores'), tree_nodes: sum('mountNodes'), pruned_branches: sum('gainPrunes'),
            workers: workerCount});
        } else if (data.error) {
          fail(Error(data.error));
        } else {
          pending?.resolve(data);
          pending = undefined;
        }
      };
      const stop = () => {
        if (stopped) return;
        stopped = true;
        worker.terminate();
        fail(searchSignal.reason ?? Error('Exact Worker stopped.'));
      };
      searchSignal.addEventListener('abort', stop, {once: true});
      workers.push({ready, stop: () => {
        searchSignal.removeEventListener('abort', stop);
        stop();
      }, request: payload => {
        searchSignal.throwIfAborted();
        const response = receive();
        if (!failure) {
          try { worker.postMessage(payload); } catch (error) { fail(error); }
        }
        return response;
      }});
    }
    let result;
    let partitionStats;
    let sharedSeed;
    try {
      searchSignal.throwIfAborted();
      for (let index = 0; index < workerCount; index++) spawn(index);
      await Promise.all(workers.map(worker => worker.ready));
      const {plan} = await workers[0].request({partitionCount: workerCount});
      const remaining = () => Math.max(1, deadline - performance.now() - 2000);
      const dispatch = payload => Promise.all(workers.map(async (worker, index) => {
        const {result: shard} = await worker.request({...payload, partition: plan[index], deadlineMs: remaining()});
        return shard;
      }));
      const endpoints = await dispatch({phase: 'endpoints'});
      result = combineEndpoints(endpoints, 0.6);
      const window = balancedWindow(result);
      const seed = window && sharedBalancedSeed(result.archive, window);
      if (seed) sharedSeed = {cost: seed.cost, gain: seed.gain};
      let middle;
      if (window && remaining() > 1) {
        progress.clear();
        middle = await dispatch({phase: 'balanced', balancedWindow: window, balancedSeed: seed});
        result = combineBalanced(result, middle, window);
      }
      partitionStats = plan.map(({layouts}, index) => ({
        layouts, endpointNodes: endpoints[index].mountNodes, endpointMs: endpoints[index].elapsedMs,
        balancedNodes: middle?.[index].mountNodes, balancedMs: middle?.[index].elapsedMs,
      }));
    } finally {
      for (const worker of workers) worker.stop();
    }
    const results = [];
    for (const [category, label] of [['maximum', 'Max'], ['balanced', 'Balanced'], ['minimum', 'Min']]) {
      const row = result.outputs[category];
      const proven = result.proven[category];
      if (!row) {
        results.push({label, status: proven ? 'unavailable' : 'unresolved',
          reason: proven ? 'No eligible build in the ordinary search.' : 'The search ended before a build could be established.'});
        continue;
      }
      const replay = await evaluate({...request, ...row}, searchSignal);
      if (replay.cost !== row.cost || replay.missing.length ||
          JSON.stringify(replay.build.config) !== JSON.stringify(row.config)) throw Error('Exact build replay failed.');
      for (const [path, tunes] of Object.entries(row.tunes)) {
        for (const [id, value] of Object.entries(tunes)) {
          if (replay.tunes[path]?.[id] !== value) throw Error('Exact calibration replay failed.');
        }
      }
      results.push({...row, label, status: 'best_found', proof: proven ? 'Proven optimal' : 'Best found',
        score: row.gain, stats: replay.effective_stats});
    }
    return {weapon_id: request.weapon_id, mode: request.mode, score_direction: 'higher',
      proof_scope: scope, cheapest_gate_percent: result.minimumShare * 100, results,
      solver: {name: 'Exact ordinary beta', elapsed_ms: 300000 - (deadline - performance.now()),
        proven: result.proven, pending: result.pending, certificate: result.certificate,
        workers: workerCount, partitions: partitionStats, sharedBalancedSeed: sharedSeed}};
  } finally {
    clearTimeout(clock);
    signal?.removeEventListener('abort', cancel);
  }
}
