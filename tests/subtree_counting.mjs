import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LinearModel} from '../tools/scip_linear_model.mjs';
import {compileMounts} from '../tools/scip_mount_model.mjs';
import {createMountSearch} from '../tools/mount_search.mjs';
import {tacticalChoice} from '../tools/exhaustive_attachment_gate.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';

function flat(slots,options,budget=null,price=1){
 const model=new LinearModel(),players=new Map();
 for(let s=0;s<slots;s++)for(let i=0;i<options;i++){const value=model.variable('equip'),path=String(s+1),item=String(i);players.set(path+'|'+item,{path,item,value});}
 if(budget!==null)model.constrain(model.add(...[...players.values()].map(p=>model.scale(p.value,price))),'<=',budget,'attachment_budget');
 return {model,players};
}
const reports=[];
// 2^60 distinct legal configurations, counted without visiting any leaf.
{
 const search=createMountSearch(flat(60,1)),result=search.count();
 assert.equal(result.total,2n**60n);assert.equal(result.stats.nodes,1);assert.equal(result.stats.analytical_subtrees,1);
 reports.push({case:'sixty independent sockets',count:String(result.total),stats:result.stats});
}
// Closed-form count, including the multiplicity of equal-price alternatives.
{
 const compiled=flat(20,2,5),search=createMountSearch(compiled);let choose=1n,expected=0n;
 for(let k=0;k<=5;k++){if(k)choose=choose*BigInt(21-k)/BigInt(k);expected+=choose*2n**BigInt(k);}
 let progress=0n;const result=search.count(new Map(),{onCount:n=>progress+=n});
 assert.equal(result.total,expected);assert.equal(progress,expected);assert(result.stats.cache_hits>0);assert(result.stats.nodes<1000);
 reports.push({case:'twenty sockets, two equal-price alternatives, budget five',count:String(result.total),stats:result.stats});
}
// Equal interval bounds can hide different conditional future solution counts.
{
 const compiled=flat(3,1),[x,y,z]=[...compiled.players.values()].map(p=>p.value);
 compiled.model.constrain(compiled.model.and(x,compiled.model.not(y)),'==',0,'conditional_parent');
 compiled.model.constrain(compiled.model.and(compiled.model.not(x),compiled.model.not(y),compiled.model.not(z)),'==',0,'conditional_occupancy');
 const search=createMountSearch(compiled),reference=[...search.enumerate()].length;
 assert.equal(search.count().total,BigInt(reference));
 for(const value of [0,1]){const restrictions=new Map([[x,value]]);assert.equal(search.count(restrictions).total,BigInt([...search.enumerate(restrictions)].length));}
}
// Already-fixed sockets contribute one continuation and do not need a new
// full legality scan at every deterministic layer. Enumeration retains them.
{
 const compiled=flat(12,1,6),restrictions=new Map([...compiled.players.values()].map((p,i)=>[p.value,i%2])),search=createMountSearch(compiled),result=search.count(restrictions),rows=[...search.enumerate(restrictions)];
 assert.equal(result.total,1n);assert.equal(result.stats.nodes,1);assert.equal(result.stats.fixed_layers_skipped,12);assert.equal(rows.length,1);assert.equal(rows[0].length,6);
 const expected=[...compiled.players.values()].filter((p,i)=>i%2).map(p=>p.path).sort();assert.deepEqual(rows[0].map(p=>p.slotPath).sort(),expected);
}
// Saturating/turning off either cache affects reuse only, never exact counts.
{
 const search=createMountSearch(flat(6,2,3)),expected=BigInt([...search.enumerate()].length);
 for(const limits of [{maxEntries:0,maxInternEntries:0},{maxEntries:1,maxKeyChars:64,maxInternEntries:1,maxInternChars:8},{maxEntries:100,maxKeyChars:0,maxInternEntries:100,maxInternChars:0}]){
  const result=search.count(new Map(),limits);assert.equal(result.total,expected);assert(result.stats.memo_entries_peak<=(limits.maxEntries??20000));assert(result.stats.memo_key_chars_peak<=(limits.maxKeyChars??4*1024*1024));
 }
 const decimal=createMountSearch(flat(6,2,.3,.1)),result=decimal.count();assert(result.stats.numeric_fallback);assert.equal(result.total,BigInt([...decimal.enumerate()].length));
 let ticks=0;
 const paused=[...search.enumerate(new Map(),()=>{ticks++;},{pause:()=>ticks%3===0})];
 assert(paused.includes(null));
 assert.deepEqual(paused.filter(config=>config!==null),[...search.enumerate()]);
 const huge=createMountSearch(flat(2,1,Number.MAX_SAFE_INTEGER)),overflow=huge.count();assert(overflow.stats.numeric_fallback);assert.equal(overflow.total,4n);
 assert.throws(()=>search.count(new Map(),{maxEntries:-1}));
 assert.throws(()=>search.count(new Map(),{tick:()=>{throw new DOMException('Cancelled','AbortError');}}),{name:'AbortError'});
}
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json'));
for(const [id,budgets] of [['18070000005',[0,20,100,200]],['18020000002',[20]],['18020000003',[20]],['18050000007',[20]],['18040000002',[20]]]){
 const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/'+id+'.json'));
 for(const mode of ['bd','sol','mp'])for(const budget of mode==='bd'?budgets:id==='18070000005'?[5000000]:[]){
  const input={pack,shop:catalog.shop,prices:catalog.prices,request:{mode,budget}},compiled=compileMounts(input,kernel),search=createMountSearch(compiled);
  const all=[...search.enumerate()];assert.equal(search.count().total,BigInt(all.length));
  const ordinary=new Map();for(const p of compiled.players.values())if(typeof p.value==='string'&&tacticalChoice(pack,kernel,mode,p.path,p.item))ordinary.set(p.value,0);
  const result=search.count(ordinary),reference=[...search.enumerate(ordinary)];assert.equal(result.total,BigInt(reference.length));
  for(const base of reference.slice(0,5)){
   const chosen=new Set(base.map(n=>n.slotPath+'|'+n.itemId)),restrictions=new Map();
   for(const [key,p] of compiled.players)if(typeof p.value==='string'&&!tacticalChoice(pack,kernel,mode,p.path,p.item))restrictions.set(p.value,chosen.has(key)?1:0);
   assert.equal(search.count(restrictions).total,BigInt([...search.enumerate(restrictions)].length));
  }
  reports.push({case:id,mode,budget,all:all.length,ordinary:reference.length,stats:result.stats});
 }
}
fs.mkdirSync('.scratch/subtree-counting',{recursive:true});fs.writeFileSync('.scratch/subtree-counting/tests.json',JSON.stringify({passed:true,reports},null,2));
console.log('Cached subtree counts match enumeration, closed forms and >2^53 counts; restriction isolation, dependencies, numeric fallbacks, bounded caches and cancellation pass.');
