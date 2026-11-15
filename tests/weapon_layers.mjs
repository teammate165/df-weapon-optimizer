import fs from 'node:fs';
import assert from 'node:assert/strict';
import {unpackLayers,resolveLayerPoses,layerDirectory} from '../builder/weapon-layers.js';
import * as curves from '../.scratch/calibration-check/curves.mjs';
const input=JSON.parse(fs.readFileSync('.scratch/horizontal-recoil/all-base-packs.json'));
let checked=0,missing=0;
for(const {pack} of input.weapons) {
 const build=curves.o(pack,[],'bd');
 const file=`builder/assets/weapon-layers/${layerDirectory(pack.weaponId,build.mounted)}.json`;
 if(!fs.existsSync(file)){missing++;continue;}
 const catalog=unpackLayers(JSON.parse(fs.readFileSync(file)));
 const poses=resolveLayerPoses(catalog,build.mounted);
 assert(poses.length>0&&poses.every(p=>catalog.parts[p]));checked++;
}
assert.equal(missing,0,'All weapon layer metadata must be present');
assert.equal(checked,69);
console.log(`${checked} base weapon assemblies resolve`);
// Compare complex default and replacement mount graphs to the pinned source implementation.
const reference=await import('../.scratch/laser-portrait/reference-assembly.mjs');
let parity=0,sourceUnsupported=0;const exclusions=[];
for(const {pack} of input.weapons) {
 const base=curves.o(pack,[],'bd');
 const configs=[[],...base.slots.slice(0,5).flatMap(slot=>slot.options.slice(-2).map(itemId=>[{slotPath:slot.slotPath,itemId}]))];
 for(const config of configs) {
  const build=curves.o(pack,config,'bd');
  const file=`builder/assets/weapon-layers/${layerDirectory(pack.weaponId,build.mounted)}.json`;
  const raw=JSON.parse(fs.readFileSync(file));let expected;
  try{expected=reference.resolve(reference.unpack(raw),build.mounted);}catch(error){sourceUnsupported++;exclusions.push({weapon_id:pack.weaponId,config,reason:error.message});continue;}
  assert.deepEqual(resolveLayerPoses(unpackLayers(raw),build.mounted),expected,`${pack.weaponId} ${JSON.stringify(config)}`);parity++;
 }
}
console.log(`${parity} mount graphs match DFTTK exactly; ${sourceUnsupported} source-unsupported contexts excluded`);
fs.writeFileSync('.scratch/laser-portrait/assembly-parity.json',JSON.stringify({base_weapons:checked,parity_contexts:parity,exclusions},null,2));
