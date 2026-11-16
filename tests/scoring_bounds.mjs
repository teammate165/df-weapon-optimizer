import assert from 'node:assert/strict';
import fs from 'node:fs';
import {boundCannotBeat} from '../tools/scoring_bounds.mjs';
import {exhaustiveAttachmentGate} from '../tools/exhaustive_attachment_gate.mjs';
import {compileMounts} from '../tools/scip_mount_model.mjs';
import {createMountSearch} from '../tools/mount_search.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json')),modules={curves,kernel,calculate};
const worst={objectives:[50,20],stats:{control:10},score:50};
assert(!boundCannotBeat(50,worst.stats,worst));assert(!boundCannotBeat(50+1e-10,worst.stats,worst));assert(boundCannotBeat(51,worst.stats,worst));
assert(!boundCannotBeat(100,{control:20},worst,{control:20}));assert(boundCannotBeat(0,{control:0},worst,{control:20}));assert(!boundCannotBeat(NaN,worst.stats,worst));
let checked=0,unsupported=0;const reports=[];
for(const weapon of catalog.weapons){
 const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/'+weapon.id+'.json'));
 const configs=[...createMountSearch(compileMounts({pack,shop:catalog.shop,prices:catalog.prices,request:{mode:'bd',budget:20}},kernel)).enumerate()];
 for(const mode of ['bd','sol','mp']){
  const request={mode},resolve=c=>curves.o(pack,c,mode),preset=presets.recoil.create({pack,request,mode,resolve,...modules}),certificate=preset.screeningBound;
  if(!certificate){unsupported++;continue;}
  for(const config of configs){
   const build=resolve(config),state=kernel.u(pack,build,{mode,tacticalEffective:true,tunes:{}}),lower=certificate.lower(build,state);
   if(lower===null){unsupported++;continue;}
   const exact=preset.score(preset.raw(build,{},state));
   assert(lower<=exact,`${weapon.id}/${mode}: lower ${lower} exceeds source ${exact}`);
   assert(exact-lower<1e-6*Math.max(1,Math.abs(exact)),`${weapon.id}/${mode}: reconstruction drift`);checked++;
  }
 }
 reports.push({weapon_id:weapon.id,configurations:configs.length});
}
const original=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json'));
const profiles=[
 {continuousFire:{horizontalValues:[0,1,-2,3],verticalValues:[1,-2],horizontalScale:0,verticalScale:1.2},loop:{horizontalValues:[1,-3],verticalValues:[2,-1,3],horizontalScale:.75,verticalScale:0}},
 {singleShot:{horizontalValues:[1,9],verticalValues:[-2,9],horizontalScale:.8,verticalScale:.9},loop:{horizontalValues:[],verticalValues:[]}},
 ...[3,4,5].map(speed=>({continuousFire:{horizontalValues:[speed*10*original.weapon.fireControl.fireIntervalSeconds],verticalValues:[.125],horizontalScale:1,verticalScale:1}}))
];
for(const profile of profiles)for(const scale of [0,1e-9,-1,.75,1000000]){
 const pack=structuredClone(original),mode='bd',resolve=c=>curves.o(pack,c,mode),ref=kernel.u(pack,resolve([]),{mode}).references.adsRecoilProfileId;
 pack.handling.recoilProfiles[ref]=profile;
 for(const target of ['GRecoil_H','GRecoil_V'])pack.effectsByItemId[pack.weaponId][mode].push({operation:'StaticAttributeReplace',target,modifier:'Initial',value:scale,scope:'NONE'});
 for(const weights of [{pattern:.4,camera:.3,kick:.3},{pattern:1,camera:0,kick:0},{pattern:0,camera:.5,kick:.5}]){
  const request={mode,weights};let preset;
  try{preset=presets.recoil.create({pack,request,mode,resolve,...modules});}catch(error){assert(/zero baseline/.test(error.message));continue;}
  if(weights.pattern>0&&preset.baseline.pattern===0){assert.throws(()=>preset.score(preset.baseline),/zero baseline/);continue;}
  const build=resolve([]),state=kernel.u(pack,build,{mode,tacticalEffective:true,tunes:{}}),lower=preset.screeningBound?.lower(build,state);if(lower===undefined||lower===null)continue;
  const exact=preset.score(preset.raw(build,{},state));assert(lower<=exact);assert(exact-lower<1e-6*Math.max(1,Math.abs(exact)));checked++;
 }
}
// An unknown/wrapped calculator has no pinned native capability, even when
// its public API is compatible. It must keep ordinary full scoring.
{
 const pack=original,mode='bd',request={mode},resolve=c=>curves.o(pack,c,mode),wrapped=(...args)=>calculate(...args),preset=presets.recoil.create({pack,request,mode,resolve,curves,kernel,calculate:wrapped});
 assert.equal(preset.screeningBound,undefined);assert.equal(calculate.screeningChartContract.calculate,calculate);assert.equal(calculate.screeningChartContract.kernel.u,kernel.u);
}
// Replacing a future preset's raw/score/objectives invalidates its inherited
// certificate. Its ordinary exact scorer must continue to run on every row.
{
 const pack=original,mode='bd',request={mode,budget:20},resolve=c=>curves.o(pack,c,mode),base=presets.recoil.create({pack,request,mode,resolve,...modules});
 for(const changes of [{raw:(...args)=>base.raw(...args)},{score:c=>base.score(c)},{objectives:c=>base.objectives(c)}]){
  const preset={...base,...changes},result=exhaustiveAttachmentGate({pack,shop:catalog.shop,prices:catalog.prices,request},modules,preset);assert(!result.diagnostics.scoring.supported);assert.equal(result.diagnostics.scoring.full_evaluations,result.diagnostics.scoring.considered);
 }
}
fs.mkdirSync('.scratch/subtree-counting',{recursive:true});fs.writeFileSync('.scratch/subtree-counting/bounds-tests.json',JSON.stringify({passed:true,checked,unsupported,reports,checks:['all 69 weapons, all three modes, every low-budget configuration','native profile phases and loops','zero/negative/extreme axis scales','horizontal speed boundaries','weight overrides','ties and floor priority','future scorer override disables inherited bounds']},null,2));
console.log(`Scoring bounds stay below ${checked} full native scores; source phases/loops, tiers, scales, weights, ties and future-preset fallbacks pass.`);
