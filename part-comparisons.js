// Colors describe modeled benefit/trade-off. Signed deltas retain the actual
// direction, so e.g. a reduction in ADS milliseconds is shown as a green minus.
export const majorStatGroups=[
 {title:'Control',key:'recoilControl',detail:'recoil',attribute:'3'},
 {title:'Handling',key:'handling',detail:'handling',attribute:'5'},
 {title:'Stability',key:'stability',detail:'stability',attribute:'6'},
 {title:'Accuracy',key:'waistAccuracy',detail:'waist',attribute:'4'},
];
export const comparisonMetrics=[
 ...majorStatGroups.map(g=>['panel.'+g.key,g.title,'pts',1]),
 ['recoil.autoVertical','Auto vertical recoil','×',-1],['recoil.autoHorizontal','Auto horizontal recoil','×',-1],['recoil.singleVertical','Single vertical recoil','×',-1],['recoil.singleHorizontal','Single horizontal recoil','×',-1],['recoil.fireWeaponStability','Gun Stability','×',-1],['recoil.gunKickHorizontal','Horizontal kick','×',-1],['recoil.gunKickVertical','Vertical kick','×',-1],
 ['handling.adsTimeMs','ADS time','ms',-1],['handling.sprintToFireMs','Sprint to fire','ms',-1],['handling.adsMoveSpeed','ADS move speed','m/s',1],['handling.walkSpeed','Walk speed','m/s',1],['handling.sprintSpeed','Sprint speed','m/s',1],['handling.reloadTime','Tactical reload','s',-1],['handling.emptyReloadTime','Empty reload','s',-1],['handling.holsterTime','Equip time (source)','s',-1],['handling.drawTime','Holster time (source)','s',-1],
 ['stability.breathRangeDeg','Breath sway','°',-1],['stability.holdBreathSeconds','Hold breath','s',1],['stability.holdBreathRecoilScale','Held recoil','×',-1],['stability.beHitScale','Hit sway','×',-1],['stability.moveStability','Movement sway multiplier','×',-1],['stability.fireCameraStability','Camera Stability','×',-1],
 ['waist.hipSpreadDeg','Hip spread','°',-1],['waist.maxSpreadDeg','Maximum hip spread','°',-1],['waist.aimSpreadDeg','ADS spread','°',-1],['waist.aimMaxSpreadDeg','Maximum ADS spread','°',-1],['waist.uiFactor','UI scaling','×',0],
 ['weaponStats.validDamageRangeMeters','Effective range','m',1],['weaponStats.muzzleVelocityMps','Velocity','m/s',1],['weaponStats.fireRateRpm','Fire rate','rpm',0],['weaponStats.magazineCapacity','Magazine','rounds',1],
];
const valueAt=(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object);
export function groupStatChanges(changes){
 const result=majorStatGroups.map(group=>({title:group.title,summary:changes.find(c=>c.path==='panel.'+group.key),details:changes.filter(c=>c.path.startsWith(group.detail+'.'))}));
 const range=changes.filter(c=>['weaponStats.validDamageRangeMeters','weaponStats.muzzleVelocityMps'].includes(c.path));
 const other=changes.filter(c=>c.path.startsWith('weaponStats.')&&!range.includes(c));
 if(range.length)result.push({title:'Range',details:range});
 if(other.length)result.push({title:'Weapon',details:other});
 return result.filter(group=>group.summary||group.details.length);
}
export function statChanges(before,after){
 const changes=comparisonMetrics.flatMap(([path,label,unit,direction])=>{
  const a=valueAt(before,path),b=valueAt(after,path);
  if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(b-a)<1e-7)return [];
  const delta=b-a;
  return [{path,label,unit,before:a,after:b,delta,tone:direction===0?'neutral':delta*direction>0?'benefit':'loss'}];
 });
 // Only merge fire modes when both endpoints actually match. Some attachments
 // have single/burst-only effects, which must remain visible as separate rows.
 for(const axis of ['Vertical','Horizontal']){
  const auto='recoil.auto'+axis,single='recoil.single'+axis;
  if(Math.abs(valueAt(before,auto)-valueAt(before,single))<1e-7&&Math.abs(valueAt(after,auto)-valueAt(after,single))<1e-7){
   const row=changes.find(c=>c.path===auto);if(row)row.label=axis+' recoil';
   const duplicate=changes.findIndex(c=>c.path===single);if(duplicate>=0)changes.splice(duplicate,1);
  }
 }
 return changes;
}

// Conditional bonuses are intrinsic ON-versus-OFF effects, independent of the
// equipped-part comparison (which can be zero for two equivalent lasers).
export function tacticalBenefits(tactical){
 const labels={
  'WeaponMainAttribute.MainAttrValues.3':['Control',1],
  'WeaponMainAttribute.MainAttrValues.4':['Accuracy',1],
  'WeaponMainAttribute.MainAttrValues.5':['Handling',1],
  'WeaponMainAttribute.MainAttrValues.6':['Stability',1],
  GRecoil_H:['Horizontal recoil',-1],GRecoil_V:['Vertical recoil',-1],
  GGunkickRandom:['Random weapon kick',-1],GGunkickSpring:['Spring weapon kick',-1],
  GRecoil_HShake:['Horizontal camera shake',-1],GRecoil_VShake:['Vertical camera shake',-1],
  'WeaponAppearanceTable.HoldBreathId.StandBreathFactor':['Standing breath sway',-1],
  'WeaponAppearanceTable.HoldBreathId.CrouchBreathFactor':['Crouched breath sway',-1],
  'WeaponAppearanceTable.HoldBreathId.ProneBreathFactor':['Prone breath sway',-1],
 };
 const benefits=[];
 for(const op of tactical?.operations??[]){
  const definition=labels[op.target];if(!definition)continue;
  const delta=op.modifier==='Mult_C'?(op.value-1)*100:op.modifier==='Mult_A'?op.value*100:op.modifier==='Addend'?op.value:null;
  if(!Number.isFinite(delta)||delta*definition[1]<=0)continue;
  const value=Number(delta.toFixed(3));
  benefits.push({label:definition[0],value:(value>0?'+':'')+value+(op.modifier==='Addend'?' pts':'%')});
 }
 return benefits;
}
