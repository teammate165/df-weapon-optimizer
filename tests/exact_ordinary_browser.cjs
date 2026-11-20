const assert = require('node:assert/strict');
const {chromium} = require('../.scratch/browser-qa/node_modules/playwright');

const url = process.env.STATIC_SITE_URL ?? 'http://127.0.0.1:8798/pages-catalog-exact/';
const staged = process.argv.includes('--staged');

async function run() {
  const browser = await chromium.launch({channel: 'chrome'});
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', {value: 8});
      window.exactOrdinaryJobs = [];
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        postMessage(data, ...args) {
          if (data.action?.startsWith('exact-ordinary-')) window.exactOrdinaryJobs.push(data.action);
          if (data.action === 'exact-ordinary-shard' && (window.failOneShard ||
              (window.failBalancedShard && data.phase?.kind === 'balanced'))) {
            window.failOneShard = false;
            window.failBalancedShard = false;
            queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', {
              data: {id: data.id, error: 'Test shard failure'},
            })));
            return;
          }
          if (data.action === 'exact-ordinary-shard' && window.stallOneShard) {
            window.stallOneShard = false;
            return;
          }
          super.postMessage(data, ...args);
        }
      };
    });

    const idle = () => page.waitForFunction(() => document.body.getAttribute('aria-busy') === 'false');
    await page.goto(url);
    await idle();
    assert.equal(await page.locator('#exact-ordinary').count(), 0);
    await page.goto(new URL(staged ? '?exact-ordinary=staged' : '?exact-ordinary=1', url).href);
    await idle();
    await page.locator('#choose-weapon').click();
    await page.locator('#weapon-search').fill('18010000038');
    await page.locator('[data-weapon="18010000038"]').click();
    await idle();
    await page.locator('#mode').selectOption('sol');
    await idle();
    await page.locator('#optimizer-tab').click();
    await page.locator('#exact-ordinary').check();
    await page.locator('#budget-0').fill('0');
    await page.locator('#solver-time-limit').selectOption('5');
    await page.locator('#generate').click();
    await idle();
    assert.match(await page.locator('#results').textContent(), /Proven optimal/);
    const jobs = await page.evaluate(() => window.exactOrdinaryJobs);
    const shards = jobs.filter(action => action === 'exact-ordinary-shard').length;
    assert(shards > 1 && shards <= 4);
    assert(jobs.includes(staged ? 'exact-ordinary-advance' : 'exact-ordinary-merge'));
    await page.locator('[data-apply]').click();
    await idle();
    assert.equal(await page.locator('#builder-tab').getAttribute('aria-selected'), 'true');

    await page.locator('#optimizer-tab').click();
    await page.evaluate(() => { window.failOneShard = true; });
    await page.locator('#generate').click();
    await idle();
    assert.doesNotMatch(await page.locator('#results').textContent(), /Proven optimal/);
    assert.match(await page.locator('#results').textContent(), /Best found|Search incomplete/i);

    await page.evaluate(() => { window.stallOneShard = true; });
    const stalledAt = Date.now();
    await page.locator('#generate').click();
    await idle();
    assert(Date.now() - stalledAt < 8000);
    assert.doesNotMatch(await page.locator('#results').textContent(), /Proven optimal/);
    assert.match(await page.locator('#optimizer-search-note').textContent(), /Search incomplete/);

    await page.locator('#mode').selectOption('bd');
    await idle();
    await page.locator('#optimizer-tab').click();
    await page.locator('#pattern-reduction').check();
    await page.locator('#generate').click();
    await page.locator('#cancel-generate').click();
    await idle();
    assert.match(await page.locator('#results').textContent(), /Search cancelled/);
    await page.locator('#generate').click();
    await idle();
    assert.doesNotMatch(await page.locator('#results').textContent(), /Proven optimal/);
    assert.match(await page.locator('#pattern-constraint-result').textContent(), /cap/);
    let phaseProofs;
    if (staged) {
      await page.route('**/data/weapons/18010000001.json*', async route => {
        const response = await route.fetch();
        const pack = await response.json();
        const allowed = new Set(['13030000109', '13120000342', '13130000224', '13340000001']);
        for (const [part, display] of Object.entries(pack.display.objects)) {
          if (!allowed.has(part)) display.playerSelectable = false;
        }
        await route.fulfill({response, json: pack});
      });
      phaseProofs = await page.evaluate(async () => {
        const moduleUrl = performance.getEntriesByType('resource')
          .find(({name}) => new URL(name).pathname.endsWith('/static-client.js')).name;
        const {createStaticClient} = await import(moduleUrl);
        const client = createStaticClient({exactOrdinary: true, workerCount: 4});
        const request = {weapon_id: '18010000001', mode: 'bd', preset: 'recoil',
          search_method: 'exact_ordinary_staged', time_limit_seconds: 30,
          fixed: [{slotPath: '2/6', itemId: '13130000224'}], minimum_stats: {control: 20},
          pattern_reduction_percent: 5};
        try {
          const complete = await client('optimize', request);
          window.failBalancedShard = true;
          const partial = await client('optimize', request);
          return {costs: complete.results.map(({label, cost}) => [label, cost]),
            complete: complete.solver.proven, partial: partial.solver.proven,
            phasedExhaustion: partial.solver.phases.map(({exhausted}) => exhausted)};
        } finally {
          await client('dispose');
        }
      });
      assert.deepEqual(phaseProofs.costs, [['Max', 260], ['Balanced', 200], ['Min', 160]]);
      assert.deepEqual(phaseProofs.complete, {maximum: true, minimum: true, balanced: true});
      assert.deepEqual(phaseProofs.partial, {maximum: true, minimum: true, balanced: false});
      assert.deepEqual(phaseProofs.phasedExhaustion, [true, true, false]);
    }
    assert.deepEqual(pageErrors, []);
    return {url, staged, shards, proofAndApply: true, failedShard: true, stalledShard: true, deadline: true, cancelAndRestart: true,
      phaseProofs};
  } finally {
    await browser.close();
  }
}

run().then(report => console.log(JSON.stringify(report, null, 2))).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
