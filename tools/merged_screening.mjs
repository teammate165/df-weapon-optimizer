// Exact ordinary/default-calibration screening study, not an anytime heuristic.
// Closed root/leaf cohorts use a layered decision DAG. Unsupported mounting
// boundaries retain the original exhaustive traversal. Calibrated aliases are
// reconstructed individually after ranking; tuning domains are never merged.
import {compileMounts} from './scip_mount_model.mjs';
import {createMountSearch} from './mount_search.mjs';
import {createChoiceGroups} from './choice_groups.mjs';
import {presets} from './optimizer_presets.mjs';
import {configKey} from './exhaustive_attachment_gate.mjs';
import {createSharedStatEvaluator} from './shared_stats.mjs';

const number=v=>v===undefined?'undefined':Object.is(v,-0)?'-0':Number.isFinite(v)?v:(()=>{throw Error('Nonfinite state');})();
const token=o=>[o.operation,o.target,o.modifier,typeof o.value==='number'?number(o.value):o.value,o.scope];
const rawKey=buckets=>JSON.stringify([...buckets].filter(([,b])=>!(b.initial===undefined&&Object.is(b.addend,0)&&Object.is(b.multA,0)&&b.multC===1)).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([t,b])=>[t,...['initial','addend','multA','multC'].map(k=>number(b[k]))]));
const clone=buckets=>new Map([...buckets].map(([t,b])=>[t,{...b}]));

