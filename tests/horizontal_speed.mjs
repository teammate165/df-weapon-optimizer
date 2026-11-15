import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fastestHorizontalSpeed,horizontalSpeedMultiplier} from '../tools/horizontal_speed.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
import {timedRecoil} from '../tools/timed_recoil.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
for(const [speed,m] of [[0,1],[3,1],[3+1e-9,2],[4,2],[4+1e-9,3],[5,3],[5+1e-9,5]])assert.equal(horizontalSpeedMultiplier(speed),m);
for(const s of [-1,NaN,Infinity])assert.throws(()=>horizontalSpeedMultiplier(s));
const pulse=[{time_ms:0,x:0},{time_ms:200.25,x:0},{time_ms:400.25,x:2},{time_ms:600.5,x:2}];
const peak=fastestHorizontalSpeed(pulse);
near(peak.speed,10);near(peak.start_ms,200.25);
near(fastestHorizontalSpeed(pulse.map(p=>({...p,x:-p.x+17}))).speed,10);
near(fastestHorizontalSpeed(Array.from({length:20},(_,i)=>({time_ms:i*100,x:i%2}))).speed,0);
assert.throws(()=>fastestHorizontalSpeed(pulse.slice(0,1)));
assert.throws(()=>fastestHorizontalSpeed([{time_ms:0,x:0},{time_ms:100,x:1}]));
const source=JSON.parse(fs.readFileSync(new URL('../data/horizontal_recoil.json',import.meta.url)));
const audit=JSON.parse(fs.readFileSync(new URL('../data/horizontal_window_speed.json',import.meta.url)));
for(const r of source.rows)if(r.windows['20'].points){
  const p=fastestHorizontalSpeed(r.windows['20'].points);
  near(p.speed,audit.rows.find(a=>a.weapon_id===r.weapon_id&&a.mode===r.mode).metrics.windows['200'].fastest_speed);
}
const input=JSON.parse(fs.readFileSync(new URL('../.scratch/horizontal-recoil/all-base-packs.json',import.meta.url)));
let chart=0,legacy=0;
for(const {pack} of input.weapons)for(const mode of ['bd','sol','mp']) {
  const resolve=config=>curves.o(pack,config,mode),context={pack,mode,resolve,kernel,curves,calculate,request:{}};
  const preset=presets.recoil.create(context),c=preset.baseline;
  near(preset.score(c),100);
  if(c.pattern_model==='ads-chart-speed-tier-v2'){
    chart++;near(c.pattern,c.vertical_excursion+c.horizontal_multiplier*c.horizontal_distance);
    const expected=source.rows.find(r=>r.weapon_id===pack.weaponId&&r.mode===mode);
    near(c.horizontal_speed,fastestHorizontalSpeed(expected.windows['20'].points).speed);
  } else legacy++;
  const agility=presets.agility.create(context);
  near(agility.objectives(agility.baseline)[0],100);
}
assert.equal(chart,108);assert.equal(legacy,99);
const pack=input.weapons.find(r=>r.pack.weaponId==='18010000001').pack;
const mode='bd',resolve=config=>curves.o(pack,config,mode);
const context={pack,mode,resolve,kernel,curves,calculate};
assert.deepEqual(presets.recoil.create({...context,request:{shot_count:5}}).baseline,
  presets.recoil.create({...context,request:{shot_count:40}}).baseline);
const small=structuredClone(pack);
// Preserve the real resolver/profile; simulate capacity only at the calculator boundary.
const smallCalculate=(...args)=>{
  const result=calculate(...args);result.current.weaponStats.magazineCapacity=10;return result;
};
const build=resolve([]),modules={curves,kernel,calculate:smallCalculate};
assert.equal(timedRecoil(small,build,{}, {mode,shot_count:20},modules).status,'unavailable');
assert.equal(timedRecoil(small,build,{}, {mode,shot_count:20},modules,{abstractProfile:true}).points.length,20);
assert.equal(presets.recoil.create({...context,calculate:smallCalculate,request:{}}).baseline.pattern_model,'legacy-multiplier-v1');
console.log(`Speed boundaries, exact Python audit parity, all ${chart+legacy} default evaluations and agility baselines pass`);
