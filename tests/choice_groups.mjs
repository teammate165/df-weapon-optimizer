import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
import {createChoiceGroups} from '../tools/choice_groups.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import {isOptic} from '../tools/optimizer_mounts.mjs';
import {configKey} from '../tools/exhaustive_attachment_gate.mjs';
import {compileMounts} from '../tools/scip_mount_model.mjs';
import {createMountSearch} from '../tools/mount_search.mjs';
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json')),original=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json'));
const setup=(pack=original,mode='bd',name='recoil',fixed=[])=>{
 const request={mode,budget:mode==='bd'?800:5000000},resolve=config=>curves.o(pack,config,mode),preset=presets[name].create({pack,request,mode,resolve,kernel,curves,calculate}),g=createChoiceGroups({pack,mode,shop:catalog.shop,prices:catalog.prices,kernel,curves,preset,fixed});return {pack,mode,request,resolve,preset,g};
};
const state=(s,config,tunes={})=>{const build=s.resolve(config),numeric=kernel.u(s.pack,build,{mode:s.mode,tacticalEffective:true,tunes}),raw=s.preset.raw(build,tunes,numeric);return {stats:numeric.numeric.mainAttr,objectives:s.preset.objectives(raw)};};
let sightChecks=0;const reports=[];
for(const mode of ['bd','sol','mp'])for(const name of ['recoil','agility']){
 const s=setup(original,mode,name),build=s.resolve([]);assert(s.g.enabled);
 for(const slot of build.slots){
  const opts=s.g.options(slot.options,slot.slotPath);
  for(const id of slot.options.filter(id=>isOptic(original,id)&&s.g.item(id).family)){
   const representative=opts.find(other=>s.g.item(other).family===s.g.item(id).family);assert(representative);
   const config=[{slotPath:slot.slotPath,itemId:id}],old=s.resolve(config);if(!old.config.some(c=>c.itemId===id))continue;
   const changed=[{slotPath:slot.slotPath,itemId:representative}],want=state(s,changed);
   assert.deepEqual(state(s,config),want);
   for(const endpoint of [0,-1]){
    const tunes={};for(const node of old.mounted.filter(n=>n.itemId===id))for(const tid of original.parts[id].tuneIds??[]){const control=curves.c(original,node,tid);if(control&&control.enabled!==false)(tunes[node.slotPath]??={})[tid]=curves.n(control).at(endpoint);}
    assert.deepEqual(state(s,config,tunes),want);sightChecks++;
   }
   if(mode!=='mp'){const costs=mode==='bd'?catalog.shop.partCosts:catalog.prices;assert(costs[representative]<=costs[id]);}
  }
 }
 const slot=build.slots.find(slot=>slot.slotPath==='11');reports.push({mode,preset:name,sights_before:slot.options.filter(id=>isOptic(original,id)).length,sights_after:s.g.options(slot.options,'11').filter(id=>isOptic(original,id)).length});
}
const s=setup(),base=s.resolve([]),configs=[...s.g.tacticalConfigs(base,{budget:800})];assert.equal(configs.length,630);assert.equal(new Set(configs.map(configKey)).size,630);
assert.equal([...s.g.tacticalConfigs(base,{budget:120})].length,273);
for(const config of configs){const build=s.resolve(config);assert.equal(configKey(config),configKey(build.config));assert(build.mounted.filter(n=>kernel.l(original,n.itemId,'bd')).length<=1);assert.deepEqual(state(s,config),state(s,s.g.normalize(build)));}
const placements=[[{slotPath:'4/32',itemId:'13320000001'},{slotPath:'4/35',itemId:'13320000005'}],[{slotPath:'4/34',itemId:'13320000001'},{slotPath:'4/32',itemId:'13320000005'}]];
assert.equal(configKey(s.g.normalize(s.resolve(placements[0]))),configKey(s.g.normalize(s.resolve(placements[1]))));
assert.notEqual(s.g.item('13320000001').family,s.g.item('13320000010').family); // Total patch count alone is insufficient.
assert.equal(s.g.item('13160000005').family,s.g.item('13160000006').family);assert.notEqual(s.g.item('13160000005').family,s.g.item('13160000014').family);
// Exact identity locks and shared rail capacity survive reconstruction.
{
 const fixed=[{slotPath:'11',itemId:'13110000044'},{slotPath:'4/32',itemId:'13320000005'},{slotPath:'4/17',itemId:'13160000006'}],locked=setup(original,'bd','recoil',fixed),b=locked.resolve(fixed);
 for(const config of locked.g.tacticalConfigs(b,{budget:800})){const normalized=locked.g.normalize(locked.resolve(config));for(const f of fixed)assert(normalized.some(c=>c.slotPath===f.slotPath&&c.itemId===f.itemId));}
 const multi=[{slotPath:'4/17',itemId:'13160000006'},{slotPath:'4/19',itemId:'13160000009'}],two=setup(original,'bd','recoil',multi);for(const config of two.g.tacticalConfigs(two.resolve(multi),{budget:800}))assert.equal(config.filter(c=>kernel.l(original,c.itemId,'bd')).length,2);
}
// Overriding a bundled device changes the base effects. Keep that socket
// distinct, and allow another laser when a patch replaces the bundled laser.
{
 const pack=structuredClone(original),host=s.resolve([]).mounted.find(n=>n.slotPath==='4').itemId;
 pack.assembly.coupling[host]={rules:[...(pack.assembly.coupling[host]?.rules??[]),{targetSocketId:19,mountedItemId:'13160000014',mountPolicy:'default',condition:{type:'always'}}]};
 const bundled=setup(pack),b=bundled.resolve([]);assert(b.mounted.some(n=>n.slotPath==='4/19'&&n.itemId==='13160000014'));
 let replacement=false;
 for(const config of bundled.g.tacticalConfigs(b,{budget:800})){
  const actual=bundled.resolve(config);assert(actual.mounted.filter(n=>kernel.l(pack,n.itemId,'bd')).length<=1);
  assert.deepEqual(state(bundled,config),state(bundled,bundled.g.normalize(actual)));
  if(config.some(c=>c.slotPath==='4/19'&&c.itemId==='13320000001')&&config.some(c=>c.slotPath==='4/17'&&c.itemId==='13160000005'))replacement=true;
 }
 assert(replacement);
}
// Controls, dependency-sensitive IDs, non-integer stat sums and unknown scorers
// must not accidentally inherit the native-objective equivalence guarantee.
{
 const pack=structuredClone(original),id='13110000043',tid=pack.parts[id].tuneIds[0];pack.tunes[tid].functions.push({...pack.tunes[tid].functions[0],target:'GAiming_ADSTime'});assert.equal(setup(pack).g.item(id).family,null);
 const dependent=structuredClone(original);dependent.combat.specialFire.itemOverrides[id]={requiresItemIds:[id]};assert.equal(setup(dependent).g.item(id).family,null);
 const floating=structuredClone(original);floating.effectsByItemId[floating.weaponId].bd.push({operation:'StaticAttributeModify',target:'WeaponMainAttribute.MainAttrValues.3',modifier:'Addend',value:.1,scope:'NONE'});const guarded=setup(floating);assert(!guarded.g.getStats().counts_interchangeable);assert.equal(configKey(guarded.g.normalize(guarded.resolve(placements[0]))),configKey(placements[0]));
 const raw=s.preset.raw,unknown={...s.preset,raw:(...args)=>raw(...args)},g=createChoiceGroups({pack:original,mode:'bd',shop:catalog.shop,prices:catalog.prices,kernel,curves,preset:unknown});assert(!g.enabled);assert.deepEqual(g.options(base.slots.find(x=>x.slotPath==='11').options,'11'),base.slots.find(x=>x.slotPath==='11').options);
}
// Mounting-domain representatives remain compatible with source replay.
{
 const compiled=compileMounts({pack:original,shop:catalog.shop,prices:catalog.prices,request:{mode:'bd',budget:40}},kernel);s.g.constrain(compiled);let count=0;
 for(const config of createMountSearch(compiled).enumerate()){assert.equal(configKey(config),configKey(s.resolve(config).config));count++;}assert(count>0);
}
fs.mkdirSync('.scratch/tactical-grouping',{recursive:true});fs.writeFileSync('.scratch/tactical-grouping/tests.json',JSON.stringify({passed:true,sight_checks:sightChecks,tactical_configs:configs.length,reports,grouping:s.g.getStats()},null,2));
console.log('Equivalent sights preserve '+sightChecks+' native objective/tuning comparisons; 630 tactical groups, 120-point cap, costs, locks, shared slots and conservative fallbacks pass.');
