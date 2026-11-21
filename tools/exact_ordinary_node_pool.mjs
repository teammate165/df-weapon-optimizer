import {readFile} from 'node:fs/promises';
import {availableParallelism} from 'node:os';
import {Worker} from 'node:worker_threads';
import {combineExactOrdinaryShards, planExactOrdinaryPartitions, runExactOrdinaryPhases} from './exact_ordinary.mjs';

export async function runExactOrdinaryNodePool(input, modules, runtime, {
  workers = Math.min(4, availableParallelism()),
  jobs = workers,
  staged = false,
} = {}) {
  const start = Date.now();
  if (staged && !input.solver_starts && input.pack.weaponId === '18010000038' && input.request.mode === 'bd') {
    try {
      input = {...input, solver_starts: JSON.parse(await readFile(
        new URL('../data/solver_starts/18010000038.json', import.meta.url), 'utf8'))};
    } catch {
      // The stock search can still proceed if the start catalog is unavailable.
    }
  }
  const limit = input.request.time_limit_seconds ?? 30;
  const deadlineEpochMs = limit === 0 ? Infinity : start + limit * 1000;
  const partitions = planExactOrdinaryPartitions(input, modules, {workers, jobs, staged});
  const {signal, onProgress, ...payload} = input;
  signal?.throwIfAborted();
  const cap = payload.request.mode === 'bd' ? (payload.request.budget ??
    payload.request.budgets?.[0] ?? payload.shop.weapons[payload.pack.weaponId]?.gunsmithLimit) : null;
  const slots = Number.isSafeInteger(cap) && cap >= 0 && cap < 100000 ? cap + 2 : 1;
  const allFailures = new Map();
  const passTimes = new Map();
  async function runPass(phase) {
    signal?.throwIfAborted();
    if (Date.now() >= deadlineEpochMs && phase) return [];
    const passStart = performance.now();
    const incumbentBuffer = new SharedArrayBuffer(slots * BigUint64Array.BYTES_PER_ELEMENT);
    const active = new Set();
    const reports = [];
    const failures = new Map();
    const snapshots = new Map();
    let timer, lastProgress = start, abort;
    let cursor = 0, closed = false;
    const runWorker = () => new Promise(resolve => {
      let partition, worker;
      const fail = error => {
        if (partition && !closed) failures.set(partition.id, error.message ?? String(error));
        partition = undefined;
        resolve();
      };
      const next = () => {
        if (closed || signal?.aborted || Date.now() >= deadlineEpochMs || cursor >= partitions.length) {
          partition = undefined;
          resolve();
          return;
        }
        partition = partitions[cursor++];
        try {
          worker.postMessage(partition);
        } catch (error) {
          fail(error);
        }
      };
      try {
        worker = new Worker(new URL('./exact_ordinary_thread.mjs', import.meta.url), {
          workerData: {input: payload, runtime: runtime.href, deadlineEpochMs, incumbentBuffer, phase,
            progress: Boolean(onProgress)},
          execArgv: process.execArgv.filter(arg => !arg.startsWith('--input-type')),
        });
      } catch (error) {
        partition = partitions[cursor++];
        fail(error);
        return;
      }
      active.add(worker);
      worker.on('error', fail);
      worker.on('exit', code => fail(Error(`Exact ordinary worker exited before reporting (${code})`)));
      worker.on('message', message => {
        if (!partition || closed) return;
        if (message.result || message.error !== undefined) {
          if (message.result) {
            reports.push(message.result);
            const {solver} = message.result;
            snapshots.set(partition.id, {evaluated: solver.evaluated, tree_nodes: solver.nodes,
              candidates: message.result.price_archive.length, calibration_evaluations: solver.evaluated,
              best_loss: snapshots.get(partition.id)?.best_loss});
          } else failures.set(partition.id, message.error);
          next();
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
      next();
    });
    try {
      const races = [Promise.all(Array.from({length: Math.min(workers, partitions.length)}, runWorker))];
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
      closed = true;
      clearTimeout(timer);
      if (abort) signal.removeEventListener('abort', abort);
      await Promise.allSettled([...active].map(worker => worker.terminate()));
      passTimes.set(phase?.kind, performance.now() - passStart);
    }
  }
  const result = staged ? await runExactOrdinaryPhases(partitions, runPass, input, modules)
    : combineExactOrdinaryShards(partitions, await runPass(), input, modules);
  const passes = result.solver.phases ?? [result.solver];
  for (const pass of passes) {
    pass.workers = Math.min(workers, partitions.length);
    pass.partition_count = partitions.length;
    if (jobs > workers) pass.elapsed_ms = passTimes.get(pass.phase) ?? 0;
    for (const part of pass.partitions) {
      const error = allFailures.get(pass.phase)?.get(part.id);
      if (error) part.error = error;
    }
  }
  result.solver.workers = Math.min(workers, partitions.length);
  result.solver.partition_count = partitions.length;
  result.solver.elapsed_ms = Date.now() - start;
  return result;
}
