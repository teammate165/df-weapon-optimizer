const {chromium}=require('../.scratch/browser-qa/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8770/github-pages-site/screening-study.html');await page.waitForFunction(()=>globalThis.screeningStudy);
 const run=await page.evaluate(async()=>{
  const NativeWorker=Worker;let spawned=0,terminated=0;
  globalThis.Worker=class extends NativeWorker{constructor(...args){super(...args);spawned++;}terminate(){terminated++;return super.terminate();}};
  const {startScreening,screeningFixture}=await import('./screening-study.js');
  const result=await startScreening({workers:8,request:{...screeningFixture,budget:160}});
  globalThis.Worker=NativeWorker;return {result,spawned,terminated};
 });
 assert.equal(run.result.plan.dominance.enabled,false);assert.equal(await page.locator('#dominance').count(),0);assert.equal(await page.locator('#workers').getAttribute('max'),'8');
 assert.equal(run.result.status,'completed');assert.equal(run.result.count.total,'385');assert.equal(run.result.partition_results.length,102);assert.equal(new Set(run.result.partition_results.map(r=>r.partition)).size,102);
 assert.equal(run.result.partition_results.reduce((n,p)=>n+p.scored,0),385);assert.equal(run.spawned,8);assert.equal(run.terminated,8);assert.equal(run.result.samples.at(-1).fraction,1);
 await page.evaluate(()=>{import('./screening-study.js').then(({startScreening})=>startScreening({workers:8}));});await page.waitForTimeout(400);await page.click('#stop');await page.waitForFunction(()=>!document.querySelector('#start').disabled);assert.equal(await page.evaluate(()=>screeningStudy.status),'stopped');
 for(const [width,height]of [[1440,1000],[390,844]]){await page.setViewportSize({width,height});assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));}
 assert.deepEqual(errors,[]);fs.writeFileSync('.scratch/exhaustive-screening-browser-validation.json',JSON.stringify({passed:true,exact_total:385,partitions:102,workers:8,spawned:run.spawned,terminated:run.terminated,checks:['dominance disabled and selector removed','whole domain completed once','count reconciliation','worker lifetime without restarts','100% fraction','cancellation','desktop/mobile layout']},null,2));console.log('PASS: exhaustive browser completion, disjoint count, no worker restarts, cancel and layout');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
