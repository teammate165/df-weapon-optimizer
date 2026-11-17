// Dedicated module workers require only ordinary static hosting and messages.
export function searchWorkerCount({hardwareConcurrency=globalThis.navigator?.hardwareConcurrency,deviceMemory=globalThis.navigator?.deviceMemory}={}){
 const cores=Number.isFinite(hardwareConcurrency)?Math.max(1,Math.floor(hardwareConcurrency)):2;
 return Math.max(1,Math.min(Number.isFinite(deviceMemory)&&deviceMemory<=4?2:4,cores-1));
}
export function createStaticClient({workerCount=searchWorkerCount()}={}) {
 const count=Math.max(1,Math.min(4,Math.floor(workerCount)||1)),pending=new Map(),workers=new Set();
 let serial=0,primary,optimizing=false;
 const abortError=()=>new DOMException('Search cancelled.','AbortError');
 const spawn=()=>{
  const worker=new Worker(new URL('./static-worker.js',import.meta.url),{type:'module'});workers.add(worker);
  worker.onmessage=({data})=>{
   const task=pending.get(data.id);if(!task||task.worker!==worker)return;
   if(data.progress){task.onProgress?.(data.progress);return;}
   pending.delete(data.id);if(data.error)task.reject(new Error(data.error));else task.resolve(data.result);
  };
  const fail=event=>{
   const error=new Error(event.message||'Calculation worker failed. Try again.');
   for(const [id,task]of pending)if(task.worker===worker){pending.delete(id);task.reject(error);}
   worker.terminate();workers.delete(worker);if(primary===worker)primary=null;
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
  optimizing=true;const pool=[],started=performance.now();
  try{
   pool.push(main());for(let i=1;i<count;i++){try{pool.push(spawn());}catch{break;}}
   const prepared=await Promise.allSettled(pool.map(worker=>send(worker,'prepare-search',request)));
   signal?.throwIfAborted();const ready=pool.filter((_,i)=>prepared[i].status==='fulfilled');
   if(!ready.length)throw prepared[0].reason;
   const seconds=request.time_limit_seconds??(request.passes===undefined?30:Math.max(1,2*request.passes)),deadline=Date.now()+seconds*1000,latest=new Map();
   const progress=(index,p)=>{
    latest.set(index,p);const lead=latest.get(0)??p,events=[...latest.values()],sum=key=>events.reduce((n,e)=>n+(e[key]??0),0);
    onProgress?.({...lead,evaluated:sum('evaluated'),ordinary_retained:sum('ordinary_retained'),candidates:sum('candidates'),workers:ready.length,elapsed_ms:performance.now()-started});
   };
   const settled=await Promise.allSettled(ready.map((worker,variant)=>send(worker,'optimize',request,{search:{variant,deadline,collect:true},onProgress:p=>progress(variant,p)})));
   signal?.throwIfAborted();const outputs=settled.filter(r=>r.status==='fulfilled').map(r=>r.value);
   if(!outputs.length)throw settled[0].reason;
   const result=await send(main(),'merge-search',request,{outputs});
   result.solver.elapsed_ms=performance.now()-started;
   Object.assign(result.solver.parallel,{requested_workers:count,failed_workers:count-outputs.length,compute_budget_seconds:seconds});
   return result;
  }finally{
   for(const worker of pool)if(worker!==primary){worker.terminate();workers.delete(worker);}
   optimizing=false;
  }
 };
 return async(action,request,{signal,onProgress}={})=>{
  signal?.throwIfAborted();signal?.addEventListener('abort',abort,{once:true});
  try{return action==='optimize'?await optimize(request,{signal,onProgress}):await send(main(),action,request,{onProgress});}
  finally{signal?.removeEventListener('abort',abort);}
 };
}
