// Run from the repository root. Dedicated Chrome instance; no backend solver.
const {chromium}=require('../.scratch/browser-qa/node_modules/playwright');
const fs=require('node:fs'),os=require('node:os'),assert=require('node:assert/strict'),path=require('node:path');
const output=path.resolve(process.env.SOLVER_STUDY_OUTPUT||'data/optimizer_validation/m4a1_worker_study_20261117');fs.mkdirSync(output,{recursive:true});
const url=process.env.SOLVER_STUDY_URL||'http://127.0.0.1:8770/github-pages-site/solver-diagnostics.html';
const save=(name,data)=>{const target=path.join(output,name),temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2));fs.renameSync(temp,target);};
const median=xs=>{const a=[...xs].sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
let seed=20261117;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
const shuffle=xs=>{const a=[...xs];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
(async()=>{
 const counts=[1,2,4,6,8],repetitions=7,seconds=5;
 const report={schema:1,started_at:new Date().toISOString(),url,design:{counts,repetitions,seconds,warmup_seconds:2,randomization_seed:seed,unit:'one complete browser portfolio run',selection:'smallest pool with median end-to-end gross scored throughput at least 90% of maximum',notes:'Randomized complete blocks. Each trial uses fresh workers with warmed HTTP cache. Work can overlap; no unique-search-space coverage or CPU-efficiency claim.'},host:{cpus:os.cpus().map(c=>c.model),total_memory:os.totalmem(),free_memory_at_start:os.freemem(),platform:os.platform(),node:process.version},warmups:[],trials:[],errors:[]};
 let browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 try{
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>globalThis.solverStudy);
  report.environment=await page.evaluate(()=>({hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,userAgent:navigator.userAgent}));
  report.release=await page.evaluate(()=>fetch('./release.json').then(r=>r.json()));
  const run=async(workers,budget)=>page.evaluate(async({workers,budget})=>{const {runTrial}=await import('./solver-diagnostics.js');return runTrial(workers,budget);},{workers,budget});
  for(const workers of counts){const warm=await run(workers,2);report.warmups.push({workers,wall_ms:warm.wall_ms,evaluated:warm.evaluated,best_loss:warm.best_loss});save('benchmark.json',report);console.log('warmup',workers,warm.wall_ms.toFixed(0));}
  for(let block=0;block<repetitions;block++)for(const workers of shuffle(counts)){
   const trial=await run(workers,seconds);assert.equal(trial.result.solver.parallel.workers,workers);assert(trial.validation.passed);assert.equal(trial.source_errors,0);
   trial.block=block+1;trial.order=report.trials.length+1;report.trials.push(trial);save('benchmark.json',report);
   console.log(JSON.stringify({block:block+1,workers,wall_ms:trial.wall_ms,evaluated:trial.evaluated,rate:trial.throughput,loss:trial.best_loss}));
  }
  const summary=counts.map(workers=>({workers,median_throughput:median(report.trials.filter(t=>t.workers===workers).map(t=>t.throughput))}));
  const peak=Math.max(...summary.map(s=>s.median_throughput));report.selected_workers=summary.find(s=>s.median_throughput>=.9*peak).workers;report.selection_summary=summary;report.finished_at=new Date().toISOString();
  assert.deepEqual(report.errors,[]);save('benchmark.json',report);console.log('SELECTED',report.selected_workers);
 }finally{await browser.close();}
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:1440,height:1050}});await page.exposeFunction('recordSolverCheckpoint',data=>{save('continuous.json',data);console.log('CHECKPOINT',data.rounds.length,data.best.loss);});
 await page.goto(url);await page.waitForFunction(()=>globalThis.solverStudy);
 await page.screenshot({path:path.join(output,'dashboard-start.png'),fullPage:true});
 // Deliberately stays alive while the user studies/stops the ongoing browser run.
 await page.evaluate(async workers=>{const {startContinuous}=await import('./solver-diagnostics.js');return startContinuous({workers,seconds:120});},report.selected_workers);
 save('continuous.json',await page.evaluate(()=>globalThis.solverStudy));console.log('Continuous solver stopped by user; browser remains available.');
 await new Promise(resolve=>browser.on('disconnected',resolve));
})().catch(error=>{save('failure.json',{error:error.stack,time:new Date().toISOString()});console.error(error);process.exitCode=1;});
