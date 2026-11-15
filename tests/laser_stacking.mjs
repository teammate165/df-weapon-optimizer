import assert from 'node:assert/strict';
import fs from 'node:fs';
import {executeModel} from '../tools/builder_model.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
const pack=JSON.parse(fs.readFileSync('.scratch/audit-pack.json'));
const modules={curves,kernel,calculate};
const input={pack,shop:{hiddenItemIds:[],partCosts:{},weapons:{}},prices:{}};
for(const mode of ['bd','sol','mp']) {
 const gains=[];
 for(const paths of [['4/19'],['4/19','4/20'],['4/19','4/20','4/17']]) {
  const config=paths.map(slotPath=>({slotPath,itemId:'13160000006'}));
  const result=await executeModel({...input,action:'evaluate',request:{mode,config}},modules);
  const off=kernel.u(pack,result.build,{mode,tacticalEffective:false});
  assert.equal(result.build.mounted.filter(m=>m.itemId==='13160000006').length,paths.length);
  gains.push({handling:result.effective_stats.handling-off.numeric.mainAttr['5'],accuracy:result.effective_stats.accuracy-off.numeric.mainAttr['4']});
  assert.equal(result.stats.current.handling.adsTimeMs,calculate(pack,{mode,resolvedLoadout:result.build,tunes:result.tunes,tacticalEffective:true,preservePrecision:true}).current.handling.adsTimeMs);
 }
 console.log(mode,JSON.stringify(gains));
 assert.deepEqual(gains[1],gains[0],'A second laser must not add another enabled bonus');
 assert.deepEqual(gains[2],gains[0],'A third laser must not add another enabled bonus');
}
// Mixed laser IDs share the same cap, while ordinary penalties remain additive.
for(const mode of ['bd','sol','mp']) {
 const config=[{slotPath:'4/19',itemId:'13160000005'},{slotPath:'4/20',itemId:'13160000014'}];
 const result=await executeModel({...input,action:'evaluate',request:{mode,config,compare_slot:'4/19',response_stat:'5'}},modules);
 const off=kernel.u(pack,result.build,{mode,tacticalEffective:false});
 const maximum=Math.max(...config.map(m=>kernel.c(pack,m.itemId,mode).find(op=>op.scope==='TacticalEffective'&&op.target==='WeaponMainAttribute.MainAttrValues.5').value));
 assert.equal(result.effective_stats.handling-off.numeric.mainAttr['5'],maximum);
 assert.equal(result.response_curve.current_main,result.effective_stats.handling);
}
if(process.argv.includes('--optimizer')) {
 const {generate}=await import('../tools/optimizer_engine.mjs');
 const shop=JSON.parse(fs.readFileSync('data/dfttk/catalog/bd-shop.json'));
 for(const preset of ['recoil','agility']) {
  const result=await generate({...input,shop,request:{mode:'bd',preset,passes:1}},modules);
  for(const r of result.results.filter(r=>r.status==='best_found'))assert(r.mounted.filter(m=>kernel.l(pack,m.itemId,'bd')).length<=1);
 }
 const fixed=[{slotPath:'4/19',itemId:'13160000006'},{slotPath:'4/20',itemId:'13160000006'}];
 const result=await generate({...input,shop,request:{mode:'bd',preset:'recoil',passes:1,fixed}},modules);
 const max=result.results.find(r=>r.status==='best_found');assert(max);
 for(const f of fixed)assert(max.mounted.some(m=>m.slotPath===f.slotPath&&m.itemId===f.itemId));
 const replay=await executeModel({...input,shop,action:'evaluate',request:{mode:'bd',config:max.config,tunes:max.tunes}},modules);
 assert.deepEqual(replay.effective_stats,max.stats);
 console.log('Both presets avoid redundant lasers; locked multi-laser build replays with capped totals');
}
