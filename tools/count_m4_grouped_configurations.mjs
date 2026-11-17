// Exact weighted M4A1 grouped count; prepare the standard source runtime first.
﻿import fs from 'node:fs';import assert from 'node:assert/strict';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';import * as curves from '../.scratch/calibration-check/curves.mjs';import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
import {compileMounts} from './scip_mount_model.mjs';import {createMountSearch} from './mount_search.mjs';import {createChoiceGroups} from './choice_groups.mjs';import {presets} from './optimizer_presets.mjs';
fs.mkdirSync('.scratch/m4-combination-count',{recursive:true});
const pack=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/weapons/18010000001.json')),cat=JSON.parse(fs.readFileSync('.scratch/github-pages-site/data/catalog.json'));
const fixed=[{slotPath:'11',itemId:'13110000091'}],request={mode:'bd',budget:1e9,fixed},resolve=config=>curves.o(pack,config,'bd');
const preset=presets.recoil.create({pack,request,mode:'bd',resolve,kernel,curves,calculate});
const grouping=createChoiceGroups({pack,mode:'bd',shop:cat.shop,prices:cat.prices,kernel,curves,preset,fixed});assert(grouping.enabled);
const initial=compileMounts({pack,shop:cat.shop,prices:cat.prices,request},kernel),barrels=[null,...[...initial.players.values()].filter(p=>p.path==='2'&&typeof p.value==='string').map(p=>p.item)];
const rails=['4/17','4/19','4/20'],rows=[];let grouped=0n,raw=0n;const start=performance.now();
for(const barrel of barrels)for(const modular of [false,true])for(let mask=0;mask<8;mask++){
 const compiled=compileMounts({pack,shop:cat.shop,prices:cat.prices,request},kernel);compiled.model.constraints=compiled.model.constraints.filter(c=>!c.name.startsWith('attachment_budget_'));
 grouping.constrain(compiled);
 const restrictions=new Map();
 for(const p of compiled.players.values())if(typeof p.value==='string'){
  if(grouping.isTactical(p.path,p.item))restrictions.set(p.value,0);
  if(p.path==='11')restrictions.set(p.value,p.item===fixed[0].itemId?1:0);
  if(p.path==='2')restrictions.set(p.value,p.item===barrel?1:0);
  if(p.path==='1'&&p.item==='13030000191')restrictions.set(p.value,modular?1:0);
 }
 for(let i=0;i<rails.length;i++){
  const ordinary=[...compiled.players.values()].filter(p=>p.path===rails[i]&&typeof p.value==='string'&&!grouping.isTactical(p.path,p.item));
  if(mask&(1<<i))compiled.model.constrain(compiled.model.add(...ordinary.map(p=>p.value)),'==',1,'occupied_rail');
  else for(const p of ordinary)restrictions.set(p.value,0);
 }
 const search=createMountSearch(compiled),ordinary=search.count(restrictions).total;if(!ordinary)continue;
 const sample=search.enumerate(restrictions).next().value,build=resolve(sample);
 // Only barrel-derived handguard, modular-grip socket and ordinary occupied
 // rail set affect tactical availability on this weapon. All other providers
 // and occupancy dependencies are disjoint from tactical sockets.
 const tactical=[...grouping.tacticalConfigs(build,{budget:Infinity})].length;
 // Independent raw tactical count for the same ordinary domain, without any
 // equivalent-choice constraints, supplies a reconciliation to previous total.
 const rawModel=compileMounts({pack,shop:cat.shop,prices:cat.prices,request},kernel);rawModel.model.constraints=rawModel.model.constraints.filter(c=>!c.name.startsWith('attachment_budget_'));
 const chosen=new Set(sample.map(c=>c.slotPath+'|'+c.itemId)),fixedOrdinary=new Map();
 for(const [key,p]of rawModel.players)if(typeof p.value==='string'&&!grouping.isTactical(p.path,p.item))fixedOrdinary.set(p.value,chosen.has(key)?1:0);
 const rawTactical=createMountSearch(rawModel).count(fixedOrdinary).total;
 // Grouping ordinary sights changes multiplicity; reconcile using a separate
 // ordinary count with equivalence constraints removed.
 compiled.model.constraints=compiled.model.constraints.filter(c=>!c.name.startsWith('equivalent_choice_')&&!c.name.startsWith('excluded_accessory_'));
 const rawOrdinary=createMountSearch(compiled).count(restrictions).total;
 grouped+=ordinary*BigInt(tactical);raw+=rawOrdinary*rawTactical;
 rows.push({barrel,modular,occupied_rails:rails.filter((_,i)=>mask&(1<<i)),ordinary:String(ordinary),grouped_tactical:tactical,raw_ordinary:String(rawOrdinary),raw_tactical:String(rawTactical)});
 if(rows.length%16===0)console.log(JSON.stringify({contexts:rows.length,seconds:(performance.now()-start)/1000}));
}
assert.equal(raw,51292006859520n);
const out={weapon:pack.weaponId,mode:'bd',budget:null,fixed,grouped:String(grouped),raw:String(raw),reduction:Number(raw)/Number(grouped),contexts:rows,elapsed_ms:performance.now()-start,grouping_stats:grouping.getStats(),validation:'Weighted raw-domain reconciliation matches prior exact full-domain counter.'};
fs.writeFileSync('.scratch/m4-combination-count/grouped-accessories-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify({...out,contexts:rows.length}));
