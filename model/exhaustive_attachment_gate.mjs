import {compileMounts} from './scip_mount_model.mjs?v=9799ef2d762bb270';
import {statIds,shortfall} from './optimizer_policy.mjs?v=9799ef2d762bb270';
import {gateFraction,survivorCount,screeningComparator,rankingContract} from './screening_rank.mjs?v=9799ef2d762bb270';
import {createMountSearch} from './mount_search.mjs?v=9799ef2d762bb270';
import {boundCannotBeat} from './scoring_bounds.mjs?v=9799ef2d762bb270';
import {createSharedStatEvaluator} from './shared_stats.mjs?v=9799ef2d762bb270';
import {createBranchScoreBound} from './branch_score_bounds.mjs?v=9799ef2d762bb270';

export {gateFraction} from './screening_rank.mjs?v=9799ef2d762bb270';
const identityOrder=(a,b)=>a<b?-1:a>b?1:0;
export const configKey=config=>JSON.stringify(config.map(c=>[c.slotPath,c.itemId]).sort((a,b)=>identityOrder(a[0],b[0])||identityOrder(a[1],b[1])));
export const tacticalChoice=(pack,kernel,mode,path,item)=>[30,32,33,34,35].includes(Number(path.split('/').at(-1)))||kernel.l(pack,item,mode);

// Enumerate the mounting model's explicit decisions, rather than rejecting a
// source-resolved prefix. A later sibling can change a forced/default parent.
// Boolean interval bounds only reject prefixes with no possible legal extension.
export function mountConfigurations(compiled,restrictions=new Map(),tick=()=>{}) {
 return createMountSearch(compiled).enumerate(restrictions,tick);
}

// Count the entire legal domain, then keep exactly ceil(N/200) rows (0.5%).
export function retainBest(rows,count,compare,{onThreshold}={}){
 const size=Number(survivorCount(count)),heap=[];
 if(!Number.isSafeInteger(size))throw Error('The exhaustive survivor set exceeds the supported collection size.');
 const swap=(a,b)=>{[heap[a],heap[b]]=[heap[b],heap[a]];};
 for(const row of rows){
  if(!size)break;
  if(heap.length<size){heap.push(row);let i=heap.length-1;while(i){const parent=(i-1)>>1;if(compare(heap[parent],heap[i])>=0)break;swap(parent,i);i=parent;}}
  else if(compare(row,heap[0])<0){heap[0]=row;let i=0;for(;;){const left=2*i+1,right=left+1;let worst=i;if(left<heap.length&&compare(heap[left],heap[worst])>0)worst=left;if(right<heap.length&&compare(heap[right],heap[worst])>0)worst=right;if(worst===i)break;swap(i,worst);i=worst;}}
  if(heap.length===size)onThreshold?.(heap[0]);
 }
 return heap.sort(compare);
}

const reportCount=n=>n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):String(n);

