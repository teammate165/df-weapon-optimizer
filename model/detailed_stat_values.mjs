import {detailedStats,detailedValue} from '../detailed-stats.mjs?v=5f2833d4b3fd3a0a';

export function createDetailedStatEvaluator(pack,mode,limits,{calculate,kernel}){
  const entries=Object.entries(limits);
  if(!entries.length)return null;
  const includeKick=entries.some(([id])=>id==='randomKick'||id==='springKick');
  return (build,tunes)=>{
    const options={mode,tacticalEffective:true,tunes};
    const current=calculate(pack,{...options,resolvedLoadout:build,preservePrecision:true,trajectoryShotCount:2}).current;
    if(includeKick)addKickDetails(current,pack,build,options,kernel);
    const detailedValues={};
    let detailedViolation=0;
    for(const [id,limit] of entries){
      const value=detailedValue(current,id);
      detailedValues[id]=value;
      const gap=detailedStats[id].direction==='min'?limit-value:value-limit;
      detailedViolation+=Number.isFinite(value)?Math.max(0,gap)/Math.max(1,limit):Infinity;
    }
    return {detailedValues,detailedViolation};
  };
}

export function addKickDetails(current,pack,build,options,kernel){
  const behavior=pack.handling.weaponBehaviorProfiles?.[pack.weapon.references.weaponBehaviorProfileId];
  const state=kernel.u(pack,build,{...options,includeAmmo:false,ammoItemId:null});
  current.recoil.randomKick=state.value('GGunkickRandom',behavior?.kickScales?.randomKickScale||1);
  current.recoil.springKick=state.value('GGunkickSpring',behavior?.kickScales?.springKickScale||1);
}
