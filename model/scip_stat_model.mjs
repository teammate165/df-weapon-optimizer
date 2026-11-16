const STAT_PREFIX='WeaponMainAttribute.MainAttrValues.';
const scoreTargets=new Set(['GRecoil_H','GRecoil_V','GRecoil_HShake','GRecoil_VShake','GGunkickRandom','GGunkickSpring','GAiming_ADSTime','GSprintToFireTime','GSpread_Hip']);
const corners=(a,b)=>({lower:Math.min(a.lower*b.lower,a.lower*b.upper,a.upper*b.lower,a.upper*b.upper),upper:Math.max(a.lower*b.lower,a.lower*b.upper,a.upper*b.lower,a.upper*b.upper)});

export function compileStats(compiled,{pack,request},runtime){
 const {kernel,curves}=runtime,{model:m,nodes,groups}=compiled,mode=request.mode;
 const base=kernel.u(pack,{mounted:[]},{mode,tacticalEffective:true,tunes:{}});
 const itemOps=new Map(),bindings=[],controls=[];
 for(const op of base.operations)bindings.push({op,active:1,node:null,index:bindings.length});
 for(const node of nodes){
  if(!itemOps.has(node.item)){
   const state=kernel.u(pack,{mounted:[{itemId:node.item,slotPath:node.path,socketId:node.socketId,hostItemId:node.host}]},{mode,tacticalEffective:true,tunes:{}});
   itemOps.set(node.item,state.operations.filter(o=>o.sourceKind==='part'));
  }
  for(const op of itemOps.get(node.item))bindings.push({op,active:node.active,node,index:bindings.length});
 }
 // Reproduce strongest-per-target enabled-laser operations, including explicitly
 // locked multi-device setups. Ordinary penalties remain separate operations.
 const tactical=bindings.filter(b=>b.node&&b.op.scope==='TacticalEffective');
 for(const b of tactical){
  if(b.op.operation!=='StaticAttributeModify'||b.op.modifier!=='Addend'||!Number.isFinite(b.op.value))throw Error('Unsupported tactical operation');
  const competitors=tactical.filter(other=>other!==b&&other.op.target===b.op.target&&(other.op.value>b.op.value||other.op.value===b.op.value&&other.index<b.index));
  b.active=m.and(b.node.active,m.not(m.or(...competitors.map(other=>other.node.active))));
 }
 const initialBindings=bindings.slice();
 // The source kernel forwards aliases and selected main-stat direct rules.
 for(const b of initialBindings){
  if(!['StaticAttributeModify','StaticAttributeReplace'].includes(b.op.operation))continue;
  if(b.op.target==='SprintToFireSpeed')bindings.push({...b,op:{...b.op,target:'GSprintToFireTime'}});
  if(request.firing==='spam'&&b.op.modifier==='Mult_A'&&/^GRecoil_[HV]_singleorburst$/.test(b.op.target))bindings.push({...b,op:{...b.op,target:b.op.target.replace('_singleorburst','')}});
  const match=b.op.target.match(/^WeaponMainAttribute\.MainAttrValues\.(\d+)$/);
  if(match){const rule=pack.attributeRules.weaponOverrides?.[match[1]]??pack.attributeRules.defaults[match[1]],mapped=new Set((rule?.curveMappings??[]).map(x=>x.target));for(const target of rule?.directRuleTargets??[])if(!mapped.has(target))bindings.push({...b,op:{...b.op,target}});}
 }
 function after(a,b){
  if(a.node===b.node)return a.index>b.index?1:0;
  if(!a.node)return 0;if(!b.node)return 1;
  const ap=a.node.path.split('/'),bp=b.node.path.split('/');let k=0;
  while(k<ap.length&&k<bp.length&&ap[k]===bp[k])k++;
  if(k===bp.length)return 1;if(k===ap.length)return 0;
  const parent=ap.slice(0,k).join('/');
  return m.or(...groups.filter(g=>g.path===parent).filter(g=>{
   const sockets=pack.assembly.socketProviders[g.host]?.sockets??[],ai=sockets.findIndex(s=>String(s.socketId)===ap[k]),bi=sockets.findIndex(s=>String(s.socketId)===bp[k]);return ai>=0&&bi>=0&&ai>bi;
  }).map(g=>g.activeParent));
 }
 function last(items,fallback,value=b=>Number(b.op.value)){
  const terms=[];
  for(const b of items){const active=m.and(b.active,m.not(m.or(...items.filter(other=>other!==b).map(other=>m.and(other.active,after(other,b))))));terms.push(m.product(active,value(b)));}
  terms.push(m.product(m.not(m.or(...items.map(b=>b.active))),fallback));return m.add(...terms);
 }
 function partInterval(parts,target,modifier){
  const byPath=new Map();
  for(const n of nodes){
   const mine=parts.filter(b=>b.node===n&&b.op.target===target&&b.op.modifier===modifier);
   let lo=0,hi=0;for(const b of mine){const value=Number(b.op.value);if(b.active===n.active){lo+=value;hi+=value;}else{lo+=Math.min(0,value);hi+=Math.max(0,value);}}
   if(!byPath.has(n.path))byPath.set(n.path,[]);byPath.get(n.path).push({lower:lo,upper:hi});
  }
  const constant=parts.filter(b=>!b.node&&b.op.target===target&&b.op.modifier===modifier).reduce((n,b)=>n+Number(b.op.value),0);
  return {lower:constant+[...byPath.values()].reduce((n,options)=>n+Math.min(0,...options.map(x=>x.lower)),0),upper:constant+[...byPath.values()].reduce((n,options)=>n+Math.max(0,...options.map(x=>x.upper)),0)};
 }
 const stats={},stateSelectors=new Map();
 for(const id of ['3','4','5','6']){
  const relevant=bindings.filter(b=>b.node&&b.op.target===STAT_PREFIX+id&&['StaticAttributeModify','StaticAttributeReplace'].includes(b.op.operation));
  for(const b of relevant)if(b.op.modifier!=='Addend'&&Number(b.op.value)!==0)throw Error('Non-additive mounted main-stat operation: '+b.op.target);
  const initial=base.numeric.mainAttr[id];if(!Number.isInteger(initial)||relevant.some(b=>!Number.isInteger(Number(b.op.value))))throw Error('Non-integer main-stat state requires a new exact grid');
  const e=m.add(initial,...relevant.map(b=>m.scale(b.active,Number(b.op.value))));
  const interval=partInterval(relevant,STAT_PREFIX+id,'Addend');
  stats[id]=m.define('stat'+id,e,initial+interval.lower,initial+interval.upper,'integer');
  const floor=request.minimum_stats?.[({3:'control',4:'accuracy',5:'handling',6:'stability'})[id]];if(floor!==undefined)m.constrain(stats[id],'>=',floor,'stat_floor');
 }
 if(request.feasibility_only)return {stats,bindings,itemOps,base,after,last,controls:[],targets:{},decodeTunes:()=>({})};
 function selectors(id){
  if(stateSelectors.has(id))return stateSelectors.get(id);
  const rules=pack.attributeRules.weaponOverrides?.[id]??pack.attributeRules.defaults[id],mainBase=pack.weapon.attributes.mainAttrValues[id];
  const domains=[];
  for(const map of rules?.curveMappings??[]){
   if(!scoreTargets.has(map.target))continue;
   const curve=pack.curves[map.curveIds?.[mode]];if(!curve?.points?.length)continue;
   let offset=0;
   if(map.mappingType.startsWith('Delta')){
    const neutral=map.mappingType==='DeltaMapping'?0:1;
    const reference=pack.weapon.attributes.independentCurve?0:[...curve.points].filter(p=>Math.abs(p.outputValue-neutral)<1e-9).sort((a,b)=>Math.abs(a.inputValue)-Math.abs(b.inputValue))[0]?.inputValue??0;
    offset=mainBase-reference;
   }
   domains.push(...curve.points.map(p=>p.inputValue+offset));
  }
  const bounds=m.variables.get(stats[id]),lo=Math.max(bounds.lower,Math.floor(Math.min(...domains))),hi=Math.min(bounds.upper,Math.ceil(Math.max(...domains)));
  if(!domains.length){stateSelectors.set(id,[]);return [];}
  const states=[];
  for(let value=lo;value<=hi;value++){
   const flag=m.variable('state'+id);
   m.constrain(m.add(stats[id],m.scale(flag,bounds.upper-value)),'<=',bounds.upper,'state_upper');
   m.constrain(m.add(stats[id],m.scale(flag,bounds.lower-value)),'>=',bounds.lower,'state_lower');
   states.push({flag,value});
  }
  if(bounds.lower<lo){const flag=m.variable('state_low'+id);m.constrain(m.add(stats[id],m.scale(flag,bounds.upper-lo+1)),'<=',bounds.upper);states.push({flag,value:lo-1});}
  if(bounds.upper>hi){const flag=m.variable('state_high'+id);m.constrain(m.add(stats[id],m.scale(flag,bounds.lower-hi-1)),'>=',bounds.lower);states.push({flag,value:hi+1});}
  m.constrain(m.add(...states.map(s=>s.flag)),'==',1,'one_stat_state');stateSelectors.set(id,states);return states;
 }
 const extraA=new Map(),curveFactors=new Map(),extraAddend=new Map(),extraAddendBounds=new Map(),mappedInitial=new Map(),mappedInitialBounds=new Map();
 for(const id of ['2','3','4','5','6']){
  const rule=pack.attributeRules.weaponOverrides?.[id]??pack.attributeRules.defaults[id];
  for(const mapping of rule?.curveMappings??[]){
   if(!scoreTargets.has(mapping.target))continue;
   if(!stats[id])throw Error('Scored mapping through unsupported main stat '+id);
   const curve=pack.curves[mapping.curveIds?.[mode]];if(!curve)continue;
   const mainBase=pack.weapon.attributes.mainAttrValues[id],states=selectors(id);
   const neutral=mapping.mappingType==='DeltaMapping'?0:1;
   const reference=pack.weapon.attributes.independentCurve?0:[...curve.points].filter(p=>Math.abs(p.outputValue-neutral)<1e-9).sort((a,b)=>Math.abs(a.inputValue)-Math.abs(b.inputValue))[0]?.inputValue??0;
   const samples=states.map(s=>({...s,coefficient:curves.r(curve,mapping.mappingType.startsWith('Delta')?s.value-mainBase+reference:s.value)}));
   if(samples.some(s=>!Number.isFinite(s.coefficient)))throw Error('Invalid mapping curve');
   const expression=m.add(...samples.map(s=>m.scale(s.flag,s.coefficient)));
   if(mapping.mappingType==='DeltaMappingThenScale'){
    if(!curveFactors.has(mapping.target))curveFactors.set(mapping.target,[]);curveFactors.get(mapping.target).push(samples);
   }else if(mapping.mappingType==='DeltaMapping'){
    extraAddend.set(mapping.target,m.add(extraAddend.get(mapping.target)??0,expression));
    const old=extraAddendBounds.get(mapping.target)??{lower:0,upper:0};extraAddendBounds.set(mapping.target,{lower:old.lower+Math.min(...samples.map(s=>s.coefficient)),upper:old.upper+Math.max(...samples.map(s=>s.coefficient))});
   }else if(mapping.mappingType==='AbsoluteMapping'){
    mappedInitial.set(mapping.target,expression);mappedInitialBounds.set(mapping.target,{lower:Math.min(...samples.map(s=>s.coefficient)),upper:Math.max(...samples.map(s=>s.coefficient))});
   }
   else if(mapping.mappingType==='AbsoluteMappingThenScale'){
    const divisor=curves.r(curve,mainBase),scale=divisor?(base.baseTargets[mapping.target]??0)/divisor:1;mappedInitial.set(mapping.target,m.scale(expression,scale));mappedInitialBounds.set(mapping.target,{lower:Math.min(...samples.map(s=>s.coefficient*scale)),upper:Math.max(...samples.map(s=>s.coefficient*scale))});
   }else throw Error('Unknown mapping type '+mapping.mappingType);
  }
 }
 for(const node of nodes)for(const id of pack.parts[node.item]?.tuneIds??[]){
  const mounted={slotPath:node.path,itemId:node.item,socketId:node.socketId,hostItemId:node.host},control=curves.c(pack,mounted,id);
  if(!control||control.enabled===false)continue;
  const functions=(control.functions??[]).map(f=>request.firing==='spam'&&f.modifier==='Mult_A'&&/^GRecoil_[HV]_singleorburst$/.test(f.target)?{...f,target:f.target.replace('_singleorburst','')}:f).filter(f=>scoreTargets.has(f.target));if(!functions.length)continue;
  if(functions.some(f=>f.modifier!=='Mult_A'))throw Error('Unsupported scored calibration modifier');
  const positions=curves.n(control),states=positions.map(value=>({value,flag:m.variable('tune')}));m.constrain(m.add(...states.map(s=>s.flag),m.scale(node.active,-1)),'==',0,'one_tune');
  if(request.validationTunes){
   const selected=request.validationTunes[node.path]?.[id]??control.range.defaultValue;
   for(const state of states)m.constrain(m.add(state.flag,m.scale(node.active,state.value===selected?-1:0)),'==',0,'validation_tune');
  }
  const vectors=states.map(s=>{const values={};for(const f of functions)values[f.target]=(values[f.target]??0)+curves.r(pack.curves[f.curveId],s.value);return {...s,values};});
  for(const target of new Set(functions.map(f=>f.target))){
   if(!extraA.has(target))extraA.set(target,[]);
   extraA.get(target).push({node,expression:m.add(...vectors.map(v=>m.scale(v.flag,v.values[target]??0))),lower:Math.min(...vectors.map(v=>v.values[target]??0)),upper:Math.max(...vectors.map(v=>v.values[target]??0))});
  }
  controls.push({node,id,defaultValue:control.range.defaultValue,states});
 }
 const targets={};
 for(const target of scoreTargets){
  const parts=bindings.filter(b=>b.op.target===target&&['StaticAttributeModify','StaticAttributeReplace'].includes(b.op.operation));
  const initial=last(parts.filter(b=>['Initial','final'].includes(b.op.modifier)),base.baseTargets[target]??1);
  let starting=m.add(mappedInitial.get(target)??initial,extraAddend.get(target)??0,...parts.filter(b=>b.op.modifier==='Addend').map(b=>m.scale(b.active,Number(b.op.value))));
  if(target==='GSpread_Hip'&&!mappedInitial.has(target)){
   const changes=bindings.filter(b=>b.op.operation==='StaticAttributeReplace'&&b.op.target==='WaistShootSpreadId');
   const profile=last(changes,base.baseTargets[target],b=>pack.handling.spreadProfiles[String(b.op.value)]?.baseSpreadDegrees.horizontal??0);
   starting=m.add(profile,extraAddend.get(target)??0,...parts.filter(b=>b.op.modifier==='Addend').map(b=>m.scale(b.active,Number(b.op.value))));
  }
  const aInterval=partInterval(parts,target,'Mult_A'),additions=extraA.get(target)??[];
  const nodeRanges=new Map();
  for(const c of additions){const previous=nodeRanges.get(c.node)??{lower:0,upper:0};previous.lower+=c.lower;previous.upper+=c.upper;nodeRanges.set(c.node,previous);}
  const byPath=new Map();for(const [node,range] of nodeRanges){if(!byPath.has(node.path))byPath.set(node.path,[]);byPath.get(node.path).push(range);}
  const aLower=1+aInterval.lower+[...byPath.values()].reduce((n,rs)=>n+Math.min(0,...rs.map(r=>r.lower)),0),aUpper=1+aInterval.upper+[...byPath.values()].reduce((n,rs)=>n+Math.max(0,...rs.map(r=>r.upper)),0);
  const a=m.define('factorA',m.add(1,...parts.filter(b=>b.op.modifier==='Mult_A').map(b=>m.scale(b.active,Number(b.op.value))),...additions.map(c=>c.expression)),aLower,aUpper);
  let value=m.scale(a,starting.constant);
  for(const [binary,coefficient] of starting.terms){if(m.variables.get(binary).type!=='binary')throw Error('Initial target must be binary-affine');value=m.add(value,m.scale(m.product(binary,a),coefficient));}
  const sourceInitial=parts.filter(b=>['Initial','final'].includes(b.op.modifier)).map(b=>Number(b.op.value)),fallbackValues=[base.baseTargets[target]??1,...sourceInitial];
  if(target==='GSpread_Hip')for(const b of bindings.filter(b=>b.op.operation==='StaticAttributeReplace'&&b.op.target==='WaistShootSpreadId'))fallbackValues.push(pack.handling.spreadProfiles[String(b.op.value)]?.baseSpreadDegrees.horizontal??0);
  const ib=mappedInitialBounds.get(target)??{lower:Math.min(...fallbackValues),upper:Math.max(...fallbackValues)},eb=extraAddendBounds.get(target)??{lower:0,upper:0},ab=partInterval(parts,target,'Addend');
  let interval=corners({lower:ib.lower+eb.lower+ab.lower,upper:ib.upper+eb.upper+ab.upper},{lower:aLower,upper:aUpper});value=m.define('targetA',value,interval.lower,interval.upper);
  let constantC=1;const factors=new Map();
  for(const b of parts.filter(b=>b.op.modifier==='Mult_C')){
   if(!b.node){constantC*=Number(b.op.value);continue;}
   if(!factors.has(b.node.path))factors.set(b.node.path,new Map());const group=factors.get(b.node.path);group.set(b.node,{active:b.active,factor:(group.get(b.node)?.factor??1)*Number(b.op.value)});
  }
  value=m.scale(value,constantC);interval=corners(interval,{lower:constantC,upper:constantC});value=m.define('targetC0',value,interval.lower,interval.upper);
  for(const group of factors.values()){
   const options=[...group.values()],next=m.add(value,...options.map(f=>m.scale(m.product(f.active,value),f.factor-1)));
   interval=corners(interval,{lower:Math.min(1,...options.map(f=>f.factor)),upper:Math.max(1,...options.map(f=>f.factor))});value=m.define('targetC',next,interval.lower,interval.upper);
  }
  for(const samples of curveFactors.get(target)??[]){
   const next=m.add(...samples.map(s=>m.scale(m.product(s.flag,value),s.coefficient)));
   interval=corners(interval,{lower:Math.min(...samples.map(s=>s.coefficient)),upper:Math.max(...samples.map(s=>s.coefficient))});value=m.define('targetMapped',next,interval.lower,interval.upper);
  }
  targets[target]=value;
 }
 return {stats,targets,bindings,controls,itemOps,base,after,last,decodeTunes:solution=>{
  const tunes={};for(const c of controls){const chosen=c.states.find(s=>(solution[s.flag]??0)>.5);if(chosen&&chosen.value!==c.defaultValue)(tunes[c.node.path]??={})[c.id]=chosen.value;}return tunes;
 }};
}
