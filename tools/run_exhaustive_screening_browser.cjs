const {chromium}=require('../.scratch/browser-qa/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path');
if(process.env.SCREENING_DOMINANCE&&process.env.SCREENING_DOMINANCE!=='0')throw Error('Dominance is disabled for exhaustive screening.');
const dominance=false;
const output=path.resolve(process.env.SCREENING_OUTPUT??'data/optimizer_validation/m4a1_exhaustive_screening_current');fs.mkdirSync(output,{recursive:true});
const save=(name,value)=>{const target=path.join(output,name),temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,target);};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 await page.exposeFunction('recordScreeningProgress',data=>{save('latest.json',data);fs.appendFileSync(path.join(output,'progress.ndjson'),JSON.stringify({...data.latest,count:data.count,status:data.status})+'\n');console.log(JSON.stringify({seconds:data.latest.wall_seconds,scored:data.latest.scored,nodes:data.latest.nodes,total:data.count?.total,percent:data.latest.fraction===null?null:100*data.latest.fraction,eta_hours:data.latest.projected_remaining_seconds===null?null:data.latest.projected_remaining_seconds/3600,status:data.status}));});
 page.on('pageerror',error=>{save('page-error.json',{message:error.message});console.error(error);});
 await page.goto('http://127.0.0.1:8770/github-pages-site/screening-study.html');await page.waitForFunction(()=>globalThis.screeningStudy);
 const metadata=await page.evaluate(async()=>({release:await fetch('./release.json').then(r=>r.json()),hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,userAgent:navigator.userAgent}));save('environment.json',metadata);
 await page.evaluate(async dominance=>{const {startScreening,screeningFixture}=await import('./screening-study.js');return startScreening({workers:8,request:{...screeningFixture,experimental_dominance:dominance}});},dominance);
 const result=await page.evaluate(()=>globalThis.screeningStudy);save('final.json',result);await page.screenshot({path:path.join(output,'screening-final.png'),fullPage:true});
 console.log('Exhaustive study',result.status,'browser remains open');await new Promise(resolve=>browser.on('disconnected',resolve));
})().catch(error=>{save('failure.json',{error:error.stack});console.error(error);process.exitCode=1;});
