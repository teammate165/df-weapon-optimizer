// Exact, bounded-memory disk analysis of scoring misses. Hashing chooses a
// partition only; complete UTF-16 keys decide equality within each partition.
import fs from 'node:fs';
import path from 'node:path';
export function createInputMissLog(directory){
 fs.mkdirSync(directory,{recursive:true});const buffers=Array.from({length:64},()=>[]);let buffered=0,records=0,bytes=0;
 function flush(){for(let i=0;i<64;i++)if(buffers[i].length){fs.appendFileSync(path.join(directory,i+'.bin'),Buffer.concat(buffers[i]));buffers[i]=[];}buffered=0;}
 return {record(key){let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);const data=Buffer.from(key,'utf16le'),record=Buffer.allocUnsafe(data.length+2);if(data.length>65535)throw Error('Input diagnostic key too long');record.writeUInt16LE(data.length);data.copy(record,2);buffers[(hash>>>0)%64].push(record);buffered+=record.length;bytes+=record.length;records++;if(buffered>=1024*1024)flush();},flush,stats:()=>({records,bytes,directory})};
}
export function analyzeInputMissLogs(directories){
 let records=0,globalUnique=0,workerUnique=0;const workerDistinct=Array(directories.length).fill(0);
 for(let shard=0;shard<64;shard++){
  const global=new Set();
  for(let worker=0;worker<directories.length;worker++){
   const filename=path.join(directories[worker],shard+'.bin');if(!fs.existsSync(filename))continue;
   const bytes=fs.readFileSync(filename),local=new Set();for(let offset=0;offset<bytes.length;){const length=bytes.readUInt16LE(offset);offset+=2;if(length%2||offset+length>bytes.length)throw Error('Truncated scoring-key diagnostic');const key=bytes.toString('utf16le',offset,offset+length);offset+=length;records++;local.add(key);global.add(key);}
   workerDistinct[worker]+=local.size;workerUnique+=local.size;
  }globalUnique+=global.size;
 }
 return {miss_records:records,global_distinct_input_keys:globalUnique,sum_worker_distinct_input_keys:workerUnique,confirmed_worker_recomputations_after_eviction:records-workerUnique,additional_first_computations_across_workers:workerUnique-globalUnique,worker_distinct_input_keys:workerDistinct,method:'64 hash partitions; complete binary64 UTF16 keys compared exactly; logs contain every miss, including first occurrence'};
}
