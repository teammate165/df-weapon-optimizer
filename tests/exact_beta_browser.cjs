const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('../.scratch/browser-qa/node_modules/playwright');
const reference = require('../docs/optimization/m4-generate-60-chrome.json').result;
const mode = process.argv[2] ?? 'complete';
assert(['complete', 'unshared', 'timeout', 'deadline', 'failure', 'unsupported'].includes(mode));
const partial = mode === 'timeout' || mode === 'deadline';

(async () => {
  const browser = await chromium.launch({channel: 'chrome'});
  try {
    const page = await browser.newPage();
    const url = process.env.STATIC_SITE_URL ?? 'http://127.0.0.1:8796/pages-exact-beta/';
    const origin = new URL(url).origin;
    const requests = [];
    const errors = [];
    page.on('request', request => requests.push({url: request.url(), method: request.method()}));
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', {value: 2});
      globalThis.exactWorkers = {started: 0, terminated: 0};
      const BrowserWorker = Worker;
      globalThis.Worker = class extends BrowserWorker {
        constructor(url, options) {
          super(url, options);
          this.exact = new URL(url, location.href).pathname.endsWith('/exact-beta-worker.js');
          if (this.exact) exactWorkers.started++;
        }
        terminate() {
          if (this.exact && !this.terminated) {
            this.terminated = true;
            exactWorkers.terminated++;
          }
          super.terminate();
        }
      };
    });
    await page.route('**/*', async route => {
      const path = new URL(route.request().url());
      if (path.origin !== origin) return route.abort();
      if (mode === 'failure' && path.pathname.endsWith('/exact-beta-worker.js')) return route.abort();
      if (mode === 'unshared' && path.pathname.endsWith('/exact-beta-client.js')) {
        const response = await route.fetch();
        const source = await response.text();
        const replacement = source.replace('const seed = window && sharedBalancedSeed(result.archive, window);',
          'const seed = null;');
        assert.notEqual(replacement, source);
        return route.fulfill({response, body: replacement});
      }
      if (partial && path.pathname.endsWith('/exact-beta-worker.js')) {
        const response = await route.fetch();
        const source = await response.text();
        const replacement = mode === 'timeout'
          ? source.replace('seedRows, partition, deadlineMs,','seedRows, partition, deadlineMs: phase === "balanced" ? Math.min(deadlineMs, 2500) : deadlineMs,')
          : source.replace('self.onmessage = ({data}) => {', 'self.onmessage = async ({data}) => {')
            .replace('const result = runFullOrdinaryPhase({seedRows, partition, deadlineMs,', `const started = performance.now();
              if (phase === 'balanced' && partition.items.includes('13020000349')) {
                await new Promise(resolve => setTimeout(resolve, Math.max(0, deadlineMs - 75)));
              }
              const result = runFullOrdinaryPhase({seedRows, partition,
                deadlineMs: Math.max(1, deadlineMs - (performance.now() - started)),`);
        assert.notEqual(replacement, source);
        return route.fulfill({response, body: replacement});
      }
      return route.continue();
    });
    await page.goto(url + '?exact-beta=1');
    await page.waitForFunction(() => document.body.getAttribute('aria-busy') === 'false' &&
      document.querySelector('[data-slot="11"]'));
    await page.locator('[data-slot="11"]').click();
    await page.locator('[data-part="13110000091"]').dblclick();
    await page.waitForSelector('[data-part="13110000091"].equipped');
    await page.locator('#optimizer-tab').click();
    if (mode !== 'unsupported') await page.locator('#lock').click();
    await page.selectOption('#solver-time-limit', '300');

    if (mode === 'complete') {
      await page.locator('#generate').click();
      await page.waitForFunction(() => document.querySelector('#results').textContent.includes('Proving Maximum and Minimum'));
      await page.locator('#cancel-generate').click();
      await page.waitForFunction(() => !document.querySelector('#generate').disabled);
      assert.match(await page.locator('#results').textContent(), /Search cancelled/);
      assert.equal(await page.locator('[data-apply]').count(), 0);
      assert.deepEqual(await page.evaluate(() => exactWorkers), {started: 4, terminated: 4});
    }
    const started = performance.now();
    await page.locator('#generate').click();
    await page.waitForFunction(() => !document.querySelector('#generate').disabled, null, {timeout: 305000});
    const cardsMs = performance.now() - started;
    assert(cardsMs < 300000);
    if (mode === 'deadline') assert(cardsMs >= 295000);
    const scopes = await page.locator('#optimizer-search-note').textContent();
    assert(await page.locator('[data-apply]').count());
    const exact = mode === 'complete' || mode === 'unshared' || partial;
    if (exact) assert.match(scopes, /Grouped ordinary M4A1/);
    else assert.match(scopes, /Global optimum unproven/);
    let snapshot;
    if (exact) {
      for (const label of ['Max', 'Balanced', 'Min']) {
        await page.getByRole('button', {name: label, exact: true}).click();
        const proof = partial && label === 'Balanced' ? 'Best found' : 'Proven optimal';
        assert.match(await page.locator('.solution-context').textContent(), new RegExp(proof));
      }
      await page.getByRole('button', {name: 'Balanced', exact: true}).click();
      await page.locator('[data-apply]').click();
      await page.waitForFunction(() => document.querySelector('#builder-tab').getAttribute('aria-selected') === 'true' &&
        document.body.getAttribute('aria-busy') === 'false');
      await page.locator('#open-saved-builds').click();
      const downloadReady = page.waitForEvent('download');
      await page.locator('#export').click();
      snapshot = JSON.parse(fs.readFileSync(await (await downloadReady).path(), 'utf8'));
      const {results, solver} = snapshot.optimization;
      assert.equal(solver.workers, 4);
      assert.equal(solver.partitions.length, 4);
      assert.equal(solver.partitions.reduce((sum, part) => sum + part.layouts, 0), 12268642);
      assert(solver.partitions.every(part => part.endpointNodes > 0));
      assert(solver.partitions.filter(part => part.balancedNodes > 0).length >= (mode === 'deadline' ? 3 : 4));
      assert.equal(Boolean(solver.sharedBalancedSeed), mode !== 'unshared');
      for (const [category, label] of [['maximum', 'Max'], ['minimum', 'Min'], ['balanced', 'Balanced']]) {
        const row = results.find(result => result.label === label);
        if (category === 'balanced' && partial) {
          assert(solver.pending > 0 && !solver.proven.balanced);
          assert(solver.certificate.upperEfficiency >= reference.certificate.upperEfficiency);
          assert(row.gain > reference.outputs.minimum.gain);
          assert(row.cost > reference.outputs.minimum.cost && row.cost < reference.outputs.maximum.cost);
        } else {
          assert(solver.proven[category]);
          for (const key of ['cost', 'gain']) assert.equal(row[key], reference.outputs[category][key]);
        }
      }
      const balanced = results.find(row => row.label === 'Balanced');
      assert.deepEqual(snapshot.model.build.config, balanced.config);
      assert.equal(snapshot.model.cost, balanced.cost);
      for (const [path, tunes] of Object.entries(balanced.tunes)) {
        for (const [id, value] of Object.entries(tunes)) assert.equal(snapshot.model.tunes[path][id], value);
      }
    }
    const count = mode === 'complete' ? 8 : mode === 'unsupported' ? 0 : 4;
    assert.deepEqual(await page.evaluate(() => exactWorkers), {started: count, terminated: count});
    assert.deepEqual(errors, []);
    assert(requests.filter(r => new URL(r.url).origin === origin).every(r => r.method === 'GET' && !new URL(r.url).pathname.includes('/api/')));
    if (exact) assert(requests.some(r => new URL(r.url).pathname.endsWith('/exact-beta/m4-full-ordinary-study.mjs')));
    console.log(JSON.stringify({mode, cardsMs, exactWorkers: count, scope: scopes,
      solver: snapshot?.optimization.solver,
      outputs: snapshot?.optimization.results.map(({label, proof, gain, cost}) => ({label, proof, gain, cost})),
      applied: snapshot?.model.cost}, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
