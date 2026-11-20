const {chromium}=require('../.scratch/browser-qa/node_modules/playwright');const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),url=process.env.STATIC_SITE_URL||'http://127.0.0.1:8770/github-pages-site/',errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 const report=await page.evaluate(async()=>{
  const release=await fetch('./release.json').then(r=>r.json()),{createStaticClient,searchWorkerCount}=await import(`./static-client.js?v=${release.version}`),runs=[],counts=[[1,8],[2,8],[4,8],[8,2],[8,8]].map(([hardwareConcurrency,deviceMemory])=>searchWorkerCount({hardwareConcurrency,deviceMemory}));
  const NativeWorker=Worker;let spawned=0,terminated=0,active=0,peak=0;
  globalThis.Worker=class extends NativeWorker{constructor(...args){super(...args);spawned++;active++;peak=Math.max(peak,active);this.stopped=false;}terminate(){if(!this.stopped){this.stopped=true;terminated++;active--;}return super.terminate();}};
  const client=createStaticClient({workerCount:4}),controller=new AbortController(),pending=client('optimize',{weapon_id:'18010000001',mode:'bd',time_limit_seconds:30},{signal:controller.signal});setTimeout(()=>controller.abort(),800);let aborted=false;try{await pending;}catch(e){aborted=e.name==='AbortError';}const activeAfterAbort=active;
  for(const workerCount of [1,4,8]){
   peak=active;
   const api=workerCount===4?client:createStaticClient({workerCount});
   const events=[],started=performance.now(),result=await api('optimize',{weapon_id:'18010000001',mode:'bd',preset:'recoil',time_limit_seconds:5,fixed:[{slotPath:'11',itemId:'13110000091'}]},{onProgress:p=>events.push({phase:p.phase,workers:p.workers})});
   const replays=[];for(const row of result.results.filter(r=>r.status==='best_found')){const replay=await api('evaluate',{weapon_id:'18010000001',mode:'bd',config:row.config,tunes:row.tunes});replays.push({stats:replay.effective_stats,cost:replay.cost});}
   runs.push({workerCount,peakActive:peak,elapsed_ms:performance.now()-started,result,replays,events});
   await api('dispose');
   if(active!==0)throw Error('Workers remained active after disposal.');
  }
  // Browser worker construction failure must retain a usable single worker.
  let attempts=0;globalThis.Worker=class extends NativeWorker{constructor(...args){if(++attempts>1)throw Error('Simulated companion spawn failure');super(...args);}};
  const fallback=await createStaticClient({workerCount:4})('optimize',{weapon_id:'18070000005',mode:'bd',time_limit_seconds:1});
  // A companion that fails asynchronously must not discard healthy results.
  attempts=0;globalThis.Worker=class extends NativeWorker{constructor(...args){attempts++;super(...(attempts===2?['data:text/javascript,throw new Error("Simulated worker load failure")',{type:'module'}]:args));}};
  const partial=await createStaticClient({workerCount:2})('optimize',{weapon_id:'18070000005',mode:'bd',time_limit_seconds:1});
  globalThis.Worker=NativeWorker;
  return {release:release.version,counts,automaticWorkers:searchWorkerCount(),hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory??null,aborted,activeAfterAbort,peak,spawned,terminated,runs,fallback:fallback.solver.parallel,partial:partial.solver.parallel};
 });
 assert.deepEqual(report.counts,[1,1,3,2,7]);assert(report.aborted);assert.equal(report.activeAfterAbort,0);assert.equal(report.peak,8);assert.equal(report.fallback.workers,1);assert.equal(report.partial.workers,1);
 for(const run of report.runs){assert(run.elapsed_ms<12000);assert.equal(run.peakActive,run.workerCount);assert.equal(run.result.solver.parallel.workers,run.workerCount);assert(run.result.solver.parallel.merged_candidates.every(n=>n<=512));assert(!run.result.search_candidates);assert(run.result.solver.parallel.worker_evaluated.every(n=>n>0));assert(run.events.some(e=>e.workers===run.workerCount));const rows=run.result.results.filter(r=>r.status==='best_found');assert(rows.length);rows.forEach((row,i)=>{assert.deepEqual(row.stats,run.replays[i].stats);assert.equal(row.cost,run.replays[i].cost);assert(row.cost<=800);assert(row.config.some(c=>c.slotPath==='11'&&c.itemId==='13110000091'));assert(!row.config.some(c=>c.slotPath.split('/').some(s=>['10','31','45'].includes(s))));});}
 assert.deepEqual(errors,[]);report.passed=true;report.url=url;fs.mkdirSync('.scratch/parallel-search',{recursive:true});fs.writeFileSync(process.env.PARALLEL_REPORT||'.scratch/parallel-search/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,url,release:report.release,automaticWorkers:report.automaticWorkers,hardwareConcurrency:report.hardwareConcurrency,deviceMemory:report.deviceMemory,runs:report.runs.map(r=>({workers:r.workerCount,elapsed_ms:r.elapsed_ms,evaluated:r.result.solver.parallel.worker_evaluated,losses:r.result.solver.parallel.worker_best_losses})),checks:['1/4/8 concurrent workers and cleanup','common compute deadline','both cancellation and recovery','locks and accessory exclusions','exact native stat/cost replay','single-worker and failed-companion recovery']}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
