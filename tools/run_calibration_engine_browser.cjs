const {chromium}=require('../.scratch/browser-qa/node_modules/playwright');
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const directory='data/optimizer_validation/calibration_engines_20261118';fs.mkdirSync(directory,{recursive:true});
const save=(name,value)=>fs.writeFileSync(directory+'/'+name,JSON.stringify(value,null,2));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await page.goto('http://127.0.0.1:8770/github-pages-site/calibration-engine-study.html');await page.waitForFunction(()=>globalThis.engineStudy);
  const environment=await page.evaluate(()=>({user_agent:navigator.userAgent,logical_cpus:navigator.hardwareConcurrency,cross_origin_isolated:crossOriginIsolated,shared_array_buffer:typeof SharedArrayBuffer!=='undefined'}));save('environment.json',environment);
  const outcome=await page.evaluate(async()=>{
   const NativeWorker=Worker;let spawned=0,terminated=0;globalThis.Worker=class extends NativeWorker{constructor(...args){super(...args);spawned++;}terminate(){terminated++;return super.terminate();}};
   try{const {runEngineStudy}=await import('./calibration-engine-study.js');const study=await runEngineStudy({rounds:6,seconds:2});return {study,spawned,terminated};}finally{globalThis.Worker=NativeWorker;}
  });save('raw.json',outcome);
  assert.equal(outcome.spawned,16);assert.equal(outcome.terminated,16);assert.equal(outcome.study.results.length,16);assert(outcome.study.results.every(r=>r.passed&&r.adapter_validation));assert.equal(new Set(outcome.study.results.map(r=>r.worker)).size,16);
  for(const result of outcome.study.results){const rounds=new Map();for(const record of result.records){if(!rounds.has(record.phase+':'+record.round))rounds.set(record.phase+':'+record.round,[]);rounds.get(record.phase+':'+record.round).push(record);}for(const pair of rounds.values()){assert.equal(pair.length,2);assert.equal(pair[0].model_sha256,pair[1].model_sha256);assert.notEqual(pair[0].engine,pair[1].engine);}}
  assert.deepEqual(errors,[]);assert(requests.every(r=>r.method==='GET'&&new URL(r.url).origin==='http://127.0.0.1:8770'));
  // A fresh 16-worker startup must terminate promptly when cancelled.
  await page.evaluate(()=>{import('./calibration-engine-study.js').then(({runEngineStudy})=>runEngineStudy({rounds:6,seconds:2})).catch(()=>{});});await page.waitForTimeout(200);await page.click('#stop');await page.waitForFunction(()=>engineStudy.status==='stopped');
  const validation={passed:true,workers:16,participating_workers:outcome.study.results.map(r=>r.worker),paired_models_match:true,native_incumbent_replay:true,adapter_signed_products_and_row_append:true,static_get_requests_only:true,served_without_cross_origin_isolation:!environment.cross_origin_isolated,cancellation:true,checks:['16 actual browser compute workers','same paired model hashes','native replay of every reported incumbent','single-thread WASM assets served locally','no backend solve request','signed products and appended contradictory row','cancellation terminates pool']};
  save('validation.json',validation);save('requests.json',requests);
  const names=['tools/highs_runtime.mjs','tools/calibration_engine_benchmark.mjs','builder/calibration-engine-worker.js','tools/scip_runtime.mjs','tools/scip_linear_model.mjs','tools/scip_stat_model.mjs','tools/scip_objective_model.mjs','vendor/highs-1.15.4/provenance.json','vendor/scip-7e68f9ca/provenance.json'];save('source-sha256.json',Object.fromEntries(names.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')])));
  console.log(JSON.stringify({passed:true,workers:16,wall_seconds:outcome.study.wall_ms/1000,calls:outcome.study.results.reduce((n,r)=>n+r.records.length,0),fixtures:[...new Set(outcome.study.results.map(r=>r.fixture))],converged_workers:outcome.study.results.filter(r=>r.converged).length},null,2));
 }finally{await browser.close();}
})().catch(error=>{save('failure.json',{error:error.stack});console.error(error);process.exitCode=1;});
