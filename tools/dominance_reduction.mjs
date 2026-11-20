// Opt-in M4A1 research profile. This is a best-solution reduction, not a
// certificate preserving the original population's top-5% ranked list.
const mainTargets=['3','5','6'].map(id=>'WeaponMainAttribute.MainAttrValues.'+id);
const readTargets=['GRecoil_H','GRecoil_V','GRecoil_HShake','GRecoil_VShake','GGunkickRandom','GGunkickSpring','GAiming_ADSTime','GSprintToFireTime'];
const dimensions=[...mainTargets,...readTargets,...readTargets.map(t=>t+':multC')];
const primaryTargets=readTargets.slice(0,6),primaryDimensions=[mainTargets[0],mainTargets[2],...primaryTargets,...primaryTargets.map(t=>t+':multC')];
const ignored=t=>/^DisplayAttrValues\./.test(t)||/^WeaponMainAttribute.MainAttrValues\.[24]$/.test(t)||['GBullet_Velocity','GBullet_Range','GSpread_ADS','GRecoil_Hip','GSpread_Hip','GSpread_Hip_Continuous','GBreathScale','GBreathTime','GBreathRecoil','BehitGunSway','AimMoveGunSway','GMovement_ADSSpeed','GMovement_SilentWalkSpeed','GGunkickH','GGunkickV','GMagCapacity','GReload_Time','ScopeCameraTuneDistance','ScopeZoomTuneRate'].includes(t);
const zero=()=>Object.fromEntries(dimensions.map(t=>[t,t.endsWith(':multC')?-1:0]));
export const covers=(a,b)=>dimensions.every(t=>a[t]>=b[t]);
const combine=(a,b)=>Object.fromEntries(dimensions.map(t=>[t,t.endsWith(':multC')?-a[t]*b[t]:a[t]+b[t]]));
const strict=(a,b)=>dimensions.some(t=>a[t]>b[t]);
function frontier(rows){const out=[];for(const row of rows){if(out.some(other=>covers(other.vector,row.vector)))continue;for(let i=out.length-1;i>=0;i--)if(covers(row.vector,out[i].vector))out.splice(i,1);out.push(row);}return out;}

function coefficientBounds(pack,compiled,contract,curves){
 const byPath=new Map(),options={mode:'bd',tacticalEffective:true,tunes:{},includeAmmo:false,ammoItemId:null};
 function contributions(operations){const row=Object.fromEntries(readTargets.map(t=>[t,0]));for(const op of operations){
  if(mainTargets.includes(op.target)&&(!['Initial','Addend'].includes(op.modifier)&&!(op.modifier==='Mult_A'&&op.value===0)&&!(op.modifier==='Mult_C'&&op.value===1)))throw Error('Nonadditive main-stat operation');
  if(!readTargets.includes(op.target))continue;
  if(op.modifier==='Mult_A')row[op.target]+=op.value;
  if(op.modifier==='Mult_C'&&(! (op.value>=0)||['GRecoil_H','GRecoil_V'].includes(op.target)&&op.value===0))throw Error('Negative source multiplier');
  if(['GAiming_ADSTime','GSprintToFireTime'].includes(op.target)&&['Initial','Addend'].includes(op.modifier)&&op.value<0)throw Error('Negative timing initial/addend');
 }return row;}
 try{
  const base=contributions(contract.collect(pack,{mounted:[]},options).operations);
  for(const node of compiled.nodes){
   if(node.active===0)continue;
   const mounted={itemId:node.item,slotPath:node.path,hostItemId:node.host,socketId:node.socketId},own=contract.collect(pack,{mounted:[mounted]},options).operations.filter(o=>o.sourceKind==='part'),row=contributions(own);
   for(const id of pack.parts[node.item]?.tuneIds??[]){const control=curves.c(pack,mounted,id);if(!control||control.enabled===false)continue;const positions=curves.n(control);if(positions.length>201)throw Error('Unbounded control domain');
    for(const f of control.functions??[]){if(mainTargets.includes(f.target))throw Error('Calibrated main-stat arithmetic');if(!readTargets.includes(f.target))continue;
     const values=positions.map(value=>curves.r(pack.curves[f.curveId],value));if(values.some(v=>!Number.isFinite(v)))throw Error('Nonfinite control');
     if(f.modifier==='Mult_A')row[f.target]+=Math.min(0,...values);
     else if(f.modifier==='Mult_C'&&values.every(v=>['GRecoil_H','GRecoil_V'].includes(f.target)?v>0:v>=0))continue;
     else throw Error('Unsupported calibrated read-target operation');
    }
   }
   const old=byPath.get(node.path)??Object.fromEntries(readTargets.map(t=>[t,0]));for(const t of readTargets)old[t]=Math.min(old[t],row[t]);byPath.set(node.path,old);
  }
  const lower=Object.fromEntries(readTargets.map(t=>[t,1+base[t]+[...byPath.values()].reduce((n,r)=>n+r[t],0)]));
  if(Object.values(lower).some(v=>!Number.isFinite(v)||v<0))return {supported:false,reason:'Nonnegative multiplier bound failed',lower};
  if(!(pack.weapon.timings.sprintToFireSeconds>=0)||Object.values(pack.handling.aimingProfiles).some(p=>p.adsOnTimeSeconds<0))return {supported:false,reason:'Negative source timing profile'};
  return {supported:true,lower,scope:'all possible nodes, one mounted item per path, every legal calibration position; conservative inclusion of unreachable nodes'};
 }catch(error){return {supported:false,reason:error.message};}
}

