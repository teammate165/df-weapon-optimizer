import {availableParallelism} from 'node:os';
import {Worker} from 'node:worker_threads';
import {combineExactOrdinaryShards, planExactOrdinaryPartitions, runExactOrdinaryPhases} from './exact_ordinary.mjs';

export async function runExactOrdinaryNodePool(input, modules, runtime, {
  workers = Math.min(4, availableParallelism()),
  staged = false,
} = {}) {
  const start = Date.now();
  const limit = input.request.time_limit_seconds ?? 30;
  const deadlineEpochMs = limit === 0 ? Infinity : start + limit * 1000;
  const partitions = planExactOrdinaryPartitions(input, modules, {workers, staged});
  const {signal, onProgress, ...payload} = input;
  signal?.throwIfAborted();
  const cap = payload.request.mode === 'bd' ? (payload.request.budget ??
    payload.request.budgets?.[0] ?? payload.shop.weapons[payload.pack.weaponId]?.gunsmithLimit) : null;
  const slots = Number.isSafeInteger(cap) && cap >= 0 && cap < 100000 ? cap + 2 : 1;
  const allFailures = new Map();
  async function runPass(phase) {
    signal?.throwIfAborted();
    if (Date.now() >= deadlineEpochMs && phase) return [];
    const incumbentBuffer = new SharedArrayBuffer(slots * BigUint64Array.BYTES_PER_ELEMENT);
    const active = new Set();
    const reports = [];
    const failures = new Map();
    const snapshots = new Map();
    let timer, lastProgress = start, abort;
    const execute = partition => new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./exact_ordinary_thread.mjs', import.meta.url), {
        workerData: {input: payload, runtime: runtime.href, partition, deadlineEpochMs, incumbentBuffer, phase,
          progress: Boolean(onProgress)},
        execArgv: process.execArgv.filter(arg => !arg.startsWith('--input-type')),
      });
      active.add(worker);
      let reported = false;
      const fail = error => {
        failures.set(partition.id, error.message);
        reject(error);
      };
      worker.on('error', fail);
      worker.on('exit', code => {
        if (!reported) fail(Error(`Exact ordinary worker exited before reporting (${code})`));
      });
      worker.on('message', message => {
        if (message.result) {
          reported = true;
          reports.push(message.result);
          resolve();
        } else if (message.progress) {
          snapshots.set(partition.id, message.progress);
          const now = Date.now();
          if (now - lastProgress < 250) return;
          lastProgress = now;
          const rows = [...snapshots.values()];
          const sum = key => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
          const best = Math.min(...rows.map(row => row.best_loss ?? Infinity));
          onProgress?.({phase: 'exact_ordinary', category: phase?.kind, evaluated: sum('evaluated'), tree_nodes: sum('tree_nodes'),
            candidates: sum('candidates'), calibration_evaluations: sum('calibration_evaluations'),
            best_loss: Number.isFinite(best) ? best : null, scored_per_second: sum('evaluated') * 1000 / (now - start)});
        }
      });
    });
    try {
      const races = [Promise.allSettled(partitions.map(partition => execute(partition).catch(error => {
        if (!failures.has(partition.id)) failures.set(partition.id, error.message);
        throw error;
      })))];
      if (Number.isFinite(deadlineEpochMs)) races.push(new Promise(resolve => {
        // Allow workers to deliver their partial archives after the shared deadline.
        timer = setTimeout(resolve, Math.max(0, deadlineEpochMs - Date.now()) + 1500);
      }));
      if (signal) races.push(new Promise((_, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, {once: true});
        if (signal.aborted) abort();
      }));
      await Promise.race(races);
      if (!reports.length && failures.size && (!phase || phase.kind === 'maximum')) {
        throw Error(failures.values().next().value);
      }
      allFailures.set(phase?.kind, failures);
      return reports;
    } finally {
      clearTimeout(timer);
      if (abort) signal.removeEventListener('abort', abort);
      await Promise.allSettled([...active].map(worker => worker.terminate()));
    }
  }
  const result = staged ? await runExactOrdinaryPhases(partitions, runPass, input, modules)
    : combineExactOrdinaryShards(partitions, await runPass(), input, modules);
  const passes = result.solver.phases ?? [result.solver];
  for (const pass of passes) for (const part of pass.partitions) {
    const error = allFailures.get(pass.phase)?.get(part.id);
    if (error) part.error = error;
  }
  result.solver.elapsed_ms = Date.now() - start;
  return result;
}
