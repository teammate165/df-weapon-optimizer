import fs from 'node:fs';import assert from 'node:assert/strict';
import {screeningPlan,studyCount,screenPartition} from '../tools/exhaustive_screening_study.mjs';
import {configKey} from '../tools/exhaustive_attachment_gate.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';import * as kernel from '../.scratch/calibration-check/kernel.mjs';import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json')),cat=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json')),modules={curves,kernel,calculate};
const request={mode:'bd',preset:'recoil',budget:160,fixed:[{slotPath:'11',itemId:'13110000091'}]},resolve=config=>curves.o(pack,config,'bd'),preset=presets.recoil.create({pack,request,...modules,mode:'bd',resolve});
const keys=new Set(),input={pack,shop:cat.shop,prices:cat.prices,request,onRow:row=>{const key=configKey(row.config);assert(!keys.has(key),'Partitions overlap');keys.add(key);const build=resolve(row.config),state=kernel.u(pack,build,{mode:'bd',tacticalEffective:true,tunes:{}});assert.equal(row.score,preset.score(preset.raw(build,{},state)));assert(row.config.some(c=>c.slotPath==='11'&&c.itemId==='13110000091'));assert(row.cost<=160);}};
const plan=screeningPlan(input,modules),count=studyCount(input,modules);let scored=0;
for(const partition of plan.partitions){const result=screenPartition(input,modules,partition);assert(result.complete);assert.equal(result.scored,result.visited);scored+=result.scored;}
assert(scored>0);assert.equal(BigInt(scored),BigInt(count.total));assert.equal(keys.size,scored);
console.log(JSON.stringify({passed:true,partitions:plan.partitions.length,exact_total:count.total,unique_scored:scored,checks:['disjoint/exhaustive partitions','exact count reconciliation','all native scores replayed','Insight lock and budget','no timing deadline']}));
