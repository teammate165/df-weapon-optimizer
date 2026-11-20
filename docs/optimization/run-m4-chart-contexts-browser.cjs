const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {readFileSync} = require('node:fs');
const {extname, join, resolve, sep} = require('node:path');
const {chromium, firefox} = require('../../.scratch/browser-qa/node_modules/playwright');

const directory = resolve(__dirname, '../..');
const sampled = process.argv.includes('--sampled');
const streamArg = process.argv.find(arg => arg.startsWith('--stream='));
const streamName = streamArg?.slice('--stream='.length);
const cachePreparation = process.argv.includes('--cache-preparation');
const fast = cachePreparation || process.argv.includes('--fast');
const mountScaling = process.argv.includes('--mount-scaling');
const orderedAxes = process.argv.includes('--ordered-axes');
const budgetStudy = process.argv.includes('--budget-study');
const gainStudy = process.argv.includes('--gain-study');
const activeStudy = process.argv.includes('--active-control-study');
const fullOrdinary = process.argv.includes('--full-ordinary');
const staticArg = process.argv.find(arg => arg.startsWith('--static-export='));
const generate = process.argv.includes('--generate');
const replayGenerate = process.argv.includes('--replay-generate');
assert(!replayGenerate || generate);
const cancelGenerate = process.argv.includes('--cancel-generate');
const generateDeadlineTest = process.argv.includes('--generate-deadline-test');
const mobileViewport = process.argv.includes('--mobile-viewport');
assert(!generateDeadlineTest || (generate && !cancelGenerate && !replayGenerate));
assert(!cancelGenerate || generate);
const staticExport = staticArg && resolve(staticArg.slice('--static-export='.length));
assert(!staticExport || fullOrdinary);
assert(!generate || staticExport);
const preview = '/preview/';
const lifecycle = process.argv.includes('--lifecycle');
const largeGainCache = process.argv.includes('--large-gain-cache');
const orderedSearch = process.argv.includes('--ordered-search');
const incremental = process.argv.includes('--incremental-balanced');
const tradeoff = process.argv.includes('--tradeoff-balanced');
const minimumShare = Number(process.argv.find(arg => arg.startsWith('--minimum-share='))?.split('=')[1] ?? 0.6);
assert(minimumShare > 0 && minimumShare <= 1);
function tradeoffReference() {
  assert(minimumShare === 0.5 || minimumShare === 0.6);
  return require(minimumShare === 0.6
    ? './m4-generate-60-chrome.json' : './m4-balanced-tradeoff-chrome.json').result;
}
const deadlineArg = process.argv.find(arg => arg.startsWith('--deadline-ms='));
const deadlineMs = deadlineArg ? Number(deadlineArg.slice('--deadline-ms='.length)) : Infinity;
const deterministicStudy = process.argv.includes('--deterministic-norm');
const balancedDeadlineArg = process.argv.find(arg => arg.startsWith('--balanced-deadline-ms='));
const balancedDeadlineMs = balancedDeadlineArg ? Number(balancedDeadlineArg.split('=')[1]) : Infinity;
assert(balancedDeadlineMs > 0);
const useFirefox = process.argv.includes('--firefox');
assert(!useFirefox || deterministicStudy || fullOrdinary);
const largestDeterministic = deterministicStudy && process.argv.includes('--largest');
const eightPaths = deterministicStudy && process.argv.includes('--eight-paths');
const gainBound = process.argv.includes('--gain-bound');
const v8Norm = process.argv.includes('--v8-norm-floor');
const jitless = v8Norm || process.argv.includes('--jitless');
const compareConservative = v8Norm && gainBound && streamName === 'all-five-paths';
const portableScore = v8Norm || process.argv.includes('--portable-score');
const nativeContexts = portableScore || process.argv.includes('--native-contexts');
const nativeStatIntervals = nativeContexts || process.argv.includes('--native-stat-intervals');
const nativeChartIntervals = nativeStatIntervals || process.argv.includes('--native-chart-intervals');
const groupedReference = streamName === 'all-five-paths' && cachePreparation;
const streamPath = './m4-chart-mount-stream' + (streamName === 'all-five-paths' ? '-largest' : '') +
  (fast ? '-fast' : '') + '.json';
