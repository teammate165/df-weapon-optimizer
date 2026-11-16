import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
// Historical exact-screen/SCIP reference path; production uses anytime search.
import {generateSCIP as generate} from '../tools/scip_optimizer.mjs';
import {executeModel} from '../tools/builder_model.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
const input=JSON.parse(process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):execFileSync('python',['-c',"import sys,json;sys.path.insert(0,'tools');from builder_server import catalog,pack;c=catalog();print(json.dumps(dict(pack=pack('18070000005'),shop=c['shop'],prices=c['prices'],provenance=c['provenance'])))"],{encoding:'utf8',maxBuffer:16*1024*1024}));
const modules={curves,kernel,calculate};
presets.future_test={...presets.recoil,label:'Future SCIP preset'};
try{
 for(const preset of ['recoil','agility','future_test']){
  const result=await generate({...input,request:{mode:'bd',preset,time_limit_seconds:2}},modules);
  assert.equal(result.solver.name,'SCIP');assert.equal(result.solver.full_weapon,false);assert.equal(result.solver.time_limit_scope,'calibration_only');assert(result.solver.solves>0);assert.equal(result.solver.interval_arithmetic_used,false);assert(result.attachment_gate.complete);assert.equal(result.attachment_gate.budgets[0].attachments.screened,458);assert.equal(result.attachment_gate.budgets[0].attachments.retained,23);
  assert.deepEqual(result.results.map(r=>r.label),['Max','Balanced','Min']);
  for(const row of result.results.filter(r=>r.status==='best_found')){
   const replay=await executeModel({...input,action:'evaluate',request:{mode:'bd',config:row.config,tunes:row.tunes}},modules);
   assert.deepEqual(row.stats,replay.effective_stats);assert.equal(row.cost,replay.cost);assert(row.cost<=result.tier.gunsmithLimit);
  }
  console.log(preset+': exhaustive two-stage gate, screened SCIP calibration and source replay pass');
 }
}finally{delete presets.future_test;}

// Each explicit budget gets a complete screen followed by its own share of the
// calibration timer. Earlier screening cannot consume later calibration time.
{
 const result=await generate({...input,request:{mode:'bd',budgets:[0,100,200],time_limit_seconds:3}},modules);
 assert.equal(result.attachment_gate.budgets.length,3);assert(result.attachment_gate.budgets.every(g=>g.complete));
 assert.deepEqual(result.results.map(r=>r.label),['Max','Balanced','Min']);
 for(const row of result.results.filter(r=>r.status==='best_found')){
  assert(row.cost<=row.budget);const replay=await executeModel({...input,action:'evaluate',request:{mode:'bd',config:row.config,tunes:row.tunes}},modules);assert.deepEqual(row.stats,replay.effective_stats);assert.equal(row.cost,replay.cost);
 }
 const impossible=await generate({...input,request:{mode:'bd',minimum_stats:{control:1000},time_limit_seconds:1}},modules);
 assert(impossible.attachment_gate.complete);assert.equal(impossible.attachment_gate.budgets[0].candidate_count,0);assert(impossible.results.every(r=>r.status==='infeasible'));
 console.log('Multiple budgets, independent calibration timers and infeasible floors without unscreened fallback pass.');
}
