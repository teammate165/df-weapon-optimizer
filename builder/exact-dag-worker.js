import * as kernel from './runtime/kernel.mjs';
import * as curves from './runtime/curves.mjs';
import {t as calculate} from './runtime/attributes.mjs';
import {createOptimizedExactDag} from './model/optimized_exact_dag.mjs';
import {createWeightedSelector,rankPrefix} from './model/exact_dag_storage.mjs';
import {createRankingHeap} from './model/ranked_screening_heap.mjs';
import {screeningComparator} from './model/screening_rank.mjs';
let input,engine,db,phase,k,heap,selector,files=[],spillBytes=0,worker;
const openDB=name=>new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('packets');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
const put=(key,value)=>new Promise((resolve,reject)=>{const transaction=db.transaction('packets','readwrite');transaction.objectStore('packets').put(value,key);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error??Error('Provenance write aborted'));});
const get=key=>new Promise((resolve,reject)=>{const request=db.transaction('packets').objectStore('packets').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
const line=row=>JSON.stringify([row.signature,row.objectives,row.score,row.cost]);
async function digest(lines){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(lines.length?lines.sort().join('\n')+'\n':'')))].map(n=>n.toString(16).padStart(2,'0')).join('');}
let queue=Promise.resolve();
self.onmessage=({data:message})=>{queue=queue.then(async()=>{const began=performance.now();try{
 if(message.action==='prepare'){
  worker=message.worker;const [catalog,pack]=await Promise.all(['./data/catalog.json','./data/weapons/18010000001.json'].map(async url=>{const response=await fetch(new URL(url,import.meta.url));if(!response.ok)throw Error('Missing exact DAG data');return response.json();}));input={pack,shop:catalog.shop,prices:catalog.prices,request:message.request};engine=createOptimizedExactDag(input,{kernel,curves,calculate});db=await openDB(message.database);self.postMessage({id:message.id,result:{ready:true}});return;
 }
 if(message.action==='plan'){self.postMessage({id:message.id,result:engine.plan()});return;}
 if(message.action==='begin'){engine=createOptimizedExactDag(input,{kernel,curves,calculate});phase=message.phase;k=message.k;heap=createRankingHeap(k,screeningComparator({}));selector=createWeightedSelector(k);files=[];spillBytes=0;self.postMessage({id:message.id,result:true});return;}
 if(message.action==='job'){
  let result;const lines=[];
  if(phase==='reference'){result=engine.referenceJob(message.job,row=>{heap.offer(row);if(message.audit)lines.push(line(row));});result={...result,terminal_classes:result.paths,manifest:message.audit?await digest(lines):null};}
  else{
   const computeStart=performance.now();let packet,guardFallback=null;try{packet=engine.runJob(message.job,message.expected_paths);}catch(error){guardFallback=error.message;packet=engine.fallbackJob(message.job);}const computeMs=performance.now()-computeStart;
   for(const cls of packet.classes)selector.add(cls,cls.mass);
   const auditStart=performance.now();if(message.audit)for(const row of engine.rows(packet))lines.push(line(row));const hash=message.audit?await digest(lines):null,auditMs=performance.now()-auditStart;
   delete packet.graph._rootMap;const estimate=packet.graph.head.byteLength+packet.graph.parent.byteLength+packet.graph.label.byteLength+packet.graph.next.byteLength+packet.classes.length*96+JSON.stringify(packet.graph.roots).length*2;await put(message.job.id,packet);spillBytes+=estimate;
   let minimum=null;for(const cls of packet.classes)if(!minimum||rankPrefix(cls,minimum)<0)minimum=cls;files.push({id:message.job.id,minimum:minimum?{objectives:minimum.objectives,cost:minimum.cost}:null});
   result={id:message.job.id,kind:packet.kind,paths:packet.paths,terminal_classes:packet.terminal_classes,merges:packet.merges,manifest:hash,guard_fallback:guardFallback,compute_ms:computeMs,audit_ms:auditMs,provenance_bytes_estimate:estimate};
  }
  self.postMessage({id:message.id,result:{...result,worker,wall_ms:performance.now()-began,stats:engine.stats().scorer}});return;
 }
 if(message.action==='summary'){self.postMessage({id:message.id,result:{worker,stats:engine.stats(),groups:phase==='optimized'?selector.groups():undefined,rows:phase==='reference'?heap.rows():undefined,provenance_bytes_estimate:spillBytes}});return;}
 if(message.action==='materialize'){const ranking=createRankingHeap(k,screeningComparator({}));let count=0,read=0;for(const file of files){if(!file.minimum||rankPrefix(file.minimum,message.threshold)>0)continue;const packet=await get(file.id);if(!packet)throw Error('Missing complete DAG provenance');read++;for(const row of engine.rows(packet,message.threshold)){ranking.offer(row);count++;}}self.postMessage({id:message.id,result:{worker,rows:ranking.rows(),materialized_paths:count,read_packets:read,wall_ms:performance.now()-began}});return;}
 if(message.action==='replay'){for(const row of message.rows){const native=engine.nativeRow(JSON.parse(row.signature).map(([slotPath,itemId])=>({slotPath,itemId})));if(native.signature!==row.signature||native.cost!==row.cost||native.score!==row.score||native.objectives.some((v,i)=>v!==row.objectives[i]))throw Error('Uncached native survivor mismatch');}self.postMessage({id:message.id,result:{worker,replayed:message.rows.length}});return;}
 if(message.action==='dispose'){db?.close();self.postMessage({id:message.id,result:true});return;}
 throw Error('Unknown exact DAG action');
}catch(error){self.postMessage({id:message.id,error:error.stack??error.message});}});};
