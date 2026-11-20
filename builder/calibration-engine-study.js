export const engineStudy={status:'ready',workers:16,results:[],progress:[]};globalThis.engineStudy=engineStudy;
let pool=[],abortRun;
export async function runEngineStudy({rounds=6,seconds=2}={}){
 if(pool.length)throw Error('Comparison already running');
 Object.assign(engineStudy,{status:'running',results:[],progress:[],rounds,seconds});document.querySelector('#start').disabled=true;document.querySelector('#stop').disabled=false;
 const began=performance.now(),cancelled=new Promise((_,reject)=>{abortRun=reject;});
 try{
  const prepare=Array.from({length:16},()=>{const worker=new Worker(new URL('./calibration-engine-worker.js',import.meta.url),{type:'module'});pool.push(worker);return new Promise((resolve,reject)=>{worker.onmessage=({data})=>data.ready?resolve():data.error?reject(Error(data.error)):null;worker.onerror=e=>reject(Error(e.message));worker.postMessage({action:'prepare'});});});
  await Promise.race([Promise.all(prepare),cancelled]);
  const results=await Promise.race([Promise.all(pool.map((worker,id)=>new Promise((resolve,reject)=>{
   worker.onmessage=({data})=>{if(data.progress){engineStudy.progress.push(data.progress);document.querySelector('#status').textContent=`${engineStudy.results.length}/16 workers complete; ${engineStudy.progress.length} solver calls reported.`;return;}if(data.error){reject(Error(data.error));return;}engineStudy.results.push(data.result);resolve(data.result);};worker.onerror=e=>reject(Error(e.message));worker.postMessage({action:'run',worker:id,rounds,seconds});
  }))),cancelled]);
  Object.assign(engineStudy,{status:'completed',results,wall_ms:performance.now()-began});document.querySelector('#status').textContent=`Completed: 16 workers, ${(engineStudy.wall_ms/1000).toFixed(2)} seconds. Native replay checked every solver incumbent.`;document.querySelector('#results').textContent=JSON.stringify(engineStudy,null,2);return engineStudy;
 }catch(error){Object.assign(engineStudy,{status:error.name==='AbortError'?'stopped':'error',error:error.message,wall_ms:performance.now()-began});document.querySelector('#status').textContent=error.message;throw error;}
 finally{pool.forEach(worker=>worker.terminate());pool=[];abortRun=null;document.querySelector('#start').disabled=false;document.querySelector('#stop').disabled=true;}
}
document.querySelector('#start').onclick=()=>runEngineStudy().catch(()=>{});
document.querySelector('#stop').onclick=()=>abortRun?.(new DOMException('Stopped; partial results do not establish a comparison.','AbortError'));
