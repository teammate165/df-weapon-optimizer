import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const directory=process.argv[2];
const curves=await import(pathToFileURL(path.join(directory,'curves.mjs')));
const kernel=await import(pathToFileURL(path.join(directory,'kernel.mjs')));
const {t:calculate}=await import(pathToFileURL(path.join(directory,'attributes.mjs')));
const pack=JSON.parse(fs.readFileSync(path.join(directory,'pack.json'),'utf8'));
const records=[];
const inventory=JSON.parse(fs.readFileSync(path.join(directory,'inventory.json'),'utf8'));
const definitions=new Map(inventory.definitions.map(d=>[`${d.item_id}/${d.tune_id}/${d.definition_sha256}`,d]));
const nonneutralDefaults=[];
let assertions=0;
const near=(actual,expected,label)=>{assert.ok(Math.abs(actual-expected)<=1e-10*Math.max(1,Math.abs(expected)),`${label}: ${actual} != ${expected}`);assertions++};

// Exhaustive catalog coverage: every declared mounting context and every curve.
for(const row of inventory.contexts){
 const definition=definitions.get(`${row.item_id}/${row.tune_id}/${row.definition_sha256}`);
 const control={...definition.raw_tune,enabled:row.enabled,notch:row.notch,
  range:{minValue:row.min_value,maxValue:row.max_value,defaultValue:row.default_value,step:row.step}};
 assert.ok(Number.isFinite(row.min_value)&&Number.isFinite(row.max_value)&&row.min_value<=row.max_value);assertions++;
 const normalizedDefault=curves.t(control,undefined);
 near(normalizedDefault,row.default_value,'catalog contextual default');
 for(const value of [row.min_value,row.default_value,row.max_value]){
  const normalized=curves.t(control,value);
  assert.ok(Number.isFinite(normalized));assertions++;
  for(const fn of control.functions||[]){
   const output=curves.r(definition.curves[fn.curveId],normalized);
   assert.ok(Number.isFinite(output));assertions++;
   if(value===row.default_value&&Math.abs(output)>1e-12)nonneutralDefaults.push({item_id:row.item_id,tune_id:row.tune_id,context:row.context,target:fn.target,value:output});
  }
 }
}

// Analytic formula and operation precedence, independent of actual weapon values.
const buckets=new Map();
for(const [modifier,value] of [['Initial',120],['Initial',130],['Addend',10],['Addend',-5],['Mult_A',.1],['Mult_A',.2],['Mult_C',.9],['Mult_C',.8]])kernel.k(buckets,'target',modifier,value);
near(kernel.A(buckets,'target',100),(130+10-5)*(1+.1+.2)*.9*.8,'bucket algebra');
kernel.k(buckets,'target','Mult_B',999);near(kernel.A(buckets,'target',100),126.36,'unsupported Mult_B ignored by source');

const continuous={range:{minValue:-10,maxValue:10,defaultValue:0,step:.2},sliderType:'Continue'};
near(curves.t(continuous,99),10,'continuous upper clamp');
near(curves.t(continuous,-99),-10,'continuous lower clamp');
near(curves.t(continuous,.13),.13,'continuous off-step input retained');
near(curves.t(continuous,undefined),0,'missing input default');
near(curves.t({...continuous,enabled:false},8),0,'disabled default');
const discrete={range:{minValue:-50,maxValue:50,defaultValue:0,step:1},sliderType:'Discrete',notch:12.5};
near(curves.t(discrete,19),25,'discrete notch quantization');
near(curves.t(discrete,-6.25),0,'negative-half uses JavaScript rounding');
assert.equal(curves.n(continuous).length,101);assertions++;
assert.equal(curves.n(discrete).length,9);assertions++;

const linear={points:[{inputValue:0,outputValue:0},{inputValue:2,outputValue:4}]};
near(curves.r(linear,1),2,'linear interpolation');
near(curves.r(linear,-1),0,'curve lower clamp');
near(curves.r(linear,9),4,'curve upper clamp');
const cubic={points:[{inputValue:0,outputValue:0,interpolationMode:'RCIM_Cubic',leaveTangent:0},{inputValue:2,outputValue:4,arriveTangent:0}]};
near(curves.r(cubic,.5),.625,'cubic Hermite segment');

