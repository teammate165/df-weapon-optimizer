import {createStaticClient} from './static-client.js?v=67f0054380987872';
import {imageLoaded,prepareImageCache} from './image-loading.js?v=67f0054380987872';
import {createSavedBuildStore} from './saved-builds.js?v=67f0054380987872';
import {slotIcons} from './assets/slot-icons.js?v=67f0054380987872';
import {portraits} from './assets/portraits.js?v=67f0054380987872';
import {statChanges,groupStatChanges,majorStatGroups,tacticalBenefits} from './part-comparisons.js?v=67f0054380987872';
import {createStatResponseView} from './stat-response-view.js?v=67f0054380987872';
import {createWeaponImage} from './weapon-layers.js?v=67f0054380987872';
import {defaultRecoilWeights,defaultAgilityWeights,distributeWeightPoints} from './optimizer_weights.mjs?v=67f0054380987872';
const $=id=>document.getElementById(id);
const updateWeaponImage=createWeaponImage({canvas:$('gun-assembly'),fallback:$('gun-image'),caption:$('gun-image-caption')});
const state={catalog:null,model:null,config:[],tunes:{},locks:new Set(),slot:null,preview:null,previewSerial:0,previewLoading:false,busy:false,tab:'builder',results:null,resultIndex:0,solutionPreview:null,solutionPreviewLoading:false};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=1)=>Number.isFinite(v)?v.toLocaleString(undefined,{maximumFractionDigits:d}):'—';
const labels={rearGrip:'Pistol grip',barrel:'Barrel',stock:'Stock',magazine:'Magazine',scope:'Optic',muzzle:'Muzzle',foregrip:'Foregrip',functional:'Rail accessory',unique:'Component'};
const sockets={1:'Pistol grip',2:'Barrel',3:'Stock',4:'Handguard',5:'Magazine',6:'Muzzle',7:'Front sight',8:'Foregrip',9:'Rear sight',10:'Rail bipod',11:'Optic',12:'Magazine',13:'Rear optic',14:'Tactical',15:'Front rail',16:'Rear rail',17:'Top rail',18:'Bottom rail',19:'Left rail',20:'Right rail',21:'Optic mount',22:'Unique',23:'Upgrade kit',24:'Aux optic',25:'Aux optic',26:'Aux optic',27:'Handguard',28:'Stock pad',29:'Cheek rest',30:'Grip patch',31:'Side sight',32:'Top patch',33:'Bottom patch',34:'Left patch',35:'Right patch',36:'Barrel bipod',37:'Handguard kit',38:'Stock kit',39:'Barrel kit',40:'Top sight',41:'Raised sight',43:'Grip mount',44:'Magwell',45:'Lens hood',46:'Upper guard',47:'Gas system',48:'Hammer',49:'Trigger',50:'Raised sight',51:'Heat shield',52:'Bolt',53:'Pistol grip',54:'Charging handle',55:'Bowstring',56:'Grip panel',57:'Bow limbs',58:'Bow sight',59:'Arrow rest',60:'Stabilizer',61:'Release',62:'Lever',63:'Guard sight',64:'Guard sight',65:'Handguard',66:'Magazine',67:'Stock',68:'Pistol grip',69:'Raised sight',70:'Left rail',71:'Right rail',72:'Barrel',73:'Ammo',74:'Bowstring',75:'Stock',76:'Bolt kit',77:'Muzzle',78:'Line',79:'Reel',100:'Conflict',150:'Charm'};
const name=id=>state.catalog?.weapons.find(w=>w.id===id)?.name??state.catalog?.names[id]??id;
const category=slot=>state.catalog.slots[slot.options[0]??slot.defaultItemId]??'unique';
const slotName=slot=>sockets[slot.socketId]??labels[category(slot)]??category(slot);
const selectedSlot=()=>state.model?.build.slots.find(s=>s.slotPath===state.slot);
const mounted=path=>state.model?.build.mounted.find(m=>m.slotPath===path);
const equippedId=()=>mounted(state.slot)?.source==='equipped'?mounted(state.slot).itemId:'';
const request=()=>({weapon_id:$('weapon').value,mode:$('mode').value,config:state.config,tunes:state.tunes,shot_count:Number($('shots').value)});
const equippedRequest=()=>({...request(),...state.appliedObjective});
const viewed=()=>state.preview?.model??(state.tab==='optimizer'?state.solutionPreview?.model:null)??state.model;
const showStatResponse=createStatResponseView({load:r=>api('evaluate',r),getContext:()=>{const model=viewed();return{weapon_id:model.stats.weaponId,weapon_name:state.catalog.weapons.find(w=>w.id===model.stats.weaponId)?.name??model.stats.weaponId,mode:model.stats.mode,config:model.build.config,tunes:model.tunes};}});
function status(message,error=false){$('status').textContent=message;$('status').title=message;$('status').classList.toggle('error',error);}
const api=createStaticClient();
if(api.exactOrdinary)$('pattern-reduction-option').insertAdjacentHTML('beforeend',
 '<div><label><input id="exact-ordinary" type="checkbox"> Exact ordinary search (preview)</label></div>');
