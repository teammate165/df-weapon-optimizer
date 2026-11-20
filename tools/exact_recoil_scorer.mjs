import {boundedCache,exactKey,packedNumberKey} from './exact_dag_storage.mjs';
import {fastestHorizontalSpeed,horizontalSpeedMultiplier} from './horizontal_speed.mjs';

const objectiveReads=['GRecoil_H','GRecoil_V','GRecoil_HShake','GRecoil_VShake','GGunkickRandom','GGunkickSpring','GAiming_ADSTime','GSprintToFireTime'];
export function createExactRecoilScorer({pack,request,modules,preset,cacheBytes=8*1024*1024,onInputMiss}){
 const {kernel,curves,calculate}=modules,c=kernel.u.screeningStateContract,chart=calculate.screeningChartContract,mode=request.mode;
 if(!c||c.version!==1||chart?.version!==1||chart.calculate!==calculate||chart.kernel.r!==kernel.r||chart.kernel.t!==kernel.t||chart.kernel.n!==kernel.n||chart.kernel.u!==kernel.u||!preset.solverPlan.chartPattern||request.firing==='spam')throw Error('Pinned native scoring contract unavailable');
 if(Object.keys(pack.combat?.specialFire?.itemOverrides??{}).length||Object.keys(pack.combat?.specialFire?.explicitlyUnmodeled?.items??{}).length)throw Error('Part-sensitive fire protocols require native fallback');
 // The pinned rate/SDK helpers read literal targets through their value
 // callback. Reject a changed/dynamic callback protocol instead of guessing.
 function literalReads(fn,callback){const source=fn.toString(),calls=[...source.matchAll(new RegExp('\\b'+callback+'\\(([^)]*)','g'))];if(!calls.length||calls.some(m=>!/^`[^`]+`/.test(m[1])))throw Error('Uncertified dynamic native read');return calls.map(m=>m[1].match(/^`([^`]+)`/)[1]);}
 const rateSource=kernel.r.toString(),sdkSource=kernel.t.toString(),rateCallback=rateSource.match(/value:([A-Za-z_$][\w$]*)/)?.[1],sdkCallback=sdkSource.match(/^function\s*\w*\([^,]+,([A-Za-z_$][\w$]*)\)/)?.[1];
 if(!rateCallback||!sdkCallback)throw Error('Uncertified native timing signature');
 const live=new Set([...objectiveReads,...literalReads(kernel.r,rateCallback),...literalReads(kernel.t,sdkCallback)]),mappingTargets=new Set();
 for(const id of ['2','3','4','5','6'])for(const map of (pack.attributeRules.weaponOverrides?.[id]??pack.attributeRules.defaults[id])?.curveMappings??[])if(pack.curves[map.curveIds?.[mode]]){mappingTargets.add(map.target);if(live.has(map.target))live.add('WeaponMainAttribute.MainAttrValues.'+id);}
 const liveTargets=[...live].sort(),geometry=boundedCache(cacheBytes),timing=boundedCache(cacheBytes/4),patterns=boundedCache(cacheBytes),inputs=boundedCache(cacheBytes*3),references=boundedCache(cacheBytes/8),empty=new Map();
 const stats={requests:0,objective_evaluations:0,native_witnesses:0,raw_finalizations:0,geometry_evaluations:0,timing_evaluations:0,pattern_evaluations:0};
 function prepare(buckets,refs){
  const refKey=exactKey(refs);let base=references.get(refKey);if(!base){base=c.targets(pack,refs);references.set(refKey,base);}
  const clone=new Map(buckets);for(const target of mappingTargets)if(clone.has(target))clone.set(target,{...clone.get(target)});
  const numeric=c.numeric(pack,[],clone);c.mapped(pack,mode,numeric,base);stats.raw_finalizations++;
  return {references:refs,numeric,value:(target,fallback=base[target]||0)=>c.value(empty,target,c.value(numeric.buckets,target,fallback))};
 }
 function scoreMapped(state,nativeWitness){
  stats.requests++;const refs=state.references,h=pack.handling;
  if(!pack.combat.bulletProfiles[refs.bulletProfileId]||!h.movementProfiles[refs.movementProfileId]||!h.aimingProfiles[refs.aimingProfileId]||!h.spreadProfiles[refs.waistSpreadProfileId]||!h.recoilProfiles[refs.waistRecoilProfileId]||!h.spreadProfiles[refs.adsSpreadProfileId]||!h.recoilProfiles[refs.adsRecoilProfileId])throw Error('Missing native profile');
  const behavior=h.weaponBehaviorProfiles?.[pack.weapon.references.weaponBehaviorProfileId],aiming=h.aimingProfiles[refs.aimingProfileId],values=[state.value('GRecoil_H',1),state.value('GRecoil_V',1),state.value('GRecoil_HShake',1),state.value('GRecoil_VShake',1),state.value('GGunkickRandom',behavior?.kickScales?.randomKickScale??1),state.value('GGunkickSpring',behavior?.kickScales?.springKickScale??1),state.value('GAiming_ADSTime',aiming.adsOnTimeSeconds),state.value('GSprintToFireTime',pack.weapon.timings.sprintToFireSeconds)],timingReads=[],read=(target,fallback)=>{const value=state.value(target,fallback);timingReads.push(value);return value;},rpm=kernel.r({baseFireIntervalSeconds:pack.weapon.fireControl.fireIntervalSeconds,value:read,legacyFireRateMultiplier:1}),sdk=kernel.t(pack,read);
  function verify(entry){if(nativeWitness&&!entry.verified){const expected=nativeWitness();if(expected.score!==entry.row.score||expected.objectives.some((v,i)=>v!==entry.row.objectives[i]))throw Error('Exact fast/native objective mismatch');entry.verified=true;stats.native_witnesses++;}return entry.row;}
  const compactKey=String(refs.adsRecoilProfileId).length+':'+refs.adsRecoilProfileId+packedNumberKey([values.length,...values,...timingReads]);
  const cached=inputs.get(compactKey);if(cached)return verify(cached);onInputMiss?.(compactKey);
  const fc=kernel.n(pack,[],rpm/(60/pack.weapon.fireControl.fireIntervalSeconds),null,sdk);
  if(!(rpm>0)||fc.selectedFireMode!=='Auto'||['unmodeled','modeOnly'].includes(fc.scheduleStatus)||fc.fireScheduleRules.some(r=>!['firstShotsRpm','intervalScaleSequence','repeatedBurst'].includes(r.mode)))throw Error('Unsupported source firing timeline');
  const timeline={...fc,fireRate:rpm},horizontal=values[0],vertical=values[1],gkey=exactKey([refs.adsRecoilProfileId,horizontal,vertical,false,20]),tkey=exactKey(timeline);
  let points=geometry.get(gkey);if(!points){points=chart.trajectory(h.recoilProfiles[refs.adsRecoilProfileId],horizontal,vertical,false,20);if(points.length!==20)throw Error('Missing native chart points');geometry.set(gkey,points,gkey.length*2+20*32);stats.geometry_evaluations++;}
  let times=timing.get(tkey);if(!times){times=[0];for(let i=1;i<20;i++){const step=curves.u(timeline,i+1);if(!(Number.isFinite(step)&&step>0))throw Error('Invalid source interval');times.push(times.at(-1)+step);}timing.set(tkey,times);stats.timing_evaluations++;}
  const pkey=gkey+'|'+tkey;let pattern=patterns.get(pkey);
  if(pattern===undefined){const path=points.map((p,i)=>({...p,time_ms:times[i]})),horizontalDistance=Math.max(...points.map(p=>Math.abs(p.x))),ys=points.map(p=>p.y),verticalExcursion=Math.max(...ys)-Math.min(...ys),speed=fastestHorizontalSpeed(path).speed;pattern=verticalExcursion+horizontalSpeedMultiplier(speed)*horizontalDistance;patterns.set(pkey,pattern);stats.pattern_evaluations++;}
  const components={pattern,camera:Math.hypot(values[2],values[3]),kick:Math.hypot(values[4],values[5]),ads_seconds:values[6],sprint_to_fire_seconds:values[7]},score=preset.score(components),vector=preset.objectives(components);if(!Number.isFinite(score)||!vector.every(Number.isFinite))throw Error('Nonfinite native objective');const row={score,objectives:vector};stats.objective_evaluations++;
  const entry={row,verified:false};verify(entry);inputs.set(compactKey,entry,compactKey.length*2+128);return row;
 }
 return {liveTargets,prepare,scoreMapped,scoreRaw:(buckets,refs,witness)=>scoreMapped(prepare(buckets,refs),witness),stats:()=>({...stats,caches:{input:inputs.stats(),geometry:geometry.stats(),timing:timing.stats(),pattern:patterns.stats(),objective:{disabled:true,hits:0,misses:0,evictions:0,bytes:0,max_bytes:0},references:references.stats()}}),certificate:{kind:'pinned-default-recoil-live-dependency-closure-v1',targets:liveTargets,scope:'immutable M4A1/Detonation empty tuning, no ammo/floors/part fire overrides',source_chart_rounding:'native five-decimal trajectory function'}};
}
