import {parentPort, workerData} from 'node:worker_threads';
import {solveExactOrdinary} from './exact_ordinary.mjs';
import {sharedExactIncumbents} from './exact_ordinary_incumbents.mjs';

const {input, runtime, deadlineEpochMs, incumbentBuffer, phase, progress} = workerData;
const [curves, kernel, {t: calculate}] = await Promise.all(['curves', 'kernel', 'attributes']
  .map(name => import(new URL(name + '.mjs', runtime))));
if (progress) input.onProgress = event => parentPort.postMessage({progress: event});
const sharedIncumbents = sharedExactIncumbents(incumbentBuffer);
parentPort.on('message', partition => {
  try {
    const result = solveExactOrdinary(input, {curves, kernel, calculate}, {
      partition, phase, deadlineEpochMs, collectArchive: true, sharedIncumbents,
    });
    parentPort.postMessage({result});
  } catch (error) {
    parentPort.postMessage({error: error?.message ?? String(error)});
  }
});
