import {compileMounts} from './scip_mount_model.mjs?v=0b4a96d6446ec67a';
import {createMountSearch} from './mount_search.mjs?v=0b4a96d6446ec67a';
import {createChoiceGroups} from './choice_groups.mjs?v=0b4a96d6446ec67a';
import {createSharedStatEvaluator} from './shared_stats.mjs?v=0b4a96d6446ec67a';
import {presets} from './optimizer_presets.mjs?v=0b4a96d6446ec67a';
import {configKey} from './exhaustive_attachment_gate.mjs?v=0b4a96d6446ec67a';
import {compareObjectives} from './optimizer_policy.mjs?v=0b4a96d6446ec67a';
import {gateFraction,survivorCount} from './screening_rank.mjs?v=0b4a96d6446ec67a';

// Exhaustive ordinary/default-calibration screening study. No portfolio overlap,
// neighbor heuristic, phase deadline, score-based pruning or automatic restart.
// Only a best preview is retained; top-0.5% storage is estimated separately.
function context(input,modules){
 const {pack,shop,prices,request:r}=input,{kernel,curves}=modules,mode=r.mode,fixed=r.fixed??[],resolve=config=>curves.o(pack,config,mode);
 if(mode!=='bd'||r.preset!=='recoil')throw Error('This study requires Detonation / Lowest Recoil');
 if(Object.keys(r.minimum_stats??{}).length)throw Error('Stat floors require a separate source-filtered count');
 if(r.experimental_dominance)throw Error('Dominance is disabled for exhaustive screening; every grouped layout must remain represented.');
 const preset=presets.recoil.create({pack,request:r,...modules,mode,resolve});
 const compiled=compileMounts(input,kernel),groups=createChoiceGroups({pack,shop,prices,kernel,curves,preset,mode,fixed});
 if(!groups.enabled)throw Error('Expected native equivalent-choice grouping');
 groups.constrain(compiled);
 const restrictions=new Map();
 for(const p of compiled.players.values())if(typeof p.value==='string'&&groups.isTactical(p.path,p.item)&&!fixed.some(f=>f.slotPath===p.path&&f.itemId===p.item))restrictions.set(p.value,0);
 const dominance={enabled:false,reason:'disabled_for_exhaustive_population',rules:[],block_rules:[]};
 return {compiled,groups,restrictions,preset,resolve,dominance};
}
export function screeningPlan(input,modules){
 const {compiled,dominance}=context(input,modules),paths=['2','3'];
 let partitions=[{id:0,selections:[]}];
 for(const path of paths){
  const ids=[null,...new Set([...compiled.players.values()].filter(p=>p.path===path&&typeof p.value==='string').map(p=>p.item))];
  partitions=partitions.flatMap(part=>ids.map(item=>({selections:[...part.selections,{path,item}]})));
 }
 return {paths,partitions:partitions.map((p,id)=>({id,...p})),scope:'all legal grouped ordinary attachment layouts, default calibration, tactical choices absent except locks',dominance,budget:input.request.budget??input.shop.weapons[input.pack.weaponId].gunsmithLimit,partition_proof:'Each explicit root barrel and stock choice, including none, belongs to exactly one Cartesian partition.'};
}
export function studyCount(input,modules){
 const started=performance.now(),{compiled,restrictions}=context(input,modules),search=createMountSearch(compiled);let nodes=0,covered=0n,last=-Infinity;
 const result=search.count(restrictions,{tick:()=>{
  nodes++;const now=performance.now();if(now-last<500)return;last=now;
  input.onProgress?.({phase:'exact_count',nodes,covered:String(covered),elapsed_ms:now-started});
 },onCount:n=>{covered+=n;}});
 if(result.total!==covered)throw Error('Exact count progress mismatch');
 return {total:String(result.total),elapsed_ms:performance.now()-started,stats:result.stats,gate_fraction:gateFraction,survivor_rows:String(survivorCount(result.total))};
}
export function screenPartition(input,modules,partition){
 const started=performance.now(),{compiled,restrictions,preset,resolve}=context(input,modules),{kernel}=modules,{pack,request:r,shop}=input;
 for(const {path,item} of partition.selections)for(const p of compiled.players.values())if(p.path===path&&typeof p.value==='string')restrictions.set(p.value,p.item===item?1:0);
 const search=createMountSearch(compiled),shared=createSharedStatEvaluator(pack,kernel,{mode:r.mode}),searchStats={};
 const d={phase:'exhaustive_ordinary',partition:partition.id,visited:0,scored:0,nodes:0,source_errors:0,best:null,serialization_samples:0,serialization_bytes:0};
 let last=-Infinity;
 const progress=(force=false)=>{const now=performance.now();if(!force&&now-last<500)return;last=now;input.onProgress?.({...d,elapsed_ms:now-started});};
 for(const config of search.enumerate(restrictions,()=>{d.nodes++;if(d.nodes%256===0)progress();},{stats:searchStats})){
  const build=resolve(config);
  if(configKey(build.config)!==configKey(config)||r.fixed.some(f=>!build.mounted.some(n=>n.slotPath===f.slotPath&&n.itemId===f.itemId)))throw Error('Exhaustive source mounting or lock mismatch');
  const state=shared.evaluate(build),components=preset.raw(build,{},state),score=preset.score(components),objectives=preset.objectives?.(components)??[score];
  if(!Number.isFinite(score))throw Error('Nonfinite exhaustive score');
  const cost=build.mounted.filter(n=>n.source==='equipped').reduce((n,p)=>n+shop.partCosts[p.itemId],0);
  if(cost>(r.budget??shop.weapons[pack.weaponId].gunsmithLimit))throw Error('Exhaustive budget mismatch');
  const row={config:build.config,tunes:{},score,loss:score,objectives,cost};
  d.visited++;d.scored++;
  if(!d.best||compareObjectives(row,d.best)<0)d.best=row;
  if(d.serialization_samples<100){d.serialization_samples++;d.serialization_bytes+=new TextEncoder().encode(JSON.stringify(row)).length;}
  input.onRow?.(row);progress();
 }
 progress(true);return {...d,complete:true,elapsed_ms:performance.now()-started,search_stats:searchStats,stat_reuse:shared.getStats()};
}