const gainFile = name => './m4-mount-gain-' + name +
  (v8Norm ? '-v8-norm' : portableScore ? '-portable-score' : nativeContexts ? '-native-contexts' : nativeStatIntervals ? '-native-stats' : nativeChartIntervals ? '-native-chart' : '') + '.json';
const referencePath = fullOrdinary ? null : activeStudy ? './m4-active-control-study.json' : deterministicStudy ?
  (eightPaths ? './m4-deterministic-norm-eight-paths.json' : largestDeterministic ?
    './m4-mount-gain-largest-portable-score.json' : './m4-deterministic-norm-study.json') :
  compareConservative ? './m4-mount-gain-largest-portable-score.json' : gainBound ? gainFile('largest') : gainStudy ? gainFile('study') : budgetStudy ? './m4-mount-budget-bound.json' : streamName ?
  (groupedReference ? './m4-chart-mount-stream-grouped.json' : streamPath) :
  mountScaling ?
    ('./m4-chart-mount-scaling' + (sampled ? '' : '-full') + (orderedAxes ? '-ordered-axes' : '') + '.json') :
    (sampled ? './m4-chart-contexts-wide.json' : './m4-chart-contexts-full.json');
const recorded = referencePath ? require(referencePath) : null;
const expected = streamName ? recorded.runs.find(run => run.name === streamName) : recorded;
assert(fullOrdinary || expected);
const paths = [
  ...['category-search', 'chart-fixture-runtime', 'ordered-axis-intervals', 'm4-active-controls', 'deterministic-norm', 'm4-chart-axis-boxes', 'm4-chart-contexts']
    .map(name => 'docs/optimization/' + name + '.mjs'),
  ...['timed_recoil', 'optimizer_presets', 'horizontal_speed', 'scoring_bounds', 'optimizer_policy', 'branch_score_bounds', 'branch_native_ranges']
    .map(name => 'tools/' + name + '.mjs'),
  ...['attributes', 'curves', 'kernel', 'laser_effects']
    .map(name => '.scratch/calibration-check/' + name + '.mjs'),
  '.scratch/github-pages-site/data/weapons/18010000001.json',
  '.scratch/github-pages-site/data/catalog.json',
  ...(mountScaling || streamName || budgetStudy || gainStudy || deterministicStudy || activeStudy || fullOrdinary ? [
    'docs/optimization/m4-chart-mount-scaling.mjs',
    'docs/optimization/m4-chart-mount-stream.mjs',
    'docs/optimization/m4-mount-budget-bound.mjs',
    'docs/optimization/m4-mount-gain-study.mjs',
    'docs/optimization/m4-calibrated-mount-bound.mjs',
    'docs/optimization/v8-norm-floor.mjs',
    'docs/optimization/deterministic-norm.mjs',
    'docs/optimization/m4-deterministic-norm-study.mjs',
    'docs/optimization/m4-active-control-study.mjs',
    'docs/optimization/m4-full-ordinary-study.mjs',
    ...['scip_mount_model', 'scip_linear_model', 'optimizer_mounts', 'mount_search', 'choice_groups']
      .map(name => 'tools/' + name + '.mjs'),
  ] : []),
];
const seedRows = fullOrdinary ? ['m4-deterministic-norm-largest.json', 'm4-active-control-study.json']
  .flatMap(file => require('./' + file).runs).flatMap(run => Object.values(run.bounded.outputs)) : [];
