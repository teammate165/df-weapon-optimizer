import {generate} from './optimizer_engine.mjs?v=e8255213a43243ff';
import {statResponse} from './builder_stat_response.mjs?v=e8255213a43243ff';
import {statIds} from './optimizer_policy.mjs?v=e8255213a43243ff';

export async function executeModel(input,modules) {
  if(input.action==='optimize')return generate(input,modules);
  if(input.action!=='evaluate')throw Error('Unknown action');
  const {curves,kernel,calculate}=modules;
  const {pack,request:r,shop,prices}=input;
  const build=curves.o(pack,r.config??[],r.mode);
  const tunes={};
  const controls=[];
  for(const mounted of build.mounted) for(const id of pack.parts[mounted.itemId]?.tuneIds??[]) {
    const control=curves.c(pack,mounted,id);
    if(!control||control.enabled===false) continue;
    const values=curves.n(control);
    const requested=r.tunes?.[mounted.slotPath]?.[id]??control.range.defaultValue;
    const value=Number.isFinite(requested)?values.find(v=>Math.abs(v-requested)<1e-6):undefined;
    if(value===undefined) throw Error('Invalid calibration position');
    (tunes[mounted.slotPath]??={})[id]=value;
    controls.push({slotPath:mounted.slotPath,itemId:mounted.itemId,id,control,values,value});
  }
  const stats=calculate(pack,{tacticalEffective:true,mode:r.mode,resolvedLoadout:build,tunes,preservePrecision:true,trajectoryShotCount:r.shot_count??20});
  const numeric=kernel.u(pack,build,{tacticalEffective:true,mode:r.mode,tunes}).numeric;
  const effective_stats=Object.fromEntries(Object.entries(statIds).map(([key,id])=>[key,numeric.mainAttr[id]]));
  let response_curve;
  if(r.response_stat!==undefined){
      response_curve=statResponse(pack,build,tunes,r.mode,r.response_stat,calculate,kernel);
  }
  let comparisons;
  if(r.compare_slot!==undefined) {
    const slot=build.slots.find(s=>s.slotPath===r.compare_slot);
    if(!slot)throw Error('Unknown comparison socket');
    const compact=current=>Object.fromEntries(['panel','recoil','handling','stability','waist','weaponStats'].map(key=>[key,Object.fromEntries(Object.entries(current[key]??{}).filter(([,v])=>typeof v==='number'))]));
    comparisons=[];
    for(const itemId of ['',...slot.options]) {
      if(r.mode==='bd'&&shop.hiddenItemIds.includes(itemId))continue;
      const config=build.config.filter(c=>c.slotPath!==slot.slotPath&&!c.slotPath.startsWith(slot.slotPath+'/'));
      if(itemId)config.push({slotPath:slot.slotPath,itemId});
      const candidate=curves.o(pack,config,r.mode);
      if(itemId&&!candidate.mounted.some(m=>m.slotPath===slot.slotPath&&m.itemId===itemId)) {
        comparisons.push({itemId,available:false,reason:'Cannot mount with current parent/coupled selections'});continue;
      }
      const candidateTunes=Object.fromEntries(Object.entries(tunes).filter(([path])=>path!==slot.slotPath&&!path.startsWith(slot.slotPath+'/')));
      // Retain the exact tuning for the currently equipped option. Replacements
      // and their dependent sockets start from source defaults, as in the UI.
      const equipped=build.mounted.find(m=>m.slotPath===slot.slotPath&&m.source==='equipped');
      if((equipped?.itemId??'')===itemId) {
        comparisons.push({itemId,available:true,stats:compact(stats.current)});continue;
      }
      try {
        const current=calculate(pack,{tacticalEffective:true,mode:r.mode,resolvedLoadout:candidate,tunes:candidateTunes,preservePrecision:true,trajectoryShotCount:2}).current;
        comparisons.push({itemId,available:true,stats:compact(current)});
      }catch(error){comparisons.push({itemId,available:false,reason:error.message});}
    }
  }
  if(comparisons)for(const row of comparisons){
    const operations=kernel.c(pack,row.itemId,r.mode).filter(op=>op.scope==='TacticalEffective');
    if(operations.length)row.tactical={operations,included:kernel.l(pack,row.itemId,r.mode),stacking:'strongest_per_stat'};
  }
  const costs=r.mode==='bd'?shop.partCosts:prices;
  let total=0;const missing=[];
  for(const m of build.mounted.filter(m=>m.source==='equipped')) {
    if(!Number.isFinite(costs[m.itemId])) missing.push(m.itemId);else total+=costs[m.itemId];
  }
  return {build,stats,effective_stats,controls,tunes,comparisons,response_curve,display:pack.display.objects,cost:r.mode==='mp'||missing.length?null:total,missing,tier:shop.weapons[pack.weaponId],provenance:input.provenance};
}
