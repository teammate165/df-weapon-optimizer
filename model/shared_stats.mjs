// Default-calibration screening only. Native presets opt in as read-only state
// consumers; general builder/calibration calls continue to use kernel.u.
export function createSharedStatEvaluator(pack,kernel,{mode,tacticalEffective=true,maxParts=2048,maxPartOps=32768,maxPrefixes=2048,maxPrefixChars=256*1024,maxReferences=512,maxReferenceChars=64*1024,maxTokens=4096,maxTokenChars=512*1024}={}){
 for(const limit of [maxParts,maxPartOps,maxPrefixes,maxPrefixChars,maxReferences,maxReferenceChars,maxTokens,maxTokenChars])if(!Number.isSafeInteger(limit)||limit<0)throw Error('Shared-stat limits must be nonnegative safe integers.');
 const c=kernel.u?.screeningStateContract,supported=!!(c?.version===1&&c.evaluate===kernel.u&&c.single===kernel.j&&c.policy==='strongest_per_stat_v1'&&['bd','sol','mp'].includes(mode)&&['collect','references','numeric','targets','mapped','value','selectOperations'].every(k=>typeof c[k]==='function'));
 const defaults={mode,tacticalEffective:!!tacticalEffective,tunes:{},ammoItemId:null,includeAmmo:false};
 const parts=new Map(),tokens=new Map(),opIds=new WeakMap(),references=new Map();
 const stats={supported,requests:0,native_fallbacks:0,context_fallbacks:0,unsupported_fallbacks:0,error_fallbacks:0,part_hits:0,part_misses:0,prefix_hits:0,prefix_misses:0,core_hits:0,core_misses:0,reference_hits:0,reference_misses:0,numeric_noops:0,part_entries_peak:0,part_operations_peak:0,prefix_entries_peak:0,prefix_key_chars_peak:0,reference_entries_peak:0,reference_key_chars_peak:0,token_entries_peak:0,token_key_chars_peak:0,saturated:false};
 let root=null,baseOperations,partOps=0,prefixes=0,prefixChars=0,referenceChars=0,tokenChars=0,nextToken=1;
 const unsupported=Symbol('unsupported default state');
 function primitive(value){
  if(value===undefined)return 'u';if(value===null)return 'n';
  if(typeof value==='number')return 'd'+(Object.is(value,-0)?'-0':String(value));
  if(typeof value==='string')return 's'+value;if(typeof value==='boolean')return value?'b1':'b0';
  throw unsupported;
 }
 function token(op){
  const existing=opIds.get(op);if(existing!==undefined)return existing;
  const key=JSON.stringify([op.operation,op.target,op.modifier,op.value].map(primitive));let id=tokens.get(key);
  if(id===undefined){
   id=nextToken++;
   if(tokens.size<maxTokens&&tokenChars+key.length<=maxTokenChars){tokens.set(key,id);tokenChars+=key.length;stats.token_entries_peak=Math.max(stats.token_entries_peak,tokens.size);stats.token_key_chars_peak=Math.max(stats.token_key_chars_peak,tokenChars);}else stats.saturated=true;
  }
  opIds.set(op,id);return id;
 }
 function freezeNumeric(numeric,keys){
  for(const key of keys){const bucket=numeric.buckets.get(key);if(bucket)Object.freeze(bucket);}
  Object.freeze(numeric.mainAttr);Object.freeze(numeric.displayAttr);return numeric;
 }
 function cloneFor(buckets,keys){
  const cloned=new Map(buckets);for(const key of keys)if(cloned.has(key))cloned.set(key,{...cloned.get(key)});return cloned;
 }
 function initialize(){
  if(root)return;
  baseOperations=c.collect(pack,{mounted:[]},defaults).operations;
  for(const op of baseOperations){token(op);Object.freeze(op);}
  const numeric=c.numeric(pack,baseOperations);freezeNumeric(numeric,numeric.buckets.keys());
  root={numeric,children:new Map(),core:null,cached:true};
 }
 function part(node){
  const key=JSON.stringify([node.slotPath,node.itemId]),cached=parts.get(key);
  if(cached){stats.part_hits++;return cached;}stats.part_misses++;
  // Under empty tuning, native collection depends on the item and mode only;
  // occurrence keys keep duplicate devices' operation identities distinct.
  const operations=c.collect(pack,{mounted:[node]},defaults).operations.slice(baseOperations.length);
  for(const op of operations){token(op);Object.freeze(op);}
  const numeric=c.numeric(pack,operations),keys=[...numeric.buckets.keys()];
  const result={operations,keys};
  if(parts.size<maxParts&&partOps+operations.length<=maxPartOps){parts.set(key,result);partOps+=operations.length;stats.part_entries_peak=Math.max(stats.part_entries_peak,parts.size);stats.part_operations_peak=Math.max(stats.part_operations_peak,partOps);}else stats.saturated=true;
  return result;
 }
 const mappingTargets=new Set(['2','3','4','5','6'].flatMap(id=>(pack.attributeRules?.weaponOverrides?.[id]||pack.attributeRules?.defaults?.[id])?.curveMappings?.filter(map=>pack.curves?.[map.curveIds?.[mode]]).map(map=>map.target)??[]));
 function core(node,operations){
  if(node.core){stats.core_hits++;return node.core;}stats.core_misses++;
  const refOps=operations.filter(op=>op.operation==='StaticAttributeReplace'),key=refOps.map(token).join(',');let ref=references.get(key);
  if(ref)stats.reference_hits++;
  else{
   stats.reference_misses++;const resolved=c.references(pack,mode,refOps,null);ref={references:Object.freeze(resolved),baseTargets:Object.freeze(c.targets(pack,resolved))};
   if(references.size<maxReferences&&referenceChars+key.length<=maxReferenceChars){references.set(key,ref);referenceChars+=key.length;stats.reference_entries_peak=Math.max(stats.reference_entries_peak,references.size);stats.reference_key_chars_peak=Math.max(stats.reference_key_chars_peak,referenceChars);}else stats.saturated=true;
  }
  const numeric={...node.numeric,buckets:cloneFor(node.numeric.buckets,mappingTargets)},mappedValues=c.mapped(pack,mode,numeric,ref.baseTargets);
  freezeNumeric(numeric,mappingTargets);
  const empty=new Map(),value=(target,fallback=ref.baseTargets[target]||0)=>c.value(empty,target,c.value(numeric.buckets,target,fallback));
  const result={...ref,numeric,mappedValues,value};if(node.cached)node.core=result;return result;
 }
 function evaluate(build,options={}){
  stats.requests++;const opts={...defaults,...options},tunes=opts.tunes||{};
  const context=opts.mode===mode&&!!opts.tacticalEffective===defaults.tacticalEffective&&!opts.includeAmmo&&!opts.ammoItemId&&typeof tunes==='object'&&[null,Object.prototype].includes(Object.getPrototypeOf(tunes))&&Reflect.ownKeys(tunes).length===0;
  if(!supported||!context){stats.native_fallbacks++;stats.context_fallbacks++;return kernel.u(pack,build,opts);}
  try{
   const seen=new Set();let boundAmmo=0;
   for(const n of build.mounted){
    if(typeof n.slotPath!=='string'||typeof n.itemId!=='string'||seen.has(n.slotPath))throw unsupported;seen.add(n.slotPath);
    if(pack.parts?.[n.itemId]?.boundAmmoByMode?.[mode])boundAmmo++;
   }
   if(boundAmmo>1)throw unsupported;
   initialize();const blocks=build.mounted.map(part),combined=[...baseOperations];for(const block of blocks)combined.push(...block.operations);
   const operations=c.selectOperations(combined),selected=new Set(operations);
   if(operations.some(op=>op.sourceTuneId&&op.target==='GBullet_Velocity'))throw unsupported;
   let node=root;
   for(const block of blocks){
    const suffix=block.operations.filter(op=>selected.has(op));if(!suffix.length)continue;
    const key=suffix.map(token).join(','),cached=node.children.get(key);
    if(cached){stats.prefix_hits++;node=cached;continue;}stats.prefix_misses++;
    let numeric=node.numeric;
    if(block.keys.length){numeric=c.numeric(pack,suffix,cloneFor(node.numeric.buckets,block.keys));freezeNumeric(numeric,block.keys);}else stats.numeric_noops++;
    const cache=node.cached&&prefixes<maxPrefixes&&prefixChars+key.length<=maxPrefixChars,child={numeric,children:new Map(),core:null,cached:cache};
    if(cache){node.children.set(key,child);prefixes++;prefixChars+=key.length;stats.prefix_entries_peak=Math.max(stats.prefix_entries_peak,prefixes);stats.prefix_key_chars_peak=Math.max(stats.prefix_key_chars_peak,prefixChars);}else stats.saturated=true;
    node=child;
   }
   const state=core(node,operations);
   // Cached buckets/attributes are read-only. Public Maps and occurrence lists
   // are fresh, so per-row list edits cannot poison another candidate's cache.
   return {mode,operations,appliedParts:build.mounted.map(n=>n.itemId),ammo:null,references:state.references,numeric:{...state.numeric,buckets:new Map(state.numeric.buckets)},baseTargets:state.baseTargets,mappedValues:new Map(state.mappedValues),value:state.value};
  }catch(error){
   stats.native_fallbacks++;if(error===unsupported)stats.unsupported_fallbacks++;else stats.error_fallbacks++;
   return kernel.u(pack,build,opts);
  }
 }
 return {supported,evaluate,getStats:()=>({...stats})};
}
