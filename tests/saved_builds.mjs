import assert from 'node:assert/strict';
import {createSavedBuildStore} from '../builder/saved-builds.js';

class BrowserCookies{
 data=new Map([['unrelated','keep']]);
 block=false;
 writes=0;
 failAt=Infinity;
 limit=Infinity;
 get cookie(){return [...this.data].map(([k,v])=>`${k}=${v}`).join('; ');}
 set cookie(text){
  this.writes++;
  const [pair,...flags]=text.split('; '),at=pair.indexOf('='),key=pair.slice(0,at),value=pair.slice(at+1);
  if(flags.includes('Max-Age=0')){this.data.delete(key);return;}
  if(this.block||this.writes===this.failAt||pair.length>4096)return;
  this.data.set(key,value);
  while(this.data.size>this.limit)this.data.delete(this.data.keys().next().value);
 }
}
const build={weapon_id:'18010000001',mode:'sol',config:[{slotPath:'1',itemId:'13030000109'}],tunes:{'1':Object.fromEntries(Array.from({length:45},(_,i)=>[`authoring:part:13030000109:tune:${'dimension'.repeat(5)}:${i}`,i*.2]))},shot_count:32,locked_slots:['1']};
const doc=new BrowserCookies(),store=createSavedBuildStore({document:doc});
const saved=store.save(build,'M4 / ทดสอบ <saved>');
assert(doc.data.size>3,'large builds must persist beyond a single cookie');
assert.deepEqual(createSavedBuildStore({document:doc}).read(saved.id).build,build);
assert.equal(store.read(saved.id).name,'M4 / ทดสอบ <saved>');
const oldCount=doc.data.size;
const simpler={...build,tunes:{'1':{weight:.4}}};
store.save(simpler,'Replaced',saved.id);
assert.deepEqual(store.read(saved.id).build,simpler);
assert(doc.data.size<oldCount,'replacement must release old chunks');
doc.block=true;
assert.throws(()=>store.save(build,'Failed replacement',saved.id),/could not save/);
assert.equal(store.read(saved.id).name,'Replaced');
doc.block=false;
doc.failAt=doc.writes+2;
assert.throws(()=>store.save(build,'Partial write',saved.id),/could not save/);
assert.equal(store.read(saved.id).name,'Replaced');
doc.failAt=Infinity;
let count=store.list().length;
for(let i=0;i<20;i++){
 try{store.save(build,`Extra ${i}`);count++;}
 catch(error){assert.match(error.message,/storage is full/);break;}
}
assert.equal(store.list().length,count);
assert(store.usage()<=store.capacity);
assert.equal(doc.data.get('unrelated'),'keep');
store.remove(saved.id);
assert(!store.list().some(row=>row.id===saved.id));
const corrupt=store.list()[0];
const chunk=[...doc.data.keys()].find(key=>key.includes(corrupt.id)&&!key.endsWith('_meta'));
doc.data.delete(chunk);
assert(store.list().find(row=>row.id===corrupt.id).error);
assert.throws(()=>store.read(corrupt.id),/incomplete or unreadable/);
store.remove(corrupt.id);
assert(!store.list().some(row=>row.id===corrupt.id));
assert.throws(()=>store.save({...build,tunes:{'1':{bad:NaN}}},'Bad'),/Invalid saved calibration/);
const limited=new BrowserCookies();limited.data.clear();
const limitedStore=createSavedBuildStore({document:limited});
const previous=limitedStore.save(simpler,'Keep me');limited.limit=limited.data.size;
assert.throws(()=>limitedStore.save(simpler,'Would evict'),/could not save/);
assert.equal(limitedStore.read(previous.id).name,'Keep me');
assert.equal(limitedStore.list().length,1);
console.log('Saved builds passed: reload, Unicode, chunking, overwrite, blocked/partial/evicting writes, capacity, corruption and deletion.');
