import {LinearModel} from './scip_linear_model.mjs?v=303ab3f6a4af69e9';
import {riserIds,isOptic} from './optimizer_mounts.mjs?v=303ab3f6a4af69e9';

// Symbolically unrolls the source resolver's mounted-item fixed point, rather
// than assuming a static list of independent sockets.
export function compileMounts({pack,shop,prices,request,candidateConfigs},kernel){
 const m=new LinearModel(),mode=request.mode;
 if(!['bd','sol','mp'].includes(mode))throw Error('Unknown mode');
 const hidden=new Set(mode==='bd'?shop.hiddenItemIds:[]),costs=mode==='bd'?shop.partCosts:prices;
 const fixed=request.fixed??[],budget=mode==='mp'?null:request.budget??request.budgets?.[0]??shop.weapons[pack.weaponId]?.gunsmithLimit;
 if(mode!=='mp'&&(!Number.isFinite(budget)||budget<0))throw Error('A finite attachment budget is required');
 const emptyLocks=new Set(fixed.filter(f=>f.keepDefault&&!f.itemId).map(f=>f.slotPath));
 const groups=new Map(),players=new Map(),paths=new Map(),incoming=new Map(),nodes=[];
 const permitted=candidateConfigs===undefined?null:new Set(candidateConfigs.flatMap(config=>config.map(c=>c.slotPath+'|'+c.itemId)));
 const rootKey='|'+pack.weaponId,queue=[{path:'',host:pack.weaponId}];
 function rulesFor(host){return [...(pack.assembly.coupling?.[pack.weaponId]?.rules??[]),...(host===pack.weaponId?[]:pack.assembly.coupling?.[host]?.rules??[])];}
 function player(path,item){
  const key=path+'|'+item;if(players.has(key))return players.get(key);
  const quote=costs?.[item],allowed=!hidden.has(item)&&(mode==='mp'||Number.isFinite(quote)&&quote>=0);
  const value=allowed?m.variable('equip'):0;
  const entry={path,item,value,cost:mode==='mp'?0:quote};players.set(key,entry);
  if(!paths.has(path))paths.set(path,[]);paths.get(path).push(entry);return entry;
 }
 for(let q=0;q<queue.length;q++){
  const context=queue[q],key=context.path+'|'+context.host;if(groups.has(key))continue;
  if(context.path.split('/').filter(Boolean).length>=12)continue;
  const group={...context,key,slots:[],rules:rulesFor(context.host)};groups.set(key,group);
  for(const socket of pack.assembly.socketProviders[context.host]?.sockets??[]){
   if(socket.modes&&!socket.modes.includes(mode))continue;
   const path=context.path?context.path+'/'+socket.socketId:String(socket.socketId);
   const selectable=(socket.optionItemIds??[]).map(String).filter(id=>pack.display.objects[id]?.playerSelectable===true&&!pack.display.objects[id]?.selectionDisabledReason);
   const options=permitted?selectable.filter(id=>permitted.has(path+'|'+id)):selectable;
   const rules=group.rules.filter(r=>String(r.targetSocketId)===String(socket.socketId));
   const items=[...new Set([...options,...rules.map(r=>String(r.mountedItemId))])];
   const slot={path,socket,options,rules,nodes:[],selectable:selectable.length>0};group.slots.push(slot);
   for(const item of options)player(path,item);
   for(const item of items){
    const node={path,item,host:context.host,socketId:socket.socketId,key:key+'|'+socket.socketId+'|'+item};slot.nodes.push(node);nodes.push(node);
    const childKey=path+'|'+item;if(!incoming.has(childKey))incoming.set(childKey,[]);incoming.get(childKey).push(node);
    if(pack.assembly.socketProviders[item])queue.push({path,host:item});
   }
  }
 }
 for(const choices of paths.values())m.constrain(m.add(...choices.map(p=>p.value)),'<=',1,'one_request');
 const conditionIds=new Set([...groups.values()].flatMap(g=>g.rules.flatMap(r=>r.condition?.itemIds??[])).map(String));
 const requested=new Map([...conditionIds].map(id=>[id,m.or(...[...players.values()].filter(p=>p.item===id).map(p=>p.value))]));
 let conditions=requested,iterations=0;
 const ordered=[...groups.values()].sort((a,b)=>a.path.split('/').filter(Boolean).length-b.path.split('/').filter(Boolean).length);
 for(let iteration=0;iteration<16;iteration++){
  const mounted=new Map();
  const condition=r=>!r.condition||r.condition.type==='always'?1:r.condition.type==='anyMounted'?m.or(...r.condition.itemIds.map(id=>conditions.get(String(id))??0)):0;
  for(const group of ordered){
   const parent=group.key===rootKey?1:m.or(...(incoming.get(group.key)??[]).map(n=>mounted.get(n.key)??0));
   group.activeParent=parent;
   for(const slot of group.slots){
    const applicable=(paths.get(slot.path)??[]).filter(p=>slot.options.includes(p.item)),none=m.not(m.or(...applicable.map(p=>p.value)));
    const ruleFlags=slot.rules.map((r,i)=>{
     const blockers=slot.rules.filter((other,j)=>r.mountPolicy==='forced'?j>i&&other.mountPolicy==='forced':other.mountPolicy==='forced'||j>i&&other.mountPolicy!=='forced');
     return m.and(condition(r),m.not(m.or(...blockers.map(condition))));
    });
    for(const node of slot.nodes){
     node.preUser=m.and(parent,players.get(slot.path+'|'+node.item)?.value??0,slot.options.includes(node.item)?1:0);
     const activeRules=slot.rules.flatMap((r,i)=>String(r.mountedItemId)===node.item?[ruleFlags[i]]:[]);
     node.preDefault=m.and(parent,none,m.or(...activeRules));
    }
   }
   for(const slot of group.slots){
    const occupies=m.or(...group.slots.flatMap(other=>other.nodes.filter(n=>(pack.assembly.extraOccupancy?.[n.item]?.occupiedSocketIds??[]).map(String).includes(String(slot.socket.socketId))).map(n=>m.or(n.preUser,n.preDefault))));
    if(emptyLocks.has(slot.path)&&slot.selectable)slot.available=m.and(group.activeParent,m.not(occupies));
    for(const node of slot.nodes){node.equipped=m.and(node.preUser,m.not(occupies));node.defaultMounted=m.and(node.preDefault,m.not(occupies));node.active=m.or(node.equipped,node.defaultMounted);mounted.set(node.key,node.active);}
   }
  }
  iterations++;
  const next=new Map([...conditionIds].map(id=>[id,m.or(requested.get(id)??0,...nodes.filter(n=>n.item===id).map(n=>n.active))]));
  if([...conditionIds].every(id=>next.get(id)===conditions.get(id)))break;
  conditions=next;
 }
 for(const p of players.values())m.constrain(m.add(p.value,m.scale(m.or(...nodes.filter(n=>n.path===p.path&&n.item===p.item).map(n=>n.equipped)),-1)),'<=',0,'request_retained');
 for(const n of nodes)if(hidden.has(n.item))m.constrain(n.active,'==',0,'hidden');
 for(const path of new Set(nodes.map(n=>n.path)))m.constrain(m.add(...nodes.filter(n=>n.path===path).map(n=>n.active)),'<=',1,'one_mount');
 const cost=m.add(...[...players.values()].filter(p=>p.value!==0).map(p=>m.scale(p.value,p.cost)));
 if(budget!==null)m.constrain(cost,'<=',budget,'attachment_budget');
 for(const f of fixed){
  const atSlot=nodes.filter(n=>n.path===f.slotPath);
  if(f.keepDefault&&!f.itemId){
   const available=ordered.flatMap(g=>g.slots.filter(s=>s.path===f.slotPath).map(s=>s.available??0));
   m.constrain(m.or(...available),'==',1,'fixed_empty_slot');
   m.constrain(m.or(...atSlot.map(n=>n.active)),'==',0,'fixed_empty_mount');
  }else{
   m.constrain(m.or(...atSlot.filter(n=>n.item===f.itemId).map(n=>f.keepDefault?n.defaultMounted:n.active)),'==',1,'fixed');
  }
 }
 const laserLimit=Math.max(1,fixed.filter(f=>kernel.l(pack,f.itemId,mode)).length);
 m.constrain(m.add(...nodes.filter(n=>kernel.l(pack,n.item,mode)).map(n=>n.active)),'<=',laserLimit,'laser_limit');
 m.constrain(m.add(...nodes.filter(n=>pack.parts[n.item]?.boundAmmoByMode?.[mode]).map(n=>n.active)),'<=',1,'bound_ammo');
 for(const node of nodes.filter(n=>riserIds.has(n.item))){
  const optics=nodes.filter(n=>n.path.startsWith(node.path+'/')&&isOptic(pack,n.item));
  m.constrain(m.add(node.active,m.scale(m.add(...optics.map(n=>n.active)),-1)),'<=',0,'riser_sight');
 }
 if((pack.baseWeaponId??pack.weaponId)==='18020000046')m.constrain(m.add(players.get('2|13020000608')?.value??0,players.get('37|13050000410')?.value??0),'<=',1,'cpw_conflict');
 if(request.validationConfig){
  const selected=new Set(request.validationConfig.map(c=>c.slotPath+'|'+c.itemId));
  for(const [key,p] of players)m.constrain(p.value,'==',selected.has(key)?1:0,'validation_selection');
 }
 if(candidateConfigs!==undefined){
  // Fix one complete survivor. Restricting each socket to the union alone would
  // incorrectly allow combinations that neither exhaustive screen retained.
  // One-hot rows need O(rows * equipped-parts) nonzeros, rather than one full
  // all-socket Boolean guard per row. This keeps the calibration table sparse.
  const choices=new Map([...players.keys()].map(key=>[key,[]]));
  const flags=candidateConfigs.map(config=>{
   const chosen=new Set(config.map(c=>c.slotPath+'|'+c.itemId));
   if([...chosen].some(key=>!players.has(key)))throw Error('A screened configuration contains an unavailable purchase.');
   const flag=m.variable('survivor');
   for(const key of chosen)choices.get(key).push(flag);
   return flag;
  });
  m.constrain(m.add(...flags),'==',1,'screened_combination');
  for(const [key,p] of players)m.constrain(m.add(p.value,m.scale(m.add(...choices.get(key)),-1)),'==',0,'screened_purchase');
 }
 return {model:m,nodes,players,groups:ordered,cost,budget,iterations,decode:solution=>[...players.values()].filter(p=>p.value!==0&&(solution[p.value]??0)>.5).map(p=>({slotPath:p.path,itemId:p.item}))};
}
