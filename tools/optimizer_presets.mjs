// Each preset supplies lower-is-better normalized loss plus diagnostic components.
// The engine is independent of the particular game metrics being optimized.
export const presets = {
  recoil: {
    label:'Lowest experimental recoil',
    description:'Unvalidated within-weapon recoil/camera/kick multiplier proxy; no post-fire recovery term; timed path metrics are separate diagnostics',
    create({pack,request:r,kernel,resolve,mode}) {
      const weights = r.weights ?? {pattern:0.3, camera:0.4, kick:0.3};
      if (Object.keys(weights).sort().join() !== 'camera,kick,pattern' || Object.values(weights).some(x=>!Number.isFinite(x)||x<0) || Object.values(weights).reduce((a,b)=>a+b,0)<=0) throw Error('Invalid weights');

      const raw = (build,tunes,s=kernel.u(pack,build,{mode,tunes})) => {
        const single=r.firing==='spam';
        const recoil=axis=>single?kernel.j(s.numeric.buckets,`GRecoil_${axis}`,`GRecoil_${axis}_singleorburst`,1):s.value(`GRecoil_${axis}`,1);
        const behavior=pack.handling.weaponBehaviorProfiles?.[pack.weapon.references.weaponBehaviorProfileId];
        return {pattern:Math.hypot(recoil('H'),recoil('V')),
          camera:Math.hypot(s.value('GRecoil_HShake',1),s.value('GRecoil_VShake',1)),
          kick:Math.hypot(s.value('GGunkickRandom',behavior?.kickScales?.randomKickScale??1),s.value('GGunkickSpring',behavior?.kickScales?.springKickScale??1))};
      };
      const baseline=raw(resolve([]),{});
      const score=components=>100*Object.entries(weights).reduce((sum,[key,w])=> {
        if (baseline[key]===0 && w>0) throw Error('Cannot normalize zero baseline');
        return sum+(w===0?0:w*components[key]/baseline[key]);
      },0)/Object.values(weights).reduce((a,b)=>a+b,0);
      return {raw,score,baseline,weights};
    },
  },
};
