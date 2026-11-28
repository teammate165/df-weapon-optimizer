import {createDetailedStatEvaluator} from './detailed_stat_values.mjs';
import {presets} from './optimizer_presets.mjs';
import {policy,statIds,shortfall,comparator,compareObjectives,createPatternConstraint} from './optimizer_policy.mjs';
import {selectCategories,cheapestGate} from './optimizer_selection.mjs';
import {fixedSlotSeed,retainsFixedSlots,completeRiserOptics,emptyRisers} from './optimizer_mounts.mjs';
import {configKey,tacticalChoice} from './exhaustive_attachment_gate.mjs';
import {compileMounts} from './scip_mount_model.mjs';
import {createMountSearch} from './mount_search.mjs';
import {createSharedStatEvaluator} from './shared_stats.mjs';
import {createBranchScoreBound} from './branch_score_bounds.mjs';
import {boundCannotBeat} from './scoring_bounds.mjs';
import {timedRecoil} from './timed_recoil.mjs';
import {createChoiceGroups} from './choice_groups.mjs';
import {partitionExactMounts,restrictExactMountPartition} from './exact_ordinary_partitions.mjs';

export const shortlistLimits=Object.freeze({ordinary:256,tactical_per_base:16,complete:512});

// Worker zero keeps the established search order; companions explore different
// neighborhoods and traversal prefixes without changing feasibility or scoring.
const searchHash=value=>{let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
function searchOrder(rows,variant,key){return variant?[...rows].sort((a,b)=>searchHash(variant+':'+key(a))-searchHash(variant+':'+key(b))):rows;}

// A sorted score core plus hashed structural/cost diversity slots. All storage
// is bounded; rejected rows never enter an unbounded frontier or seen-set.
export class Shortlist {
 constructor(cap,compare,diversity=0){this.cap=cap;this.compare=compare;this.coreCap=cap-diversity;this.diversity=diversity;this.core=[];this.bank=new Map();this.peak=0;}
 add(row){
  const compare=this.compare,key=row.key;
  const old=this.core.findIndex(r=>r.key===key);
  if(old>=0&&compare(row,this.core[old])<0)this.core.splice(old,1);else if(old>=0)return;
  if(this.core.length<this.coreCap||compare(row,this.core.at(-1))<0){
   let lo=0,hi=this.core.length;while(lo<hi){const mid=(lo+hi)>>1;if(compare(row,this.core[mid])<0)hi=mid;else lo=mid+1;}
   this.core.splice(lo,0,row);if(this.core.length>this.coreCap)this.core.pop();
  }
  if(this.diversity){
   const structure=row.config.filter(c=>c.slotPath.split('/').length===1&&!['11','14','30','31','32','33','34','35'].includes(c.slotPath));
   let hash=2166136261;for(const char of JSON.stringify([structure,Math.floor(Math.log2(1+(row.cost??0)))*4]))hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
   const slot=hash%this.diversity,previous=this.bank.get(slot);if(!previous||compare(row,previous)<0||previous.key===key&&compare(row,previous)<=0)this.bank.set(slot,row);
  }
  this.peak=Math.max(this.peak,this.core.length+this.bank.size);
 }
 rows(){const unique=new Map();for(const row of [...this.core,...this.bank.values()])if(!unique.has(row.key)||this.compare(row,unique.get(row.key))<0)unique.set(row.key,row);return [...unique.values()].sort(this.compare);}
 get(key){
  let best=this.core.find(row=>row.key===key);
  for(const row of this.bank.values())if(row.key===key&&(!best||this.compare(row,best)<0))best=row;
  return best;
 }
 best(){return this.core[0]??this.rows()[0];}
 cutoff(){return this.core.length===this.coreCap?this.core.at(-1):null;}
}

async function loadRuntime(directory){
 const [{pathToFileURL},path]=await Promise.all([import('node:url'),import('node:path')]);
 const curves=await import(pathToFileURL(path.join(directory,'curves.mjs'))),kernel=await import(pathToFileURL(path.join(directory,'kernel.mjs'))),{t:calculate}=await import(pathToFileURL(path.join(directory,'attributes.mjs')));
 return {curves,kernel,calculate};
}

export async function generateAnytime(input,runtime){
 const started=performance.now(),modules=typeof runtime==='object'?runtime:await loadRuntime(runtime),{curves,kernel,calculate}=modules,{pack,request:r,shop,prices}=input,mode=r.mode,settings=policy(r),fixed=r.fixed??[];
 if(!['bd','sol','mp'].includes(mode))throw Error('Unknown mode');
 if(!Array.isArray(fixed)||fixed.some(f=>typeof f.slotPath!=='string'||typeof f.itemId!=='string')||new Set(fixed.map(f=>f.slotPath)).size!==fixed.length)throw Error('Invalid fixed attachments');
 if(r.firing&&!['auto','spam'].includes(r.firing))throw Error('Unknown firing protocol');
 if(r.passes!==undefined&&(!Number.isInteger(r.passes)||r.passes<1||r.passes>20))throw Error('Legacy passes must be 1..20');
 const limit=r.time_limit_seconds??(r.passes===undefined?30:Math.max(1,2*r.passes));const unlimited=limit===0;if(!unlimited&&(!Number.isFinite(limit)||limit<1||limit>600))throw Error('Search time limit must be 0 (unlimited) or 1..600 seconds');
 const tier=mode==='bd'?shop.weapons[pack.weaponId]:null,budgets=mode==='mp'?[null]:r.budgets??[mode==='bd'?tier?.gunsmithLimit:r.budget];
 if(mode!=='mp'&&(![1,3].includes(budgets.length)||budgets.some((b,i)=>!Number.isFinite(b)||b<0||i&&b<budgets[i-1]||mode==='bd'&&b>tier?.gunsmithLimit)))throw Error('Invalid budget or weapon cap');
 const resolve=config=>curves.o(pack,config,mode),retains=build=>retainsFixedSlots(build,fixed),initial=fixedSlotSeed(resolve,fixed,r.config);
 if(!retains(initial))throw Error('Fixed attachments conflict or cannot mount; include required parent selections');
 const hidden=new Set(mode==='bd'?shop.hiddenItemIds:[]),costs=mode==='bd'?shop.partCosts:prices,laserLimit=Math.max(1,fixed.filter(f=>kernel.l(pack,f.itemId,mode)).length);
 if(initial.mounted.some(n=>hidden.has(n.itemId)))throw Error('Fixed setup contains a hidden Detonation item');
 const preset=presets[settings.preset].create({pack,request:r,...modules,mode,resolve});
 if(preset.objectives&&!preset.allowTargets&&r.effectiveness_targets!==undefined)throw Error('This preset does not support custom effectiveness targets');
 const patternConstraint=createPatternConstraint(preset,resolve,r,settings.patternReduction);
 const patternCap=patternConstraint?.maximum??null;
 const detailedStatsFor=createDetailedStatEvaluator(pack,mode,settings.detailedLimits,modules);
 const hasLimits=Boolean(detailedStatsFor);
 const eligible=row=>(!hasLimits||row.detailedViolation===0)&&shortfall(row.stats,settings.minimums)<=1e-8&&(patternCap===null||row.components.pattern<=patternCap);
 const better=comparator(settings.minimums,null,patternCap);
 const compare=(a,b)=>better(a,b)?-1:better(b,a)?1:a.key.localeCompare(b.key);
 let starts=input.solver_starts;
 if(!starts&&typeof process!=='undefined'&&process.versions?.node){try{const fs=await import('node:fs/promises');starts=JSON.parse(await fs.readFile(new URL('../data/solver_starts/'+pack.weaponId+'.json',import.meta.url),'utf8'));}catch{}}
 const variant=Number.isInteger(input.search_variant)&&input.search_variant>0?input.search_variant:0;
 const deadline=Math.min((unlimited?Infinity:started+limit*1000),input.search_deadline===undefined?Infinity:started+Math.max(0,input.search_deadline-Date.now())),results=[],reports=[],candidatePools=[],stop=Symbol('phase deadline');
 const solver={name:'Anytime',formulation:'bounded diverse top-K attachment search and source-calculator coordinate calibration',time_limit_seconds:limit,time_limit_scope:unlimited?'unlimited':'total_search',global_optimality:false,elapsed_ms:0,screening_elapsed_ms:0,calibration_elapsed_ms:0,phases:[]};
 const check=until=>{input.signal?.throwIfAborted();if(performance.now()>=Math.min(until,deadline))throw stop;};
 let lastProgress=-Infinity;
 for(const [budgetIndex,budget] of budgets.entries()){
  const sliceStart=budgetIndex?performance.now():started,sliceEnd=started+(deadline-started)*(budgetIndex+1)/budgets.length,duration=Math.max(0,sliceEnd-sliceStart);
  const ordinary=new Shortlist(256,compare,64),complete=new Shortlist(512,compare,128),cache=new Map(),controlCache=new Map(),tuneControls=new WeakMap(),expanded=new Set(),tacticalVisited=new Set(),hints=new Map();
  const shared=preset.stateReuse?.raw===preset.raw?createSharedStatEvaluator(pack,kernel,{mode}):null;
  const groups=createChoiceGroups({pack,mode,shop,prices,kernel,curves,preset,fixed}),tactical=(path,id)=>groups.enabled?groups.isTactical(path,id):tacticalChoice(pack,kernel,mode,path,id);
  const d={budget,screening:'anytime_top_k',complete:false,limits:{...shortlistLimits},evaluation_attempts:0,cache_hits:0,evaluated:0,invalid:0,source_errors:0,calibration_evaluations:0,ordinary_evaluated:0,tactical_evaluated:0,tree_nodes:0,pruned_branches:0,ordinary_retained:0,candidate_count:0,cache_peak:0,ordinary_storage_peak:0,complete_storage_peak:0,phases:[]};
  let phase='search_attachments',phaseDeadline=sliceEnd,currentBase=0;
  const progress=(force=false)=>{
   input.signal?.throwIfAborted();const now=performance.now();if(!force&&now-lastProgress<150)return;lastProgress=now;
   input.onProgress?.({phase,budget,evaluated:d.evaluated,ordinary_retained:ordinary.rows().length,candidates:complete.rows().length,base_index:currentBase,elapsed_ms:now-started,time_limit_seconds:limit,best_loss:(complete.best()??ordinary.best())?.score??null,best_complete_loss:complete.best()?.score??null,best_ordinary_loss:ordinary.best()?.score??null,evaluation_attempts:d.evaluation_attempts,cache_hits:d.cache_hits,tree_nodes:d.tree_nodes,pruned_branches:d.pruned_branches,invalid:d.invalid,source_errors:d.source_errors,calibration_evaluations:d.calibration_evaluations,ordinary_tree_exhausted:d.ordinary_tree_exhausted??false,scored_per_second:d.evaluated/Math.max(.001,(now-started)/1000),complete:false});
  };
  const cleanTunes=(build,tunes)=>{
   const out={};if(!tunes||!Object.keys(tunes).length)return out;
   let available=tuneControls.get(build);
   if(!available){
    available=[];
    for(const n of build.mounted)for(const id of pack.parts[n.itemId]?.tuneIds??[]){
     const c=curves.c(pack,n,id);
     if(c&&c.enabled!==false)available.push({id,path:n.slotPath,defaultValue:c.range.defaultValue,positions:curves.n(c)});
    }
    tuneControls.set(build,available);
   }
   for(const {id,path,defaultValue,positions} of available){
    const v=tunes[path]?.[id];
    if(Number.isFinite(v)&&Math.abs(v-defaultValue)>1e-6&&positions.some(p=>Math.abs(p-v)<1e-6))(out[path]??={})[id]=v;
   }
   return out;
  };
  const evaluate=(config,tunes={},validated)=>{
   check(phaseDeadline);progress();d.evaluation_attempts++;
   try{
    let {build,key,cost}=validated??{};
    if(!validated){
     build=resolve(config);
     if(config.some(c=>!build.config.some(n=>n.slotPath===c.slotPath&&n.itemId===c.itemId))){d.invalid++;return null;}
     const canonical=groups.normalize(build),canonicalKey=configKey(canonical),resolvedKey=configKey(build.config);
     if(canonicalKey!==resolvedKey){
      build=resolve(canonical);key=configKey(build.config);
     }else key=resolvedKey;
     if(!retains(build)||canonical.some(c=>!build.config.some(n=>n.slotPath===c.slotPath&&n.itemId===c.itemId))||build.mounted.some(n=>hidden.has(n.itemId))||build.mounted.filter(n=>kernel.l(pack,n.itemId,mode)).length>laserLimit||build.mounted.filter(n=>pack.parts[n.itemId]?.boundAmmoByMode?.[mode]).length>1||emptyRisers(pack,build).length){d.invalid++;return null;}
     cost=mode==='mp'?null:0;if(mode!=='mp')for(const n of build.mounted.filter(n=>n.source==='equipped')){const price=costs[n.itemId];if(!Number.isFinite(price)||price<0){d.invalid++;return null;}cost+=price;}
     if(budget!==null&&cost>budget+1e-8){d.invalid++;return null;}
    }
    const clean=cleanTunes(build,tunes),cacheKey=JSON.stringify([key,clean]);if(cache.has(cacheKey)){d.cache_hits++;return cache.get(cacheKey);}
    const tuned=Object.keys(clean).length>0,state=!tuned&&shared?shared.evaluate(build):kernel.u(pack,build,{mode,tacticalEffective:true,tunes:clean}),components=preset.raw(build,clean,state),score=preset.score(components),stats=Object.fromEntries(Object.entries(statIds).map(([name,id])=>[name,state.numeric.mainAttr[id]]));
    if(!Number.isFinite(score))return null;
    d.evaluated++;if(phase==='calibration')d.calibration_evaluations++;if(phase==='search_tactical')d.tactical_evaluated++;
    const row={...detailedStatsFor?.(build,clean),key,config:build.config,tunes:clean,build,components,score,stats,objectives:preset.objectives?.(components)??[score],cost,signature:cacheKey};
    if(cache.size>=2048)cache.delete(cache.keys().next().value);cache.set(cacheKey,row);d.cache_peak=Math.max(d.cache_peak,cache.size);return row;
   }catch(error){if(error===stop||error.name==='AbortError')throw error;d.source_errors++;return null;}
  };
  const keepComplete=row=>{if(row&&(eligible(row)||hasLimits))complete.add(row);};
  const locked=path=>fixed.some(f=>f.slotPath===path||f.slotPath.startsWith(path+'/'));
  const strip=config=>config.filter(c=>!tactical(c.slotPath,c.itemId)||fixed.some(f=>f.slotPath===c.slotPath&&f.itemId===c.itemId));
  const keepOrdinary=config=>{const row=evaluate(strip(config));if(row){ordinary.add(row);d.ordinary_evaluated++;for(const c of row.config){const key=c.slotPath+'|'+c.itemId;hints.set(key,Math.min(hints.get(key)??Infinity,row.score));}}return row;};
  function* completions(build){for(const next of completeRiserOptics(pack,build,resolve,fixed,0,groups.options)){check(phaseDeadline);yield next;}}
  function* neighbors(row,tactical){
   for(const slot of searchOrder(row.build.slots,variant,s=>s.slotPath)){
    check(phaseDeadline);if(locked(slot.slotPath))continue;
    for(const itemId of searchOrder([null,...groups.options(slot.options,slot.slotPath)],variant,id=>slot.slotPath+':'+id)){
     check(phaseDeadline);if(itemId&&hidden.has(itemId)||itemId&&(groups.enabled?groups.isTactical(slot.slotPath,itemId):tacticalChoice(pack,kernel,mode,slot.slotPath,itemId))!==tactical)continue;
     const old=row.config.find(c=>c.slotPath===slot.slotPath);
     if(!itemId&&(!old||(groups.enabled?groups.isTactical(old.slotPath,old.itemId):tacticalChoice(pack,kernel,mode,old.slotPath,old.itemId))!==tactical))continue;
     const config=row.config.filter(c=>c.slotPath!==slot.slotPath&&!c.slotPath.startsWith(slot.slotPath+'/'));if(itemId)config.push({slotPath:slot.slotPath,itemId});
     const changed=resolve(config);if(itemId&&!changed.config.some(c=>c.slotPath===slot.slotPath&&c.itemId===itemId))continue;
     yield* completions(changed);
    }
   }
  }
  const runPhase=(name,fraction,work)=>{
   phase=name;phaseDeadline=sliceStart+duration*fraction;const begin=performance.now();progress(true);
   try{check(phaseDeadline);work();}catch(error){if(error!==stop)throw error;}
   const elapsed=performance.now()-begin;d.phases.push({phase:name,elapsed_ms:elapsed});solver.phases.push({label:name,budget,status:'best_found',elapsed_ms:elapsed,source_verified:true});
   if(name==='calibration')solver.calibration_elapsed_ms+=elapsed;else solver.screening_elapsed_ms+=elapsed;
  };
  let tree=null,pendingLeaf,branch=null,branchTime=0;
  const searchOrdinary=()=>{
   // Improve native-scored seeds across live sockets before the broad tree walk.
   const localEnd=performance.now()+Math.max(0,phaseDeadline-performance.now())*.6;
   let localExpansions=0;
   while(performance.now()<localEnd&&(!unlimited||localExpansions++<256)){
    const rows=ordinary.rows(),seed=searchOrder(rows.slice(0,variant?32:rows.length),variant,row=>row.key).find(row=>!expanded.has(row.key))??rows.find(row=>!expanded.has(row.key));if(!seed)break;
    expanded.add(seed.key);if(expanded.size>2048)expanded.delete(expanded.values().next().value);
    for(const build of neighbors(seed,false)){keepOrdinary(build.config);if(performance.now()>=localEnd)break;}
   }
   if(d.ordinary_tree_exhausted)return;
   if(!tree){
    check(phaseDeadline);const request={...r,budget,budgets:undefined};delete request.validationConfig;delete request.validationTunes;delete request.feasibility_only;
    const compiled=compileMounts({...input,request},kernel);let restrictions=new Map();
    for(const p of compiled.players.values())if(typeof p.value==='string'&&tactical(p.path,p.item)&&!fixed.some(f=>f.slotPath===p.path&&f.itemId===p.item))restrictions.set(p.value,0);
    groups.constrain(compiled);
    if(input.search_worker_count>1){
     const partitions=partitionExactMounts(compiled,restrictions,input.search_worker_count);
     const partition=partitions[input.search_worker_index];
     if(!partition){d.ordinary_tree_exhausted=true;return;}
     restrictions=restrictExactMountPartition(compiled,restrictions,partition);
     d.ordinary_partition=partition.id;
    }
    branch=hasLimits?null:createBranchScoreBound({pack,request,compiled,...modules,preset});const search=createMountSearch(compiled);
    tree=search.enumerate(restrictions,()=>{d.tree_nodes++;},{pause:()=>d.tree_nodes%32===0&&performance.now()>=Math.min(phaseDeadline,deadline),priority:(path,item)=>variant?searchHash(variant+':'+path+':'+item):item===null?ordinary.best()?.score??100:hints.get(path+'|'+item)??1000,prune:context=>{
     const cutoff=ordinary.cutoff();if(!branch||!cutoff||context.remaining<2||context.remaining>4||!eligible(cutoff)||branchTime>.05*(performance.now()-sliceStart))return false;
     const begin=performance.now(),lower=branch.lower(context);branchTime+=performance.now()-begin;
     const prune=lower!==null&&boundCannotBeat(lower,cutoff.stats,cutoff,settings.minimums);if(prune)d.pruned_branches++;return prune;
    }});
   }
   for(;;){
    check(phaseDeadline);progress();
    if(!pendingLeaf){
     const next=tree.next();
     if(next.done){d.ordinary_tree_exhausted=true;break;}
     if(next.value===null){d.tree_slices=(d.tree_slices??0)+1;break;}
     pendingLeaf=next.value;
    }
    keepOrdinary(pendingLeaf);pendingLeaf=undefined;
   }
  };
  const searchTacticalUngrouped=()=>{
   for(const base of ordinary.rows()){
    check(phaseDeadline);if(tacticalVisited.has(base.key))continue;tacticalVisited.add(base.key);currentBase++;
    const perBase=new Shortlist(16,compare),first=evaluate(base.config);if(first)perBase.add(first);
    // Explicit tactical Cartesian walk is independent for each ordinary base;
    // a per-base time share prevents the first base consuming the whole stage.
    const shareEnd=Math.min(phaseDeadline,performance.now()+Math.max(5,(phaseDeadline-performance.now())/Math.min(16,Math.max(1,ordinary.rows().length-tacticalVisited.size+1))));
    const visit=(build,index)=>{
     check(shareEnd);const slots=build.slots.filter(s=>!locked(s.slotPath)&&s.options.some(id=>tacticalChoice(pack,kernel,mode,s.slotPath,id)));
     if(index>=slots.length){const row=evaluate(build.config);if(row)perBase.add(row);return;}
     const slot=slots[index],options=[null,...slot.options.filter(id=>tacticalChoice(pack,kernel,mode,slot.slotPath,id)&&!hidden.has(id))];
     for(const itemId of options){
      check(shareEnd);const config=build.config.filter(c=>c.slotPath!==slot.slotPath&&!c.slotPath.startsWith(slot.slotPath+'/'));if(itemId)config.push({slotPath:slot.slotPath,itemId});
      const next=resolve(config);if(itemId&&!next.config.some(c=>c.slotPath===slot.slotPath&&c.itemId===itemId))continue;
      // Reject over-budget tactical prefixes before expanding their descendants.
      const row=evaluate(next.config);if(!row)continue;perBase.add(row);visit(next,index+1);
     }
    };
    try{
     // Greedily complete multiple tactical sockets before the Cartesian walk,
     // prioritizing enabled lasers so handling benefits are reached promptly.
     if(first){
      let current=first;
      const slots=current.build.slots.filter(s=>!locked(s.slotPath)&&s.options.some(id=>tacticalChoice(pack,kernel,mode,s.slotPath,id))).sort((a,b)=>Number(b.options.some(id=>kernel.l(pack,id,mode)))-Number(a.options.some(id=>kernel.l(pack,id,mode))));
      for(const slot of slots){
       let best=current;
       for(const itemId of slot.options.filter(id=>tacticalChoice(pack,kernel,mode,slot.slotPath,id)&&!hidden.has(id))){
        check(shareEnd);const config=current.config.filter(c=>c.slotPath!==slot.slotPath&&!c.slotPath.startsWith(slot.slotPath+'/')),build=resolve([...config,{slotPath:slot.slotPath,itemId}]);
        if(!build.config.some(c=>c.slotPath===slot.slotPath&&c.itemId===itemId))continue;
        const row=evaluate(build.config);if(row){perBase.add(row);if(better(row,best))best=row;}
       }
       current=best;
      }
     }
     visit(base.build,0);
    }catch(error){if(error!==stop)throw error;}
    for(const row of perBase.rows())keepComplete(row);
   }
  };
  const searchTactical=groups.enabled?()=>{
   for(const base of ordinary.rows()){
    check(phaseDeadline);if(tacticalVisited.has(base.key))continue;tacticalVisited.add(base.key);currentBase++;
    const perBase=new Shortlist(16,compare),first=evaluate(base.config);if(first)perBase.add(first);
    const shareEnd=Math.min(phaseDeadline,performance.now()+Math.max(5,(phaseDeadline-performance.now())/Math.min(16,Math.max(1,ordinary.rows().length-tacticalVisited.size+1))));
    try{for(const config of groups.tacticalConfigs(base.build,{budget,check:()=>check(shareEnd)})){const row=evaluate(config);if(row)perBase.add(row);}}
    catch(error){if(error!==stop)throw error;}
    for(const row of perBase.rows())keepComplete(row);
   }
  }:searchTacticalUngrouped;
  const controls=build=>build.mounted.flatMap(node=>(pack.parts[node.itemId]?.tuneIds??[]).flatMap(id=>{
   const c=curves.c(pack,node,id);if(!c||c.enabled===false||!groups.scoredControl(c))return [];
   const key=JSON.stringify([node.itemId,node.socketId,node.hostItemId,id]);
   if(!controlCache.has(key)){
    const positions=curves.n(c);let keep=positions.map(value=>({value,vector:Object.fromEntries((c.functions??[]).map(f=>[f.target,curves.r(pack.curves?.[f.curveId],value)]))}));
    for(const group of preset.calibrationPriorities??[]){const targets=group.filter(t=>keep.some(p=>Number.isFinite(p.vector[t]))),min=Object.fromEntries(targets.map(t=>[t,Math.min(...keep.map(p=>p.vector[t]??0))])),next=keep.filter(p=>targets.every(t=>(p.vector[t]??0)===min[t]));if(next.length)keep=next;}
    controlCache.set(key,{id,positions,proposal:(keep.find(p=>p.value===c.range.defaultValue)??keep[0])?.value});
   }
   return [{path:node.slotPath,...controlCache.get(key)}];
  }));
  const calibrationQueue=()=>{
   const queue=complete.rows();
   if(patternCap!==null||hasLimits){
    const keys=new Set(queue.map(row=>row.key));
    queue.push(...ordinary.rows().filter(row=>!keys.has(row.key)).slice(0,32));
   }
   return queue;
  };
  const calibrate=(local,shared)=>{
   let queue=local;
   const ownedSignatures=new Set();
   if(shared){
    const bySignature=new Map(local.map(row=>[row.signature,row]));
    const owned=shared.owned.map(seed=>bySignature.get(seed.signature)??evaluate(seed.config,seed.tunes)).filter(Boolean);
    for(const row of owned)keepComplete(row);
    const delegated=new Set(shared.signatures);
    queue=[...owned,...local.filter(row=>!delegated.has(row.signature))];
    d.coordinated_calibration_rounds=(d.coordinated_calibration_rounds??0)+1;
    d.assigned_calibration_starts=(d.assigned_calibration_starts??0)+owned.length;
    for(const row of owned)ownedSignatures.add(row.signature);
    d.delegated_calibration_starts=(d.delegated_calibration_starts??0)
     +local.filter(row=>delegated.has(row.signature)&&!ownedSignatures.has(row.signature)).length;
   }
   let round=0;
   do{
    let improved=false;
    for(const seed of queue){
     check(phaseDeadline);
     let current=round===0&&ownedSignatures.has(seed.signature)?seed:complete.get(seed.key)??seed;
     const cs=controls(current.build);
     const proposal={...current.tunes};for(const c of cs)if(c.proposal!==undefined)proposal[c.path]={...proposal[c.path],[c.id]:c.proposal};
     const joint=evaluate(current.config,proposal,current);if(joint&&better(joint,current)){current=joint;keepComplete(current);improved=true;}
     for(const c of cs)for(const value of c.positions){
      check(phaseDeadline);const tunes={...current.tunes,[c.path]:{...current.tunes[c.path],[c.id]:value}},row=evaluate(current.config,tunes,current);
      if(row&&better(row,current)){current=row;keepComplete(current);improved=true;}
     }
    }
    if(!improved)break;round++;
   }while(round<3);
  };
  const runCalibration=async(round,fraction)=>{
   const queue=calibrationQueue(),end=sliceStart+duration*fraction;
   const shared=input.exchange_calibration&&end>performance.now()
    ?await input.exchange_calibration({budgetIndex,round,waitMs:Math.min(50,Math.floor(end-performance.now())),
     seeds:queue.slice(0,16).map(({key,signature,config,tunes})=>({key,signature,config,tunes}))})
    :null;
   runPhase('calibration',fraction,()=>calibrate(queue,shared));
  };
  // Seeds are hints only: all mounting, prices, effects and tuning are replayed.
  runPhase('search_attachments',.35,()=>{
   const witness=r.feasibility_seed;
   if(hasLimits&&Array.isArray(witness?.config)){
    keepComplete(evaluate(witness.config,witness.tunes));
   }
   const seeds=[{config:initial.config,tunes:{}},{config:r.config??initial.config,tunes:r.tunes??{}},...(starts?.starts??[]).filter(s=>!s.preset||s.preset===settings.preset).sort((a,b)=>Number(b.source_mode===mode)-Number(a.source_mode===mode))];
   for(const seed of searchOrder(seeds,variant,seed=>configKey(seed.config))){
    check(phaseDeadline);const config=[...seed.config.filter(c=>!fixed.some(f=>f.slotPath===c.slotPath||f.slotPath.startsWith(c.slotPath+'/'))),...fixed.filter(f=>!f.keepDefault)];
    for(const build of completions(resolve(config))){keepComplete(evaluate(build.config,seed.tunes));keepOrdinary(build.config);}
   }
   searchOrdinary();
  });
  runPhase('search_tactical',.5,searchTactical);
  await runCalibration(0,.8);
  runPhase('search_attachments',.88,()=>{
   // Calibrated incumbents seed a second attachment round; the source scorer
   // rechecks all proposals and the complete pool retains the best tuned row.
   const now=performance.now(),feedbackEnd=now+Math.max(0,phaseDeadline-now)*.5;
   feedback:for(const seed of complete.rows().slice(0,8))for(const build of neighbors(seed,false)){
    if(performance.now()>=feedbackEnd)break feedback;
    keepComplete(evaluate(build.config,seed.tunes));keepOrdinary(build.config);
   }
   searchOrdinary();
  });
  runPhase('search_tactical',.92,searchTactical);
  await runCalibration(1,1);
  d.ordinary_retained=ordinary.rows().length;d.candidate_count=complete.rows().length;d.ordinary_storage_peak=ordinary.peak;d.complete_storage_peak=complete.peak;d.stat_reuse=shared?.getStats()??{supported:false};d.branch_scoring=branch?.getStats()??{supported:false};d.choice_groups=groups.getStats();d.elapsed_ms=performance.now()-sliceStart;reports.push(d);
  const rows=complete.rows().filter(eligible);
  if(input.collect_candidates)candidatePools.push({budget,rows:rows.map(({build,...row})=>row)});
  results.push(...publishAnytimeRows(rows,{pack,r,modules,mode,settings,budget,budgetIndex,budgetCount:budgets.length,resolve}));
 }
 deduplicateResults(results,settings);
 const baseline=kernel.u(pack,resolve([]),{mode,tacticalEffective:true,tunes:{}});solver.elapsed_ms=performance.now()-started;
 const output={...(patternConstraint?{pattern_constraint:patternConstraint}:{}),weapon_id:pack.weaponId,mode,preset:settings.preset,output_standard:settings.automatic?'max_balanced_min':'custom_targets',recoil_context:'ads',selection:settings.automatic?(preset.objectiveNames?.length>1?'lexicographic':'weighted'):'custom_targets',objective_names:preset.objectiveNames,minimum_stats:settings.minimums,...(hasLimits?{stat_limits:settings.detailedLimits}:{}),baseline:preset.baseline,baseline_stats:Object.fromEntries(Object.entries(statIds).map(([name,id])=>[name,baseline.numeric.mainAttr[id]])),baseline_recoil_path:timedRecoil(pack,resolve([]),{},r,modules),baseline_score:0,baseline_loss:100,score_direction:'higher',weights:preset.weights,tier,cheapest_gate_percent:mode==='mp'?null:cheapestGate,experimental:true,method:'Anytime bounded top-K ordinary and tactical search, source-calculator calibration with feedback',score_model:presets[settings.preset].description,limitations:[...preset.limitations,'Time-limited best-found search. Legal combinations can remain unexplored; shortlists are not proven global top-K. The time budget covers attachment search, tactical search and calibration. Calibration uses legal-position source-scored coordinate refinement, not a global calibration proof.'],attachment_gate:{fraction:null,complete:false,screening:'anytime_top_k',limits:{...shortlistLimits},budgets:reports,global_optimality:false},solver,provenance:input.provenance,results};
 if(input.collect_candidates)output.search_candidates=candidatePools;
 return output;
}

function publishAnytimeRows(rows,{pack,r,modules,mode,settings,budget,budgetIndex,budgetCount,resolve}){
 const results=[],strongest=rows[0],publish=(row,label,target=null)=>{
   if(!row){results.push({label,budget,status:'not_found',reason:settings.patternReduction===undefined?'No feasible build found within the search budget. Infeasibility has not been proven.':'No build meeting the pattern reduction was found within the search budget.'});return;}
   const {build:storedBuild,key,detailedViolation,...rest}=row,build=storedBuild??resolve(row.config),path=timedRecoil(pack,build,row.tunes,r,modules);
   results.push({...rest,label,budget,status:'best_found',loss:row.score,score:100-row.score,improvement_percent:100-row.score,effectiveness_percent:strongest&&100-strongest.score>1e-8?100*(100-row.score)/(100-strongest.score):100,target_effectiveness_percent:target,category_note:null,mounted:build.mounted,recoil_path:path,converged:false});
  };
  if(budgetCount>1){publish(strongest,['Min','Balanced','Max'][budgetIndex]);return results;}
  const better=comparator(settings.minimums),compare=(a,b)=>better(a,b)?-1:better(b,a)?1:a.key.localeCompare(b.key);
  if(!settings.automatic){publish(strongest,'Max');for(const target of settings.targets){const threshold=strongest?100-(100-strongest.score)*target/100:-Infinity,eligible=rows.filter(row=>row.score<=threshold+1e-8),chosen=eligible.sort((a,b)=>(a.cost??0)-(b.cost??0)||compare(a,b))[0];publish(chosen,target===70?'cheapest':target===90?'mid-range':target+'% effective',target);}return results;}
  if(mode==='mp'||!strongest){publish(strongest,'Max');for(const label of ['Balanced','Min'])results.push({label,budget,status:strongest?'unavailable':'not_found',reason:strongest?'Cost is unavailable in Warfare.':'No feasible build found within the search budget; infeasibility is unproven.'});return results;}
  const selected=selectCategories(rows);publish(selected.strongest,'Max');for(const [key,label] of [['value','Balanced'],['cheapest','Min']])if(selected[key])publish(selected[key],label,cheapestGate);else results.push({label,budget,status:'unavailable',reason:'No distinct price-based alternative found.'});
 return results;
}

function deduplicateResults(results,settings){
 if(settings.automatic){results.sort((a,b)=>['Max','Balanced','Min'].indexOf(a.label)-['Max','Balanced','Min'].indexOf(b.label));const seen=new Set();for(let i=0;i<results.length;i++)if(results[i].status==='best_found'){if(seen.has(results[i].signature))results[i]={label:results[i].label,budget:results[i].budget,status:'unavailable',reason:'No distinct price-based alternative found.'};else seen.add(results[i].signature);}}
}

// Candidate messages originate from our own search workers. Their native scores
// remain authoritative; reconstruct source builds only for the selected output.
export function mergeAnytimeResults(outputs,{pack,request:r},modules){
 if(!outputs.length)throw Error('No search worker completed');
 const settings=policy(r),mode=r.mode,resolve=config=>modules.curves.o(pack,config,mode),better=comparator(settings.minimums),compare=(a,b)=>better(a,b)?-1:better(b,a)?1:a.key.localeCompare(b.key);
 const result={...outputs[0]},pools=outputs[0].search_candidates;
 if(!pools)throw Error('Missing worker candidates');
 result.results=[];const retained=[],uniqueCandidates=[];
 for(const [budgetIndex,pool]of pools.entries()){
  const shortlist=new Shortlist(512,compare,128);
  const unique=new Set();
  for(const output of outputs){if(output.weapon_id!==result.weapon_id||output.mode!==mode||output.preset!==settings.preset)throw Error('Incompatible search workers');for(const row of output.search_candidates?.find(p=>p.budget===pool.budget)?.rows??[]){shortlist.add(row);unique.add(row.key);}}
  uniqueCandidates.push(unique.size);
  const rows=shortlist.rows();retained.push(rows.length);
  result.results.push(...publishAnytimeRows(rows,{pack,r,modules,mode,settings,budget:pool.budget,budgetIndex,budgetCount:pools.length,resolve}));
 }
 deduplicateResults(result.results,settings);delete result.search_candidates;
 const coordinated=outputs.some(o=>o.attachment_gate.budgets.some(b=>b.ordinary_partition!==undefined||b.coordinated_calibration_rounds));
 result.solver={...result.solver,parallel:{strategy:coordinated?'partitioned_tree_and_calibration_exchange':'diverse_search_orders',workers:outputs.length,unique_candidates:uniqueCandidates,merged_candidates:retained,worker_elapsed_ms:outputs.map(o=>o.solver.elapsed_ms),worker_evaluated:outputs.map(o=>o.attachment_gate.budgets.reduce((sum,b)=>sum+b.evaluated,0)),worker_best_losses:outputs.map(o=>o.results.filter(r=>r.status==='best_found'&&r.label==='Max').map(r=>r.loss))}};
 return result;
}
