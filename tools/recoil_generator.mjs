// Compatibility entry point for existing CLI and builder callers.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {generate} from './optimizer_engine.mjs';
export {generate};
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const result=await generate(input,path.dirname(process.argv[2]));
  fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
}
