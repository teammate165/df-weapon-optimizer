// A request-local legality plan shared by exhaustive counting and enumeration.
// Its only free variables are explicit attachment choices; Boolean auxiliaries
// are evaluated from those choices, including conditional bundled providers.
export function createMountSearch(compiled,{incremental=true,priorityPaths=[]}={}){
 const {model:m,players}=compiled,variables=[...m.variables.keys()],index=new Map(variables.map((v,i)=>[v,i]));
 if([...m.variables.values()].some(v=>v.type!=='binary'))throw Error('Exhaustive mounting enumeration requires a Boolean mounting model.');
 const decisions=new Set([...players.values()].map(p=>p.value).filter(v=>typeof v==='string'));
 if(variables.some(v=>!decisions.has(v)&&!m.booleanNodes.has(v)))throw Error('Exhaustive mounting enumeration requires attachment decisions only.');
 const atom=v=>typeof v==='number'?{constant:v}:{index:index.get(v)};
 const instructions=variables.map(v=>{const node=m.booleanNodes.get(v);return node?{kind:node.kind,args:node.args.map(atom)}:null;});
 // One-request constraints are already enforced by each group's choice domain.
 // All remaining policy constraints participate in feasibility and cache keys.
 const constraints=m.constraints.filter(c=>!c.name.startsWith('c_')&&!c.name.startsWith('one_request_')).map(c=>({...c,terms:[...c.expression.terms].map(([v,a])=>[index.get(v),a])}));
 // Residual arithmetic must be exact to share states. Decimal/oversized
 // policies retain literal enumeration and its existing numeric comparisons.
 const integerPolicy=constraints.every(c=>{
  const values=[c.bound,c.expression.constant,...c.terms.map(([,a])=>a)];
  return values.every(Number.isSafeInteger)&&values.reduce((n,a)=>n+Math.abs(a),0)<=Number.MAX_SAFE_INTEGER;
 });
 const byPath=new Map();
 for(const p of players.values())if(typeof p.value==='string'){
  if(!byPath.has(p.path))byPath.set(p.path,[]);
  byPath.get(p.path).push({...p,index:index.get(p.value)});
 }
 const priority=new Map(priorityPaths.map((path,index)=>[path,index]));
 const order=path=>priority.get(path)??priority.size;
 const groups=[...byPath].sort((a,b)=>order(a[0])-order(b[0])||
  a[0].split('/').length-b[0].split('/').length||a[0].localeCompare(b[0])).map(([,choices])=>choices);
 const users=variables.map(()=>[]),readers=variables.map(()=>[]);
 for(let i=0;i<instructions.length;i++)for(const a of instructions[i]?.args??[])if(a.index!==undefined)users[a.index].push(i);
 constraints.forEach((c,j)=>c.terms.forEach(([i])=>readers[i].push(j)));
 const invalidations=groups.map(group=>{
  const touched=new Set(group.map(p=>p.index)),queue=[...touched],checks=new Set();
  for(let q=0;q<queue.length;q++)for(const i of users[queue[q]])if(!touched.has(i)){touched.add(i);queue.push(i);}
  for(const i of touched)for(const j of readers[i])checks.add(j);
  return {variables:[...touched],constraints:[...checks]};
 });

 function session(restrictions,tick,stats={}){
  const assigned=new Int8Array(variables.length).fill(-1),epochs=new Float64Array(variables.length),low=new Int8Array(variables.length),high=new Int8Array(variables.length);
  const valid=new Uint8Array(variables.length),dirty=new Set(constraints.map((_,i)=>i)),failed=new Set();
  let epoch=0;
  for(const [name,value] of restrictions){
   if(!decisions.has(name)||value!==0&&value!==1)throw Error('Mounting restrictions must fix attachment decisions to zero or one.');
   assigned[index.get(name)]=value;
  }
  const domains=groups.map(choices=>{const required=choices.filter(p=>restrictions.get(p.value)===1);return required.length>1?[]:required.length?required:[null,...choices.filter(p=>restrictions.get(p.value)!==0)];});
  const skipTo=new Uint32Array(groups.length+1);skipTo[groups.length]=groups.length;
  for(let depth=groups.length-1;depth>=0;depth--)skipTo[depth]=domains[depth].length===1&&groups[depth].every(p=>assigned[p.index]>=0)?skipTo[depth+1]:depth;
  function bounds(i){
   if(incremental?valid[i]:epochs[i]===epoch)return;
   valid[i]=1;stats.boolean_evaluations=(stats.boolean_evaluations??0)+1;
   epochs[i]=epoch;
   if(assigned[i]>=0){low[i]=high[i]=assigned[i];return;}
   const node=instructions[i];
   if(!node){low[i]=0;high[i]=1;return;}
   if(node.kind==='not'){const a=node.args[0];if(a.index!==undefined){bounds(a.index);low[i]=1-high[a.index];high[i]=1-low[a.index];}else low[i]=high[i]=1-a.constant;return;}
   let lo=node.kind==='and'?1:0,hi=lo;
   for(const a of node.args){
    let al,ah;if(a.index!==undefined){bounds(a.index);al=low[a.index];ah=high[a.index];}else al=ah=a.constant;
    if(node.kind==='and'){lo&=al;hi&=ah;if(!hi)break;}
    else{lo|=al;hi|=ah;if(lo)break;}
   }
   low[i]=lo;high[i]=hi;
  }
  function possible(){
   epoch++;
   if(incremental&&failed.size)return false;
   for(const j of incremental?dirty:constraints.keys()){
    if(incremental)dirty.delete(j);
    const c=constraints[j];stats.constraint_evaluations=(stats.constraint_evaluations??0)+1;
    let lower=c.expression.constant,upper=lower;
    for(const [i,a] of c.terms){bounds(i);lower+=a*(a<0?high[i]:low[i]);upper+=a*(a<0?low[i]:high[i]);}
    if(c.sense!=='<='&&upper<c.bound-1e-8||c.sense!=='>='&&lower>c.bound+1e-8){if(incremental)failed.add(j);return false;}
   }
   return true;
  }
  function invalidate(depth){
   if(!incremental)return;
   const change=invalidations[depth];
   for(const i of change.variables)valid[i]=0;
   for(const j of change.constraints){dirty.add(j);failed.delete(j);}
  }
  const choose=(depth,chosen)=>{let changed=false;for(const p of groups[depth]){const value=p===chosen?1:0;if(assigned[p.index]!==value){assigned[p.index]=value;changed=true;}}if(changed)invalidate(depth);};
  const restore=depth=>{let changed=false;for(const p of groups[depth]){const value=restrictions.get(p.value)??-1;if(assigned[p.index]!==value){assigned[p.index]=value;changed=true;}}if(changed)invalidate(depth);};
  const interval=name=>{if(typeof name==='number')return [name,name];const i=index.get(name);if(i===undefined)throw Error('Unknown Boolean bound');bounds(i);return [low[i],high[i]];};
  return {assigned,domains,skipTo,bounds,low,high,possible,choose,restore,interval,get epoch(){return epoch;},tick};
 }

 function* enumerate(restrictions=new Map(),tick=()=>{},{prune,stats={},priority,priceBudget,priceCeiling,pruneLeaves=false,pause}={}){
  const s=session(restrictions,tick,stats);
  if(priority)for(let i=0;i<groups.length;i++)s.domains[i].sort((a,b)=>priority(groups[i][0].path,a?.item??null)-priority(groups[i][0].path,b?.item??null));
  const suffixCosts=new Array(groups.length+1);
  let minimumSuffixCost;
  // Ignore inter-slot compatibility here so the sums cover every legal price.
  if(Number.isSafeInteger(priceBudget)&&s.domains.every(domain=>domain.every(choice=>!choice||Number.isSafeInteger(choice.cost)&&choice.cost>=0))){
   if(priceCeiling){
    // This lower bound also covers depths where the exact suffix table exceeds its size cap.
    minimumSuffixCost=new Float64Array(groups.length+1);
    for(let depth=groups.length-1;depth>=0;depth--){
     const cheapest=Math.min(...s.domains[depth].map(choice=>choice?.cost??0));
     minimumSuffixCost[depth]=cheapest+minimumSuffixCost[depth+1];
    }
   }
   suffixCosts[groups.length]=[0];
   for(let depth=groups.length-1;depth>=0;depth--){
    const costs=new Set();
    const quotes=new Set(s.domains[depth].map(choice=>choice?.cost??0));
    for(const quote of quotes){
     for(const suffix of suffixCosts[depth+1]){
      if(suffix<=priceBudget-quote)costs.add(quote+suffix);
     }
     if(costs.size>2048)break;
    }
    if(costs.size>2048)break;
    suffixCosts[depth]=[...costs].sort((a,b)=>a-b);
   }
  }
  const remaining=new Uint16Array(groups.length+1);for(let i=groups.length-1;i>=0;i--)remaining[i]=remaining[i+1]+(s.domains[i].length>1?1:0);
  function* walk(depth,config,selectedCost){
   const end=s.skipTo[depth],fixed=[];
   for(;depth<end;depth++){const chosen=s.domains[depth][0];if(chosen){fixed.push({slotPath:chosen.path,itemId:chosen.item});selectedCost+=chosen.cost;}}
   if(fixed.length)config=[...config,...fixed];
   tick();
   // A pause preserves stack and constraint state even between legal leaves.
   if(pause?.())yield null;
   if(minimumSuffixCost&&selectedCost+minimumSuffixCost[depth]>priceCeiling()){
    stats.price_ceiling_cuts=(stats.price_ceiling_cuts??0)+1;
    return;
   }
   if(!s.possible())return;
   if((pruneLeaves||depth<groups.length)&&prune?.({depth,remaining:remaining[depth],interval:s.interval,selectedCost,
    suffixCosts:suffixCosts[depth],minimumCompletionCost:minimumSuffixCost&&selectedCost+minimumSuffixCost[depth]})){
    stats.pruned_branches=(stats.pruned_branches??0)+1;return;
   }
   if(depth===groups.length){yield config;return;}
   for(const chosen of s.domains[depth]){
    const childCost=selectedCost+(chosen?.cost??0);
    if(minimumSuffixCost&&childCost+minimumSuffixCost[depth+1]>priceCeiling()){
     stats.price_ceiling_cuts=(stats.price_ceiling_cuts??0)+1;
     continue;
    }
    s.choose(depth,chosen);
    yield* walk(depth+1,chosen?[...config,{slotPath:chosen.path,itemId:chosen.item}]:config,childCost);
   }
   s.restore(depth);
  }
  yield* walk(0,[],0);
 }

 function count(restrictions=new Map(),{tick=()=>{},onCount=()=>{},maxEntries=20000,maxKeyChars=4*1024*1024,maxInternEntries=50000,maxInternChars=4*1024*1024}={}){
  for(const value of [maxEntries,maxKeyChars,maxInternEntries,maxInternChars])if(!Number.isSafeInteger(value)||value<0)throw Error('Counting cache limits must be nonnegative safe integers.');
  const stats={nodes:0,cache_hits:0,analytical_subtrees:0,fixed_layers_skipped:0,memo_entries_peak:0,memo_key_chars_peak:0,intern_entries_peak:0,intern_key_chars_peak:0,cache_saturated:false,intern_saturated:false,numeric_fallback:false};
  if(!integerPolicy){
   stats.numeric_fallback=true;let total=0n;
   for(const _ of enumerate(restrictions,()=>{stats.nodes++;tick();},{stats})){total++;onCount(1n);}
   return {total,stats};
  }
  const s=session(restrictions,tick,stats),memo=new Map(),intern=new Map(),reducedEpoch=new Float64Array(variables.length),reduced=new Float64Array(variables.length);
  let nextId=variables.length+2,memoChars=0,internChars=0;
  const suffix=new Array(groups.length+1);suffix[groups.length]=1n;
  for(let depth=groups.length-1;depth>=0;depth--)suffix[depth]=suffix[depth+1]*BigInt(s.domains[depth].length);
  function internNode(kind,ids){
   if(kind!=='not'){
    ids=[...new Set(ids)].sort((a,b)=>a-b);
    const absorbing=kind==='and'?0:1,neutral=1-absorbing;
    if(ids.includes(absorbing))return absorbing;
    ids=ids.filter(id=>id!==neutral);if(!ids.length)return neutral;if(ids.length===1)return ids[0];
   }else if(ids[0]<2)return 1-ids[0];
   const key=kind+':'+ids.join(','),cached=intern.get(key);if(cached!==undefined)return cached;
   const id=nextId++;
   if(intern.size<maxInternEntries&&internChars+key.length<=maxInternChars){intern.set(key,id);internChars+=key.length;stats.intern_entries_peak=Math.max(stats.intern_entries_peak,intern.size);stats.intern_key_chars_peak=Math.max(stats.intern_key_chars_peak,internChars);}
   else stats.intern_saturated=true;
   // IDs are never recycled: a full interning cache can only reduce reuse.
   return id;
  }
  function reduce(i){
   if(reducedEpoch[i]===s.epoch)return reduced[i];
   reducedEpoch[i]=s.epoch;s.bounds(i);
   if(s.low[i]===s.high[i])return reduced[i]=s.low[i];
   const node=instructions[i];
   return reduced[i]=node?internNode(node.kind,node.args.map(a=>a.index!==undefined?reduce(a.index):a.constant)):i+2;
  }
  function residualKey(depth){
   const rows=[];
   for(const c of constraints){
    let bound=c.bound-c.expression.constant;const terms=new Map();
    for(const [i,a] of c.terms){const id=reduce(i);if(id<2)bound-=a*id;else terms.set(id,(terms.get(id)??0)+a);}
    let lower=0,upper=0;const remaining=[...terms].filter(([,a])=>a!==0).sort((a,b)=>a[0]-b[0]);
    for(const [,a] of remaining){lower+=Math.min(0,a);upper+=Math.max(0,a);}
    if(c.sense!=='<='&&upper<bound-1e-8||c.sense!=='>='&&lower>bound+1e-8)return null;
    if(c.sense==='<='&&upper<=bound+1e-8||c.sense==='>='&&lower>=bound-1e-8||c.sense==='=='&&lower>=bound-1e-8&&upper<=bound+1e-8)continue;
    rows.push(c.sense+':'+bound+':'+remaining.map(([id,a])=>id+'='+a).join(','));
   }
   // This is the complete residual policy, not just interval bounds. Equal
   // low/high ranges alone do not imply equal legal future combinations.
   return rows.length?depth+'|'+[...new Set(rows)].sort().join(';'):'';
  }
  function remember(key,total){
   if(!maxEntries||key.length>maxKeyChars){stats.cache_saturated=true;return;}
   while(memo.size>=maxEntries||memoChars+key.length>maxKeyChars){const old=memo.keys().next().value;memoChars-=old.length;memo.delete(old);stats.cache_saturated=true;}
   memo.set(key,total);memoChars+=key.length;stats.memo_entries_peak=Math.max(stats.memo_entries_peak,memo.size);stats.memo_key_chars_peak=Math.max(stats.memo_key_chars_peak,memoChars);
  }
  function walk(depth){
   // Restrictions already assigned these decisions before the search began;
   // traversing their one-option layers cannot change any residual constraint.
   stats.fixed_layers_skipped+=s.skipTo[depth]-depth;depth=s.skipTo[depth];
   stats.nodes++;tick();if(!suffix[depth]||!s.possible())return 0n;
   const key=residualKey(depth);if(key===null)return 0n;
   if(!key){stats.analytical_subtrees++;const total=suffix[depth];onCount(total);return total;}
   const cached=memo.get(key);if(cached!==undefined){stats.cache_hits++;onCount(cached);return cached;}
   if(depth===groups.length)throw Error('A complete mounting assignment has an unresolved policy constraint.');
   let total=0n;
   for(const chosen of s.domains[depth]){s.choose(depth,chosen);total+=walk(depth+1);}
   s.restore(depth);remember(key,total);return total;
  }
  const total=walk(0);return {total,stats};
 }
 return {enumerate,count};
}
