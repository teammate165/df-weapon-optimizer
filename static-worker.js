import {executeModel} from './model/builder_model.mjs?v=e8255213a43243ff';
import * as curves from './runtime/curves.mjs?v=e8255213a43243ff';
import * as kernel from './runtime/kernel.mjs?v=e8255213a43243ff';
import {t as calculate} from './runtime/attributes.mjs?v=e8255213a43243ff';
import {mergeAnytimeResults} from './model/anytime_optimizer.mjs?v=e8255213a43243ff';
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
    catalog??=await loadJSON('./data/catalog.json?v=e8255213a43243ff');
    if(action==='catalog'){self.postMessage({id,result:catalog});return;}
    if(!catalog.weapons.some(w=>w.id===request.weapon_id))throw Error('Unknown weapon');
    if(!['bd','mp','sol'].includes(request.mode))throw Error('Unknown mode');
    if(!Number.isInteger(request.shot_count??20)||(request.shot_count??20)<2||(request.shot_count??20)>200)throw Error('Shot count must be 2–200');
    if(!packs.has(request.weapon_id))packs.set(request.weapon_id,await loadJSON(`./data/weapons/${request.weapon_id}.json?v=e8255213a43243ff`));
    const searching=['optimize','prepare-search','merge-search'].includes(action);
    if(searching&&request.mode==='bd')request.budgets=[catalog.shop.weapons[request.weapon_id].gunsmithLimit];
    if(searching&&!starts.has(request.weapon_id)){try{starts.set(request.weapon_id,await loadJSON(`./data/solver-starts/${request.weapon_id}.json?v=e8255213a43243ff`));}catch{starts.set(request.weapon_id,{starts:[]});}}
    if(action==='prepare-search'){self.postMessage({id,result:{ready:true}});return;}
    const input={action,request,pack:packs.get(request.weapon_id),solver_starts:starts.get(request.weapon_id),shop:catalog.shop,prices:catalog.prices,provenance:catalog.provenance,onProgress:progress=>self.postMessage({id,progress}),search_variant:data.search?.variant,search_deadline:data.search?.deadline,collect_candidates:data.search?.collect};
    const result=action==='merge-search'?mergeAnytimeResults(data.outputs,input,modules):await executeModel(input,modules);
    self.postMessage({id,result});
  }catch(error){self.postMessage({id,error:error.message});}
});};
