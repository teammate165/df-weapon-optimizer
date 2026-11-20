// Research-only root collision census. Every measurement uses 16 workers.
import fs from 'node:fs';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {createPartialStateStudy} from './partial_state_merging_study.mjs';
const workers=16;
if(!isMainThread){
 const kernel=await import('../.scratch/calibration-check/kernel.mjs');
 const curves=await import('../.scratch/calibration-check/curves.mjs');
 const {t:calculate}=await import('../.scratch/calibration-check/attributes.mjs');
 // Full canonical strings avoid probabilistic hash equivalence and permit
 // exact comparison between independently initialized workers.
 const study=createPartialStateStudy(workerData.input,{kernel,curves,calculate},(kind,key)=>kind+':'+key);
 parentPort.postMessage({ready:true,id:workerData.id});
 parentPort.on('message',message=>{
  if(message.stop){parentPort.close();return;}
  const began=performance.now();
  try{parentPort.postMessage({id:workerData.id,records:message.configs.map(config=>{try{return study.analyzeRoot(config);}catch(error){return {config,rejected:error.message};}}),elapsed_ms:performance.now()-began});}
  catch(error){parentPort.postMessage({id:workerData.id,error:error.stack});}
 });
}else{
 const began=performance.now();
 const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json','utf8'));
 const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json','utf8'));
 const input={pack,shop:catalog.shop,prices:catalog.prices,request:{mode:'bd',preset:'recoil',budget:800,fixed:[{slotPath:'11',itemId:'13110000091'}],experimental_dominance:true}};
 // Reuse previously enumerated structural inputs; all native evaluation and
 // collision classification below runs in the requested compute pool.
 const configs=JSON.parse(fs.readFileSync('.scratch/partial-state-merging/root-census-refined.json','utf8')).records.map(r=>r.config);
 const pool=[],ready=[],results=[];
 try{
  for(let id=0;id<workers;id++){
   const worker=new Worker(new URL(import.meta.url),{workerData:{input,id},resourceLimits:{maxOldGenerationSizeMb:256}});pool.push(worker);
   ready.push(new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}));
  }
  await Promise.all(ready);
  const computeStart=performance.now();
  for(let id=0;id<workers;id++)results.push(new Promise((resolve,reject)=>{
   const worker=pool[id];worker.once('message',m=>m.error?reject(Error(m.error)):resolve(m));worker.once('error',reject);
   worker.postMessage({configs:configs.filter((_,index)=>index%workers===id)});
  }));
  const batches=await Promise.all(results),allRecords=batches.flatMap(b=>b.records),records=allRecords.filter(r=>!r.rejected),rejected=allRecords.filter(r=>r.rejected);
  const levels=Array.from({length:5},(_,level)=>{const counts=new Map();for(const r of records){const key=JSON.stringify([r.shape,r.keys[level]]);counts.set(key,(counts.get(key)??0)+1);}return {level,unique:counts.size,merged:records.length-counts.size,largest_class:Math.max(...counts.values())};});
  const report={scope:'root-prefix census only; no completed-layout count or speedup claim',workers_requested:workers,workers_ready:ready.length,participating_worker_ids:batches.map(b=>b.id),input_prefixes:allRecords.length,rejected_prefixes:rejected.length,rejection_reasons:[...new Set(rejected.map(r=>r.rejected))],root_prefixes:records.length,closed_prefixes:records.filter(r=>!r.unsafe.length).length,unsafe_reasons:[...new Set(records.flatMap(r=>r.unsafe))],continuation_shapes:new Set(records.map(r=>r.shape)).size,levels,compute_wall_ms:performance.now()-computeStart,total_wall_ms:performance.now()-began,worker_compute_ms:batches.map(b=>({id:b.id,ms:b.elapsed_ms,roots:b.records.length})),records,rejected};
  const directory='data/optimizer_validation/m4a1_partial_state_20261118';fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(directory+'/root-census.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,records:undefined,rejected:undefined},null,2));
 }finally{await Promise.all(pool.map(w=>w.terminate()));}
}