const assets = new Map(paths.map(path => ['/' + path, readFileSync(join(directory, path))]));
const workerModule = fullOrdinary ? 'm4-full-ordinary-study' : activeStudy ? 'm4-active-control-study' : deterministicStudy ? 'm4-deterministic-norm-study' : gainStudy ? 'm4-mount-gain-study' : budgetStudy ? 'm4-mount-budget-bound' : streamName ? 'm4-chart-mount-stream' : mountScaling ? 'm4-chart-mount-scaling' : 'm4-chart-contexts';
const workerFunction = fullOrdinary ? 'solveFullOrdinary' : activeStudy ? 'compareActiveControls' : deterministicStudy ? 'compareDeterministicNorm' : gainStudy ? 'compareCalibratedMountBounds' : budgetStudy ? 'compareMountBounds' : streamName ? 'runMountStream' : mountScaling ? 'benchmarkMountScaling' : 'benchmarkContexts';
const workerOptions = fullOrdinary ?
  '{seedRows: data.seedRows, deadlineMs: data.deadlineMs, largeGainCache: data.largeGainCache, orderedSearch: data.orderedSearch, incremental: data.incremental, tradeoff: data.tradeoff, minimumShare: data.minimumShare, balancedDeadlineMs: data.balancedDeadlineMs, progress: state => postMessage({progress: state})}' :
  activeStudy ? '{audit: false}' : deterministicStudy ? '{largest: data.largestDeterministic, eightPaths: data.eightPaths, auditGain: false}' : gainStudy ? '{auditGain: false, nativeChartIntervals: data.nativeChartIntervals, nativeStatIntervals: data.nativeStatIntervals, nativeContexts: data.nativeContexts, portableScore: data.portableScore, normRuntime: data.normRuntime}' : budgetStudy ? '{}' : streamName ?
  '{name: data.streamName, reference: data.streamReference, auditMounts: false, fast: data.fast, cachePreparation: data.cachePreparation, budgetBound: data.gainBound, gainBound: data.gainBound, nativeChartIntervals: data.nativeChartIntervals, nativeStatIntervals: data.nativeStatIntervals, nativeContexts: data.nativeContexts, portableScore: data.portableScore, normRuntime: data.normRuntime}' : mountScaling ?
  '{fullGrid: !data.sampled, reference: data.reference, expectedLayouts: data.expectedLayouts, orderedAxes: data.orderedAxes}' :
  '{wide: true, wideFull: !data.sampled, reference: data.reference}';
