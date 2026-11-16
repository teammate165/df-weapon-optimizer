// CLI-only SCIP adapter. Every emitted model is linear; nonlinear runtime
// warnings/errors invalidate a solve instead of being suppressed.
export async function solveLinearModel(cip,{createRuntime,seconds=15,startValues=null}={}){
 if(typeof createRuntime!=='function')throw Error('A pinned SCIP runtime factory is required');
 const lines=[],start=performance.now();
 const runtime=await createRuntime({noInitialRun:true,print:s=>lines.push(String(s)),printErr:s=>lines.push(String(s))});
 runtime.FS.writeFile('/model.cip',cip);
 const commands=['-c',`set limits time ${Math.max(.01,seconds)}`,'-c','set limits gap 0','-c','set limits absgap 0','-c','set numerics feastol 1e-9','-c','read /model.cip'];
 if(startValues){runtime.FS.writeFile('/start.sol','solution status: feasible solution\nobjective value: 0\n'+Object.entries(startValues).filter(([,value])=>Number.isFinite(value)&&Math.abs(value)>1e-16).map(([name,value])=>name+' '+value).join('\n')+'\n');commands.push('-c','read /start.sol');}
 commands.push('-c','optimize','-c','display statistics','-c','write solution /solution.sol','-c','quit');runtime.callMain(commands);
 const log=lines.join('\n'),errors=lines.filter(s=>/ERROR:|interval arithmetic is invalid/i.test(s));
 let solution='';try{solution=runtime.FS.readFile('/solution.sol',{encoding:'utf8'});}catch{}
 const values=Object.fromEntries([...solution.matchAll(/^([A-Za-z_][\w]*)\s+([+\-0-9.eE]+)/gm)].map(m=>[m[1],Number(m[2])]));
 const number=label=>{const all=[...log.matchAll(new RegExp(label+'\\s*:\\s*([+\\-0-9.eE]+)','g'))];return all.length?Number(all.at(-1)[1]):null;};
 const optimal=/SCIP Status\s*:\s*problem is solved \[optimal solution found\]/.test(log),infeasible=/SCIP Status\s*:\s*problem is solved \[infeasible\]/.test(log);
 return {status:errors.length?'runtime_error':optimal?'optimal':infeasible?'infeasible':'limited',hasIncumbent:/objective value\s*:/i.test(solution),values,primalBound:number('Primal Bound'),dualBound:number('Dual Bound'),gapPercent:number('Gap'),elapsed_ms:performance.now()-start,errorCount:errors.length,errors:[...new Set(errors)],log,solution};
}