export function createMergedScreening(input,modules){
 const {pack,request:r,shop}=input,{kernel,curves}=modules,mode=r.mode,c=kernel.u.screeningStateContract;
 if(pack.weaponId!=='18010000001'||mode!=='bd'||r.preset!=='recoil'||Object.keys(r.minimum_stats??{}).length||r.firing==='spam')throw Error('Merged study supports ordinary M4A1/Detonation/recoil without floors or spam only');
 if(r.fixed.some(f=>f.slotPath!=='11'||f.itemId!=='13110000091')||r.fixed.length!==1)throw Error('Merged fixture requires exactly locked Insight 3/7');
 if(!c||c.evaluate!==kernel.u||c.version!==1)throw Error('Native state contract unavailable');
 if(r.experimental_dominance)throw Error('Dominance is disabled for exhaustive screening; every grouped layout must remain represented.');
 const resolve=config=>curves.o(pack,config,mode),preset=presets.recoil.create({...input,...modules,mode,resolve});
 const compiled=compileMounts(input,kernel),groups=createChoiceGroups({...input,...modules,preset,mode,fixed:r.fixed});groups.constrain(compiled);
 const search=createMountSearch(compiled),ordinary=new Map();
 for(const p of compiled.players.values())if(typeof p.value==='string'&&groups.isTactical(p.path,p.item))ordinary.set(p.value,0);
 const opts={mode,tacticalEffective:true,tunes:{},includeAmmo:false,ammoItemId:null},base=c.collect(pack,{mounted:[]},opts).operations;
 const baseNumeric=c.numeric(pack,base),baseRefs=base.filter(o=>o.operation==='StaticAttributeReplace').map(token),shared=createSharedStatEvaluator(pack,kernel,{mode});
 const conditionIds=new Set();for(const entry of Object.values(pack.assembly.coupling??{}))for(const rule of entry.rules??[])for(const id of rule.condition?.itemIds??[])conditionIds.add(String(id));
 const identityIds=new Set(conditionIds);
 for(const [id,override]of Object.entries(pack.combat?.specialFire?.itemOverrides??{}))if(Object.keys(override).length)identityIds.add(id);
 for(const id of Object.keys(pack.combat?.specialFire?.explicitlyUnmodeled?.items??{}))identityIds.add(id);
 const cache=new Map();
 function operations(node){const key=node.slotPath+'|'+node.itemId;let ops=cache.get(key);if(!ops){ops=c.collect(pack,{mounted:[node]},opts).operations.filter(o=>o.sourceKind==='part');if(ops.some(o=>!['StaticAttributeModify','StaticAttributeReplace'].includes(o.operation)))throw Error('Unsupported native operation');cache.set(key,ops);}return ops;}
 function append(state,node,cost){
  const ops=node?operations(node):[],numeric=ops.length?c.numeric(pack,ops,clone(state.buckets)):null;
  return {buckets:numeric?.buckets??state.buckets,refs:[...state.refs,...ops.filter(o=>o.operation==='StaticAttributeReplace').map(token)],identities:node&&identityIds.has(node.itemId)?[...state.identities,[node.slotPath,node.itemId]]:state.identities,cost:state.cost+cost};
 }
 const stateKey=s=>JSON.stringify([rawKey(s.buckets),s.refs,s.identities,s.cost]);
 function costOf(build){return build.mounted.filter(n=>n.source==='equipped').reduce((n,p)=>n+shop.partCosts[p.itemId],0);}
 function rootRestrictions(config){const selected=new Set(config.map(n=>n.slotPath+'|'+n.itemId)),restrictions=new Map(ordinary);for(const p of compiled.players.values())if(typeof p.value==='string'&&!p.path.includes('/'))restrictions.set(p.value,selected.has(p.path+'|'+p.item)?1:0);return restrictions;}
 function describe(config){
  const build=resolve(config),roots=build.mounted.filter(n=>!n.slotPath.includes('/')),firstChild=build.mounted.findIndex(n=>n.slotPath.includes('/')),unsafe=[];
  if(firstChild>=0&&build.mounted.slice(firstChild).some(n=>!n.slotPath.includes('/')))unsafe.push('interleaved native order');
  if(build.config.some(n=>n.slotPath.includes('/')))unsafe.push('nonstructural prefix');
  if(roots.some(n=>kernel.l(pack,n.itemId,mode)))unsafe.push('device selector');
  const slots=build.slots.filter(s=>s.slotPath.includes('/')).map(s=>{
   const ordinaryIds=groups.options(s.options,s.slotPath).filter(id=>!groups.isTactical(s.slotPath,id)&&typeof compiled.players.get(s.slotPath+'|'+id)?.value==='string');
   const def=build.mounted.find(n=>n.slotPath===s.slotPath);
   return {path:s.slotPath,socket:s.socketId,host:s.hostItemId,options:ordinaryIds,default:def??null};
  }).filter(s=>s.options.length||s.default);
  const live=new Set([...roots.map(n=>Number(n.socketId)),...slots.map(s=>Number(s.socket))]);
  for(const slot of slots)for(const id of [...slot.options,...(slot.default?[slot.default.itemId]:[])]){
   if(pack.assembly.socketProviders[id]?.sockets?.length)unsafe.push('nested provider');
   if(conditionIds.has(id))unsafe.push('live coupling');
   if((pack.assembly.extraOccupancy?.[id]?.occupiedSocketIds??[]).some(id=>live.has(Number(id))))unsafe.push('live occupancy');
   if(kernel.l(pack,id,mode))unsafe.push('leaf device selector');
   if(pack.parts[id]?.boundAmmoByMode?.[mode])unsafe.push('bound ammo');
  }
  // Host identity can be omitted only for empty-tuning static collection.
  // All source defaults, choice labels and ordered future slots remain fixed.
  const shape=JSON.stringify(slots.map(s=>[s.path,s.socket,s.options,s.default?.itemId??null,s.default?.source??null]));
  let state={buckets:baseNumeric.buckets,refs:baseRefs,identities:[],cost:0};
  for(const node of roots)state=append(state,node,node.source==='equipped'?shop.partCosts[node.itemId]:0);
  return {config:build.config,build,roots,slots,shape,state,unsafe:[...new Set(unsafe)]};
 }
 function plan(){
  const restrictions=new Map(ordinary);for(const p of compiled.players.values())if(typeof p.value==='string'&&p.path.includes('/'))restrictions.set(p.value,0);
  const configs=[...search.enumerate(restrictions)],cohorts=new Map(),fallback=[];
  for(const config of configs){const d=describe(config);if(d.unsafe.length){fallback.push({config:d.config,reasons:d.unsafe});continue;}if(!cohorts.has(d.shape))cohorts.set(d.shape,[]);cohorts.get(d.shape).push({config:d.config,key:stateKey(d.state)});}
  const jobs=[];
  // Bounded cohorts keep 16 simultaneous workers within desktop/browser RAM.
  // Adjacent equal root states stay together to retain their suffix sharing.
  for(const rows of cohorts.values()){rows.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);for(let i=0;i<rows.length;i+=16)jobs.push({kind:'dag',configs:rows.slice(i,i+16).map(r=>r.config)});}
  for(let i=0;i<fallback.length;i+=16)jobs.push({kind:'fallback',configs:fallback.slice(i,i+16).map(r=>r.config),reasons:[...new Set(fallback.slice(i,i+16).flatMap(r=>r.reasons))]});
  // Small fixtures must still offer real work to all 16 requested workers.
  while(jobs.length<16){const largest=jobs.reduce((best,j,i)=>j.configs.length>jobs[best].configs.length?i:best,0),job=jobs[largest];if(!job||job.configs.length<2)break;const half=job.configs.splice(Math.ceil(job.configs.length/2));jobs.push({...job,configs:half});}
  const total=search.count(ordinary).total;
  return {total:String(total),root_prefixes:configs.length,supported_prefixes:configs.length-fallback.length,fallback_prefixes:fallback.length,continuation_shapes:cohorts.size,jobs:jobs.map((j,id)=>({...j,id})),dominance_enabled:false,population:'all legal grouped ordinary layouts before equivalent partial-state merging'};
 }
 function score(config){const build=resolve(config);if(configKey(build.config)!==configKey(config)||!r.fixed.every(f=>build.mounted.some(n=>n.slotPath===f.slotPath&&n.itemId===f.itemId)))throw Error('Native mounting/lock mismatch');const cost=costOf(build);if(cost>r.budget)throw Error('Budget mismatch');const state=shared.evaluate(build),raw=preset.raw(build,{},state),score=preset.score(raw),objectives=preset.objectives(raw);if(!objectives.every(Number.isFinite)||!Number.isFinite(score))throw Error('Nonfinite score');return {build,row:{score,objectives,cost,signature:configKey(build.config)}};}
 function flat(job,emit){
  const began=performance.now();let paths=0,nodes=0;
  for(const config of job.configs)for(const candidate of search.enumerate(rootRestrictions(config),()=>{nodes++;})){const {row}=score(candidate);emit(row);paths++;}
  return {id:job.id,kind:'flat',paths,classes:paths,transitions:nodes,root_merges:0,layer_merges:0,elapsed_ms:performance.now()-began};
 }
 function merged(job,emit){
  if(job.kind==='fallback')return {...flat(job,emit),kind:'fallback',reasons:job.reasons};
  const began=performance.now(),roots=job.configs.map(describe),shape=roots[0].shape;
  if(roots.some(d=>d.unsafe.length||d.shape!==shape))throw Error('Nonclosed or different continuation interfaces');
  const nodes=[],layers=[];let states=new Map(),transitions=0,rootMerges=0,layerMerges=0;
  function insert(out,state,edge,root){const key=stateKey(state),old=out.get(key);if(old){old.mass+=edge?nodes[edge.parent].mass:1n;nodes[old.id].mass=old.mass;if(edge)nodes[old.id].incoming.push(edge);else nodes[old.id].roots.push(root);return true;}
   const mass=edge?nodes[edge.parent].mass:1n,id=nodes.length;nodes.push({mass,incoming:edge?[edge]:[],roots:edge?null:[root]});out.set(key,{...state,mass,id});return false;}
  roots.forEach((d,i)=>{if(insert(states,d.state,null,i))rootMerges++;});layers.push({classes:states.size,paths:roots.length});
  for(const slot of roots[0].slots){
   const out=new Map();for(const parent of states.values())for(const choice of [null,...slot.options]){
    const id=choice??slot.default?.itemId,cost=choice===null?0:shop.partCosts[choice];if(parent.cost+cost>r.budget)continue;
    const node=id?{itemId:id,slotPath:slot.path,hostItemId:slot.host,socketId:slot.socket}:null,state=append(parent,node,cost);transitions++;
    if(insert(out,state,{parent:parent.id,path:slot.path,choice},null))layerMerges++;
   }
   states=out;layers.push({path:slot.path,classes:states.size,paths:String([...states.values()].reduce((n,s)=>n+s.mass,0n))});
  }
  function* reconstruct(id){const node=nodes[id];if(node.roots){for(const i of node.roots)yield roots[i].config;return;}for(const edge of node.incoming)for(const config of reconstruct(edge.parent))yield edge.choice===null?config:[...config,{slotPath:edge.path,itemId:edge.choice}];}
  let paths=0,classes=0;
  for(const state of states.values()){
   const aliases=reconstruct(state.id),first=aliases.next();if(first.done)throw Error('Lost DAG provenance');
   const {build,row}=score(first.value),nativeOps=c.collect(pack,build,opts).operations;
   if(rawKey(c.numeric(pack,nativeOps).buckets)!==rawKey(state.buckets)||JSON.stringify(nativeOps.filter(o=>o.operation==='StaticAttributeReplace').map(token))!==JSON.stringify(state.refs)||row.cost!==state.cost)throw Error('DAG/native ordered-state mismatch');
   classes++;emit(row);paths++;let mass=1n;
   for(const config of aliases){emit({...row,signature:configKey(config)});paths++;mass++;}
   if(mass!==state.mass)throw Error('Alias multiplicity differs from backpointer paths');
  }
  return {id:job.id,kind:'dag',paths,classes,transitions,root_merges:rootMerges,layer_merges:layerMerges,layers,elapsed_ms:performance.now()-began};
 }
 return {plan,flat,merged,score,describe};
}
