// Independent full-sort oracle for the new incremental ranking heap. The
// integration runner separately compares the complete native/DAG population.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {createRankingHeap} from '../tools/ranked_screening_heap.mjs';
import {screeningComparator,survivorCount} from '../tools/screening_rank.mjs';

if(!isMainThread){
 parentPort.postMessage({ready:true});
 parentPort.once('message',async()=>{try{
  let seed=workerData.id+31;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;},compare=screeningComparator({control:40});
  const rows=Array.from({length:4001},(_,i)=>({stats:{control:39+(random()%4)},objectives:[random()%53,random()%11],cost:random()%5,signature:String(i).padStart(6,'0')}));
  for(let i=rows.length-1;i>0;i--){const j=random()%(i+1);[rows[i],rows[j]]=[rows[j],rows[i]];}
  const sorted=[...rows].sort(compare);
  for(const k of [0,1,2,21,99,4001,4002]){const heap=createRankingHeap(k,compare);for(const row of rows)heap.offer(row);assert.deepEqual(heap.rows(),sorted.slice(0,k));assert.equal(heap.size,Math.min(k,rows.length));}
  // All sixteen globally best rows can come from one shard. Per-shard 0.5%
  // would retain only one of them; global K per shard retains all sixteen.
  const shards=Array.from({length:16},(_,shard)=>Array.from({length:200},(_,i)=>({stats:{control:40},objectives:[shard*10000+i],cost:0,signature:shard+':'+i}))),all=shards.flat(),k=Number(survivorCount(all.length));
  const global=all.sort(compare).slice(0,k),local=shards.flatMap(rows=>[...rows].sort(compare).slice(0,Number(survivorCount(rows.length)))).sort(compare).slice(0,k);
  assert.notDeepEqual(local,global);
  const correct=createRankingHeap(k,compare);for(const shard of shards){const heap=createRankingHeap(k,compare);for(const row of shard)heap.offer(row);for(const row of heap.rows())correct.offer(row);}assert.deepEqual(correct.rows(),global);
  const kernel=await import('../.scratch/calibration-check/kernel.mjs'),curves=await import('../.scratch/calibration-check/curves.mjs'),{t:calculate}=await import('../.scratch/calibration-check/attributes.mjs'),{presets}=await import('../tools/optimizer_presets.mjs'),{configKey}=await import('../tools/exhaustive_attachment_gate.mjs');
  const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json','utf8')),catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json','utf8')),request={mode:'bd',preset:'recoil',budget:800},resolve=config=>curves.o(pack,config,'bd'),preset=presets.recoil.create({pack,request,mode:'bd',resolve,kernel,curves,calculate});
  // Fresh worker and uncached kernel.u, independent of both study evaluators.
  for(const row of workerData.selected){const build=resolve(row.config),state=kernel.u(pack,build,{mode:'bd',tacticalEffective:true,tunes:{}}),raw=preset.raw(build,{},state);assert.deepEqual(preset.objectives(raw),row.objectives);assert.equal(preset.score(raw),row.score);assert.equal(configKey(build.config),row.signature);assert.equal(build.mounted.filter(n=>n.source==='equipped').reduce((n,p)=>n+catalog.shop.partCosts[p.itemId],0),row.cost);assert(build.mounted.some(n=>n.slotPath==='11'&&n.itemId==='13110000091'));}
  parentPort.postMessage({passed:true,id:workerData.id,rows:rows.length,capacities:7,uncached_native_survivor_replays:workerData.selected.length});
 }catch(error){parentPort.postMessage({passed:false,id:workerData.id,error:error.stack});}});
}else{
 const selected=JSON.parse(fs.readFileSync('data/optimizer_validation/m4a1_merged_ranked_20261118/merged-survivors.json','utf8'));
 const pool=[];try{
  const ready=[];for(let id=0;id<16;id++){const worker=new Worker(new URL(import.meta.url),{workerData:{id,selected:selected.filter((_,i)=>i%16===id)}});pool.push(worker);ready.push(new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}));}await Promise.all(ready);
  const results=await Promise.all(pool.map(worker=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({run:true});})));
  const report={passed:results.every(r=>r.passed),workers:16,uncached_native_survivor_replays:results.reduce((n,r)=>n+(r.uncached_native_survivor_replays??0),0),results,checks:['new heap versus independent full sort at seven capacities','exact global-K distributed selection','counterexample to independent local-percentile retention','fresh-worker uncached native replay of every survivor']};
  fs.mkdirSync('data/optimizer_validation/m4a1_merged_ranked_20261118',{recursive:true});fs.writeFileSync('data/optimizer_validation/m4a1_merged_ranked_20261118/component-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
 }finally{await Promise.all(pool.map(w=>w.terminate()));}
}
