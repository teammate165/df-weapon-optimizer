import {compileMounts} from './scip_mount_model.mjs';
import {compileStats} from './scip_stat_model.mjs';
import {compileObjective} from './scip_objective_model.mjs';
import {presets} from './optimizer_presets.mjs';
import {configKey} from './exhaustive_attachment_gate.mjs';
import {timedRecoil} from './timed_recoil.mjs';
import {solveLinearModel} from './scip_runtime.mjs';
import {createHighsAdapter} from './highs_runtime.mjs';

// Fixed native-legal fixtures are calibration workload examples, not a newly
// computed full top-0.5% survivor set. Both engines receive identical domains.
export const calibrationFixtures=[
 {id:'insight-only',config:[['11','13110000091']]},
 {id:'recorded-ordinary-best',config:[['11','13110000091'],['2','13020000349'],['2/6','13130000160'],['38','13030000115'],['4/8','13140000041'],['5','13120000030'],['5/44','13340000001']]},
 {id:'barrel-muzzle',config:[['11','13110000091'],['2','13020000349'],['2/6','13130000160']]},
 {id:'grip-magazine',config:[['11','13110000091'],['38','13030000115'],['5','13120000030'],['5/44','13340000001']]},
].map(f=>({...f,config:f.config.map(([slotPath,itemId])=>({slotPath,itemId}))}));

