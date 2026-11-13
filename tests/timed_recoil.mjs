import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {summarizePath,timedRecoil} from '../tools/timed_recoil.mjs';

const directory=process.argv[2];
const input=JSON.parse(fs.readFileSync(path.join(directory,'input.json')));
const {pack}=input;
const curves=await import(pathToFileURL(path.join(directory,'curves.mjs')));
const kernel=await import(pathToFileURL(path.join(directory,'kernel.mjs')));
const {t:calculate}=await import(pathToFileURL(path.join(directory,'attributes.mjs')));
const modules={calculate,curves,kernel};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const metric=summarizePath([{time_ms:0,x:0,y:-1},{time_ms:2000,x:3,y:-7}]);
near(metric.climb_model_units_per_second,3);
near(metric.horizontal_span_model_units,3);
near(metric.maximum_distance_from_start_model_units,Math.sqrt(58));
near(summarizePath([{time_ms:0,x:0,y:0},{time_ms:1000,x:0,y:3}]).climb_model_units_per_second,0);

assert.equal(pack.weaponId,'18010000052');
for(const mode of ['sol','mp','bd']) {
  for(const config of [[],[{slotPath:'1',itemId:pack.assembly.socketProviders[pack.weaponId].sockets.find(s=>s.socketId===1).optionItemIds[0]}]]) {
    const build=curves.o(pack,config,mode);
    const result=timedRecoil(pack,build,{}, {mode,shot_count:20},modules);
    assert.equal(result.status,'modeled');
    const expected=calculate(pack,{mode,resolvedLoadout:build,preservePrecision:true,trajectoryShotCount:20}).current.recoil.adsTrajectory;
    assert.deepEqual(result.points.map(({x,y})=>({x,y})),expected);
    for(const [index,time] of [0,100/3,200/3,500/3,800/3].entries()) near(result.points[index].time_ms,time);
    for(let i=0;i<result.points.length;i++) assert.deepEqual(result.points[i].pre_shot_aim_proxy,i?expected[i-1]:{x:0,y:0});
    assert.equal(result.opening.shots,3);
    assert.equal(result.points.length,20);
  }
  const build=curves.o(pack,[],mode);
  const result=timedRecoil(pack,build,{}, {mode,shot_count:20},modules);
  near(result.points[0].y,-.045);near(result.points[1].y,-.1125);near(result.points[2].y,-.8925);
  near(result.points[2].pre_shot_aim_proxy.y,-.1125);
  near(result.points[3].pre_shot_aim_proxy.y,-.8925);
  assert.equal(timedRecoil(pack,build,{}, {mode,shot_count:31},modules).status,'unavailable');
  assert.equal(timedRecoil(pack,build,{}, {mode,firing:'spam'},modules).status,'unavailable');
  assert.throws(()=>timedRecoil(pack,build,{}, {mode,shot_count:1},modules));
}
console.log('PASS: AN94 all modes, timing, chart parity, pre-shot ordering, fixed attachment, invalid windows and independent metric arithmetic');