function strictPatternCertificate(pack,compiled,contract,chart,preset){
 const weightSum=Object.values(preset.weights??{}).reduce((a,b)=>a+b,0);
 if(preset.weights?.pattern!==.4*weightSum||preset.weights?.camera!==.3*weightSum||preset.weights?.kick!==.3*weightSum)return {supported:false,reason:'Strict-primary profile supports the default 40/30/30 weights'};
 try{
  const options={mode:'bd',tacticalEffective:true,tunes:{},includeAmmo:false,ammoItemId:null},base=contract.collect(pack,{mounted:[]},options).operations,profiles=new Set();
  const inputs=[base,...compiled.nodes.filter(n=>n.active!==0).map(n=>contract.collect(pack,{mounted:[{itemId:n.item,slotPath:n.path,hostItemId:n.host,socketId:n.socketId}]},options).operations)];
  for(const operations of inputs){
   const refs=contract.references(pack,'bd',operations,null);profiles.add(refs.adsRecoilProfileId);
   for(const op of operations)if(['GRecoil_H','GRecoil_V'].includes(op.target)&&((op.modifier==='Mult_C'&&op.value!==1)||(op.modifier==='Initial'&&op.value!==1)||(op.modifier==='Addend'&&op.value!==0)))throw Error('Pattern can vanish or reverse through source coefficients');
  }
  for(const id of profiles){const points=chart.trajectory(pack.handling.recoilProfiles[id],1,1,false,20);if(points.length!==20||Math.max(...points.map(p=>Math.abs(p.x)))<1||Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))<1)throw Error('Degenerate pattern geometry');}
  // These mappings must scale both axes positively; their positivity and the
  // global multiplier lower bounds are checked separately above.
  return {supported:true,profiles:[...profiles],minimum_coefficient_gap:1e-6,scope:'positive nondegenerate H/V trajectory; strict primary improvement permits a worse Handling tie-breaker'};
 }catch(error){return {supported:false,reason:error.message};}
}

export function decreasingPositiveCurve(curve){
 const ps=[...curve?.points??[]].sort((a,b)=>a.inputValue-b.inputValue);
 if(!ps.length||ps.some(p=>!Number.isFinite(p.outputValue)||p.outputValue<=0))return false;
 for(let i=0;i<ps.length-1;i++){
  const p=ps[i],q=ps[i+1],dx=q.inputValue-p.inputValue;if(!(dx>0)||q.outputValue>p.outputValue)return false;
  if(p.interpolationMode!=='RCIM_Cubic')continue;
  const a=2*p.outputValue-2*q.outputValue+dx*(p.leaveTangent+q.arriveTangent),b=-3*p.outputValue+3*q.outputValue-dx*(2*p.leaveTangent+q.arriveTangent),c=dx*p.leaveTangent;
  if(![a,b,c].every(Number.isFinite))return false;
  const checks=[0,1];if(a!==0&&-b/(3*a)>0&&-b/(3*a)<1)checks.push(-b/(3*a));
  if(checks.some(t=>3*a*t*t+2*b*t+c>1e-14))return false;
 }
 return true;
}

