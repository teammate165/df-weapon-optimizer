const {chromium}=require('../.scratch/browser-qa/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const local=process.env.ANYTIME_LOCAL==='1',url=process.env.ANYTIME_SITE_URL||process.env.STATIC_SITE_URL||'http://127.0.0.1:8770/github-pages-site/';
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],wasm=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('.wasm'))wasm.push(r.url());});
  await page.goto(url);await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false'&&document.querySelector('.slot-tile'),null,{timeout:60000});
  await page.click('#choose-weapon');await page.click('[data-weapon="18010000001"]');await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false');await page.click('#optimizer-tab');
  assert.match(await page.locator('#optimizer-search-note').innerText(),/Time-limited/);assert.match(await page.locator('#solver-time-limit').locator('..').innerText(),/Total search budget/);
  await page.selectOption('#solver-time-limit','5');await page.click('#generate');await page.waitForFunction(()=>/builds scored/.test(document.querySelector('#results').innerText),null,{timeout:15000});
  const progress=await page.locator('#results').innerText();assert(!/trillion|counted|all legal|ranking .* of/i.test(progress));
  await page.click('#cancel-generate');await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false');assert.match(await page.locator('#results').innerText(),/cancelled/);
  const started=Date.now();await page.click('#generate');await page.waitForFunction(()=>!document.querySelector('#generate').disabled,null,{timeout:15000});const uiMs=Date.now()-started;
  assert(uiMs<12000);assert(await page.locator('[data-apply]').count()>0,await page.locator('#results').innerText());assert.match(await page.locator('#optimizer-search-note').innerText(),/Global optimum unproven/);
  const checked=await page.evaluate(async local=>{
   let client,release=null;
   if(local){const {createLocalClient}=await import('./local-client.js');client=createLocalClient();}
   else{release=await fetch('./release.json').then(r=>r.json());const {createStaticClient}=await import(`./static-client.js?v=${release.version}`);client=createStaticClient();}
   const controller=new AbortController(),pending=client('optimize',{weapon_id:'18010000001',mode:'bd',time_limit_seconds:30},{signal:controller.signal});setTimeout(()=>controller.abort(),200);
   let aborted=false;try{await pending;}catch(error){aborted=error.name==='AbortError';}
   const catalog=local?await fetch('/api/catalog').then(r=>r.json()):await client('catalog'),runs=[];
   for(const preset of ['recoil','agility']){
    const events=[],start=performance.now(),result=await client('optimize',{weapon_id:'18010000001',mode:'bd',preset,time_limit_seconds:5},{onProgress:p=>events.push(p)}),elapsed=performance.now()-start;
    const replays=[];for(const row of result.results.filter(r=>r.status==='best_found')){const replay=await client('evaluate',{weapon_id:result.weapon_id,mode:'bd',config:row.config,tunes:row.tunes});replays.push({cost:replay.cost,stats:replay.effective_stats});}
    runs.push({preset,elapsed_ms:elapsed,result,replays,phases:[...new Set(events.map(p=>p.phase))]});
   }
   return {release:release?.version??null,aborted,weapons:catalog.weapons.length,runs};
  },local);
  assert(checked.aborted);assert.equal(checked.weapons,69);
  for(const run of checked.runs){
   assert(run.elapsed_ms<12000);assert.equal(run.result.solver.name,'Anytime');assert.equal(run.result.solver.time_limit_scope,'total_search');assert(!run.result.attachment_gate.complete);
   assert.deepEqual(run.phases,['search_attachments','search_tactical','calibration']);
   const d=run.result.attachment_gate.budgets[0];assert.equal(d.budget,800);assert(d.ordinary_storage_peak<=256);assert(d.complete_storage_peak<=512);assert(d.tactical_evaluated>0);assert(d.calibration_evaluations>0);
   const rows=run.result.results.filter(r=>r.status==='best_found');assert(rows.length);rows.forEach((row,i)=>{assert.equal(row.cost,run.replays[i].cost);assert.deepEqual(row.stats,run.replays[i].stats);assert(row.cost<=800);assert(!row.converged);});
  }
  await page.click('[data-apply]');await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false');
  for(const [width,height] of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));}
  assert.deepEqual(errors,[]);assert.deepEqual(wasm,[]);
  const report={passed:true,url,local,ui_ms:uiMs,progress,...checked,errors,wasm};fs.mkdirSync('.scratch/anytime-top-k',{recursive:true});fs.writeFileSync('.scratch/anytime-top-k/browser-'+(local?'local':'static')+'.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:true,url,release:checked.release,ui_ms:uiMs,checks:['Full-cap M4A1 Generate in total budget','both presets and exact source replay','bounded ordinary/tactical pools and calibration','cancel, recovery and Apply','honest best-found UI and mobile layout']}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
