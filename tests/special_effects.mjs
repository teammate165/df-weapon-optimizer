import assert from 'node:assert/strict';
import fs from 'node:fs';
import {executeModel} from '../tools/builder_model.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
const pack=JSON.parse(fs.readFileSync(process.argv[2]??'.scratch/audit-pack.json'));
const modules={curves,kernel,calculate};
const input={pack,shop:{hiddenItemIds:[],partCosts:{},weapons:{}},prices:{}};
for(const mode of ['sol','mp','bd']) {
 const config=[{slotPath:'4/17',itemId:'13160000006'}];
 const on=await executeModel({...input,action:'evaluate',request:{mode,config}},modules);
 const off=kernel.u(pack,curves.o(pack,config,mode),{mode,tacticalEffective:false});
 assert.equal(on.effective_stats.handling,off.numeric.mainAttr['5']+(mode==='mp'?7:16),'LA-3C ON handling');
 assert.equal(on.effective_stats.accuracy,off.numeric.mainAttr['4']+12,'LA-3C ON accuracy');
 const expected=calculate(pack,{mode,config,tacticalEffective:true,preservePrecision:true});
 assert.equal(on.stats.current.handling.adsTimeMs,expected.current.handling.adsTimeMs);
}
console.log('Laser default-ON evaluation passed in all modes');

const {emptyRisers,completeRiserOptics}=await import('../tools/optimizer_mounts.mjs');
const resolve=config=>curves.o(pack,config,'bd');
for(const itemId of ['13210000012','13210000013','13210000014']) {
 const fixed=[{slotPath:'11',itemId}];
 assert.equal(emptyRisers(pack,resolve(fixed)).length,1);
 const builds=[...completeRiserOptics(pack,resolve(fixed),resolve,fixed)];
 assert(builds.length>0);
 for(const b of builds){assert.equal(emptyRisers(pack,b).length,0);assert(b.config.some(c=>c.slotPath==='11'&&c.itemId===itemId));}
}
const nested=[{slotPath:'11',itemId:'13210000013'},{slotPath:'11/50',itemId:'13210000012'}];
for(const b of completeRiserOptics(pack,resolve(nested),resolve,nested))assert.equal(emptyRisers(pack,b).length,0);
const laserOnly=resolve([{slotPath:'11',itemId:'13210000013'},{slotPath:'11/14',itemId:'13160000006'}]);
assert.equal(emptyRisers(pack,laserOnly).length,1,'laser is not a raised optic');
console.log('All three risers, nested risers and laser-only mount checks passed');

// Cover every enabled laser record in this weapon pack, including the light/laser.
for(const mode of ['sol','mp','bd'])for(const id of ['13160000005','13160000006','13160000009','13160000010','13160000014']) {
 const config=[{slotPath:'4/19',itemId:id}];
 const on=await executeModel({...input,action:'evaluate',request:{mode,config,compare_slot:'4/19',response_stat:'5'}},modules);
 const build=curves.o(pack,config,mode);
 assert(build.mounted.some(m=>m.itemId===id));
 const expected=kernel.u(pack,build,{mode,tacticalEffective:true});
 assert.equal(on.effective_stats.handling,expected.numeric.mainAttr['5']);
 assert.equal(on.response_curve.current_main,expected.numeric.mainAttr['5']);
 const replacement=on.comparisons.find(c=>c.itemId==='13160000006');
 assert.equal(replacement.tactical.included,true);
 assert(replacement.tactical.operations.some(op=>op.target==='WeaponMainAttribute.MainAttrValues.5'&&op.value===(mode==='mp'?7:16)));
 const other=await executeModel({...input,action:'evaluate',request:{mode,config:[{slotPath:'4/19',itemId:'13160000006'}]}},modules);
 assert.equal(replacement.stats.handling.adsTimeMs,other.stats.current.handling.adsTimeMs);
}
console.log('Laser variants and picker comparison parity passed');

const fixed=[{slotPath:'11',itemId:'13210000013'}];
const infeasible=await executeModel({...input,prices:{'13210000013':1},action:'optimize',
 request:{mode:'sol',budget:1,passes:1,fixed}},modules);
assert(infeasible.results.every(r=>r.status==='infeasible'),'riser cannot bypass missing optic quotes/budget');
const locked=[...fixed,{slotPath:'11/50',itemId:'13110000040'}];
assert.deepEqual([...completeRiserOptics(pack,resolve(locked),resolve,locked)].map(b=>b.config),[resolve(locked).config]);
console.log('Required optic cost, missing quotes and locked optic checks passed');

if(process.argv[3]) {
 const jadPack=JSON.parse(fs.readFileSync(process.argv[3]));
 for(const mode of ['sol','mp','bd']) {
  const config=[{slotPath:'2',itemId:'13020000484'},{slotPath:'2/19',itemId:'13160000020'}];
  const build=curves.o(jadPack,config,mode);
  assert(build.mounted.some(m=>m.itemId==='13160000020'));
  const on=await executeModel({...input,pack:jadPack,action:'evaluate',request:{mode,config}},modules);
  const expected=kernel.u(jadPack,build,{mode,tacticalEffective:true,tunes:on.tunes});
  assert.equal(on.effective_stats.handling,expected.numeric.mainAttr['5']);
  assert.equal(on.effective_stats.accuracy,expected.numeric.mainAttr['4']);
 }
 console.log('JAD underbarrel laser enabled effects passed in all modes');
}

// Lasers default ON, but deployed bipod effects must never enter optimizer
// objectives. Exercise both presets with real mounted bipods in every mode.
const {presets}=await import('../tools/optimizer_presets.mjs');
for(const mode of ['sol','mp','bd'])for(const mount of [
 {slotPath:'4/10',itemId:'13170000004'},
 {slotPath:'4/8',itemId:'13140000038'},
]) {
 const build=curves.o(pack,[mount],mode);
 assert(build.mounted.some(m=>m.itemId===mount.itemId));
 assert.equal(kernel.l(pack,mount.itemId,mode),false);
 const off=kernel.u(pack,build,{mode,tacticalEffective:false});
 const actual=kernel.u(pack,build,{mode,tacticalEffective:true});
 assert(!actual.operations.some(op=>op.sourceItemId===mount.itemId&&op.scope==='TacticalEffective'));
 for(const presetName of ['recoil','agility']){
  const preset=presets[presetName].create({pack,request:{mode},mode,kernel,curves,calculate,
   resolve:config=>curves.o(pack,config,mode)});
  assert.deepEqual(preset.raw(build,{}),preset.raw(build,{},off),presetName+' excludes deployed bipod effects');
 }
 const evaluated=await executeModel({...input,action:'evaluate',request:{mode,config:[mount],compare_slot:mount.slotPath}},modules);
 const row=evaluated.comparisons.find(row=>row.itemId===mount.itemId);
 assert.equal(row.tactical.included,false);
 assert.deepEqual(evaluated.stats.current,calculate(pack,{mode,resolvedLoadout:build,tacticalEffective:false,tunes:evaluated.tunes,preservePrecision:true,trajectoryShotCount:20}).current);
}
console.log('Bipods default OFF: both optimizer presets and totals exclude deployed bonuses in all modes');
