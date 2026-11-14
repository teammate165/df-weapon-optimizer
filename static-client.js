// Module workers keep optimization off the interface thread.
export function createStaticClient() {
  const worker=new Worker(new URL('./static-worker.js?v=9f0f704c6527c845',import.meta.url),{type:'module'});
  const pending=new Map();let serial=0;let failed;
  worker.onmessage=({data})=>{
    const task=pending.get(data.id);if(!task)return;
    pending.delete(data.id);
    if(data.error)task.reject(new Error(data.error));else task.resolve(data.result);
  };
  worker.onerror=event=>{
    failed=new Error(event.message||'Calculation worker failed. Reload to retry.');
    for(const task of pending.values())task.reject(failed);
    pending.clear();
  };
  return (action,request)=>new Promise((resolve,reject)=>{
    if(failed){reject(failed);return;}
    const id=++serial;pending.set(id,{resolve,reject});
    worker.postMessage({id,action,request});
  });
}
