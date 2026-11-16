import assert from 'node:assert/strict';
import {exploreAttachments} from '../tools/optimizer_exploration.mjs';

function fixture({fixed=[],floor=0}={}){
 const pack={parts:{a:{tuneIds:['x']},b:{tuneIds:[]}},assembly:{socketProviders:{a:{sockets:[{}]}}},curves:{x:{points:[]}}};
 const resolve=config=>({config,mounted:config.map(c=>({...c,itemId:c.itemId,source:'equipped'})),slots:['a','b'].map(slotPath=>({slotPath,options:[slotPath]}))});
 const curves={c:()=>({enabled:true,range:{defaultValue:0},functions:[]}),n:()=>[-1,0,1],r:()=>0};
 const better=(a,b)=>a.violation<b.violation||(a.violation===b.violation&&(a.score<b.score||(a.score===b.score&&a.cost<b.cost)));
 const evaluate=(config,tunes={})=>{
  if(!fixed.every(f=>config.some(c=>c.slotPath===f.slotPath&&c.itemId===f.itemId)))return null;
  const both=config.length===2,score=both?(tunes.a?.x??0)**2:config.length?12:10,cost=config.length;
  return {config,tunes,cost,score,violation:Math.max(0,floor-cost),build:resolve(config)};
 };
 const diagnostics={evaluations:0,configurations:0,passes:0,restarts:0,structural_starts:0};
 const seed=evaluate(fixed);
 const run=()=>exploreAttachments({seed,pack,curves,resolve,evaluate,complete:b=>[b],fixed,hidden:new Set(),better,passes:6,diagnostics});
 return {run,seed,better,diagnostics};
}
// Both single moves are worse; a separate structural start must cross the trap.
const a=fixture(),winner=a.run();
assert.equal(winner.config.length,2);assert.equal(winner.score,0);
assert.equal(winner.tunes.a?.x??0,0); // Interior legal position beats both endpoints.
assert(a.better(winner,a.seed));assert.equal(a.diagnostics.restarts,12);
// Retaining a descendant lock is the caller's legality contract and must hold
// across complete structural seeds and random multi-slot perturbations.
const locked=fixture({fixed:[{slotPath:'a',itemId:'a'}],floor:2}),result=locked.run();
assert(result.config.some(c=>c.slotPath==='a'&&c.itemId==='a'));
assert.equal(result.violation,0);
const repeat=fixture().run();assert.deepEqual(repeat.config,winner.config);assert.equal(repeat.score,winner.score);
console.log('Exploration crosses coordinated-swap traps, preserves locks/floors, selects interior tuning and repeats deterministically.');
