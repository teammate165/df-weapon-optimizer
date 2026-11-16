import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {generate} from '../tools/optimizer_engine.mjs';
import {executeModel} from '../tools/builder_model.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import {emptyRisers} from '../tools/optimizer_mounts.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
const input=JSON.parse(process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):execFileSync('python',['-c',"import sys,json; sys.path.insert(0,'tools'); from builder_server import catalog,pack; c=catalog(); print(json.dumps(dict(pack=pack('18010000001'),shop=c['shop'],prices=c['prices'],provenance=c['provenance'])))"],{encoding:'utf8',maxBuffer:16*1024*1024}));
const modules={curves,kernel,calculate};
presets.future_test={...presets.recoil,label:'Unregistered-in-engine test preset'};
try{
 for(const preset of ['recoil','agility','future_test']){
  const request={mode:'mp',preset,passes:1};
  const result=await generate({...input,request},modules);
  assert.equal(result.attachment_gate.fraction,.05);
  assert.equal(result.attachment_gate.neighborhoods,1);
  assert(result.attachment_gate.screened>20);
  assert.equal(result.attachment_gate.retained,Math.ceil(result.attachment_gate.screened*.05));
  assert.equal(result.attachment_gate.global_optimality,false);
  assert.match(result.method,/Top 5%/);
  assert(result.exploration.configurations>0);
  assert.equal(result.exploration.restarts,2);
  assert.equal(result.exploration.global_optimality,false);
  const row=result.results.find(r=>r.status==='best_found');assert(row);
  assert.equal(emptyRisers(input.pack,curves.o(input.pack,row.config,'mp')).length,0);
  const replay=await executeModel({...input,action:'evaluate',request:{mode:'mp',config:row.config,tunes:row.tunes}},modules);
  assert.deepEqual(row.stats,replay.effective_stats);
  assert(row.loss<=100+1e-8);
  console.log(`${preset}: ${result.attachment_gate.retained}/${result.attachment_gate.screened} retained, replay passes`);
 }
}finally{delete presets.future_test;}
