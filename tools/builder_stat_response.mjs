// Same effective-main-attribute intervention as build_stat_curves.mjs, now
// holding the user's actual resolved equipment and calibration fixed.
const definitions={
 '3':[
  ['vertical','Vertical recoil','×','lower','raw','aimContinueVerticalRecoilScale'],['horizontal','Horizontal recoil','×','lower','raw','aimContinueHorizontalRecoilScale'],
  ['single_vertical','Single/burst vertical recoil','×','lower','raw','aimSingleVerticalRecoilScale'],['single_horizontal','Single/burst horizontal recoil','×','lower','raw','aimSingleHorizontalRecoilScale'],
  ['random_kick','Random weapon kick','×','lower','raw','randomKickIntensity'],['spring_kick','Spring weapon kick','×','lower','raw','springKickIntensity']],
 '5':[['ads','ADS time','ms','lower','handling','adsTimeMs'],['sprint_to_fire','Sprint to fire','ms','lower','handling','sprintToFireMs'],['ads_move','ADS movement speed','m/s','higher','handling','adsMoveSpeed']],
 '6':[['camera','Firing camera shake','×','lower','stability','fireCameraStability'],['breath','Breath sway','°','lower','stability','breathRangeDeg'],['hold','Hold-breath duration','s','higher','stability','holdBreathSeconds'],['held_recoil','Held recoil','×','lower','stability','holdBreathRecoilScale'],['hit','Hit sway','×','lower','stability','beHitScale'],['movement','Movement sway','×','lower','stability','moveStability']],
 '4':[['hip','Standing hip spread','°','lower','waist','hipSpreadDeg'],['maximum','Maximum hip spread','°','lower','waist','maxSpreadDeg'],['moving','Moving hip spread','°','lower','waist','legend','moving']],
};
export function statResponse(pack,build,tunes,mode,attribute,calculate,kernel){
 const metrics=definitions[attribute];if(!metrics)throw Error('Unknown response stat');
 const reference=kernel.u(pack,build,{mode,tunes}),current=reference.numeric.mainAttr[attribute];
 const bucket=reference.numeric.buckets.get(`WeaponMainAttribute.MainAttrValues.${attribute}`);
 const scale=bucket?(1+bucket.multA)*bucket.multC:1;
 if(!Number.isFinite(current)||!Number.isFinite(scale)||scale===0)throw Error('Cannot isolate this main attribute');
 const min=Math.min(0,Math.floor(current-5)),max=Math.max(150,Math.ceil(current+20));
 const xs=[...new Set([...Array.from({length:max-min+1},(_,i)=>min+i),current,current-5,current+5,current+10])].sort((a,b)=>a-b);
 const series=metrics.map(([key,label,unit,better])=>({key,label,unit,better,values:[]}));
 const effects=pack.effectsByItemId?.[pack.weaponId]?.[mode]??[];
 for(const x of xs){
  const probe={...pack,effectsByItemId:{...pack.effectsByItemId,[pack.weaponId]:{...pack.effectsByItemId[pack.weaponId],[mode]:[...effects,{operation:'StaticAttributeModify',target:`WeaponMainAttribute.MainAttrValues.${attribute}`,modifier:'Addend',value:(x-current)/scale,scope:'NONE'}]}}};
  const numeric=kernel.u(probe,build,{mode,tunes}).numeric;
  if(Math.abs(numeric.mainAttr[attribute]-x)>1e-7)throw Error('Main-attribute probe did not reach its requested value');
  for(const id of ['3','4','5','6'])if(id!==attribute&&numeric.mainAttr[id]!==reference.numeric.mainAttr[id])throw Error('Probe changed another main stat');
  const output=calculate(probe,{mode,resolvedLoadout:build,tunes,preservePrecision:true,trajectoryShotCount:2}).current;
  for(let i=0;i<metrics.length;i++){
   const value=metrics[i].slice(4).reduce((o,k)=>o?.[k],output);
   if(!Number.isFinite(value))throw Error('Unavailable curve metric: '+metrics[i][0]);
   series[i].values.push(value);
  }
 }
 if(attribute==='3')for(const axis of ['vertical','horizontal']){
  const a=series.find(s=>s.key===axis),b=series.find(s=>s.key==='single_'+axis);
  if(a.values.every((v,i)=>Math.abs(v-b.values[i])<1e-7))series.splice(series.indexOf(b),1);
  else a.label='Automatic '+axis+' recoil';
 }
 return{attribute_id:attribute,weapon_id:pack.weaponId,mode,current_main:current,displayed_current:reference.numeric.displayAttr[attribute],xs,series,method:'One effective main stat varied; equipped parts, tuning and other main stats fixed',domain_note:'Exploratory point range; not an engine cap or a claim every value is attainable'};
}
