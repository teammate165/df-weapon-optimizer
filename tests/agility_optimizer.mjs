import assert from 'node:assert/strict';
import {comparator} from '../tools/optimizer_policy.mjs';
import {presets,horizontalPatternLoss} from '../tools/optimizer_presets.mjs';
assert.equal(horizontalPatternLoss(4,1,3),5);
assert.equal(horizontalPatternLoss(4,1,3.01),6);
assert.equal(horizontalPatternLoss(4,1,4.01),7);
assert.equal(horizontalPatternLoss(4,1,5.01),9);
const better=comparator({});
const candidate=(objectives,cost=0)=>({objectives,score:objectives[0],cost,stats:{}});
assert(better(candidate([90,1000,1000],100),candidate([91,0,0])));
assert(better(candidate([90,80,1000],100),candidate([90,81,0])));
assert(better(candidate([90,80,70],100),candidate([90,80,71])));
assert(better(candidate([90,80,70],1),candidate([90,80,70],2)));
assert(!better(candidate([90.000001,0,0]),candidate([90,1000,1000])));
const pack={weapon:{references:{},timings:{sprintToFireSeconds:0.2}},handling:{
  spreadProfiles:{hip:{baseSpreadDegrees:{horizontal:2},runtimeScaleFactor:1.25}},
  aimingProfiles:{aim:{adsOnTimeSeconds:0.3}},
}};
const state=(values={})=>({numeric:{buckets:{}},references:{waistSpreadProfileId:'hip',aimingProfileId:'aim'},value:(key,fallback)=>values[key]??fallback});
const preset=presets.agility.create({pack,kernel:{u:()=>state()},resolve:()=>({}),mode:'bd',request:{}});
const recoilPreset=presets.recoil.create({pack,kernel:{u:()=>state()},resolve:()=>({}),mode:'bd',request:{}});
assert.deepEqual(recoilPreset.objectives(recoilPreset.raw({},{})),[100,100]);
const faster=recoilPreset.raw({}, {}, state({GAiming_ADSTime:0.15,GSprintToFireTime:0.1}));
assert.deepEqual(recoilPreset.objectives(faster),[100,50]);
assert(better(candidate(recoilPreset.objectives(faster),1000),candidate([100,100],0)));
const worseRecoil=recoilPreset.raw({}, {}, state({GRecoil_H:1.01,GAiming_ADSTime:0.001,GSprintToFireTime:0.001}));
assert(!better(candidate(recoilPreset.objectives(worseRecoil),0),candidate([100,100],1000)));
const base=preset.raw({},{});
assert.equal(base.accuracy,2);
assert.deepEqual(preset.objectives(base),[100]);
const changed=preset.raw({}, {}, state({GSpread_Hip:1,GAiming_ADSTime:0.15,GSprintToFireTime:0.1}));
assert.deepEqual(preset.objectives(changed),[60]);
assert.equal(preset.score({...base,ads_seconds:0.15,sprint_to_fire_seconds:0.1}),75);
assert.equal(preset.score({...base,accuracy:1}),85);
assert.equal(preset.score({...base,recoil:50}),90);
assert.deepEqual(preset.weights.objectives,{handling:0.5,accuracy:0.3,recoil:0.2});
assert(better(candidate(preset.objectives({...base,ads_seconds:0.15,sprint_to_fire_seconds:0.1,accuracy:2.2})),candidate(preset.objectives(base))));
// Moving/max spread do not contribute to the objective; resolved idle/ADS do.
pack.handling.spreadProfiles.hip.runtimeScaleFactor=2;
pack.handling.aimingProfiles.aim.adsOnTimeSeconds=0.6;
const replacement=preset.raw({},{});
assert.equal(replacement.accuracy,2);
assert.equal(replacement.jumping_spread_proxy_deg,undefined);
assert.equal(replacement.running_spread_deg,undefined);
assert.equal(replacement.ads_seconds,0.6);
console.log('Agility weighted trade-off and source metric checks passed');
