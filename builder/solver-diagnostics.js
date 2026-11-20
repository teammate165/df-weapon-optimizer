import {createStaticClient,searchWorkerCount} from './static-client.js';

export const fixture=Object.freeze({weapon_id:'18010000001',mode:'bd',preset:'recoil',shot_count:20,fixed:[{slotPath:'11',itemId:'13110000091'}]});
const $=id=>document.getElementById(id),count=n=>Math.round(n??0).toLocaleString();
const totals=result=>{
 const reports=result.solver.parallel.worker_reports.flat();
 return Object.fromEntries(['evaluated','evaluation_attempts','cache_hits','invalid','source_errors','tree_nodes','pruned_branches','calibration_evaluations','tactical_evaluated'].map(key=>[key,reports.reduce((n,r)=>n+(r[key]??0),0)]));
};
export function bestRow(result){return result.results.find(r=>r.status==='best_found'&&r.label==='Max');}
export function betterRow(a,b){
 if(!a)return false;if(!b)return true;
 const x=a.objectives??[a.loss],y=b.objectives??[b.loss];
 for(let i=0;i<Math.max(x.length,y.length);i++){if(x[i]<y[i])return true;if(x[i]>y[i])return false;}
 return false;
}
export async function verifyResult(client,result){
 const rows=result.results.filter(r=>r.status==='best_found');
 if(!rows.length)throw Error('No feasible result returned');
 for(const row of rows){
  if(!row.config.some(c=>c.slotPath==='11'&&c.itemId==='13110000091'))throw Error('Insight lock lost');
  const replay=await client('evaluate',{...fixture,config:row.config,tunes:row.tunes});
  if(row.cost!==replay.cost||Object.keys(row.stats).some(k=>row.stats[k]!==replay.effective_stats[k])||row.cost>800)throw Error('Source replay mismatch');
 }
 return {passed:true,rows:rows.length};
}
export async function runTrial(workerCount,seconds,{onProgress,request={},signal}={}){
 const client=createStaticClient({workerCount}),events=[];let last=-Infinity,firstFeasible=null;
 const started=performance.now();
 try{
  const result=await client('optimize',{...fixture,...request,time_limit_seconds:seconds},{signal,onProgress:p=>{
   const elapsed=performance.now()-started;
   if(firstFeasible===null&&p.candidates>0)firstFeasible=elapsed;
   if(elapsed-last>=250){events.push({...p,observed_ms:elapsed});if(seconds===0&&events.length>240)events.shift();last=elapsed;}
   onProgress?.(p);
  }});
  const wall_ms=performance.now()-started,validation=await verifyResult(client,result),work=totals(result);
  return {workers:workerCount,seconds,wall_ms,first_feasible_observed_ms:firstFeasible,...work,throughput:work.evaluated/(wall_ms/1000),compute_throughput:work.evaluated/(result.solver.parallel.compute_wall_ms/1000),best_loss:bestRow(result)?.loss,events,result,validation};
 }finally{await client('dispose');}
}
function draw(id,points,title,color){
 const canvas=$(id),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#c4d4e1';ctx.font='15px system-ui';ctx.fillText(title,18,25);
 if(!points.length)return;
 const xmax=Math.max(1,...points.map(p=>p[0])),lo=Math.min(...points.map(p=>p[1])),hi=Math.max(...points.map(p=>p[1])),span=Math.max(hi-lo,.001),ymin=lo-span*.1,ymax=hi+span*.1;
 ctx.strokeStyle='#425160';ctx.beginPath();ctx.moveTo(80,45);ctx.lineTo(80,h-35);ctx.lineTo(w-20,h-35);ctx.stroke();ctx.fillText(ymax.toFixed(2),8,57);ctx.fillText(ymin.toFixed(2),8,h-35);ctx.fillText('0 s',80,h-12);ctx.fillText(`${xmax.toFixed(0)} s`,w-75,h-12);
 ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();points.forEach(([x,y],i)=>{const px=80+x/xmax*(w-105),py=45+(ymax-y)/(ymax-ymin)*(h-80);if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);});ctx.stroke();
}
let controller=null;
export const study={schema:1,fixture,environment:{hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,userAgent:navigator.userAgent},rounds:[],samples:[],best:null,status:'ready'};
globalThis.solverStudy=study;
$('workers').value=searchWorkerCount();
export async function startContinuous({workers=Number($('workers').value),seconds=Number($('round').value),initial=null,maxRounds=Infinity}={}){
 if(controller)throw Error('Already running');
 controller=new AbortController();$('start').disabled=true;$('stop').disabled=false;$('workers').value=workers;$('round').value=seconds;
 Object.assign(study,{started_at:new Date().toISOString(),workers,round_seconds:seconds,mode:seconds===0?'single_unlimited':'timed_rounds',status:'running',best:initial});
 if(seconds===0)maxRounds=1;
 $('rounds').textContent='Running';
 const started=performance.now();let scored=0;
 try{
  for(let round=0;round<maxRounds;round++){
   controller.signal.throwIfAborted();let sampled=-Infinity;
   const request={search_variant_offset:round*workers,config:study.best?.config??fixture.fixed,tunes:study.best?.tunes??{}};
   const run=await runTrial(workers,seconds,{signal:controller.signal,request,onProgress:p=>{
    const elapsed=(performance.now()-started)/1000,total=scored+p.evaluated;
    $('wall').textContent=`${elapsed.toFixed(1)} s`;$('scored').textContent=count(total);$('rate').textContent=`${count(total/Math.max(.001,elapsed))} / s`;
    $('status').textContent=seconds===0?`Single unlimited solve with ${p.workers} workers. No phase deadlines, no timed rounds, no automatic restarts. Current phase: ${p.phase}.`:`Running round ${round+1} with ${p.workers} workers. No overall deadline. Completed checkpoints remain saved when stopped.`;
    $('details').textContent=`Current solve: ${count(p.tree_nodes)} tree nodes; ${count(p.pruned_branches)} pruned; ${count(p.cache_hits)} cache hits; ${count(p.invalid)} rejected; ${count(p.source_errors)} source errors. Reported complete-pool loss: ${p.best_loss??'pending'}.`;
    $('worker-rows').replaceChildren(...(p.worker_progress??[]).map(row=>{const tr=document.createElement('tr');for(const value of [row.worker,row.phase,count(row.evaluated),count(row.tree_nodes),count(row.pruned_branches),count(row.calibration_evaluations),row.best_complete_loss?.toFixed(4)??'pending']){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));
    if(seconds===0&&p.best_loss!=null)$('loss').textContent=Number(p.best_loss).toFixed(4);
    if(elapsed-sampled>=1){sampled=elapsed;study.samples.push({wall_seconds:elapsed,evaluated:total,round:round+1,progress:p});if(seconds===0&&study.samples.length>7200)study.samples.shift();draw('throughput',study.samples.map(s=>[s.wall_seconds,s.evaluated]),'Cumulative scored evaluations (overlap included)','#72d5bf');if(seconds===0)globalThis.recordSolverProgress?.({started_at:study.started_at,mode:study.mode,workers,status:study.status,wall_seconds:elapsed,progress:p});}
   }});
   scored+=run.evaluated;const row=bestRow(run.result);if(betterRow(row,study.best))study.best=row;
   const checkpoint={...run,round:round+1,wall_seconds:(performance.now()-started)/1000,cumulative_evaluated:scored,best_saved_loss:study.best.loss};study.rounds.push(checkpoint);
   $('rounds').textContent=seconds===0?'Finished':study.rounds.length;$('loss').textContent=study.best.loss.toFixed(4);$('best').textContent=JSON.stringify(study.best,null,2);
   draw('quality',study.rounds.map(r=>[r.wall_seconds,r.best_saved_loss]),'Best source-verified checkpoint loss (lower is better)','#e9b56d');
   globalThis.dispatchEvent(new CustomEvent('solver-checkpoint',{detail:checkpoint}));
   await globalThis.recordSolverCheckpoint?.(JSON.parse(JSON.stringify(study)));
  }
  study.status='completed';
 }catch(error){study.status=error.name==='AbortError'?'stopped':'error';study.error=error.name==='AbortError'?null:error.message;if(study.status==='error')throw error;}
 finally{controller=null;$('start').disabled=false;$('stop').disabled=true;$('rounds').textContent=study.status; $('status').textContent=seconds===0?`Single unlimited solve ${study.status}. Progress measurements retained. Cancellation does not produce a finished result.`:`${study.status}. ${study.rounds.length} completed checkpoints preserved. The last partial round is excluded from completed-round totals.`;}
 return study;
}
$('start').onclick=()=>startContinuous().catch(e=>{$('status').textContent=e.message;});
$('stop').onclick=()=>controller?.abort();
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(study,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='m4a1-insight-solver-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
