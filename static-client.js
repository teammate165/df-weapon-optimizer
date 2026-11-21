import {exactBetaEligible, runExactBeta} from './exact-beta-client.js?v=0b4a96d6446ec67a';

﻿// Dedicated module workers require only ordinary static hosting and messages.
export function searchWorkerCount({hardwareConcurrency=globalThis.navigator?.hardwareConcurrency,deviceMemory=globalThis.navigator?.deviceMemory}={}){
 const cores=Number.isFinite(hardwareConcurrency)?Math.max(1,Math.floor(hardwareConcurrency)):2;
 return Math.max(1,Math.min(Number.isFinite(deviceMemory)&&deviceMemory<=4?2:8,cores-1));
}
export function createStaticClient({workerCount=searchWorkerCount(),
 exactBeta=new URLSearchParams(globalThis.location?.search).get('exact-beta')==='1',
 exactOrdinary=['1','staged'].includes(new URLSearchParams(globalThis.location?.search).get('exact-ordinary'))}={}) {
 const count=Math.max(1,Math.min(8,Math.floor(workerCount)||1)),pending=new Map(),workers=new Set();
 let serial=0,primary,optimizing=false,exactSearch;
 const abortError=()=>new DOMException('Search cancelled.','AbortError');
 const retire=(worker,error)=>{
  for(const [id,task]of pending)if(task.worker===worker){pending.delete(id);task.reject(error);}
  worker.terminate();workers.delete(worker);if(primary===worker)primary=null;
 };
 const spawn=()=>{
  const worker=new Worker(new URL('./static-worker.js?v=0b4a96d6446ec67a',import.meta.url),{type:'module'});workers.add(worker);
  worker.onmessage=({data})=>{
   const task=pending.get(data.id);if(!task||task.worker!==worker)return;
   if(data.progress){task.onProgress?.(data.progress);return;}
   pending.delete(data.id);if(data.error)task.reject(new Error(data.error));else task.resolve(data.result);
  };
  const fail=event=>{
   const error=new Error(event.message||'Calculation worker failed. Try again.');
   retire(worker,error);
  };
  worker.onerror=fail;worker.onmessageerror=fail;return worker;
 };
 const main=()=>primary??=spawn();
 const send=(worker,action,request,{onProgress,...extra}={})=>new Promise((resolve,reject)=>{
  const id=++serial;pending.set(id,{worker,resolve,reject,onProgress});
  try{worker.postMessage({id,action,request,...extra});}catch(error){pending.delete(id);reject(error);}
 });
 const abort=()=>{
  for(const worker of workers)worker.terminate();workers.clear();primary=null;
  for(const task of pending.values())task.reject(abortError());pending.clear();
 };
 const optimize=async(request,{signal,onProgress})=>{
  if(optimizing)throw Error('A search is already running.');
  if(request.search_method==='coordinate_passes'){
   optimizing=true;
   try{return await send(main(),'optimize',request,{onProgress});}
   finally{optimizing=false;}
  }
  optimizing=true;const pool=[],started=performance.now();
  try{
   pool.push(main());for(let i=1;i<count;i++){try{pool.push(spawn());}catch{break;}}
   const prepared=await Promise.allSettled(pool.map(worker=>send(worker,'prepare-search',request)));
   signal?.throwIfAborted();const ready=pool.filter((_,i)=>prepared[i].status==='fulfilled');
   if(!ready.length)throw prepared[0].reason;
   const preparedAt=performance.now();
   const seconds=request.time_limit_seconds??(request.passes===undefined?30:Math.max(1,2*request.passes)),deadline=seconds===0?undefined:Date.now()+seconds*1000,latest=new Map();
   const progress=(index,p)=>{
    latest.set(index,p);const lead=latest.get(0)??p,events=[...latest.values()],sum=key=>events.reduce((n,e)=>n+(e[key]??0),0);
    const elapsed=performance.now()-started,losses=events.map(e=>e.best_complete_loss).filter(Number.isFinite);
    onProgress?.({...lead,...Object.fromEntries(['evaluated','ordinary_retained','candidates','tree_nodes','pruned_branches','invalid','source_errors','calibration_evaluations','evaluation_attempts','cache_hits'].map(key=>[key,sum(key)])),best_loss:losses.length?Math.min(...losses):null,workers:ready.length,elapsed_ms:elapsed,scored_per_second:sum('evaluated')/Math.max(.001,elapsed/1000),worker_progress:[...latest].map(([worker,p])=>({worker,...p}))});
   };
   const offset=Number.isInteger(request.search_variant_offset)&&request.search_variant_offset>=0?request.search_variant_offset:0;
   const settled=await Promise.allSettled(ready.map((worker,variant)=>send(worker,'optimize',request,{search:{variant:variant+offset,deadline,collect:true},onProgress:p=>progress(variant,p)})));
   signal?.throwIfAborted();const outputs=settled.filter(r=>r.status==='fulfilled').map(r=>r.value);
   if(!outputs.length)throw settled[0].reason;
   const computeEnded=performance.now();
   const result=await send(main(),'merge-search',request,{outputs});
   result.solver.elapsed_ms=performance.now()-started;
   Object.assign(result.solver.parallel,{requested_workers:count,failed_workers:count-outputs.length,compute_budget_seconds:seconds,prepare_ms:preparedAt-started,compute_wall_ms:computeEnded-preparedAt,merge_ms:performance.now()-computeEnded,worker_reports:outputs.map(o=>o.attachment_gate.budgets)});
   return result;
  }finally{
   for(const worker of pool)if(worker!==primary){worker.terminate();workers.delete(worker);}
   optimizing=false;
  }
 };
 const optimizeOrdinary=async(request,{signal,onProgress})=>{
  if(optimizing)throw Error('A search is already running.');
  optimizing=true;
  const pool=[],started=performance.now();
  const duration=(request.time_limit_seconds??30)*1000,end=Date.now()+duration;
  const deadline=end-Math.min(1500,Math.floor(duration/10));
  let timer;
  try{
   const workerCount=Math.min(4,count);
   const plan=await send(main(),'exact-ordinary-plan',request,{workerCount});
   signal?.throwIfAborted();
   const staged=request.search_method==='exact_ordinary_staged';
   const byPartition=new Map();
   const runPass=async phase=>{
   if(phase&&Date.now()>=deadline)return [];
   const latest=new Map(),outputs=[];
   const jobs=plan.map(partition=>Promise.resolve().then(()=>{
    let worker=byPartition.get(partition.id);
    if(!workers.has(worker)){
     worker=spawn();
     pool.push(worker);
     byPartition.set(partition.id,worker);
    }
    return send(worker,'exact-ordinary-shard',request,{partition,deadline,phase,onProgress:p=>{
     latest.set(partition.id,p);
     const events=[...latest.values()];
     const totals=Object.fromEntries(['evaluated','tree_nodes','pruned_branches','calibration_evaluations'].map(key=>
      [key,events.reduce((sum,event)=>sum+(event[key]??0),0)]));
     onProgress?.({...p,...totals,workers:pool.length,elapsed_ms:performance.now()-started});
    }});
   }).then(result=>outputs.push(result)));
   const settled=await Promise.race([Promise.allSettled(jobs),new Promise(resolve=>{
    timer=setTimeout(()=>resolve(null),Math.max(0,end-Date.now()));
   })]);
   clearTimeout(timer);
   signal?.throwIfAborted();
   if(settled&&!outputs.length&&(!phase||phase.kind==='maximum'))throw settled[0]?.reason??Error('Exact ordinary search had no partitions.');
   if(!settled)for(const worker of pool)if(workers.has(worker))retire(worker,Error('Exact ordinary worker reached its deadline.'));
   return outputs;
   };
   let result;
   if(staged){
    const reports=[];
    let next=await send(main(),'exact-ordinary-advance',request,{plan,reports});
    while(next.phase){
     reports.push(await runPass(next.phase));
     next=await send(main(),'exact-ordinary-advance',request,{plan,reports});
    }
    result=next.result;
   }else{
    const outputs=await runPass();
    result=await send(main(),'exact-ordinary-merge',request,{plan,outputs});
   }
   result.solver.elapsed_ms=performance.now()-started;
   return result;
  }finally{
   clearTimeout(timer);
   for(const worker of pool)if(workers.has(worker))retire(worker,abortError());
   optimizing=false;
  }
 };
 const client=async(action,request,{signal,onProgress}={})=>{
  let fallbackDeadline;
  if(action==='dispose'){exactSearch?.abort();abort();return;}
  if(action==='optimize'&&exactSearch)throw Error('A search is already running.');
  const sharedExact=action==='optimize'&&exactOrdinary&&['exact_ordinary','exact_ordinary_staged'].includes(request.search_method);
  if(action==='optimize'&&!sharedExact&&request.search_method!=='coordinate_passes'&&exactBeta&&request.time_limit_seconds===300){
   fallbackDeadline=performance.now()+300000;
   if(exactBetaEligible(request)){
    if(optimizing)throw Error('A search is already running.');
    const run=new AbortController();
    exactSearch=run;
    const cancel=()=>run.abort(signal.reason);
    signal?.addEventListener('abort',cancel,{once:true});
    if(signal?.aborted)cancel();
    const stopReplay=()=>abort();
    run.signal.addEventListener('abort',stopReplay,{once:true});
    try{
     return await runExactBeta(async(payload,replaySignal)=>{
      replaySignal.throwIfAborted();
      replaySignal.addEventListener('abort',abort,{once:true});
      try{return await send(main(),'evaluate',payload);}
      finally{replaySignal.removeEventListener('abort',abort);}
     },request,{signal:run.signal,onProgress});
    }catch(error){
     run.signal.throwIfAborted();
     const remaining=Math.floor((fallbackDeadline-performance.now())/1000)-2;
     if(remaining<1)throw error;
     request={...request,time_limit_seconds:Math.min(120,remaining)};
     onProgress?.({phase:'Using anytime fallback'});
    }finally{
     exactSearch=undefined;
     run.signal.removeEventListener('abort',stopReplay);
     signal?.removeEventListener('abort',cancel);
    }
   }else{
    request={...request,time_limit_seconds:120};
    onProgress?.({phase:'Using anytime fallback'});
   }
  }
  if(fallbackDeadline){
   const deadlineSignal=AbortSignal.timeout(Math.max(1,Math.floor(fallbackDeadline-performance.now())));
   signal=signal?AbortSignal.any([signal,deadlineSignal]):deadlineSignal;
  }
  signal?.throwIfAborted();signal?.addEventListener('abort',abort,{once:true});
  try{return sharedExact?await optimizeOrdinary(request,{signal,onProgress}):
   action==='optimize'?await optimize(request,{signal,onProgress}):await send(main(),action,request,{onProgress});}
  finally{signal?.removeEventListener('abort',abort);}
 };
 client.exactBeta=exactBeta;
 client.exactOrdinary=exactOrdinary;
 return client;
}