export function applyDominanceReduction(input,modules,{compiled,groups,preset}){
 const {pack,request:r,shop}=input,{kernel,curves,calculate}=modules,disabled=reason=>({enabled:false,reason,rules:[],block_rules:[]});
 if(!r.experimental_dominance)return disabled('not_requested');
 if(pack.weaponId!=='18010000001'||r.mode!=='bd'||r.preset!=='recoil'||r.firing==='spam'||Object.keys(r.minimum_stats??{}).length)return disabled('unsupported_weapon_mode_preset_protocol_or_floors');
 if(!(r.fixed??[]).some(f=>f.slotPath==='11'&&f.itemId==='13110000091'))return disabled('prototype_requires_locked_insight_3_7');
 const contract=kernel.u?.screeningStateContract,chart=calculate?.screeningChartContract;
 if(contract?.version!==1||contract.evaluate!==kernel.u||chart?.version!==1||chart.calculate!==calculate||!groups.enabled||!preset.solverPlan?.chartPattern)return disabled('unsupported_source_contract');
 const requiredMappings={'3':{GRecoil_H:'DeltaMappingThenScale',GRecoil_V:'DeltaMappingThenScale',GGunkickRandom:'DeltaMappingThenScale',GGunkickSpring:'DeltaMappingThenScale'},'5':{GAiming_ADSTime:'AbsoluteMapping',GSprintToFireTime:'DeltaMappingThenScale'},'6':{GRecoil_HShake:'DeltaMappingThenScale',GRecoil_VShake:'DeltaMappingThenScale'}};
 const knownAliases={'3':['GRecoil_V','GGunkick_ADSRecoilH','GRecoilRecovery'],'5':['GAiming_ADSTime','GSprintToFireTime','GMovement_ADSSpeed'],'6':[]};
 for(const id of ['3','5','6']){const rule=pack.attributeRules?.weaponOverrides?.[id]||pack.attributeRules?.defaults?.[id];
  if(!rule||(rule.directRuleTargets??[]).some(t=>!knownAliases[id].includes(t))||Object.entries(requiredMappings[id]).some(([target,type])=>!rule.curveMappings?.some(m=>m.target===target&&m.mappingType===type))||(rule.curveMappings??[]).some(m=>!readTargets.includes(m.target)&&!ignored(m.target)))return disabled('unsupported_stat_mapping_or_alias');
 }
 const coefficient_bounds=coefficientBounds(pack,compiled,contract,curves);
 if(!coefficient_bounds.supported)return {...disabled('source_coefficient_sign_not_certified'),coefficient_bounds};
 const strict_pattern=coefficient_bounds.lower.GRecoil_H>1e-6&&coefficient_bounds.lower.GRecoil_V>1e-6?strictPatternCertificate(pack,compiled,contract,chart,preset):{supported:false,reason:'Pattern multiplier lower bound is zero'};
 const outcomeCovers=(a,b)=>covers(a,b)||(strict_pattern.supported&&primaryDimensions.every(t=>a[t]>=b[t])&&['GRecoil_H','GRecoil_V','GRecoil_H:multC','GRecoil_V:multC'].some(t=>a[t]-b[t]>=strict_pattern.minimum_coefficient_gap));
 const curveChecks=[];
 for(const id of ['3','5','6'])for(const mapping of (pack.attributeRules?.weaponOverrides?.[id]||pack.attributeRules?.defaults?.[id])?.curveMappings??[]){
  if(!readTargets.includes(mapping.target))continue;
  if(!['AbsoluteMapping','DeltaMappingThenScale'].includes(mapping.mappingType)||!decreasingPositiveCurve(pack.curves[mapping.curveIds?.bd]))return disabled('objective_curve_monotonicity_not_certified');
  curveChecks.push({id,target:mapping.target,curve:mapping.curveIds.bd});
 }
 const fixed=r.fixed??[],locked=path=>fixed.some(f=>f.slotPath===path||f.slotPath.startsWith(path+'/')),sensitive=new Set(),cache=new Map();
 function scan(v){if(Array.isArray(v))v.forEach(scan);else if(v&&typeof v==='object')for(const [key,x]of Object.entries(v)){if(pack.parts[key])sensitive.add(key);scan(x);}else if(pack.parts[String(v)])sensitive.add(String(v));}
 scan(pack.assembly.coupling);scan(pack.assembly.extraOccupancy);scan(pack.combat?.specialFire);
 function item(id,path,host,socketId){
  const key=JSON.stringify([id,path,host,socketId]);if(cache.has(key))return cache.get(key);
  if(sensitive.has(id)||pack.parts[id]?.boundAmmoByMode?.bd)return null;
  const provider=pack.assembly.socketProviders[id];
  if(provider?.sockets?.some(s=>s.optionItemIds?.some(id=>pack.parts[id]?.tuneIds?.length||pack.assembly.socketProviders[id]?.sockets?.length)))return null;
  const structure=JSON.stringify(provider?.sockets?.map(s=>({socketId:s.socketId,options:s.optionItemIds,modes:s.modes}))??[]),node={itemId:id,slotPath:path,hostItemId:host,socketId};
  const operations=contract.collect(pack,{mounted:[node]},{mode:'bd',tacticalEffective:true,tunes:{},includeAmmo:false,ammoItemId:null}).operations.filter(o=>o.sourceKind==='part'&&!ignored(o.target));
  if(operations.some(o=>o.scope==='TacticalEffective'))return null;
  const vector=zero(),rest=[],controls=[];
  for(const op of operations){
   if(op.operation==='StaticAttributeModify'&&mainTargets.includes(op.target)&&op.modifier==='Addend'&&Number.isSafeInteger(op.value))vector[op.target]+=op.value;
   else if(op.operation==='StaticAttributeModify'&&readTargets.includes(op.target)&&op.modifier==='Mult_A')vector[op.target]-=op.value;
   else if(op.operation==='StaticAttributeModify'&&readTargets.includes(op.target)&&op.modifier==='Mult_C'&&op.value>=0)vector[op.target+':multC']*=op.value;
   else if(op.operation==='StaticAttributeModify'&&((['Addend','Mult_A'].includes(op.modifier)&&op.value===0)||(op.modifier==='Mult_C'&&op.value===1)))continue;
   else rest.push([op.operation,op.target,op.modifier,op.value,op.scope]);
  }
  for(const tuneId of pack.parts[id]?.tuneIds??[]){
   const control=curves.c(pack,node,tuneId);if(!control||control.enabled===false)continue;
   const functions=(control.functions??[]).filter(f=>!ignored(f.target));if(!functions.length)continue;
   if(functions.some(f=>!readTargets.includes(f.target)||f.modifier!=='Mult_A'))return null;
   const positions=curves.n(control);if(positions.length>201)return null;
   controls.push({id:tuneId,positions,functions});
  }
  let envelope=[{vector,tunes:{}}];
  for(const control of controls){
   const options=frontier(control.positions.map(value=>{const delta=zero();for(const f of control.functions)delta[f.target]-=curves.r(pack.curves[f.curveId],value);return {vector:delta,tunes:{[control.id]:value}};}));
   if(envelope.length*options.length>65536)return null;
   envelope=frontier(envelope.flatMap(a=>options.map(b=>({vector:combine(a.vector,b.vector),tunes:{...a.tunes,...b.tunes}}))));
  }
  const value={id,path,host,socketId,cost:shop.partCosts[id],vector,controls,envelope,signature:JSON.stringify(rest),structure};cache.set(key,value);return value;
 }
 const rules=[],slotItems=new Map();
 const compatible=(a,b)=>{if(a.structure===b.structure)return true;if(r.dominance_optional_children===false)return false;const aa=JSON.parse(a.structure??'[]'),bb=JSON.parse(b.structure??'[]');if(bb.length||aa.some(s=>[...(pack.assembly.coupling?.[pack.weaponId]?.rules??[]),...(pack.assembly.coupling?.[a.id]?.rules??[])].some(r=>String(r.targetSocketId)===String(s.socketId))))return false;return true;};
 const dominates=(a,b)=>a!==b&&compatible(a,b)&&a.signature===b.signature&&a.cost<=b.cost&&outcomeCovers(a.vector,b.vector)&&b.envelope.every(bv=>a.envelope.some(av=>outcomeCovers(av.vector,bv.vector)))&&(a.cost<b.cost||strict(a.vector,b.vector)||String(a.id)<String(b.id));
 for(const group of compiled.groups)for(const slot of group.slots){
  if(locked(slot.path))continue;
  const items=groups.options(slot.options,slot.path).filter(id=>!groups.isTactical(slot.path,id)).map(id=>item(id,slot.path,group.host,slot.socket.socketId)).filter(Boolean);
  if(!slot.rules.length){const vector=zero();items.push({id:null,path:slot.path,host:group.host,cost:0,vector,controls:[],envelope:[{vector,tunes:{}}],signature:JSON.stringify([]),structure:JSON.stringify([])});}
  else if(slot.rules.length===1&&slot.rules[0].condition?.type==='always'&&slot.rules[0].mountPolicy==='default'){
   const original=item(String(slot.rules[0].mountedItemId),slot.path,group.host,slot.socket.socketId);if(original)items.push({...original,id:null,cost:0});
  }
  const removed=new Set();
  for(const b of items){if(b.id===null)continue;const a=items.find(a=>dominates(a,b));if(!a)continue;
   for(const node of slot.nodes.filter(n=>n.item===b.id))compiled.model.constrain(node.equipped,'==',0,'experimental_dominance');
   rules.push({path:slot.path,host:group.host,from:b.id,to:a.id,old_cost:b.cost,new_cost:a.cost,from_item:b,to_item:a});removed.add(b.id);
  }
  slotItems.set(group.host+'|'+slot.path,items.filter(i=>!removed.has(i.id)));
 }
 const root=compiled.groups.find(g=>g.host===pack.weaponId&&g.path===''),blockPaths=['1','3'],block_rules=[];
 if(root&&!blockPaths.some(locked)){
  const buckets=blockPaths.map(path=>(slotItems.get(root.host+'|'+path)??[]).filter(i=>i.id===null||!pack.assembly.socketProviders[i.id]?.sockets?.length));
  const blocks=buckets[0].flatMap(a=>buckets[1].map(b=>({ids:[a.id,b.id],cost:a.cost+b.cost,vector:combine(a.vector,b.vector),envelope:frontier(a.envelope.flatMap(av=>b.envelope.map(bv=>({vector:combine(av.vector,bv.vector),tunes:{'1':av.tunes,'3':bv.tunes}})))),signature:JSON.stringify([a.signature,a.structure,b.signature,b.structure])})));
  for(const b of blocks){const a=blocks.find(a=>a!==b&&a.signature===b.signature&&a.cost<=b.cost&&outcomeCovers(a.vector,b.vector)&&b.envelope.every(bv=>a.envelope.some(av=>outcomeCovers(av.vector,bv.vector)))&&(a.cost<b.cost||strict(a.vector,b.vector)||JSON.stringify(a.ids)<JSON.stringify(b.ids)));if(!a)continue;
   const flags=b.ids.map((id,i)=>id===null?compiled.model.not(compiled.model.or(...[...compiled.players.values()].filter(p=>p.path===blockPaths[i]).map(p=>p.value))):compiled.players.get(blockPaths[i]+'|'+id).value);
   compiled.model.constrain(compiled.model.and(...flags),'==',0,'experimental_block_dominance');block_rules.push({paths:blockPaths,from:b.ids,to:a.ids,old_cost:b.cost,new_cost:a.cost,from_item:b,to_item:a});
  }
 }
 return {enabled:true,experimental:true,certificate_scope:'source/tuning envelope with strict-primary lexicographic bounds; native-context validation required; not an original-top-5% certificate',coefficient_bounds,strict_pattern,curve_checks:curveChecks,rules,block_rules,outcomeCovers};
}

export function dominanceReport(plan){return {enabled:plan.enabled,experimental:plan.experimental??false,reason:plan.reason,certificate_scope:plan.certificate_scope,coefficient_bounds:plan.coefficient_bounds,strict_pattern:plan.strict_pattern,curve_checks:plan.curve_checks,rules:plan.rules.map(({from_item,to_item,...r})=>({...r,old_tuning_frontier:from_item.envelope.length,new_tuning_frontier:to_item.envelope.length})),block_rules:plan.block_rules.map(({from_item,to_item,...r})=>({...r,old_tuning_frontier:from_item.envelope.length,new_tuning_frontier:to_item.envelope.length}))};}
