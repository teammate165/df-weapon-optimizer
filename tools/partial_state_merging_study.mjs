// Experimental research kernel for closed-root/leaf state collision census.
// Leaf DAG execution remains unvalidated; do not use it to certify coverage.
// Caller supplies a collision-checked canonical-string registry. No production
// solver path calls this module.
import {compileMounts} from './scip_mount_model.mjs';
import {createMountSearch} from './mount_search.mjs';
import {createChoiceGroups} from './choice_groups.mjs';
import {applyDominanceReduction} from './dominance_reduction.mjs';
import {presets} from './optimizer_presets.mjs';

const fields=['initial','addend','multA','multC'];
const fieldName={Initial:'initial',Addend:'addend',Mult_A:'multA',Mult_C:'multC'};
const objectiveTargets=new Set(['3','5','6'].map(id=>'WeaponMainAttribute.MainAttrValues.'+id).concat(['GRecoil_H','GRecoil_V','GRecoil_HShake','GRecoil_VShake','GGunkickRandom','GGunkickSpring','GAiming_ADSTime','GSprintToFireTime']));
const num=v=>v===undefined?'undefined':Object.is(v,-0)?'-0':Number.isFinite(v)?v:(()=>{throw Error('Nonfinite state value');})();
const opKey=o=>[o.operation,o.target,o.modifier,typeof o.value==='number'?num(o.value):o.value,o.scope];
const neutral=b=>b.initial===undefined&&Object.is(b.addend,0)&&Object.is(b.multA,0)&&b.multC===1;
const bucketsKey=(map,predicate=()=>true)=>[...map].filter(([t,b])=>predicate(t)&&!neutral(b)).sort(([a],[b])=>a.localeCompare(b)).map(([t,b])=>[t,...fields.map(k=>num(b[k]))]);
const cloneBuckets=map=>new Map([...map].map(([t,b])=>[t,{...b}]));

