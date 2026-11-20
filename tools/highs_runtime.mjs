// Experimental browser-compatible adapter for the SAME linear models emitted
// to SCIP. No screening policy or native scoring code is changed here.
export function createHighsAdapter(loadRuntime){
 let runtime,model,source,variablesKey,rowPrefix=[],names=[],index;
 let builds=0,appendedRows=0;
 const bounds=row=>[row.sense==='<='?-Infinity:row.bound,row.sense==='>='?Infinity:row.bound];
 const safe=fn=>{try{const value=fn();return Number.isFinite(value)?value:null;}catch{return null;}};
 return {
  async solve(linear,goal,{seconds=1}={}){
   const began=performance.now();runtime??=await loadRuntime();
   const vars=[...linear.variables.values()],key=JSON.stringify(vars.map(v=>[v.name,v.lower,v.upper,v.type])),objective=linear.expression(goal);
   if(objective.constant!==0)throw Error('Benchmark adapter requires a zero objective offset, matching CIP export');
   const rebuild=!model||source!==linear||key!==variablesKey||linear.constraints.length<rowPrefix.length||rowPrefix.some((row,i)=>linear.constraints[i]!==row);
   names=vars.map(v=>v.name);index=new Map(names.map((name,i)=>[name,i]));
   const costs=names.map(name=>objective.terms.get(name)??0);
   if(rebuild){
    model?.dispose();const columns=names.map(()=>[]),rowLower=[],rowUpper=[];
    linear.constraints.forEach((row,i)=>{const [lo,hi]=bounds(row);rowLower.push(lo);rowUpper.push(hi);for(const [name,value]of row.expression.terms)columns[index.get(name)].push([i,value]);});
    const starts=[0],indices=[],values=[];for(const column of columns){for(const [row,value]of column){indices.push(row);values.push(value);}starts.push(indices.length);}
    model=runtime.createModel({modelName:'df-calibration-benchmark',numCols:vars.length,numRows:linear.constraints.length,sense:runtime.constants.objectiveSense.minimize,colCost:costs,colLower:vars.map(v=>v.lower),colUpper:vars.map(v=>v.upper),integrality:vars.map(v=>v.type==='continuous'?runtime.constants.variableType.continuous:runtime.constants.variableType.integer),matrix:{format:'csc',numRows:linear.constraints.length,numCols:vars.length,starts,indices,values},rowLower,rowUpper,colNames:names,rowNames:linear.constraints.map(r=>r.name)});
    source=linear;variablesKey=key;rowPrefix=[...linear.constraints];builds++;
   }else{
    model.changeColsCost({kind:'range',from:0,to:names.length-1},costs);
    for(const row of linear.constraints.slice(rowPrefix.length)){const [lo,hi]=bounds(row),entries=[...row.expression.terms];model.addRow(lo,hi,{indices:entries.map(([name])=>index.get(name)),values:entries.map(([,value])=>value)});appendedRows++;}
    rowPrefix=[...linear.constraints];
   }
   model.options.set({output_flag:false,time_limit:seconds,mip_rel_gap:0,mip_abs_gap:0,mip_feasibility_tolerance:1e-9,primal_feasibility_tolerance:1e-9,dual_feasibility_tolerance:1e-9,random_seed:1});
   model.zeroAllClocks();const prepared=performance.now(),result=model.run(),ended=performance.now(),statusCode=result.modelStatus,statuses=runtime.constants.modelStatus;
   const feasible=model.info.get('primal_solution_status')===runtime.constants.solutionStatus.feasible,solution=feasible?model.getSolution():null;
   const status=statusCode===statuses.optimal?'optimal':statusCode===statuses.infeasible?'infeasible':[statuses.loadError,statuses.modelError,statuses.presolveError,statuses.solveError,statuses.postsolveError].includes(statusCode)?'runtime_error':'limited';
   return {status,hasIncumbent:feasible,values:solution?Object.fromEntries(names.map((name,i)=>[name,solution.colValue[i]])):{},primalBound:feasible?safe(()=>model.getObjectiveValue()):null,dualBound:safe(()=>model.info.get('mip_dual_bound')),gapPercent:safe(()=>100*model.info.get('mip_gap')),elapsed_ms:ended-began,prepare_ms:prepared-began,solve_ms:ended-prepared,errorCount:status==='runtime_error'?1:0,errors:status==='runtime_error'?['HiGHS status '+statusCode]:[],version:runtime.version,adapter:{builds,appended_rows:appendedRows}};
  },
  dispose(){model?.dispose();model=null;source=null;rowPrefix=[];}
 };
}
