import {fastestHorizontalSpeed,horizontalSpeedMultiplier} from './horizontal_speed.mjs?v=e8255213a43243ff';

// Outward-enclosed real arithmetic, including an allowance for native fold
// regrouping. Unknown/nonfinite source inputs decline pruning altogether.
const point=x=>[x,x],hull=(a,b)=>[Math.min(a[0],b[0]),Math.max(a[1],b[1])];
const widen=a=>{if(a.some(x=>!Number.isFinite(x)||Math.abs(x)>1e12))throw Error('Unsafe branch interval');const e=4096*Number.EPSILON*Math.max(1,...a.map(Math.abs));return [a[0]-e,a[1]+e];};
const add=(a,b)=>widen([a[0]+b[0],a[1]+b[1]]);
const mul=(a,b)=>{const v=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return widen([Math.min(...v),Math.max(...v)]);};
const absoluteMin=a=>a[0]<=0&&a[1]>=0?0:Math.min(Math.abs(a[0]),Math.abs(a[1]));
const targets=['GRecoil_H','GRecoil_V','GRecoil_HShake','GRecoil_VShake','GGunkickRandom','GGunkickSpring','GAiming_ADSTime','GSprintToFireTime','GSpread_Hip'];
const main=['2','3','4','5','6'],stat=id=>'WeaponMainAttribute.MainAttrValues.'+id;
const fields=['addend','multA','multC'];
const fireTarget=/(?:FireCD|FireInterval|GRateOfFire|FireDelayTime|FireRateMode|GFiremode|DefaultFireMode|SuppportFireModes|bEnableVariableFireRate)/i;

