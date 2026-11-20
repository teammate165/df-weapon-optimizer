import fs from 'node:fs';import assert from 'node:assert/strict';
import {compileMounts} from '../tools/scip_mount_model.mjs';import {createMountSearch} from '../tools/mount_search.mjs';import {createChoiceGroups} from '../tools/choice_groups.mjs';import {presets} from '../tools/optimizer_presets.mjs';import {compareObjectives} from '../tools/optimizer_policy.mjs';
import {applyDominanceReduction,dominanceReport,decreasingPositiveCurve} from '../tools/dominance_reduction.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';import * as curves from '../.scratch/calibration-check/curves.mjs';import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json')),pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json')),baseline=JSON.parse(fs.readFileSync('data/optimizer_validation/m4a1_exhaustive_screening_20261117/final.json')),modules={kernel,curves,calculate};
const fixed=[{slotPath:'11',itemId:'13110000091'}],request={mode:'bd',preset:'recoil',budget:800,fixed,experimental_dominance:true},input={pack,request,shop:catalog.shop,prices:catalog.prices},resolve=config=>curves.o(pack,config,'bd'),preset=presets.recoil.create({pack,request,...modules,mode:'bd',resolve});
function create(r=request){const x={...input,request:r},compiled=compileMounts(x,kernel),groups=createChoiceGroups({...x,...modules,preset,mode:'bd',fixed:r.fixed});groups.constrain(compiled);return {compiled,groups,x};}
const context=create(),plan=applyDominanceReduction(input,modules,{...context,preset});assert(plan.enabled);
assert(!decreasingPositiveCurve({points:[{inputValue:0,outputValue:1},{inputValue:1,outputValue:2}]}));
assert(!decreasingPositiveCurve({points:[{inputValue:0,outputValue:1,interpolationMode:'RCIM_Cubic',leaveTangent:100},{inputValue:1,outputValue:.1,arriveTangent:100}]}));
for(const r of [{...request,experimental_dominance:false},{...request,mode:'sol'},{...request,preset:'agility'},{...request,firing:'spam'},{...request,minimum_stats:{accuracy:50}},{...request,fixed:[]}]){const c=create({...r,mode:'bd'});const fallback=applyDominanceReduction({...input,request:r},modules,{...c,preset});assert(!fallback.enabled);}
// Changed source aliases/mapping dependencies must fail closed.
for(const mutate of [p=>p.attributeRules.defaults['3'].directRuleTargets.push('GRateOfFire'),p=>p.attributeRules.defaults['3'].curveMappings=p.attributeRules.defaults['3'].curveMappings.filter(m=>m.target!=='GRecoil_V')]){const changed=structuredClone(pack);mutate(changed);const c=create();assert(!applyDominanceReduction({...input,pack:changed},modules,{...c,preset}).enabled);}
const contexts=[fixed,...baseline.partition_results.map(r=>r.best.config)],failures=[],rules=[],stats={default_checks:0,tuning_checks:0,mount_checks:0,too_expensive:0,unavailable_contexts:0};
const cost=build=>build.mounted.filter(n=>n.source==='equipped').reduce((n,p)=>n+catalog.shop.partCosts[p.itemId],0);
const replace=(config,paths,ids)=>{const out=config.filter(c=>!paths.some(p=>c.slotPath===p));for(let i=0;i<paths.length;i++)if(ids[i]!==null)out.push({slotPath:paths[i],itemId:ids[i]});return out;};
const evaluate=(build,tunes)=>{const state=kernel.u(pack,build,{mode:'bd',tacticalEffective:true,tunes}),components=preset.raw(build,tunes,state);return {score:preset.score(components),objectives:preset.objectives(components)};};
for(const rule of [...plan.rules,...plan.block_rules]){
 const block=!!rule.paths,paths=block?rule.paths:[rule.path],from=block?rule.from:[rule.from],to=block?rule.to:[rule.to];let checks=0;
 for(const config of contexts){
  const before=resolve(replace(config,paths,from));
  if(from.some((id,i)=>id!==null&&!before.config.some(c=>c.slotPath===paths[i]&&c.itemId===id))||!block&&before.mounted.find(n=>n.slotPath===paths[0])?.hostItemId!==rule.host){stats.unavailable_contexts++;continue;}
  if(cost(before)>800){stats.too_expensive++;continue;}
  const after=resolve(replace(before.config,paths,to));
  if(before.config.some(c=>!paths.includes(c.slotPath)&&!after.config.some(n=>n.slotPath===c.slotPath&&n.itemId===c.itemId))||!after.mounted.some(n=>n.slotPath==='11'&&n.itemId==='13110000091')||cost(after)>cost(before)){failures.push({rule:dominanceReport({...plan,rules:block?[]:[rule],block_rules:block?[rule]:[]}),reason:'mount_cost_or_lock'});continue;}
  stats.mount_checks++;
  const oldDefault=evaluate(before,{}),newDefault=evaluate(after,{});stats.default_checks++;checks++;
  if(compareObjectives(newDefault,oldDefault)>0)failures.push({from:rule.from,to:rule.to,path:paths,reason:'default_objective',old:oldDefault,new:newDefault,context:config});
  for(const old of rule.from_item.envelope){
   const replacement=rule.to_item.envelope.find(n=>plan.outcomeCovers(n.vector,old.vector));assert(replacement);
   const oldTunes=block?old.tunes:{[paths[0]]:old.tunes},newTunes=block?replacement.tunes:{[paths[0]]:replacement.tunes};
   const a=evaluate(before,oldTunes),b=evaluate(after,newTunes);stats.tuning_checks++;
   if(compareObjectives(b,a)>0)failures.push({from:rule.from,to:rule.to,path:paths,reason:'tuned_objective',old:a,new:b,oldTunes,newTunes,context:config});
  }
 }
 rules.push({path:paths,from:rule.from,to:rule.to,legal_contexts:checks});
}
// Locks prevent discarding an exact identity, including a locked descendant.
for(const rule of plan.rules.filter(r=>['3','5','4/8'].includes(r.path)).slice(0,5)){
 const r={...request,fixed:[...fixed,{slotPath:rule.path,itemId:rule.from}]},c=create(r),lockedPlan=applyDominanceReduction({...input,request:r},modules,{...c,preset});assert(!lockedPlan.rules.some(p=>p.path===rule.path));
}
const restrictions=new Map();for(const p of context.compiled.players.values())if(typeof p.value==='string'&&context.groups.isTactical(p.path,p.item))restrictions.set(p.value,0);
const count=String(createMountSearch(context.compiled).count(restrictions).total);
const output='data/optimizer_validation/m4a1_dominance_20261118';fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(output+'/validation.json',JSON.stringify({passed:!failures.length&&count==='1696710',count,stats,failures,rules,plan:dominanceReport(plan)},null,2));
assert(!failures.length,JSON.stringify(failures.slice(0,2)));assert.equal(count,'1696710');
console.log(JSON.stringify({passed:true,count,...stats,atomic_rules:plan.rules.length,block_rules:plan.block_rules.length}));
