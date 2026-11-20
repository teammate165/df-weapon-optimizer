import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {createMergedScreening} from './merged_screening.mjs';
import {createRankingHeap} from './ranked_screening_heap.mjs';
import {screeningComparator,survivorCount,rankingContract} from './screening_rank.mjs';

const digestRows=rows=>{const hash=crypto.createHash('sha256');for(const line of rows.sort())hash.update(line+'\n');return hash.digest('hex');};
if(!isMainThread){
 const kernel=await import('../.scratch/calibration-check/kernel.mjs'),curves=await import('../.scratch/calibration-check/curves.mjs'),{t:calculate}=await import('../.scratch/calibration-check/attributes.mjs');
 const study=createMergedScreening(workerData.input,{kernel,curves,calculate}),compare=screeningComparator({});let heap;
 parentPort.postMessage({ready:true,id:workerData.id});
 parentPort.on('message',message=>{
  try{
   if(message.action==='plan'){parentPort.postMessage({result:study.plan()});return;}
   if(message.action==='begin'){heap=createRankingHeap(message.k,compare);parentPort.postMessage({result:true});return;}
   if(message.action==='finish'){parentPort.postMessage({result:heap.rows()});return;}
   if(message.action==='job'){
    const began=performance.now(),rows=[];let result,guardFallback=null;
    if(message.phase==='merged'){
     try{result=study.merged(message.job,row=>rows.push(row));}
     catch(error){guardFallback=error.message;rows.length=0;result={...study.flat(message.job,row=>rows.push(row)),kind:'guard_fallback',reason:guardFallback};}
    }else result=study.flat(message.job,row=>rows.push(row));
    const lines=[];for(const row of rows){heap.offer(row);lines.push(JSON.stringify([row.signature,row.objectives,row.score,row.cost]));}
    const manifest=digestRows(lines);parentPort.postMessage({result:{...result,worker:workerData.id,manifest,guard_fallback:guardFallback,measured_elapsed_ms:performance.now()-began,heap_used:process.memoryUsage().heapUsed}});return;
   }
   if(message.action==='replay'){
    let replays=0;for(const row of message.rows){const config=JSON.parse(row.signature).map(([slotPath,itemId])=>({slotPath,itemId})),native=study.score(config).row;if(JSON.stringify(native.objectives)!==JSON.stringify(row.objectives)||native.cost!==row.cost||native.signature!==row.signature||native.score!==row.score)throw Error('Retained alias native replay mismatch');replays++;}
    parentPort.postMessage({result:{worker:workerData.id,replays}});return;
   }
   throw Error('Unknown study action');
  }catch(error){parentPort.postMessage({error:error.stack});}
 });
}else{
 if(process.env.MERGED_DOMINANCE&&process.env.MERGED_DOMINANCE!=='0')throw Error('Dominance has been disabled for exhaustive screening.');
 const directory=process.env.MERGED_OUTPUT??'data/optimizer_validation/m4a1_exhaustive_ranked_20261118',budget=Number(process.env.MERGED_BUDGET??800),dominance=false,workers=8;
 fs.mkdirSync(directory,{recursive:true});const save=(name,value)=>fs.writeFileSync(directory+'/'+name,JSON.stringify(value,null,2));
 const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json','utf8')),pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json','utf8'));
 const input={pack,shop:catalog.shop,prices:catalog.prices,request:{mode:'bd',preset:'recoil',budget,fixed:[{slotPath:'11',itemId:'13110000091'}],experimental_dominance:dominance}};
 const pool=[],ready=[],began=performance.now(),samples=[];let phase='setup',peakRss=process.memoryUsage().rss,completed=0,currentPaths=0;
 const sample=()=>{const memory=process.memoryUsage();peakRss=Math.max(peakRss,memory.rss);samples.push({elapsed_ms:performance.now()-began,phase,rss_bytes:memory.rss,completed_jobs:completed,paths:currentPaths});};
 const interval=setInterval(sample,500);
 try{
  for(let id=0;id<workers;id++){const worker=new Worker(new URL(import.meta.url),{workerData:{input,id},resourceLimits:{maxOldGenerationSizeMb:384}});pool.push(worker);ready.push(new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}));}
  await Promise.all(ready);
  const send=(worker,message)=>new Promise((resolve,reject)=>{const onError=error=>{worker.off('message',onMessage);reject(error);},onMessage=m=>{worker.off('error',onError);m.error?reject(Error(m.error)):resolve(m.result);};worker.once('message',onMessage);worker.once('error',onError);worker.postMessage(message);});
  const plan=await send(pool[0],{action:'plan'}),k=Number(survivorCount(plan.total));save('plan.json',plan);
  console.log(JSON.stringify({phase:'plan',workers,total:plan.total,k,jobs:plan.jobs.length,supported:plan.supported_prefixes,fallback:plan.fallback_prefixes}));
  const outputs={};
  for(const name of ['control','merged']){
   phase=name;completed=0;currentPaths=0;const phaseStart=performance.now();let next=0,lastLog=0;
   await Promise.all(pool.map(worker=>send(worker,{action:'begin',k})));
   const results=[];
   await Promise.all(pool.map(async worker=>{while(next<plan.jobs.length){const job=plan.jobs[next++],result=await send(worker,{action:'job',job,phase:name});results.push(result);completed++;currentPaths+=result.paths;
    if(performance.now()-lastLog>5000||completed===plan.jobs.length){lastLog=performance.now();console.log(JSON.stringify({phase:name,completed,jobs:plan.jobs.length,paths:currentPaths,seconds:(performance.now()-phaseStart)/1000,rss_gib:process.memoryUsage().rss/2**30}));save('latest.json',{phase:name,completed,jobs:plan.jobs.length,paths:currentPaths,elapsed_ms:performance.now()-phaseStart});}
   }}));
   const workerRows=await Promise.all(pool.map(worker=>send(worker,{action:'finish'}))),rank=createRankingHeap(k,screeningComparator({}));for(const rows of workerRows)for(const row of rows)rank.offer(row);
   const survivors=rank.rows(),summary={phase:name,wall_ms:performance.now()-phaseStart,paths:results.reduce((n,r)=>n+r.paths,0),classes:results.reduce((n,r)=>n+r.classes,0),transitions:results.reduce((n,r)=>n+r.transitions,0),root_merges:results.reduce((n,r)=>n+r.root_merges,0),layer_merges:results.reduce((n,r)=>n+r.layer_merges,0),workers_participating:[...new Set(results.map(r=>r.worker))].sort((a,b)=>a-b),survivor_count:survivors.length,survivor_manifest:digestRows(survivors.map(row=>JSON.stringify([row.signature,row.objectives,row.score,row.cost]))),guard_fallback_jobs:results.filter(r=>r.guard_fallback).length,results:results.sort((a,b)=>a.id-b.id)};
   save(name+'-survivors.json',survivors.map(row=>({...row,config:JSON.parse(row.signature).map(([slotPath,itemId])=>({slotPath,itemId})),tunes:{}})));save(name+'.json',summary);outputs[name]={summary,survivors};sample();
  }
  phase='validation';const control=outputs.control,merged=outputs.merged;
  if(BigInt(control.summary.paths)!==BigInt(plan.total)||BigInt(merged.summary.paths)!==BigInt(plan.total))throw Error('Whole-domain counts differ from independent exact counter');
  if(control.summary.workers_participating.length!==workers||merged.summary.workers_participating.length!==workers)throw Error('Not all requested workers participated in both phases');
  for(let i=0;i<control.summary.results.length;i++){const a=control.summary.results[i],b=merged.summary.results[i];if(a.id!==b.id||a.paths!==b.paths||a.manifest!==b.manifest)throw Error('Per-job ranked population differs at '+a.id);}
  if(JSON.stringify(control.survivors)!==JSON.stringify(merged.survivors)||merged.survivors.length!==k||new Set(merged.survivors.map(r=>r.signature)).size!==k)throw Error('Exact selected identities/order differ');
  const replay=await Promise.all(pool.map((worker,id)=>send(worker,{action:'replay',rows:merged.survivors.filter((_,i)=>i%workers===id)})));
  const final={passed:true,request:input.request,population:dominance?'dominance-reduced grouped ordinary population before partial-state merging':'grouped ordinary population before partial-state merging',workers_requested:workers,workers_ready:workers,ranking_contract:rankingContract,gate_fraction:.005,exact_total:plan.total,selected:k,setup_ms:outputs.control.summary.wall_ms?undefined:0,total_wall_ms:performance.now()-began,peak_sampled_process_rss_bytes:peakRss,hardware:{logical_cpus:os.cpus().length,total_memory:os.totalmem(),platform:os.platform(),node:process.version},control:{...control.summary,results:undefined},merged:{...merged.summary,results:undefined},native_survivor_replays:replay.reduce((n,r)=>n+r.replays,0),per_job_score_identity_manifests_match:true,survivor_identities_and_order_match:true,notes:['No search deadlines or automatic restarts.','Ordinary/default calibration only; every selected concrete grouped identity is reconstructed.','No tactical completion or calibration search run.','A single control-then-merged pair: descriptive times, no confidence interval or causal speedup claim.','SHA-256 manifests compare every per-job signature/objective/cost row, including all aliases; standard cryptographic collision assumption.','Process RSS includes all Node worker threads; sampled every 500 ms, not browser memory.','Dominance and original grouped populations are distinct.']};
  save('final.json',final);save('resources.json',samples);console.log(JSON.stringify(final,null,2));
 }catch(error){save('failure.json',{error:error.stack,phase,completed,elapsed_ms:performance.now()-began});save('resources.json',samples);console.error(error);process.exitCode=1;}
 finally{clearInterval(interval);await Promise.all(pool.map(w=>w.terminate()));}
}