function curveRange(curve,input,curves){
 const points=[...curve.points??[]].sort((a,b)=>a.inputValue-b.inputValue);
 if(!points.length)throw Error('Missing branch curve');
 const values=[curves.r(curve,input[0]),curves.r(curve,input[1])];
 for(let i=0;i<points.length;i++){
  const p=points[i],q=points[i+1];
  if(p.inputValue>=input[0]&&p.inputValue<=input[1])values.push(p.outputValue);
  if(q&&p.interpolationMode==='RCIM_Cubic'&&q.inputValue>=input[0]&&p.inputValue<=input[1]){
   const width=q.inputValue-p.inputValue;
   if(width<=0)continue;
   // Restrict the Bezier hull to the actual input interval. Keeping the whole
   // segment's hull is safe but far too loose even for fully determined stats.
   const controls=[p.outputValue,p.outputValue+width*p.leaveTangent/3,q.outputValue-width*q.arriveTangent/3,q.outputValue];
   const split=(v,t)=>{const lerp=(a,b)=>a+(b-a)*t,a=lerp(v[0],v[1]),b=lerp(v[1],v[2]),c=lerp(v[2],v[3]),d=lerp(a,b),e=lerp(b,c),f=lerp(d,e);return [[v[0],a,d,f],[f,e,c,v[3]]];};
   const lo=Math.max(0,(input[0]-p.inputValue)/width),hi=Math.min(1,(input[1]-p.inputValue)/width);
   let restricted=lo>=1?[q.outputValue]:split(controls,lo)[1];
   if(lo<1&&hi<1)restricted=split(restricted,(hi-lo)/(1-lo))[0];
   const error=8192*Number.EPSILON*Math.max(1,...controls.map(Math.abs));
   values.push(Math.min(...restricted)-error,Math.max(...restricted)+error);
  }
 }
 if(values.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('Unsupported branch curve');
 return widen([Math.min(...values),Math.max(...values)]);
}

export function createBranchScoreBound({pack,request,compiled,kernel,curves,calculate,preset,maxEntries=2048,maxKeyChars=256*1024}){
 const certificate=preset.branchScoring,c=kernel.u?.screeningStateContract,chart=calculate?.screeningChartContract,plan=preset.solverPlan,mode=request.mode;
 if(c?.version!==1||c.evaluate!==kernel.u||certificate?.raw!==preset.raw||certificate?.score!==preset.score||certificate?.objectives!==preset.objectives||request.firing==='spam'||!['agility','recoil'].includes(plan?.kind))return null;
 if(plan.kind==='recoil'&&plan.chartPattern&&(chart?.calculate!==calculate||chart.version!==1||!['s','r','n','t','d','u'].every(k=>chart.kernel?.[k]===kernel[k])))return null;
 const stats={supported:true,evaluations:0,cache_hits:0,declined:0,entries_peak:0,key_chars_peak:0,saturated:false};
 for(const n of [maxEntries,maxKeyChars])if(!Number.isSafeInteger(n)||n<0)throw Error('Branch cache limits must be nonnegative safe integers');
 const cache=new Map();let chars=0;
 try{
  const opts={mode,tacticalEffective:true,tunes:{},includeAmmo:false,ammoItemId:null},base=c.collect(pack,{mounted:[]},opts),baseNumeric=c.numeric(pack,base.operations),baseRefs=c.references(pack,mode,base.operations,null),baseTargets=c.targets(pack,baseRefs);
  if(base.operations.some(op=>op.scope==='TacticalEffective'))throw Error('Conditional weapon operations');
  const scoreTargets=plan.kind==='recoil'?targets.slice(0,6):targets,wanted=new Set(scoreTargets),items=new Map(),paths=new Map(),profiles=new Set([baseRefs.adsRecoilProfileId]),spreads=new Set([baseRefs.waistSpreadProfileId]);
  const mappings=[];
  const aliasFanout=Math.max(3,...main.map(id=>((pack.attributeRules?.weaponOverrides?.[id]||pack.attributeRules?.defaults?.[id])?.directRuleTargets?.length??0)+3));
  if(aliasFanout>64)throw Error('Excessive numeric alias fanout');
  for(const id of main)for(const map of (pack.attributeRules?.weaponOverrides?.[id]||pack.attributeRules?.defaults?.[id])?.curveMappings??[]){
   if(fireTarget.test(map.target))throw Error('Stat-dependent firing schedule');
   if(scoreTargets.includes(map.target)&&pack.curves?.[map.curveIds?.[mode]]){mappings.push({id,map,curve:pack.curves[map.curveIds[mode]]});wanted.add(stat(id));}
  }
  const featureItems=new Set(),semantics=new Map();
  for(const node of compiled.nodes){
   if(node.active===0)continue;
   let data=items.get(node.item);
   if(!data){
    const operations=c.collect(pack,{mounted:[{itemId:node.item,slotPath:node.path}]},opts).operations.slice(base.operations.length);
    if(operations.length>256)throw Error('Excessive per-part operations');
    const values=operations.filter(op=>op.operation==='StaticAttributeModify'||wanted.has(op.target)).map(op=>Number(op.value)).filter(Number.isFinite);
    if(values.some(v=>Math.abs(v)>1e6))throw Error('Unsafe operation magnitude');
    const foldError=4096*Number.EPSILON*Math.max(1,operations.length*aliasFanout)*Math.max(1,values.reduce((sum,v)=>sum+Math.abs(v)*aliasFanout,0));
    const all=c.numeric(pack,operations).buckets,ordinary=c.numeric(pack,operations.filter(o=>o.scope!=='TacticalEffective')).buckets;
    const buckets=new Map();
    for(const target of wanted){
     const a=all.get(target),b=ordinary.get(target);if(!a&&!b)continue;
     const bucket={};
     for(const field of fields){
      const fallback=field==='multC'?1:0,range=hull(point(a?.[field]??fallback),point(b?.[field]??fallback));
      const error=foldError*Math.max(1,...range.map(Math.abs));bucket[field]=widen([range[0]-error,range[1]+error]);
     }
     bucket.initial=[a?.initial,b?.initial].filter(v=>v!==undefined);
     if(bucket.initial.length||fields.some(field=>bucket[field].some(v=>v!==(field==='multC'?1:0))))buckets.set(target,bucket);
    }
    const identity=JSON.stringify([...buckets]);if(!semantics.has(identity))semantics.set(identity,semantics.size+1);
    data={operations,buckets,semantic:semantics.get(identity)};items.set(node.item,data);
    if(operations.some(o=>fireTarget.test(o.target)))featureItems.add(node.item);
   }
   for(const op of data.operations){
    if(op.sourceTuneId)throw Error('Unexpected tuning in branch bounds');
    if(op.operation==='StaticAttributeReplace'&&op.target==='AimingId.RecoilId')profiles.add(String(op.value));
    if(op.operation==='StaticAttributeReplace'&&op.target==='WaistShootSpreadId')spreads.add(String(op.value));
   }
   if(!paths.has(node.path))paths.set(node.path,[]);paths.get(node.path).push({active:node.active,data});
  }
  for(const [item,o] of Object.entries(pack.combat?.specialFire?.itemOverrides??{}))if(items.has(item)&&(['supportedModes','schedulePolicy','fireScheduleRules','triggerDelayModifierMs'].some(k=>o[k]!==undefined)||o.baseStatModifiers?.fireRate)){
   featureItems.add(item);for(const id of o.requiresItemIds??[])if(items.has(id))featureItems.add(id);
  }
  if(Object.keys(pack.combat?.specialFire?.explicitlyUnmodeled?.items??{}).some(id=>items.has(id)))throw Error('Unmodeled firing state');
  const features=[...featureItems];if(features.length>6)throw Error('Too many firing states');
  if(features.some(id=>new Set(compiled.nodes.filter(n=>n.item===id&&n.active!==0).map(n=>n.path)).size>1))throw Error('Repeated firing-feature occurrences');
  const timelines=[];
  if(plan.kind==='recoil'&&plan.chartPattern)for(let mask=0;mask<2**features.length;mask++){
   const mounted=features.flatMap((itemId,i)=>mask&(1<<i)?[{itemId,slotPath:'branch/'+i}]:[]),state=kernel.u(pack,{mounted},opts);
   const legacy=kernel.s(pack,state.appliedParts).reduce((v,row)=>v*(1+(Number(row.override.baseStatModifiers?.fireRate)||0)),1);
   const rpm=kernel.r({baseFireIntervalSeconds:pack.weapon.fireControl.fireIntervalSeconds,value:state.value,legacyFireRateMultiplier:legacy});
   const fc=kernel.n(pack,state.appliedParts,rpm/(60/pack.weapon.fireControl.fireIntervalSeconds),null,kernel.t(pack,state.value));
   if(fc.selectedFireMode!=='Auto'||['unmodeled','modeOnly'].includes(fc.scheduleStatus)||!(rpm>0))throw Error('Unsupported branch firing protocol');
   const times=[0];for(let shot=2;shot<=20;shot++){const delta=curves.u({...fc,fireRate:rpm},shot);if(!(Number.isFinite(delta)&&delta>0))throw Error('Invalid branch timeline');times.push(times.at(-1)+delta);}
   if(times.at(-1)<200)throw Error('Short branch timeline');timelines.push(times);
  }
  const geometry=[];
  if(plan.kind==='recoil'&&plan.chartPattern)for(const id of profiles){
   const profile=pack.handling.recoilProfiles[id];if(!profile)throw Error('Missing branch recoil profile');
   const p=chart.trajectory(profile,1,1,false,20,true);if(p.length!==20||p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))throw Error('Invalid branch chart');
   const xs=p.map(v=>v.x),ys=p.map(v=>v.y),sum=p.reduce((v,row,i)=>v+Math.abs(row.x-(p[i-1]?.x??0))+Math.abs(row.y-(p[i-1]?.y??0)),0);
   const speeds=timelines.map(times=>fastestHorizontalSpeed(p.map((row,i)=>({...row,time_ms:times[i]}))).speed);
   geometry.push({id,h:Math.max(...xs.map(Math.abs)),v:Math.max(...ys)-Math.min(...ys),speeds,error:8192*Number.EPSILON*Math.max(1,sum)});
  }
  const groups=[...paths.values()].filter(rows=>rows.some(row=>row.data.buckets.size));
  const bucketPlans=new Map([...wanted].map(target=>[target,groups.map(rows=>rows.filter(row=>row.data.buckets.has(target))).filter(rows=>rows.length)]));
  const refRows=compiled.nodes.filter(n=>n.active!==0).flatMap(n=>items.get(n.item).operations.filter(op=>op.operation==='StaticAttributeReplace'&&['AimingId.RecoilId','WaistShootSpreadId'].includes(op.target)).map(op=>({active:n.active,target:op.target,id:String(op.value)})));
  const featureRows=features.map(id=>compiled.nodes.filter(n=>n.item===id&&n.active!==0).map(n=>n.active));
  const relevant=[...new Set([...groups.flatMap(rows=>rows.map(row=>row.active)),...featureRows.flat(),...refRows.map(r=>r.active)])],indices=new Map(relevant.map((v,i)=>[v,i]));
  // Only these bucket targets can affect the opted-in preset's score.
  return {getStats:()=>({...stats}),lower({interval}){
   stats.evaluations++;
   try{
    const bounds=relevant.map(interval),codes=[];
    for(const rows of groups){let code='';
     const active=rows.filter(row=>bounds[indices.get(row.active)][1]),required=active.find(row=>bounds[indices.get(row.active)][0]);
     if(required){if(required.data.buckets.size)code='!'+required.data.semantic;}
     else{const ids=[...new Set(active.filter(row=>row.data.buckets.size).map(row=>row.data.semantic))].sort((a,b)=>a-b);if(ids.length)code='?'+ids.join(',');}
     codes.push(code);
    }
    const refCode=['AimingId.RecoilId','WaistShootSpreadId'].map(target=>{
     const active=refRows.filter(row=>row.target===target&&bounds[indices.get(row.active)][1]);
     return [active.some(row=>bounds[indices.get(row.active)][0]),[...new Set(active.map(row=>row.id))].sort()];
    });
    const featureCode=featureRows.map(rows=>{const b=rows.map(interval);return [b.some(a=>a[0]),b.some(a=>a[1])];});
    const key=JSON.stringify([codes.filter(Boolean).sort(),refCode,featureCode]);
    if(cache.has(key)){stats.cache_hits++;return cache.get(key);}
    const spreadRefs=refRows.filter(row=>row.target==='WaistShootSpreadId'&&bounds[indices.get(row.active)][1]),requiredSpread=spreadRefs.some(row=>bounds[indices.get(row.active)][0]);
    const spreadIds=[...(requiredSpread?[]:[baseRefs.waistSpreadProfileId]),...spreadRefs.map(row=>row.id)];
    const fallback=target=>target==='GSpread_Hip'?widen([Math.min(...spreadIds.map(id=>pack.handling.spreadProfiles[id]?.baseSpreadDegrees?.horizontal)),Math.max(...spreadIds.map(id=>pack.handling.spreadProfiles[id]?.baseSpreadDegrees?.horizontal))]):point(baseTargets[target]??0);
    const numeric=new Map();
    for(const target of wanted){
     const original=baseNumeric.buckets.get(target),bucket={addend:point(original?.addend??0),multA:point(original?.multA??0),multC:point(original?.multC??1),initial:point(original?.initial??(target.startsWith('WeaponMainAttribute.')?pack.weapon.attributes.mainAttrValues[target.split('.').at(-1)]:0)),hasInitial:original?.initial!==undefined};
     for(const rows of bucketPlans.get(target)){
      const optional={addend:point(0),multA:point(0),multC:point(1)},required=[];
      for(const row of rows){
       const [lo,hi]=bounds[indices.get(row.active)],part=row.data.buckets.get(target);if(!hi||!part)continue;
       if(lo)required.push(part);
       for(const field of fields)optional[field]=hull(optional[field],part[field]);
       for(const value of part.initial){bucket.initial=hull(bucket.initial,point(value));bucket.hasInitial=true;}
      }
      if(required.length>1)throw Error('Inconsistent branch occupancy');
      const contribution=required[0]??optional;
      bucket.addend=add(bucket.addend,contribution.addend);bucket.multA=add(bucket.multA,contribution.multA);bucket.multC=mul(bucket.multC,contribution.multC);
     }
     numeric.set(target,bucket);
    }
    const value=(target,baseValue=fallback(target))=>{
     const b=numeric.get(target);return mul(mul(add(b.hasInitial?hull(b.initial,baseValue):baseValue,b.addend),add(point(1),b.multA)),b.multC);
    };
    const mains=Object.fromEntries([...new Set(mappings.map(m=>m.id))].map(id=>[id,value(stat(id),point(pack.weapon.attributes.mainAttrValues[id]))]));
    for(const {id,map,curve} of mappings){
     let input=mains[id];
     if(map.mappingType.startsWith('Delta')){
      const neutral=map.mappingType==='DeltaMapping'?0:1,reference=pack.weapon.attributes.independentCurve?0:[...curve.points??[]].filter(p=>Math.abs(p.outputValue-neutral)<1e-9).sort((a,b)=>Math.abs(a.inputValue)-Math.abs(b.inputValue))[0]?.inputValue||0;
      input=add(input,point(reference-pack.weapon.attributes.mainAttrValues[id]));
     }
     let range=curveRange(curve,input,curves);const b=numeric.get(map.target);
     if(map.mappingType==='DeltaMappingThenScale')b.multC=mul(b.multC,range);
     else if(map.mappingType==='DeltaMapping')b.addend=add(b.addend,range);
     else if(map.mappingType==='AbsoluteMapping'){b.initial=range;b.hasInitial=true;}
     else if(map.mappingType==='AbsoluteMappingThenScale'){
      const denominator=curves.r(curve,pack.weapon.attributes.mainAttrValues[id]);range=mul(range,denominator?mul(fallback(map.target),point(1/denominator)):point(1));b.initial=range;b.hasInitial=true;
     }else throw Error('Unknown branch mapping');
    }
    const values=Object.fromEntries(scoreTargets.map(t=>[t,value(t)])),h=absoluteMin(values.GRecoil_H),v=absoluteMin(values.GRecoil_V);
    const camera=Math.hypot(absoluteMin(values.GRecoil_HShake),absoluteMin(values.GRecoil_VShake)),kick=Math.hypot(absoluteMin(values.GGunkickRandom),absoluteMin(values.GGunkickSpring));
    let pattern=Math.hypot(h,v);
    if(geometry.length){
     const allowed=timelines.map((_,mask)=>featureRows.every((rows,i)=>{const b=rows.map(interval),lo=b.some(a=>a[0])?1:0,hi=b.some(a=>a[1])?1:0;return mask&(1<<i)?hi:!lo;}));
     const refs=refRows.filter(row=>row.target==='AimingId.RecoilId'&&bounds[indices.get(row.active)][1]),required=refs.some(row=>bounds[indices.get(row.active)][0]),ids=new Set([...(required?[]:[baseRefs.adsRecoilProfileId]),...refs.map(row=>row.id)]);
     pattern=Math.min(...geometry.filter(g=>ids.has(g.id)).map(g=>{
      const error=1e-5+g.error*Math.max(1,...values.GRecoil_H.map(Math.abs),...values.GRecoil_V.map(Math.abs));
      const speed=Math.max(0,Math.min(...g.speeds.filter((_,i)=>allowed[i]))*h-10*error);
      return Math.max(0,g.v*v-2*error)+horizontalSpeedMultiplier(speed)*Math.max(0,g.h*h-error);
     }));
    }
    const recoilPlan=plan.kind==='agility'?plan.recoil:plan;
    const recoil=100*Object.entries(recoilPlan.weights).reduce((sum,[k,w])=>sum+(w===0?0:w*({pattern,camera,kick})[k]/recoilPlan.baseline[k]),0)/Object.values(recoilPlan.weights).reduce((a,b)=>a+b,0);
    let lower=plan.kind==='agility'?preset.score({recoil,accuracy:values.GSpread_Hip[0],ads_seconds:values.GAiming_ADSTime[0],sprint_to_fire_seconds:values.GSprintToFireTime[0]}):recoil;
    if(!Number.isFinite(lower))throw Error('Nonfinite branch score');lower-=1e-7*Math.max(1,Math.abs(lower));
    if(cache.size<maxEntries&&chars+key.length<=maxKeyChars){cache.set(key,lower);chars+=key.length;stats.entries_peak=Math.max(stats.entries_peak,cache.size);stats.key_chars_peak=Math.max(stats.key_chars_peak,chars);}else stats.saturated=true;
    return lower;
   }catch{stats.declined++;return null;}
  }};
 }catch{return null;}
}
