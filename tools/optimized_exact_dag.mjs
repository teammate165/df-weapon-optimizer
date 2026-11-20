import {compileMounts} from './scip_mount_model.mjs';
import {createMountSearch} from './mount_search.mjs';
import {createChoiceGroups} from './choice_groups.mjs';
import {createSharedStatEvaluator} from './shared_stats.mjs';
import {presets} from './optimizer_presets.mjs';
import {configKey} from './exhaustive_attachment_gate.mjs';
import {exactKey,exactInterner,boundedCache,createProvenance,provenancePaths,rankPrefix} from './exact_dag_storage.mjs';
import {createExactRecoilScorer} from './exact_recoil_scorer.mjs';

export const exactDagWorkers=8;
export function createOptimizedExactDag(input,modules,{batchSize=16,cacheBytes=16*1024*1024,verifyRepresentatives=false,onInputMiss}={}){
 const {pack,request:r,shop}=input,{kernel,curves}=modules,c=kernel.u.screeningStateContract,mode=r.mode,resolve=config=>curves.o(pack,config,mode);
 if(pack.weaponId!=='18010000001'||mode!=='bd'||r.preset!=='recoil'||r.firing==='spam'||Object.keys(r.minimum_stats??{}).length)throw Error('Exact DAG fixture unsupported');
 if(r.experimental_dominance)throw Error('Dominance is disabled for exhaustive screening');
 if(r.fixed?.length!==1||r.fixed[0].slotPath!=='11'||r.fixed[0].itemId!=='13110000091')throw Error('Exact DAG requires the locked Insight fixture');
 const preset=presets.recoil.create({...input,...modules,mode,resolve}),compiled=compileMounts(input,kernel),groups=createChoiceGroups({...input,...modules,preset,mode,fixed:r.fixed});groups.constrain(compiled);
 const search=createMountSearch(compiled),ordinary=new Map();for(const p of compiled.players.values())if(typeof p.value==='string'&&groups.isTactical(p.path,p.item))ordinary.set(p.value,0);
 const opts={mode,tacticalEffective:true,tunes:{},includeAmmo:false,ammoItemId:null},baseOps=c.collect(pack,{mounted:[]},opts).operations,baseRefs=baseOps.filter(o=>o.operation==='StaticAttributeReplace'),interner=exactInterner(cacheBytes),buckets=exactInterner(cacheBytes),bucketIds=new WeakMap(),blocks=new Map(),transitions=boundedCache(cacheBytes),scorer=createExactRecoilScorer({pack,request:r,modules,preset,cacheBytes:cacheBytes/2,onInputMiss}),shared=createSharedStatEvaluator(pack,kernel,{mode});
 const conditionIds=new Set();for(const group of Object.values(pack.assembly.coupling??{}))for(const rule of group.rules??[])for(const id of rule.condition?.itemIds??[])conditionIds.add(String(id));
 const counters={transitions_computed:0,transitions_reused:0,folds:0,buckets_copied:0,reference_rows:0,reference_paths:0,event_roots:0,interleaved_roots:0,certified_dead_operations:0};
 function canonicalize(map,keys){for(const key of keys){const b=map.get(key);if(!b)continue;const entry=buckets.intern([b.initial,b.addend,b.multA,b.multC]);if(!entry.bucket){entry.bucket=Object.freeze({...b});bucketIds.set(entry.bucket,entry.id);}map.set(key,entry.bucket);}return map;}
 const baseNumeric=c.numeric(pack,baseOps),baseBuckets=canonicalize(baseNumeric.buckets,baseNumeric.buckets.keys()),baseReference=c.references(pack,mode,baseRefs,null),baseState={buckets:baseBuckets,refOps:baseRefs,refs:baseReference,refId:interner.intern(baseReference).id,sensitive:[],sensitiveId:interner.intern([]).id,cost:0};
 function block(node){const key=node.slotPath+'|'+node.itemId;let value=blocks.get(key);if(value)return value;const original=c.collect(pack,{mounted:[node]},opts).operations.filter(o=>o.sourceKind==='part');if(original.some(o=>!['StaticAttributeModify','StaticAttributeReplace'].includes(o.operation)))throw Error('Unsupported source operation');
  // The immutable fixture has no floors, tuning or part-sensitive firing.
  // Include native alias writes when checking the certified live closure.
  const ops=original.filter(o=>o.operation==='StaticAttributeReplace'||[...c.numeric(pack,[o]).buckets.keys()].some(target=>scorer.liveTargets.includes(target)));counters.certified_dead_operations+=original.length-ops.length;
  const writes=[...c.numeric(pack,ops).buckets.keys()],refOps=ops.filter(o=>o.operation==='StaticAttributeReplace'),sensitive=conditionIds.has(node.itemId)?[node.slotPath,node.itemId]:null;value={ops,writes,refOps,sensitive,id:interner.intern([ops.map(o=>[o.operation,o.target,o.modifier,o.value,o.scope]),sensitive]).id};blocks.set(key,value);return value;}
 function advance(state,b,cost){
  if(!b)return cost?{...state,cost:state.cost+cost}:state;
  let map=state.buckets;if(b.writes.length){map=new Map(map);for(const target of b.writes)if(map.has(target)){map.set(target,{...map.get(target)});counters.buckets_copied++;}map=c.numeric(pack,b.ops,map).buckets;canonicalize(map,b.writes);counters.folds++;}
  const refOps=b.refOps.length?[...state.refOps,...b.refOps]:state.refOps,refs=b.refOps.length?c.references(pack,mode,refOps,null):state.refs,sensitive=b.sensitive?[...state.sensitive,b.sensitive]:state.sensitive;
  return {buckets:map,refOps,refs,refId:b.refOps.length?interner.intern(refs).id:state.refId,sensitive,sensitiveId:b.sensitive?interner.intern(sensitive).id:state.sensitiveId,cost:state.cost+cost};
 }
 // Coupling is already fixed in the remaining native event program, and the
 // closure guard rejects every choice/default that can change it. The scoring
 // contract rejects all part-sensitive fire overrides. Past conditional IDs
 // therefore belong to provenance, not the live numeric equivalence key.
 const stateKey=state=>state.refId+'|'+state.cost+'|'+scorer.liveTargets.map(t=>{const b=state.buckets.get(t);return b?bucketIds.get(b):0;}).join('.');
 function rootRestrictions(config){const selected=new Set(config.map(n=>n.slotPath+'|'+n.itemId)),rest=new Map(ordinary);for(const p of compiled.players.values())if(typeof p.value==='string'&&!p.path.includes('/'))rest.set(p.value,selected.has(p.path+'|'+p.item)?1:0);return rest;}
 function describe(config){
  const build=resolve(config),mounted=new Map(build.mounted.map(n=>[n.slotPath,n])),slots=new Map(),unsafe=[];
  const fixedCost=build.mounted.filter(n=>n.source==='equipped').reduce((n,p)=>n+shop.partCosts[p.itemId],0);
  for(const slot of build.slots.filter(s=>s.slotPath.includes('/'))){const options=groups.options(slot.options,slot.slotPath).filter(id=>!groups.isTactical(slot.slotPath,id)&&typeof compiled.players.get(slot.slotPath+'|'+id)?.value==='string'),def=mounted.get(slot.slotPath);if(options.length||def)slots.set(slot.slotPath,{...slot,options,default:def??null});}
  const live=new Set([...build.mounted.map(n=>Number(n.socketId)),...slots.values()].map(s=>Number(s.socketId??s)));
  for(const slot of slots.values())for(const id of [...slot.options,...(slot.default?[slot.default.itemId]:[])]){if(pack.assembly.socketProviders[id]?.sockets?.length)unsafe.push('choice provider');if(conditionIds.has(id))unsafe.push('live coupling');if((pack.assembly.extraOccupancy?.[id]?.occupiedSocketIds??[]).some(socket=>live.has(Number(socket))))unsafe.push('live occupancy');if(kernel.l(pack,id,mode))unsafe.push('device selector');if(pack.parts[id]?.boundAmmoByMode?.[mode])unsafe.push('bound ammo');}
  if(build.mounted.some(n=>kernel.l(pack,n.itemId,mode)||pack.parts[n.itemId]?.boundAmmoByMode?.[mode]))unsafe.push('fixed tactical/ammo context');
  const events=[],visited=new Set(),expectedOrder=[];
  function walk(host,path='',depth=0){if(depth>12)throw Error('Event depth exceeded');for(const socket of pack.assembly.socketProviders[host]?.sockets??[]){if(socket.modes&&!socket.modes.includes(mode))continue;const here=path?path+'/'+socket.socketId:String(socket.socketId),node=mounted.get(here),slot=slots.get(here);if(slot){const choices=[{choice:null,cost:0,block:slot.default?block(slot.default):null},...slot.options.map(id=>({choice:{slotPath:here,itemId:id},cost:shop.partCosts[id],block:block({slotPath:here,itemId:id,hostItemId:slot.hostItemId,socketId:slot.socketId})}))];events.push({kind:'choice',path:here,choices});visited.add(here);if(node)expectedOrder.push(here);}else if(node){events.push({kind:'fixed',block:block(node),path:here});expectedOrder.push(here);walk(node.itemId,here,depth+1);}}}
  walk(pack.weaponId);if([...slots.keys()].some(path=>!visited.has(path)))unsafe.push('unvisited slot');if(JSON.stringify(expectedOrder)!==JSON.stringify(build.mounted.map(n=>n.slotPath)))unsafe.push('native event ordering');
  let state={...baseState,cost:fixedCost},start=0;while(start<events.length&&events[start].kind==='fixed'){state=advance(state,events[start].block,0);start++;}
  const remaining=events.slice(start),suffixIds=new Array(remaining.length);let program=0;
  for(let i=remaining.length-1;i>=0;i--){const e=remaining[i],signature=e.kind==='fixed'?['f',e.block.id]:['c',e.path,e.choices.map(c=>[c.choice,c.cost,c.block?.id??0])];program=interner.intern([signature,program]).id;suffixIds[i]=program;}
  const firstChild=build.mounted.findIndex(n=>n.slotPath.includes('/')),interleaved=firstChild>=0&&build.mounted.slice(firstChild).some(n=>!n.slotPath.includes('/'));
  return {config:build.config,build,state,events:remaining,program,suffixIds,unsafe:[...new Set(unsafe)],interleaved};
 }
 function plan(){const rest=new Map(ordinary);for(const p of compiled.players.values())if(typeof p.value==='string'&&p.path.includes('/'))rest.set(p.value,0);const roots=[...search.enumerate(rest)],cohorts=new Map(),fallback=[];let interleaved=0;
  for(const config of roots){const d=describe(config);if(d.interleaved)interleaved++;if(d.unsafe.length){fallback.push({config:d.config,reasons:d.unsafe});continue;}if(!cohorts.has(d.program))cohorts.set(d.program,[]);cohorts.get(d.program).push({config:d.config,key:stateKey(d.state)});}
  const jobs=[];for(const [program,rows]of cohorts){rows.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);for(let i=0;i<rows.length;i+=batchSize)jobs.push({kind:'dag',program,configs:rows.slice(i,i+batchSize).map(r=>r.config)});}for(let i=0;i<fallback.length;i+=batchSize)jobs.push({kind:'fallback',configs:fallback.slice(i,i+batchSize).map(r=>r.config),reasons:[...new Set(fallback.slice(i,i+batchSize).flatMap(r=>r.reasons))]});
  while(jobs.length<exactDagWorkers){const index=jobs.reduce((best,j,i)=>j.configs.length>jobs[best].configs.length?i:best,0),job=jobs[index];if(!job||job.configs.length<2)break;jobs.push({...job,configs:job.configs.splice(Math.ceil(job.configs.length/2))});}
  return {total:String(search.count(ordinary).total),root_prefixes:roots.length,supported_prefixes:roots.length-fallback.length,fallback_prefixes:fallback.length,interleaved_prefixes:interleaved,programs:cohorts.size,jobs:jobs.map((job,id)=>({...job,id})),dominance:false,workers:exactDagWorkers,certificate:scorer.certificate};
 }
 function nativeRow(config){const build=resolve(config);if(configKey(build.config)!==configKey(config))throw Error('Source mounting mismatch');const state=kernel.u(pack,build,opts),raw=preset.raw(build,{},state);return {score:preset.score(raw),objectives:preset.objectives(raw),cost:build.mounted.filter(n=>n.source==='equipped').reduce((n,p)=>n+shop.partCosts[p.itemId],0),signature:configKey(build.config)};}
 function referenceJob(job,emit){const began=performance.now();let paths=0;for(const root of job.configs)for(const config of search.enumerate(rootRestrictions(root))){const build=resolve(config);if(configKey(build.config)!==configKey(config))throw Error('Source reference mounting mismatch');const state=shared.evaluate(build),score=scorer.scoreMapped(state,()=>{const raw=preset.raw(build,{},kernel.u(pack,build,opts));return {score:preset.score(raw),objectives:preset.objectives(raw)};}),cost=build.mounted.filter(n=>n.source==='equipped').reduce((n,p)=>n+shop.partCosts[p.itemId],0);emit({...score,cost,signature:configKey(build.config)});paths++;}counters.reference_paths+=paths;return {id:job.id,paths,wall_ms:performance.now()-began};}
 function runJob(job,expectedPaths){
  const began=performance.now(),descriptions=job.configs.map(describe);if(job.kind==='fallback'||descriptions.some(d=>d.unsafe.length))return fallbackJob(job);
  const program=descriptions[0].program,events=descriptions[0].events;if(descriptions.some(d=>d.program!==program))throw Error('Different native continuation programs');
  const graph=createProvenance(job.configs);let states=new Map(),merges=0;
  function insert(out,state,parent,choice,root){const key=stateKey(state),old=out.get(key),mass=parent===null?1n:graph.mass[parent];if(old){graph.mass[old.id]+=mass;if(parent===null)graph.root(old.id,root);else graph.arc(old.id,parent,choice);merges++;return;}const id=graph.addNode(mass);out.set(key,{state,id});if(parent===null)graph.root(id,root);else graph.arc(id,parent,choice);}
  descriptions.forEach((d,i)=>{insert(states,d.state,null,null,i);counters.event_roots++;if(d.interleaved)counters.interleaved_roots++;});
  for(let layer=0;layer<events.length;layer++){
   const event=events[layer],out=new Map();for(const entry of states.values()){
    const key=descriptions[0].suffixIds[layer]+':'+stateKey(entry.state);let next=transitions.get(key);
    if(next){counters.transitions_reused+=next.length;}else{next=[];for(const choice of event.kind==='fixed'?[{choice:null,cost:0,block:event.block}]:event.choices){if(entry.state.cost+choice.cost>r.budget)continue;next.push({choice:choice.choice,state:advance(entry.state,choice.block,choice.cost)});counters.transitions_computed++;}transitions.set(key,next,key.length*2+next.reduce((n,s)=>n+128+s.state.buckets.size*40,0));}
    for(const child of next)insert(out,child.state,entry.id,child.choice,null);
   }states=out;
  }
  const paths=[...states.values()].reduce((n,s)=>n+graph.mass[s.id],0n);if(expectedPaths!==undefined&&paths!==BigInt(expectedPaths))throw Error('DAG closure count mismatch');
  const packet=graph.pack(),classes=[];for(const entry of states.values()){
   const score=scorer.scoreRaw(entry.state.buckets,entry.state.refs),row={...score,cost:entry.state.cost};
   if(verifyRepresentatives){const first=provenancePaths(packet,entry.id).next().value,native=nativeRow(first);if(native.score!==row.score||native.cost!==row.cost||native.objectives.some((v,i)=>v!==row.objectives[i]))throw Error('Native terminal representative mismatch');}
   classes.push({node:entry.id,mass:graph.mass[entry.id],...row});
  }
  return {id:job.id,kind:'dag',paths:String(paths),terminal_classes:classes.length,merges,graph:packet,classes,wall_ms:performance.now()-began};
 }
 function fallbackJob(job){const roots=[],classes=[];referenceJob(job,row=>{const config=JSON.parse(row.signature).map(([slotPath,itemId])=>({slotPath,itemId}));roots.push(config);classes.push({node:roots.length-1,mass:1n,score:row.score,objectives:row.objectives,cost:row.cost});});return {id:job.id,kind:'fallback',paths:String(roots.length),terminal_classes:roots.length,merges:0,graph:{roots,root_entries:roots.map((_,i)=>[i,[i]]),head:new Uint32Array(roots.length),parent:new Uint32Array(1),label:new Uint32Array(1),next:new Uint32Array(1),labels:[null]},classes};}
 function* rows(packet,threshold){for(const cls of packet.classes){if(threshold&&rankPrefix(cls,threshold)>0)continue;let mass=0n;for(const config of provenancePaths(packet.graph,cls.node)){yield {score:cls.score,objectives:cls.objectives,cost:cls.cost,signature:configKey(config)};mass++;}if(mass!==cls.mass)throw Error('Correlated provenance mass mismatch');}}
 return {plan,describe,referenceJob,runJob,fallbackJob,rows,nativeRow,stats:()=>({...counters,scorer:scorer.stats(),transition_cache:transitions.stats(),interner:interner.stats(),bucket_interner:buckets.stats()})};
}