export async function benchmarkCalibration({pack,catalog,modules,createSCIP,loadHighs,workerId,rounds=6,seconds=.5,onProgress=()=>{}}){
 const began=performance.now(),{kernel,curves}=modules,fixture=calibrationFixtures[workerId%calibrationFixtures.length],mode='bd',request={mode,preset:'recoil',budget:800,fixed:[{slotPath:'11',itemId:'13110000091'}],experimental_dominance:false},resolve=config=>curves.o(pack,config,mode),build=resolve(fixture.config);
 if(configKey(build.config)!==configKey(fixture.config))throw Error('Fixture does not resolve exactly');
 const fixtureCost=build.mounted.filter(n=>n.source==='equipped').reduce((n,p)=>n+catalog.shop.partCosts[p.itemId],0);if(fixtureCost>800)throw Error('Fixture exceeds cap');
 const input={pack,shop:catalog.shop,prices:catalog.prices,request,candidateConfigs:[fixture.config]},preset=presets.recoil.create({...input,...modules,mode,resolve}),compiled=compileMounts(input,kernel),numeric=compileStats(compiled,input,modules),objective=compileObjective(compiled,numeric,input,modules,preset.solverPlan),m=compiled.model,highs=createHighsAdapter(loadHighs);
 const allowed=configKey(fixture.config),native=config=>{const b=resolve(config),state=kernel.u(pack,b,{mode,tacticalEffective:true,tunes:{}});return preset.objectives(preset.raw(b,{},state));},baseline=native(fixture.config),records=[],best={scip:baseline,highs:baseline},dedup=new Set();
 let roundsMatched=true,converged=false,totalNormCuts=0,totalRoundingCuts=0;const phaseResults=[];
 const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
 function inspect(result){
  if(result.errorCount)throw Error(result.errors.join('; '));if(!result.hasIncumbent)return null;
  const config=compiled.decode(result.values),tunes=numeric.decodeTunes(result.values),b=resolve(config);if(configKey(config)!==allowed||configKey(b.config)!==allowed)throw Error('Solver returned a different attachment domain');
  const state=kernel.u(pack,b,{mode,tacticalEffective:true,tunes}),raw=preset.raw(b,tunes,state),objectives=preset.objectives(raw),issues=[];
  for(const variable of m.variables.values()){const value=result.values[variable.name]??0,tolerance=1e-7*Math.max(1,Math.abs(value),Math.abs(variable.lower),Math.abs(variable.upper));if(!Number.isFinite(value)||value<variable.lower-tolerance||value>variable.upper+tolerance||variable.type!=='continuous'&&Math.abs(value-Math.round(value))>1e-6)issues.push('variable '+variable.name);}
  for(const row of m.constraints){const value=[...row.expression.terms].reduce((sum,[name,c])=>sum+c*(result.values[name]??0),0),tol=1e-6*Math.max(1,Math.abs(value),Math.abs(row.bound));if(row.sense!=='<='&&value<row.bound-tol||row.sense!=='>='&&value>row.bound+tol)issues.push('constraint '+row.name);}
  for(const [id,name]of Object.entries(numeric.stats))if(Math.abs((result.values[name]??0)-state.numeric.mainAttr[id])>1e-7)issues.push('main-stat '+id);
  for(const [target,name]of Object.entries(numeric.targets)){const want=state.value(target);if(Math.abs((result.values[name]??0)-want)>1e-7*Math.max(1,Math.abs(want)))issues.push('target '+target);}
  if(issues.length)throw Error('Native model mismatch: '+issues.join(', '));
  const path=timedRecoil(pack,b,tunes,{mode,shot_count:20},modules,{abstractProfile:true}),rounding=objective.chart.points.flatMap((point,i)=>['x','y'].flatMap(axis=>{const value=Math.round(path.points[i][axis]*100000);return Math.abs((result.values[point[axis]]??0)-value)>.1?[{name:point[axis],value}]:[];})),norms=[];
  for(const norm of objective.norms){const x=objective.evaluateExpression(norm.x,result.values),y=objective.evaluateExpression(norm.y,result.values),length=Math.hypot(x,y);if(length-(result.values[norm.value]??0)>1e-9*Math.max(1,length))norms.push({norm,x:x/length,y:y/length});}
  return {config,tunes,objectives,rounding,norms,values:result.values};
 }
 function addCuts(checked){
  if(!checked)return 0;let count=0;
  for(const {norm,x,y}of checked.norms){const key=JSON.stringify(['norm',norm.value,x,y]);if(dedup.has(key))continue;dedup.add(key);objective.addNormCut(norm,x,y);count++;totalNormCuts++;}
  if(checked.rounding.length){
   const selected=[];for(const [name,v]of m.variables)if(v.type==='binary'&&(compiled.players.size||numeric.controls.length)&&[...compiled.players.values()].some(p=>p.value===name))selected.push((checked.values[name]??0)>.5?name:m.not(name));
   for(const control of numeric.controls){const chosen=control.states.find(s=>(checked.values[s.flag]??0)>.5);if(chosen)selected.push(chosen.flag);}
   const guard=m.and(...selected);
   for(const {name,value}of checked.rounding){const key=JSON.stringify(['round',guard,name,value]);if(dedup.has(key))continue;dedup.add(key);const bounds=m.variables.get(name),bigM=Math.max(Math.abs(bounds.lower-value),Math.abs(bounds.upper-value));m.constrain(m.add(name,m.scale(guard,bigM)),'<=',value+bigM,'native_round_upper');m.constrain(m.add(name,m.scale(guard,-bigM)),'>=',value-bigM,'native_round_lower');count++;totalRoundingCuts++;}
  }
  return count;
 }
 try{
  for(const phase of ['primary','handling']){
   if(phase==='handling'){const target=Math.min(best.scip[0],best.highs[0]);m.constrain(objective.primary,'<=',target+1e-8,'shared_primary_target');}
   const goal=phase==='primary'?objective.primary:objective.handling;let phaseClosed=false;
  for(let round=0;round<rounds;round++){
   const cip=m.cip(goal),fingerprint=await digest(cip),order=(Math.floor(workerId/4)+round+(phase==='handling'?1:0))%2?['highs','scip']:['scip','highs'],pair=[];
   for(const engine of order){
    const start=performance.now(),result=engine==='scip'?await solveLinearModel(cip,{createRuntime:createSCIP,seconds}):await highs.solve(m,goal,{seconds}),elapsed=performance.now()-start,checked=inspect(result);
    if(checked){const a=checked.objectives,b=best[engine];if(a[0]<b[0]||a[0]===b[0]&&a[1]<b[1])best[engine]=a;}
    const record={worker:workerId,fixture:fixture.id,phase,round,engine,order:order.indexOf(engine),model_sha256:fingerprint,variables:m.variables.size,constraints:m.constraints.length,elapsed_ms:elapsed,adapter_ms:result.elapsed_ms,prepare_ms:result.prepare_ms??null,solve_ms:result.solve_ms??null,status:result.status,has_incumbent:result.hasIncumbent,primal_bound:result.primalBound,dual_bound:result.dualBound,gap_percent:result.gapPercent,native_objectives:checked?.objectives??null,pending_norm_cuts:checked?.norms.length??0,pending_rounding_cuts:checked?.rounding.length??0,adapter:result.adapter??null,version:result.version??'SCIP10.0.2'};
    pair.push({record,checked});records.push(record);onProgress(record);
   }
   if(await digest(m.cip(goal))!==fingerprint)throw Error('Model mutated between paired solves');
   let cuts=0;for(const {checked}of pair)cuts+=addCuts(checked);
   const closed=pair.every(p=>p.record.status==='optimal'&&p.checked&&!p.checked.norms.length&&!p.checked.rounding.length);
   if(closed){phaseClosed=true;const i=phase==='primary'?0:1;roundsMatched=Math.abs(pair[0].checked.objectives[i]-pair[1].checked.objectives[i])<=1e-7;if(!roundsMatched)throw Error('Source objectives differ at converged model');break;}
   if(!cuts)break;
  }
  phaseResults.push({phase,closed:phaseClosed});
  }
  converged=phaseResults.every(p=>p.closed);
  return {passed:true,worker:workerId,fixture:fixture.id,fixture_cost:fixtureCost,baseline,controls:numeric.controls.length,variables:m.variables.size,constraints:m.constraints.length,best,records,shared_norm_cuts:totalNormCuts,shared_rounding_cuts:totalRoundingCuts,rounds_matched:roundsMatched,converged,phases:phaseResults,wall_ms:performance.now()-began,scope:'fixed-layout primary and conditional Handling calibration; shared native-refinement cuts; bounded solves; not whole screening or category calibration'};
 }finally{highs.dispose();}
}
