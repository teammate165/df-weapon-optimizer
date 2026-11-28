import {fastestHorizontalSpeed,horizontalSpeedMultiplier} from './horizontal_speed.mjs?v=a1539a63dcdc8bbb';
import {shortfall} from './optimizer_policy.mjs?v=a1539a63dcdc8bbb';

// A conservative cutoff test. Equal/near-equal primary scores always receive
// full scoring so Handling, cost and deterministic signature ties are preserved.
export function boundCannotBeat(primaryLower,stats,worst,minimums={}){
 if(!worst||!Number.isFinite(primaryLower))return false;
 const delta=shortfall(stats,minimums)-shortfall(worst.stats,minimums);
 if(delta>1e-8)return true;if(delta< -1e-8)return false;
 const primary=worst.objectives?.[0]??worst.score;
 return primaryLower>primary+1e-9*Math.max(1,Math.abs(primaryLower),Math.abs(primary));
}

// Typed encoding distinguishes null/undefined, signed zero and nested values.
// Unsupported/nonfinite timeline inputs simply disable group reuse.
function signature(value){
 if(value===null)return 'n';if(value===undefined)return 'u';
 if(typeof value==='number')return Number.isFinite(value)?'d'+(Object.is(value,-0)?'-0':String(value)):null;
 if(typeof value==='string')return 's'+JSON.stringify(value);if(typeof value==='boolean')return value?'b1':'b0';
 if(Array.isArray(value)){const parts=value.map(signature);return parts.some(p=>p===null)?null:'a['+parts.join(',')+']';}
 if(typeof value==='object'&&[null,Object.prototype].includes(Object.getPrototypeOf(value))){
  const parts=[];for(const key of Object.keys(value).sort()){const encoded=signature(value[key]);if(encoded===null)return null;parts.push(JSON.stringify(key)+':'+encoded);}return 'o{'+parts.join(',')+'}';
 }
 return null;
}

export function createRecoilScreeningBound({pack,request,kernel,curves,calculate,raw,score,objectives,chartPattern,maxGroupEntries=2048,maxGroupKeyChars=256*1024}){
 const contract=calculate?.screeningChartContract;
 if(!chartPattern||request.firing==='spam'||contract?.version!==1||contract.calculate!==calculate||typeof contract.trajectory!=='function'||!['s','r','n','t','d','u'].every(k=>contract.kernel?.[k]===kernel[k])||typeof curves?.u!=='function')return undefined;
 for(const limit of [maxGroupEntries,maxGroupKeyChars])if(!Number.isSafeInteger(limit)||limit<0)throw Error('Bound group cache limits must be nonnegative safe integers.');
 const groups=new Map();let chars=0,stats;
 const begin=()=>{groups.clear();chars=0;stats={groups_evaluated:0,group_cache_hits:0,group_entries_peak:0,group_key_chars_peak:0,group_cache_saturated:false};};begin();
 const remember=(key,lower)=>{
  if(key===null)return;
  if(!maxGroupEntries||key.length>maxGroupKeyChars){stats.group_cache_saturated=true;return;}
  while(groups.size>=maxGroupEntries||chars+key.length>maxGroupKeyChars){const old=groups.keys().next().value;chars-=old.length;groups.delete(old);stats.group_cache_saturated=true;}
  groups.set(key,lower);chars+=key.length;stats.group_entries_peak=Math.max(stats.group_entries_peak,groups.size);stats.group_key_chars_peak=Math.max(stats.group_key_chars_peak,chars);
 };
 return {kind:'native_source_signature_group_bound_v1',raw,score,objectives,begin,getStats:()=>({...stats}),lower(build,state){
  const refs=state.references,h=pack.handling;
  // Preserve the full calculator's missing-configuration/protocol errors: an
  // unsupported candidate falls back to its ordinary exact scoring path.
  if(!pack.combat?.bulletProfiles?.[refs.bulletProfileId]||!h.movementProfiles?.[refs.movementProfileId]||!h.aimingProfiles?.[refs.aimingProfileId]||!h.spreadProfiles?.[refs.waistSpreadProfileId]||!h.recoilProfiles?.[refs.waistRecoilProfileId]||!h.spreadProfiles?.[refs.adsSpreadProfileId])return null;
  const profile=h.recoilProfiles?.[refs.adsRecoilProfileId];if(!profile)return null;
  const overrides=kernel.s(pack,state.appliedParts),legacy=overrides.reduce((value,row)=>value*(1+(Number(row.override.baseStatModifiers?.fireRate)||0)),1);
  const rpm=kernel.r({baseFireIntervalSeconds:pack.weapon.fireControl.fireIntervalSeconds,value:state.value,legacyFireRateMultiplier:legacy});
  if(!(Number.isFinite(rpm)&&rpm>0))return null;
  const fc=kernel.n(pack,state.appliedParts,rpm/(60/pack.weapon.fireControl.fireIntervalSeconds),null,kernel.t(pack,state.value));
  if(['unmodeled','modeOnly'].includes(fc.scheduleStatus)||fc.selectedFireMode!=='Auto'||fc.supportedModes?.length===1&&fc.supportedModes[0]==='Single'||fc.fireScheduleRules?.some(rule=>!['firstShotsRpm','intervalScaleSequence','repeatedBurst'].includes(rule.mode)))return null;
  const horizontal=state.value('GRecoil_H',1),vertical=state.value('GRecoil_V',1),timeline={...fc,fireRate:rpm},points=[],behavior=h.weaponBehaviorProfiles?.[pack.weapon.references.weaponBehaviorProfileId];
  const camera=Math.hypot(state.value('GRecoil_HShake',1),state.value('GRecoil_VShake',1)),kick=Math.hypot(state.value('GGunkickRandom',behavior?.kickScales?.randomKickScale??1),state.value('GGunkickSpring',behavior?.kickScales?.springKickScale??1));
  if(![horizontal,vertical,camera,kick].every(Number.isFinite))return null;
  // This signature contains every input to the primary objective. Handling,
  // cost and stat floors are evaluated separately for every group member.
  const key=signature([refs.adsRecoilProfileId,horizontal,vertical,timeline,camera,kick]),cached=key===null?undefined:groups.get(key);
  if(cached!==undefined){stats.group_cache_hits++;return cached;}stats.groups_evaluated++;
  const sourcePoints=contract.trajectory(profile,horizontal,vertical,false,20);if(sourcePoints.length!==20)return null;
  let time=0;
  for(let i=0;i<20;i++){
   if(i){const interval=curves.u(timeline,i+1);if(!(Number.isFinite(interval)&&interval>0))return null;time+=interval;}
   points.push({...sourcePoints[i],time_ms:time});
  }
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||time<200)return null;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),distance=Math.max(...xs.map(Math.abs)),excursion=Math.max(...ys)-Math.min(...ys),speed=fastestHorizontalSpeed(points).speed;
  const components={pattern:excursion+horizontalSpeedMultiplier(speed)*distance,camera,kick};
  const primary=score(components);if(!Number.isFinite(primary))return null;
  // Lower the source-equivalent reconstruction as an additional numerical
  // guard. It never publishes a score: every survivor uses the full calculator.
  const lower=primary-1e-9*Math.max(1,Math.abs(primary));remember(key,lower);return lower;
 }};
}
