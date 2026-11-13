// Sweep dfttk effective main attributes with the resolved default build fixed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const work=process.argv[2];
const reference=process.argv[3];
const {o:resolve}=await import(pathToFileURL(path.join(reference,'curves.mjs')));
const kernel=await import(pathToFileURL(path.join(reference,'kernel.mjs')));
const {t:calculate}=await import(pathToFileURL(path.join(reference,'attributes.mjs')));
const inputs=JSON.parse(fs.readFileSync(path.join(work,'inputs.json'),'utf8'));
const stats={control:'3',handling:'5',stability:'6',accuracy:'4'};
const metrics={
 control:[['auto_vertical','Vertical automatic recoil','multiplier','lower'],['auto_horizontal','Horizontal automatic recoil','multiplier','lower'],['single_vertical','Vertical single/burst recoil','multiplier','lower'],['single_horizontal','Horizontal single/burst recoil','multiplier','lower'],['random_kick','Random weapon kick','multiplier','lower'],['spring_kick','Spring weapon kick','multiplier','lower']],
 handling:[['ads_ms','ADS time','ms','lower'],['sprint_to_fire_ms','Sprint-to-fire time','ms','lower'],['ads_move_mps','ADS movement speed','m/s','higher'],['silent_move_mps','Silent movement speed','m/s','higher']],
 stability:[['breath_deg','Breathing sway','degrees','lower'],['hold_breath_s','Hold-breath duration','seconds','higher'],['held_recoil','Held-breath recoil scale','multiplier','lower'],['hit_sway','Hit-induced weapon sway','multiplier','lower'],['move_sway','Movement camera sway','multiplier','lower'],['camera_h','Horizontal firing camera shake','multiplier','lower'],['camera_v','Vertical firing camera shake','multiplier','lower']],
 accuracy:[['hip_deg','Initial hip-fire spread','degrees','lower'],['hip_max_deg','Maximum hip-fire spread','degrees','lower'],['hip_moving_deg','Moving hip-fire spread','degrees','lower']]
};
function values(pack,result){
 const value=result.value,refs=result.references;
 const weapon=pack.weapon;
 const aiming=pack.handling.aimingProfiles[refs.aimingProfileId];
 const movement=pack.handling.movementProfiles[refs.movementProfileId];
 const spread=pack.handling.spreadProfiles[refs.waistSpreadProfileId];
 const behavior=pack.handling.weaponBehaviorProfiles?.[weapon.references.weaponBehaviorProfileId];
 const breath=pack.handling.holdBreathProfiles?.[refs.holdBreathProfileId];
 const walk=value('GMovement_WalkSpeed',movement.walkSpeedCmPerSecond)/100;
 const initialHip=value('GSpread_Hip',spread.baseSpreadDegrees.horizontal);
 return {
  auto_vertical:value('GRecoil_V',1),auto_horizontal:value('GRecoil_H',1),
  single_vertical:kernel.j(result.numeric.buckets,'GRecoil_V','GRecoil_V_singleorburst',1),
  single_horizontal:kernel.j(result.numeric.buckets,'GRecoil_H','GRecoil_H_singleorburst',1),
  random_kick:value('GGunkickRandom',behavior?.kickScales?.randomKickScale||1),
  spring_kick:value('GGunkickSpring',behavior?.kickScales?.springKickScale||1),
  ads_ms:Math.floor(Math.fround(value('GAiming_ADSTime',aiming.adsOnTimeSeconds))*1000),
  sprint_to_fire_ms:Math.floor(Math.fround(value('GSprintToFireTime',weapon.timings.sprintToFireSeconds))*1000),
  ads_move_mps:walk*(1+value('GMovement_ADSSpeed',movement.adsMovementModifier)),
  silent_move_mps:value('GMovement_SilentWalkSpeed',movement.silentMoveSpeedCmPerSecond)/100,
  breath_deg:value('WeaponAppearanceTable.HoldBreathId.StandBreathFactor',weapon.sway.baseBreathRangeDegrees*value('GBreathScale',1)),
  hold_breath_s:(breath?.breathMeter?.drainPerSecond?100/breath.breathMeter.drainPerSecond:0)/value('GBreathTime',1),
  held_recoil:(breath?.heldRecoilScale??1)*value('GBreathRecoil',1),
  hit_sway:weapon.sway.gunSwayBeHitScale*value('BehitGunSway',1),
  move_sway:value('AimMoveGunSway',behavior?.movementScales?.cameraScale||1),
  camera_h:value('GRecoil_HShake',1),camera_v:value('GRecoil_VShake',1),
  hip_deg:initialHip,hip_max_deg:value('GSpread_Hip_Continuous',spread.maximumSpreadDegrees.horizontal),
  hip_moving_deg:initialHip*spread.runtimeScaleFactor
 };
}
function compareSource(actual,source){
 const expected={auto_vertical:source.raw.aimContinueVerticalRecoilScale,auto_horizontal:source.raw.aimContinueHorizontalRecoilScale,
  single_vertical:source.raw.aimSingleVerticalRecoilScale,single_horizontal:source.raw.aimSingleHorizontalRecoilScale,
  random_kick:source.raw.randomKickIntensity,spring_kick:source.raw.springKickIntensity,
  ads_ms:source.handling.adsTimeMs,sprint_to_fire_ms:source.handling.sprintToFireMs,ads_move_mps:source.handling.adsMoveSpeed,
  breath_deg:source.stability.breathRangeDeg,hold_breath_s:source.stability.holdBreathSeconds,
  held_recoil:source.stability.holdBreathRecoilScale,hit_sway:source.stability.beHitScale,move_sway:source.stability.moveStability,
  camera_average:source.stability.fireCameraStability,hip_deg:source.waist.hipSpreadDeg,
  hip_max_deg:source.waist.maxSpreadDeg,hip_moving_deg:source.waist.legend.moving};
 const check={...actual,camera_average:(actual.camera_h+actual.camera_v)/2};
 for(const [key,value] of Object.entries(expected)){
  assert.ok(Number.isFinite(check[key])&&Number.isFinite(value),`nonfinite ${key}`);
  assert.ok(Math.abs(check[key]-value)<=1e-9*Math.max(1,Math.abs(value)),`${key}: ${check[key]} vs ${value}`);
  assertions++;
 }
}
let assertions=0;
const responses=[];
for(const [index,weapon] of inputs.weapons.entries()){
 const pack=JSON.parse(fs.readFileSync(path.join(work,'packs',weapon.id+'.json'),'utf8'));
 const build=resolve(pack,[]);
 for(const mode of ['sol','mp','bd']){
  const referenceResult=kernel.u(pack,build,{mode,tunes:{}});
  const baseline=values(pack,referenceResult);
  for(const [stat,id] of Object.entries(stats)){
   const baseX=referenceResult.numeric.mainAttr[id];
   const xs=[...new Set([...Array.from({length:151},(_,i)=>i),baseX])].sort((a,b)=>a-b);
   const series=metrics[stat].map(([key,label,unit,better])=>({key,label,unit,better,baseline:baseline[key],values:[]}));
   const mappings=pack.attributeRules.weaponOverrides?.[id]||pack.attributeRules.defaults?.[id]||{};
   for(const x of xs){
    const currentEffects=pack.effectsByItemId?.[pack.weaponId]?.[mode]||[];
    const bucket=referenceResult.numeric.buckets.get(`WeaponMainAttribute.MainAttrValues.${id}`);
    const scale=bucket?(1+bucket.multA)*bucket.multC:1;
    assert.notEqual(scale,0,'Cannot invert a zero main-attribute multiplier');
    const probe={...pack,effectsByItemId:{...pack.effectsByItemId,[pack.weaponId]:{...pack.effectsByItemId[pack.weaponId],
     [mode]:[...currentEffects,{operation:'StaticAttributeModify',target:`WeaponMainAttribute.MainAttrValues.${id}`,modifier:'Addend',value:(x-baseX)/scale,scope:'NONE'}]}}};
    const result=kernel.u(probe,build,{mode,tunes:{}});
    assert.ok(Math.abs(result.numeric.mainAttr[id]-x)<1e-9);assertions++;
    for(const other of Object.values(stats).filter(key=>key!==id)){
     assert.equal(result.numeric.mainAttr[other],referenceResult.numeric.mainAttr[other]);assertions++;
    }
    const measured=values(probe,result);
    for(const line of series){assert.ok(Number.isFinite(measured[line.key]));assertions++;line.values.push(measured[line.key])}
    if([0,50,100,150,baseX].includes(x)){
     const full=calculate(probe,{mode,resolvedLoadout:build,preservePrecision:true,trajectoryShotCount:1}).current;
     compareSource(measured,full);
     // Mainstat changes must not accidentally change the mounted build.
     assert.deepEqual(result.appliedParts,referenceResult.appliedParts);assertions++;
    }
   }
   responses.push({weapon_id:weapon.id,name:weapon.name,english:weapon.english,mode,stat,attribute_id:id,
    base_x:baseX,raw_weapon_base_x:pack.weapon.attributes.mainAttrValues[id],
    displayed_default:referenceResult.numeric.displayAttr[id],xs,series,
    mapping:mappings,curve_ids:(mappings.curveMappings||[]).map(m=>m.curveIds?.[mode]).filter(Boolean),
    default_config:build.config});
  }
 }
 if((index+1)%10===0)console.log(`Swept ${index+1}/${inputs.weapons.length} weapons`);
}
fs.writeFileSync(path.join(work,'responses.json'),JSON.stringify({data_version:inputs.data_version,runtime_version:inputs.runtime_version,
 source_snapshot:inputs.source_snapshot,method:'Effective main-attribute intervention; one stat varied, default loadout and other main stats fixed; no calibration or ammo.',
 domain:[0,150],domain_note:'Exploratory model domain, not an engine cap or claim every point is reachable with attachments.',
 assertions,responses}));
console.log(`PASS: ${responses.length} response sets; ${assertions} assertions, including full-calculator checks at five points per curve`);
