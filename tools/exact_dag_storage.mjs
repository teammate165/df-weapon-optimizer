// Exact, bounded interning/caches. Eviction causes recomputation, never removal
// of paths. IDs are monotonic and never recycled while a run can reference them.
export const exactNumber=n=>n===undefined?'u':Object.is(n,-0)?'-0':Number.isFinite(n)?String(n):(()=>{throw Error('Nonfinite exact state');})();
export function exactKey(value){
 if(value===undefined)return 'u';if(value===null)return 'n';
 if(typeof value==='number')return 'd'+exactNumber(value);
 if(typeof value==='string')return 's'+JSON.stringify(value);
 if(typeof value==='boolean')return value?'t':'f';
 if(Array.isArray(value))return '['+value.map(exactKey).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+exactKey(value[k])).join(',')+'}';
}
// Four UTF-16 code units per IEEE754 value, with explicit length framing.
// This is an exact Map key, not a probabilistic hash or rounded value.
export function packedNumberKey(values){
 const view=new DataView(new ArrayBuffer(values.length*8));
 for(let i=0;i<values.length;i++){if(!Number.isFinite(values[i]))throw Error('Nonfinite packed scoring input');view.setFloat64(i*8,values[i],false);}
 let key='';for(let i=0;i<view.byteLength;i+=2)key+=String.fromCharCode(view.getUint16(i,false));return key;
}
export function createLocalityQueues(jobs,workers=8,weight=job=>job.configs.length){
 // Deterministic program affinity with an upper bound on the number of root
 // prefixes assigned to one worker. Split very large programs to avoid idle pools.
 const queues=Array.from({length:workers},()=>[]),loads=Array(workers).fill(0),owners=new Map(),target=Math.max(1,Math.ceil(jobs.reduce((n,j)=>n+weight(j),0)/workers));
 for(const job of jobs){let owner=owners.get(job.program);const least=loads.indexOf(Math.min(...loads));if(owner===undefined||loads[owner]+weight(job)>target*1.2){owner=least;owners.set(job.program,owner);}queues[owner].push(job);loads[owner]+=weight(job);}
 return queues;
}
export function takeLocalityJob(queues,worker){if(queues[worker].length)return queues[worker].shift();let donor=-1;for(let i=0;i<queues.length;i++)if(donor<0||queues[i].length>queues[donor].length)donor=i;return donor<0?undefined:queues[donor].pop();}
export function boundedCache(maxBytes=16*1024*1024){
 const entries=new Map();let bytes=0;const stats={hits:0,misses:0,evictions:0,peak_bytes:0};
 return {get(key){const entry=entries.get(key);if(entry){stats.hits++;return entry.value;}stats.misses++;},set(key,value,size=key.length*2+128){if(entries.has(key))return;if(size>maxBytes)return;while(entries.size&&bytes+size>maxBytes){const first=entries.keys().next().value;bytes-=entries.get(first).size;entries.delete(first);stats.evictions++;}entries.set(key,{value,size});bytes+=size;stats.peak_bytes=Math.max(stats.peak_bytes,bytes);},clear(){entries.clear();bytes=0;},stats:()=>({...stats,entries:entries.size,bytes,max_bytes:maxBytes})};
}
export function exactInterner(maxBytes=8*1024*1024){const cache=boundedCache(maxBytes);let next=1;return {intern(value){const key=exactKey(value),old=cache.get(key);if(old)return old;const entry={id:next++,value};if(!Number.isSafeInteger(next))throw Error('Exact intern ID overflow');cache.set(key,entry,key.length*2+128);return entry;},stats:cache.stats};}

// Packed correlated provenance: numerical frontiers can be released while
// identities remain recoverable. Edge0 is a sentinel, not a parent node.
export function createProvenance(roots){
 const head=[],mass=[],parent=[0],label=[0],next=[0],labels=[null],labelIds=new Map(),rootEntries=new Map();
 function addNode(weight){const id=head.length;if(id>=0xffffffff)throw Error('DAG node ID overflow');head.push(0);mass.push(weight);return id;}
 function arc(child,previous,choice){let id=0;if(choice){const key=JSON.stringify(choice);id=labelIds.get(key);if(id===undefined){id=labels.length;labels.push(choice);labelIds.set(key,id);}}const edge=parent.length;if(edge>=0xffffffff)throw Error('DAG arc ID overflow');parent.push(previous);label.push(id);next.push(head[child]);head[child]=edge;}
 return {head,mass,rootEntries,addNode,arc,root(node,index){if(!rootEntries.has(node))rootEntries.set(node,[]);rootEntries.get(node).push(index);},pack(){return {roots,root_entries:[...rootEntries],head:Uint32Array.from(head),parent:Uint32Array.from(parent),label:Uint32Array.from(label),next:Uint32Array.from(next),labels};}};
}
export function* provenancePaths(graph,node){
 const rootMap=graph._rootMap??=new Map(graph.root_entries);
 if(rootMap.has(node)){for(const index of rootMap.get(node))yield graph.roots[index];return;}
 for(let edge=graph.head[node];edge;edge=graph.next[edge])for(const config of provenancePaths(graph,graph.parent[edge])){const choice=graph.labels[graph.label[edge]];yield choice?[...config,choice]:config;}
}
export const rankPrefix=(a,b)=>{const av=a.objectives,bv=b.objectives;for(let i=0;i<av.length;i++)if(av[i]!==bv[i])return av[i]<bv[i]?-1:1;return a.cost===b.cost?0:a.cost<b.cost?-1:1;};

// Keep whole boundary groups. No alias is discarded merely because its
// representative signature loses. At most K distinct quality groups survive.
export function createWeightedSelector(k){
 const groups=new Map(),heap=[];let mass=0n;const limit=BigInt(k);
 const swap=(a,b)=>{[heap[a],heap[b]]=[heap[b],heap[a]];};
 function pop(){const worst=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let w=i;if(l<heap.length&&rankPrefix(heap[l],heap[w])>0)w=l;if(r<heap.length&&rankPrefix(heap[r],heap[w])>0)w=r;if(w===i)break;swap(i,w);i=w;}}groups.delete(worst.key);mass-=worst.mass;}
 return {add(row,weight){if(!limit)return;const n=BigInt(weight),key=JSON.stringify([row.objectives,row.cost]),old=groups.get(key);if(old){old.mass+=n;mass+=n;}else{if(mass>=limit&&rankPrefix(row,heap[0])>0)return;const group={key,objectives:row.objectives,cost:row.cost,score:row.score,mass:n};groups.set(key,group);heap.push(group);mass+=n;let i=heap.length-1;while(i){const p=(i-1)>>1;if(rankPrefix(heap[p],heap[i])>=0)break;swap(p,i);i=p;}}while(heap.length>1&&mass-heap[0].mass>=limit)pop();},groups:()=>[...groups.values()],get mass(){return mass;}};
}
