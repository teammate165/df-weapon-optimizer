const {chromium}=require('../.scratch/browser-qa/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],api=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.includes('/api/'))api.push(r.url());});
  const url=process.env.STATIC_SITE_URL||'http://127.0.0.1:8770/multistart-site/';
  await page.goto(url);await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false'&&document.querySelector('.slot-tile'),null,{timeout:120000});
  await page.click('#choose-weapon');await page.click('[data-weapon="18020000002"]');await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false');
  await page.click('#optimizer-tab');assert.match(await page.locator('#optimizer-search-note').innerText(),/Multi-start.*Best found/);
  await page.selectOption('#passes','6');await page.click('#generate');await page.waitForSelector('#cancel-generate:visible');
  await page.click('#cancel-generate');await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false');
  assert.match(await page.locator('#results').innerText(),/cancelled/i);assert(await page.locator('#cancel-generate').isHidden());assert(await page.locator('#generate').isEnabled());
  const start=Date.now();await page.click('#generate');await page.waitForFunction(()=>!document.querySelector('#generate').disabled,null,{timeout:180000});
  assert(await page.locator('[data-apply]').count()>0,await page.locator('#results').innerText());
  const uiMs=Date.now()-start;
  const worker=await page.evaluate(async()=>{
   const release=await fetch('./release.json').then(r=>r.json()),{createStaticClient}=await import(`./static-client.js?v=${release.version}`),client=createStaticClient();
   const controller=new AbortController(),cancelled=client('optimize',{weapon_id:'18010000001',mode:'bd',preset:'recoil',passes:20},{signal:controller.signal});
   setTimeout(()=>controller.abort(),150);
   let aborted=false;try{await cancelled;}catch(e){aborted=e.name==='AbortError';}
   const catalog=await client('catalog'),runs=[];
   for(const preset of ['recoil','agility']){
    const t=performance.now(),result=await client('optimize',{weapon_id:'18010000001',mode:'bd',preset,passes:2});
    const replays=[];for(const row of result.results.filter(r=>r.status==='best_found')){const replay=await client('evaluate',{weapon_id:result.weapon_id,mode:'bd',config:row.config,tunes:row.tunes});replays.push({cost:replay.cost,stats:replay.effective_stats});}
    runs.push({preset,ms:performance.now()-t,result,replays});
   }
   return {aborted,weapons:catalog.weapons.length,runs,release:release.version};
  });
  assert(worker.aborted);assert.equal(worker.weapons,69);
  for(const run of worker.runs){assert(run.result.exploration.configurations>0);assert.equal(run.result.exploration.global_optimality,false);run.result.results.filter(r=>r.status==='best_found').forEach((r,i)=>{assert.equal(r.cost,run.replays[i].cost);assert.deepEqual(r.stats,run.replays[i].stats);});}
  for(const [width,height] of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));}
  assert.deepEqual(errors,[]);assert.deepEqual(api,[]);
  const report={passed:true,url,ui_ms:uiMs,...worker,errors,api};fs.writeFileSync(process.env.MULTISTART_REPORT||'.scratch/multistart-release/browser-local.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:true,url,release:worker.release,ui_ms:uiMs,checks:['UI cancel and regenerate','AbortSignal terminates worker and recovers catalog/evaluation','both presets and exact stat/cost replay','mobile overflow','no page errors/backend requests']}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
