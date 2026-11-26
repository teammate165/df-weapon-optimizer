import {generate} from './optimizer_engine.mjs?v=67f0054380987872';
import {statResponse} from './builder_stat_response.mjs?v=67f0054380987872';
import {statIds} from './optimizer_policy.mjs?v=67f0054380987872';
import {presets} from './optimizer_presets.mjs?v=67f0054380987872';

function plotConvertedRecoil(pack, stats, chart, value) {
  const {base, current} = stats;
  const stockModes = base.weaponStats.supportedFireModes;
  if (!chart || stockModes.length !== 1 || stockModes[0] !== 'Single' ||
      !current.weaponStats.supportedFireModes.includes('Auto')) return;
  const {recoil, references} = current;
  for (const [key, profileId] of [
    ['trajectory', references.waistRecoilProfileId],
    ['adsTrajectory', references.adsRecoilProfileId],
  ]) {
    const profile = pack.handling.recoilProfiles[profileId];
    if (!profile) continue;
    const {continuousFire, singleShot, loop} = profile;
    const hasOpening = continuousFire?.horizontalValues?.length || continuousFire?.verticalValues?.length;
    const useSingleOpening = !hasOpening &&
      Math.max(singleShot?.horizontalValues?.length ?? 0, singleShot?.verticalValues?.length ?? 0) > 1;
    const horizontalLoop = loop?.horizontalValues?.length ?? 0;
    const verticalLoop = loop?.verticalValues?.length ?? 0;
    const splitLoop = horizontalLoop && verticalLoop && horizontalLoop !== verticalLoop;
    if (!useSingleOpening && !splitLoop) continue;

    const count = recoil[key].length;
    const horizontal = value('GRecoil_H', 1);
    const vertical = value('GRecoil_V', 1);
    const points = chart.trajectory(profile, horizontal, vertical, useSingleOpening, count);
    if (splitLoop) {
      // The native chart uses the vertical loop length for both axes.
      const horizontalProfile = {...profile, loop: {...loop, verticalValues: []}};
      const horizontalPoints = chart.trajectory(horizontalProfile, horizontal, vertical, useSingleOpening, count);
      for (const [index, point] of points.entries()) point.x = horizontalPoints[index].x;
    }
    recoil[key] = points;
  }
}

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
  const {numeric,value}=kernel.u(pack,build,{tacticalEffective:true,mode:r.mode,tunes});
  plotConvertedRecoil(pack, stats, calculate.screeningChartContract, value);
  const effective_stats=Object.fromEntries(Object.entries(statIds).map(([key,id])=>[key,numeric.mainAttr[id]]));
  let optimization;
  if(r.preset!==undefined||r.weights!==undefined||r.objective_weights!==undefined){
    const preset=r.preset??'recoil';
    if(!Object.hasOwn(presets,preset))throw Error('Unknown optimizer preset');
    const scorer=presets[preset].create({pack,request:r,...modules,mode:r.mode,resolve:config=>curves.o(pack,config,r.mode)});
    const components=scorer.raw(build,tunes),loss=scorer.score(components);
    optimization={preset,weights:scorer.weights,components,loss,score:100-loss};
  }
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
  return {build,stats,effective_stats,controls,tunes,comparisons,response_curve,optimization,display:pack.display.objects,cost:r.mode==='mp'||missing.length?null:total,missing,tier:shop.weapons[pack.weaponId],provenance:input.provenance};
}