export function exhaustiveAttachmentGate(input,modules,preset,{incremental=true,branchBounds=true,branchBudgetFraction=.05}={}) {
 if(!(branchBudgetFraction>=0)||branchBudgetFraction!==Infinity&&!Number.isFinite(branchBudgetFraction))throw Error('Invalid branch scoring work fraction');
 const {pack,request:r,shop,prices,onProgress,signal}=input,{kernel,curves}=modules,mode=r.mode,fixed=r.fixed??[];
 const started=performance.now(),compiled=compileMounts(input,kernel),resolve=config=>curves.o(pack,config,mode),costs=mode==='bd'?shop.partCosts:prices;
 // The current 69-weapon catalog has no selectable descendants of patches or
 // lasers. Fail explicitly if that assumption changes instead of silently
 // omitting ordinary purchases that only become available during stage two.
 if([...compiled.players.values()].some(p=>tacticalChoice(pack,kernel,mode,p.path,p.item)&&pack.assembly.socketProviders[p.item]?.sockets?.some(s=>(!s.modes||s.modes.includes(mode))&&s.optionItemIds?.length)))throw Error('Tactical attachments with child sockets require an expanded screening domain.');
 const search=createMountSearch(compiled,{incremental}),counting={strategy:'memoized_residual_subtrees',calls:0,source_floor_fallbacks:0,nodes:0,cache_hits:0,analytical_subtrees:0,memo_entries_peak:0,memo_key_chars_peak:0,intern_entries_peak:0,intern_key_chars_peak:0,cache_saturated:false,intern_saturated:false};
 const compare=screeningComparator(r.minimum_stats??{});
 const shared=preset.stateReuse?.raw===preset.raw?createSharedStatEvaluator(pack,kernel,{mode}):null;
 const count={nodes:0,visited:0n},floors=Object.keys(r.minimum_stats??{}).length>0;
 const certificate=preset.screeningBound,bound=certificate?.raw===preset.raw&&certificate?.score===preset.score&&certificate?.objectives===preset.objectives?certificate:null;
 const branchStarted=performance.now(),branch=branchBounds?createBranchScoreBound({pack,request:r,compiled,kernel,curves,calculate:modules.calculate,preset}):null,ranking={constraint_evaluations:0,boolean_evaluations:0,pruned_branches:0};
 let branchMs=performance.now()-branchStarted,branchChecks=0,branchBudgetSkips=0;
 bound?.begin?.();
 const scoring={strategy:'source_signature_group_bounds',supported:!!bound,considered:0,full_evaluations:0,bounds_evaluated:0,pruned:0,unsupported_fallbacks:0};let cutoff=null;
 let phase='attachments',pass='count',total=null,baseIndex=0,baseTotal=0,lastProgress=-Infinity,lastPhase=null;
 const progress=(force=false)=>{
  signal?.throwIfAborted();
  if(performance.now()-lastProgress<250&&phase===lastPhase&&(!force||phase==='tactical'))return;
  lastProgress=performance.now();lastPhase=phase;
  onProgress?.({phase:'screening_'+phase,pass,visited:reportCount(count.visited),total:total===null?null:reportCount(total),base_index:baseIndex,base_total:baseTotal,elapsed_ms:performance.now()-started});
 };
 const tick=()=>{if(++count.nodes%256===0)progress();};
 function* rows(restrictions,scored,enforceFloors){
  const prune=scored&&branch?context=>{
   if(!cutoff||context.remaining<2||context.remaining>4||shortfall(cutoff.stats,r.minimum_stats??{})!==0)return false;
   if(branchChecks&&branchMs>branchBudgetFraction*(performance.now()-started)){branchBudgetSkips++;return false;}
   const begin=performance.now(),lower=branch.lower(context);branchChecks++;branchMs+=performance.now()-begin;
   return lower!==null&&boundCannotBeat(lower,cutoff.stats,cutoff,r.minimum_stats??{});
  }:undefined;
  for(const config of search.enumerate(restrictions,tick,{prune,stats:ranking})){
   const build=resolve(config),key=configKey(config);
   if(configKey(build.config)!==key||fixed.some(f=>!build.mounted.some(n=>n.slotPath===f.slotPath&&n.itemId===f.itemId)))throw Error('Exhaustive mounting/source replay mismatch.');
   const cost=mode==='mp'?null:build.mounted.filter(n=>n.source==='equipped').reduce((n,m)=>n+costs[m.itemId],0);
   const state=scored||enforceFloors&&floors?(shared?shared.evaluate(build):kernel.u(pack,build,{mode,tacticalEffective:true,tunes:{}})):null;
   const stats=state?Object.fromEntries(Object.entries(statIds).map(([k,id])=>[k,state.numeric.mainAttr[id]])):null;
   if(enforceFloors&&floors&&shortfall(stats,r.minimum_stats)>1e-8)continue;
   count.visited++;
   if(!scored){yield null;continue;}
   scoring.considered++;
   if(bound&&cutoff){
    scoring.bounds_evaluated++;const lower=bound.lower(build,state);
    if(lower===null)scoring.unsupported_fallbacks++;
    else if((()=>{const delta=shortfall(stats,r.minimum_stats??{})-shortfall(cutoff.stats,r.minimum_stats??{});return delta!==0?delta>0:boundCannotBeat(lower,stats,cutoff,r.minimum_stats??{});})()){scoring.pruned++;continue;}
   }
   scoring.full_evaluations++;
   const components=preset.raw(build,{},state),score=preset.score(components);
   if(!Number.isFinite(score))throw Error('A legal attachment combination has no finite screening score.');
   yield {config:build.config,stats,score,objectives:preset.objectives?.(components)??[score],cost,signature:key};
  }
 }
 function screen(restrictions,enforceFloors){
  pass='count';total=null;count.visited=0n;progress(true);
  if(enforceFloors&&floors){
   // Source-dependent stat floors are not encoded in the mounting cache key.
   // Keep the exact source-filtered count rather than sharing unsafe states.
   counting.source_floor_fallbacks++;
   for(const _ of rows(restrictions,false,true)){/* Exact source floor filter. */}
  }else{
   const result=search.count(restrictions,{tick,onCount:n=>{count.visited+=n;}});counting.calls++;
   if(result.total!==count.visited)throw Error('Cached subtree counting progress disagrees with its exact total.');
   for(const [key,value] of Object.entries(result.stats)){
    if(typeof value==='boolean')counting[key]||=value;
    else if(key.endsWith('_peak'))counting[key]=Math.max(counting[key]??0,value);
    else counting[key]=(counting[key]??0)+value;
   }
  }
  const legal=count.visited;total=legal;pass='rank';count.visited=0n;cutoff=null;progress(true);
  const before=ranking.pruned_branches,retained=retainBest(rows(restrictions,true,enforceFloors),legal,compare,{onThreshold:row=>{cutoff=row;}});
  if(count.visited>legal||before===ranking.pruned_branches&&count.visited!==legal)throw Error('The exhaustive count and ranking traversals disagree.');
  progress(true);return {legal,retained};
 }
 const ordinary=new Map();
 for(const p of compiled.players.values())if(typeof p.value==='string'&&tacticalChoice(pack,kernel,mode,p.path,p.item)&&!fixed.some(f=>f.slotPath===p.path&&f.itemId===p.item))ordinary.set(p.value,0);
 const attachments=screen(ordinary,false),tactical=[],candidates=[];
 phase='tactical';baseTotal=attachments.retained.length;
 for(const base of attachments.retained){
  baseIndex++;const selected=new Set(base.config.map(c=>c.slotPath+'|'+c.itemId)),restrictions=new Map();
  for(const p of compiled.players.values())if(typeof p.value==='string'&&!tacticalChoice(pack,kernel,mode,p.path,p.item))restrictions.set(p.value,selected.has(p.path+'|'+p.item)?1:0);
  const result=screen(restrictions,true);
  tactical.push({base:base.signature,screened:reportCount(result.legal),retained:result.retained.length});
  candidates.push(...result.retained);
 }
 const unique=[...new Map(candidates.map(c=>[c.signature,c])).values()];
 return {candidates:unique,diagnostics:{fraction:gateFraction,ranking_contract:rankingContract,population:'legal explicit configurations before partial-state merging',complete:true,screening:'exhaustive_default_calibration',scope:'all legal ordinary combinations, then all legal tactical completions per retained base',attachments:{screened:reportCount(attachments.legal),retained:attachments.retained.length},tactical,candidate_count:unique.length,counting,ranking,branch_scoring:branch?{...branch.getStats(),elapsed_ms:branchMs,budget_skips:branchBudgetSkips}:{supported:false},stat_reuse:shared?.getStats()??{supported:false,reason:'scorer_requires_ordinary_state'},scoring:{...scoring,...bound?.getStats?.()},elapsed_ms:performance.now()-started,global_optimality:false}};
}
