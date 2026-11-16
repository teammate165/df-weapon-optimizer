import assert from 'node:assert/strict';
import fs from 'node:fs';
import {exhaustiveAttachmentGate} from '../tools/exhaustive_attachment_gate.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import {createRecoilScreeningBound} from '../tools/scoring_bounds.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as sourceCalculate} from '../.scratch/calibration-check/attributes.mjs';
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json')),reports=[];
for(const [id,budget,presetName,floors] of [['18020000002',80,'recoil',false],['18020000003',40,'recoil',false],['18050000007',20,'recoil',false],['18020000002',20,'agility',false],['18020000002',80,'recoil',true]]){
 const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/'+id+'.json')),mode='bd',request={mode,budget},resolve=c=>curves.o(pack,c,mode);let calls=0;
 const calculate=sourceCalculate,modules={curves,kernel,calculate};
 if(floors)request.minimum_stats={control:kernel.u(pack,resolve([]),{mode,tacticalEffective:true,tunes:{}}).numeric.mainAttr[3]+1};
 const preset=presets[presetName].create({pack,request,mode,resolve,...modules}),originalRaw=preset.raw;
 preset.raw=(...args)=>{calls++;return originalRaw(...args);};
 if(preset.screeningBound)preset.screeningBound={...preset.screeningBound,raw:preset.raw};
 const input={pack,shop:catalog.shop,prices:catalog.prices,request};
 calls=0;const baseline=exhaustiveAttachmentGate(input,modules,{...preset,screeningBound:undefined}),baselineCalls=calls;
 calls=0;const optimized=exhaustiveAttachmentGate(input,modules,preset),optimizedCalls=calls;
 assert.deepEqual(optimized.candidates,baseline.candidates);assert.deepEqual(optimized.diagnostics.attachments,baseline.diagnostics.attachments);assert.deepEqual(optimized.diagnostics.tactical,baseline.diagnostics.tactical);
 assert.equal(baselineCalls-optimizedCalls,optimized.diagnostics.scoring.pruned);assert.equal(optimized.diagnostics.scoring.full_evaluations,optimizedCalls);
 assert.equal(optimized.diagnostics.scoring.full_evaluations+optimized.diagnostics.scoring.pruned,optimized.diagnostics.scoring.considered);
 if(id==='18020000002'&&budget===80&&!floors){
  assert(optimized.diagnostics.scoring.pruned>500);assert(optimized.diagnostics.scoring.group_cache_hits>500);
  for(const maxGroupEntries of [0,1]){
   const screeningBound=createRecoilScreeningBound({pack,request,mode,curves,kernel,calculate,raw:preset.raw,score:preset.score,objectives:preset.objectives,chartPattern:true,maxGroupEntries,maxGroupKeyChars:4096});
   const limited=exhaustiveAttachmentGate(input,modules,{...preset,screeningBound});assert.deepEqual(limited.candidates,baseline.candidates);assert.equal(limited.diagnostics.scoring.pruned,optimized.diagnostics.scoring.pruned);assert(limited.diagnostics.scoring.group_entries_peak<=maxGroupEntries);assert(limited.diagnostics.scoring.group_key_chars_peak<=4096);assert(limited.diagnostics.scoring.group_cache_saturated);
  }
 }
 if(floors)assert(optimized.diagnostics.counting.source_floor_fallbacks>0);
 if(presetName==='agility')assert(!optimized.diagnostics.scoring.supported);
 reports.push({id,budget,preset:presetName,floors,baseline_calls:baselineCalls,optimized_calls:optimizedCalls,scoring:optimized.diagnostics.scoring,counting:optimized.diagnostics.counting,candidates:optimized.candidates.map(c=>c.signature)});
}
// A bound provider that declines a protocol must preserve ordinary scoring.
{
 const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18020000002.json')),request={mode:'bd',budget:20},resolve=c=>curves.o(pack,c,'bd'),modules={curves,kernel,calculate:sourceCalculate},preset=presets.recoil.create({pack,request,mode:'bd',resolve,...modules});
 const certificate={...preset.screeningBound,lower:()=>null},result=exhaustiveAttachmentGate({pack,shop:catalog.shop,prices:catalog.prices,request},modules,{...preset,screeningBound:certificate});
 assert.equal(result.diagnostics.scoring.pruned,0);assert(result.diagnostics.scoring.unsupported_fallbacks>0);assert.equal(result.diagnostics.scoring.full_evaluations,result.diagnostics.scoring.considered);
}
fs.writeFileSync('.scratch/subtree-counting/bounded-parity.json',JSON.stringify({passed:true,reports},null,2));
console.log('Bounded scoring preserves exact candidate sets and both-stage counts, including floors, Agility and unsupported fallbacks; full source scoring calls saved equal the reported prunes.');
