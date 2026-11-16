import fs from 'node:fs';
import assert from 'node:assert/strict';
import {generate} from '../tools/optimizer_engine.mjs';
import {Shortlist,shortlistLimits} from '../tools/anytime_optimizer.mjs';
import {executeModel} from '../tools/builder_model.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json')),modules={curves,kernel,calculate},reports=[];
{
 const pool=new Shortlist(8,(a,b)=>a.score-b.score,2);
 for(let i=10000;i>=0;i--)pool.add({key:String(i),score:i,config:[{slotPath:'2',itemId:String(i%17)}],cost:i});
 assert.equal(pool.best().score,0);assert(pool.rows().length<=8);assert(pool.peak<=8);
 pool.add({key:'0',score:-1,config:[],cost:0});assert.equal(pool.best().score,-1);assert.equal(pool.rows().filter(r=>r.key==='0').length,1);
}
presets.future_test={...presets.recoil,label:'Future anytime preset'};
try{
 for(const [id,request] of [
  ['18010000001',{mode:'bd',preset:'recoil',time_limit_seconds:5}],
  ['18010000001',{mode:'bd',preset:'agility',time_limit_seconds:5}],
  ['18010000001',{mode:'bd',preset:'recoil',fixed:[{slotPath:'11',itemId:'13110000043'}],minimum_stats:{control:60},time_limit_seconds:1}],
  ['18010000001',{mode:'bd',preset:'agility',minimum_stats:{control:1000},time_limit_seconds:1}],
  ['18070000005',{mode:'sol',preset:'recoil',budget:5000000,time_limit_seconds:1}],
  ['18070000005',{mode:'mp',preset:'agility',time_limit_seconds:1}],
  ['18070000005',{mode:'bd',preset:'future_test',budgets:[0,100,200],time_limit_seconds:1}],
 ]){
  const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/'+id+'.json')),events=[],input={pack,shop:catalog.shop,prices:catalog.prices,request,onProgress:p=>events.push(p)},started=performance.now(),result=await generate(input,modules),ms=performance.now()-started;
  assert(ms<request.time_limit_seconds*1000+1500,JSON.stringify({id,request,ms}));
  assert.equal(result.solver.name,'Anytime');assert.equal(result.solver.time_limit_scope,'total_search');assert.equal(result.solver.global_optimality,false);
  assert.equal(result.attachment_gate.fraction,null);assert.equal(result.attachment_gate.complete,false);assert.deepEqual(result.attachment_gate.limits,shortlistLimits);
  assert(events.some(p=>p.phase==='search_attachments'));assert(events.some(p=>p.phase==='search_tactical'));assert(events.some(p=>p.phase==='calibration'));assert(!events.some(p=>p.total!==undefined));
  for(const d of result.attachment_gate.budgets){assert(d.ordinary_retained<=256);assert(d.ordinary_storage_peak<=256);assert(d.candidate_count<=512);assert(d.complete_storage_peak<=512);assert(d.cache_peak<=2048);assert.equal(d.source_errors,0);}
  if(request.minimum_stats?.control===1000){assert(result.results.every(row=>row.status==='not_found'));}
  else{
   assert(result.results.some(row=>row.status==='best_found'));
   for(const row of result.results.filter(row=>row.status==='best_found')){
    assert(!row.converged);const replay=await executeModel({...input,action:'evaluate',request:{mode:request.mode,config:row.config,tunes:row.tunes}},modules);assert.deepEqual(row.stats,replay.effective_stats);assert.equal(row.cost,replay.cost);
    if(row.budget!==null)assert(row.cost<=row.budget);
    for(const fixed of request.fixed??[])assert(replay.build.mounted.some(n=>n.slotPath===fixed.slotPath&&n.itemId===fixed.itemId));
    for(const [key,min] of Object.entries(request.minimum_stats??{}))assert(row.stats[key]>=min-1e-8);
   }
  }
  if(id==='18010000001'&&request.time_limit_seconds===5){const d=result.attachment_gate.budgets[0];assert(d.tactical_evaluated>0);assert(d.calibration_evaluations>0);assert(result.results.some(row=>row.status==='best_found'&&Object.keys(row.tunes).length));assert.equal(d.budget,800);}
  reports.push({id,request,elapsed_ms:ms,gate:result.attachment_gate,solver:result.solver,results:result.results.map(row=>({label:row.label,status:row.status,cost:row.cost,loss:row.loss}))});
  console.log(id+' '+request.mode+' '+request.preset+': bounded pools, total deadline, source replay and '+(request.minimum_stats?.control===1000?'honest not-found':'valid results')+' pass ('+ms.toFixed(0)+' ms)');
 }
 // Explicit cancellation remains distinct from the normal time limit.
 const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json')),controller=new AbortController();let events=0;
 await assert.rejects(()=>generate({pack,shop:catalog.shop,prices:catalog.prices,request:{mode:'bd',time_limit_seconds:5},signal:controller.signal,onProgress:()=>{if(++events===2)controller.abort();}},modules),{name:'AbortError'});
}finally{delete presets.future_test;}
fs.mkdirSync('.scratch/anytime-top-k',{recursive:true});fs.writeFileSync('.scratch/anytime-top-k/tests.json',JSON.stringify({passed:true,reports},null,2));
console.log('Full-cap M4A1 and all focused anytime-search cases pass.');
