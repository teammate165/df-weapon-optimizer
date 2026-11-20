import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import crypto from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {createOptimizedExactDag,exactDagWorkers} from './optimized_exact_dag.mjs';
import {createWeightedSelector,rankPrefix,createLocalityQueues,takeLocalityJob} from './exact_dag_storage.mjs';
import {createInputMissLog,analyzeInputMissLogs} from './exact_input_diagnostics.mjs';
import {createRankingHeap} from './ranked_screening_heap.mjs';
import {screeningComparator,survivorCount,rankingContract} from './screening_rank.mjs';

const json=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v,2);
const manifest=lines=>{const hash=crypto.createHash('sha256');for(const line of lines.sort())hash.update(line+'\n');return hash.digest('hex');};
const rowLine=row=>JSON.stringify([row.signature,row.objectives,row.score,row.cost]);
if(!isMainThread){
 const kernel=await import('../.scratch/calibration-check/kernel.mjs'),curves=await import('../.scratch/calibration-check/curves.mjs'),{t:calculate}=await import('../.scratch/calibration-check/attributes.mjs'),modules={kernel,curves,calculate};
 let engine=createOptimizedExactDag(workerData.input,modules),phase,k,heap,selector,files=[],materialized=0,spillBytes=0,inputLog;
 fs.mkdirSync(workerData.spill,{recursive:true});parentPort.postMessage({ready:true});
 parentPort.on('message',message=>{try{
  const began=performance.now();
  if(message.action==='plan'){parentPort.postMessage({result:engine.plan()});return;}
  if(message.action==='begin'){phase=message.phase;inputLog=phase==='optimized'?createInputMissLog(path.join(workerData.spill,'input-misses')):null;engine=createOptimizedExactDag(workerData.input,modules,{onInputMiss:inputLog?.record});k=message.k;heap=createRankingHeap(k,screeningComparator({}));selector=createWeightedSelector(k);files=[];materialized=0;spillBytes=0;parentPort.postMessage({result:true});return;}
  if(message.action==='job'){
   const job=message.job,lines=[];let result;
   if(phase==='reference'){
    result=engine.referenceJob(job,row=>{heap.offer(row);lines.push(rowLine(row));});
    result={...result,manifest:manifest(lines),terminal_classes:result.paths};
   }else{
    let packet,guardFallback=null;const computeStart=performance.now();try{packet=engine.runJob(job,message.expected_paths);}catch(error){guardFallback=error.message;packet=engine.fallbackJob(job);}
    const computeMs=performance.now()-computeStart;
    for(const cls of packet.classes)selector.add(cls,cls.mass);
    const rankMs=performance.now()-computeStart-computeMs,auditStart=performance.now();let audited=0;
    for(const row of engine.rows(packet)){lines.push(rowLine(row));audited++;}
    if(BigInt(audited)!==BigInt(packet.paths))throw Error('Full audit path mass mismatch');const digest=manifest(lines),auditMs=performance.now()-auditStart;
    delete packet.graph._rootMap;const bytes=v8.serialize(packet),filename=path.join(workerData.spill,'job-'+job.id+'.bin'),writeStart=performance.now();fs.writeFileSync(filename,bytes);spillBytes+=bytes.length;
    let minimum=null;for(const cls of packet.classes)if(!minimum||rankPrefix(cls,minimum)<0)minimum=cls;files.push({id:job.id,filename,minimum:minimum?{objectives:minimum.objectives,cost:minimum.cost}:null});
    result={id:job.id,kind:packet.kind,paths:packet.paths,terminal_classes:packet.terminal_classes,merges:packet.merges,guard_fallback:guardFallback,manifest:digest,compute_ms:computeMs,rank_class_ms:rankMs,audit_ms:auditMs,spill_ms:performance.now()-writeStart,spill_bytes:bytes.length};
   }
   inputLog?.flush();parentPort.postMessage({result:{...result,worker:workerData.id,wall_ms:performance.now()-began}});return;
  }
  if(message.action==='summary'){inputLog?.flush();parentPort.postMessage({result:{worker:workerData.id,stats:engine.stats(),input_log:inputLog?.stats(),groups:phase==='optimized'?selector.groups():undefined,rows:phase==='reference'?heap.rows():undefined,spill_bytes:spillBytes}});return;}
  if(message.action==='materialize'){
   heap=createRankingHeap(k,screeningComparator({}));let readBytes=0,readFiles=0;
   for(const file of files){if(!file.minimum||rankPrefix(file.minimum,message.threshold)>0)continue;const bytes=fs.readFileSync(file.filename),packet=v8.deserialize(bytes);readBytes+=bytes.length;readFiles++;for(const row of engine.rows(packet,message.threshold)){heap.offer(row);materialized++;}}
   parentPort.postMessage({result:{worker:workerData.id,rows:heap.rows(),materialized_paths:materialized,read_bytes:readBytes,read_files:readFiles,wall_ms:performance.now()-began}});return;
  }
  if(message.action==='replay'){for(const row of message.rows){const native=engine.nativeRow(JSON.parse(row.signature).map(([slotPath,itemId])=>({slotPath,itemId})));if(native.signature!==row.signature||native.cost!==row.cost||native.score!==row.score||native.objectives.some((v,i)=>v!==row.objectives[i]))throw Error('Uncached native survivor replay mismatch');}parentPort.postMessage({result:{worker:workerData.id,replayed:message.rows.length}});return;}
  throw Error('Unknown exact DAG action');
 }catch(error){parentPort.postMessage({error:error.stack});}});
}else{
 const budget=Number(process.env.EXACT_DAG_BUDGET??800),directory=process.env.EXACT_DAG_OUTPUT??'data/optimizer_validation/optimized_exact_dag_20261118/full',workers=exactDagWorkers,run=Date.now().toString(36),spillRoot=path.resolve('.scratch/optimized-exact-dag-spill/'+run),save=(name,data)=>fs.writeFileSync(directory+'/'+name,json(data));
 fs.mkdirSync(directory,{recursive:true});const catalog=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json','utf8')),pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json','utf8')),input={pack,shop:catalog.shop,prices:catalog.prices,request:{mode:'bd',preset:'recoil',budget,fixed:[{slotPath:'11',itemId:'13110000091'}],experimental_dominance:false}},pool=[],ready=[],began=performance.now(),samples=[];
 let phase='prepare',completed=0,paths=0,peak=0;const sample=()=>{const rss=process.memoryUsage().rss;peak=Math.max(peak,rss);samples.push({elapsed_ms:performance.now()-began,phase,completed_jobs:completed,paths,rss_bytes:rss});};const timer=setInterval(sample,500);
 try{
  for(let id=0;id<workers;id++){const worker=new Worker(new URL(import.meta.url),{workerData:{input,id,spill:path.join(spillRoot,'worker-'+id)},resourceLimits:{maxOldGenerationSizeMb:512}});pool.push(worker);ready.push(new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}));}await Promise.all(ready);
  const send=(worker,message)=>new Promise((resolve,reject)=>{const onError=error=>{worker.off('message',onMessage);reject(error);},onMessage=message=>{worker.off('error',onError);message.error?reject(Error(message.error)):resolve(message.result);};worker.once('message',onMessage);worker.once('error',onError);worker.postMessage(message);});
  const plan=await send(pool[0],{action:'plan'}),k=Number(survivorCount(plan.total));save('plan.json',plan);console.log(json({phase:'plan',workers,total:plan.total,k,jobs:plan.jobs.length,fallback:plan.fallback_prefixes,interleaved:plan.interleaved_prefixes}));
  const outputs={},reuse=process.env.EXACT_DAG_REFERENCE;
  if(reuse){
   const previousPlan=JSON.parse(fs.readFileSync(path.join(reuse,'plan.json'))),previousFinal=JSON.parse(fs.readFileSync(path.join(reuse,'final.json'))),hashes=JSON.parse(fs.readFileSync(path.join(reuse,'analysis.json'))).source_sha256;
   const roots=p=>JSON.stringify(p.jobs.flatMap(j=>j.configs.map(c=>JSON.stringify(c))).sort());if(!previousFinal.passed||plan.total!==previousPlan.total||roots(plan)!==roots(previousPlan)||JSON.stringify(input.request)!==JSON.stringify(previousFinal.request))throw Error('Stored reference population/request mismatch');
   for(const file of ['tools/optimizer_presets.mjs','tools/screening_rank.mjs','.scratch/calibration-check/kernel.mjs','.scratch/calibration-check/curves.mjs','.scratch/calibration-check/attributes.mjs','.scratch/github-pages-site/data/catalog.json','.scratch/github-pages-site/data/weapons/18010000001.json'])if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==hashes[file])throw Error('Stored native reference source/data changed: '+file);
   const detail=JSON.parse(fs.readFileSync(path.join(reuse,'reference.json'))),survivors=JSON.parse(fs.readFileSync(path.join(reuse,'reference-survivors.json'))).map(({config,tunes,...row})=>row);outputs.reference={summary:previousFinal.reference,results:detail.results,survivors};const newJobs=plan.jobs.length;plan.jobs=previousPlan.jobs;save('plan.json',plan);save('reused-reference.json',{directory:path.resolve(reuse),validated_native_data_hashes:true,validated_identical_root_configs:true,reference_partitions_reused:true,new_planner_jobs:newJobs,used_jobs:plan.jobs.length,summary:previousFinal.reference});
  }
  for(const name of reuse?['optimized']:['reference','optimized']){
   phase=name;completed=0;paths=0;let next=0,lastLog=0;const phaseStart=performance.now(),results=[];
   await Promise.all(pool.map(worker=>send(worker,{action:'begin',phase:name,k})));
   const expectedById=new Map(outputs.reference?.results.map(r=>[r.id,r.paths])??[]),queues=createLocalityQueues(plan.jobs,workers,job=>Number(expectedById.get(job.id)??job.configs.length));
   await Promise.all(pool.map(async(worker,id)=>{for(let job;(job=takeLocalityJob(queues,id));){const expected=expectedById.get(job.id),result=await send(worker,{action:'job',job,expected_paths:expected});results.push(result);completed++;paths+=Number(result.paths);if(performance.now()-lastLog>5000||completed===plan.jobs.length){lastLog=performance.now();const progress={phase:name,completed,jobs:plan.jobs.length,paths,total:plan.total,seconds:(performance.now()-phaseStart)/1000,rss_gib:process.memoryUsage().rss/2**30};console.log(JSON.stringify(progress));save('latest.json',progress);}}}));
   const summaries=await Promise.all(pool.map(worker=>send(worker,{action:'summary'}))),weighted=createWeightedSelector(k),ranking=createRankingHeap(k,screeningComparator({}));let threshold=null,materialization=[];
   if(name==='reference'){for(const summary of summaries)for(const row of summary.rows)ranking.offer(row);}else{
    for(const summary of summaries)for(const group of summary.groups)weighted.add(group,group.mass);
    let mass=0n;for(const group of weighted.groups().sort(rankPrefix)){mass+=group.mass;if(mass>=BigInt(k)){threshold=group;break;}}
    if(k&&!threshold)throw Error('Weighted selection lost survivor population');
    materialization=await Promise.all(pool.map(worker=>send(worker,{action:'materialize',threshold})));for(const result of materialization)for(const row of result.rows)ranking.offer(row);
   }
   const survivors=ranking.rows(),summary={phase:name,wall_ms:performance.now()-phaseStart,paths:String(results.reduce((n,r)=>n+BigInt(r.paths),0n)),terminal_classes:results.reduce((n,r)=>n+r.terminal_classes,0),objective_evaluations:summaries.reduce((n,r)=>n+r.stats.scorer.objective_evaluations,0),native_witnesses:summaries.reduce((n,r)=>n+r.stats.scorer.native_witnesses,0),geometry_evaluations:summaries.reduce((n,r)=>n+r.stats.scorer.geometry_evaluations,0),transitions_computed:summaries.reduce((n,r)=>n+r.stats.transitions_computed,0),transitions_reused:summaries.reduce((n,r)=>n+r.stats.transitions_reused,0),spill_bytes:summaries.reduce((n,r)=>n+r.spill_bytes,0),materialized_paths:materialization.reduce((n,r)=>n+r.materialized_paths,0),audit_ms_sum:results.reduce((n,r)=>n+(r.audit_ms??0),0),workers:[...new Set(results.map(r=>r.worker))].sort(),survivors:survivors.length,survivor_manifest:manifest(survivors.map(rowLine)),guard_fallback_jobs:results.filter(r=>r.guard_fallback).length};
   save(name+'.json',{...summary,results:results.sort((a,b)=>a.id-b.id),worker_stats:summaries.map(({rows,groups,...s})=>s),materialization:materialization.map(({rows,...r})=>r)});save(name+'-survivors.json',survivors.map(r=>({...r,config:JSON.parse(r.signature).map(([slotPath,itemId])=>({slotPath,itemId})),tunes:{}})));outputs[name]={summary,results:results.sort((a,b)=>a.id-b.id),survivors};sample();
  }
  phase='validation';const reference=outputs.reference,optimized=outputs.optimized;
  const inputDiagnostics=analyzeInputMissLogs(pool.map((_,id)=>path.join(spillRoot,'worker-'+id,'input-misses')));if(inputDiagnostics.miss_records!==optimized.summary.objective_evaluations)throw Error('Input diagnostic/evaluation count mismatch');save('input-diagnostics.json',inputDiagnostics);
  for(const output of [reference,optimized])if(output.summary.paths!==plan.total||output.summary.workers.length!==workers||output.survivors.length!==k)throw Error('Whole-domain/worker/survivor count mismatch');
  for(let i=0;i<reference.results.length;i++){const a=reference.results[i],b=optimized.results[i];if(a.id!==b.id||BigInt(a.paths)!==BigInt(b.paths)||a.manifest!==b.manifest)throw Error('Full per-job exact score/identity manifest differs at '+a.id);}
  if(JSON.stringify(reference.survivors)!==JSON.stringify(optimized.survivors)||new Set(optimized.survivors.map(r=>r.signature)).size!==k)throw Error('Exact survivor identities/order mismatch');
  const replays=await Promise.all(pool.map((worker,id)=>send(worker,{action:'replay',rows:optimized.survivors.filter((_,i)=>i%workers===id)})));
  const final={passed:true,workers,population:'all original legal grouped ordinary layouts; dominance and score pruning disabled',request:input.request,exact_total:plan.total,gate_fraction:.005,ranking_contract:rankingContract,selected:k,reference:reference.summary,optimized:optimized.summary,all_score_identity_manifests_match:true,exact_survivor_order_matches:true,uncached_native_survivor_replays:replays.reduce((n,r)=>n+r.replayed,0),peak_sampled_rss_bytes:peak,total_wall_ms:performance.now()-began,hardware:{logical_cpus:os.cpus().length,memory_bytes:os.totalmem(),node:process.version},provenance_spill_directory:spillRoot,notes:['Every represented path is scored directly or through exact equivalence.','Reference independently resolves every layout and native-witnesses every new complete read-input signature; it uses no DAG/live-key merging.','Reference and optimized score caches start fresh in each phase.','Identity audit reconstructs all paths separately from weighted survivor selection; audit overhead remains included in phase wall time.','Per-job SHA256 manifests use standard cryptographic collision assumptions.','Packed provenance is spilled to task-local files; cache caps evict/recompute, never trim paths.','Single ordered reference/optimized execution pair; descriptive times only.','No tactical screening or calibration in this run.']};
  final.reference_reused_from=reuse?path.resolve(reuse):null;final.input_diagnostics=inputDiagnostics;
  if(reuse)final.notes=final.notes.filter(note=>!note.includes('start fresh in each phase')&&!note.includes('Single ordered')) .concat(['Reference manifests/survivors reused from a completed independently validated run after native/data hash and exact job-config checks; its timing is historical.','Optimized caches start fresh. Exact full-input miss logs add measurement overhead.']);
  const sourceFiles=['tools/optimized_exact_dag.mjs','tools/exact_recoil_scorer.mjs','tools/exact_dag_storage.mjs','tools/choice_groups.mjs','tools/run_optimized_exact_dag.mjs','tools/exact_input_diagnostics.mjs'];save('source-hashes.json',Object.fromEntries(sourceFiles.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])));
  save('final.json',final);save('resources.json',samples);console.log(json(final));
 }catch(error){save('failure.json',{phase,completed,paths,error:error.stack});save('resources.json',samples);console.error(error);process.exitCode=1;}
 finally{clearInterval(timer);await Promise.all(pool.map(worker=>worker.terminate()));}
}
