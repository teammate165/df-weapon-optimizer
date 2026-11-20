import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {survivorCount,screeningComparator,gateFraction} from '../tools/screening_rank.mjs';
import {retainBest} from '../tools/exhaustive_attachment_gate.mjs';

if(!isMainThread){
 parentPort.postMessage({ready:true});
 parentPort.once('message',async()=>{
  try{
   const began=performance.now(),compare=screeningComparator({control:40});
   const row=(i,score=1)=>({stats:{control:40},objectives:[score,2],cost:10,signature:String(i).padStart(6,'0')});
   assert.equal(gateFraction,.005);
   const exported=await import('../.scratch/github-pages-site/model/screening_rank.mjs');
   assert.equal(exported.gateFraction,.005);assert.equal(exported.survivorCount(12885654),64429n);
   for(const n of [0,1,199,200,201,399,400,401,12885654,1696710])assert.equal(survivorCount(n),BigInt(Math.ceil(n/200)));
   assert.equal(survivorCount(10n**30n+1n),(10n**30n)/200n+1n);
   assert.throws(()=>survivorCount(-1));assert.throws(()=>survivorCount(Number.MAX_SAFE_INTEGER+1));
   // Near-equal triples exposed the legacy non-transitive epsilon relation.
   const triple=[row(2,1),row(1,1+8e-13),row(0,1+16e-13)];
   assert(compare(triple[0],triple[1])<0&&compare(triple[1],triple[2])<0&&compare(triple[0],triple[2])<0);
   assert(compare({...row(0),stats:{control:40-1e-10},objectives:[0]}, {...row(1),objectives:[99]})>0);
   assert.throws(()=>compare(row(0,NaN),row(1)));
   // Aliases from equal-state classes interleave at the canonical identity tie.
   const aliases=[row(0),row(2),row(4),row(1),row(3),...Array.from({length:396},(_,i)=>row(i+5,2))];
   const selected=retainBest(aliases,401n,compare);assert.deepEqual(selected.map(r=>r.signature),['000000','000001','000002']);
   // Vary traversal/partition order by worker. Each shard keeps GLOBAL K,
   // never its own rounded percentage; coordinator then selects global K.
   let seed=workerData.id+17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
   const rows=Array.from({length:2401},(_,i)=>row(i,(random()%47)/7));
   for(let i=rows.length-1;i>0;i--){const j=random()%(i+1);[rows[i],rows[j]]=[rows[j],rows[i]];}
   const expected=[...rows].sort(compare).slice(0,13);
   const shards=Array.from({length:16},()=>[]);rows.forEach((r,i)=>shards[(i*7+workerData.id)%16].push(r));
   const union=shards.flatMap(shard=>retainBest(shard,2401n,compare));
   assert.deepEqual(retainBest(union,2401n,compare),expected);
   assert.deepEqual(retainBest(rows,2401n,compare),expected);
   // Exercise both native exhaustive stages, all modes/presets/locks and
   // source replay, bounds and sparse SCIP membership in every worker.
   process.env.RANK_WORKER_ID=String(workerData.id);
   await import('./exhaustive_attachment_gate.mjs');
   const {studyCount}=await import('../tools/exhaustive_screening_study.mjs');
   const kernel=await import('../.scratch/calibration-check/kernel.mjs'),curves=await import('../.scratch/calibration-check/curves.mjs'),{t:calculate}=await import('../.scratch/calibration-check/attributes.mjs');
   const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json','utf8')),catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json','utf8'));
   const count=studyCount({pack,shop:catalog.shop,prices:catalog.prices,request:{mode:'bd',preset:'recoil',budget:45,fixed:[{slotPath:'11',itemId:'13110000091'}]}},{kernel,curves,calculate});
   assert.equal(count.gate_fraction,.005);assert.equal(count.survivor_rows,String(survivorCount(count.total)));assert(!Object.hasOwn(count,'top_five_percent_rows'));
   parentPort.postMessage({passed:true,id:workerData.id,elapsed_ms:performance.now()-began});
  }catch(error){parentPort.postMessage({passed:false,id:workerData.id,error:error.stack});}
 });
}else{
 const began=performance.now(),pool=[];
 try{
  const ready=[];for(let id=0;id<16;id++){const worker=new Worker(new URL(import.meta.url),{workerData:{id}});pool.push(worker);ready.push(new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}));}
  await Promise.all(ready);
  const tasks=pool.map(worker=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({run:true});}));
  const results=await Promise.all(tasks),report={passed:results.every(r=>r.passed),workers_requested:16,workers_ready:16,participating_workers:results.map(r=>r.id),elapsed_ms:performance.now()-began,checks:['ceil(N/200) boundaries and BigInt','strict near-tie transitivity','multiplicity boundary aliases','global-K shard merge parity','native two-stage exact gate reference suite in each worker'],results};
  const dir='data/optimizer_validation/ranking_20261118';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+'/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  if(!report.passed)process.exitCode=1;
 }finally{await Promise.all(pool.map(w=>w.terminate()));}
}
