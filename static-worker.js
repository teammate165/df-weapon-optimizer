import {executeModel} from './model/builder_model.mjs?v=7715870c62e6d4d6';
import * as curves from './runtime/curves.mjs?v=7715870c62e6d4d6';
import * as kernel from './runtime/kernel.mjs?v=7715870c62e6d4d6';
import {t as calculate} from './runtime/attributes.mjs?v=7715870c62e6d4d6';
import {mergeAnytimeResults} from './model/anytime_optimizer.mjs?v=7715870c62e6d4d6';
import {screeningPlan,studyCount,screenPartition} from './model/exhaustive_screening_study.mjs?v=7715870c62e6d4d6';
const modules={curves,kernel,calculate};
async function loadJSON(path) {
  const response=await fetch(new URL(path,import.meta.url));
  if(!response.ok)throw Error(`Could not load ${path} (${response.status})`);
  return response.json();
}
let catalog;
const packs=new Map();
const starts=new Map();
// Serial execution bounds memory and preserves the local backend's arithmetic.
let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
  const {id,action,request}=data;
  try {
    catalog??=await loadJSON('./data/catalog.json?v=7715870c62e6d4d6');
    if(action==='catalog'){self.postMessage({id,result:catalog});return;}
    if(!catalog.weapons.some(w=>w.id===request.weapon_id))throw Error('Unknown weapon');
    if(!['bd','mp','sol'].includes(request.mode))throw Error('Unknown mode');
    if(!Number.isInteger(request.shot_count??20)||(request.shot_count??20)<2||(request.shot_count??20)>200)throw Error('Shot count must be 2–200');
    if(!packs.has(request.weapon_id))packs.set(request.weapon_id,await loadJSON(`./data/weapons/${request.weapon_id}.json?v=7715870c62e6d4d6`));
    const ordinarySearch=['exact-ordinary-plan','exact-ordinary-shard','exact-ordinary-merge','exact-ordinary-advance'].includes(action);
    if(ordinarySearch&&request.mode==='bd')request.budgets=[catalog.shop.weapons[request.weapon_id].gunsmithLimit];
    const searching=['optimize','prepare-search','merge-search'].includes(action);
    if(searching&&request.mode==='bd')request.budgets=[catalog.shop.weapons[request.weapon_id].gunsmithLimit];
    const ordinaryStarts=ordinarySearch&&request.search_method==='exact_ordinary_staged'&&request.weapon_id==='18010000038'&&request.mode==='bd';
    if((searching||ordinaryStarts)&&!starts.has(request.weapon_id)){try{starts.set(request.weapon_id,await loadJSON(`./data/solver-starts/${request.weapon_id}.json?v=7715870c62e6d4d6`));}catch{starts.set(request.weapon_id,{starts:[]});}}
    if(action==='prepare-search'){self.postMessage({id,result:{ready:true}});return;}
    const input={action,request,pack:packs.get(request.weapon_id),solver_starts:starts.get(request.weapon_id),shop:catalog.shop,prices:catalog.prices,provenance:catalog.provenance,onProgress:progress=>self.postMessage({id,progress}),search_variant:data.search?.variant,search_deadline:data.search?.deadline,collect_candidates:data.search?.collect,search_worker_index:data.search?.index,search_worker_count:data.search?.count};
    const port=data.calibrationPort;
    if(port)input.exchange_calibration=message=>new Promise(resolve=>{
      const key=message.budgetIndex+':'+message.round;
      const finish=result=>{clearTimeout(timer);port.onmessage=null;resolve(result);};
      const timer=setTimeout(()=>finish(null),message.waitMs);
      port.onmessage=({data})=>{if(data.key===key)finish(data.result);};
      port.postMessage(message);
    });
    let result;
    if(ordinarySearch){
      const exact=await import('./model/exact_ordinary.mjs?v=7715870c62e6d4d6');
      if(action==='exact-ordinary-plan')result=exact.planExactOrdinaryPartitions(input,modules,{
        workers:data.workerCount,staged:request.search_method==='exact_ordinary_staged'});
      else if(action==='exact-ordinary-shard')result=exact.solveExactOrdinary(input,modules,{
        partition:data.partition,phase:data.phase,collectArchive:true,deadlineEpochMs:data.deadline});
      else{
        result=action==='exact-ordinary-advance'?exact.advanceExactOrdinaryPhases(data.plan,data.reports,input,modules)
          :exact.combineExactOrdinaryShards(data.plan,data.outputs,input,modules);
        const final=action==='exact-ordinary-advance'?result.result:result;
        for(const row of (final?.results??[]).filter(row=>row.status==='best_found')){
          const replay=await executeModel({...input,action:'evaluate',request:{...request,config:row.config,tunes:row.tunes}},modules);
          if(replay.cost!==row.cost||replay.missing.length||
             JSON.stringify(replay.build.config)!==JSON.stringify(row.config)||
             Object.entries(row.tunes).some(([path,tunes])=>Object.entries(tunes).some(([id,value])=>replay.tunes[path]?.[id]!==value))){
            throw Error('Exact ordinary build failed native replay.');
          }
        }
      }
    }else result=action==='screening-plan'?screeningPlan(input,modules):action==='screening-count'?studyCount(input,modules):action==='screening-partition'?screenPartition(input,modules,data.partition):action==='merge-search'?mergeAnytimeResults(data.outputs,input,modules):await executeModel(input,modules);
    self.postMessage({id,result});
  }catch(error){self.postMessage({id,error:error.message});}
  finally{data.calibrationPort?.close();}
});};
