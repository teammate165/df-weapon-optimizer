import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {createMergedScreening} from '../tools/merged_screening.mjs';
import {studyCount,screeningPlan} from '../tools/exhaustive_screening_study.mjs';
import {screeningComparator,survivorCount} from '../tools/screening_rank.mjs';

if(!isMainThread){
 const kernel=await import('../.scratch/calibration-check/kernel.mjs'),curves=await import('../.scratch/calibration-check/curves.mjs'),{t:calculate}=await import('../.scratch/calibration-check/attributes.mjs'),modules={kernel,curves,calculate};
 const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json','utf8')),catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json','utf8'));
 const request={mode:'bd',preset:'recoil',budget:800,fixed:[{slotPath:'11',itemId:'13110000091'}],experimental_dominance:false},input={pack,shop:catalog.shop,prices:catalog.prices,request};
 parentPort.postMessage({ready:true});parentPort.once('message',()=>{try{
  const began=performance.now();
  for(const create of [createMergedScreening,screeningPlan,studyCount])assert.throws(()=>create({...input,request:{...request,experimental_dominance:true}},modules),/Dominance is disabled/);
  const full=studyCount(input,modules);assert.equal(full.total,'12268642');assert.equal(full.survivor_rows,'61344');assert.equal(full.gate_fraction,.005);
  const smallInput={...input,request:{...request,budget:160}},study=createMergedScreening(smallInput,modules),plan=study.plan(),flat=[],merged=[];
  assert.equal(plan.dominance_enabled,false);assert.equal(plan.total,'385');
  for(const job of plan.jobs){study.flat(job,row=>flat.push(row));study.merged(job,row=>merged.push(row));}
  const compare=screeningComparator({});flat.sort(compare);merged.sort(compare);assert.deepEqual(merged,flat);assert.equal(flat.length,385);assert.equal(new Set(flat.map(r=>r.signature)).size,385);
  assert.deepEqual(merged.slice(0,Number(survivorCount(plan.total))),flat.slice(0,2));
  parentPort.postMessage({passed:true,id:workerData.id,full_count:full.total,full_survivors:full.survivor_rows,small_paths:flat.length,elapsed_ms:performance.now()-began});
 }catch(error){parentPort.postMessage({passed:false,id:workerData.id,error:error.stack});}});
}else{
 const pool=[];try{
  const ready=[];for(let id=0;id<8;id++){const worker=new Worker(new URL(import.meta.url),{workerData:{id}});pool.push(worker);ready.push(new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}));}await Promise.all(ready);
  const results=await Promise.all(pool.map(worker=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({run:true});})));
  const report={passed:results.every(r=>r.passed),workers_requested:8,workers_ready:8,participating_workers:results.map(r=>r.id),scope:'full800-point exact count plus complete160-point native/DAG score-identity parity; not a full800-point scored scan',checks:['dominance rejected by active exhaustive entry points','original grouped ordinary count12268642','top0.5% count61344','all385 small-domain score/identity rows match','small-domain survivor order matches'],results};
  const directory=process.env.EXACT_DAG_VALIDATION_OUTPUT?process.env.EXACT_DAG_VALIDATION_OUTPUT+'/population-policy':'data/optimizer_validation/exhaustive_population_policy_20261118';fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(directory+'/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
 }finally{await Promise.all(pool.map(worker=>worker.terminate()));}
}
