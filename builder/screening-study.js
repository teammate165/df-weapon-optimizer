import {survivorCount} from './model/screening_rank.mjs';
import {compareObjectives} from './model/optimizer_policy.mjs';
export const screeningFixture={weapon_id:'18010000001',mode:'bd',preset:'recoil',budget:800,fixed:[{slotPath:'11',itemId:'13110000091'}]};
const $=id=>document.getElementById(id),format=n=>Number(n??0).toLocaleString(undefined,{maximumFractionDigits:0});
export const screeningStudy={schema:1,kind:'exhaustive_ordinary_default_calibration',request:screeningFixture,status:'ready',samples:[],partition_results:[],count:null,best:null};
globalThis.screeningStudy=screeningStudy;
let active=null;
$('workers').value=8;
function graph(points){const c=$('chart'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#cbdce8';ctx.font='15px system-ui';ctx.fillText('Unique ordinary layouts screened vs wall seconds (disjoint traversal)',18,25);if(!points.length)return;const xmax=Math.max(1,points.at(-1).wall_seconds),ymax=Math.max(1,points.at(-1).scored);ctx.fillText(`${format(ymax)} layouts`,18,50);ctx.fillText(`${xmax.toFixed(0)} seconds`,w-140,h-10);ctx.strokeStyle='#76dbc3';ctx.beginPath();points.forEach((p,i)=>{const x=25+p.wall_seconds/xmax*(w-50),y=h-30-p.scored/ymax*(h-90);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();}
export async function startScreening({workers=Number($('workers').value),request=screeningFixture}={}){
 if(active)throw Error('An exhaustive study is already running');
 workers=Math.max(1,Math.min(8,Math.floor(workers)||1));
 const pool=[],pending=new Map(),states=new Map(),jobs=[],started=performance.now();let serial=0,last=-Infinity,lastDisk=-Infinity,cancelled=false,nextJob=0;
 Object.assign(screeningStudy,{request,workers,status:'running',started_at:new Date().toISOString(),samples:[],partition_results:[],count:null,best:null});
 $('start').disabled=true;$('stop').disabled=false;$('workers').disabled=true;$('workers').value=workers;
 const dispose=()=>{for(const worker of pool)worker.terminate();for(const task of pending.values())task.reject(new DOMException('Screening cancelled','AbortError'));pending.clear();};
 active={stop:()=>{cancelled=true;dispose();}};
 function report(force=false){
  const now=performance.now();if(!force&&now-last<1000)return;last=now;
  const rows=[...states.values()],sum=key=>rows.reduce((n,r)=>n+(r[key]??0),0),wall=(now-started)/1000,scored=sum('scored'),nodes=sum('nodes'),total=screeningStudy.count?.total;
  const fraction=total&&BigInt(total)>0n?scored/Number(total):null,rate=scored/Math.max(.001,wall),remaining=total?Math.max(0,Number(total)-scored):null;
  for(const row of rows)if(row.best&&(!screeningStudy.best||compareObjectives(row.best,screeningStudy.best)<0))screeningStudy.best=row.best;
  const sample={wall_seconds:wall,scored,nodes,exact_total:total??null,fraction,rate,projected_remaining_seconds:remaining!==null&&rate>0?remaining/rate:null,completed_partitions:screeningStudy.partition_results.length,active_workers:pool.length,worker_progress:pool.map((worker,index)=>({worker:index,...worker.latest})),serialization_samples:sum('serialization_samples'),serialization_bytes:sum('serialization_bytes')};
  screeningStudy.samples.push(sample);if(screeningStudy.samples.length>14400)screeningStudy.samples.shift();
  $('elapsed').textContent=`${wall.toFixed(1)} s`;$('screened').textContent=format(scored);$('total').textContent=total?format(total):'Counting…';$('fraction').textContent=fraction===null?'Unknown':`${(100*fraction).toFixed(5)}%`;$('rate').textContent=`${format(rate)} / s`;
  $('eta').textContent=sample.projected_remaining_seconds===null?'Waiting for count':`${(sample.projected_remaining_seconds/3600).toFixed(2)} h (projection)`;
  $('status').textContent=`${screeningStudy.status}: ${screeningStudy.partition_results.length}/${jobs.length} disjoint partitions finished. Single traversal; no deadlines or restart.`;
  const meanBytes=sample.serialization_samples?sample.serialization_bytes/sample.serialization_samples:null,topRows=total?survivorCount(total):null;
  const survivorLabel=screeningStudy.plan?.dominance?.enabled?'0.5% of reduced domain (not the original gate)':'Top-0.5% survivors';
  $('metrics').textContent=`${format(nodes)} tree nodes. ${survivorLabel}: ${topRows??'awaiting exact count'}. Sample row JSON: ${meanBytes?.toFixed(0)??'pending'} bytes; top-0.5% serialized size scenario: ${topRows&&meanBytes?(Number(topRows)*meanBytes/2**30).toFixed(2)+' GiB':'pending'} (not measured heap memory).`;
  $('worker-rows').replaceChildren(...sample.worker_progress.map(row=>{const tr=document.createElement('tr');for(const value of [row.worker,`${row.phase??'starting'} / ${row.partition??'—'}`,format(row.scored),format(row.nodes),`${((row.elapsed_ms??0)/1000).toFixed(1)} s`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));
  if(screeningStudy.best)$('best').textContent=JSON.stringify(screeningStudy.best,null,2);graph(screeningStudy.samples);
  if(force||wall-lastDisk>=5){lastDisk=wall;globalThis.recordScreeningProgress?.(JSON.parse(JSON.stringify({...screeningStudy,samples:screeningStudy.samples.slice(-120),latest:sample})));}
 }
 const send=(worker,action,partition)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject,worker});worker.postMessage({id,action,request,partition});});
 try{
  for(let i=0;i<workers;i++){
   const worker=new Worker(new URL('./static-worker.js',import.meta.url),{type:'module'});pool.push(worker);
   worker.onmessage=({data})=>{const task=pending.get(data.id);if(!task)return;if(data.progress){worker.latest=data.progress;if(data.progress.phase==='exhaustive_ordinary')states.set(data.progress.partition,data.progress);report();return;}pending.delete(data.id);if(data.error)task.reject(Error(data.error));else task.resolve(data.result);};
   worker.onerror=event=>{for(const [id,task] of pending)if(task.worker===worker){pending.delete(id);task.reject(Error(event.message||'Screening worker failed'));}};
  }
  const plan=await send(pool[0],'screening-plan');Object.assign(screeningStudy,{plan});jobs.push(...plan.partitions);
  async function drain(worker){while(!cancelled&&nextJob<jobs.length){const partition=jobs[nextJob++],result=await send(worker,'screening-partition',partition);states.set(partition.id,result);worker.latest=result;screeningStudy.partition_results.push(result);report(true);}}
  await Promise.all(pool.map(async(worker,index)=>{if(index===0){worker.latest={phase:'exact_count'};screeningStudy.count=await send(worker,'screening-count');report(true);}await drain(worker);}));
  const screened=[...states.values()].reduce((n,p)=>n+BigInt(p.scored),0n);
  if(screened!==BigInt(screeningStudy.count.total))throw Error('Disjoint traversal count does not match exact domain size');
  screeningStudy.status='completed';report(true);
 }catch(error){screeningStudy.status=error.name==='AbortError'?'stopped':'error';screeningStudy.error=error.name==='AbortError'?null:error.message;report(true);if(error.name!=='AbortError')throw error;}
 finally{dispose();active=null;$('start').disabled=false;$('stop').disabled=true;$('workers').disabled=false;}
 return screeningStudy;
}
$('start').onclick=()=>startScreening({request:{...screeningFixture,experimental_dominance:false}}).catch(e=>{$('status').textContent=e.message;});
$('stop').onclick=()=>active?.stop();
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(screeningStudy,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='m4a1-exhaustive-screening.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
