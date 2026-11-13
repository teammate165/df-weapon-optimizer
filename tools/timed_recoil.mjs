// Source-chart coordinates with source fire schedules; no synthetic jitter,
// player compensation, recoil recovery, or guessed AN94 tightness coefficient.
export function summarizePath(points) {
  if(points.length<2) throw Error('At least two shots are required');
  const first=points[0], last=points.at(-1), seconds=(last.time_ms-first.time_ms)/1000;
  if(!(seconds>0)) throw Error('Shot times must increase');
  const xs=points.map(p=>p.x), ys=points.map(p=>-p.y);
  const signed=(first.y-last.y)/seconds;
  return {duration_ms:last.time_ms-first.time_ms,
    climb_model_units_per_second:Math.max(0,signed),
    signed_climb_model_units_per_second:signed,
    horizontal_drift_model_units_per_second:(last.x-first.x)/seconds,
    horizontal_span_model_units:Math.max(...xs)-Math.min(...xs),
    peak_upward_displacement_model_units:Math.max(0,...ys),
    maximum_distance_from_start_model_units:Math.max(...points.map(p=>Math.hypot(p.x,p.y))),
    first_shot_impulse_model_units:{x:first.x,up:-first.y},
    window:'first post-shot chart point to last post-shot chart point; first impulse reported separately'};
}

export function timedRecoil(pack, build, tunes, request, modules) {
  const {calculate,curves,kernel}=modules;
  const count=request.shot_count??20;
  if(!Number.isInteger(count)||count<2||count>200) throw Error('shot_count must be an integer from 2 to 200');
  const options={mode:request.mode,resolvedLoadout:build,tunes,preservePrecision:true,trajectoryShotCount:count};
  const current=calculate(pack,options).current;
  const state=kernel.u(pack,build,{mode:request.mode,tunes});
  const rpm=current.weaponStats.fireRateRpm;
  const baseRpm=60/pack.weapon.fireControl.fireIntervalSeconds;
  // Include SDK interval/burst changes as well as explicit special schedules.
  const fc=kernel.n(pack,state.appliedParts,rpm/baseRpm,null,kernel.t(pack,state.value));
  const common={model_version:'timed-source-chart-v1',units:'model units; angular calibration unverified',
    input_assumption:'No compensation or reaction; one fully reset uninterrupted firing string',
    requested_shots:count,capacity:current.weaponStats.magazineCapacity,fire_control:fc,
    recoil_profile_id:current.references.adsRecoilProfileId,
    chart_point_semantics:'Cumulative source post-shot recoil; not validated bullet impact positions',
    global_verified:false};
  if(request.firing==='spam') return {...common,status:'unavailable',reason:'Cadence-dependent recoil/reset dynamics are not measured; source single-shot multipliers are insufficient'};
  if(fc.scheduleStatus==='unmodeled'||fc.scheduleStatus==='modeOnly') return {...common,status:'unavailable',reason:'Source firing schedule is not modeled'};
  if(fc.selectedFireMode!=='Auto') return {...common,status:'unavailable',reason:'Weapon requires a prescribed single/burst trigger cadence; continuous hold is not supported'};
  if(count>current.weaponStats.magazineCapacity) return {...common,status:'unavailable',reason:'Requested shots exceed this build magazine; no reload or silent truncation is modeled'};
  const rules=fc.fireScheduleRules??[];
  if(rules.some(r=>!['firstShotsRpm','intervalScaleSequence','repeatedBurst'].includes(r.mode))) return {...common,status:'unavailable',reason:'Unknown schedule rule'};
  const timeline={...fc,fireRate:rpm};
  let elapsed=0;
  const points=current.recoil.adsTrajectory.map((p,index)=> {
    if(index) {
      const interval=curves.u(timeline,index+1);
      if(!(Number.isFinite(interval)&&interval>0)) throw Error('Invalid source firing interval');
      elapsed+=interval;
    }
    const previous=index?current.recoil.adsTrajectory[index-1]:{x:0,y:0};
    return {shot:index+1,time_ms:elapsed,x:p.x,y:p.y,
      pre_shot_aim_proxy:{x:previous.x,y:previous.y}};
  });
  if(points.length!==count) throw Error('Source trajectory count mismatch');
  const opening=rules.find(r=>r.mode==='firstShotsRpm');
  return {...common,status:'modeled',points,metrics:summarizePath(points),
    pre_shot_aim_proxy_note:'Previous cumulative impulse before this shot, starting at zero. Consistent with lab hit-before-kick ordering; omits smoothing, spread, jitter and between-shot recovery. Not a measured impact simulation.',
    opening:opening?{shots:opening.shots,metrics:count>=opening.shots?summarizePath(points.slice(0,opening.shots)):null,
      sustained_metrics:count-opening.shots>=2?summarizePath(points.slice(opening.shots)):null,
      note:'Opening timing and per-shot recoil shape are independent source inputs; third-shot boundary and reset remain unverified'}:null};
}
