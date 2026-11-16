import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {generate} from '../tools/optimizer_engine.mjs';
import {executeModel} from '../tools/builder_model.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
const input=JSON.parse(process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):execFileSync('python',['-c',"import sys,json;sys.path.insert(0,'tools');from builder_server import catalog,pack;c=catalog();print(json.dumps(dict(pack=pack('18010000001'),shop=c['shop'],prices=c['prices'],provenance=c['provenance'])))"],{encoding:'utf8',maxBuffer:16*1024*1024}));
const modules={curves,kernel,calculate};
presets.future_test={...presets.recoil,label:'Future SCIP preset'};
try{
 for(const preset of ['recoil','agility','future_test']){
  const result=await generate({...input,request:{mode:'bd',preset,time_limit_seconds:2}},modules);
  assert.equal(result.solver.name,'SCIP');assert(result.solver.full_weapon);assert(result.solver.solves>0);assert.equal(result.solver.interval_arithmetic_used,false);assert.equal(result.attachment_gate,undefined);
  assert.deepEqual(result.results.map(r=>r.label),['Max','Balanced','Min']);
  for(const row of result.results.filter(r=>r.status==='best_found')){
   const replay=await executeModel({...input,action:'evaluate',request:{mode:'bd',config:row.config,tunes:row.tunes}},modules);
   assert.deepEqual(row.stats,replay.effective_stats);assert.equal(row.cost,replay.cost);assert(row.cost<=result.tier.gunsmithLimit);
  }
  console.log(preset+': full SCIP model, no heuristic gate, source replay passes');
 }
}finally{delete presets.future_test;}
