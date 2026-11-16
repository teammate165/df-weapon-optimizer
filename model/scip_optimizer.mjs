import {compileMounts} from './scip_mount_model.mjs?v=0a828ed25f230959';
import {compileStats} from './scip_stat_model.mjs?v=0a828ed25f230959';
import {compileObjective} from './scip_objective_model.mjs?v=0a828ed25f230959';
import {solveLinearModel} from './scip_runtime.mjs?v=0a828ed25f230959';
import {presets} from './optimizer_presets.mjs?v=0a828ed25f230959';
import {policy,statIds,shortfall,comparator,compareObjectives} from './optimizer_policy.mjs?v=0a828ed25f230959';
import {selectCategories,cheapestGate} from './optimizer_selection.mjs?v=0a828ed25f230959';
import {completeRiserOptics,emptyRisers} from './optimizer_mounts.mjs?v=0a828ed25f230959';
import {timedRecoil} from './timed_recoil.mjs?v=0a828ed25f230959';
import {exhaustiveAttachmentGate,configKey} from './exhaustive_attachment_gate.mjs?v=0a828ed25f230959';

let factoryPromise;
async function runtimeModules(runtime){
 if(typeof runtime==='object')return runtime;
 const {pathToFileURL}=await import('node:url'),path=await import('node:path');
 const curves=await import(pathToFileURL(path.join(runtime,'curves.mjs?v=0a828ed25f230959'))),kernel=await import(pathToFileURL(path.join(runtime,'kernel.mjs?v=0a828ed25f230959'))),{t:calculate}=await import(pathToFileURL(path.join(runtime,'attributes.mjs?v=0a828ed25f230959')));
 return {curves,kernel,calculate};
}
export async function generateSCIP(input,runtime){
 const modules=await runtimeModules(runtime),{curves,kernel,calculate}=modules,{pack,shop,prices,request:r}=input;
 const mode=r.mode,settings=policy(r),fixed=r.fixed??[];
 if(!['bd','sol','mp'].includes(mode))throw Error('Unknown mode');
 if(!Array.isArray(fixed)||fixed.some(f=>typeof f.slotPath!=='string'||typeof f.itemId!=='string')||new Set(fixed.map(f=>f.slotPath)).size!==fixed.length)throw Error('Invalid fixed attachments');
 if(r.firing&&!['auto','spam'].includes(r.firing))throw Error('Unknown firing protocol');
 if(r.passes!==undefined&&(!Number.isInteger(r.passes)||r.passes<1||r.passes>20))throw Error('Legacy passes must be 1..20');
 const limit=r.time_limit_seconds??(r.passes===undefined?30:Math.max(1,2*r.passes));if(!Number.isFinite(limit)||limit<1||limit>600)throw Error('Solver time limit must be 1..600 seconds');
 const tier=mode==='bd'?shop.weapons[pack.weaponId]:null;
 let budgets=mode==='mp'?[null]:r.budgets??[mode==='bd'?tier?.gunsmithLimit:r.budget];
 if(mode!=='mp'&&(![1,3].includes(budgets.length)||budgets.some((b,i)=>!Number.isFinite(b)||b<0||i&&b<budgets[i-1]||mode==='bd'&&b>tier?.gunsmithLimit)))throw Error('Invalid budget or weapon cap');
 const resolve=config=>curves.o(pack,config,mode),initial=resolve(fixed),retains=build=>fixed.every(f=>build.mounted.some(m=>m.slotPath===f.slotPath&&m.itemId===f.itemId));
 if(!retains(initial))throw Error('Fixed attachments conflict or cannot mount; include required parent selections');
 const hidden=new Set(mode==='bd'?shop.hiddenItemIds:[]),laserLimit=Math.max(1,fixed.filter(f=>kernel.l(pack,f.itemId,mode)).length),costs=mode==='bd'?shop.partCosts:prices;
 if(initial.mounted.some(n=>hidden.has(n.itemId)))throw Error('Fixed setup contains a hidden Detonation item');
 const preset=presets[settings.preset].create({pack,request:r,kernel,curves,calculate,mode,resolve});
 if(!preset.solverPlan)throw Error('Preset does not declare a full SCIP objective');
 if(preset.objectives&&!preset.allowTargets&&r.effectiveness_targets!==undefined)throw Error('This preset does not support custom effectiveness targets');
 factoryPromise??=import('../vendor/scip-7e68f9ca/scip.js?v=0a828ed25f230959').then(m=>m.default);
 const createRuntime=await factoryPromise,started=performance.now();
 let starts=input.solver_starts;
 if(!starts&&typeof process!=='undefined'&&process.versions?.node){try{const fs=await import('node:fs/promises');starts=JSON.parse(await fs.readFile(new URL('../data/solver_starts/'+pack.weaponId+'.json',import.meta.url),'utf8'));}catch{}}
 const baselinePath=timedRecoil(pack,resolve([]),{},r,modules),baseState=kernel.u(pack,resolve([]),{mode,tacticalEffective:true,tunes:{}}),baselineStats=Object.fromEntries(Object.entries(statIds).map(([k,id])=>[k,baseState.numeric.mainAttr[id]]));
 const diagnostics={name:'SCIP',version:'10.0.2',formulation:'calibration over exhaustive two-stage top-5% attachment survivors with norm supporting cuts',full_weapon:false,time_limit_seconds:limit,time_limit_scope:'calibration_only',screening_elapsed_ms:0,calibration_elapsed_ms:0,elapsed_ms:0,solves:0,norm_cuts:0,rounding_cuts:0,phases:[],global_optimality:false,interval_arithmetic_used:false,numerics:{feasibility_tolerance:1e-9,source_replay_tolerance:1e-7,norm_supporting_cut_tolerance:1e-8}};
 const results=[],gateReports=[];
 for(const [budgetIndex,budget] of budgets.entries()){
  const request={...r,budget,budgets:undefined};delete request.validationConfig;delete request.validationTunes;delete request.feasibility_only;
  const screened=exhaustiveAttachmentGate({...input,request},modules,preset);
  gateReports.push({budget,...screened.diagnostics});diagnostics.screening_elapsed_ms+=screened.diagnostics.elapsed_ms;
  const candidateConfigs=screened.candidates.map(c=>c.config),allowed=new Set(candidateConfigs.map(configKey));
  input.signal?.throwIfAborted();input.onProgress?.({phase:'calibration',budget,candidates:candidateConfigs.length,time_limit_seconds:limit/budgets.length});
  const calibrationStarted=performance.now(),budgetDeadline=calibrationStarted+limit*1000/budgets.length,deadline=budgetDeadline;
  const compiled=compileMounts({...input,request,candidateConfigs},kernel),numeric=compileStats(compiled,{pack,request},modules),objective=compileObjective(compiled,numeric,{pack,request},modules,preset.solverPlan),m=compiled.model;
  const better=comparator(settings.minimums),frontier=[];let incumbent=null,warm=null;
  function candidate(config,tunes={},strict=false){
   if(!allowed.has(configKey(config)))return null;
   const build=resolve(config);
   if(!retains(build)||config.some(c=>!build.config.some(x=>x.slotPath===c.slotPath&&x.itemId===c.itemId))||build.mounted.some(n=>hidden.has(n.itemId))||build.mounted.filter(n=>kernel.l(pack,n.itemId,mode)).length>laserLimit||emptyRisers(pack,build).length)return null;
   let cost=mode==='mp'?null:0;
   if(mode!=='mp')for(const n of build.mounted.filter(n=>n.source==='equipped')){const v=costs[n.itemId];if(!Number.isFinite(v)||v<0)return null;cost+=v;}
   if(budget!==null&&cost>budget+1e-8)return null;
   const clean={};for(const n of build.mounted)for(const id of pack.parts[n.itemId]?.tuneIds??[]){const c=curves.c(pack,n,id),v=tunes[n.slotPath]?.[id];if(c&&c.enabled!==false&&Number.isFinite(v)&&Math.abs(v-c.range.defaultValue)>1e-6&&curves.n(c).some(p=>Math.abs(p-v)<1e-6))(clean[n.slotPath]??={})[id]=v;}
   try{
    const state=kernel.u(pack,build,{mode,tacticalEffective:true,tunes:clean}),components=preset.raw(build,clean,state),score=preset.score(components),stats=Object.fromEntries(Object.entries(statIds).map(([key,id])=>[key,state.numeric.mainAttr[id]]));
    if(!Number.isFinite(score)||shortfall(stats,settings.minimums)>1e-8)return null;
    const objectives=preset.objectives?.(components)??[score],signature=JSON.stringify([build.mounted.map(n=>[n.slotPath,n.itemId]).sort(),Object.entries(clean).sort()]);
    const row={config:build.config,tunes:clean,build,components,score,stats,objectives,cost,signature};
    if(!incumbent||better(row,incumbent))incumbent=row;
    if(!frontier.some(c=>compareObjectives(c,row)<=0&&(c.cost??0)<=(row.cost??0))){for(let i=frontier.length-1;i>=0;i--)if(compareObjectives(row,frontier[i])<=0&&(row.cost??0)<=(frontier[i].cost??0))frontier.splice(i,1);frontier.push(row);}
    return row;
   }catch(error){if(strict)throw error;return null;}
  }
  for(const row of screened.candidates)candidate(row.config,{});
  if(r.config)candidate(r.config,r.tunes??{});
  for(const start of starts?.starts??[]){
   candidate(start.config,start.tunes);
   if(fixed.length){
    const merged=[...start.config.filter(c=>!fixed.some(f=>c.slotPath===f.slotPath||c.slotPath.startsWith(f.slotPath+'/'))),...fixed],build=resolve(merged);
    if(retains(build))for(const completed of completeRiserOptics(pack,build,resolve,fixed))candidate(completed.config,start.tunes);
   }
  }
  // A small feasibility MILP supplies a source-checked start when locks/floors
  // rule out the shipped starts. Calibration does not change main-stat points
  // in the current catalog; feasibility is restricted to screened combinations.
  if(!incumbent&&performance.now()<budgetDeadline-100){
   const feasibleInput={...input,request:{...request,feasibility_only:true}},feasible=compileMounts({...feasibleInput,candidateConfigs},kernel);compileStats(feasible,feasibleInput,modules);
   for(let attempt=0;attempt<4&&performance.now()<budgetDeadline-100;attempt++){
    const result=await solveLinearModel(feasible.model.cip(0),{createRuntime,seconds:Math.max(.05,Math.min(1,(budgetDeadline-performance.now())/1000))});diagnostics.solves++;
    if(result.errorCount)throw Error('SCIP feasibility runtime error: '+result.errors.join('; '));if(!result.hasIncumbent)break;
    const config=feasible.decode(result.values),row=candidate(config,{});if(row)break;
    const same=[...feasible.players.values()].map(p=>(result.values[p.value]??0)>.5?p.value:feasible.model.not(p.value));feasible.model.constrain(feasible.model.and(...same),'==',0,'reject_unscored_protocol');
   }
  }
  function decisionGuard(values){
   const selected=[];
   const grouped=new Map();for(const p of compiled.players.values()){if(!grouped.has(p.path))grouped.set(p.path,[]);grouped.get(p.path).push(p.value);}
   for(const flags of grouped.values()){const chosen=flags.find(f=>typeof f==='string'&&(values[f]??0)>.5);selected.push(chosen??m.not(m.or(...flags)));}
   for(const control of numeric.controls){const chosen=control.states.find(s=>(values[s.flag]??0)>.5);if(chosen)selected.push(chosen.flag);}
   return m.and(...selected);
  }
  function inspect(result){
   if(result.errorCount)throw Error('SCIP runtime error: '+result.errors.join('; '));
   if(!result.hasIncumbent)return null;
   const config=compiled.decode(result.values),tunes=numeric.decodeTunes(result.values),row=candidate(config,tunes,true);
   if(!row)throw Error('SCIP returned a build that failed source feasibility replay');
   const state=kernel.u(pack,row.build,{mode,tacticalEffective:true,tunes:row.tunes});
   for(const [id,name] of Object.entries(numeric.stats))if(Math.abs((result.values[name]??0)-state.numeric.mainAttr[id])>1e-7)throw Error('SCIP main-stat/source mismatch');
   for(const [target,name] of Object.entries(numeric.targets)){
    const want=r.firing==='spam'&&/^GRecoil_[HV]$/.test(target)?kernel.j(state.numeric.buckets,target,target+'_singleorburst',1):state.value(target);
    if(Math.abs((result.values[name]??0)-want)>1e-7*Math.max(1,Math.abs(want)))throw Error('SCIP target/source mismatch: '+target);
   }
   let cuts=0;
   if(objective.chart.points.length){
    const path=timedRecoil(pack,row.build,row.tunes,{...r,shot_count:20},modules,{abstractProfile:true});if(path.status!=='modeled')throw Error('SCIP firing protocol/source mismatch');
    const wrong=objective.chart.points.flatMap((point,i)=>['x','y'].flatMap(axis=>{const value=Math.round(path.points[i][axis]*100000);return Math.abs((result.values[point[axis]]??0)-value)>.1?[{name:point[axis],value}]:[];}));
    if(wrong.length){const guard=decisionGuard(result.values);for(const {name,value} of wrong){const bounds=m.variables.get(name),bigM=Math.max(Math.abs(bounds.lower-value),Math.abs(bounds.upper-value));m.constrain(m.add(name,m.scale(guard,bigM)),'<=',value+bigM,'source_round_upper');m.constrain(m.add(name,m.scale(guard,-bigM)),'>=',value-bigM,'source_round_lower');}diagnostics.rounding_cuts+=wrong.length;cuts+=wrong.length;}
   }
   for(const norm of objective.norms){const x=objective.evaluateExpression(norm.x,result.values),y=objective.evaluateExpression(norm.y,result.values),length=Math.hypot(x,y),value=result.values[norm.value]??0;if(length-value>1e-9*Math.max(1,length)){objective.addNormCut(norm,x/length,y/length);cuts++;diagnostics.norm_cuts++;}}
   warm={...result.values};for(const norm of objective.norms)warm[norm.value]=Math.hypot(objective.evaluateExpression(norm.x,warm),objective.evaluateExpression(norm.y,warm));
   return {row,cuts};
  }
  // A start is just an incumbent. Fix its decisions for one feasibility solve to
  // populate auxiliary variables, then remove those fixes before optimization.
  async function repairStart(row,freeTunes=false){
   if(!row||performance.now()>budgetDeadline-100)return;
   const count=m.constraints.length,chosen=new Map(row.config.map(c=>[c.slotPath,c.itemId]));
   for(const p of compiled.players.values())m.constrain(p.value,'==',chosen.get(p.path)===p.item?1:0,'start_request');
   if(!freeTunes)for(const c of numeric.controls){const mounted=row.build.mounted.find(n=>n.slotPath===c.node.path&&n.itemId===c.node.item&&n.hostItemId===c.node.host);const value=row.tunes[c.node.path]?.[c.id]??c.defaultValue;for(const s of c.states)m.constrain(s.flag,'==',mounted&&s.value===value?1:0,'start_tune');}
   if(!freeTunes&&objective.chart.points.length){const path=timedRecoil(pack,row.build,row.tunes,{...r,shot_count:20},modules,{abstractProfile:true});for(const [i,p] of objective.chart.points.entries())for(const axis of ['x','y'])m.constrain(p[axis],'==',Math.round(path.points[i][axis]*100000),'start_chart');}
   const remaining=(budgetDeadline-performance.now())/1000;
   const start=await solveLinearModel(m.cip(objective.primary),{createRuntime,seconds:Math.max(.1,Math.min(freeTunes?1:2,freeTunes?remaining*.2:remaining)),startValues:freeTunes?warm:null});diagnostics.solves++;
   m.constraints.length=count;if(start.errorCount)throw Error('SCIP runtime error: '+start.errors.join('; '));if(start.hasIncumbent)inspect(start);
  }
  await repairStart(incumbent);
  if(incumbent&&!Object.keys(incumbent.tunes).length&&numeric.controls.some(c=>incumbent.build.mounted.some(n=>n.slotPath===c.node.path&&n.itemId===c.node.item)))await repairStart(incumbent,true);
  async function phase(label,goal,until,accept=()=>true){
   let last=null,matched=false,pending=0;
   for(let iteration=0;iteration<32&&performance.now()<Math.min(until,budgetDeadline,deadline)-50;iteration++){
    const seconds=Math.max(.05,(Math.min(until,budgetDeadline,deadline)-performance.now())/1000);
    if(warm){
     const evaluated=new Map();
     const value=name=>{if(evaluated.has(name))return evaluated.get(name);const node=m.booleanNodes.get(name);let v;if(node?.kind==='not')v=1-value(node.args[0]);else if(node?.kind==='and')v=node.args.every(x=>value(x)>.5)?1:0;else if(node?.kind==='or')v=node.args.some(x=>value(x)>.5)?1:0;else v=warm[name]??0;evaluated.set(name,v);return v;};
     for(const [name,variable] of m.variables)if(variable.type==='binary')warm[name]=value(name);
     for(const norm of objective.norms)warm[norm.value]=Math.hypot(objective.evaluateExpression(norm.x,warm),objective.evaluateExpression(norm.y,warm));
    }
    const result=await solveLinearModel(m.cip(goal),{createRuntime,seconds,startValues:warm});diagnostics.solves++;last=result;
    const checked=inspect(result);
    pending=checked?.cuts??0;matched=!!checked&&!pending&&accept(checked.row);
    if(matched&&result.status==='optimal')break;
    if(!checked||!checked.cuts&&result.status!=='optimal')break;
   }
   const record={label,budget,scope:'screened_calibration_model',status:pending?'limited':last?.status??'not_run',termination:pending?'supporting-cut refinement time limit':last?.status??'not_run',primal_bound:last?.primalBound??null,dual_bound:last?.dualBound??null,gap_percent:matched?last?.gapPercent??null:null,source_verified:matched};diagnostics.phases.push(record);return record;
  }
  if(!incumbent)await phase('Feasibility',0,performance.now()+Math.max(0,(budgetDeadline-performance.now())*.15));
  const remaining=budgetDeadline-performance.now(),primaryEnd=performance.now()+Math.max(0,remaining*.6);
  const primaryStatus=await phase('Max primary',objective.primary,primaryEnd);
  if(incumbent){
   const temporary=[];const fix=(expression,bound,label)=>{m.constrain(expression,'<=',bound,label);temporary.push(m.constraints.at(-1));};
   fix(objective.primary,incumbent.objectives[0]+1e-8,'fix_primary');
   if(preset.objectives?.(incumbent.components).length>1){await phase('Max handling',objective.handling,performance.now()+Math.max(0,(budgetDeadline-performance.now())*.12));fix(objective.handling,incumbent.objectives[1]+1e-8,'fix_handling');}
   if(mode!=='mp')await phase('Max cost',compiled.cost,performance.now()+Math.max(0,(budgetDeadline-performance.now())*.1));
   m.constraints=m.constraints.filter(c=>!temporary.includes(c));
  }
  // Price categories optimize over the same screened calibration domain.
  if(mode!=='mp'&&budgets.length===1&&incumbent&&incumbent.score<100-1e-8){
   const gates=settings.automatic?[cheapestGate]:settings.targets;
   for(const target of gates){
    const limitScore=100-(100-incumbent.score)*target/100;
    m.constrain(objective.primary,'<=',limitScore,'price_improvement_floor');const gate=m.constraints.at(-1);
    const cheap=frontier.filter(row=>row.score<=limitScore+1e-8).reduce((a,b)=>!a||b.cost<a.cost?b:a,null);
    await repairStart(cheap);
    const end=settings.automatic?performance.now()+Math.max(0,(budgetDeadline-performance.now())*.55):budgetDeadline;
    await phase(target+'% minimum cost',compiled.cost,end,row=>row.score<=limitScore+1e-7);
    m.constraints=m.constraints.filter(c=>c!==gate);
   }
   if(settings.automatic){
    const selected=selectCategories(frontier);
    if(selected?.cheapest&&selected.strongest.cost>selected.cheapest.cost+1&&selected.cheapest.score>selected.strongest.score+1e-8){
     const low=selected.cheapest,high=selected.strongest,temporary=[];
     const add=(expression,sense,bound,label)=>{m.constrain(expression,sense,bound,label);temporary.push(m.constraints.at(-1));};
     const limitScore=100-(100-high.score)*cheapestGate/100;
     add(objective.primary,'<=',limitScore,'balanced_floor');add(compiled.cost,'>=',low.cost+1,'balanced_min_cost');add(compiled.cost,'<=',high.cost-1,'balanced_max_cost');
     const costSpan=high.cost-low.cost,scoreSpan=low.score-high.score;
     const knee=m.add(m.scale(objective.primary,1/scoreSpan),m.scale(compiled.cost,1/costSpan));
     if(selected.value)await repairStart(selected.value);
     const kneeStatus=await phase('Balanced knee',knee,performance.now()+Math.max(0,(budgetDeadline-performance.now())*.7),row=>row.score<=limitScore+1e-7);
     const winner=selectCategories(frontier)?.value;
     if(winner&&kneeStatus.status==='optimal'&&performance.now()<budgetDeadline-50){
      add(knee,'<=',winner.score/scoreSpan+winner.cost/costSpan+1e-9,'fix_balanced_knee');
      const ideal=objective.addNorm(m.scale(m.add(compiled.cost,-low.cost),1/costSpan),m.scale(m.add(objective.primary,-high.score),1/scoreSpan),'balanced_ideal');
      await phase('Balanced ideal tie',ideal,budgetDeadline,row=>row.score<=limitScore+1e-7);
     }
     m.constraints=m.constraints.filter(c=>!temporary.includes(c));
    }
   }
  }
  diagnostics.calibration_elapsed_ms+=performance.now()-calibrationStarted;
  const strongest=incumbent;
  diagnostics.variables=m.variables.size;diagnostics.constraints=m.constraints.length;
  const publish=(row,label,target=null)=>{
   if(!row){results.push({label,budget,status:'infeasible',reason:'No feasible screened build found within the calibration time limit.'});return;}
   const path=timedRecoil(pack,row.build,row.tunes,r,modules),{build,...rest}=row;
   results.push({...rest,label,budget,status:'best_found',loss:row.score,score:100-row.score,improvement_percent:100-row.score,effectiveness_percent:strongest&&100-strongest.score>1e-8?100*(100-row.score)/(100-strongest.score):100,target_effectiveness_percent:target,category_note:null,mounted:build.mounted,recoil_path:path,converged:primaryStatus.status==='optimal'&&primaryStatus.source_verified});
  };
  if(budgets.length!==1){publish(strongest,['Min','Balanced','Max'][budgetIndex]);continue;}
  if(!settings.automatic){
   publish(strongest,'Max');
   for(const target of settings.targets){const threshold=strongest?100-(100-strongest.score)*target/100:null;const eligible=strongest?frontier.filter(row=>row.score<=threshold+1e-8):[];const chosen=eligible.reduce((a,b)=>!a||b.cost<a.cost||b.cost===a.cost&&better(b,a)?b:a,null);publish(chosen,target===70?'cheapest':target===90?'mid-range':target+'% effective',target);}
   continue;
  }
  if(mode==='mp'||!strongest){publish(strongest,'Max');for(const label of ['Balanced','Min'])results.push({label,budget,status:strongest?'unavailable':'infeasible',reason:strongest?'Cost is unavailable in Warfare; no distinct price-based alternative can be selected.':'No feasible screened build found within the calibration time limit.'});continue;}
  const selected=selectCategories(frontier);publish(selected.strongest,'Max');
  for(const [key,label] of [['value','Balanced'],['cheapest','Min']])if(selected[key])publish(selected[key],label,cheapestGate);else results.push({label,budget,status:'unavailable',reason:'No distinct feasible price-based alternative found.'});
 }
 diagnostics.elapsed_ms=performance.now()-started;
 if(settings.automatic)results.sort((a,b)=>['Max','Balanced','Min'].indexOf(a.label)-['Max','Balanced','Min'].indexOf(b.label));
 if(settings.automatic){const seen=new Set();for(let i=0;i<results.length;i++)if(results[i].status==='best_found'){if(seen.has(results[i].signature))results[i]={label:results[i].label,budget:results[i].budget,status:'unavailable',reason:'No distinct price-based alternative found.'};else seen.add(results[i].signature);}}
 return {weapon_id:pack.weaponId,mode,preset:settings.preset,output_standard:settings.automatic?'max_balanced_min':'custom_targets',recoil_context:'ads',selection:settings.automatic?(preset.solverPlan.kind==='agility'?'weighted':'lexicographic'):'custom_targets',objective_names:preset.objectiveNames,minimum_stats:settings.minimums,baseline:preset.baseline,baseline_stats:baselineStats,baseline_recoil_path:baselinePath,baseline_score:0,baseline_loss:100,score_direction:'higher',weights:preset.weights,tier,cheapest_gate_percent:mode==='mp'?null:cheapestGate,experimental:true,method:'Exhaustive attachment top-5%, exhaustive tactical top-5% per survivor, then SCIP calibration',score_model:presets[settings.preset].description,limitations:[...preset.limitations,'Both attachment screens exhaust all legal combinations at default calibration. SCIP calibrates only the survivors; screening can discard the best calibrated build. The time limit applies after exhaustive screening. Model bounds apply only to the screened calibration domain; results remain best found.'],attachment_gate:{fraction:.05,complete:true,screening:'exhaustive_default_calibration',budgets:gateReports,global_optimality:false},solver:diagnostics,provenance:input.provenance,results};
}
