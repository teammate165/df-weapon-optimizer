import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSharedStatEvaluator} from '../tools/shared_stats.mjs';
import {compileMounts} from '../tools/scip_mount_model.mjs';
import {createMountSearch} from '../tools/mount_search.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import * as before from '../.scratch/calibration-check/kernel.state-cache-base.mjs';
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json'));
const node=(itemId,slotPath)=>({itemId,slotPath,socketId:Number(slotPath.split('/').at(-1)),hostItemId:'test-host',source:'equipped'});
function same(actual,expected,label){
 for(const key of ['mode','operations','appliedParts','ammo','references','numeric','baseTargets','mappedValues'])assert.deepEqual(actual[key],expected[key],label+' '+key);
 const targets=new Set([...expected.numeric.buckets.keys(),...expected.mappedValues.keys(),...Object.keys(expected.baseTargets),'unknown-target']);
 for(const target of targets){assert.equal(actual.value(target),expected.value(target),label+' '+target);for(const fallback of [0,-0,NaN,123])assert.equal(actual.value(target,fallback),expected.value(target,fallback),label+' fallback '+target);}
}
const reports=[];let compared=0;
for(const weapon of catalog.weapons){
 const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/'+weapon.id+'.json'));
 const configs=[...createMountSearch(compileMounts({pack,shop:catalog.shop,prices:catalog.prices,request:{mode:'bd',budget:20}},kernel)).enumerate()];
 for(const mode of ['bd','sol','mp']){
  const evaluate=createSharedStatEvaluator(pack,kernel,{mode});assert(evaluate.supported);
  for(const config of configs){const build=curves.o(pack,config,mode),opts={mode,tacticalEffective:true,tunes:{}},expected=before.u(pack,build,opts);same(kernel.u(pack,build,opts),expected,weapon.id+'/'+mode+' native ABI');same(evaluate.evaluate(build),expected,weapon.id+'/'+mode);compared++;}
  const stats=evaluate.getStats();assert.equal(stats.native_fallbacks,0,JSON.stringify({id:weapon.id,mode,stats}));reports.push({weapon_id:weapon.id,mode,states:configs.length,stats});
 }
}
// Default full-domain G18 and cache saturation keep exactly the same native
// operation order, reference choices, bucket bits and mapped values.
{
 const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18070000005.json')),mode='bd',builds=[...createMountSearch(compileMounts({pack,shop:catalog.shop,prices:catalog.prices,request:{mode,budget:200}},kernel)).enumerate()].map(c=>curves.o(pack,c,mode));
 for(const limits of [{},{maxParts:0,maxPartOps:0,maxPrefixes:0,maxReferences:0,maxTokens:0},{maxParts:1,maxPartOps:32,maxPrefixes:1,maxPrefixChars:64,maxReferences:1,maxReferenceChars:32,maxTokens:1,maxTokenChars:64}]){
  const evaluate=createSharedStatEvaluator(pack,kernel,{mode,...limits});for(const build of builds)same(evaluate.evaluate(build),before.u(pack,build,{mode,tacticalEffective:true,tunes:{}}),'G18 saturated');
  assert.equal(evaluate.getStats().native_fallbacks,0);if(limits.maxParts!==undefined)assert(evaluate.getStats().saturated);
 }
}
const original=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json'));
// Repeated identical lasers at different occurrences must remain distinct
// through the strongest-per-target selector, including first-on-tie identity.
for(const mode of ['bd','sol','mp']){
 const pack=original,ids=Object.keys(pack.parts).filter(id=>kernel.l(pack,id,mode));assert(ids.length>1);
 const evaluate=createSharedStatEvaluator(pack,kernel,{mode});
 for(const mounted of [[node(ids[0],'14'),node(ids[0],'17/14')],[node(ids[0],'14'),node(ids[1],'17/14')],[node(ids[1],'17/14'),node(ids[0],'14')]]){
  const build={mounted};same(evaluate.evaluate(build),before.u(pack,build,{mode,tacticalEffective:true,tunes:{}}),'laser '+mode);same(evaluate.evaluate(build),before.u(pack,build,{mode,tacticalEffective:true,tunes:{}}),'warm laser '+mode);
 }
 assert.equal(evaluate.getStats().native_fallbacks,0);
}
// Floating-point order, duplicate alias writes and last-reference replacement
// are deliberately noncommutative. Numeric deltas must never be pre-summed.
{
 const pack=structuredClone(original),mode='bd',effect=(target,value)=>({operation:'StaticAttributeModify',target,modifier:'Addend',value,scope:'NONE'});
 pack.attributeRules.defaults['7']={directRuleTargets:['TestAlias','TestAlias'],curveMappings:[]};
 const definitions={big:[effect('TestAlias',1e16)],small:[effect('WeaponMainAttribute.MainAttrValues.7',1)],cancel:[effect('TestAlias',-1e16)]};
 const refs=Object.keys(pack.handling.recoilProfiles).slice(0,2);definitions.refA=[{operation:'StaticAttributeReplace',target:'AimingId.RecoilId',modifier:'Initial',value:refs[0],scope:'NONE'}];definitions.refB=[{operation:'StaticAttributeReplace',target:'AimingId.RecoilId',modifier:'Initial',value:refs[1],scope:'NONE'}];
 for(const [id,ops] of Object.entries(definitions)){pack.parts[id]={tuneIds:[]};pack.effectsByItemId[id]={[mode]:ops};}
 const evaluate=createSharedStatEvaluator(pack,kernel,{mode});
 for(const order of [['big','small','cancel','refA','refB'],['big','cancel','small','refB','refA'],['small','big','cancel','refA','refB']]){
  const build={mounted:order.map(id=>node(id,id))};same(evaluate.evaluate(build),before.u(pack,build,{mode,tacticalEffective:true,tunes:{}}),'ordered aliases');
 }
 assert.equal(evaluate.evaluate({mounted:['big','small','cancel'].map(id=>node(id,id))}).value('TestAlias'),0);
 assert.equal(evaluate.evaluate({mounted:['big','cancel','small'].map(id=>node(id,id))}).value('TestAlias'),2);
 assert.equal(evaluate.getStats().native_fallbacks,0);
}
// Tuning, ammo, duplicate occurrences and context changes use the native whole
// evaluator. Ordinary Maps returned per row cannot poison the cached core.
{
 const pack=original,mode='bd',build=curves.o(pack,[{slotPath:'1',itemId:'13030000109'}],mode),evaluate=createSharedStatEvaluator(pack,kernel,{mode});
 const tuneNode=build.mounted.find(n=>pack.parts[n.itemId]?.tuneIds?.length);assert(tuneNode);const id=pack.parts[tuneNode.itemId].tuneIds[0],control=curves.c(pack,tuneNode,id),tunes={[tuneNode.slotPath]:{[id]:curves.n(control).at(-1)}};
 for(const options of [{tunes},{includeAmmo:true},{ammoItemId:'unknown-ammo'},{tacticalEffective:false},{mode:'sol'}])same(evaluate.evaluate(build,options),before.u(pack,build,{mode,tacticalEffective:true,tunes:{},...options}),'context fallback');
 const duplicate={mounted:[...build.mounted,build.mounted[0]]};same(evaluate.evaluate(duplicate),before.u(pack,duplicate,{mode,tacticalEffective:true,tunes:{}}),'duplicate fallback');
 const state=evaluate.evaluate(build);state.numeric.buckets.clear();state.mappedValues.clear();state.operations.length=0;state.appliedParts.length=0;
 same(evaluate.evaluate(build),before.u(pack,build,{mode,tacticalEffective:true,tunes:{}}),'cache isolation');
 assert(evaluate.getStats().native_fallbacks>=6);
 const opaque={...kernel,u:(...args)=>kernel.u(...args)},ordinary=createSharedStatEvaluator(pack,opaque,{mode});assert(!ordinary.supported);same(ordinary.evaluate(build),before.u(pack,build,{mode,tacticalEffective:true,tunes:{}}),'opaque runtime');
}
fs.mkdirSync('.scratch/shared-stats',{recursive:true});fs.writeFileSync('.scratch/shared-stats/state-tests.json',JSON.stringify({passed:true,compared,reports},null,2));
console.log(`Shared native stats match ${compared} before-patch states, all 69 weapons/three modes; cache caps, aliases/order, lasers, tuning/ammo fallbacks and isolation pass.`);
