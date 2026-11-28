// Socket-aware composition from DFTTK's public layer catalogs. Images stay remote.
const stockParts=['13040000104','13040000105','13040000106','13040000108','13040000109','13040000112','13040000113','13040000224','13040000225'];
const stockRoutes={
 '18010000023':{parts:stockParts,adapter:'12220000019',choice:'adapter'},
 '18010000024':{parts:[...stockParts,'13040000234'],adapter:'12220000019',choice:'adapter'},
 '18020000001':{parts:stockParts,adapter:'12220000019',choice:'adapter'},
 '18050000031':{parts:[...stockParts,'13040000234'],adapter:'12220000019',choice:'adapter'},
 '18010000037':{parts:[...stockParts,'13040000185'],adapter:'12220000024',choice:'buffer'},
 '18020000008':{parts:[...stockParts,'13040000185'],adapter:'12220000024',choice:'buffer'},
 '18020000046':{parts:[...stockParts,'13040000234'],adapter:'12220000087',choice:'buffer',path:'37/67',host:'13050000410',hostPath:'37',bufferSocket:'sto2_point'},
};
export function layerDirectory(weaponId,mounted) {
 if(weaponId==='18010000001')return 'm4';
 if(weaponId==='18010000052'||weaponId==='18040000001'&&mounted.some(m=>m.itemId==='13020000625')||weaponId==='18050000007'&&mounted.some(m=>m.itemId==='13040000252'))return `experience-${weaponId}`;
 return weaponId;
}
export function unpackLayers(data) {
 if(data.kind==='weaponLayerCatalog'&&data.schemaVersion===2)return data;
 if(data.kind!=='weaponLayerPackedCatalog'||data.schemaVersion!==1||data.poses.length!==data.parts.length)throw Error('Unsupported weapon-layer catalog');
 const pose=i=>{if(!Number.isInteger(i)||i<0||i>=data.poses.length)throw Error('Invalid layer pose');return `p${i.toString(36)}`;};
 return {...data,width:data.size[0],height:data.size[1],rootPose:pose(data.root),
  poses:Object.fromEntries(data.poses.map((itemId,i)=>[pose(i),{itemId}])),
  transitions:Object.fromEntries(data.transitions.map(([from,socket,itemId,to])=>[`${pose(from)}|${socket}|${itemId}`,pose(to)])),
  parts:Object.fromEntries(data.parts.map((part,i)=>[pose(i),part===null?{empty:true,tiles:[]}:{url:part[0],tiles:part[1].map(tile=>{
   if(tile.length!==7)throw Error('Invalid layer tile');return {band:tile[0],source:tile.slice(1,5),destination:tile.slice(5)};
  })}]))};
}
function chooseOffset(catalog,node,choices,mounted) {
 if(choices.length!==2)return choices;
 const wid=catalog.weaponId,route=stockRoutes[wid];let expected,selected;
 if(route?.parts.includes(node.itemId)&&node.path===(route.path??'3')&&node.parent.itemId===(route.host??wid)) {
  const socket=node.itemId==='13040000185'?'mdtsto_point':'stocase_point';
  const buffer=['13040000224','13040000225'].includes(node.itemId)?'12220000077':node.itemId==='13040000234'?'12220000084':'12220000018';
  expected=[{itemId:route.adapter,socket,attachSocket:'sto_point',host:wid,hostPath:''},
   {itemId:buffer,socket,attachSocket:route.bufferSocket??'stobuffer_point',host:route.host??wid,hostPath:route.hostPath??''}];
  selected=expected[route.choice==='adapter'?0:1];
 }else if(wid==='18010000038'&&node.itemId==='13110000085'&&node.path==='11'&&node.parent.itemId===wid) {
  expected=['ap1_point','ap2_point'].map(attachSocket=>({itemId:'12050000010',socket:'ap5000_point',attachSocket,host:wid,hostPath:''}));selected=expected[0];
 }else if(wid==='18070000004'&&['13110000043','13110000044','13110000062','13110000063','13110000087','13110000102'].includes(node.itemId)&&node.path==='21/11'&&node.parent.itemId==='13210000016'&&mounted.some(m=>m.slotPath==='2'&&m.itemId==='13020000594'&&m.hostItemId===wid)) {
  expected=['12050000012','12050000011'].map(itemId=>({itemId,socket:'scohigh2_point',attachSocket:'sco_point',host:'13210000016',hostPath:'21'}));selected=expected[1];
 }
 const matches=(choice,spec)=>choice.socket===spec.socket&&choice.parent.itemId===spec.itemId&&choice.parent.socket===spec.attachSocket&&choice.parent.parent?.itemId===spec.host&&choice.parent.parent?.path===spec.hostPath;
 return expected?.every(spec=>choices.filter(c=>matches(c,spec)).length===1)?choices.filter(c=>matches(c,selected)):choices;
}
export function resolveLayerPoses(catalog,mounted) {
 const root={itemId:catalog.weaponId,parent:null,socket:null,adapter:'EAdapterItemType::Receiver',path:''};
 const nodes=[root],byPath=new Map([['',root]]),extras=[];
 const owns=(node,socket)=>catalog.items[node.itemId]?.sockets.includes(socket);
 const sorted=mounted.filter(m=>String(m.socketId)!=='73'&&m.slotPath!=='73').toSorted((a,b)=>a.slotPath.split('/').length-b.slotPath.split('/').length||a.slotPath.localeCompare(b.slotPath,'en',{numeric:true}));
 for(const mount of sorted) {
  const parent=byPath.get(mount.slotPath.includes('/')?mount.slotPath.slice(0,mount.slotPath.lastIndexOf('/')):'');
  const socket=catalog.sockets[mount.socketId];
  if(!parent||parent.itemId!==mount.hostItemId||!socket||!catalog.items[mount.itemId]||!owns(parent,socket.name))throw Error(`Unsupported attachment layer: ${mount.itemId}`);
  const node={itemId:mount.itemId,parent,socket:socket.name,adapter:socket.adapter,path:mount.slotPath};nodes.push(node);byPath.set(node.path,node);
 }
 const ids=new Set(nodes.map(n=>n.itemId)),adapters=new Set(nodes.map(n=>n.adapter)),sockets=new Set(nodes.map(n=>n.socket));
 function condition(rule) {
  let value;
  if(rule.type==='None')value=true;
  else if(rule.type==='ItemId')value=rule.items.some(id=>ids.has(id));
  else if(rule.type==='AdapterType')value=rule.adapters.some(id=>adapters.has(id));
  else if(rule.type==='Socket')value=rule.sockets.some(id=>sockets.has(id));
  else throw Error('Unsupported layer visibility condition');
  return rule.invert?!value:value;
 }
 const used=new Set();
 for(let pass=0;pass<=catalog.rules.length;pass++) {
  const previous=extras.length;
  for(const rule of catalog.rules) {
   if(used.has(rule)||!ids.has(rule.owner))continue;
   let visible=condition(rule);
   for(const c of rule.conditions)visible=c.or?visible||condition(c):visible&&condition(c);
   if(!(visible?rule.visible:rule.defaultVisible))continue;
   let parent;
   for(const priority of rule.priorities) {
    const possible=nodes.filter(n=>n.adapter===priority&&owns(n,rule.socket));
    const owners=possible.filter(n=>n.itemId===rule.owner);let choices=owners.length?owners:possible;
    if(choices.length>1&&catalog.weaponId==='18040000001'&&ids.has('13020000625')&&rule.owner==='18040000001'&&rule.itemId==='12050000011'&&rule.socket==='sco_point'&&rule.type==='ItemId'&&!rule.invert) {
     const specific=choices.filter(n=>nodes.some(child=>rule.items.includes(child.itemId)&&child.parent===n&&child.path.startsWith('69/11/')&&n.path==='69/11'));
     if(specific.length===1)choices=specific;
    }
    if(choices.length>1)throw Error('Ambiguous attachment-layer parent');
    if(choices.length){parent=choices[0];break;}
   }
   if(!parent&&rule.extraPriorities?.length) {
    const choices=extras.filter(n=>owns(n,rule.socket));
    if(choices.length>1)throw Error('Ambiguous auxiliary layer parent');parent=choices[0];
   }
   if(parent) {
    used.add(rule);
    if(!extras.some(n=>n.itemId===rule.itemId&&n.parent===parent&&n.socket===rule.socket))extras.push({itemId:rule.itemId,parent,socket:rule.socket,adapter:'extra'});
   }
  }
  if(extras.length===previous)break;
 }
 function provisionalPose(node,seen=new Set()) {
  if(seen.has(node))return null;seen.add(node);
  return node.parent?catalog.transitions[`${provisionalPose(node.parent,seen)}|${node.socket}|${node.itemId}`]:catalog.rootPose;
 }
 for(const node of nodes.slice(1)) {
  const offsets=catalog.items[node.itemId].offsets;if(!offsets.length)continue;
  let choices=offsets.flatMap(socket=>[...extras,node.parent].filter(parent=>owns(parent,socket)).map(parent=>({parent,socket})));
  if(choices.some(c=>c.parent!==node.parent))choices=choices.filter(c=>c.parent!==node.parent);
  choices=choices.filter(c=>!choices.some(other=>{for(let n=other.parent.parent;n;n=n.parent)if(n===c.parent)return true;return false;}));
  const unique=new Map();for(const choice of choices)unique.set(catalog.transitions[`${provisionalPose(choice.parent)}|${choice.socket}|${node.itemId}`]??choice,choice);
  choices=chooseOffset(catalog,node,[...unique.values()],mounted);
  if(choices.length>1)throw Error(`Ambiguous attachment-layer offset: ${node.itemId}`);
  if(choices.length)Object.assign(node,choices[0]);
 }
 nodes.push(...extras);const resolved=new Map(),visiting=new Set();
 function pose(node) {
  if(resolved.has(node))return resolved.get(node);
  if(visiting.has(node))throw Error('Cyclic attachment layer');visiting.add(node);
  const key=node.parent?catalog.transitions[`${pose(node.parent)}|${node.socket}|${node.itemId}`]:catalog.rootPose;
  if(!key||!catalog.poses[key])throw Error(`Missing attachment-layer pose: ${node.itemId}`);
  visiting.delete(node);resolved.set(node,key);return key;
 }
 return nodes.map(pose);
}
const catalogs=new Map(),images=new Map();let pixels=0;
async function catalogFor(directory) {
 if(!catalogs.has(directory)) {
  const pending=fetch(new URL(`./assets/weapon-layers/${directory}.json?v=8e593db3b6670458`,import.meta.url),{signal:AbortSignal.timeout(15000)})
   .then(r=>{if(!r.ok)throw Error('Layer catalog unavailable');return r.json();}).then(unpackLayers)
   .catch(e=>{catalogs.delete(directory);throw e;});
  catalogs.set(directory,pending);if(catalogs.size>8)catalogs.delete(catalogs.keys().next().value);
 }
 return catalogs.get(directory);
}
function imageFor(directory,filename) {
 if(!/^[a-f0-9]{64}\.webp$/.test(filename))throw Error('Invalid layer image URL');
 const url=`https://dfttk.com/data/weapon-layers/${directory}/${filename}`;
 if(!images.has(url)) {
  const entry={pixels:0,promise:null};entry.promise=new Promise((resolve,reject)=>{
   const image=new Image(),timer=setTimeout(()=>{image.src='';reject(Error('Layer image timed out'));},15000);
   image.onload=()=>{clearTimeout(timer);entry.pixels=image.naturalWidth*image.naturalHeight;pixels+=entry.pixels;
    for(const [key,old] of images){if(pixels<=33554432)break;if(key!==url&&old.pixels){images.delete(key);pixels-=old.pixels;}}
    resolve(image);};
   image.onerror=()=>{clearTimeout(timer);reject(Error('Layer image unavailable'));};image.src=url;
  }).catch(e=>{images.delete(url);throw e;});images.set(url,entry);
 }
 const entry=images.get(url);images.delete(url);images.set(url,entry);return entry.promise;
}
export async function composeWeapon(weaponId,mounted) {
 if(!/^18\d{9}$/.test(weaponId))throw Error('Invalid weapon ID');
 const directory=layerDirectory(weaponId,mounted),catalog=await catalogFor(directory);
 if(catalog.weaponId!==weaponId)throw Error('Weapon layer catalog mismatch');
 const poses=resolveLayerPoses(catalog,mounted);
 if(poses.some(p=>!catalog.parts[p]))throw Error('Missing attachment image');
 const parts=poses.map(p=>catalog.parts[p]).filter(p=>!p.empty);
 const loaded=await Promise.all(parts.map(p=>imageFor(directory,p.url)));
 const tiles=parts.flatMap((part,order)=>part.tiles.map(tile=>({...tile,order}))).sort((a,b)=>a.band-b.band||a.order-b.order);
 if(!tiles.length)throw Error('Empty weapon composition');
 const left=Math.min(...tiles.map(t=>t.destination[0])),top=Math.min(...tiles.map(t=>t.destination[1]));
 const right=Math.max(...tiles.map(t=>t.destination[0]+t.source[2])),bottom=Math.max(...tiles.map(t=>t.destination[1]+t.source[3]));
 const padding=Math.max(12,Math.ceil(Math.max(right-left,bottom-top)*.04)),canvas=document.createElement('canvas');
 canvas.width=right-left+padding*2;canvas.height=bottom-top+padding*2;
 const context=canvas.getContext('2d');if(!context)throw Error('Canvas unavailable');context.translate(padding-left,padding-top);
 for(const tile of tiles)context.drawImage(loaded[tile.order],...tile.source,...tile.destination,tile.source[2],tile.source[3]);
 return canvas;
}
export function createWeaponImage({canvas,fallback,caption}) {
 let serial=0,key=null,last=null;
 async function update(model,referenceUrl,weaponName,{retry=false}={}) {
  if(!model)return;
  const mounted=model.build.mounted;
  const next=JSON.stringify([model.stats.weaponId,model.stats.mode,mounted.map(m=>[m.slotPath,m.itemId,m.socketId,m.hostItemId]).sort()]);
  last=[model,referenceUrl,weaponName];if(next===key&&!retry)return;key=next;const current=++serial;
  canvas.hidden=true;canvas.dataset.status='loading';delete canvas.dataset.assemblyKey;
  fallback.hidden=true;fallback.alt=`${weaponName} base reference`;if(fallback.src!==referenceUrl)fallback.src=referenceUrl;
  caption.textContent='';caption.title='';canvas.parentElement.classList.add('assembly-loading');
  caption.tabIndex=-1;caption.removeAttribute('role');
  try {
   const result=await composeWeapon(model.stats.weaponId,mounted);if(current!==serial)return;
   canvas.width=result.width;canvas.height=result.height;canvas.getContext('2d').drawImage(result,0,0);
   canvas.hidden=false;fallback.hidden=true;canvas.dataset.status='ready';canvas.dataset.assemblyKey=next;
   canvas.setAttribute('aria-label',`${weaponName} current attachment configuration`);
   caption.textContent='CURRENT BUILD';caption.title='Attachment layout; calibration positions are not represented.';
  }catch(error) {
   if(current!==serial)return;canvas.dataset.status='fallback';fallback.hidden=false;caption.textContent='BASE REFERENCE · CLICK TO RETRY BUILD PREVIEW';caption.title=error.message;
   caption.tabIndex=0;caption.setAttribute('role','button');
  }finally{if(current===serial)canvas.parentElement.classList.remove('assembly-loading');}
 }
 caption.onclick=()=>{if(last&&canvas.dataset.status==='fallback')update(...last,{retry:true});};
 caption.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();caption.click();}};
 return update;
}
