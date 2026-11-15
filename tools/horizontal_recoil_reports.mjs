import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
import {timedRecoil} from './timed_recoil.mjs';

const root=new URL('../',import.meta.url);
const input=JSON.parse(fs.readFileSync(process.argv[2]??new URL('.scratch/horizontal-recoil/all-base-packs.json',root)));
const rows=[];
const distance=points=>Math.max(...points.map(p=>Math.abs(p.x)));
assert.equal(distance([{x:-1},{x:2},{x:-1}]),2);
assert.equal(distance([{x:1},{x:3}]),3);
assert.equal(distance([{x:-3},{x:-1}]),3);
assert.equal(distance([{x:0},{x:0}]),0);
for(const {pack,name} of input.weapons)for(const mode of ['bd','sol','mp']) {
  const build=curves.o(pack,[],mode),windows={};
  let automatic=false;
  for(const shots of [10,20]) {
    const path=timedRecoil(pack,build,{}, {mode,shot_count:shots},{curves,kernel,calculate});
    automatic=path.fire_control.supportedModes.includes('Auto');
    const xs=path.points?.map(p=>p.x);
    if(xs) { assert.equal(xs.length,shots); assert.ok(xs.every(Number.isFinite)); }
    windows[shots]={status:path.status,reason:path.reason??null,
      horizontal_distance:xs?distance(path.points):null,
      min_x:xs?Math.min(...xs):null,max_x:xs?Math.max(...xs):null,
      points:path.points??null};
  }
  if(windows[10].points&&windows[20].points) {
    assert.deepEqual(windows[10].points,windows[20].points.slice(0,10));
    assert.ok(windows[10].horizontal_distance<=windows[20].horizontal_distance+1e-12);
  }
  rows.push({weapon_id:pack.weaponId,name,mode,automatic,windows});
}
assert.equal(rows.length,input.weapons.length*3);
for(const r of rows.filter(r=>r.mode==='bd'))for(const mode of ['sol','mp']) {
  assert.deepEqual(rows.find(s=>s.weapon_id===r.weapon_id&&s.mode===mode).windows,r.windows);
}
const f=n=>n.toFixed(4);
for(const shots of [20,10]) {
  const filename=shots===20?'horizontal_recoil':'horizontal_recoil_first_10';
  const url=new URL(`docs/${filename}.md`,root);
  const marker='<!-- historical-decisions -->';
  const existing=fs.existsSync(url)?fs.readFileSync(url,'utf8'):'';
  const history=existing.includes(marker)?existing.slice(existing.indexOf(marker)):'';
  const base=rows.filter(r=>r.mode==='bd'&&r.automatic);
  const ranked=base.filter(r=>r.windows[shots].status==='modeled').sort((a,b)=>b.windows[shots].horizontal_distance-a.windows[shots].horizontal_distance||a.weapon_id.localeCompare(b.weapon_id));
  const lines=[`# Horizontal recoil: first ${shots} bullets`,'',
    '[20-bullet horizontal travel speed ranking](horizontal_recoil_speed.md). Speed is the newly proposed threshold metric; the distance table below remains a separate diagnostic.','',
    '**Current metric: maximum horizontal distance from the pre-fire origin**, `H = max(abs(x_i))`, with origin `x=0`. Use the first '+shots+' cumulative post-shot ADS points, including the first-shot impulse without recentering. Left and right count equally. Repeated travel does not accumulate. Left-to-right span is obsolete for ranking.','',
    `Source snapshot: \`${input.data_version}\`. Resolved base configurations with source defaults and no user tuning. Units are source-model units, not calibrated angles or client measurements. Highest distance ranks first; lower is better.`, '',
    'Reproduce both reports and JSON: `python tools/calculate_horizontal_recoil.py`. Requires the local SQLite/source catalog and preserved `.scratch/calibration-check/` runtime. All three modes have identical trajectories and availability in this snapshot; the table shows Detonation.','',
    `${ranked.length} automatic weapons ranked; ${base.length-ranked.length} automatic weapons unavailable for this uninterrupted window. Nonautomatic weapons are excluded because no prescribed single/burst cadence is modeled. No reloads or silent window shortening.`, '',
    shots===20?'[First-10-bullet report](horizontal_recoil_first_10.md) | [All-mode data and trajectories](../data/horizontal_recoil.json)':'[Consolidated 20-bullet report and scoring history](horizontal_recoil.md) | [All-mode data and trajectories](../data/horizontal_recoil.json)', '',
    shots===20?'The earlier audit reproduced all 207 weapon/mode statuses and old available spans. Switching to origin distance changed 30 of 36 ranks. The old span threshold is obsolete. Lowest Recoil now uses pattern = V + multiplier * H, with H equal to origin distance and candidate fastest-200ms speed selecting multiplier 1 (<=3), 2 (>3), 3 (>4), or 5 (>5) model units/s. Default normalization and 40/30/30 component weights remain. See [current optimizer contract](recoil_generator.md#current-horizontal-speed-tiers-2026-11-15). This table ranks base horizontal distance, not combined scores.':'This is an opening-window diagnostic, not a replacement optimizer firing protocol. The 20-bullet threshold is not applied to this shorter window. All available 10-point paths exactly match the first 10 points of their corresponding 20-point paths, and their maximum distances cannot exceed the 20-point values.', '',
    '| Rank | Weapon | Weapon ID | Horizontal distance | Min x | Max x |',
    '| ---: | --- | --- | ---: | ---: | ---: |'];
  ranked.forEach((r,i)=>{const m=r.windows[shots];lines.push(`| ${i+1} | ${r.name} | \`${r.weapon_id}\` | ${f(m.horizontal_distance)} | ${f(m.min_x)} | ${f(m.max_x)} |`);});
  lines.push('','## Unavailable automatic weapons','');
  for(const r of base.filter(r=>r.windows[shots].status!=='modeled'))lines.push(`- ${r.name} (\`${r.weapon_id}\`): ${r.windows[shots].reason}.`);
  if(!base.some(r=>r.windows[shots].status!=='modeled'))lines.push('None.');
  lines.push('','Validation: all weapon/mode rows evaluated; exact cross-mode trajectory/status agreement; finite distances; asymmetric, one-sided and zero synthetic checks; 10/20-point prefix identity and distance monotonicity. Human perception and Global/Garena client validation remain open.','');
  fs.writeFileSync(url,lines.join('\n')+history);
  console.log(`${filename}: ${ranked.length} ranked, ${base.length-ranked.length} unavailable`);
}
fs.writeFileSync(new URL('data/horizontal_recoil.json',root),JSON.stringify({data_version:input.data_version,definition:'max(abs(x_i)), pre-fire x=0, cumulative post-shot ADS points',windows:[10,20],configuration:'Resolved base, no user tuning',global_verified:false,rows},null,2)+'\n');