export function createPartialStateStudy(input,modules,registry){
 const {pack,request:r,shop}=input,{kernel,curves}=modules,c=kernel.u.screeningStateContract,mode=r.mode,resolve=config=>curves.o(pack,config,mode),options={mode,tacticalEffective:true,tunes:{},includeAmmo:false,ammoItemId:null};
 if(pack.weaponId!=='18010000001'||mode!=='bd'||r.preset!=='recoil')throw Error('Unsupported research fixture');
 const preset=presets.recoil.create({...input,...modules,mode,resolve}),compiled=compileMounts(input,kernel),groups=createChoiceGroups({...input,...modules,preset,mode,fixed:r.fixed});groups.constrain(compiled);
 const dominance=applyDominanceReduction(input,modules,{compiled,groups,preset}),removed=new Set(dominance.rules.map(x=>[x.host,x.path,x.from].join('|'))),base=c.collect(pack,{mounted:[]},options).operations;
 const conditionIds=new Set(),mountIds=new Set(),fireIds=new Set();
 for(const entry of Object.values(pack.assembly.coupling??{}))for(const rule of entry.rules??[])for(const id of rule.condition?.itemIds??[])conditionIds.add(String(id));
 for(const [id,o]of Object.entries(pack.assembly.extraOccupancy??{}))if(o.occupiedSocketIds?.length)mountIds.add(id);
 for(const [id,o]of Object.entries(pack.combat?.specialFire?.itemOverrides??{}))if(Object.keys(o).length)fireIds.add(id);
 for(const id of Object.keys(pack.combat?.specialFire?.explicitlyUnmodeled?.items??{}))fireIds.add(id);
 const partCache=new Map(),projectCache=new Map();
 const intern=(kind,value)=>registry(kind,JSON.stringify(value));
 function projected(op){const key=JSON.stringify(opKey(op));if(projectCache.has(key))return projectCache.get(key);const keys=[...c.numeric(pack,[op]).buckets.keys()].map(t=>t+'|'+op.modifier);projectCache.set(key,keys);return keys;}
 function part(node){
  const key=JSON.stringify([node.slotPath,node.itemId,node.hostItemId,node.socketId]);if(partCache.has(key))return partCache.get(key);
  const ops=c.collect(pack,{mounted:[node]},options).operations.filter(o=>o.sourceKind==='part'),controls=[];
  if(ops.some(o=>!['StaticAttributeModify','StaticAttributeReplace'].includes(o.operation)))throw Error('Unknown source operation in study');
  for(const id of pack.parts[node.itemId]?.tuneIds??[]){const control=curves.c(pack,node,id);if(!control||control.enabled===false)continue;const positions=curves.n(control),functions=control.functions??[];
   const profile=intern('control',[positions.map(num),num(control.range.defaultValue),functions.map(f=>[f.target,f.modifier,positions.map(v=>num(curves.r(pack.curves[f.curveId],v)))])]);
   const fn=functions.map((f,index)=>({...f,index,fields:projected({operation:'StaticAttributeModify',target:f.target,modifier:f.modifier,value:f.modifier==='Mult_C'?.5:1,scope:'NONE'})}));
   controls.push({id,profile,positions,functions:fn,slotPath:node.slotPath});
  }
  const value={ops,controls,node};partCache.set(key,value);return value;
 }
 function append(state,p,cost,choice){
  const tapes=new Map([...state.tapes].map(([key,tape])=>[key,[...tape]]));
  for(const op of p.ops)for(const key of projected(op))if(tapes.has(key))tapes.get(key).push(['static',num(op.value)]);
  const numeric=c.numeric(pack,p.ops,cloneBuckets(state.numeric.buckets));
  for(const control of p.controls)for(const f of control.functions)for(const key of f.fields){
   if(!tapes.has(key)){const split=key.lastIndexOf('|'),target=key.slice(0,split),modifier=key.slice(split+1),value=numeric.buckets.get(target)?.[fieldName[modifier]]??(modifier==='Mult_C'?1:modifier==='Initial'?undefined:0);tapes.set(key,[['constant',num(value)]]);}
   tapes.get(key).push(['control',control.slotPath,control.profile,f.index]);
  }
  return {numeric,tapes,refs:[...state.refs,...p.ops.filter(o=>o.operation==='StaticAttributeReplace').map(opKey)],controls:[...state.controls,...p.controls.map(c=>[c.slotPath,c.profile])],cost:state.cost+cost,root:state.root,choices:choice===undefined?state.choices:[...state.choices,choice]};
 }
 function rootState(config){
  const build=resolve(config),roots=build.mounted.filter(n=>!n.slotPath.includes('/')),firstChild=build.mounted.findIndex(n=>n.slotPath.includes('/'));
  if(firstChild>=0&&build.mounted.slice(firstChild).some(n=>!n.slotPath.includes('/')))throw Error('Nonclosed source root order');
  if(roots.some(n=>kernel.l(pack,n.itemId,mode)))throw Error('Root device selector is not closed');
  let state={numeric:c.numeric(pack,base),tapes:new Map(),refs:base.filter(o=>o.operation==='StaticAttributeReplace').map(opKey),controls:[],cost:0,root:build.config,choices:[]};
  for(const n of roots)state=append(state,part(n),n.source==='equipped'?shop.partCosts[n.itemId]:0);
  return {state,build,roots};
 }
 function shapeOf(build,roots){
  const slots=build.slots.filter(s=>s.slotPath.includes('/'));
  const full=slots.map(s=>{const ids=groups.options(s.options,s.slotPath),kept=ids.filter(id=>!removed.has([s.hostItemId,s.slotPath,id].join('|'))),def=build.mounted.find(n=>n.slotPath===s.slotPath);
   return {path:s.slotPath,socket:s.socketId,host:s.hostItemId,ids:kept,ordinary:kept.filter(id=>!groups.isTactical(s.slotPath,id)),default:def?{itemId:def.itemId,source:def.source}:null,profiles:kept.map(id=>[id,part({itemId:id,slotPath:s.slotPath,hostItemId:s.hostItemId,socketId:s.socketId}).controls.map(c=>c.profile)])};});
  const live=new Set([...roots.map(n=>Number(n.socketId)),...full.filter(s=>s.ordinary.length||s.default).map(s=>Number(s.socket))]);
  const unsafe=[];
  for(const s of full)for(const id of s.ordinary){if(pack.assembly.socketProviders[id]?.sockets?.length)unsafe.push('provider:'+id);if(conditionIds.has(id))unsafe.push('coupling:'+id);if((pack.assembly.extraOccupancy?.[id]?.occupiedSocketIds??[]).some(id=>live.has(Number(id))))unsafe.push('occupancy:'+id);}
  const tactical=build.slots.filter(s=>s.options.some(id=>groups.isTactical(s.slotPath,id))).map(s=>({path:s.slotPath,socket:s.socketId,ids:groups.options(s.options,s.slotPath),default:build.mounted.find(n=>n.slotPath===s.slotPath)?.itemId??null,occupied:build.config.find(n=>n.slotPath===s.slotPath)?.itemId??null}));
  const identity=roots.filter(n=>conditionIds.has(n.itemId)||mountIds.has(n.itemId)||fireIds.has(n.itemId)).map(n=>[n.slotPath,n.itemId]);
  const key=intern('shape',[full.map(({host,...s})=>s),tactical,identity]);
  return {key,full,unsafe:[...new Set(unsafe)]};
 }
 function key(state,level){
  const reference=intern('refs',state.refs),raw=level<=1?intern('numericRead',bucketsKey(state.numeric.buckets,t=>objectiveTargets.has(t))):intern('numericAll',bucketsKey(state.numeric.buckets));
  const fields=[reference,raw];if(level>=1)fields.push(state.cost);if(level>=3)fields.push(intern('calibration',state.controls));if(level>=4)fields.push(intern('insertion',[...state.tapes].sort(([a],[b])=>a.localeCompare(b))));return JSON.stringify(fields);
 }
 function analyzeRoot(config){const {state,build,roots}=rootState(config),shape=shapeOf(build,roots);return {config:build.config,cost:state.cost,shape:shape.key,unsafe:shape.unsafe,keys:[0,1,2,3,4].map(level=>level===1?JSON.stringify([intern('refs',state.refs),intern('numericRead',bucketsKey(state.numeric.buckets,t=>objectiveTargets.has(t))),state.cost]):key(state,level))};}
 function structuralPrefixes(){const restrictions=new Map();for(const p of compiled.players.values())if(typeof p.value==='string'&&(p.path.includes('/')||groups.isTactical(p.path,p.item)))restrictions.set(p.value,0);return [...createMountSearch(compiled).enumerate(restrictions)];}
 function runCohort(configs,level){
  const began=performance.now(),rootData=configs.map(rootState),shape=shapeOf(rootData[0].build,rootData[0].roots);
  if(shape.unsafe.length)throw Error('Unsafe leaf closure: '+shape.unsafe.join(','));
  let nextId=0,states=new Map(),nodes=new Map(),layers=[],transitions=0,weight=0n;
  for(let i=0;i<rootData.length;i++){const state=rootData[i].state,k=key(state,level);let old=states.get(k);if(old){old.mass++;old.roots.push(i);}else{old={...state,id:nextId++,mass:1n,roots:[i],incoming:[]};states.set(k,old);nodes.set(old.id,old);}}
  layers.push({layer:'roots',classes:states.size,weighted:rootData.length,transitions:rootData.length});
  const ordered=shape.full.filter(s=>s.ordinary.length||s.default);
  // Native source order must match this immutable sibling-slot order. It is
  // validated independently on reconstructed layouts by the investigation.
  for(let index=0;index<ordered.length;index++){
   const slot=ordered[index],last=index===ordered.length-1,out=new Map(),choices=[null,...slot.ordinary];let layerTransitions=0;
   for(const parent of states.values())for(const choice of choices){const id=choice??slot.default?.itemId,node=id?{itemId:id,slotPath:slot.path,hostItemId:slot.host,socketId:slot.socket}:null,p=node?part(node):{ops:[],controls:[]},cost=choice===null?0:shop.partCosts[choice];
    if(parent.cost+cost>r.budget)continue;
    const state=append(parent,p,cost,choice===null?null:{slotPath:slot.path,itemId:choice}),k=key(state,level);transitions++;layerTransitions++;
    const old=out.get(k);if(old){old.mass+=parent.mass;old.incoming.push([parent.id,choice]);}else{const entry={...state,id:nextId++,mass:parent.mass,incoming:[[parent.id,choice]],roots:null};out.set(k,entry);nodes.set(entry.id,entry);}
   }
   states=out;weight=[...states.values()].reduce((n,s)=>n+s.mass,0n);layers.push({layer:slot.path,classes:states.size,weighted:String(weight),transitions:layerTransitions});
  }
  weight=[...states.values()].reduce((n,s)=>n+s.mass,0n);
  // Keep only bounded reconstruction examples. The incoming arcs carry the
  // complete alias multiset during this run; no aliases are silently dropped.
  const collisions=[...states.values()].filter(s=>s.mass>1n).slice(0,8),examples=[];
  function reconstruct(nodeId,limit=3){const node=nodes.get(nodeId);if(node.roots)return node.roots.slice(0,limit).map(i=>rootData[i].build.config);const result=[];for(const [previous,choice]of node.incoming){for(const config of reconstruct(previous,limit-result.length)){const path=node.choices.at(-1)?.slotPath??ordered.find(s=>s.ordinary.includes(choice))?.path;result.push(choice===null?config:[...config,{slotPath:path,itemId:choice}]);if(result.length>=limit)return result;}}return result;}
  for(const s of collisions)examples.push({mass:String(s.mass),cost:s.cost,configs:reconstruct(s.id)});
  const representatives=[...states.values()].filter((s,i)=>i%Math.max(1,Math.floor(states.size/16))===0).slice(0,16).map(s=>[...s.root,...s.choices.filter(Boolean)]);
  return {level,root_prefixes:configs.length,root_classes:layers[0].classes,terminal_classes:states.size,weighted_layouts:String(weight),transitions,layers,examples,representatives,elapsed_ms:performance.now()-began,heap_used:process.memoryUsage().heapUsed};
 }
 return {structuralPrefixes,analyzeRoot,runCohort};
}
