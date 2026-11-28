import {assert} from './chart-fixture-runtime.mjs?v=303ab3f6a4af69e9';
import {runMountStream} from './m4-chart-mount-stream.mjs?v=303ab3f6a4af69e9';
import {createChartPreset, pack, resolve, shop, modules} from './m4-chart-axis-boxes.mjs?v=303ab3f6a4af69e9';
import {deterministicNorm} from './deterministic-norm.mjs?v=303ab3f6a4af69e9';

export function runFullOrdinaryPhase(options) {
  return runMountStream({name: 'full-ordinary', fast: true, cachePreparation: true,
    budgetBound: true, gainBound: true, nativeChartIntervals: true, nativeStatIntervals: true,
    nativeContexts: true, portableScore: true, deterministic: true, auditMounts: false,
    priorityPaths: ['38', '2', '2/6', '1', '3', '4', '4/8'],
    guaranteedMinimumBound: true, minimumShare: 0.6,
    gainCacheOptions: {maxEntries: 32768, maxKeyChars: 8 * 1024 * 1024, refreshCache: true},
    ...options});
}

export function solveFullOrdinary({seedRows = [], deadlineMs = Infinity, progress, largeGainCache = false, orderedSearch = false, incremental = false, tradeoff = false, balancedDeadlineMs = Infinity, minimumShare = 0.6} = {}) {
  const started = performance.now();
  const options = {seedRows, deadlineMs, minimumShare,
    progress: progress && (state => progress({...state, phase: 'endpoints'})),
    priorityPaths: orderedSearch ? ['38', '2', '2/6', '1', '3', '4', '4/8'] : [],
    guaranteedMinimumBound: orderedSearch,
    gainCacheOptions: largeGainCache ? {maxEntries: 32768, maxKeyChars: 8 * 1024 * 1024, refreshCache: true} : undefined};
  const endpoints = runFullOrdinaryPhase(options);
  const {maximum, minimum} = endpoints.outputs;
  const remaining = deadlineMs - (performance.now() - started);
  const window = endpoints.proven.maximum && endpoints.proven.minimum
    ? {min: minimum.cost, max: maximum.cost, gainFloor: minimum.gain, incremental} : null;
  if (window && tradeoff && window.max > window.min) {
    window.tradeoffSlope = (maximum.gain - minimum.gain) / (window.max - window.min);
  }
  const middle = window && remaining > 0 ? runFullOrdinaryPhase({...options, balancedWindow: window,
    seedRows: [...seedRows, endpoints.outputs.balanced].filter(Boolean),
    progress: progress && (state => progress({...state, phase: 'balanced'})),
    deadlineMs: Math.min(remaining, balancedDeadlineMs)}) : null;
  const result = {...endpoints, elapsedMs: performance.now() - started,
    pending: endpoints.pending + (middle?.pending ?? (window ? 1 : 0)),
    outputs: {maximum, minimum, balanced: middle?.outputs.balanced ?? null},
    proven: {...endpoints.proven, balanced: middle?.proven.balanced ?? false},
    certificate: {...endpoints.certificate, upperEfficiency: middle?.certificate.upperEfficiency ?? null},
    minimumShare, minimumThreshold: endpoints.proven.maximum ? maximum.gain * minimumShare : null,
    balancedWindow: window, middle};
  assert.equal(result.expectedMountCount, '12268642');
  const scorer = createChartPreset(deterministicNorm);
  const stockLoss = scorer.score(scorer.baseline);
  for (const row of Object.values(result.outputs)) {
    if (!row) continue;
    const build = resolve(row.config);
    assert.deepEqual(row.config, build.config);
    assert(build.config.some(part => part.slotPath === '11' && part.itemId === '13110000091'));
    const cost = build.mounted.filter(part => part.source === 'equipped')
      .reduce((sum, part) => sum + shop.partCosts[part.itemId], 0);
    assert.equal(cost, row.cost);
    assert(cost <= 800);
    if (row === result.outputs.balanced) assert(window.min < cost && cost < window.max && row.gain > window.gainFloor);
    for (const [path, tunes] of Object.entries(row.tunes)) {
      const mounted = build.mounted.find(part => part.slotPath === path);
      for (const [id, value] of Object.entries(tunes)) {
        assert(modules.curves.n(modules.curves.c(pack, mounted, id)).includes(value));
      }
    }
    assert.equal(stockLoss - scorer.score(scorer.raw(build, row.tunes)), row.gain);
  }
  return result;
}

if (import.meta.main) {
  const {readFileSync} = await import('node:fs');
  const seedRows = ['m4-deterministic-norm-largest.json?v=303ab3f6a4af69e9', 'm4-active-control-study.json?v=303ab3f6a4af69e9']
    .flatMap(file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8')).runs)
    .flatMap(run => Object.values(run.bounded.outputs));
  const limit = process.argv.find(arg => arg.startsWith('--deadline-ms='));
  console.log(JSON.stringify(solveFullOrdinary({seedRows,
    largeGainCache: process.argv.includes('--large-gain-cache'),
    orderedSearch: process.argv.includes('--ordered-search'),
    incremental: process.argv.includes('--incremental-balanced'),
    tradeoff: process.argv.includes('--tradeoff-balanced'),
    minimumShare: Number(process.argv.find(arg => arg.startsWith('--minimum-share='))?.split('=')[1] ?? 0.6),
    deadlineMs: limit ? Number(limit.slice('--deadline-ms='.length)) : Infinity,
    progress: state => console.error(JSON.stringify(state)),
  }), null, 2));
}