const config=[{slotPath:'2',itemId:'13020000173'},{slotPath:'1',itemId:'13030000109'}];
const build=curves.o(pack,config);
assert.ok(build.mounted.some(x=>x.itemId==='13020000173'));assertions++;
assert.ok(build.mounted.some(x=>x.itemId==='13030000109'));assertions++;
const controls=[];
for(const mounted of build.mounted){
 for(const tuneId of pack.parts[mounted.itemId]?.tuneIds||[]){
  const control=curves.c(pack,mounted,tuneId);
  if(control?.enabled!==false)controls.push({mounted,tuneId,control});
 }
}
const defaults={};
for(const {mounted,tuneId,control} of controls)(defaults[mounted.slotPath]??={})[tuneId]=control.range.defaultValue;
const barrelLength=controls.find(c=>c.mounted.itemId==='13020000173'&&c.tuneId.includes(':length:'));
const barrelWeight=controls.find(c=>c.mounted.itemId==='13020000173'&&c.tuneId.includes(':weight:'));
assert.ok(barrelLength&&barrelWeight);assertions++;

for(const mode of ['sol','mp','bd']){
 const options={mode,resolvedLoadout:build,preservePrecision:true};
 const baseline=calculate(pack,{...options,tunes:{}});
 assert.deepEqual(calculate(pack,{...options,tunes:defaults}).current,baseline.current);assertions++;
 for(const parameter of [barrelLength,barrelWeight]){
  const {mounted,tuneId,control}=parameter;
  for(const value of [control.range.minValue,control.range.maxValue]){
   const tunes={[mounted.slotPath]:{[tuneId]:value}};
   const resolved=kernel.u(pack,build,{mode,tunes});
   const operations=resolved.operations.filter(o=>o.sourceTuneId===tuneId);
   assert.equal(operations.length,control.functions.length);assertions++;
   for(const operation of operations){
    const fn=control.functions.find(f=>f.target===operation.target&&f.modifier===operation.modifier);
    let expected=curves.r(pack.curves[fn.curveId],value);
    if(fn.target==='GBullet_Velocity')expected=Math.fround(expected);
    near(operation.value,expected,'source curve -> tune operation');
   }
   const result=calculate(pack,{...options,tunes});
   records.push({mode,item_id:mounted.itemId,tune_id:tuneId,value,
    default:{ads_ms:baseline.current.handling.adsTimeMs,velocity_mps:baseline.current.panel.muzzleVelocity},
    current:{ads_ms:result.current.handling.adsTimeMs,velocity_mps:result.current.panel.muzzleVelocity},operations});
   const velocity=operations.find(o=>o.target==='GBullet_Velocity');
   if(velocity){
    const noTune=kernel.u(pack,build,{mode,tunes:{}});
    near(resolved.value('GBullet_Velocity'),noTune.value('GBullet_Velocity')*(1+velocity.value),'velocity tuning is post-combined');
   }
  }
 }
 // Two sliders/two parts: use maximum enabled values simultaneously.
 const combined={};
 for(const {mounted,tuneId,control} of controls)(combined[mounted.slotPath]??={})[tuneId]=control.range.maxValue;
 const result=kernel.u(pack,build,{mode,tunes:combined});
 const ordinary=result.operations.filter(o=>!(o.sourceTuneId&&o.target==='GBullet_Velocity'));
 for(const target of ['GAiming_ADSTime','GGunkickRandom','GGunkickSpring','GMovement_ADSSpeed']){
  const bucket=result.numeric.buckets.get(target);
  const base=result.baseTargets[target]||0;
  const expected=bucket?((bucket.initial===undefined?base:bucket.initial)+bucket.addend)*(1+bucket.multA)*bucket.multC:base;
  near(result.value(target),expected,`ordinary combined bucket ${target}`);
 }
 // Rebuild same build without calibration; defaults must not alter selections.
 assert.deepEqual(result.appliedParts,kernel.u(pack,build,{mode,tunes:{}}).appliedParts);assertions++;
}

// Actual contextual disabled and discrete definitions, wherever present in this build.
for(const mounted of build.mounted){
 for(const tuneId of pack.parts[mounted.itemId]?.tuneIds||[]){
  const control=curves.c(pack,mounted,tuneId);
  assert.ok(control);assertions++;
 }
}
fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify({assertions,weapon_id:pack.weaponId,
 modes:['sol','mp','bd'],config,records,catalog_contexts_checked:inventory.contexts.length,
 catalog_definitions_checked:inventory.definitions.length,nonneutralDefaults,
 scope:'Executable source verification; not Global-client measurement.'},null,2));
console.log(`PASS: ${assertions} source assertions; defaults/endpoints/stacking in sol, mp, bd; ${records.length} recorded comparisons`);