const worker = [
  "import {" + workerFunction + "} from './docs/optimization/" + workerModule + ".mjs';",
  'postMessage({ready: true});',
  'onmessage = ({data}) => postMessage(' + workerFunction + '(' + workerOptions + '));',
].join('\n');
const server = createServer(({method, url}, response) => {
  const pathname = new URL(url, 'http://localhost').pathname;
  const researchPrefix = preview + 'research';
  if (generate && method === 'GET' && pathname === preview + 'static-client.js') {
    return response.writeHead(200, {'Content-Type': 'text/javascript'})
      .end(readFileSync(join(__dirname, 'static-generate-research-client.mjs')));
  }
  if (generate && method === 'GET' && pathname === preview + 'research-input.json') {
    return response.writeHead(200, {'Content-Type': 'application/json'})
      .end(JSON.stringify({seedRows, largeGainCache: true, orderedSearch: true, tradeoff: true, minimumShare}));
  }
  if (staticExport && pathname.startsWith(researchPrefix + '/')) {
    url = pathname.slice(researchPrefix.length);
  } else if (staticExport && pathname.startsWith(preview)) {
    if (method !== 'GET') return response.writeHead(405).end();
    const path = resolve(staticExport, (pathname === preview + 'original-static-client.js' ? 'static-client.js' : pathname.slice(preview.length)) || 'index.html');
    if (!path.startsWith(staticExport + sep)) return response.writeHead(404).end();
    const type = {'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm'}[extname(path)];
    try {
      const data = readFileSync(path);
      return response.writeHead(200, {'Content-Type': type ?? 'application/octet-stream'}).end(data);
    } catch {
      return response.writeHead(404).end();
    }
  }
  if (method !== 'GET') return response.writeHead(405).end();
  if (url === '/') return response.end('<!doctype html><title>Chart context benchmark</title>');
  if (url === '/chart-worker.mjs') {
    const fixture = replayGenerate && tradeoffReference();
    let source = worker;
    if (fixture) {
      source = 'postMessage({ready: true}); onmessage = () => { postMessage({progress: {}}); setTimeout(() => postMessage(' +
        JSON.stringify(fixture) + '), 1000); };';
    } else if (generateDeadlineTest) {
      const throttledProgress = `state => {
        postMessage({progress: state});
        if (state.phase !== 'balanced') return;
        const stallUntil = Math.min(performance.now() + 4000, deadline);
        while (performance.now() < stallUntil) {}
      }`;
      source = worker.replace('({data}) => postMessage(',
        '({data}) => { const deadline = performance.now() + data.deadlineMs; postMessage(')
        .replace('state => postMessage({progress: state})', throttledProgress) + ' }';
      assert(source.includes('stallUntil'));
    }
    return response.writeHead(200, {'Content-Type': 'text/javascript'}).end(source);
  }
  const data = staticExport && url.startsWith('/.scratch/github-pages-site/data/')
    && assets.has(url) ? readFileSync(join(staticExport, url.slice('/.scratch/github-pages-site/'.length)))
    : assets.get(url);
  if (!data) return response.writeHead(404).end();
  const type = url.endsWith('.json') ? 'application/json' : 'text/javascript';
  response.writeHead(200, {'Content-Type': type}).end(data);
});
async function runGenerate(page) {
  await page.locator('[data-slot="11"]').click();
  await page.locator('[data-part="13110000091"]').dblclick();
  await page.waitForSelector('[data-part="13110000091"].equipped');
  await page.locator('#optimizer-tab').click();
  await page.locator('#lock').click();
  await page.locator('#solver-time-limit').evaluate(select => {
    select.add(new Option('300s preview', '300'));
    select.value = '300';
  });
  const start = performance.now();
  await page.locator('#generate').click();
  await page.waitForSelector('#cancel-generate:visible');
  await page.waitForFunction(() => document.querySelector('#results').textContent.includes('Exact ordinary search'),
    null, {timeout: 30000});
  const firstSearchProgressMs = performance.now() - start;
  if (cancelGenerate) {
    await page.locator('#cancel-generate').click();
    await page.waitForFunction(() => !document.querySelector('#generate').disabled);
    assert.match(await page.locator('#results').textContent(), /Search cancelled/);
    assert.equal(await page.locator('#results [data-apply]').count(), 0);
    assert.equal(await page.evaluate(() => Boolean(globalThis.generateResearchReport)), false);
    return {cancelled: true, firstSearchProgressMs, elapsedMs: performance.now() - start};
  }
  await page.waitForSelector('#results [data-apply]', {timeout: 305000});
  const cardsMs = performance.now() - start;
  assert(cardsMs < 300000);
  const report = await page.evaluate(() => globalThis.generateResearchReport);
  const {maximum, minimum, balanced} = report.actual.outputs;
  assert.deepEqual(report.actual.proven, {maximum: true, minimum: true, balanced: !generateDeadlineTest});
  if (generateDeadlineTest) {
    assert(cardsMs >= 295000);
    const certified = tradeoffReference();
    assert(report.actual.middle.pending > 0);
    assert.deepEqual(maximum, certified.outputs.maximum);
    assert.deepEqual(minimum, certified.outputs.minimum);
    assert(report.actual.certificate.upperEfficiency >= certified.certificate.upperEfficiency);
  }
  assert(minimum.gain >= maximum.gain * minimumShare);
  assert(minimum.cost < balanced.cost && balanced.cost < maximum.cost && minimum.gain < balanced.gain);
  const expected = {Max: maximum.cost, Balanced: balanced.cost, Min: minimum.cost};
  for (const [label, cost] of Object.entries(expected)) {
    await page.getByRole('button', {name: label, exact: true}).click();
    const card = await page.locator('#results').evaluate(el => ({
      cost: el.querySelector('[aria-label="Build cost"] strong')?.textContent, text: el.textContent,
    }));
    assert.equal(card.cost, String(cost), label + ': ' + card.text);
    const proofLabel = generateDeadlineTest && label === 'Balanced' ? 'Best found' : 'Proven optimal';
    assert((await page.locator('.solution-context').textContent()).includes(proofLabel));
  }
  await page.getByRole('button', {name: 'Balanced', exact: true}).click();
  await page.locator('[data-apply]').click();
  await page.waitForFunction(() => document.querySelector('#builder-tab').getAttribute('aria-selected') === 'true' &&
    document.body.getAttribute('aria-busy') === 'false');
  const previous = require('./m4-balanced-tradeoff-chrome.json').result.outputs;
  assert.deepEqual(maximum, previous.maximum);
  if (minimumShare === 0.5) assert.deepEqual(report.actual.outputs, previous);
  const appliedMs = performance.now() - start;
  await page.locator('#open-saved-builds').click();
  const downloadReady = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadReady;
  const snapshot = JSON.parse(readFileSync(await download.path(), 'utf8'));
  assert.deepEqual(snapshot.model.build.config, balanced.config);
  assert.equal(snapshot.model.cost, balanced.cost);
  for (const [path, tunes] of Object.entries(balanced.tunes)) {
    for (const [id, value] of Object.entries(tunes)) assert.equal(snapshot.model.tunes[path][id], value);
  }
  return {...report, ui: {firstSearchProgressMs, cardsMs, appliedMs, displayedCosts: expected,
    applied: 'Balanced', appliedBuildVerified: true, replayGenerate, generateDeadlineTest,
    viewportWidth: await page.evaluate(() => innerWidth)}};
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const browser = useFirefox ? await firefox.launch() : await chromium.launch({channel: 'chrome',
      args: jitless ? ['--enable-automation', '--js-flags=--jitless'] : []});
    try {
      let normRuntime = null;
      if (v8Norm) {
        const session = await browser.newBrowserCDPSession();
        const {product, jsVersion, revision, userAgent} = await session.send('Browser.getVersion');
        const {arguments: args} = await session.send('Browser.getBrowserCommandLine');
        assert.equal(process.platform, 'win32');
        assert.equal(process.arch, 'x64');
        assert(userAgent.includes('Win64; x64'));
        const flags = args.filter(arg => arg.startsWith('--js-flags='));
        normRuntime = {engine: 'chrome', version: product, v8: jsVersion, revision,
          platform: process.platform, arch: process.arch,
          jitless: flags.length === 1 && flags[0] === '--js-flags=--jitless'};
        const {v8NormFloorFor} = await import('./v8-norm-floor.mjs');
        assert(v8NormFloorFor(normRuntime), 'Chrome runtime is outside the norm proof');
      }
      const page = await browser.newPage(lifecycle || generateDeadlineTest || mobileViewport
        ? {viewport: {width: 390, height: 844}, hasTouch: true}
        : undefined);
      const origin = 'http://127.0.0.1:' + server.address().port;
      const requests = [];
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      if (staticExport) await page.route('**/*', route => new URL(route.request().url()).origin === origin
        ? route.continue() : route.abort());
      page.on('request', request => requests.push([request.method(), request.url()]));
      await page.goto(origin + (staticExport ? preview : '/'));
      if (staticExport) await page.waitForFunction(() =>
        document.body.getAttribute('aria-busy') === 'false' && document.querySelector('.slot-tile'));
      const workerUrl = staticExport ? preview + 'research/chart-worker.mjs' : '/chart-worker.mjs';
      const outputs = ['maximum', 'minimum', 'balanced'];
      const reference = budgetStudy || gainStudy || deterministicStudy || activeStudy || fullOrdinary ? null : Object.fromEntries(outputs.map(key => {
        const {gain, cost} = (streamName ? expected.outputs : mountScaling ? expected.samples[0] : expected)[key];
        return [key, {gain, cost}];
      }));
      const cancellation = lifecycle && await page.evaluate(input => new Promise((resolve, reject) => {
        const worker = new Worker(input.workerUrl, {type: 'module'});
        const watchdog = setTimeout(() => {
          worker.terminate();
          reject(Error('Cancellation fixture did not initialize'));
        }, 10000);
        worker.onerror = error => { clearTimeout(watchdog); worker.terminate(); reject(Error(error.message)); };
        worker.onmessage = ({data}) => {
          if (!data.ready) {
            if (!data.progress) reject(Error('Worker completed before cancellation'));
            return;
          }
          worker.postMessage(input);
          const started = performance.now();
          setTimeout(() => {
            const timerMs = performance.now() - started;
            worker.terminate();
            clearTimeout(watchdog);
            resolve({timerMs, viewportWidth: innerWidth});
          }, 100);
        };
      }), {workerUrl, seedRows, deadlineMs: 299000, largeGainCache, orderedSearch, incremental, tradeoff});
      if (lifecycle) {
        assert(fullOrdinary && Number.isFinite(deadlineMs));
        assert(cancellation.timerMs < 2000);
        assert.equal(cancellation.viewportWidth, 390);
      }
      const generated = generate ? await runGenerate(page) : null;
      if (generated?.cancelled) {
        assert.deepEqual(pageErrors, []);
        console.log(JSON.stringify(generated, null, 2));
        return;
      }
      const {actual, workerReadyMs, workerRunMs, progress} = generated ?? await page.evaluate(input => new Promise((resolve, reject) => {
        const start = performance.now();
        const worker = new Worker(input.workerUrl, {type: 'module'});
        let ready;
        const progress = [];
        worker.onerror = error => { worker.terminate(); reject(Error(error.message)); };
        worker.onmessage = ({data}) => {
          if (data.ready) {
            ready = performance.now();
            worker.postMessage(input);
          } else if (data.progress) {
            progress.push(data.progress);
          } else {
            const end = performance.now();
            worker.terminate();
            resolve({actual: data, workerReadyMs: ready - start, workerRunMs: end - ready, progress});
          }
        };
      }), {workerUrl, reference, sampled, expectedLayouts: expected?.legalLayouts, streamName, fast, cachePreparation, gainBound, nativeChartIntervals, nativeStatIntervals, nativeContexts, portableScore, normRuntime, orderedAxes, largestDeterministic, eightPaths, seedRows, deadlineMs, balancedDeadlineMs, largeGainCache, orderedSearch, incremental, tradeoff, minimumShare,
        streamReference: streamName ? {prepared: expected.prepared, gridTuples: expected.gridTuples,
          outputs: reference} : null});
      if (fullOrdinary) {
        assert.equal(actual.expectedMountCount, '12268642');
        if (!actual.pending) assert(Object.values(actual.proven).every(Boolean));
        if (balancedDeadlineArg) {
          const certified = tradeoffReference();
          assert(actual.proven.maximum && actual.proven.minimum);
          assert.deepEqual(actual.outputs.maximum, certified.outputs.maximum);
          assert.deepEqual(actual.outputs.minimum, certified.outputs.minimum);
          assert(actual.middle?.pending > 0 && !actual.proven.balanced);
          assert(actual.certificate.upperEfficiency >= certified.certificate.upperEfficiency);
        }
        if (lifecycle) {
          assert(workerRunMs < deadlineMs + 5000);
          assert(actual.pending > 0 && !actual.proven.balanced);
        }
      } else if (largestDeterministic) {
        const [pair] = actual.runs;
        const [native] = expected.runs;
        assert.equal(pair.baseline.prepared, native.prepared);
        assert.deepEqual(pair.baseline.outputs, native.outputs);
        assert.deepEqual(pair.bounded.outputs, native.outputs);
        assert.equal(pair.bounded.normVersion, 'binary64-normalized-hypot-v1');
        assert(pair.bounded.gainPrunes > 0 && pair.bounded.prepared < pair.baseline.prepared);
      } else if (budgetStudy || gainStudy || deterministicStudy || activeStudy) {
        assert.equal(actual.runs.length, expected.runs.length);
        actual.runs.forEach((pair, i) => {
          assert.equal(pair.name, expected.runs[i].name);
          for (const variant of ['baseline', 'bounded']) {
            for (const key of ['prepared', 'mountNodes', 'budgetPrunes', 'gainPrunes', 'bounds', 'scores', 'controlCounts',
              'kickNodes', 'gridTuples', 'outputs'].filter(key => key in expected.runs[i][variant])) {
              if ((eightPaths || activeStudy) && key === 'outputs') {
                for (const category of ['maximum', 'minimum', 'balanced']) {
                  assert.equal(pair[variant].outputs[category].gain,
                    expected.runs[i][variant].outputs[category].gain);
                  assert.equal(pair[variant].outputs[category].cost,
                    expected.runs[i][variant].outputs[category].cost);
                }
              } else {
                assert.deepEqual(pair[variant][key], expected.runs[i][variant][key], key);
              }
            }
          }
        });
      } else if (streamName) {
        if (compareConservative) {
          for (const key of ['name', 'choiceCounts', 'budget', 'domainSize', 'outputs']) {
            assert.deepEqual(actual[key], expected[key], key);
          }
          assert(actual.gainPrunes > 0 && actual.prepared < expected.prepared);
          assert.deepEqual(actual.nativeContextManifest, expected.nativeContextManifest);
        } else {
          for (const key of ['name', 'choiceCounts', 'budget', 'domainSize', 'prepared',
            'gridTuples', 'bounds', 'scores', 'nodes', 'mountNodes', 'outputs']) {
            assert.deepEqual(actual[key], expected[key], key);
          }
          assert(actual.grouping.enabled);
          if (expected.grouping) {
            assert.deepEqual(actual.mountStats, expected.mountStats);
            assert.deepEqual(actual.grouping, expected.grouping);
            if (gainBound) {
              assert.deepEqual(actual.gainStats, expected.gainStats);
              assert.equal(actual.gainPrunes, expected.gainPrunes);
              if (nativeContexts) assert.deepEqual(actual.nativeContextManifest, expected.nativeContextManifest);
            }
          }
        }
      } else if (mountScaling) {
        assert.equal(actual.orderedAxes, orderedAxes);
        assert.equal(actual.legalLayouts, expected.legalLayouts);
        assert.equal(actual.tunedTuples, expected.tunedTuples);
        assert.equal(actual.mountNodes, expected.mountNodes);
        assert.deepEqual(actual.mountStats, expected.mountStats);
        assert.equal(actual.samples.length, 7);
        for (const sample of actual.samples) {
          for (const key of ['bounds', 'nativeScores', 'nodes', ...outputs]) {
            assert.deepEqual(sample[key], expected.samples[0][key]);
          }
        }
      } else {
        assert.deepEqual(actual.positionsPerAxis, sampled ? [21, 21] : [101, 101]);
        assert.deepEqual(actual.contexts.map(c => ({...c, tiers: []})),
          expected.contexts.map(c => ({...c, tiers: []})));
        assert.equal(actual.samples.length, sampled ? 21 : 7);
        for (const sample of actual.samples) {
          const node = expected.samples.find(row => row.strategy === sample.strategy);
          for (const key of ['chartBounds', 'exactScores', 'nodes']) {
            assert.equal(sample[key], node[key], sample.strategy + ' ' + key);
          }
        }
      }
      let staticReplay;
      if (staticExport) {
        staticReplay = await page.evaluate(async outputs => {
          const release = await fetch('./release.json').then(response => response.json());
          const {createStaticClient} = await import('./static-client.js?v=' + release.version);
          const client = createStaticClient({workerCount: 1});
          try {
            const replays = [];
            for (const [category, row] of Object.entries(outputs)) {
              if (!row) continue;
              const result = await client('evaluate', {weapon_id: '18010000001', mode: 'bd',
                config: row.config, tunes: row.tunes});
              const requestedTunes = Object.entries(row.tunes).flatMap(([path, tunes]) =>
                Object.keys(tunes).map(id => ({path, id, value: result.tunes[path]?.[id]})));
              replays.push({category, cost: result.cost, missing: result.missing,
                config: result.build.config, requestedTunes});
            }
            document.querySelector('#optimizer-tab').click();
            return {release: release.version, replays,
              optimizerTabSelected: document.querySelector('#optimizer-tab').getAttribute('aria-selected')};
          } finally {
            await client('dispose');
          }
        }, actual.outputs);
        assert.equal(staticReplay.optimizerTabSelected, 'true');
        assert.equal(staticReplay.replays.length, Object.values(actual.outputs).filter(Boolean).length);
        if (!actual.pending) assert.equal(staticReplay.replays.length, 3);
        for (const replay of staticReplay.replays) {
          const row = actual.outputs[replay.category];
          assert.equal(replay.cost, row.cost);
          assert.deepEqual(replay.config, row.config);
          for (const {path, id, value} of replay.requestedTunes) assert.equal(value, row.tunes[path][id]);
          assert.deepEqual(replay.missing, []);
        }
        assert.deepEqual(pageErrors, []);
      }
      assert(requests.filter(([, url]) => !staticExport || url.startsWith(origin + '/')).every(([method, url]) => method === 'GET' && new URL(url).origin === origin));
      const report = fullOrdinary ? {version: browser.version(), engine: useFirefox ? 'firefox' : 'chrome', workerReadyMs, workerRunMs, progress, ...(lifecycle ? {cancellation} : {}), ...(staticExport ? {staticReplay} : {}), ...(generated ? {generate: generated.ui} : {}), result: actual} :
        budgetStudy || gainStudy || deterministicStudy || activeStudy || streamName ? {version: browser.version(), normRuntime, workerReadyMs, workerRunMs,
        matchesNodeReference: true, engine: useFirefox ? 'firefox' : 'chrome', jitless, result: actual} :
        {version: browser.version(), workerReadyMs, workerRunMs,
        fixtureSetupMs: actual.setupMs, mountMs: actual.mountMs, matchesNodeReference: true,
        independentlyEnumerated: !mountScaling || sampled, legalLayouts: actual.legalLayouts,
        tunedTuples: actual.tunedTuples, ...reference, samples: actual.samples};
      console.log(JSON.stringify(report, null, 2));
    } finally {
      await browser.close();
    }
  } finally {
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
