import assert from 'node:assert/strict';
import {LinearModel} from '../tools/scip_linear_model.mjs';
import {solveLinearModel} from '../tools/scip_runtime.mjs';
import createRuntime from '../vendor/scip-7e68f9ca/scip.js';
import fs from 'node:fs';
import {compileMounts} from '../tools/scip_mount_model.mjs';
import {compileStats} from '../tools/scip_stat_model.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
for(const binary of [0,1])for(const real of [-2,3]){
 const m=new LinearModel(),b=m.variable('b'),x=m.variable('x',-3,5,'continuous'),p=m.product(b,x);
 assert.equal(m.or(b,m.and(b,m.not(b))),b);
 m.constrain(b,'==',binary);m.constrain(x,'==',real);
 const result=await solveLinearModel(m.cip(p),{createRuntime,seconds:1});
 assert.equal(result.status,'optimal');assert.equal(result.errorCount,0);assert.equal(result.values[p]??0,binary?real:0);
}
// Removing a temporary phase constraint must not reuse a permanent row name.
const m=new LinearModel(),b=m.variable('b');m.constrain(b,'<=',1,'same');const old=m.constraints[0].name;m.constraints=[];m.constrain(b,'>=',0,'same');assert.notEqual(old,m.constraints[0].name);
console.log('SCIP Boolean identities, exact signed binary products, runtime startup and unique phase constraint names pass.');
// The finite main-stat lookup must preserve the source response above 100.
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json'));
const aug=catalog.weapons.find(w=>w.name.includes('AUG'));
assert(aug);
const original=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/'+aug.id+'.json'));
let highValue;
for(const desired of [100,110]){
 const pack=structuredClone(original),base=kernel.u(pack,curves.o(pack,[],'bd'),{mode:'bd',tacticalEffective:true,tunes:{}}).numeric.mainAttr['3'];
 pack.effectsByItemId[pack.weaponId].bd.push({operation:'StaticAttributeModify',target:'WeaponMainAttribute.MainAttrValues.3',modifier:'Addend',value:desired-base,scope:'NONE'});
 const request={mode:'bd',budget:catalog.shop.weapons[aug.id].gunsmithLimit,validationConfig:[],validationTunes:{}};
 const compiled=compileMounts({pack,shop:catalog.shop,prices:catalog.prices,request},kernel),numeric=compileStats(compiled,{pack,request},{kernel,curves});
 const result=await solveLinearModel(compiled.model.cip(0),{createRuntime,seconds:2});assert.equal(result.status,'optimal');assert.equal(result.errorCount,0);
 const expected=kernel.u(pack,curves.o(pack,[],'bd'),{mode:'bd',tacticalEffective:true,tunes:{}});
 assert.equal(result.values[numeric.stats['3']],desired);
 assert(Math.abs(result.values[numeric.targets.GRecoil_H]-expected.value('GRecoil_H'))<1e-8);
 if(desired===100)highValue=expected.value('GRecoil_H');else assert.notEqual(highValue,expected.value('GRecoil_H'),'Above-100 AUG recoil was incorrectly clamped');
}
console.log('SCIP exact source lookup preserves AUG Control response from 100 to 110.');
