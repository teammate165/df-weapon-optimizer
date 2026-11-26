const {chromium}=require('../.scratch/browser-qa/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');

(async()=>{
 const url=process.env.PRESET_WEIGHTS_URL??'http://127.0.0.1:8786/';
 const coordinate=process.env.PRESET_WEIGHTS_COORDINATE==='1';
 const local=process.env.PRESET_WEIGHTS_STATIC!=='1';
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const idle=()=>page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false'&&document.querySelector('.slot-tile'),null,{timeout:60000});
  const slider=metric=>page.locator(`#optimizer-weight-${metric}`);
  const number=metric=>page.locator(`#optimizer-value-${metric}`);
  const values=()=>page.locator('[data-weight]').evaluateAll(inputs=>inputs.map(input=>Number(input.value)));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await idle();
  await page.click('#optimizer-tab');
  assert.deepEqual(await values(),[40,30,30]);
  await slider('pattern').press('ArrowLeft');
  assert.deepEqual(await values(),[39,31,30]);
  assert.equal(await number('pattern').inputValue(),'39');
  await number('pattern').fill('');
  assert(await page.locator('#generate').isDisabled());
  await number('pattern').fill('101');
  assert(await page.locator('#generate').isDisabled());
  await number('pattern').fill('38');
  assert.equal(await slider('pattern').inputValue(),'38');
  assert(await page.locator('#generate').isEnabled());
  await page.selectOption('#optimizer-preset','agility');
  assert.deepEqual(await values(),[50,30,20]);
  await page.selectOption('#optimizer-preset','recoil');
  assert.deepEqual(await values(),[38,31,31]);
  await page.click('#reset-optimizer-weights');
  assert.deepEqual(await values(),[40,30,30]);
  await number('pattern').fill('100');
  assert.deepEqual(await values(),[100,0,0]);
  await slider('pattern').press('ArrowLeft');
  assert.deepEqual(await values(),[99,1,0]);
  await number('pattern').fill('40');
  assert.deepEqual(await values(),[40,30,30]);
  await number('camera').fill('50');
  assert.deepEqual(await values(),[29,50,21]);
  await page.click('#reset-optimizer-weights');
  const method=page.locator('#optimizer-search-method');
  assert.equal(await method.inputValue(),'coordinate_passes');
  assert.equal(await page.locator('#solver-time-limit').inputValue(),local?'0':'30');
  assert(await page.locator('#optimizer-pass-options').isVisible());
  assert(await page.locator('#optimizer-time-options').isHidden());
  assert.deepEqual(await page.locator('#optimizer-passes option').evaluateAll(options=>options.map(option=>option.value)),['6','12','20']);
  assert.equal(await page.locator('#optimizer-passes').inputValue(),'12');
  const generate=page.locator('#generate'),cancel=page.locator('#cancel-generate');
  await generate.scrollIntoViewIfNeeded();
  const generatePosition=await generate.evaluate(button=>[button.offsetTop,button.offsetWidth,button.offsetHeight]);
  await generate.click();
  assert(await generate.isHidden());
  assert.deepEqual(await cancel.evaluate(button=>[button.offsetTop,button.offsetWidth,button.offsetHeight]),generatePosition);
  assert.match(await cancel.evaluate(button=>getComputedStyle(button).backgroundColor),/^rgb\((185, 47, 56|162, 37, 46)\)$/);
  await cancel.click();
  await generate.waitFor();
  assert(await cancel.isHidden());
  assert.match(await page.locator('#results').innerText(),/Search cancelled/);
  if(!coordinate)await method.selectOption('anytime');
  const checked=[];
  for(const [preset,settings,expectedWeights] of [
   ['recoil',{pattern:0,camera:100,kick:0},{pattern:0,camera:1,kick:0}],
   ['agility',{handling:0,accuracy:100,recoil:0},{handling:0,accuracy:1,recoil:0}]
  ]){
   if(coordinate){
    await page.setViewportSize({width:1440,height:900});
    await page.click('#builder-tab');
    await page.click('#reset');
    await idle();
    await page.locator('[data-slot="1"]').click();
    await page.locator('[data-part="13030000109"]').click();
    await page.click('#equip');
    await page.click('#keep-slot');
    for(const path of ['2','38']){
     await page.locator(`[data-slot="${path}"]`).click();
     await page.click('#keep-slot');
     assert.equal(await page.locator('#keep-slot').getAttribute('aria-pressed'),'true');
    }
    await page.click('#optimizer-tab');
   }
   await page.setViewportSize(preset==='recoil'?{width:1440,height:900}:{width:390,height:844});
   await page.selectOption('#optimizer-preset',preset);
   await number(Object.keys(settings).find(metric=>settings[metric]===100)).fill('100');
   assert(await page.locator('fieldset.optimizer-weights').isVisible());
   assert(await page.locator('#optimizer-weight-sliders input').evaluateAll(inputs=>inputs.every(input=>{
    const {left,right,width}=input.getBoundingClientRect();
    return width>0&&left>=0&&right<=innerWidth;
   })));
   if(coordinate){
    await page.selectOption('#optimizer-passes','6');
    await page.locator('#minimum-handling').fill('25');
    if(preset==='recoil')await page.check('#pattern-reduction');
   }else await page.selectOption('#solver-time-limit','5');
   await page.click('#generate');
   await page.locator('[data-apply]').waitFor({timeout:180000});
   await idle();
   await page.click('#save-result-build');
   await page.locator('#save-build-form button[type=submit]').click();
   assert.match(await page.locator('#saved-build-status').innerText(),/^Saved /);
   await page.click('#close-saved-builds');
   await page.click('[data-apply]');
   await idle();
   await page.click('#open-saved-builds');
   const [download]=await Promise.all([page.waitForEvent('download'),page.click('#export')]);
   await page.click('#close-saved-builds');
   const exported=JSON.parse(await fs.readFile(await download.path(),'utf-8'));
   const run=exported.optimization,row=run.results.find(row=>row.status==='best_found');
   const weights=preset==='recoil'?run.weights:run.weights.objectives;
   assert.equal(exported.request.preset,preset);
   if(coordinate){
    assert.equal(run.search_method,'coordinate_passes');
    assert.equal(exported.request.search_method,run.search_method);
    assert.equal(exported.request.passes,6);
    assert.equal(run.solver.passes,6);
    assert.equal(run.solver.global_optimality,false);
    assert(run.solver.runs.every(run=>run.completed_passes<=6));
    assert.deepEqual(run.solver.runs.map(run=>run.direction),['Max',...Array.from({length:5},()=>['Reduce cost','Build from locks']).flat()]);
    assert.deepEqual(run.request.fixed,[
     {slotPath:'1',itemId:'13030000109'},
     {slotPath:'2',itemId:'13020000344',keepDefault:true},
     {slotPath:'38',itemId:'',keepDefault:true}
    ]);
    const feasible=run.results.filter(row=>row.status==='best_found');
    for(const candidate of feasible){
     assert(candidate.stats.handling>=25&&candidate.cost<=candidate.budget);
     assert(candidate.config.some(part=>part.slotPath==='1'&&part.itemId==='13030000109'));
     if(preset==='recoil')assert(candidate.components.pattern<=run.pattern_constraint.maximum);
     if(candidate.label!=='Max')assert(candidate.score+1e-8>=row.score*run.cheapest_gate_percent/100);
    }
    const evaluations=await page.evaluate(async ({request,local,rows})=>{
     const client=local?null:(await import('./static-client.js')).createStaticClient();
     const evaluate=payload=>local?fetch('/api/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(response=>response.json()):client('evaluate',payload);
     try{return await Promise.all(rows.map(({config,tunes})=>evaluate({...request,config,tunes}))); }
     finally{await client?.('dispose');}
    },{request:exported.request,local,rows:feasible});
    for(const [i,replayed] of evaluations.entries()){
     const candidate=feasible[i];
     assert.deepEqual(replayed.build.config,candidate.config);
     assert(replayed.build.mounted.some(m=>m.slotPath==='2'&&m.itemId==='13020000344'&&m.source==='default'));
     assert(replayed.build.slots.some(s=>s.slotPath==='38'));
     assert(!replayed.build.mounted.some(m=>m.slotPath==='38'));
     assert.deepEqual(replayed.effective_stats,candidate.stats);
     assert.equal(replayed.cost,candidate.cost);
     assert.equal(replayed.optimization.loss,candidate.loss);
     for(const [slot,tunes] of Object.entries(candidate.tunes))for(const [id,value] of Object.entries(tunes))assert.equal(replayed.tunes[slot][id],value);
    }
   }else assert.equal(run.solver.name,'Anytime');
   assert.deepEqual(exported.model.build.config,row.config);
   for(const [slot,tunes] of Object.entries(row.tunes))for(const [id,value] of Object.entries(tunes))assert.equal(exported.model.tunes[slot][id],value);
   assert.deepEqual(weights,expectedWeights);
   assert.deepEqual(exported.model.optimization.weights,run.weights);
   assert.equal(exported.model.cost,row.cost);
   assert.deepEqual(exported.model.effective_stats,row.stats);
   const expectedLoss=preset==='recoil'?100*row.components.camera/run.baseline.camera:100*row.components.accuracy/run.baseline.accuracy;
   assert(Math.abs(row.loss-expectedLoss)<1e-9);
   assert(Math.abs(exported.model.optimization.loss-expectedLoss)<1e-9);
   const replay=await page.evaluate(async ({request,local})=>{
    const evaluate=local?async payload=>fetch('/api/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(r=>r.json()):
     (await import('./static-client.js')).createStaticClient();
    const call=payload=>local?evaluate(payload):evaluate('evaluate',payload);
    const {preset,weights,objective_weights,...legacy}=request;
    return Promise.all([call(request),call({...legacy,preset}),call(legacy)]);
   },{request:exported.request,local});
   assert.equal(replay[0].optimization.score,exported.model.optimization.score);
   assert.notEqual(replay[1].optimization.score,replay[0].optimization.score);
   assert.equal(replay[2].optimization,undefined);
   assert.deepEqual(replay[2].build.config,exported.request.config);
   await page.click('#optimizer-tab');
   await page.click('#reset-optimizer-weights');
   if(coordinate)await method.selectOption('anytime');
   await page.click('#builder-tab');
   await page.click('#open-saved-builds');
   await page.locator('[data-load-build]').first().click();
   await idle();
   if(coordinate){
    await page.locator('[data-slot="38"]').click();
    assert.equal(await page.locator('#keep-slot').getAttribute('aria-pressed'),'true');
   }
   await page.click('#optimizer-tab');
   assert.equal(await page.locator('#optimizer-preset').inputValue(),preset);
   assert.deepEqual(await values(),Object.values(settings));
   assert.equal(await method.inputValue(),coordinate?'coordinate_passes':'anytime');
   if(coordinate)assert.equal(await page.locator('#optimizer-passes').inputValue(),'6');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   checked.push({preset,weights,score:row.score,cost:row.cost,elapsed_ms:run.solver.elapsed_ms,results:run.results.map(({label,status,cost,score})=>({label,status,cost,score}))});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({url,coordinate,checked,desktopMobile:true,legacyReplay:true,savedBuildReplay:true}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
