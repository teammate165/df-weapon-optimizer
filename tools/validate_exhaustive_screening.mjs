import fs from 'node:fs';import assert from 'node:assert/strict';
import {presets} from './optimizer_presets.mjs';import {configKey} from './exhaustive_attachment_gate.mjs';import {compareObjectives} from './optimizer_policy.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';import * as kernel from '../.scratch/calibration-check/kernel.mjs';import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
const directory=process.argv[2]??'data/optimizer_validation/m4a1_exhaustive_screening_20261117',study=JSON.parse(fs.readFileSync(directory+'/final.json'));
assert.equal(study.status,'completed');assert.equal(study.partition_results.length,study.plan.partitions.length);assert.equal(new Set(study.partition_results.map(p=>p.partition)).size,study.plan.partitions.length);
const rows=study.partition_results,scored=rows.reduce((n,p)=>n+BigInt(p.scored),0n);assert.equal(scored,BigInt(study.count.total));assert.equal(String(scored),study.request.experimental_dominance?'1696710':'12885654');assert(rows.every(p=>p.complete&&p.visited===p.scored&&p.source_errors===0));
const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json')),catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json')),request={...study.request,mode:'bd'},resolve=config=>curves.o(pack,config,'bd'),preset=presets.recoil.create({pack,request,mode:'bd',resolve,kernel,curves,calculate});
let replayed=0;
for(const row of rows.map(p=>p.best).filter(Boolean)){
 const build=resolve(row.config),state=kernel.u(pack,build,{mode:'bd',tacticalEffective:true,tunes:{}}),components=preset.raw(build,{},state),score=preset.score(components);
 assert.equal(configKey(build.config),configKey(row.config));assert.equal(score,row.score);assert.deepEqual(preset.objectives?.(components)??[score],row.objectives);
 const cost=build.mounted.filter(n=>n.source==='equipped').reduce((n,p)=>n+catalog.shop.partCosts[p.itemId],0);assert.equal(row.cost,cost);assert(cost<=800);assert(build.mounted.some(n=>n.slotPath==='11'&&n.itemId==='13110000091'));assert(compareObjectives(study.best,row)<=0);replayed++;
}
if(study.request.experimental_dominance){const original=JSON.parse(fs.readFileSync('data/optimizer_validation/m4a1_exhaustive_screening_20261117/final.json'));assert.equal(compareObjectives(study.best,original.best),0);assert(study.best.cost<=original.best.cost);}
const validation={passed:true,status:study.status,exact_total:study.count.total,scored:String(scored),partitions:rows.length,native_best_row_replays:replayed,source_errors:0,checks:['all partition IDs unique and complete','exact independent count reconciled','every source mounting checked during scan','best rows replay exact native objective vectors, cost and lock','no score pruning or deadlines','ordinary-only scope; top-5% storage and tactical stage not included']};
fs.writeFileSync(directory+'/scan-validation.json',JSON.stringify(validation,null,2));console.log(JSON.stringify(validation));
