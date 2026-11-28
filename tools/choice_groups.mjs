import {isOptic} from './optimizer_mounts.mjs';

const patchSockets=new Set([30,32,33,34,35]);
const viewOnlyTargets=new Set(['ScopeCameraTuneDistance','ScopeZoomTuneRate']);
// Catalog identity: Collapsible Bipod Grip. Automatic search policy; exact
// user locks and manual mounting remain supported.
const bipodGripIds=new Set(['13140000038']);
const noop=op=>op.operation==='StaticAttributeModify'&&((['Addend','Mult_A'].includes(op.modifier)&&Number(op.value)===0)||(op.modifier==='Mult_C'&&Number(op.value)===1));
const pathOrder=(a,b)=>a.localeCompare(b);

// Search-only equivalence for the native objectives. Concrete source IDs remain
// in every output, locked choices remain exact, and unknown consumers opt out.
export function createChoiceGroups({pack,mode,shop,prices,kernel,curves,preset,fixed=[],forbiddenItems=new Set()}){
 const certificate=preset.branchScoring,c=kernel.u?.screeningStateContract;
 const enabled=c?.version===1&&c.evaluate===kernel.u&&certificate?.raw===preset.raw&&certificate?.score===preset.score&&certificate?.objectives===preset.objectives;
 const costs=mode==='bd'?shop.partCosts:prices,hidden=new Set(mode==='bd'?shop.hiddenItemIds:[]),patchIds=new Set(),magwellIds=new Set(),sensitive=new Set(),data=new Map(),families=new Map(),optionCache=new Map(),matchingCache=new Map(),normalizations=new Map();
 const stats={enabled,items_grouped:0,option_sets:0,options_before:0,options_after:0,matching_hits:0,matching_misses:0,matching_peak:0,grouped_tactical_configs:0};
 const locked=path=>fixed.some(f=>f.slotPath===path||f.slotPath.startsWith(path+'/'));
 // These optional accessories are outside automatic search. Explicit
 // locks still preserve them, and the manual builder remains unchanged.
 const excluded=path=>!locked(path)&&path.split('/').some(socket=>['10','31','36','45'].includes(socket));
 const collectIds=value=>{if(Array.isArray(value)){for(const x of value)collectIds(x);}else if(value&&typeof value==='object'){for(const [k,v] of Object.entries(value)){if(pack.parts[k])sensitive.add(k);collectIds(v);}}else if(['string','number'].includes(typeof value)&&pack.parts[String(value)])sensitive.add(String(value));};
 collectIds(pack.assembly.coupling);collectIds(pack.assembly.extraOccupancy);collectIds(pack.combat?.specialFire);
 for(const provider of Object.values(pack.assembly.socketProviders))for(const socket of provider.sockets??[])if(patchSockets.has(Number(socket.socketId))&&(!socket.modes||socket.modes.includes(mode)))for(const id of socket.optionItemIds??[])patchIds.add(String(id));
 for(const provider of Object.values(pack.assembly.socketProviders))for(const socket of provider.sockets??[])if(Number(socket.socketId)===44&&(!socket.modes||socket.modes.includes(mode)))for(const id of socket.optionItemIds??[])magwellIds.add(String(id));
 const statTargets=new Set(['3','4','5','6'].flatMap(id=>{
  const rule=pack.attributeRules?.weaponOverrides?.[id]||pack.attributeRules?.defaults?.[id],mapped=new Set((rule?.curveMappings??[]).map(m=>m.target));
  return ['WeaponMainAttribute.MainAttrValues.'+id,'DisplayAttrValues.'+id,...(rule?.directRuleTargets??[]).filter(t=>!mapped.has(t))];
 }));
 const rawOps=[...Object.values(pack.effectSets??{}).flatMap(s=>s.operations??[]),...Object.values(pack.effectsByItemId??{}).flatMap(modes=>Object.values(modes).flat())];
 const integerAdds=rawOps.every(op=>op.modifier!=='Addend'||!statTargets.has(op.target)||Number.isSafeInteger(Number(op.value)))&&!Object.values(pack.tunes??{}).some(t=>(t.functions??[]).some(f=>f.modifier==='Addend'&&statTargets.has(f.target)));
 stats.counts_interchangeable=integerAdds;
 const isPatch=id=>patchIds.has(id),isTactical=(path,id)=>patchSockets.has(Number(path.split('/').at(-1)))||isPatch(id)||kernel.l(pack,id,mode);
 const price=id=>mode==='mp'?0:costs[id];
 function item(id){
  if(data.has(id))return data.get(id);
  const kind=kernel.l(pack,id,mode)?'laser':isPatch(id)?'patch':magwellIds.has(id)?'magwell':isOptic(pack,id)?'sight':null;
  let family=null,ops=[];
  if(enabled&&kind&&!sensitive.has(id)&&!(pack.assembly.socketProviders[id]?.sockets?.length)&&!pack.parts[id]?.boundAmmoByMode?.[mode]){
   try{
    const controls=pack.parts[id]?.tuneIds??[];
    // These two controls affect the view, not either native objective. Other
    // calibrated devices remain distinct, even when their default stats match.
    if(controls.some(t=>(pack.tunes[t]?.functions??[]).some(f=>!viewOnlyTargets.has(f.target))))throw Error('Scored calibration');
    ops=c.collect(pack,{mounted:[{itemId:id,slotPath:'group'}]},{mode,tacticalEffective:true,tunes:{},includeAmmo:false,ammoItemId:null}).operations.filter(o=>o.sourceKind==='part'&&!noop(o));
    if(kind==='patch'&&ops.some(o=>o.operation!=='StaticAttributeModify'||o.modifier!=='Addend'||!Number.isSafeInteger(o.value)||! /^(?:WeaponMainAttribute\.MainAttrValues|DisplayAttrValues)\.[2-6]$/.test(o.target)))throw Error('Non-additive patch');
    const signature=JSON.stringify([kind,ops.map(o=>[o.operation,o.target,o.modifier,o.value,o.scope])]);
    if(!families.has(signature))families.set(signature,kind+':'+families.size);
    family=families.get(signature);
   }catch{family=null;}
  }
  const result={id,kind,family,ops};data.set(id,result);if(family)stats.items_grouped++;return result;
 }
 const familyKey=(id,path)=>{const d=item(id);return d.family?(d.kind!=='sight'&&!integerAdds?d.family+'@'+path:d.family):'fixed:'+path+':'+id;};
 function options(ids,path){
  if(excluded(path))return [];
  if(forbiddenItems.size)ids=ids.filter(id=>!forbiddenItems.has(id));
  if(!locked(path))ids=ids.filter(id=>!bipodGripIds.has(id));
  if(!enabled||locked(path))return ids.filter(id=>!hidden.has(id));
  const cacheKey=JSON.stringify([path,ids]);if(optionCache.has(cacheKey))return optionCache.get(cacheKey);
  const representatives=new Map(),result=[];
  for(const id of ids){
   if(hidden.has(id)||!Number.isFinite(price(id)))continue;
   const group=item(id).family;if(!group){result.push(id);continue;}
   const old=representatives.get(group);if(!old||price(id)<price(old)||price(id)===price(old)&&id<old)representatives.set(group,id);
  }
  result.push(...representatives.values());stats.option_sets++;stats.options_before+=ids.length;stats.options_after+=result.length;
  if(optionCache.size>=2048)optionCache.delete(optionCache.keys().next().value);optionCache.set(cacheKey,result);return result;
 }
 function constrain(compiled,{preserveIdentities=false,preserveBundled=false}={}){
  for(const group of compiled.groups)for(const slot of group.slots){
   if(locked(slot.path))continue;
   if(excluded(slot.path)){for(const node of slot.nodes)compiled.model.constrain(preserveBundled?node.equipped:node.active,'==',0,'excluded_accessory');continue;}
   for(const node of slot.nodes)if(bipodGripIds.has(node.item))compiled.model.constrain(preserveBundled?node.equipped:node.active,'==',0,'excluded_bipod_grip');
   if(!enabled||preserveIdentities)continue;
   const allowed=new Set(options(slot.options,slot.path));
   for(const node of slot.nodes)if(slot.options.includes(node.item)&&!forbiddenItems.has(node.item)&&item(node.item).family&&!allowed.has(node.item))compiled.model.constrain(node.active,'==',0,'equivalent_choice');
  }
 }
 // Exact category searches can quotient concrete choices at the same price
 // without changing any category's price window, score or handling tie-break.
 function exactPriceRestrictions(compiled,preferredConfig=[]){
  const restrictions=new Map();
  if(!enabled||preset.solverPlan?.kind!=='recoil')return restrictions;
  const preferred=new Map(preferredConfig.map(({slotPath,itemId})=>[slotPath,itemId]));
  const contexts=new Map();
  for(const group of compiled.groups)for(const slot of group.slots){
   if(locked(slot.path)||excluded(slot.path))continue;
   for(const node of slot.nodes){
    if(!slot.options.includes(node.item))continue;
    const player=compiled.players.get(slot.path+'|'+node.item);
    if(typeof player?.value!=='string')continue;
    if(!contexts.has(player))contexts.set(player,[]);
    contexts.get(player).push(node);
   }
  }
  function nativeProgram({item: itemId,path:slotPath,socketId,host:hostItemId}){
   const mounted={itemId,slotPath,socketId:Number(socketId),hostItemId,source:'equipped'};
   for(const id of pack.parts[itemId]?.tuneIds??[]){
    const control=curves.c(pack,mounted,id);
    // Native collection emits tune writes only for enabled controls. View
    // writes cannot affect the recoil scorer, timing, or main-stat floors.
    if(control&&control.enabled!==false&&(control.functions??[]).some(({target})=>!viewOnlyTargets.has(target)))return null;
   }
   const {operations}=c.collect(pack,{mounted:[mounted]},{mode,tacticalEffective:true,tunes:{},includeAmmo:false,ammoItemId:null});
   const program=[];
   for(const op of operations){
    if(op.sourceKind!=='part')continue;
    const {operation,target,modifier,value,scope}=op;
    if(Object.keys(op).length!==7||op.sourceItemId!==itemId||operation!=='StaticAttributeModify'||scope!=='NONE'||
       !/^(?:WeaponMainAttribute\.MainAttrValues|DisplayAttrValues)\.[2-6]$/.test(target)||
       !['Addend','Mult_A','Mult_C'].includes(modifier)||!Number.isFinite(value))return null;
    program.push([target,modifier,Object.is(value,-0)?'-0':value]);
   }
   return program;
  }
  const equivalents=new Map();
  for(const [player,nodes] of contexts){
   const {path,item:id,value,cost}=player;
   const kind=magwellIds.has(id)?'magwell':isOptic(pack,id)?'sight':null;
   if(!kind||sensitive.has(id)||isTactical(path,id)||bipodGripIds.has(id)||
      pack.assembly.socketProviders[id]?.sockets?.length||pack.parts[id]?.boundAmmoByMode?.[mode])continue;
   // Match every legal host occurrence, so a representative is available in
   // all the same builds. Both are leaf attachments and the same slot keeps
   // their operation programs at the same position in the native fold.
   let programs;
   try {
    programs=nodes.map(node=>[node.host,node.socketId,nativeProgram(node)]);
   } catch {
    continue;
   }
   if(programs.some(row=>row[2]===null))continue;
   programs.sort(([a],[b])=>a.localeCompare(b));
   const key=JSON.stringify([path,kind,cost,programs]);
   const existing=equivalents.get(key);
   const preferredId=preferred.get(path);
   if(!existing||id===preferredId||(existing.item!==preferredId&&id<existing.item)){
    if(existing)restrictions.set(existing.value,0);
    equivalents.set(key,player);
   }else restrictions.set(value,0);
  }
  return restrictions;
 }
 function normalizeSights(build){
  const config=build.config.filter(row=>!excluded(row.slotPath)&&(!bipodGripIds.has(row.itemId)||locked(row.slotPath)));
  if(!enabled)return config;
  return config.map(row=>{
   if(locked(row.slotPath)||!['sight','magwell'].includes(item(row.itemId).kind)||!item(row.itemId).family)return row;
   const slot=build.slots.find(s=>s.slotPath===row.slotPath);if(!slot)return row;
   const representative=options(slot.options,row.slotPath).find(id=>item(id).family===item(row.itemId).family);
   return representative&&representative!==row.itemId?{...row,itemId:representative}:row;
  });
 }
 function plan(build){
  const occupied=new Set(build.config.map(row=>row.slotPath)),slots=[];
  for(const slot of build.slots){
   if(locked(slot.slotPath)||occupied.has(slot.slotPath))continue;
   const choices=options(slot.options.filter(id=>isTactical(slot.slotPath,id)),slot.slotPath);if(!choices.length)continue;
   const bundled=build.mounted.find(node=>node.slotPath===slot.slotPath),suffix=bundled?'@'+slot.slotPath+':replaces:'+bundled.itemId:'';
   slots.push({path:slot.slotPath,choices:choices.map(id=>({id,baseFamily:familyKey(id,slot.slotPath),family:familyKey(id,slot.slotPath)+suffix,kind:item(id).kind??'patch',cost:price(id)}))});
  }
  slots.sort((a,b)=>pathOrder(a.path,b.path));
  const key=JSON.stringify(slots),types=new Map(),defaultLasers=new Set(build.mounted.filter(n=>kernel.l(pack,n.itemId,mode)&&!occupied.has(n.slotPath)&&!locked(n.slotPath)).map(n=>n.slotPath));
  for(const slot of slots)for(const choice of slot.choices){
   if(!types.has(choice.family))types.set(choice.family,{key:choice.family,kind:choice.kind,minCost:choice.cost,choices:[]});
   const type=types.get(choice.family);type.minCost=Math.min(type.minCost,choice.cost);type.choices.push({...choice,path:slot.path,patchCapacity:slot.choices.filter(c=>c.kind==='patch').length});
  }
  return {slots,key,types:[...types.values()],defaultLasers};
 }
 function match(layout,counts,check){
  const key=JSON.stringify([layout.key,counts]);
  if(matchingCache.has(key)){stats.matching_hits++;return matchingCache.get(key);}stats.matching_misses++;
  const tokens=layout.types.flatMap((type,i)=>Array.from({length:counts[i]},()=>type)).sort((a,b)=>a.choices.length-b.choices.length||a.key.localeCompare(b.key));
  if(tokens.length>new Set(tokens.flatMap(t=>t.choices.map(c=>c.path))).size||layout.types.some((t,i)=>counts[i]>new Set(t.choices.map(c=>c.path)).size)){
   if(matchingCache.size>=1024)matchingCache.delete(matchingCache.keys().next().value);matchingCache.set(key,null);stats.matching_peak=Math.max(stats.matching_peak,matchingCache.size);return null;
  }
  const lower=tokens.reduce((sum,t)=>sum+t.minCost,0),used=new Set();let best=null,bestCost=Infinity;
  function walk(index,rows,cost){
   check();if(cost>=bestCost)return;
   if(index===tokens.length){best=rows;bestCost=cost;return;}
   const type=tokens[index];
   for(const choice of [...type.choices].sort((a,b)=>a.cost-b.cost||(type.kind==='laser'?a.patchCapacity-b.patchCapacity:0)||pathOrder(a.path,b.path))){
    if(used.has(choice.path))continue;
    used.add(choice.path);walk(index+1,[...rows,{slotPath:choice.path,itemId:choice.id}],cost+choice.cost);used.delete(choice.path);
    if(bestCost===lower)return;
   }
  }
  walk(0,[],0);const result=best?{config:best,cost:bestCost}:null;
  if(matchingCache.size>=1024)matchingCache.delete(matchingCache.keys().next().value);matchingCache.set(key,result);stats.matching_peak=Math.max(stats.matching_peak,matchingCache.size);return result;
 }
 function normalize(build){
  if(!enabled)return normalizeSights(build);
  const key=JSON.stringify(build.config);if(normalizations.has(key))return normalizations.get(key);
  const remember=config=>{if(normalizations.size>=2048)normalizations.delete(normalizations.keys().next().value);normalizations.set(key,config);return config;};
  const config=normalizeSights(build),moving=config.filter(row=>!locked(row.slotPath)&&isTactical(row.slotPath,row.itemId));
  if(!moving.length)return remember(config);
  const paths=new Set(moving.map(row=>row.slotPath)),base=config.filter(row=>!paths.has(row.slotPath)),layout=plan(curves.o(pack,base,mode)),counts=layout.types.map(()=>0);
  for(const row of moving){const family=layout.slots.find(s=>s.path===row.slotPath)?.choices.find(c=>c.baseFamily===familyKey(row.itemId,row.slotPath))?.family,index=layout.types.findIndex(t=>t.key===family);if(index<0)return remember(config);counts[index]++;}
  const assignment=match(layout,counts,()=>{});return remember(assignment?[...base,...assignment.config]:config);
 }
 function* tacticalConfigs(build,{budget=Infinity,check=()=>{}}={}){
  const layout=plan(build),baseCost=mode==='mp'?0:build.mounted.filter(n=>n.source==='equipped').reduce((sum,n)=>sum+price(n.itemId),0),maxCost=budget===null?Infinity:budget;
  const capacity=layout.slots.length,counts=layout.types.map(()=>0),lasers=layout.types.map((t,i)=>({...t,i})).filter(t=>t.kind==='laser'),patches=layout.types.map((t,i)=>({...t,i})).filter(t=>t.kind!=='laser');
  const laserLimit=Math.max(1,fixed.filter(f=>kernel.l(pack,f.itemId,mode)).length),existingLasers=build.mounted.filter(n=>kernel.l(pack,n.itemId,mode)).length;
  const laserCases=laserLimit>existingLasers||layout.defaultLasers.size?[...lasers,null]:[null];
  function* compose(index,left,cost){
   check();if(cost+baseCost>maxCost+1e-8)return;
   if(index===patches.length){
    if(left)return;const assignment=match(layout,counts,check);
    if(assignment&&assignment.cost+baseCost<=maxCost+1e-8){
     const replaced=assignment.config.filter(row=>layout.defaultLasers.has(row.slotPath)).length,added=assignment.config.filter(row=>kernel.l(pack,row.itemId,mode)).length;
     if(existingLasers-replaced+added>laserLimit)return;
     stats.grouped_tactical_configs++;yield [...build.config,...assignment.config];
    }return;
   }
   const type=patches[index];
   for(let n=left;n>=0;n--){counts[type.i]=n;yield* compose(index+1,left-n,cost+n*type.minCost);}counts[type.i]=0;
  }
  for(const laser of laserCases){
   if(laser)counts[laser.i]=1;
   for(let n=capacity-(laser?1:0);n>=0;n--)yield* compose(0,n,laser?.minCost??0);
   if(laser)counts[laser.i]=0;
  }
 }
 const scoredControl=control=>!enabled||(control.functions??[]).some(f=>!viewOnlyTargets.has(f.target));
 return {enabled,item,options,constrain,exactPriceRestrictions,normalize,normalizeSights,isPatch,isTactical,tacticalConfigs,scoredControl,getStats:()=>({...stats,families:families.size})};
}
