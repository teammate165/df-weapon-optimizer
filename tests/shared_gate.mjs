import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import {exhaustiveAttachmentGate as optimizedGate} from '../tools/exhaustive_attachment_gate.mjs';
const baselineGate=(input,modules,preset)=>optimizedGate(input,modules,{...preset,stateReuse:undefined});
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json')),modules={curves,kernel,calculate},rows=[];
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
for(const [id,budget,name,mode,floor] of [
 ['18020000002',80,'recoil','bd'],['18020000002',80,'agility','bd'],
 ['18010000001',40,'recoil','bd'],['18070000005',200,'recoil','bd'],
 ['18070000005',200,'agility','bd'],['18070000005',200,'recoil','sol'],
 ['18070000005',5000000,'agility','sol'],['18070000005',200,'agility','mp'],
 ['18020000002',20,'recoil','bd',true]]){
 const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/'+id+'.json')),request={mode,budget},resolve=c=>curves.o(pack,c,mode);
 if(floor)request.minimum_stats={control:kernel.u(pack,resolve([]),{mode,tacticalEffective:true,tunes:{}}).numeric.mainAttr[3]+1};
 const preset=presets[name].create({pack,request,mode,resolve,...modules}),input={pack,shop:catalog.shop,prices:catalog.prices,request},before=[],after=[];
 let optimized;
 for(let run=0;run<4;run++){
  let baseline;
  for(const fast of run%2?[true,false]:[false,true]){
   const result=(fast?optimizedGate:baselineGate)(input,modules,preset);
   if(fast)optimized=result;else baseline=result;
   if(run)(fast?after:before).push(result.diagnostics.elapsed_ms);
  }
  assert.deepEqual(optimized.candidates,baseline.candidates);
  assert.deepEqual(optimized.diagnostics.attachments,baseline.diagnostics.attachments);
  assert.deepEqual(optimized.diagnostics.tactical,baseline.diagnostics.tactical);
 }
 const stats=optimized.diagnostics.stat_reuse;assert(stats.supported);assert.equal(stats.native_fallbacks,0);
 if(stats.requests>100){assert(stats.core_hits>0);assert(stats.prefix_hits>0);}
 const raw=preset.raw,changed={...preset,raw:(...args)=>raw(...args)};
 const fallback=optimizedGate(input,modules,changed);assert.equal(fallback.diagnostics.stat_reuse.supported,false);assert.deepEqual(fallback.candidates,optimized.candidates);
 rows.push({id,budget,preset:name,mode,floor:!!floor,candidates:optimized.candidates.length,before_ms:before,after_ms:after,before_median_ms:median(before),after_median_ms:median(after),speedup:median(before)/median(after),stat_reuse:stats});
 console.log(id+' '+name+' '+mode+' exact parity; median '+median(before).toFixed(2)+' -> '+median(after).toFixed(2)+' ms');
}
fs.writeFileSync('.scratch/shared-stats/gate-parity.json',JSON.stringify({passed:true,scope:'Alternating runs, first pair warmup, three timed pairs; scoped budgets only',rows},null,2));
