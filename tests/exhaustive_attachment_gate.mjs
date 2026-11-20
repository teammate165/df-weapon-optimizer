import {screeningComparator} from '../tools/screening_rank.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileMounts} from '../tools/scip_mount_model.mjs';
import {solveLinearModel} from '../tools/scip_runtime.mjs';
import createRuntime from '../vendor/scip-7e68f9ca/scip.js';
import {mountConfigurations,retainBest,exhaustiveAttachmentGate,configKey,tacticalChoice} from '../tools/exhaustive_attachment_gate.mjs';
import {statIds,shortfall} from '../tools/optimizer_policy.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import {emptyRisers} from '../tools/optimizer_mounts.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
const modules={curves,kernel,calculate};
for(const n of [0,1,19,20,21,199,200,201,399,400,401,1001]){
 const values=Array.from({length:n},(_,i)=>({score:(i*37)%101,id:i})).reverse(),compare=(a,b)=>a.score-b.score||a.id-b.id;
 assert.deepEqual(retainBest(values,BigInt(n),compare),[...values].sort(compare).slice(0,Math.ceil(n*.005)));
}
// Independent raw-provider Cartesian enumeration: no mounting Boolean model,
// no prefix rejection, and reverse path order. Final legality uses the source.
function rawConfigurations(input){
 const {pack,request:r,shop,prices}=input,mode=r.mode,hidden=new Set(mode==='bd'?shop.hiddenItemIds:[]),costs=mode==='bd'?shop.partCosts:prices,paths=new Map(),hosts=new Set();
 function collect(host,path='',depth=0){
  assert(depth<12);const key=path+'|'+host;if(hosts.has(key))return;hosts.add(key);
  const rules=[...(pack.assembly.coupling?.[pack.weaponId]?.rules??[]),...(host===pack.weaponId?[]:pack.assembly.coupling?.[host]?.rules??[])];
  for(const socket of pack.assembly.socketProviders[host]?.sockets??[]){
   if(socket.modes&&!socket.modes.includes(mode))continue;
   const pathHere=path?path+'/'+socket.socketId:String(socket.socketId),options=paths.get(pathHere)??new Set();
   for(const id of socket.optionItemIds??[])if(pack.display.objects[id]?.playerSelectable&&!pack.display.objects[id]?.selectionDisabledReason)options.add(id);
   paths.set(pathHere,options);
   const defaults=rules.filter(rule=>String(rule.targetSocketId)===String(socket.socketId)).map(rule=>String(rule.mountedItemId));
   for(const id of new Set([...(socket.optionItemIds??[]),...defaults]))if(pack.assembly.socketProviders[id])collect(id,pathHere,depth+1);
  }
 }
 collect(pack.weaponId);
 const entries=[...paths].reverse(),rows=[];
 function walk(i,config){
  if(i<entries.length){const [path,opts]=entries[i];walk(i+1,config);for(const itemId of [...opts].reverse())walk(i+1,[...config,{slotPath:path,itemId}]);return;}
  const b=curves.o(pack,config,mode);
  if(configKey(b.config)!==configKey(config)||b.mounted.some(n=>hidden.has(n.itemId))||emptyRisers(pack,b).length)return;
  if((r.fixed??[]).some(f=>!b.mounted.some(n=>n.slotPath===f.slotPath&&n.itemId===f.itemId)))return;
  if(b.mounted.filter(n=>kernel.l(pack,n.itemId,mode)).length>Math.max(1,(r.fixed??[]).filter(f=>kernel.l(pack,f.itemId,mode)).length))return;
  if(b.mounted.filter(n=>pack.parts[n.itemId]?.boundAmmoByMode?.[mode]).length>1)return;
  const quotes=b.mounted.filter(n=>n.source==='equipped').map(n=>costs?.[n.itemId]);
  if(mode!=='mp'&&(quotes.some(v=>!Number.isFinite(v)||v<0)||quotes.reduce((a,b)=>a+b,0)>r.budget))return;
  rows.push(b.config);
 }
 walk(0,[]);return rows;
}
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json'));
const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18070000005.json'));
const reports=[];
for(const mode of ['bd','sol','mp']){
 const input={pack,shop:catalog.shop,prices:catalog.prices,request:{mode,budget:mode==='bd'?200:5000000}};
 const raw=rawConfigurations(input),compiled=compileMounts(input,kernel),actual=[...mountConfigurations(compiled)];
 assert.deepEqual(actual.map(configKey).sort(),raw.map(configKey).sort());
 if(mode==='bd')assert.equal(raw.length,582);
 const fixed=raw.find(c=>c.length)?.slice(0,1)??[];
 for(const locks of [[],fixed]){
  for(const presetName of ['recoil','agility']){
   const request={...input.request,fixed:locks},resolve=c=>curves.o(pack,c,mode),preset=presets[presetName].create({pack,request,mode,resolve,...modules});
   const all=raw.filter(c=>locks.every(f=>resolve(c).mounted.some(n=>n.slotPath===f.slotPath&&n.itemId===f.itemId))),better=(a,b)=>screeningComparator({})(a,b)<0;
   const score=config=>{const b=resolve(config),state=kernel.u(pack,b,{mode,tacticalEffective:true,tunes:{}}),components=preset.raw(b,{},state);return {config,stats:Object.fromEntries(Object.entries(statIds).map(([k,id])=>[k,state.numeric.mainAttr[id]])),objectives:preset.objectives(components),score:preset.score(components),cost:mode==='mp'?null:b.mounted.filter(n=>n.source==='equipped').reduce((n,m)=>n+(mode==='bd'?catalog.shop.partCosts:catalog.prices)[m.itemId],0),signature:configKey(config)};};
   const compare=(a,b)=>better(a,b)?-1:better(b,a)?1:a.signature.localeCompare(b.signature);
   const ordinary=all.filter(c=>c.every(n=>!tacticalChoice(pack,kernel,mode,n.slotPath,n.itemId)||locks.some(f=>f.slotPath===n.slotPath&&f.itemId===n.itemId))).map(score).sort(compare);
   const bases=ordinary.slice(0,Math.ceil(.005*ordinary.length)),expected=[];
   for(const base of bases){
    const ordinaryKey=c=>configKey(c.filter(n=>!tacticalChoice(pack,kernel,mode,n.slotPath,n.itemId)));
    const tactical=all.filter(c=>ordinaryKey(c)===ordinaryKey(base.config)).map(score).sort(compare);
    expected.push(...tactical.slice(0,Math.ceil(.005*tactical.length)));
   }
   const result=exhaustiveAttachmentGate({...input,request},modules,preset);
   assert.equal(result.diagnostics.fraction,.005);
   assert.equal(result.diagnostics.ranking_contract,'exact-shortfall-objectives-cost-code-unit-signature-v1');
   assert(result.diagnostics.complete);assert.equal(result.diagnostics.attachments.screened,ordinary.length);
   assert.deepEqual(result.candidates.map(c=>c.signature).sort(),[...new Set(expected.map(c=>c.signature))].sort());
   // The calibration domain cannot recombine independently allowed slot items.
   const restricted=compileMounts({...input,request,candidateConfigs:result.candidates.map(c=>c.config)},kernel);
   const permitted=new Set(result.candidates.flatMap(c=>c.config.map(n=>n.slotPath+'|'+n.itemId)));
   assert([...restricted.players].every(([key])=>permitted.has(key)));
   reports.push({mode,preset:presetName,locks:locks.length,all:raw.length,bases:ordinary.length,retained_bases:bases.length,candidates:result.candidates.length});
  }
 }
}
// Solve the actual sparse membership constraints. Individually allowed parts
// from two retained rows must never recombine into an unscreened third row.
{
 const input={pack,shop:catalog.shop,prices:catalog.prices,request:{mode:'bd',budget:200}},raw=rawConfigurations(input);
 const pair=raw.find(c=>c.length===2&&c.every(n=>!n.slotPath.includes('/')));assert(pair);
 for(const [config,expected] of [[[],'optimal'],[pair,'optimal'],[[pair[0]],'infeasible']]){
  const request={...input.request,validationConfig:config},compiled=compileMounts({...input,request,candidateConfigs:[[],pair]},kernel);
  const result=await solveLinearModel(compiled.model.cip(0),{createRuntime,seconds:2});assert.equal(result.status,expected);assert.equal(result.errorCount,0);
 }
}
// A later sibling enables a different bundled parent. Prefix-resolver pruning
// would skip its child; Boolean bounds must retain the legal final assignment.
const synthetic={weaponId:'w',display:{objects:{}},parts:{},assembly:{socketProviders:{w:{sockets:[{socketId:1,optionItemIds:['a','b']},{socketId:2,optionItemIds:['trigger','block','hidden','unpriced']},{socketId:32,optionItemIds:['patch']},{socketId:14,optionItemIds:['laser']} ]},a:{sockets:[{socketId:3,optionItemIds:['childA']}]},b:{sockets:[{socketId:3,optionItemIds:['childB']}]}},coupling:{w:{rules:[{targetSocketId:1,mountedItemId:'a',mountPolicy:'default',condition:{type:'always'}},{targetSocketId:1,mountedItemId:'b',mountPolicy:'forced',condition:{type:'anyMounted',itemIds:['trigger']}}]}},extraOccupancy:{block:{occupiedSocketIds:[32]}}}};
for(const id of ['a','b','trigger','block','hidden','unpriced','childA','childB','patch','laser'])synthetic.display.objects[id]={playerSelectable:true};
const syntheticInput={pack:synthetic,shop:{hiddenItemIds:['hidden'],partCosts:Object.fromEntries(['a','b','trigger','block','hidden','childA','childB','patch','laser'].map(id=>[id,1])),weapons:{w:{gunsmithLimit:9}}},prices:{},request:{mode:'bd',budget:9}},fakeKernel={l:(_p,id)=>id==='laser'};
const syntheticRows=[...mountConfigurations(compileMounts(syntheticInput,fakeKernel))];
assert(syntheticRows.some(c=>c.some(n=>n.itemId==='trigger')&&c.some(n=>n.itemId==='childB')&&!c.some(n=>n.slotPath==='1')));
assert(!syntheticRows.some(c=>c.some(n=>n.itemId==='block')&&c.some(n=>n.itemId==='patch')));
assert(!syntheticRows.some(c=>c.some(n=>['hidden','unpriced'].includes(n.itemId))));
// Explicit patch + laser Cartesian reference, including grip patches, stat
// floors, multi-device locks and the source policy's strongest legal laser cap.
{
 const normal=Array.from({length:21},(_,i)=>'a'+i),patches=Array.from({length:21},(_,i)=>'p'+i),parts=[...normal,...patches,'grip','l1','l2','l3'];
 const pack={weaponId:'w',parts:{},display:{objects:Object.fromEntries(parts.map(id=>[id,{playerSelectable:true}]))},assembly:{socketProviders:{w:{sockets:[{socketId:1,optionItemIds:normal},{socketId:30,optionItemIds:['grip']},{socketId:32,optionItemIds:patches},{socketId:14,optionItemIds:['l1','l2']},{socketId:18,optionItemIds:['l3']}]}},coupling:{},extraOccupancy:{}}};
 const shop={hiddenItemIds:[],partCosts:Object.fromEntries(parts.map(id=>[id,1])),weapons:{w:{gunsmithLimit:99}}};
 const curves={o:(_p,config)=>({config,mounted:config.map(c=>({...c,source:'equipped'})),slots:[]})};
 const kernel={l:(_p,id)=>id.startsWith('l'),u:(_p,b)=>{const points=10+b.config.reduce((n,c)=>n+(c.itemId==='grip'?5:/^[ap]/.test(c.itemId)?Number(c.itemId.slice(1)):2),0);return {numeric:{mainAttr:{3:points,4:10,5:10,6:10}}};}};
 const preset={raw:(_b,_t,state)=>({control:state.numeric.mainAttr[3]}),score:c=>100-c.control,objectives:c=>[100-c.control]};
 for(const fixed of [[],[{slotPath:'14',itemId:'l1'},{slotPath:'18',itemId:'l3'}]]){
  const request={mode:'bd',budget:99,minimum_stats:{control:40},fixed},input={pack,shop,prices:{},request},result=exhaustiveAttachmentGate(input,{curves,kernel},preset),raw=[];
  for(const a of [null,...normal])for(const grip of [null,'grip'])for(const patch of [null,...patches])for(const laser of [null,'l1','l2'])for(const side of [null,'l3']){
   const config=[[1,a],[30,grip],[32,patch],[14,laser],[18,side]].filter(([,id])=>id).map(([p,id])=>({slotPath:String(p),itemId:id}));
   if(fixed.some(f=>!config.some(c=>c.slotPath===f.slotPath&&c.itemId===f.itemId)))continue;
   if(config.filter(c=>kernel.l(pack,c.itemId)).length>Math.max(1,fixed.length))continue;
   const b=curves.o(pack,config),state=kernel.u(pack,b),components=preset.raw(b,{},state);raw.push({config,stats:{control:state.numeric.mainAttr[3]},score:preset.score(components),objectives:preset.objectives(components),cost:config.length,signature:configKey(config)});
  }
  const better=(a,b)=>screeningComparator(request.minimum_stats)(a,b)<0,compare=(a,b)=>better(a,b)?-1:better(b,a)?1:a.signature.localeCompare(b.signature),isT=c=>tacticalChoice(pack,kernel,'bd',c.slotPath,c.itemId);
  const bases=raw.filter(r=>r.config.every(c=>!isT(c)||fixed.some(f=>f.slotPath===c.slotPath&&f.itemId===c.itemId))).sort(compare),kept=bases.slice(0,Math.ceil(bases.length*.005)),expected=[];
  for(const base of kept){const key=configKey(base.config.filter(c=>!isT(c))),possible=raw.filter(r=>configKey(r.config.filter(c=>!isT(c)))===key&&shortfall(r.stats,request.minimum_stats)<1e-8).sort(compare);expected.push(...possible.slice(0,Math.ceil(possible.length*.005)));}
  assert.equal(result.diagnostics.attachments.screened,bases.length);
  assert.deepEqual(result.candidates.map(c=>c.signature).sort(),expected.map(c=>c.signature).sort());
  assert(result.candidates.every(c=>c.stats.control>=40));assert(result.diagnostics.tactical.some(t=>t.screened>20));
 }
}
const controller=new AbortController();controller.abort();
const preset=presets.recoil.create({pack,request:{mode:'bd'},mode:'bd',resolve:c=>curves.o(pack,c,'bd'),...modules});
assert.throws(()=>exhaustiveAttachmentGate({pack,shop:catalog.shop,prices:catalog.prices,request:{mode:'bd',budget:200},signal:controller.signal},modules,preset),{name:'AbortError'});
fs.mkdirSync('.scratch/staged-exact-screen',{recursive:true});fs.writeFileSync(`.scratch/staged-exact-screen/exact-gate-tests${process.env.RANK_WORKER_ID===undefined?'':'-'+process.env.RANK_WORKER_ID}.json`,JSON.stringify({passed:true,reports,checks:['independent reverse raw Cartesian enumeration','exact two-stage survivors and rounding','both presets/all modes/locks','no calibration cross-mixing','conditional bundled parents and child sockets','occupancy, hidden and missing-price exclusions','heap boundaries','abort']},null,2));
console.log('Exact gate: independent all-domain counts and both-stage survivor parity pass for G18, both presets, three modes and locks; conditional parents, policies, heap and cancellation pass.');
