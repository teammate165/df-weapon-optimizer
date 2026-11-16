// Module workers keep optimization off the interface thread.
export function createStaticClient() {
  let worker;
  const pending=new Map();let serial=0;let failed;
  const start=()=>{
  worker=new Worker(new URL('./static-worker.js?v=0a828ed25f230959',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    const task=pending.get(data.id);if(!task)return;
    if(data.progress){task.onProgress?.(data.progress);return;}
    pending.delete(data.id);
    if(data.error)task.reject(new Error(data.error));else task.resolve(data.result);
  };
  worker.onerror=event=>{
    failed=new Error(event.message||'Calculation worker failed. Reload to retry.');
    for(const task of pending.values())task.reject(failed);
    pending.clear();
  };
  };
  start();
  return (action,request,{signal,onProgress}={})=>new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Search cancelled.','AbortError'));return;}
    if(failed){reject(failed);return;}
    const abort=()=>{
      worker.terminate();
      const error=new DOMException('Search cancelled.','AbortError');
      for(const task of pending.values())task.reject(error);
      pending.clear();start();
    };
    const finish=callback=>value=>{signal?.removeEventListener('abort',abort);callback(value);};
    const id=++serial;pending.set(id,{resolve:finish(resolve),reject:finish(reject),onProgress});
    signal?.addEventListener('abort',abort,{once:true});
    worker.postMessage({id,action,request});
  });
}
