const {createServer} = require('node:http');
const {readFile} = require('node:fs/promises');
const {join} = require('node:path');

(async () => {
  const {benchmark} = await import('./benchmark.mjs');
  const output = {nodeVersion: process.version, node: benchmark()};
  const {chromium} = require('../../.scratch/browser-qa/node_modules/playwright');
  const files = new Set(['benchmark.mjs', 'prototype.mjs']);
  const server = createServer(async (request, response) => {
    const name = request.url.slice(1);
    if (name === '') return response.end('<!doctype html><title>Solver benchmark</title>');
    if (name === 'worker.mjs') {
      response.setHeader('Content-Type', 'text/javascript');
      return response.end("import {benchmark} from './benchmark.mjs'; postMessage(benchmark());");
    }
    if (!files.has(name)) return response.writeHead(404).end();
    response.setHeader('Content-Type', 'text/javascript');
    response.end(await readFile(join(__dirname, name)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const browser = await chromium.launch({channel: 'chrome'});
    try {
      const page = await browser.newPage();
      await page.goto('http://127.0.0.1:' + server.address().port);
      output.chromeVersion = browser.version();
      output.browser = await page.evaluate(() => new Promise((resolve, reject) => {
        const worker = new Worker('./worker.mjs', {type: 'module'});
        worker.onmessage = event => { worker.terminate(); resolve(event.data); };
        worker.onerror = event => { worker.terminate(); reject(Error(event.message)); };
      }));
    } finally {
      await browser.close();
    }
  } finally {
    server.close();
  }
  console.log(JSON.stringify(output, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
