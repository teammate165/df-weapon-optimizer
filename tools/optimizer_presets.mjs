import {timedRecoil} from './timed_recoil.mjs';
import {fastestHorizontalSpeed,horizontalSpeedMultiplier} from './horizontal_speed.mjs';
import {createRecoilScreeningBound} from './scoring_bounds.mjs';
// Each preset supplies lower-is-better normalized loss plus diagnostic components.
// The engine is independent of the particular game metrics being optimized.
export const horizontalPatternLoss=(vertical,horizontal,speed)=>vertical+horizontalSpeedMultiplier(speed)*horizontal;
const handlingLoss=(components,baseline)=>{
  const ratio=(value,base)=>base>0?value/base:value;
  return 50*(ratio(components.ads_seconds,baseline.ads_seconds)+ratio(components.sprint_to_fire_seconds,baseline.sprint_to_fire_seconds));
};
export const presets = {
  agility: {
    label:'Highest Agility',
    description:'Weighted handling / hip-fire accuracy / ADS recoil loss: 50/30/20. Accuracy minimizes idle hip-fire spread; maximum spread is excluded. Handling averages default-normalized ADS and sprint-to-fire times. Ordinary ADS ranks airborne ADS under the shared-scaling assumption. Recoil is the shared provisional ADS-only pattern/camera/kick proxy.',
    create(context) {
      const {pack,kernel,resolve,mode}=context;
      const recoil=presets.recoil.create({...context,legacyRecoil:true});
      const raw=(build,tunes,state=kernel.u(pack,build,{tacticalEffective:true,mode,tunes}))=>{
        const spread=pack.handling.spreadProfiles[state.references.waistSpreadProfileId];
        const aiming=pack.handling.aimingProfiles[state.references.aimingProfileId];
        const standing=state.value('GSpread_Hip',spread.baseSpreadDegrees.horizontal);
        const adsRecoil=recoil.raw(build,tunes,state);
        return {accuracy:standing,
          ads_seconds:state.value('GAiming_ADSTime',aiming.adsOnTimeSeconds),
          sprint_to_fire_seconds:state.value('GSprintToFireTime',pack.weapon.timings.sprintToFireSeconds),
          recoil:recoil.score(adsRecoil),ads_pattern:adsRecoil.pattern,ads_camera:adsRecoil.camera,ads_kick:adsRecoil.kick};
      };
      const baseline=raw(resolve([]),{});
      const ratio=(value,base)=>base>0?value/base:value;
      const score=c=>0.5*handlingLoss(c,baseline)+0.3*100*ratio(c.accuracy,baseline.accuracy)+0.2*c.recoil;
      const objectives=c=>[score(c)];
      return {raw,baseline,score,objectives,stateReuse:{raw},branchScoring:{raw,score,objectives},solverPlan:{kind:'agility',baseline,recoil:recoil.solverPlan},calibrationPriorities:[['GAiming_ADSTime','GSprintToFireTime','GSpread_Hip'],['GRecoil_H','GRecoil_V','GGunkickRandom','GGunkickSpring']],
        objectiveNames:['weighted_agility'],
        weights:{objectives:{handling:0.5,accuracy:0.3,recoil:0.2},handling:{ads:0.5,sprint_to_fire:0.5},ads_recoil:recoil.weights},
        limitations:['Accuracy uses idle hip spread; moving spread is proportional and jumping mechanics remain unknown. Maximum spread is excluded.',
          'Ordinary ADS ranks airborne ADS assuming a build-independent airborne multiplier (user hypothesis; not client-verified).',
          'Range-aware hit probability is not modeled; angular spread is minimized.',
          'Handling uses equal normalized ADS/sprint-to-fire weights; recoil is an unvalidated proxy.']};
    },
  },
  recoil: {
    label:'Lowest Recoil',
    description:'Strict ADS recoil then Handling. Automatic pattern: V + multiplier * H over 20 ADS source-chart points; H=max(abs(x)) from pre-fire origin. Candidate fastest 200ms net horizontal speed selects multiplier: 1 up to 3, 4 above 3, 6 above 4, 10 above 5 model units/s. Exact piecewise-linear maximum; no P90. Pattern/camera/kick weights 40/30/30; default-normalized. Unsupported base firing protocols retain the legacy multiplier proxy. Experimental, not client-validated.',
    create({pack,request:r,kernel,resolve,mode,calculate,curves,legacyRecoil=false}) {
      const weights = r.weights ?? {pattern:0.4, camera:0.3, kick:0.3};
      if (Object.keys(weights).sort().join() !== 'camera,kick,pattern' || Object.values(weights).some(x=>!Number.isFinite(x)||x<0) || Object.values(weights).reduce((a,b)=>a+b,0)<=0) throw Error('Invalid weights');
      const basePath=!legacyRecoil&&calculate&&curves
        ?timedRecoil(pack,resolve([]),{},{mode,firing:r.firing,shot_count:20},{calculate,curves,kernel}):null;
      // Freeze protocol eligibility per weapon/run; never reward a candidate for
      // switching to a different scoring formula or reducing magazine capacity.
      const chartPattern=basePath?.status==='modeled';
      const patternModel=chartPattern?'ads-chart-speed-tier-v2':'legacy-multiplier-v1';

      const raw = (build,tunes,s=kernel.u(pack,build,{tacticalEffective:true,mode,tunes})) => {
        const single=r.firing==='spam';
        const recoil=axis=>single?kernel.j(s.numeric.buckets,`GRecoil_${axis}`,`GRecoil_${axis}_singleorburst`,1):s.value(`GRecoil_${axis}`,1);
        const behavior=pack.handling.weaponBehaviorProfiles?.[pack.weapon.references.weaponBehaviorProfileId];
        const aiming=pack.handling.aimingProfiles[s.references.aimingProfileId];
        let pattern= Math.hypot(recoil('H'),recoil('V')),diagnostics={pattern_model:patternModel};
        if(chartPattern){
          const path=timedRecoil(pack,build,tunes,{mode,firing:r.firing,shot_count:20},{calculate,curves,kernel},{abstractProfile:true});
          if(path.status!=='modeled')throw Error(`Candidate scoring protocol unavailable: ${path.reason}`);
          const points=path.points;
          if(points.length!==20)throw Error('Recoil scoring requires 20 source-chart points');
          const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
          const horizontal=Math.max(...xs.map(Math.abs)),vertical=Math.max(...ys)-Math.min(...ys);
          if(!Number.isFinite(horizontal)||!Number.isFinite(vertical))throw Error('Invalid recoil scoring trajectory');
          const peak=fastestHorizontalSpeed(points);
          pattern=horizontalPatternLoss(vertical,horizontal,peak.speed);
          diagnostics={pattern_model:patternModel,horizontal_distance:horizontal,
            horizontal_span:Math.max(...xs)-Math.min(...xs),vertical_excursion:vertical,
            horizontal_speed:peak.speed,horizontal_multiplier:horizontalSpeedMultiplier(peak.speed),
            horizontal_speed_window_ms:200,horizontal_speed_start_ms:peak.start_ms,
            horizontal_speed_end_ms:peak.end_ms,pattern_shots:20};
        }
        return {...diagnostics,pattern,
          camera:Math.hypot(s.value('GRecoil_HShake',1),s.value('GRecoil_VShake',1)),
          kick:Math.hypot(s.value('GGunkickRandom',behavior?.kickScales?.randomKickScale??1),s.value('GGunkickSpring',behavior?.kickScales?.springKickScale??1)),
          ads_seconds:s.value('GAiming_ADSTime',aiming.adsOnTimeSeconds),
          sprint_to_fire_seconds:s.value('GSprintToFireTime',pack.weapon.timings.sprintToFireSeconds)};
      };
      const baseline=raw(resolve([]),{});
      const score=components=>100*Object.entries(weights).reduce((sum,[key,w])=> {
        if (baseline[key]===0 && w>0) throw Error('Cannot normalize zero baseline');
        return sum+(w===0?0:w*components[key]/baseline[key]);
      },0)/Object.values(weights).reduce((a,b)=>a+b,0);
      const objectives=c=>[score(c),handlingLoss(c,baseline)];
      const screeningBound=createRecoilScreeningBound({pack,request:r,kernel,curves,calculate,raw,score,objectives,chartPattern});
      return {raw,score,baseline,weights,screeningBound,stateReuse:{raw},branchScoring:{raw,score,objectives},solverPlan:{kind:'recoil',chartPattern,weights,baseline},calibrationPriorities:[['GRecoil_H','GRecoil_V','GRecoil_HShake','GRecoil_VShake','GGunkickRandom','GGunkickSpring'],['GAiming_ADSTime','GSprintToFireTime']],objectives,
        objectiveNames:['ads_recoil','handling'],allowTargets:true,
        limitations:chartPattern?['Pattern uses 20 post-shot source-chart points; not measured angular recoil. The scoring window is fixed independently of graph shot count. For candidate magazines below 20, this is an abstract profile comparison, not a continuous firing claim.']:
          [`Legacy recoil multiplier proxy retained: ${legacyRecoil?'Highest Agility keeps its existing recoil component':basePath?.reason??'source chart runtime unavailable'}. No horizontal-speed tiers applied.`]};
    },
  },
};
