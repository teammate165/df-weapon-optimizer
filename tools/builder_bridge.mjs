import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {executeModel} from './builder_model.mjs';
import {runExactOrdinaryNodePool} from './exact_ordinary_node_pool.mjs';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const runtime=process.argv[3];
const curves=await import(pathToFileURL(path.join(runtime,'curves.mjs')));
const kernel=await import(pathToFileURL(path.join(runtime,'kernel.mjs')));
const {t:calculate}=await import(pathToFileURL(path.join(runtime,'attributes.mjs')));
if(input.stream_progress)input.onProgress=progress=>process.stdout.write(JSON.stringify({progress})+'\n');
const modules={curves,kernel,calculate};
const searchMethod=input.request.search_method;
const result=input.action==='optimize'&&['exact_ordinary','exact_ordinary_staged'].includes(searchMethod)
  ?await runExactOrdinaryNodePool(input,modules,pathToFileURL(path.join(runtime,path.sep)),{
    staged:searchMethod==='exact_ordinary_staged',
  }):await executeModel(input,modules);
process.stdout.write(JSON.stringify(input.stream_progress?{result}:result)+(input.stream_progress?'\n':''));
