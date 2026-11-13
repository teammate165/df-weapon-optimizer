// Each preset supplies lower-is-better normalized loss plus diagnostic components.
// The engine is independent of the particular game metrics being optimized.
const handlingLoss=(components,baseline)=>{
  const ratio=(value,base)=>base>0?value/base:value;
  return 50*(ratio(components.ads_seconds,baseline.ads_seconds)+ratio(components.sprint_to_fire_seconds,baseline.sprint_to_fire_seconds));
};
export const presets = {
  agility: {
    label:'Highest Agility',
    description:'Strict hip-fire spread / handling / ADS recoil hierarchy. Accuracy minimizes idle hip-fire spread; maximum spread is excluded. Handling averages default-normalized ADS and sprint-to-fire times. Ordinary ADS ranks airborne ADS under the shared-scaling assumption. Recoil is the shared provisional ADS-only pattern/camera/kick proxy.',
    create(context) {
      const {pack,kernel,resolve,mode}=context;
      const recoil=presets.recoil.create(context);
      const raw=(build,tunes,state=kernel.u(pack,build,{mode,tunes}))=>{
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
      const objectives=c=>[
        100*ratio(c.accuracy,baseline.accuracy),
        handlingLoss(c,baseline),
        c.recoil,
      ];
      return {raw,baseline,score:c=>objectives(c)[0],objectives,
        objectiveNames:['accuracy','handling','recoil'],
        weights:{handling:{ads:0.5,sprint_to_fire:0.5},ads_recoil:recoil.weights},
        limitations:['Accuracy uses idle hip spread; moving spread is proportional and jumping mechanics remain unknown. Maximum spread is excluded.',
          'Ordinary ADS ranks airborne ADS assuming a build-independent airborne multiplier (user hypothesis; not client-verified).',
          'Range-aware hit probability is not modeled; angular spread is minimized.',
          'Handling uses equal normalized ADS/sprint-to-fire weights; recoil is an unvalidated proxy.']};
    },
  },
  recoil: {
    label:'Lowest Recoil',
    description:'Strict ADS recoil then Handling priorities. ADS-only pattern/camera/kick proxy, followed by equal default-normalized ADS and sprint-to-fire times; no hip-fire recoil or post-fire recovery term. Experimental, not client-validated.',
    create({pack,request:r,kernel,resolve,mode}) {
      const weights = r.weights ?? {pattern:0.3, camera:0.4, kick:0.3};
      if (Object.keys(weights).sort().join() !== 'camera,kick,pattern' || Object.values(weights).some(x=>!Number.isFinite(x)||x<0) || Object.values(weights).reduce((a,b)=>a+b,0)<=0) throw Error('Invalid weights');

      const raw = (build,tunes,s=kernel.u(pack,build,{mode,tunes})) => {
        const single=r.firing==='spam';
        const recoil=axis=>single?kernel.j(s.numeric.buckets,`GRecoil_${axis}`,`GRecoil_${axis}_singleorburst`,1):s.value(`GRecoil_${axis}`,1);
        const behavior=pack.handling.weaponBehaviorProfiles?.[pack.weapon.references.weaponBehaviorProfileId];
        const aiming=pack.handling.aimingProfiles[s.references.aimingProfileId];
        return {pattern:Math.hypot(recoil('H'),recoil('V')),
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
      return {raw,score,baseline,weights,objectives:c=>[score(c),handlingLoss(c,baseline)],
        objectiveNames:['ads_recoil','handling'],allowTargets:true};
    },
  },
};