if(api.exactBeta)$('solver-time-limit').add(new Option('300s / Exact ordinary M4A1 beta','300'));
function setBusy(value){state.busy=value;document.querySelectorAll('button,input,select').forEach(el=>el.disabled=value);$('generate').hidden=Boolean(state.searchController);$('cancel-generate').hidden=!state.searchController;$('cancel-generate').disabled=!state.searchController||state.searchController.signal.aborted;document.body.setAttribute('aria-busy',String(value));if(!value)updateActions();}
function clearResults(){updateSearchNote();hideAccuracyInfo();solutionPreviewSerial++;solutionPreviewCache.clear();state.solutionPreview=null;state.solutionPreviewLoading=false;state.results=null;$('results').replaceChildren();}
function clearPreview(){state.previewSerial++;state.preview=null;state.previewLoading=false;$('preview-summary').hidden=true;}
function pane(value){document.querySelector('.workspace').dataset.pane=value;document.querySelectorAll('[data-pane]').forEach(button=>{if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.pane===value));});}
function tab(value){clearPreview();state.tab=value;for(const id of ['builder','optimizer']){$(`${id}-panel`).hidden=id!==value;$(`${id}-tab`).setAttribute('aria-selected',String(id===value));$(`${id}-tab`).tabIndex=id===value?0:-1;}if(state.model){renderStats();drawGraph();updateActions();}if(value==='optimizer')pane('parts');}
for(const id of ['builder','optimizer']){$(`${id}-tab`).onclick=()=>tab(id);$(`${id}-tab`).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'builder':e.key==='End'?'optimizer':id==='builder'?'optimizer':'builder';tab(next);$(`${next}-tab`).focus();}};}
document.querySelectorAll('button[data-pane]').forEach(b=>b.onclick=()=>pane(b.dataset.pane));
function asset(id){if(Object.hasOwn(portraits,id)&&portraits[id]===null)return null;const source=state.model?.display?.[id]?.imagePath??portraits[id];return source?new URL(source,'https://dfttk.com/').href:`https://playerhub.df.qq.com/playerhub/60004/object/${encodeURIComponent(id)}.png`;}
function slotIcon(label){const s=label.toLowerCase();let path='M12 3 21 8v9l-9 5-9-5V8Z M8 10h8v6H8Z';if(s.includes('grip'))path='M7 3h11v5h-3l-2 13H7l2-13H7Z';else if(s.includes('stock'))path='M3 7h7l5-3h6v16h-4l-7-7H3Z M6 7v6';else if(s.includes('barrel')||s.includes('muzzle'))path='M2 9h17v6H2Z M19 7h3v10h-3 M6 9v6 M9 9v6';else if(s.includes('mag'))path='M7 3h10v8l3 8-8 3-4-10Z M10 7h4 M11 11h4 M12 15l4-1';else if(s.includes('optic')||s.includes('sight'))path='M4 7h16v9H4Z M4 7C0 7 0 16 4 16 M20 7c4 0 4 9 0 9 M9 16v4h7v-4 M8 4v3 M15 4v3';else if(s.includes('rail')||s.includes('patch'))path='M3 9h18v6H3Z M5 5v4 M9 5v4 M13 5v4 M17 5v4 M5 15v4 M9 15v4 M13 15v4 M17 15v4';return `<svg class="fallback-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;}
const rarityClass=id=>({'红':'red','橙':'red','金':'red','紫':'purple','蓝':'blue','绿':'green'}[state.model?.display?.[id]?.rarityId]??'');
function portrait(id,fallback='—',socketId,eager=true){
 const rarity=rarityClass(id);
 const url=id?asset(id):null;
 return `<span class="portrait ${url&&!imageLoaded(url)?'image-loading':''} ${url?'':'empty'} ${rarity?'rarity-'+rarity:''}">${socketId===undefined?slotIcon(fallback):defaultSlotIcon(socketId)}${url?`<img src="${esc(url)}" alt="" loading="${eager?'eager':'lazy'}" decoding="async">`:''}</span>`;
}
document.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.classList.add('failed');},true);
async function evaluate({reset=false}={}){
 cancelLiveCalibration();
 clearPreview();if(reset){clearResults();state.appliedObjective=null;state.config=[];state.tunes={};state.locks.clear();state.slot=null;}
 setBusy(true);status('Resolving loadout…');
 try{const model=await api('evaluate',equippedRequest());adopt(model);status('');}
 catch(error){if(state.model){state.config=structuredClone(state.model.build.config);state.tunes=structuredClone(state.model.tunes);$('mode').value=state.model.stats.mode;$('weapon').value=state.model.stats.weaponId;$('shots').value=state.model.stats.current.recoil.adsTrajectory.length;render();}status(error.message,true);}
 finally{setBusy(false);}
}
function adopt(model){
 const old=state.model;
 // Context changes also enter here through saved builds. Invalidate pending
 // solution requests before the new model can render an old workspace preview.
 if(old&&(old.stats.weaponId!==model.stats.weaponId||old.stats.mode!==model.stats.mode)){clearPreview();clearResults();}
 state.model=model;state.config=structuredClone(model.build.config);state.tunes=structuredClone(model.tunes);
 state.locks=new Set([...state.locks].filter(path=>model.build.slots.some(s=>s.slotPath===path)&&
  (!old||slotState(model.build,path).itemId===slotState(old.build,path).itemId&&slotState(model.build,path).keepDefault===slotState(old.build,path).keepDefault)));
 if(!model.build.slots.some(s=>s.slotPath===state.slot)){state.slot=model.build.slots[0]?.slotPath??null;$('part-search').value='';}
 render();
}
function render(){
 const mode=$('mode').value,w=state.catalog.weapons.find(w=>w.id===$('weapon').value),m=state.model;
 $('weapon-name').textContent=w.name;$('stage-title').textContent=w.name;
 $('cap').innerHTML=mode==='bd'?`TIER ${esc(w.tier?.tier)} · MODS <strong class="${m.cost>w.tier?.gunsmithLimit?'negative':''}">${fmt(m.cost,0)} / ${fmt(w.tier?.gunsmithLimit,0)}</strong> · TOTAL <strong>${fmt(m.cost+w.tier.price,0)}</strong>`:mode==='mp'?'WARFARE <strong>No budget</strong>':`MOD COST <strong>${fmt(m.cost,0)}</strong> · TOTAL <strong>${Number.isFinite(w.price)?fmt(m.cost+w.price,0):'Unavailable'}</strong>`;
 $('operations-budgets').hidden=mode!=='sol';
 $('category-info').hidden=false;
 $('budget-info').innerHTML=mode==='bd'?`Fixed weapon cap: <strong>${fmt(w.tier?.gunsmithLimit,0)}</strong>. Best performance plus affordable target builds.`:mode==='mp'?'<strong>No budget in Warfare.</strong> Max is unpriced; Balanced and Min are unavailable without price comparisons.':'One maximum budget; cheapest builds meeting your targets. Dated market quotes; weapon cost excluded.';
 $('provenance').textContent=`DFTTK ${m.provenance.data_version} · ${mode.toUpperCase()}`;
 renderSlots();renderParts();renderTuning();renderStats();drawGraph();updateActions();updatePreset();
}
function defaultSlotIcon(socketId){
 const index=slotIcons.slots[socketId];if(index===undefined)return `<span class="slot-symbol">${slotIcon(sockets[socketId]??'Component')}</span>`;
 const x=index%slotIcons.columns*100/(slotIcons.columns-1),y=Math.floor(index/slotIcons.columns)*100/(slotIcons.rows-1);
 return `<span class="default-slot-icon" aria-hidden="true" style="--slot-x:${x}%;--slot-y:${y}%"></span>`;
}
function renderSlots(){
 if(!$('slot-groups')){const groups=document.createElement('div');groups.id='slot-groups';groups.className='slot-groups';groups.innerHTML='<button data-slot-group="core" aria-pressed="true">Core attachments</button><button data-slot-group="accessories" aria-pressed="false">Rails & optics</button>';$('gun-canvas').prepend(groups);$('gun-canvas').dataset.slotGroup='core';groups.querySelectorAll('button').forEach(button=>button.onclick=()=>{$('gun-canvas').dataset.slotGroup=button.dataset.slotGroup;groups.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});}
 const rails={top:[],left:[],right:[],bottom:[]};
 const order=[17,19,20,32,34,35,11,21,41,50,69,40,31,6,2,38,3,10,8,5,44,1,30];
 const slots=[...state.model.build.slots].sort((a,b)=>{const x=order.indexOf(a.socketId),y=order.indexOf(b.socketId);return (x<0?100+a.socketId:x)-(y<0?100+b.socketId:y)||a.slotPath.localeCompare(b.slotPath);});
 const areaFor=slot=>[2,6,77,72,39,4,27,37,46,65].includes(slot.socketId)?'left':[3,38,28,29,67,75].includes(slot.socketId)?'right':[10,8,5,12,44,1,30,53,66,68,43].includes(slot.socketId)?'bottom':'top';
 const topRows={rails:new Map(),patches:new Map(),raised:[],other:[]};
 const railIds=[17,19,20,18],patchIds=[32,34,35,33];
 const raisedIds=[21,41,50,69,40];
 const isRaised=slot=>raisedIds.includes(slot.socketId)||slots.some(parent=>raisedIds.includes(parent.socketId)&&slot.slotPath.startsWith(parent.slotPath+'/'));
 for(const slot of slots){const part=mounted(slot.slotPath),explicit=part?.source==='equipped',item=explicit?part.itemId:null;
 const html=`<button class="slot-tile ${state.slot===slot.slotPath?'active':''} ${explicit?'mounted rarity-'+rarityClass(item):''} ${state.locks.has(slot.slotPath)?'locked':''}" data-slot="${esc(slot.slotPath)}" aria-pressed="${state.slot===slot.slotPath}" aria-label="${esc(slotName(slot)+' socket '+slot.slotPath)}" title="${esc(slotName(slot)+' / '+slot.slotPath+' / '+(item?name(item):slot.defaultItemId?'Bundled default':'Empty'))}">${item?portrait(item,slotName(slot),slot.socketId):defaultSlotIcon(slot.socketId)}<span class="tile-copy"><strong>${esc(slotName(slot))}</strong><small>${item?esc(name(item)):slot.defaultItemId?'Default':'Empty'}</small></span></button>`;
 const area=areaFor(slot);
 if(area!=='top'){rails[area].push(html);continue;}
 if(railIds.includes(slot.socketId)){
  topRows.rails.set(slot.socketId,(topRows.rails.get(slot.socketId)??'')+html);
 }else if(patchIds.includes(slot.socketId)){
  topRows.patches.set(slot.socketId,(topRows.patches.get(slot.socketId)??'')+html);
 }else if(isRaised(slot)){topRows.raised.push({html,path:slot.slotPath});
 }else if(slot.socketId===11||slot.socketId===31||slot.socketId===14){
  topRows.patches.set(slot.socketId,(topRows.patches.get(slot.socketId)??'')+html);
 }else topRows.other.push(html);
 }
 const cell=(map,id)=>`<div class="accessory-cell" data-socket-cell="${id}">${map.get(id)??''}</div>`;
 const directions=railIds.map((id,i)=>i).filter(i=>topRows.rails.has(railIds[i])||topRows.patches.has(patchIds[i]));
 const extraColumns=Math.max(3+topRows.other.length,topRows.raised.length);
 const columns=directions.length+extraColumns;
 rails.top=[`<div class="accessory-row" data-accessory-row="patches" style="--accessory-columns:${columns}">${directions.map(i=>cell(topRows.patches,patchIds[i])).join('')}<div class="raised-sights" style="grid-column:span ${extraColumns}" aria-label="Raised sights">${topRows.raised.sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true})).map(item=>item.html).join('')}</div></div>`,
 `<div class="accessory-row" data-accessory-row="rails" style="--accessory-columns:${columns}">${directions.map(i=>cell(topRows.rails,railIds[i])).join('')}${[11,31,14].map(id=>cell(topRows.patches,id)).join('')}${topRows.other.map(html=>`<div class="accessory-cell">${html}</div>`).join('')}</div>`];
 for(const area of Object.keys(rails))$(`slots-${area}`).innerHTML=rails[area].join('');
 document.querySelectorAll('[data-slot]').forEach(button=>button.onclick=()=>{clearPreview();state.slot=button.dataset.slot;$('part-search').value='';tab('builder');renderSlots();renderParts();renderTuning();renderStats();drawGraph();updateActions();pane('parts');status(`${slotName(selectedSlot())} selected - Preview a part to compare.`);});
}
function costText(id){if($('mode').value==='mp')return 'No budget';if(!id)return 'Bundled / empty';const costs=$('mode').value==='bd'?state.catalog.shop.partCosts:state.catalog.prices;return Number.isFinite(costs[id])?fmt(costs[id],0)+($('mode').value==='bd'?' mod cost':' quoted'):'Price unavailable';}
function renderParts(){
 const slot=selectedSlot();if(!slot){$('parts-list').innerHTML='<p class="helper">No configurable sockets for this weapon.</p>';return;}
 $('slot-title').textContent=slotName(slot);const hidden=$('mode').value==='bd'?state.catalog.shop.hiddenItemIds:[];
 const ids=['',...new Set(slot.options.filter(id=>!hidden.includes(id)))],query=$('part-search').value.trim().toLowerCase();
 const costs=$('mode').value==='bd'?state.catalog.shop.partCosts:state.catalog.prices;
 const tiers={'红':5,'橙':5,'金':5,'紫':4,'蓝':3,'绿':2};
 const tier=id=>tiers[state.model.display?.[id]?.rarityId]??0;
 const filtered=ids.filter(id=>!query||(id?name(id)+' '+id:'default none').toLowerCase().includes(query)).sort((a,b)=>Number(b===equippedId())-Number(a===equippedId())||tier(b)-tier(a)||(costs[a]??Infinity)-(costs[b]??Infinity)||name(a).localeCompare(name(b)));
 $('part-count').textContent=`${filtered.length} / ${ids.length}`;
 const previousScroll=$('parts-list').scrollTop;
 $('parts-list').innerHTML=filtered.map(id=>`<button class="part-card ${id===equippedId()?'equipped':''} ${id===(state.preview?.id??equippedId())?'selected':''}" data-part="${esc(id)}" aria-pressed="${id===(state.preview?.id??equippedId())}" title="${esc(id?name(id)+' · '+id:'Restore default / remove selection')}">${portrait(id,slotName(slot),slot.socketId)}<span class="part-copy"><span class="part-name">${id?esc(name(id)):slot.defaultItemId?'Default (bundled)':'No attachment'}</span><span class="part-changes" data-part-changes="${esc(id)}">Comparing stats...</span><small><span>${esc(costText(id))}</span>${id===equippedId()?'<b>EQUIPPED</b>':''}</small></span></button>`).join('')||'<p class="helper">No matching attachments.</p>';
 hidePartTooltip();$('parts-list').scrollTop=previousScroll;
 document.querySelectorAll('[data-part]').forEach(card=>{card.onclick=e=>{if(e.detail<2)previewPart(card.dataset.part);};card.ondblclick=()=>previewPart(card.dataset.part,true);card.onmouseenter=()=>showPartTooltip(card);card.onmouseleave=event=>{if(!partTooltip?.contains(event.relatedTarget))scheduleTooltipHide();};card.onfocus=()=>requestAnimationFrame(()=>{if(card.isConnected&&document.activeElement===card)showPartTooltip(card);});card.onblur=()=>scheduleTooltipHide();});
 updateActions();refreshPartComparisons();
}
const comparisonCache=new Map();let partTooltip=null,tooltipCard=null,tooltipHideTimer=null;
const comparisonKey=()=>JSON.stringify({...request(),compare_slot:state.slot});
const partNumber=value=>fmt(value,Math.abs(value)>0&&Math.abs(value)<0.001?5:3);
const signedPartNumber=value=>(value>0?'+':'')+partNumber(value);
function currentComparison(){return comparisonCache.get(comparisonKey());}
async function refreshPartComparisons(){
 if(!state.model||!state.slot)return;
 const key=comparisonKey();let entry=comparisonCache.get(key);
 if(!entry){entry={loading:true};comparisonCache.set(key,entry);if(comparisonCache.size>6)comparisonCache.delete(comparisonCache.keys().next().value);
  try{const result=await api('evaluate',{...request(),compare_slot:state.slot});entry.loading=false;entry.before=result.stats.current;entry.items=new Map(result.comparisons.map(row=>[row.itemId,row]));}
  catch(error){entry.loading=false;entry.error=error.message;}
 }
 if(key!==comparisonKey())return;paintPartSummaries(entry);if(tooltipCard?.isConnected&&!partTooltip.hidden)fillPartTooltip(tooltipCard,entry);
}
function changesFor(entry,id){const row=entry?.items?.get(id);return row?.available?statChanges(entry.before,row.stats):[];}
function tacticalMarkup(row){
 if(!row?.available)return '';
 const benefits=tacticalBenefits(row?.tactical);if(!benefits.length)return '';
 const caption=row.tactical.included?'When ON · Included in totals · strongest bonus only':'When deployed · Not included in totals';
 return `<span class="tactical-benefits"><span class="tactical-caption">${caption}</span>${benefits.map(b=>`<span class="benefit">${esc(b.label)} ${esc(b.value)}</span>`).join(' / ')}</span>`;
}
function paintPartSummaries(entry){
 document.querySelectorAll('[data-part-changes]').forEach(element=>{
  if(entry.loading){element.textContent='Comparing stats...';return;}if(entry.error){element.textContent='Comparison unavailable';return;}
  const row=entry.items?.get(element.dataset.partChanges),changes=changesFor(entry,element.dataset.partChanges);
  if(!row?.available){element.textContent='Not compatible with this build';return;}
  const major=changes.filter(change=>change.path.startsWith('panel.'));
  element.innerHTML=major.length?major.map(change=>`<span class="${change.tone}">${esc(majorStatGroups.find(g=>'panel.'+g.key===change.path)?.title??change.label)} ${signedPartNumber(change.delta)}</span>`).join(' / '):`<span class="neutral">${changes.length?'Detailed effects only':'No stat change'}</span>`;
  element.innerHTML+=tacticalMarkup(row);
 });
}
function hidePartTooltip(){clearTimeout(tooltipHideTimer);if(partTooltip)partTooltip.hidden=true;if(tooltipCard)tooltipCard.removeAttribute('aria-describedby');tooltipCard=null;}
function scheduleTooltipHide(){clearTimeout(tooltipHideTimer);tooltipHideTimer=setTimeout(hidePartTooltip,100);}
function showPartTooltip(card){
 if(state.busy)return;clearTimeout(tooltipHideTimer);
 if(!partTooltip){partTooltip=document.createElement('div');partTooltip.id='part-tooltip';partTooltip.className='part-tooltip';partTooltip.role='tooltip';partTooltip.hidden=true;document.body.append(partTooltip);partTooltip.onmouseenter=()=>clearTimeout(tooltipHideTimer);partTooltip.onmouseleave=scheduleTooltipHide;}
 if(tooltipCard&&tooltipCard!==card)tooltipCard.removeAttribute('aria-describedby');tooltipCard=card;card.removeAttribute('title');card.setAttribute('aria-describedby','part-tooltip');partTooltip.hidden=false;
 fillPartTooltip(card,currentComparison());refreshPartComparisons();
}
function fillPartTooltip(card,entry){
 const id=card.dataset.part,row=entry?.items?.get(id),changes=changesFor(entry,id),title=id?name(id):selectedSlot()?.defaultItemId?'Default (bundled)':'No attachment';
 const body=entry?.error?`<p class="helper">${esc(entry.error)}</p>`:!entry||entry.loading?'<p class="helper">Calculating source-model changes...</p>':!row?.available?`<p class="helper">${esc(row?.reason??'Comparison unavailable')}</p>`:!changes.length?'<p class="helper">No modeled stat changes from the equipped build.</p>':`<table><thead><tr><th>Stat</th><th>Equipped</th><th>This part</th></tr></thead><tbody>${groupStatChanges(changes).map(group=>`<tr class="comparison-group"><th scope="rowgroup">${esc(group.title)}${group.summary?' <small>pts</small>':''}</th>${group.summary?`<td>${partNumber(group.summary.before)}</td><td class="${group.summary.tone}">${partNumber(group.summary.after)} <span class="inline-change">(${signedPartNumber(group.summary.delta)})</span></td>`:'<td></td><td></td>'}</tr>${group.details.map(change=>`<tr class="comparison-detail"><th>${esc(change.label)} <small>${esc(change.unit)}</small></th><td>${partNumber(change.before)}</td><td class="${change.tone}">${partNumber(change.after)} <span class="inline-change">(${signedPartNumber(change.delta)})</span></td></tr>`).join('')}`).join('')}</tbody></table>`;
 partTooltip.innerHTML=`<div class="tooltip-heading"><strong>${esc(title)}</strong><span>${esc(costText(id))}</span></div><p class="tooltip-context">Compared with equipped build / replacement at default calibration</p>${tacticalMarkup(row)}${body}`;
 const box=card.getBoundingClientRect(),width=Math.min(400,innerWidth-24);partTooltip.style.width=width+'px';
 const left=box.right+12+width<=innerWidth-12?box.right+12:Math.max(12,box.left-width-12);
 partTooltip.style.left=left+'px';partTooltip.style.top=Math.max(12,Math.min(box.top,innerHeight-partTooltip.offsetHeight-12))+'px';
}
$('parts-list').addEventListener('scroll',hidePartTooltip,{passive:true});
window.addEventListener('resize',hidePartTooltip);document.addEventListener('keydown',event=>{if(event.key==='Escape')hidePartTooltip();});
async function previewPart(id,equipAfter=false){
 cancelLiveCalibration();
 if(state.busy)return;if(id===equippedId()){cancelPreview();return;}
 const serial=++state.previewSerial;state.preview=null;state.previewLoading=true;updateActions();status('Comparing attachment…');
 const r=structuredClone(equippedRequest()),path=state.slot;r.config=r.config.filter(x=>x.slotPath!==path&&!x.slotPath.startsWith(path+'/'));if(id)r.config.push({slotPath:path,itemId:id});
 for(const key of Object.keys(r.tunes))if(key===path||key.startsWith(path+'/'))delete r.tunes[key];
 try{const model=await api('evaluate',r);if(serial!==state.previewSerial)return;
  if(id&&!model.build.mounted.some(m=>m.slotPath===path&&m.itemId===id))throw Error('This attachment cannot mount with the current parent or coupled selections.');
  state.preview={id,model};state.previewLoading=false;renderParts();renderStats();drawGraph();status('PREVIEW · '+(id?name(id):'Default')+' · Equip to apply.');
  if(equipAfter)equipPreview();
 }catch(error){if(serial!==state.previewSerial)return;state.previewLoading=false;updateActions();status(error.message,true);}
}
function cancelPreview(){clearPreview();renderParts();renderStats();drawGraph();updateActions();status('Equipped build restored.');}
function equipPreview(){cancelLiveCalibration();if(!state.preview||state.previewLoading)return;const model=state.preview.model;clearPreview();adopt(model);$('parts-list').scrollTop=0;status('Attachment equipped · Stats and calibration updated.');}
function slotState(build,slotPath){
 const part=build.mounted.find(m=>m.slotPath===slotPath);
 return {slotPath,itemId:part?.itemId??'',...(part?.source==='equipped'?{}:{keepDefault:true})};
}
function updateActions(){
 const keep=$('keep-slot'),locked=state.locks.has(state.slot);
 keep.disabled=state.busy||!selectedSlot();
 keep.setAttribute('aria-pressed',String(locked));
 keep.textContent=locked?'Allow optimizer to change this slot':'Keep this slot as-is';
 const part=mounted(state.slot),allLocked=state.config.length>0&&state.config.every(x=>state.locks.has(x.slotPath));$('lock').disabled=state.busy||!state.config.length;$('lock').setAttribute('aria-pressed',String(allLocked));$('lock').textContent=allLocked?'Unlock selected attachments':'Lock selected attachments';
 $('generate').disabled=state.busy||!validWeightSelection();
 $('equip').disabled=state.busy||state.previewLoading||!state.preview;$('equip').textContent=state.previewLoading?'Comparing…':state.preview?'Equip attachment':'Equipped';$('cancel-preview').hidden=!state.preview&&!state.previewLoading;
 $('selection-info').textContent=state.preview?(state.preview.id?name(state.preview.id):'Restore default')+' · '+costText(state.preview.id):part?.source==='equipped'?name(part.itemId):'Default / empty slot. Select a part to compare.';
 $('locks').textContent=state.locks.size?`${state.locks.size} slots locked. Tuning adjustable.`:'No slots locked.';

}
function refreshLocks(){clearResults();renderSlots();updateActions();}
$('keep-slot').onclick=()=>{
 if(state.locks.has(state.slot))state.locks.delete(state.slot);
 else state.locks.add(state.slot);
 refreshLocks();
};
$('lock').onclick=()=>{
 const allLocked=state.config.every(x=>state.locks.has(x.slotPath));
 for(const {slotPath} of state.config)if(allLocked)state.locks.delete(slotPath);else state.locks.add(slotPath);
 refreshLocks();
};
$('equip').onclick=equipPreview;$('cancel-preview').onclick=cancelPreview;
$('part-search').oninput=()=>{$('parts-list').scrollTop=0;renderParts();};
let calibrationRevision=0,calibrationPending=null,calibrationRunning=false;
function cancelLiveCalibration(){calibrationRevision++;calibrationPending=null;}
// Placement labels count source notches from neutral; requests retain source coordinates.
function tuningDisplay(t,value){
 if(t.control.sliderType!=='Discrete')return fmt(value,3);
 const index=t.values.findIndex(v=>Math.abs(v-value)<1e-6);
 const neutral=t.values.findIndex(v=>Math.abs(v-t.control.range.defaultValue)<1e-6);
 const slots=index-neutral;
 return `${slots>0?'+':''}${slots} ${Math.abs(slots)===1?'slot':'slots'}`;
}
function renderTuning(){
 const controls=state.model.controls,bySlot=new Map();
 for(const control of controls){if(!bySlot.has(control.slotPath))bySlot.set(control.slotPath,[]);bySlot.get(control.slotPath).push(control);}
 $('tune-part').textContent=`${controls.length} sliders / ${bySlot.size} attachments`;
 if(!controls.length){$('tuning').innerHTML='<p class="tune-note">Equip a tunable attachment to calibrate it.</p>';renderCalibrationSummary();return;}
 const tuningNames={'\u539a\u5ea6':'Thickness','\u957f\u5ea6':'Length','\u91cd\u91cf':'Weight','\u4f4d\u7f6e':'Position','\u91cd\u5fc3':'Balance','\u914d\u91cd':'Weight','\u77b3\u8ddd':'Eye Relief','\u7f29\u653e\u500d\u7387':'Zoom','\u6258\u816e\u677f\u5b89\u88c5\u4f4d\u7f6e':'Cheek Pad Placement','\u5b89\u88c5\u4f4d\u7f6e':'Position'};
 $('tuning').innerHTML=[...bySlot].map(([path,list])=>`<section class="tune-group ${path===state.slot?'selected-tune-group':''}"><h3>${esc(name(list[0].itemId))}<small>Socket ${esc(path)}</small></h3>${[...list].reverse().map(t=>{
  const raw=t.control.labels.mainLocId.replace('authoring:',''),label=tuningNames[raw]??raw;
  const value=state.tunes[t.slotPath]?.[t.id]??t.value,index=t.values.findIndex(v=>Math.abs(v-value)<1e-6);
  return `<label class="tune"><span>${esc(label)}<small>${tuningDisplay(t,t.values[0])} to ${tuningDisplay(t,t.values.at(-1))}</small></span><input type="range" data-tune="${esc(t.id)}" data-tune-slot="${esc(t.slotPath)}" min="0" max="${t.values.length-1}" value="${index}" step="1" aria-label="${esc(name(t.itemId)+' '+label)}"><output>${tuningDisplay(t,value)}</output></label>`;
 }).join('')}</section>`).join('');
 $('tuning').querySelectorAll('input').forEach(input=>{
  const t=controls.find(c=>c.id===input.dataset.tune&&c.slotPath===input.dataset.tuneSlot);
  input.oninput=()=>{const value=t.values[Number(input.value)];input.nextElementSibling.textContent=tuningDisplay(t,value);(state.tunes[t.slotPath]??={})[t.id]=value;clearPreview();
   calibrationRevision++;calibrationPending={revision:calibrationRevision,request:structuredClone(equippedRequest())};status('Updating calibration...');pumpCalibration();
  };
 });
 renderCalibrationSummary();
}
async function pumpCalibration(){
 if(calibrationRunning)return;calibrationRunning=true;
 try{while(calibrationPending){const pending=calibrationPending;calibrationPending=null;
  try{const model=await api('evaluate',pending.request);if(pending.revision!==calibrationRevision)continue;
   // Keep slider nodes and immediate input values intact while the pointer is down.
   state.model=model;state.config=structuredClone(model.build.config);state.tunes=structuredClone(model.tunes);
   renderStats();drawGraph();renderCalibrationSummary();refreshPartComparisons();status('Calibration updated live.');
  }catch(error){if(pending.revision!==calibrationRevision)continue;state.tunes=structuredClone(state.model.tunes);renderTuning();status(error.message,true);}
 }}finally{calibrationRunning=false;}
}
function renderCalibrationSummary(){
 if(!state.model)return;const {base,current}=state.model.stats;
 const metrics=[...([['Control','recoilControl'],['Handling','handling'],['Stability','stability'],['Accuracy','waistAccuracy']].map(([label,key])=>[label,current.panel[key],base.panel[key],''])),['ADS time',current.handling.adsTimeMs,base.handling.adsTimeMs,'ms'],['Vertical recoil',current.recoil.autoVertical,base.recoil.autoVertical,'x'],['Camera shake',current.stability.fireCameraStability,base.stability.fireCameraStability,'x'],['Weapon kick',current.recoil.fireWeaponStability,base.recoil.fireWeaponStability,'x']];
 $('calibration-stats').innerHTML=metrics.map(([label,value,baseline,unit])=>`<span>${label}<strong>${fmt(value,3)} ${unit}<small>${value-baseline>0?'+':''}${fmt(value-baseline,3)}</small></strong></span>`).join('');
}
const groups=majorStatGroups.map(g=>[g.title,g.key,g.detail]);
const detailLabels={autoVertical:'Auto vertical ×',autoHorizontal:'Auto horizontal ×',singleVertical:'Single vertical ×',singleHorizontal:'Single horizontal ×',fireWeaponStability:'Weapon kick ratio',gunKickHorizontal:'Horizontal kick ×',gunKickVertical:'Vertical kick ×',adsTimeMs:'ADS time (ms)',sprintToFireMs:'Sprint to fire (ms)',adsMoveSpeed:'ADS speed (m/s)',walkSpeed:'Walk speed (m/s)',sprintSpeed:'Sprint speed (m/s)',reloadTime:'Tactical reload (s)',emptyReloadTime:'Empty reload (s)',holsterTime:'Equip time (s, source)',drawTime:'Holster time (s, source)',breathRangeDeg:'Breath sway (°)',holdBreathSeconds:'Hold breath (s)',holdBreathRecoilScale:'Held recoil ×',beHitScale:'Hit sway ×',moveStability:'Movement stability',fireCameraStability:'Firing camera ratio',hipSpreadDeg:'Standing spread (°)',maxSpreadDeg:'Max hip spread (°)',aimSpreadDeg:'ADS spread (°)',aimMaxSpreadDeg:'Max ADS spread (°)',uiFactor:'UI scale ×'};
function renderStats(){
 if(!state.model)return;const {base,current}=viewed().stats,eq=state.model.stats.current;
 const imageModel=viewed(),imageWeapon=state.catalog.weapons.find(w=>w.id===imageModel.stats.weaponId);
 updateWeaponImage(imageModel,asset(imageModel.stats.weaponId),imageWeapon?.name??imageModel.stats.weaponId);
 $('stats-context').textContent=state.preview?'PREVIEW / DELTAS VS EQUIPPED':state.tab==='optimizer'&&state.solutionPreviewLoading?'LOADING SOLUTION PREVIEW':state.tab==='optimizer'&&state.solutionPreview?'SOLUTION PREVIEW / '+state.solutionPreview.label.toUpperCase()+' / DELTAS VS DEFAULT':'EQUIPPED / DELTAS VS DEFAULT';
 const extraLabels={legend_moving:'Moving spread (deg)',legend_idle:'Idle spread (deg)',legend_max:'Max spread (deg)',breathLegend_normal:'Normal breath sway',breathLegend_held:'Held breath sway',breathLegend_unstable:'Unstable breath sway'};
 const numericRows=detail=>Object.entries(detail??{}).flatMap(([k,v])=>typeof v==='number'?[[k,v]]:v&&typeof v==='object'&&!Array.isArray(v)?Object.entries(v).filter(([,n])=>typeof n==='number').map(([child,n])=>[k+'_'+child,n]):[]);
 $('stats').innerHTML=groups.map(([title,key,detail])=>{
  const value=current.panel[key],diff=value-(state.preview?eq:base).panel[key],defaults=Object.fromEntries(numericRows(base[detail]));
  const rows=numericRows(current[detail]);
  if(detail==='recoil')for(const axis of ['Vertical','Horizontal']){
   const a='auto'+axis,b='single'+axis;if(Math.abs(current.recoil[a]-current.recoil[b])<1e-7&&Math.abs(base.recoil[a]-base.recoil[b])<1e-7){const duplicate=rows.findIndex(([k])=>k===b);if(duplicate>=0)rows.splice(duplicate,1);}
  }
  return `<article class="stat-overview" data-stat="${key}"><div class="overview-title"><div class="overview-name"><h3>${title}</h3><button class="stat-info" data-response="${{recoilControl:'3',handling:'5',stability:'6',waistAccuracy:'4'}[key]}" aria-label="${title} response curve" title="${title} response curve">i</button></div><strong>${fmt(value,0)}<span class="delta ${diff<0?'negative':''}">${diff>0?'+':''}${fmt(diff,0)}</span></strong></div><div class="meter"><i style="width:${Math.max(0,Math.min(100,value))}%"></i></div><dl>${rows.map(([k,v])=>`<dt title="${esc(detail==='recoil'&&k.startsWith('auto')&&!rows.some(([other])=>other===k.replace('auto','single'))?k.replace('auto','')+' recoil ×':detailLabels[k]??extraLabels[k]??k)}">${esc(detail==='recoil'&&k.startsWith('auto')&&!rows.some(([other])=>other===k.replace('auto','single'))?k.replace('auto','')+' recoil ×':detailLabels[k]??extraLabels[k]??k)}</dt><dd>${fmt(v,3)} <small>/ ${fmt(defaults[k],3)}</small></dd>`).join('')}</dl></article>`;
 }).join('');
 document.querySelectorAll('[data-response]').forEach(button=>button.onclick=()=>showStatResponse(button.dataset.response));
 $('preview-summary').hidden=!state.preview;if(state.preview)$('preview-summary').textContent='Preview only - Equip to apply';
 $('tactical').innerHTML=[['FIRE RATE',current.weaponStats.fireRateRpm,'rpm'],['VELOCITY',current.weaponStats.muzzleVelocityMps,'m/s'],['MAGAZINE',current.weaponStats.magazineCapacity,'rounds'],['RANGE',current.weaponStats.validDamageRangeMeters,'m']].map(([label,v,unit])=>`<span>${label}<strong>${fmt(v,0)} <small>${unit}</small></strong></span>`).join('');
}
$('open-calibration').onclick=()=>{clearPreview();renderStats();drawGraph();renderTuning();$('calibration-dialog').showModal();};
$('close-calibration').onclick=()=>{$('calibration-dialog').close();};
function graphView(show){$('gun-canvas').hidden=show;$('pattern-canvas').hidden=!show;$('gun-view').setAttribute('aria-pressed',String(!show));$('pattern-view').setAttribute('aria-pressed',String(show));if(show)drawGraph();}
$('gun-view').onclick=()=>graphView(false);$('pattern-view').onclick=()=>graphView(true);
function drawGraph(){if(!state.model)return;const key=$('view').value,{base,current}=viewed().stats,a=base.recoil[key]??[],b=current.recoil[key]??[],all=[{x:0,y:0},...a,...b];
 const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));const scale=Math.min(360/Math.max(maxX-minX,1),210/Math.max(maxY-minY,1));
 const x=v=>220+(v-(minX+maxX)/2)*scale,y=v=>135+(v-(minY+maxY)/2)*scale;
 const line=(points,color,dash='')=>`<polyline points="${[{x:0,y:0},...points].map(p=>`${x(p.x)},${y(p.y)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" ${dash?'stroke-dasharray="5 4"':''}/>`;
 $('graph').innerHTML=Array.from({length:9},(_,i)=>`<line x1="${i*55}" y1="0" x2="${i*55}" y2="270" stroke="#202a32"/>`).join('')+Array.from({length:6},(_,i)=>`<line x1="0" y1="${i*54}" x2="440" y2="${i*54}" stroke="#202a32"/>`).join('')+line(a,'#71818c','dash')+line(b,'#b7ed72')+b.map(p=>`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="2.3" fill="#b7ed72"/>`).join('')+`<text x="12" y="254" fill="#8a9aa6" font-size="10">${esc(fmt(100/scale,2))} model units / 100 px · ${b.length} shots</text>`;
}
// Presets share controls, constraints and solution rendering; add display metadata here.
const presetTemplates={
 recoil:{title:'Lowest Recoil',priorities:'ADS recoil, then Handling for ties',defaults:defaultRecoilWeights,labels:{pattern:'Pattern',camera:'Camera shake',kick:'Gun kick'},field:'weights'},
 agility:{title:'Highest Agility',priorities:'Weighted Handling, hip-fire spread and ADS recoil',defaults:defaultAgilityWeights,labels:{handling:'Handling',accuracy:'Hip-fire accuracy',recoil:'ADS recoil'},field:'objective_weights'}
};
const weightSelections=Object.fromEntries(Object.entries(presetTemplates).map(([key,preset])=>[key,{...preset.defaults}]));
const selectedPreset=()=>$('optimizer-preset').value;
const hasInvalidWeightInput=()=>Boolean($('optimizer-weight-sliders').querySelector('input[type="number"]:invalid'));
const validWeightSelection=()=>!hasInvalidWeightInput();
function objectiveRequest(r){
 const preset=r.preset??'recoil',template=presetTemplates[preset];
 return {preset,[template.field]:{...(r[template.field]??template.defaults)},
  ...(preset==='agility'&&r.weights?{weights:{...r.weights}}:{}),
  ...(r.firing?{firing:r.firing}:{}),
  ...(r.search_method==='coordinate_passes'?{search_method:r.search_method,passes:r.passes}:r.search_method?{search_method:'anytime'}:{})};
}
const currentObjective=()=>objectiveRequest({preset:selectedPreset(),[presetTemplates[selectedPreset()].field]:weightSelections[selectedPreset()]});
let redistribution;
function editWeight(key,metric,points){
 const weights=weightSelections[key];
 const peers=Object.keys(weights).filter(name=>name!==metric);
 if(redistribution?.key!==key||redistribution.metric!==metric){
  redistribution={key,metric,shares:peers.map(name=>weights[name])};
 }
 const distributed=distributeWeightPoints(redistribution.shares,100-points);
 for(const [index,name] of peers.entries())weights[name]=distributed[index]/100;
 weights[metric]=points/100;
}
function normalizeCurrentWeights(){
 const weights=weightSelections[selectedPreset()];
 const points=distributeWeightPoints(Object.values(weights),100);
 for(const [index,metric] of Object.keys(weights).entries())weights[metric]=points[index]/100;
}
function refreshWeightPreview(){
 clearResults();renderStats();drawGraph();
}
function updateWeightControls(editedInput){
 const key=selectedPreset(),preset=presetTemplates[key],weights=weightSelections[key],sliders=$('optimizer-weight-sliders');
 if(sliders.dataset.preset!==key){
  sliders.dataset.preset=key;
  sliders.innerHTML=Object.entries(preset.labels).map(([metric,label])=>`<div class="optimizer-weight"><label for="optimizer-value-${metric}" id="optimizer-label-${metric}">${label}</label><input id="optimizer-weight-${metric}" data-weight="${metric}" aria-labelledby="optimizer-label-${metric}" type="range" min="0" max="100" step="1"><input id="optimizer-value-${metric}" data-metric="${metric}" type="number" min="0" max="100" step="1" required inputmode="numeric"></div>`).join('');
  for(const input of sliders.querySelectorAll('input'))input.oninput=()=>{
   if(input.validity.valid){
    editWeight(key,input.dataset.metric??input.dataset.weight,input.valueAsNumber);
    refreshWeightPreview();
   }
   updateWeightControls(input);
  };
 }
 for(const [metric,value] of Object.entries(weights)){
  const slider=$(`optimizer-weight-${metric}`),number=$(`optimizer-value-${metric}`),points=Math.round(value*100);
  slider.value=points;slider.disabled=state.busy;
  slider.setAttribute('aria-valuetext',`${Number(points.toFixed(2))} relative weight`);
  if(number!==editedInput)number.value=points;
  number.disabled=state.busy;
 }
 const error=$('optimizer-weight-error');
 error.hidden=validWeightSelection();
 $('generate').disabled=state.busy||!validWeightSelection();
}
$('reset-optimizer-weights').onclick=()=>{
 redistribution=undefined;
 Object.assign(weightSelections[selectedPreset()],presetTemplates[selectedPreset()].defaults);
 updateWeightControls();clearResults();renderStats();drawGraph();
};
function updatePreset(){
 const preset=presetTemplates[$('optimizer-preset').value],agility=$('optimizer-preset').value==='agility',box=document.querySelector('.objective');
 updateWeightControls();
 $('pattern-reduction-option').hidden=agility;
 syncSearchMethod();
 $('optimizer-panel').dataset.preset=$('optimizer-preset').value;
 box.querySelector('strong').textContent=preset.title;

 const info=$('optimizer-score-info'),explain=()=>showAccuracyInfo(info,currentObjective());
 info.onmouseenter=explain;info.onmouseleave=hideAccuracyInfo;info.onfocus=explain;info.onblur=hideAccuracyInfo;info.onclick=explain;info.onkeydown=e=>{if(e.key==='Escape')hideAccuracyInfo();};
 box.querySelector('p').textContent=preset.priorities;
 updateSearchNote();
 $('category-info').textContent='Max / Balanced / Min. Cheaper choices retain at least 60% of best improvement. No duplicate builds.';
 $('optimizer-model-note').textContent=agility?'Handling averages normalized ADS and sprint-to-fire times. Hip-fire accuracy uses idle spread. Airborne ADS uses shared scaling. The search reports the best build found within its budget.':'The recoil score combines pattern, camera shake and gun kick. Handling breaks equal recoil scores. Automatic pattern weights horizontal distance by the fastest 200 ms horizontal speed. Unsupported firing protocols use the multiplier proxy.';
}
$('optimizer-preset').onchange=()=>{redistribution=undefined;clearResults();updatePreset();renderStats();drawGraph();};
$('pattern-reduction').onchange=clearResults;
const coordinatePasses=()=>$('optimizer-search-method').value==='coordinate_passes';
function updateSearchNote(){
 $('optimizer-search-note').textContent=coordinatePasses()
  ?'Each search direction stops when a pass finds no improvement or reaches the pass limit. Builds appear after all directions finish.'
  :'Time-limited attachment search and calibration / Best found';
}
function syncSearchMethod(){
 const coordinate=coordinatePasses();
 $('optimizer-time-options').hidden=coordinate;
 $('optimizer-pass-options').hidden=!coordinate;
 const exact=$('exact-ordinary');
 if(exact)exact.closest('div').hidden=coordinate;
 syncExactTimeLimit();
}
$('optimizer-search-method').onchange=()=>{syncSearchMethod();clearResults();};
$('optimizer-passes').onchange=clearResults;
function syncExactTimeLimit(){
 const limit=$('solver-time-limit'),enabled=!coordinatePasses()&&$('optimizer-preset').value==='recoil'&&$('exact-ordinary')?.checked;
 if(enabled&&!Array.from(limit.options).some(option=>option.value==='300')){
  const option=new Option('300s / Exact ordinary','300');
  option.id='exact-ordinary-time-limit';limit.add(option);
 }else if(!enabled){
  if($('exact-ordinary-time-limit')?.selected)limit.value='30';
  $('exact-ordinary-time-limit')?.remove();
 }
 if(enabled&&limit.value==='0')limit.value='30';
}
if($('exact-ordinary'))$('exact-ordinary').onchange=()=>{
 syncExactTimeLimit();
 clearResults();
};
$('generate').onclick=async()=>{
 const started=Date.now();let progress,searchProgress=null;
 const progressText=()=>{
  const p=searchProgress,elapsed=Math.floor((Date.now()-started)/1000);
  if(coordinatePasses()){
   if(!p)return `Starting coordinate search... ${elapsed}s elapsed.`;
   const stage=p.pass?`pass ${p.pass} of ${p.passes}`:'starting';
   return `${p.direction} / ${stage} / ${elapsed}s elapsed. ${p.evaluated.toLocaleString()} builds scored.`;
  }
  const budget=Number($('solver-time-limit').value);
  const clock=budget===0?`${elapsed}s elapsed / no time limit`:`${elapsed}s of ${budget}s`;
  if(!p)return `Starting attachment search... ${clock}.`;
  const ordinaryStage=({maximum:'Proving Maximum',minimum:'Proving Minimum Acceptable',balanced:'Proving Balanced'})[p.category];
  const stage=({exact_ordinary:ordinaryStage??'Enumerating ordinary layouts and tuning',calibration:'Calibrating shortlist',search_tactical:'Searching patches and lasers',search_attachments:'Searching ordinary attachments'})[p.phase]??p.phase;
  const count=n=>Number(n??0).toLocaleString();
  return `${stage} / ${clock}. ${count(p.evaluated)} builds scored (${Number(p.scored_per_second??0).toFixed(0)}/s); ${count(p.tree_nodes)} tree nodes; ${count(p.pruned_branches)} pruned branches; ${count(p.invalid)} rejected; ${count(p.source_errors)} source errors. Retained: ${count(p.ordinary_retained)} ordinary / ${count(p.candidates)} complete. Tactical bases: ${count(p.base_index)}. Calibration evaluations: ${count(p.calibration_evaluations)}. Best loss: ${p.best_loss==null?'pending':Number(p.best_loss).toFixed(4)}. Ordinary traversal: ${p.ordinary_tree_exhausted?'finished':'in progress'}. Total completion: unknown.`;
 };
 state.searchController=new AbortController();
 const feedback=(message,error=false)=>{$('results').innerHTML=`<p class="search-feedback ${error?'error':''}" role="status">${esc(message)}</p>`;};
 try{
  cancelLiveCalibration();clearPreview();clearResults();setBusy(true);renderStats();drawGraph();
  const coordinate=coordinatePasses(),exactOrdinary=!coordinate&&$('optimizer-preset').value==='recoil'&&$('exact-ordinary')?.checked;
  status(coordinate?'Searching attachment and calibration passes...':exactOrdinary?'Enumerating ordinary layouts and tuning...':'Searching attachments and calibrating a bounded shortlist...');
  feedback(progressText());
  $('cancel-generate').focus();
  progress=setInterval(()=>feedback(progressText()),1000);
  const fixed=state.config.filter(x=>[...state.locks].some(path=>path===x.slotPath||path.startsWith(x.slotPath+'/')));
  for(const path of state.locks)if(!fixed.some(row=>row.slotPath===path))fixed.push(slotState(state.model.build,path));
  const r={...request(),...currentObjective(),fixed,locked_slots:[...state.locks],
   ...(coordinate?{search_method:'coordinate_passes',passes:Number($('optimizer-passes').value)}:{search_method:'anytime',time_limit_seconds:Number($('solver-time-limit').value)})};
  if(exactOrdinary)r.search_method=new URLSearchParams(location.search).get('exact-ordinary')==='staged'?'exact_ordinary_staged':'exact_ordinary';
  if(r.preset==='recoil'&&$('pattern-reduction').checked)r.pattern_reduction_percent=5;
  r.minimum_stats=Object.fromEntries(['control','handling','stability','accuracy'].filter(k=>$(`minimum-${k}`).value!=='').map(k=>[k,Number($(`minimum-${k}`).value)]));
  if(r.mode==='sol')r.budget=Number($('budget-0').value);
  const result=await api('optimize',r,{signal:state.searchController.signal,onProgress:p=>{searchProgress=p;feedback(progressText());}});
  if(!Array.isArray(result.results)||!result.results.length)throw Error('Search returned no builds. Try different constraints or another weapon.');
  state.results=result;state.results.request=structuredClone(r);state.resultIndex=0;
  clearInterval(progress);renderResults();
  const incomplete=result.solver?.exhausted===false;
  $('optimizer-search-note').textContent=result.proof_scope
   ?result.proof_scope+(incomplete?' / Search incomplete':''):coordinate?'Best found in coordinate passes':'Best found within search budget / Global optimum unproven';
  status(incomplete?'Search incomplete. See each build for its proof status.':
   result.proof_scope?'Search complete. See each build for its proof status.':'Search complete - Best builds found.');
 }catch(error){clearInterval(progress);const cancelled=error.name==='AbortError';feedback(cancelled?'Search cancelled. Your equipped build is unchanged.':error.message,!cancelled);status(cancelled?'Search cancelled.':error.message,!cancelled);}
 finally{clearInterval(progress);const restoreFocus=document.activeElement===$('cancel-generate');state.searchController=null;$('cancel-generate').textContent='Cancel generation';$('cancel-generate').removeAttribute('aria-disabled');setBusy(false);if(restoreFocus)$('generate').focus();}
};
$('cancel-generate').onclick=()=>{const cancel=$('cancel-generate');if(state.searchController?.signal.aborted)return;cancel.textContent='Cancelling?';cancel.setAttribute('aria-disabled','true');state.searchController?.abort();};

let solutionPreviewSerial=0;
const solutionPreviewCache=new Map();
async function previewSolution(run,row){
 if(!row||row.status!=='best_found'){solutionPreviewSerial++;state.solutionPreview=null;state.solutionPreviewLoading=false;renderStats();drawGraph();return;}
 const payload={weapon_id:run.weapon_id,mode:run.mode,config:row.config,tunes:row.tunes,shot_count:run.request?.shot_count??20,...objectiveRequest(run.request??run)};
 const key=JSON.stringify(payload);
 if(state.solutionPreview?.key===key){state.solutionPreview.label=solutionName(row);renderStats();drawGraph();return;}
 const serial=++solutionPreviewSerial;
 state.solutionPreview=null;state.solutionPreviewLoading=true;renderStats();drawGraph();
 let pending=solutionPreviewCache.get(key);
 if(!pending){pending=api('evaluate',payload);solutionPreviewCache.set(key,pending);}
 try{
  const model=await pending;
  if(serial!==solutionPreviewSerial||state.results!==run)return;
  state.solutionPreview={key,model,label:solutionName(row)};state.solutionPreviewLoading=false;
  if(state.tab==='optimizer'){renderStats();drawGraph();}
 }catch(error){
  solutionPreviewCache.delete(key);
  if(serial!==solutionPreviewSerial||state.results!==run)return;
  state.solutionPreview=null;state.solutionPreviewLoading=false;renderStats();drawGraph();status('Solution preview failed: '+error.message,true);
 }
}
const solutionScore=(run,row)=>run.score_direction==='higher'?row.score:100-row.score;
const solutionName=row=>({'No compromise':'Max','Best price/performance':'Balanced','Cheapest':'Min','best performance':'Max',cheap:'Min',mid:'Balanced',expensive:'Max'}[row.label]??row.label);
function renderResults(){
 hideAccuracyInfo();
 const run=state.results,rows=run.results,row=rows[state.resultIndex];
 const rank={Max:0,Balanced:1,Min:2};
 const ordered=rows.map((r,i)=>({r,i})).sort((a,b)=>(rank[solutionName(a.r)]??3)-(rank[solutionName(b.r)]??3));
 const picker=rows.length>1?`<div class="result-picker">${ordered.map(({r,i})=>`<button data-result="${i}" title="${esc(r.category_note??solutionName(r))}" aria-pressed="${state.resultIndex===i}">${esc(solutionName(r))}</button>`).join('')}</div>`:'';
 const stat=(key,label)=>`<section class="solution-panel solution-preview-stat" data-stat="${key}" aria-label="${label}"><div class="solution-cell-title"><span>${label}</span></div><strong>${fmt(row.stats[key])}</strong></section>`;
 const context=`<p class="solution-context">${esc(name(run.weapon_id))} &middot; ${esc(run.mode.toUpperCase())} &middot; ${esc(solutionName(row))}${row.proof?' &middot; '+esc(row.proof):''}</p>`;
 const cap=run.pattern_constraint;
 const pattern=cap?`<p class="helper" id="pattern-constraint-result">${cap.pattern_model==='legacy-multiplier-v1'?'Pattern proxy':'Pattern loss'} ${row.status==='best_found'?`${fmt(row.components.pattern)} / `:''}cap ${fmt(cap.maximum)} &middot; reference ${fmt(cap.reference)}</p>`:'';
 $('results').innerHTML=context+picker+pattern+(row.status!=='best_found'?`<article class="result"><h3>${row.status==='unavailable'?'No distinct alternative':row.status==='unresolved'?'Search incomplete':'No feasible build'}</h3><p class="helper">${esc(row.reason)}</p></article>`:`<article class="result compact-solution"><div class="solution-grid solution-preview"><section class="solution-panel solution-preview-top" aria-label="Relative score"><span>Relative score</span><strong title="Improvement over default; default 0; higher is better">${fmt(solutionScore(run,row))}</strong></section><section class="solution-panel solution-preview-top" aria-label="Build cost"><span>Cost</span><strong>${row.cost===null?'Unpriced':fmt(row.cost,0)}</strong></section><div class="solution-stat-row">${stat('control','Control')}${stat('handling','Handling')}${stat('stability','Stability')}${stat('accuracy','Accuracy')}</div></div><div class="solution-actions"><button class="primary" data-apply="${state.resultIndex}">Apply build</button><button class="solution-save" id="save-result-build">Save build</button></div></article>`);
 document.querySelectorAll('[data-result]').forEach(button=>button.onclick=()=>{state.resultIndex=Number(button.dataset.result);renderResults();});
 const apply=$('results').querySelector('[data-apply]');
 if(apply)apply.onclick=()=>{
  const changedContext=$('weapon').value!==run.weapon_id||$('mode').value!==run.mode;
  $('weapon').value=run.weapon_id;$('mode').value=run.mode;
  if(changedContext){state.locks.clear();state.slot=null;}
  if(run.request?.shot_count)$('shots').value=run.request.shot_count;
  state.appliedObjective=objectiveRequest(run.request??run);
  state.config=structuredClone(row.config);state.tunes=structuredClone(row.tunes);tab('builder');evaluate();pane('weapon');
 };
 if(state.tab==='optimizer')previewSolution(run,row);
 if($('save-result-build'))$('save-result-build').onclick=()=>showSavedBuilds({weapon_id:run.weapon_id,mode:run.mode,config:structuredClone(row.config),tunes:structuredClone(row.tunes),shot_count:run.request?.shot_count??20,locked_slots:run.request?.locked_slots??(run.request?.fixed??[]).map(f=>f.slotPath),...objectiveRequest(run.request??run)},solutionName(row));
}

let accuracyInfoCard=null,accuracyInfoButton=null;
function hideAccuracyInfo(){if(accuracyInfoCard)accuracyInfoCard.hidden=true;if(accuracyInfoButton){accuracyInfoButton.setAttribute('aria-expanded','false');accuracyInfoButton.removeAttribute('aria-describedby');}accuracyInfoButton=null;}
function showAccuracyInfo(button,objective){
 hideAccuracyInfo();accuracyInfoButton=button;
 if(!accuracyInfoCard){accuracyInfoCard=document.createElement('div');accuracyInfoCard.id='optimizer-score-tooltip';accuracyInfoCard.className='solution-info-card';accuracyInfoCard.role='tooltip';document.body.append(accuracyInfoCard);}
 const template=presetTemplates[objective.preset],weights=objective[template.field];
 const total=Object.values(weights).reduce((sum,value)=>sum+value,0);
 const mix=total>0?Object.entries(template.labels).map(([key,label])=>`${label} ${fmt(100*weights[key]/total)}%`).join(' / '):'Set at least one weight above zero.';
 accuracyInfoCard.innerHTML=`<strong>Preset scoring</strong><p>${mix}</p><p>Relative score measures weighted improvement over the default build. Higher is better. ${objective.preset==='agility'?'Handling averages normalized ADS and sprint-to-fire times. Hip-fire accuracy uses idle spread.':'Handling breaks equal-recoil ties.'}</p>`;
 accuracyInfoCard.hidden=false;button.setAttribute('aria-expanded','true');button.setAttribute('aria-describedby',accuracyInfoCard.id);
 const rect=button.getBoundingClientRect(),width=Math.min(300,innerWidth-24);accuracyInfoCard.style.width=width+'px';
 accuracyInfoCard.style.left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12))+'px';
 const height=accuracyInfoCard.getBoundingClientRect().height;accuracyInfoCard.style.top=Math.max(12,Math.min(rect.top-height-8,innerHeight-height-12))+'px';
}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.optimizer-score-info'))hideAccuracyInfo();});
window.addEventListener('resize',hideAccuracyInfo);document.addEventListener('scroll',hideAccuracyInfo,true);
function renderWeapons(){const query=$('weapon-search').value.toLowerCase().trim();$('weapon-list').innerHTML=state.catalog.weapons.filter(w=>(w.name+' '+w.id).toLowerCase().includes(query)).map(w=>`<button class="part-card ${w.id===$('weapon').value?'selected':''}" data-weapon="${esc(w.id)}">${portrait(w.id,'GUN',undefined,false)}<span><span class="part-name">${esc(w.name)}</span><small>${w.tier?'Tier '+esc(w.tier.tier)+' · '+fmt(w.tier.gunsmithLimit,0)+' cap':'Catalog weapon'}</small></span></button>`).join('')||'<p class="helper">No matching weapons.</p>';
 document.querySelectorAll('[data-weapon]').forEach(button=>button.onclick=()=>{$('weapon').value=button.dataset.weapon;$('weapon-dialog').close();evaluate({reset:true});});
}
$('choose-weapon').onclick=()=>{$('weapon-search').value='';renderWeapons();$('weapon-dialog').showModal();$('weapon-search').focus();};$('close-weapons').onclick=()=>$('weapon-dialog').close();$('weapon-search').oninput=renderWeapons;
$('mode').onchange=()=>evaluate({reset:true});$('reset').onclick=()=>evaluate({reset:true});$('shots').onchange=()=>evaluate();$('view').onchange=drawGraph;

const savedBuilds=createSavedBuildStore();
let saveDraft=null;
function showSavedBuilds(build={...equippedRequest(),locked_slots:[...state.locks]},suffix=''){
 saveDraft=structuredClone(build);
 $('save-build-name').value=[name(build.weapon_id),suffix].filter(Boolean).join(' - ');
 $('save-build-context').textContent=`Saving ${name(build.weapon_id)} / ${build.mode.toUpperCase()} / ${build.config.length} selected attachments`;
 $('saved-build-status').textContent='';renderSavedBuilds();$('saved-builds-dialog').showModal();
}
function renderSavedBuilds(){
 const rows=savedBuilds.list();
 $('saved-build-list').innerHTML=rows.length?rows.map(row=>`<article class="saved-build-row"><div><strong>${esc(row.name)}</strong><small>${row.error?esc(row.error):`${esc(name(row.build.weapon_id))} / ${esc(row.build.mode.toUpperCase())}`}</small></div><div class="saved-build-actions">${row.error?'':`<button data-load-build="${row.id}">Load</button><button data-replace-build="${row.id}" title="Replace this saved build with the build shown above">Replace</button>`}<button data-delete-build="${row.id}">Delete</button></div></article>`).join(''):'<p class="helper">No saved builds yet.</p>';
 $('saved-build-storage').textContent=`Cookie storage: ${fmt(savedBuilds.usage()/1024)} / ${fmt(savedBuilds.capacity/1024)} KB`;
 $('saved-build-list').querySelectorAll('[data-load-build]').forEach(button=>button.onclick=()=>loadSavedBuild(button.dataset.loadBuild));
 $('saved-build-list').querySelectorAll('[data-replace-build]').forEach(button=>button.onclick=()=>{
  try{const old=savedBuilds.read(button.dataset.replaceBuild);savedBuilds.save(saveDraft,old.name,old.id);renderSavedBuilds();$('saved-build-status').textContent=`Updated ${old.name}.`;}catch(error){$('saved-build-status').textContent=error.message;}
 });
 $('saved-build-list').querySelectorAll('[data-delete-build]').forEach(button=>button.onclick=()=>{
  try{savedBuilds.remove(button.dataset.deleteBuild);renderSavedBuilds();$('saved-build-status').textContent='Saved build deleted.';}catch(error){$('saved-build-status').textContent=error.message;}
 });
}
async function loadSavedBuild(id){
 setBusy(true);$('saved-build-status').textContent='Loading saved build...';
 try{
  const saved=savedBuilds.read(id),build=saved.build,model=await api('evaluate',build);
  if(build.config.some(c=>!model.build.mounted.some(m=>m.slotPath===c.slotPath&&m.itemId===c.itemId))||Object.entries(build.tunes).some(([slot,values])=>Object.entries(values).some(([key,value])=>model.tunes[slot]?.[key]!==value)))throw Error('This build no longer matches the catalog. The saved copy was kept.');
  $('weapon').value=build.weapon_id;$('mode').value=build.mode;$('shots').value=build.shot_count;
  clearPreview();state.locks.clear();state.slot=null;adopt(model);
  state.appliedObjective=build.preset?objectiveRequest(build):null;
  if(state.appliedObjective){
   const {preset}=state.appliedObjective,field=presetTemplates[preset].field;
   $('optimizer-preset').value=preset;
   $('optimizer-search-method').value=build.search_method??'coordinate_passes';
   if(build.search_method==='coordinate_passes'&&['6','12','20'].includes(String(build.passes)))$('optimizer-passes').value=String(build.passes);
   syncSearchMethod();
   redistribution=undefined;
   Object.assign(weightSelections[preset],state.appliedObjective[field]);
   normalizeCurrentWeights();
   clearResults();updatePreset();
  }
  state.locks=new Set(build.locked_slots.filter(path=>model.build.slots.some(s=>s.slotPath===path)));
  tab('builder');renderSlots();updateActions();pane('weapon');$('saved-builds-dialog').close();status(`Loaded ${saved.name}.`);
 }catch(error){$('saved-build-status').textContent=error.message;}finally{setBusy(false);}
}
$('open-saved-builds').onclick=()=>showSavedBuilds();
$('close-saved-builds').onclick=()=>$('saved-builds-dialog').close();
$('save-build-form').onsubmit=event=>{
 event.preventDefault();
 try{const saved=savedBuilds.save(saveDraft,$('save-build-name').value);renderSavedBuilds();$('saved-build-status').textContent=`Saved ${saved.name}.`;}catch(error){$('saved-build-status').textContent=error.message;}
};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({request:equippedRequest(),locked_slots:[...state.locks],model:state.model,optimization:state.results},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`delta-${$('weapon').value}-${$('mode').value}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
await prepareImageCache();
try{setBusy(true);state.catalog=await api('catalog');state.catalog.weapons.sort((a,b)=>a.name.localeCompare(b.name));$('weapon').value='18010000001';await evaluate();}catch(error){status(error.message,true);}

$('open-source-notes').onclick=()=>$('source-notes-dialog').showModal();
$('close-source-notes').onclick=()=>$('source-notes-dialog').close();
