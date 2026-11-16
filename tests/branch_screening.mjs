import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import {compileMounts} from '../tools/scip_mount_model.mjs';
import {createMountSearch} from '../tools/mount_search.mjs';
import {createBranchScoreBound} from '../tools/branch_score_bounds.mjs';
import {exhaustiveAttachmentGate as gate} from '../tools/exhaustive_attachment_gate.mjs';
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json')),pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json')),modules={curves,kernel,calculate},reports=[];
const same=(a,b)=>{assert.deepEqual(a.candidates,b.candidates);assert.deepEqual(a.diagnostics.attachments,b.diagnostics.attachments);assert.deepEqual(a.diagnostics.tactical,b.diagnostics.tactical);};
for(const [mode,budget,name,extra] of [['bd',40,'recoil',{}],['bd',40,'agility',{}],['bd',60,'recoil',{}],['bd',20,'recoil',{minimum_stats:{control:55}}],['bd',40,'agility',{fixed:[{slotPath:'11',itemId:'13110000043'}]}],['sol',20000,'recoil',{}]]){
 const request={mode,budget,...extra},resolve=c=>curves.o(pack,c,mode),preset=presets[name].create({pack,request,mode,resolve,...modules}),input={pack,shop:catalog.shop,prices:catalog.prices,request};
 const full=gate(input,modules,preset,{incremental:false,branchBounds:false}),incremental=gate(input,modules,preset,{branchBounds:false}),bounded=gate(input,modules,preset),uncapped=gate(input,modules,preset,{branchBudgetFraction:Infinity});
 same(incremental,full);same(bounded,full);same(uncapped,full);
 assert(incremental.diagnostics.ranking.constraint_evaluations<full.diagnostics.ranking.constraint_evaluations);
 assert.equal(bounded.diagnostics.branch_scoring.declined,0);
 if(mode==='bd'&&budget===40&&!extra.fixed){assert(uncapped.diagnostics.ranking.pruned_branches>0);assert(bounded.diagnostics.branch_scoring.evaluations>0);}
 const raw=preset.raw,future={...preset,raw:(...args)=>raw(...args)},fallback=gate(input,modules,future);same(fallback,full);assert.equal(fallback.diagnostics.branch_scoring.supported,false);
 reports.push({mode,budget,preset:name,extra,counts:full.diagnostics.attachments,candidates:full.candidates.length,full_ms:full.diagnostics.elapsed_ms,incremental_ms:incremental.diagnostics.elapsed_ms,bounded_ms:bounded.diagnostics.elapsed_ms,full_constraints:full.diagnostics.ranking.constraint_evaluations,incremental_constraints:incremental.diagnostics.ranking.constraint_evaluations,bounded:bounded.diagnostics.branch_scoring,pruned_branches:bounded.diagnostics.ranking.pruned_branches,uncapped_pruned_branches:uncapped.diagnostics.ranking.pruned_branches});
 console.log('M4A1 '+mode+' '+budget+' '+name+': exact survivors/counts; '+full.diagnostics.ranking.constraint_evaluations+' -> '+incremental.diagnostics.ranking.constraint_evaluations+' constraint checks');
}
// Independent partial Boolean evaluator: compare a bound with every legal
// completion, including tactical devices, rather than trusting the pruned walk.
let comparisons=0,sourceScores=0;
for(const name of ['recoil','agility']){
 const mode='bd',request={mode,budget:40},input={pack,shop:catalog.shop,prices:catalog.prices,request},compiled=compileMounts(input,kernel),resolve=c=>curves.o(pack,c,mode),preset=presets[name].create({pack,request,mode,resolve,...modules});
 const all=[...createMountSearch(compiled,{incremental:false}).enumerate()].map(config=>({config,selected:new Set(config.map(c=>c.slotPath+'|'+c.itemId)),score:preset.score(preset.raw(resolve(config),{}))}));sourceScores+=all.length;
 const paths=[...new Set([...compiled.players.values()].filter(p=>typeof p.value==='string').map(p=>p.path))].sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b));
 for(const limits of [{},{maxEntries:0,maxKeyChars:0},{maxEntries:1,maxKeyChars:1024}]){
  const bound=createBranchScoreBound({pack,request,compiled,preset,...modules,...limits});assert(bound);
  for(const witness of all.filter((_,i)=>i%137===0))for(const depth of [0,3,8,paths.length-3,paths.length]){
   const fixedPaths=new Set(paths.slice(0,depth)),assigned=new Map([...compiled.players].filter(([,p])=>typeof p.value==='string'&&fixedPaths.has(p.path)).map(([key,p])=>[p.value,witness.selected.has(key)?[1,1]:[0,0]]));
   const get=name=>{
    if(typeof name==='number')return [name,name];if(assigned.has(name))return assigned.get(name);
    const node=compiled.model.booleanNodes.get(name);let value=[0,1];
    if(node){const args=node.args.map(get);value=node.kind==='not'?[1-args[0][1],1-args[0][0]]:node.kind==='and'?[Number(args.every(a=>a[0])),Number(args.every(a=>a[1]))]:[Number(args.some(a=>a[0])),Number(args.some(a=>a[1]))];}
    assigned.set(name,value);return value;
   };
   const lower=bound.lower({interval:get});assert.notEqual(lower,null);
   const completions=all.filter(row=>[...compiled.players].every(([key,p])=>!fixedPaths.has(p.path)||row.selected.has(key)===witness.selected.has(key)));
   assert(completions.length);for(const row of completions){assert(lower<=row.score+1e-8,JSON.stringify({name,depth,lower,score:row.score}));comparisons++;}
  }
  assert.equal(bound.getStats().declined,0);if(limits.maxEntries!==undefined)assert(bound.getStats().saturated);
 }
 const opaque={...kernel,u:(...args)=>kernel.u(...args)};assert.equal(createBranchScoreBound({pack,request,compiled,preset,...modules,kernel:opaque}),null);
}
fs.mkdirSync('.scratch/branch-screen',{recursive:true});fs.writeFileSync('.scratch/branch-screen/tests.json',JSON.stringify({passed:true,weapon_id:pack.weaponId,source_scores:sourceScores,bound_completion_comparisons:comparisons,reports},null,2));
console.log('M4A1 partial-build bounds stay below '+comparisons+' exact legal completion scores; cache caps and source/scorer fallbacks pass.');
