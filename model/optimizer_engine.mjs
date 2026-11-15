import {completeRiserOptics} from './optimizer_mounts.mjs?v=e6e3c470b921ffef';
import {timedRecoil} from './timed_recoil.mjs?v=e6e3c470b921ffef';
import {policy,statIds,shortfall,comparator,compareObjectives} from './optimizer_policy.mjs?v=e6e3c470b921ffef';
import {presets} from './optimizer_presets.mjs?v=e6e3c470b921ffef';
import {selectCategories,cheapestGate} from './optimizer_selection.mjs?v=e6e3c470b921ffef';

async function loadRuntime(directory) {
  const {pathToFileURL}=await import('node:url');
  const path=await import('node:path');
  const curves=await import(pathToFileURL(path.join(directory,'curves.mjs?v=e6e3c470b921ffef')));
  const kernel=await import(pathToFileURL(path.join(directory,'kernel.mjs?v=e6e3c470b921ffef')));
  const {t:calculate}=await import(pathToFileURL(path.join(directory,'attributes.mjs?v=e6e3c470b921ffef')));
  return {curves,kernel,calculate};
}

// Best-found coordinate search; all mounting/coupling and effect arithmetic use
// the preserved source resolver. No source UI heuristics enter the objective.
export async function generate(input, runtime) {
  const {curves,kernel,calculate} = typeof runtime === 'object' ? runtime : await loadRuntime(runtime);
  const {request:r, pack, shop, prices} = input;
  const mode = r.mode;
  const settings=policy(r);
  const fixed = r.fixed ?? [];
  if (!Array.isArray(fixed) || fixed.some(f=>typeof f.slotPath!=='string'||typeof f.itemId!=='string')) throw Error('fixed must contain string slotPath/itemId pairs');
  if (!['sol','bd','mp'].includes(mode)) throw Error('Unknown mode');
  if (new Set(fixed.map(x=>x.slotPath)).size !== fixed.length) throw Error('Duplicate fixed slot');
  const buildCache=new Map();
  const resolve=config=>{
    const key=JSON.stringify(config);
    if(!buildCache.has(key))buildCache.set(key,curves.o(pack,config,mode));
    return buildCache.get(key);
  };
  const retains = build => fixed.every(f=>build.mounted.some(m=>m.slotPath===f.slotPath && m.itemId===f.itemId));
  if (r.firing && !['auto','spam'].includes(r.firing)) throw Error('firing must be auto or spam');
  const {raw,score,baseline,weights,objectives,objectiveNames,limitations,allowTargets=false}=presets[settings.preset].create({pack,request:r,kernel,resolve,mode,calculate,curves});
  if(objectives && !allowTargets && r.effectiveness_targets!==undefined)throw Error('This preset does not support custom effectiveness targets');
  const timedModules={calculate,curves,kernel};
  const baseNumeric=kernel.u(pack,resolve([]),{tacticalEffective:true,mode,tunes:{}}).numeric;
  const baseline_stats=Object.fromEntries(Object.entries(statIds).map(([key,id])=>[key,baseNumeric.mainAttr[id]]));
  const baselinePath=timedRecoil(pack,resolve([]),{},r,timedModules);
  const costs=mode==='bd'?shop.partCosts:prices;
  const cost=build=> {
    let total=0; const missing=[];
    for (const m of build.mounted.filter(m=>m.source==='equipped')) {
      const value=costs[m.itemId];
      if (!Number.isFinite(value)||value<0) missing.push(m.itemId); else total+=value;
    }
    return {total:missing.length?null:total,missing};
  };
  const initial=resolve(fixed);
  if (mode==='bd' && initial.mounted.some(m=>shop.hiddenItemIds.includes(m.itemId))) throw Error('Fixed setup contains a hidden Detonation item');
  if (!retains(initial)) throw Error('Fixed attachments conflict or cannot mount; include required parent selections');
  const tier=mode==='bd'?shop.weapons[pack.weaponId]:null;
  if (mode==='bd' && !tier) throw Error('Missing Detonation classification');
  let budgets=r.budgets;
  if(mode==='sol' && !budgets && Number.isFinite(r.budget))budgets=[r.budget];
  if (mode==='bd' && !budgets) budgets=[tier.gunsmithLimit];
  if (mode!=='mp' && (!Array.isArray(budgets)||![1,3].includes(budgets.length)||budgets.some((n,i)=>!Number.isFinite(n)||n<0||(i>0&&n<budgets[i-1])))) throw Error('Supply one maximum budget or three ascending mod budgets');
  if (mode==='bd' && budgets.some(n=>n>tier.gunsmithLimit)) throw Error('Budget exceeds weapon mod cap');
  if (mode==='mp') budgets=[null];
  const passes=r.passes??8;
  if (!Number.isInteger(passes)||passes<1||passes>20) throw Error('passes must be 1..20');
  const results=[];
  const cache=new Map();
  let frontier=[];
  const targetLoss=(anchor,target)=>anchor.score>=100?anchor.score:100-(100-anchor.score)*target/100;
  // Normalize tuning whenever equipment changes: old values cannot leak into a
  // replacement part with different calibration ranges.
  const cleanTunes=(build,tunes)=>{
    const out={};
    for(const m of build.mounted)for(const id of pack.parts[m.itemId]?.tuneIds??[]){
      const control=curves.c(pack,m,id);
      if(!control||control.enabled===false)continue;
      const value=tunes[m.slotPath]?.[id];
      if(curves.n(control).some(v=>Math.abs(v-value)<1e-6))(out[m.slotPath]??={})[id]=value;
    }
    return out;
  };
  const search=(budget,seed,targetScore=null)=>{
    const better=comparator(settings.minimums,targetScore);
    const evaluateSingle=(config,tunes={})=>{
      const build=resolve(config);
      if(!retains(build))return null;
      // Extra enabled devices cannot supply extra bonuses. Preserve explicitly
      // locked multi-device setups, but never add redundant devices in search.
      const lockedLasers=fixed.filter(f=>kernel.l(pack,f.itemId,mode)).length;
      if(build.mounted.filter(m=>kernel.l(pack,m.itemId,mode)).length>Math.max(1,lockedLasers))return null;
      if(mode==='bd'&&build.mounted.some(m=>shop.hiddenItemIds.includes(m.itemId)))return null;
      const quote=mode==='mp'?{total:null}:cost(build);
      if(budget!==null&&(quote.total===null||quote.total>budget))return null;
      tunes=cleanTunes(build,tunes);
      const key=JSON.stringify([build.config,tunes]);
      let metrics=cache.get(key);
      if(!metrics){
        const state=kernel.u(pack,build,{tacticalEffective:true,mode,tunes});
        const components=raw(build,tunes,state);
        const numeric=state.numeric;
        metrics={components,score:score(components),stats:Object.fromEntries(Object.entries(statIds).map(([k,id])=>[k,numeric.mainAttr[id]]))};
        if(objectives)metrics.objectives=objectives(components);
        if(!Number.isFinite(metrics.score)||metrics.objectives?.some(v=>!Number.isFinite(v)))throw Error('Non-finite optimizer objective');
        cache.set(key,metrics);
      }
      const effectiveTunes=[];
      for(const mounted of build.mounted)for(const id of pack.parts[mounted.itemId]?.tuneIds??[]){
        const control=curves.c(pack,mounted,id),value=tunes[mounted.slotPath]?.[id];
        if(control&&value!==undefined&&Math.abs(value-control.range.defaultValue)>1e-6)effectiveTunes.push([mounted.slotPath,id,value]);
      }
      const signature=JSON.stringify([build.mounted.map(m=>[m.slotPath,m.itemId]).sort(),effectiveTunes.sort()]);
      const candidate={config:build.config,tunes,...metrics,cost:quote.total,build,signature};
      if(shortfall(candidate.stats,settings.minimums)<1e-8 && !frontier.some(c=>compareObjectives(c,candidate)<=0 && (c.cost??0)<=(candidate.cost??0))){
        frontier=frontier.filter(c=>!(compareObjectives(candidate,c)<=0 && (candidate.cost??0)<=(c.cost??0)));
        frontier.push(candidate);
      }
      return candidate;
    };
    const evaluate=(config,tunes={})=>{
      let best=null;
      for(const completed of completeRiserOptics(pack,resolve(config),resolve,fixed)) {
        const candidate=evaluateSingle(completed.config,tunes);
        if(candidate&&(!best||better(candidate,best)))best=candidate;
      }
      return best;
    };
    const tune=(candidate,changedPath=null)=>{
      let best=candidate;
      if(!best)return null;
      for(const mounted of best.build.mounted.filter(m=>changedPath===null||m.slotPath===changedPath||m.slotPath.startsWith(changedPath+'/')))for(const id of pack.parts[mounted.itemId]?.tuneIds??[]){
        const control=curves.c(pack,mounted,id);
        if(!control||control.enabled===false)continue;
        const positions=curves.n(control);
        // Replacement screening includes both endpoints and intermediate
        // trade-offs. Incumbent calibration searches every legal position.
        const probes=changedPath===null?positions:[...new Set([positions[0],positions[Math.floor((positions.length-1)/4)],positions[Math.floor((positions.length-1)/2)],positions[Math.floor(3*(positions.length-1)/4)],positions.at(-1),control.range.defaultValue])];
        for(const value of probes){
          const tunes=structuredClone(best.tunes);
          (tunes[mounted.slotPath]??={})[id]=value;
          const next=evaluate(best.config,tunes);
          if(next&&better(next,best))best=next;
        }
      }
      return best;
    };
    let best=tune(evaluate(seed?.config??fixed,seed?.tunes??{}));
    if(!best)return null;
    let converged=false;
    for(let pass=0;pass<passes;pass++) {
      let changed=false;
      for (const slot of best.build.slots) {
        if (fixed.some(f=>f.slotPath===slot.slotPath)) continue;
        for(const itemId of [null,...slot.options]) {
          if(mode==='bd'&&shop.hiddenItemIds.includes(itemId)) continue;
          const config=best.config.filter(x=>x.slotPath!==slot.slotPath&&!x.slotPath.startsWith(slot.slotPath+'/'));
          if(itemId) config.push({slotPath:slot.slotPath,itemId});
          // Retain tuning only for unchanged items, then tune this candidate
          // before comparing it with a more expensive attachment combination.
          const retained=Object.fromEntries(Object.entries(best.tunes).filter(([path])=>path!==slot.slotPath&&!path.startsWith(slot.slotPath+'/')));
          const candidate=tune(evaluate(config,retained),slot.slotPath);
          if(candidate&&better(candidate,best)){best=tune(candidate);changed=true;}
        }
      }
      const calibrated=tune(best);
      if(better(calibrated,best)){best=calibrated;changed=true;}
      if(!changed){converged=true;break;}
    }
    return {...best,converged};
  };
  const publish=(best,label,budget,target=null,anchor=null,categoryNote=null)=>{
    if(!best){results.push({label,budget,status:'infeasible',reason:'Fixed setup exceeds budget or has missing quotes'});return;}
    if(shortfall(best.stats,settings.minimums)>1e-8 || (target!==null&&best.score>targetLoss(anchor,target)+1e-8)){
      results.push({label,budget,status:'infeasible',reason:'Search found no build meeting the stat minimums and effectiveness target',minimum_stats:settings.minimums});return;
    }
    const {build,converged,...output}=best;
    const recoilPath=timedRecoil(pack,build,output.tunes,r,timedModules);
    const baseClimb=baselinePath.metrics?.climb_model_units_per_second;
    recoilPath.climb_improvement_percent=recoilPath.status==='modeled'&&baseClimb>0
      ?100*(1-recoilPath.metrics.climb_model_units_per_second/baseClimb):null;
    results.push({...output,loss:best.score,score:100-best.score,label,budget,status:'best_found',improvement_percent:100-best.score,converged:converged??false,mounted:build.mounted,recoil_path:recoilPath,
      category_note:categoryNote,target_effectiveness_percent:target,effectiveness_percent:anchor?(100-anchor.score>1e-8?100*(100-best.score)/(100-anchor.score):100):100});
  };
  for(const [index,budget] of budgets.entries()){
    frontier=[];
    const anchor=search(budget);
    const label=budgets.length===1?'Max':['Min','Balanced','Max'][index];
    if(settings.automatic && budgets.length===1 && (mode==='mp' || !anchor || shortfall(anchor.stats,settings.minimums)>=1e-8)){
      publish(anchor,'Max',budget);
      for(const name of ['Balanced','Min']){
        if(anchor&&shortfall(anchor.stats,settings.minimums)<1e-8)results.push({label:name,budget,status:'unavailable',reason:'Cost is unavailable in Warfare; no distinct price-based alternative can be selected.'});
        else publish(anchor,name,budget);
      }
      continue;
    }
    if(budgets.length===1 && mode!=='mp' && anchor && shortfall(anchor.stats,settings.minimums)<1e-8){
      for(const target of settings.targets){
        const targetScore=targetLoss(anchor,target);
        // Starting at both ends preserves affordable alternatives and permits
        // stripping purchases from the calibrated full-performance build.
        search(budget,anchor,targetScore);
        search(budget,null,targetScore);
      }
      // Every evaluated feasible configuration participates in the final
      // selection, even if another search direction rejected it locally.
      const strongest=frontier.reduce((a,b)=>comparator(settings.minimums)(b,a)?b:a,anchor);
      if(settings.automatic){
        const selected=selectCategories(frontier);
        publish(selected.strongest,'Max',budget);
        for(const [key,name] of [['value','Balanced'],['cheapest','Min']]){
          if(!selected[key]){
            results.push({label:name,budget,status:'unavailable',reason:'No distinct '+name.toLowerCase()+' build found within the budget and 50% improvement floor. Duplicate solutions are not returned.'});
          }else publish(selected[key],name,budget,cheapestGate,selected.strongest);
        }
      }else{
       publish(strongest,label,budget);
       for(const target of settings.targets){
        const targetScore=targetLoss(strongest,target);
        const eligible=frontier.filter(c=>c.score<=targetScore+1e-8);
        const best=eligible.reduce((a,b)=>comparator(settings.minimums,targetScore)(b,a)?b:a,strongest);
        publish(best,target===70?'cheapest':target===90?'mid-range':`${target}% effective`,budget,target,strongest);
       }
      }
    }else publish(anchor,label,budget);
  }
  if(settings.automatic){
    results.sort((a,b)=>['Max','Balanced','Min'].indexOf(a.label)-['Max','Balanced','Min'].indexOf(b.label));
    const seen=new Set();
    for(let i=0;i<results.length;i++)if(results[i].status==='best_found'){
      const row=results[i];
      if(seen.has(row.signature))results[i]={label:row.label,budget:row.budget,status:'unavailable',reason:'No distinct alternative found. Duplicate solutions are not returned.'};
      else seen.add(row.signature);
    }
  }
  return {weapon_id:pack.weaponId,mode,preset:settings.preset,output_standard:settings.automatic?'max_balanced_min':'custom_targets',recoil_context:'ads',selection:!settings.automatic?'custom_targets':settings.preset==='agility'?'weighted':objectives?'lexicographic':'automatic',objective_names:objectiveNames,limitations,cheapest_gate_percent:mode==='mp'?null:cheapestGate,minimum_stats:settings.minimums,effectiveness_definition:settings.preset==='agility'?'Weighted improvement: 50% handling, 30% hip accuracy, 20% ADS recoil':'ADS recoil improvement over default; Handling breaks recoil ties',experimental:true,method:'Coordinate search; no global optimality guarantee',score_model:presets[settings.preset].description,weights,baseline,baseline_stats,baseline_score:0,baseline_loss:100,score_direction:'higher',score_definition:'Percent reduction of primary loss from the default build; default = 0; higher is better',baseline_recoil_path:baselinePath,tier,provenance:input.provenance,results};
}
