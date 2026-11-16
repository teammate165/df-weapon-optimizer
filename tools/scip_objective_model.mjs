// Linear outer approximations of Euclidean norms; rounded chart coordinates and
// speed tiers use integer/binary variables. Never invokes nonlinear interval
// arithmetic in the WASM runtime.
export function compileObjective(compiled,numeric,{pack,request},runtime,plan){
 const {model:m,nodes}=compiled,{targets:t,bindings,last}=numeric,{kernel,curves,calculate}=runtime;
 const mode=request.mode,norms=[];
 function norm(x,y,label){
  const xb=m.bounds(x),yb=m.bounds(y),upper=Math.hypot(Math.max(Math.abs(xb.lower),Math.abs(xb.upper)),Math.max(Math.abs(yb.lower),Math.abs(yb.upper)));
  const value=m.variable(label,0,upper,'continuous'),definition={x,y,value,upper};norms.push(definition);
  for(let i=0;i<16;i++){const angle=i*Math.PI/8;addNormCut(definition,Math.cos(angle),Math.sin(angle));}
  return value;
 }
 function addNormCut(n,x,y){m.constrain(m.add(n.value,m.scale(n.x,-x),m.scale(n.y,-y)),'>=',-1e-13*Math.max(1,n.upper),'norm_support');}
 const recoilPlan=plan.kind==='agility'?plan.recoil:plan;
 if(recoilPlan.kind!=='recoil')throw Error('Preset has no supported SCIP objective plan');
 let pattern;
 const chart={points:[],regimes:[],tiers:[]};
 if(recoilPlan.chartPattern){
  const references=bindings.filter(b=>b.op.operation==='StaticAttributeReplace'&&b.op.target==='AimingId.RecoilId');
  const ids=[...new Set([numeric.base.references.adsRecoilProfileId,...references.map(b=>String(b.op.value))])];
  const profiles=new Map(ids.map(id=>[id,profilePoints(pack.handling.recoilProfiles[id],20)]));
  if([...profiles.values()].some(p=>p.length!==20))throw Error('Missing scored source recoil profile');
  const hBound=m.bounds(t.GRecoil_H),vBound=m.bounds(t.GRecoil_V);
  for(let i=0;i<20;i++){
   const coordinates=[];
   for(const [axis,target,bound] of [['x','GRecoil_H',hBound],['y','GRecoil_V',vBound]]){
    const coefficient=last(references,profiles.get(numeric.base.references.adsRecoilProfileId)[i][axis],b=>profiles.get(String(b.op.value))[i][axis]);
    let raw=m.scale(t[target],coefficient.constant);
    for(const [binary,c] of coefficient.terms)raw=m.add(raw,m.scale(m.product(binary,t[target]),c));
    const possible=[...profiles.values()].flatMap(p=>[p[i][axis]*bound.lower,p[i][axis]*bound.upper]);
    const low=Math.floor(Math.min(...possible)*100000)-1,high=Math.ceil(Math.max(...possible)*100000)+1;
    const roundingEnvelope=1e-7+4096*Number.EPSILON*Math.max(1,...possible.map(Math.abs))*100000;
    const q=m.variable('chart_'+axis,low,high,'integer');
    m.constrain(m.add(q,m.scale(raw,-100000)),'<=',.5+roundingEnvelope,'round_upper');
    m.constrain(m.add(q,m.scale(raw,-100000)),'>=',-.5-roundingEnvelope,'round_lower');
    coordinates.push(q);
   }
   chart.points.push({x:coordinates[0],y:coordinates[1]});
  }
  const hx=Math.max(...chart.points.flatMap(p=>{const b=m.bounds(p.x);return [Math.abs(b.lower),Math.abs(b.upper)];}))/100000;
  const yr=chart.points.flatMap(p=>{const b=m.bounds(p.y);return [b.lower,b.upper];});
  const horizontal=m.variable('horizontal',0,hx,'continuous'),ymax=m.variable('ymax',Math.min(...yr),Math.max(...yr),'continuous'),ymin=m.variable('ymin',Math.min(...yr),Math.max(...yr),'continuous');
  for(const p of chart.points){m.constrain(m.add(horizontal,m.scale(p.x,-.00001)),'>=',0);m.constrain(m.add(horizontal,m.scale(p.x,.00001)),'>=',0);m.constrain(m.add(ymax,m.scale(p.y,-1)),'>=',0);m.constrain(m.add(ymin,m.scale(p.y,-1)),'<=',0);}
  const vertical=m.scale(m.add(ymax,m.scale(ymin,-1)),.00001);
  Object.assign(chart,{horizontal,ymax,ymin,vertical});
  const features=new Set();
  const fireTarget=/^(?:FireCD|FireInterval|GRateOfFire|FireRateMode|FireDelayTime|GFiremode|DefaultFireMode|SuppportFireModes|bEnableVariableFireRate)$/i;
  for(const [item,ops] of numeric.itemOps)if(ops.some(op=>fireTarget.test(op.target)))features.add(item);
  for(const [item,override] of Object.entries(pack.combat.specialFire?.itemOverrides??{}))if(['supportedModes','schedulePolicy','fireScheduleRules','triggerDelayModifierMs'].some(k=>override[k]!==undefined)||override.baseStatModifiers?.fireRate){features.add(item);for(const id of override.requiresItemIds??[])features.add(id);}
  for(const item of Object.keys(pack.combat.specialFire?.explicitlyUnmodeled?.items??{}))features.add(item);
  const list=[...features].filter(id=>nodes.some(n=>n.item===id)),flags=list.map(item=>m.or(...nodes.filter(n=>n.item===item).map(n=>n.active)));
  if(list.length>12)throw Error('Fire-control state space needs factorization beyond 12 feature items');
  for(let mask=0;mask<2**list.length;mask++){
   const flag=m.and(...flags.map((f,i)=>mask&(2**i)?f:m.not(f)));
   const mounted=list.flatMap((item,i)=>mask&(2**i)?[{itemId:item,slotPath:'fire/'+i}]:[]);
   let times;
   try{
    const loadout={mounted,config:[],slots:[]},state=kernel.u(pack,loadout,{mode,tacticalEffective:true,tunes:{}});
    const current=calculate(pack,{mode,tacticalEffective:true,resolvedLoadout:loadout,tunes:{},preservePrecision:true,trajectoryShotCount:20}).current;
    const rpm=current.weaponStats.fireRateRpm,baseRpm=60/pack.weapon.fireControl.fireIntervalSeconds;
    const fc=kernel.n(pack,state.appliedParts,rpm/baseRpm,null,kernel.t(pack,state.value));
    if(fc.selectedFireMode!=='Auto'||['unmodeled','modeOnly'].includes(fc.scheduleStatus))throw Error('Unsupported candidate firing protocol');
    times=[0];for(let shot=2;shot<=20;shot++){const step=curves.u({...fc,fireRate:rpm},shot);if(!(step>0))throw Error('Invalid fire interval');times.push(times.at(-1)+step);}
   }catch{m.constrain(flag,'==',0,'unsupported_fire_state');continue;}
   chart.regimes.push({flag,items:list.filter((_,i)=>mask&(2**i)),times});
  }
  m.constrain(m.add(...chart.regimes.map(r=>r.flag)),'==',1,'one_fire_state');
  chart.tiers=[1,2,3,5].map(multiplier=>({multiplier,flag:m.variable('speed_tier')}));
  m.constrain(m.add(...chart.tiers.map(t=>t.flag)),'==',1,'one_speed_tier');
  for(const regime of chart.regimes){
   const intervals=speedWindows(regime.times,200);
   for(const [index,tier] of chart.tiers.entries()){
    if(index===3)continue;
    const active=m.and(regime.flag,tier.flag),threshold=[3,4,5][index];
    for(const coefficients of intervals){
     const speed=m.add(...[...coefficients].map(([i,c])=>m.scale(chart.points[i].x,c*.00005))),bound=m.bounds(speed),bigM=Math.max(Math.abs(bound.lower),Math.abs(bound.upper))+threshold;
     m.constrain(m.add(speed,m.scale(active,bigM)),'<=',threshold+bigM,'speed_upper');
     m.constrain(m.add(m.scale(speed,-1),m.scale(active,bigM)),'<=',threshold+bigM,'speed_lower');
    }
   }
  }
  pattern=m.add(vertical,...chart.tiers.map(tier=>m.scale(m.product(tier.flag,horizontal),tier.multiplier)));
 }else pattern=norm(t.GRecoil_H,t.GRecoil_V,'pattern_norm');
 const camera=norm(t.GRecoil_HShake,t.GRecoil_VShake,'camera_norm'),kick=norm(t.GGunkickRandom,t.GGunkickSpring,'kick_norm');
 const total=Object.values(recoilPlan.weights).reduce((a,b)=>a+b,0);
 const recoil=m.add(...Object.entries({pattern,camera,kick}).map(([key,value])=>m.scale(value,recoilPlan.weights[key]===0?0:100*recoilPlan.weights[key]/(total*recoilPlan.baseline[key]))));
 const baseline=plan.baseline;
 const handling=m.add(m.scale(t.GAiming_ADSTime,baseline.ads_seconds>0?50/baseline.ads_seconds:50),m.scale(t.GSprintToFireTime,baseline.sprint_to_fire_seconds>0?50/baseline.sprint_to_fire_seconds:50));
 const primary=plan.kind==='agility'?m.add(m.scale(handling,.5),m.scale(t.GSpread_Hip,baseline.accuracy>0?30/baseline.accuracy:30),m.scale(recoil,.2)):recoil;
 const objectives=plan.kind==='agility'?[primary]:[primary,handling];
 return {primary,handling,objectives,norms,chart,addNormCut,addNorm:norm,evaluateExpression:(expression,solution)=>{const e=m.expression(expression);return e.constant+[...e.terms].reduce((v,[name,c])=>v+c*(solution[name]??0),0);}};
}

