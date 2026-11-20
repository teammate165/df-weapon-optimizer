import * as curves from './runtime/curves.mjs';
import * as kernel from './runtime/kernel.mjs';
import {t as calculate} from './runtime/attributes.mjs';
import createSCIP from './vendor/scip-7e68f9ca/scip.js';
import loadHighs from './vendor/highs-1.15.4/build/highs.mjs';
import {benchmarkCalibration} from './model/calibration_engine_benchmark.mjs';
import {createHighsAdapter} from './model/highs_runtime.mjs';
import {LinearModel} from './model/scip_linear_model.mjs';
import {solveLinearModel} from './model/scip_runtime.mjs';
let ready;
async function data(){ready??=Promise.all(['./data/catalog.json','./data/weapons/18010000001.json'].map(async p=>{const response=await fetch(new URL(p,import.meta.url));if(!response.ok)throw Error('Missing benchmark data');return response.json();}));return ready;}
self.onmessage=async({data:message})=>{try{
 const [catalog,pack]=await data();
 if(message.action==='prepare'){self.postMessage({ready:true});return;}
 // Independent signed-product/mutation checks run in every participating
 // worker before real calibration. They exercise the new sparse adapter.
 const m=new LinearModel(),b=m.variable('b'),x=m.variable('x',-3,5,'continuous'),p=m.product(b,x),adapter=createHighsAdapter(()=>loadHighs());
 try{m.constrain(b,'==',1);m.constrain(x,'==',-2);let result=await adapter.solve(m,p,{seconds:1});if(result.status!=='optimal'||Math.abs(result.values[p]+2)>1e-8)throw Error('HiGHS signed-product validation failed');const scip=await solveLinearModel(m.cip(p),{createRuntime:createSCIP,seconds:1});if(scip.status!=='optimal'||Math.abs(scip.values[p]+2)>1e-8)throw Error('SCIP signed-product validation failed');m.constrain(p,'>=',-1,'contradiction');result=await adapter.solve(m,p,{seconds:1});const invalid=await solveLinearModel(m.cip(p),{createRuntime:createSCIP,seconds:1});if(result.status!=='infeasible'||result.adapter.appended_rows!==1||invalid.status!=='infeasible')throw Error('Appended-row validation failed');}finally{adapter.dispose();}
 const result=await benchmarkCalibration({pack,catalog,modules:{kernel,curves,calculate},createSCIP,loadHighs,workerId:message.worker,rounds:message.rounds,seconds:message.seconds,onProgress:record=>self.postMessage({progress:record})});
 self.postMessage({result:{...result,adapter_validation:true}});
}catch(error){self.postMessage({error:error.stack??error.message});}};
