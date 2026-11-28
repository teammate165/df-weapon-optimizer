import {defaultAgilityWeights,defaultRecoilWeights,validateWeights} from './optimizer_weights.mjs?v=303ab3f6a4af69e9';
const PREFIX='dfw_saved_v1_';
const CHUNK_SIZE=3300,MAX_CHUNKS=4,MAX_STORAGE=32000;
const YEAR=365*24*60*60;

function encode(value){
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function decode(value){
 const raw=atob(value.replaceAll('-','+').replaceAll('_','/'));
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(raw,c=>c.charCodeAt(0))));
}
function validate(build){
 if(!build||typeof build.weapon_id!=='string'||!['bd','sol','mp'].includes(build.mode)||!Array.isArray(build.config)||!build.tunes||typeof build.tunes!=='object'||Array.isArray(build.tunes))throw Error('Invalid saved build');
 if(build.config.some(c=>!c||typeof c.slotPath!=='string'||typeof c.itemId!=='string')||new Set(build.config.map(c=>c.slotPath)).size!==build.config.length)throw Error('Invalid saved attachments');
 if(Object.values(build.tunes).some(v=>!v||typeof v!=='object'||Array.isArray(v)||Object.values(v).some(x=>!Number.isFinite(x))))throw Error('Invalid saved calibration');
 if(!Number.isInteger(build.shot_count)||build.shot_count<2||build.shot_count>200||!Array.isArray(build.locked_slots)||build.locked_slots.some(x=>typeof x!=='string'))throw Error('Invalid saved build settings');
 if(build.preset!==undefined&&!['recoil','agility'].includes(build.preset))throw Error('Invalid saved preset');
 if(build.search_method!==undefined&&build.search_method!=='anytime'&&(build.search_method!=='coordinate_passes'||!Number.isInteger(build.passes)||build.passes<1||build.passes>20))throw Error('Invalid coordinate pass settings');
 if(build.weights!==undefined)validateWeights(build.weights,defaultRecoilWeights);
 if(build.objective_weights!==undefined)validateWeights(build.objective_weights,defaultAgilityWeights);
}

// The complete save/read/delete interface hides cookie chunking and rollback.
export function createSavedBuildStore({document:doc=globalThis.document,secure=globalThis.location?.protocol==='https:'}={}){
 const jar=()=>new Map(doc.cookie.split(/;\s*/).filter(Boolean).map(pair=>{const at=pair.indexOf('=');return[pair.slice(0,at),pair.slice(at+1)];}));
 const write=(key,value,age=YEAR)=>{doc.cookie=`${key}=${value}; Path=/; Max-Age=${age}; SameSite=Strict${secure?'; Secure':''}`;};
 const erase=key=>write(key,'',0);
 const metaKey=id=>`${PREFIX}${id}_meta`;
 const validId=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
 const random=()=>crypto.randomUUID().replaceAll('-','');
 const owned=()=>[...jar()].filter(([key])=>key.startsWith(PREFIX));
 const usage=()=>owned().reduce((sum,[key,value])=>sum+key.length+value.length+2,0);
 function read(id){
  if(!validId(id))throw Error('Invalid saved build ID');
  try{
   const cookies=jar(),meta=decode(cookies.get(metaKey(id))??'');
   if(!meta||!validId(meta.r)||!Number.isInteger(meta.n)||meta.n<1||meta.n>MAX_CHUNKS)throw Error();
   const chunks=Array.from({length:meta.n},(_,i)=>cookies.get(`${PREFIX}${id}_${meta.r}_${i}`));
   if(chunks.some(x=>!x))throw Error();
   const p=decode(chunks.join(''));
   if(p.v!==1||p.i!==id||typeof p.n!=='string'||!p.n.trim()||p.n.length>80||typeof p.u!=='string')throw Error();
   const build={weapon_id:p.w,mode:p.m,config:p.c.map(([slotPath,itemId])=>({slotPath,itemId})),tunes:Object.fromEntries(p.t.map(([slot,values])=>[slot,Object.fromEntries(values)])),shot_count:p.s,locked_slots:p.l,
    ...(p.o?{preset:p.o.p,...(p.o.w?{weights:p.o.w}:{}),...(p.o.a?{objective_weights:p.o.a}:{}),...(p.o.f?{firing:p.o.f}:{}),...(p.o.s?{search_method:p.o.s,passes:p.o.n}:{})}:{})};
   validate(build);
   return {id,name:p.n,updated_at:p.u,build};
  }catch{throw Error('This saved build is incomplete or unreadable. You can delete it and save a new copy.');}
 }
 function list(){
  return owned().filter(([key])=>key.endsWith('_meta')).map(([key])=>{
   const id=key.slice(PREFIX.length,-5);
   try{return read(id);}catch(error){return{id,name:'Unreadable saved build',error:error.message};}
  }).sort((a,b)=>(b.updated_at??'').localeCompare(a.updated_at??''));
 }
 function save(build,name,id=random()){
  validate(build);name=String(name).trim();
  if(!name||name.length>80)throw Error('Use a build name between 1 and 80 characters');
  if(!validId(id))throw Error('Invalid saved build ID');
  const p={v:1,i:id,n:name,u:new Date().toISOString(),w:build.weapon_id,m:build.mode,c:build.config.map(c=>[c.slotPath,c.itemId]),t:Object.entries(build.tunes).map(([slot,values])=>[slot,Object.entries(values)]),s:build.shot_count,l:build.locked_slots};
  if(build.preset)p.o={p:build.preset,w:build.weights,a:build.objective_weights,f:build.firing,s:build.search_method,n:build.passes};
  const encoded=encode(p),n=Math.ceil(encoded.length/CHUNK_SIZE),revision=random();
  if(n>MAX_CHUNKS)throw Error('This build is too large for cookie storage. Download the JSON instead.');
  const before=owned(),old=jar().get(metaKey(id)),meta=encode({r:revision,n});
  const additions=Array.from({length:n},(_,i)=>[`${PREFIX}${id}_${revision}_${i}`,encoded.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE)]);
  // Budget the temporary replacement too: the old copy survives a failed save.
  const required=additions.reduce((sum,[k,v])=>sum+k.length+v.length+2,0)+metaKey(id).length+meta.length+2;
  if(usage()+required>MAX_STORAGE||before.length+additions.length+(old===undefined?1:0)>40)throw Error('Cookie storage is full. Delete a saved build or download the JSON instead.');
  try{
   for(const [key,value] of additions){write(key,value);if(jar().get(key)!==value)throw Error();}
   write(metaKey(id),meta);
   if(jar().get(metaKey(id))!==meta)throw Error();
   read(id);
   if(before.some(([key,value])=>key!==metaKey(id)&&jar().get(key)!==value))throw Error();
  }catch{
   for(const [key] of additions)erase(key);
   if(old===undefined)erase(metaKey(id));
   for(const [key,value] of before)if(jar().get(key)!==value)write(key,value);
   throw Error('The browser could not save these cookies. Check cookie settings or free storage; the previous build was kept.');
  }
  for(const [key] of owned())if(key.startsWith(`${PREFIX}${id}_`)&&key!==metaKey(id)&&!additions.some(([fresh])=>fresh===key))erase(key);
  return read(id);
 }
 function remove(id){
  if(!validId(id))throw Error('Invalid saved build ID');
  for(const [key] of owned())if(key.startsWith(`${PREFIX}${id}_`))erase(key);
  if(jar().has(metaKey(id)))throw Error('The browser could not delete this saved build');
 }
 return {list,read,save,remove,usage,capacity:MAX_STORAGE};
}