function profilePoints(profile,count){
 if(!profile)return [];
 const hasContinuous=(profile.continuousFire?.horizontalValues?.length??0)>0||(profile.continuousFire?.verticalValues?.length??0)>0;
 const first=hasContinuous?profile.continuousFire:{...profile.singleShot,horizontalValues:profile.singleShot?.horizontalValues?.slice(0,1)??[],verticalValues:profile.singleShot?.verticalValues?.slice(0,1)??[]},loop=profile.loop;
 const initialCount=Math.max(first?.horizontalValues?.length??0,first?.verticalValues?.length??0),loopCount=loop?.verticalValues?.length||loop?.horizontalValues?.length||1;
 let x=0,y=0;const points=[];
 const sample=(axis,i)=>{const values=first?.[axis+'Values']??[],scale=axis+'Scale';if(i<initialCount)return (values[i]??values.at(-1)??0)*(first?.[scale]||1);const later=loop?.[axis+'Values']??[];return later.length?(later[(i-initialCount)%loopCount]??later.at(-1)??0)*(loop?.[scale]||1):(values.at(-1)||0)*(first?.[scale]||1);};
 for(let i=0;i<count;i++){x+=sample('horizontal',i)/10;y-=sample('vertical',i)/10;points.push({x,y});}return points;
}
function speedWindows(times,window){
 const last=times.at(-1)-window;if(last<times[0])throw Error('Chart is shorter than speed window');
 const starts=new Set([times[0],last]);for(const time of times)for(const start of [time,time-window])if(start>=times[0]&&start<=last)starts.add(start);
 const position=time=>{let i=0;while(i<times.length-2&&times[i+1]<=time)i++;const u=(time-times[i])/(times[i+1]-times[i]);return new Map([[i,1-u],[i+1,u]]);};
 return [...starts].map(start=>{const coefficients=new Map(position(start+window));for(const [i,v] of position(start))coefficients.set(i,(coefficients.get(i)??0)-v);return coefficients;});
}
