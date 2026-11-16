import {majorStatGroups} from './part-comparisons.js?v=c6355afe3934f145';
const titles=Object.fromEntries(majorStatGroups.map(g=>[g.attribute,g.title]));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=3)=>Number.isFinite(v)?(Math.abs(v)<1e-12?0:v).toLocaleString(undefined,{maximumFractionDigits:d}):'—';
const signed=v=>(v>0?'+':'')+fmt(v);
const svg=(tag,attrs={},text='')=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);el.textContent=text;return el;};
export function createStatResponseView({load,getContext}){
 let dialog,serial=0,activeCurve=null;const cache=new Map();
 window.addEventListener('resize',()=>{if(dialog?.open&&activeCurve)requestAnimationFrame(()=>{if(dialog.open)draw(activeCurve,dialog.querySelector('#response-metric').value);});});
 function frame(context,attribute,body){
  dialog.innerHTML=`<div class="pane-heading"><div><h2>${titles[attribute]} response</h2><p class="curve-context">${esc(context.weapon_name)} / ${esc(context.mode.toUpperCase())}</p></div><button class="close-curve" aria-label="Close response curve">Close</button></div>${body}`;
  dialog.querySelector('.close-curve').onclick=()=>dialog.close();
 }
 return async function show(attribute){
  const context=structuredClone(getContext()),r={weapon_id:context.weapon_id,mode:context.mode,config:context.config,tunes:context.tunes,shot_count:2,response_stat:attribute},key=JSON.stringify(r);
  if(!dialog){dialog=document.createElement('dialog');dialog.id='stat-response-dialog';document.body.append(dialog);dialog.onclose=()=>serial++;}
  const ticket=++serial;activeCurve=null;frame(context,attribute,'<p class="helper curve-loading" role="status">Calculating this build’s response…</p>');if(!dialog.open)dialog.showModal();
  try{
   if(!cache.has(key)){cache.set(key,load(r).then(result=>result.response_curve).catch(error=>{cache.delete(key);throw error;}));if(cache.size>8)cache.delete(cache.keys().next().value);}
   const curve=await cache.get(key);if(ticket!==serial||!dialog.open)return;activeCurve=curve;
   frame(context,attribute,`<p class="curve-note curve-note-top">Attachments and calibration stay fixed along this curve; only the selected stat varies.</p><div class="curve-controls"><label>Performance metric <select id="response-metric">${curve.series.map(s=>`<option value="${esc(s.key)}">${esc(s.label)} (${esc(s.unit)})</option>`).join('')}</select></label><span>Current effective: <strong>${fmt(curve.current_main)}</strong><br>Displayed: ${fmt(curve.displayed_current)}</span></div><svg class="response-chart" role="img" data-current-main="${curve.current_main}" aria-label="${titles[attribute]} response for ${esc(context.weapon_name)}"></svg><div class="curve-investment"></div><p class="curve-marginal"></p>`);
   const select=dialog.querySelector('#response-metric');select.onchange=()=>draw(curve,select.value);draw(curve,curve.series[0].key);
  }catch(error){if(ticket===serial&&dialog.open)frame(context,attribute,`<p class="helper curve-loading" role="alert">${esc(error.message)}</p>`);}
 };
 function draw(curve,key){
  const metric=curve.series.find(s=>s.key===key),xs=curve.xs,ys=metric.values;
  const indexAt=x=>xs.reduce((best,v,i)=>Math.abs(v-x)<Math.abs(xs[best]-x)?i:best,0);
  const currentIndex=indexAt(curve.current_main),current=ys[currentIndex],next5=ys[indexAt(curve.current_main+5)],next10=ys[indexAt(curve.current_main+10)],previous=ys[indexAt(curve.current_main-5)],direction=metric.better==='lower'?-1:1;
  const chart=dialog.querySelector('.response-chart'),W=dialog.clientWidth<500?360:720,H=290,L=68,R=35,T=28,B=55;
  // Round outward to a uniform 1/2/5 interval, with no fractional tick drift.
  const niceStep=span=>{const raw=(span||1)/5,power=10**Math.floor(Math.log10(raw)),unit=raw/power;return (unit<=1?1:unit<=2?2:unit<=5?5:10)*power;};
  const xstep=niceStep(xs.at(-1)-xs[0]),xmin=Math.floor(xs[0]/xstep)*xstep,xmax=Math.ceil(xs.at(-1)/xstep)*xstep;
  const low=Math.min(...ys),high=Math.max(...ys),ystep=niceStep(high-low||Math.max(1,Math.abs(high))*.2);
  const ymin=Math.floor(low/ystep)*ystep,ymax=Math.max(ymin+ystep,Math.ceil(high/ystep)*ystep);
  const x=v=>L+(v-xmin)/(xmax-xmin)*(W-L-R),y=v=>T+(ymax-v)/(ymax-ymin)*(H-T-B);
  chart.setAttribute('viewBox',`0 0 ${W} ${H}`);chart.setAttribute('preserveAspectRatio','none');chart.replaceChildren();
  chart.append(svg('rect',{x:x(curve.current_main),y:T,width:Math.max(0,x(curve.current_main+5)-x(curve.current_main)),height:H-T-B,fill:'#b7ed7212'}));
  for(let value=ymin;value<=ymax+ystep/2;value+=ystep)chart.append(svg('line',{x1:L,x2:W-R,y1:y(value),y2:y(value),stroke:'#2a3840'}),svg('text',{x:L-7,y:y(value)+4,'text-anchor':'end',fill:'#91a0aa','font-size':12},fmt(value,4)));
  for(let value=xmin;value<=xmax+xstep/2;value+=xstep)chart.append(svg('line',{x1:x(value),x2:x(value),y1:T,y2:H-B,stroke:'#2a3840'}),svg('text',{x:x(value),y:H-B+18,'text-anchor':'middle',fill:'#91a0aa','font-size':12},fmt(value,1)));
  chart.append(svg('text',{x:L,y:12,fill:'#aab7bd','font-size':10},metric.label+' ('+metric.unit+')'),svg('text',{x:W/2,y:H-3,'text-anchor':'middle',fill:'#91a0aa','font-size':11},'Effective '+titles[curve.attribute_id]+' points'));
  chart.append(svg('path',{d:ys.map((v,i)=>`${i?'L':'M'}${x(xs[i])},${y(v)}`).join(' '),fill:'none',stroke:'#b7ed72','stroke-width':2.2}));
  chart.append(svg('line',{x1:x(curve.current_main),x2:x(curve.current_main),y1:T,y2:H-B,stroke:'#b7ed72','stroke-dasharray':'4 4','data-marker':'current'}),svg('circle',{cx:x(curve.current_main),cy:y(current),r:4,fill:'#b7ed72'}),svg('text',{x:Math.max(L+5,Math.min(W-R-70,x(curve.current_main)+7)),y:T+11,fill:'#cce9b0','font-size':10},'Current '+fmt(curve.current_main)));
  const cursor=svg('line',{x1:0,x2:0,y1:T,y2:H-B,stroke:'#d1dde2','stroke-dasharray':'2 3'}),dot=svg('circle',{cx:0,cy:0,r:3,fill:'#e7eff0'});chart.append(cursor,dot);
  const benefit=v=>current!==0?direction*(v-current)/Math.abs(current)*100:null;
  dialog.querySelector('.curve-investment').innerHTML=[['Current',current],['+5 points',next5],['+10 points',next10]].map(([label,value],i)=>`<div><span>${label}</span><strong>${fmt(value)} <small>${esc(metric.unit)}</small></strong>${i?`<p>${signed(value-current)} ${esc(metric.unit)}${benefit(value)!==null?' / '+fmt(benefit(value),2)+'% benefit':''}</p>`:`<p>${metric.better==='lower'?'Lower':'Higher'} is better</p>`}</div>`).join('');
  const previousGain=direction*(current-previous),nextGain=direction*(next5-current);let marginal;
  if(Math.abs(nextGain)<1e-9)marginal='Next +5 points: no further modeled benefit for this metric.';
  else if(nextGain<0)marginal='Next +5 points worsens this metric in the model.';
  else if(previousGain>1e-9)marginal=`Next +5 delivers ${fmt(nextGain/previousGain*100,1)}% of the previous +5’s gain.`;
  else if(Math.abs(previousGain)<1e-9)marginal=`Previous +5 was flat; next +5 improves this metric by ${fmt(nextGain)} ${metric.unit}.`;
  else marginal=`Next +5 improves this metric by ${fmt(nextGain)} ${metric.unit}.`;
  dialog.querySelector('.curve-marginal').textContent=marginal;
  const axisX=svg('text',{y:H-B+33,'text-anchor':'middle',fill:'#e7eff0','font-size':12}),axisY=svg('text',{x:L+5,fill:'#e7eff0','font-size':12});chart.append(axisX,axisY);
  function inspect(index){index=Math.max(0,Math.min(xs.length-1,index));cursor.setAttribute('x1',x(xs[index]));cursor.setAttribute('x2',x(xs[index]));dot.setAttribute('cx',x(xs[index]));dot.setAttribute('cy',y(ys[index]));axisX.setAttribute('x',Math.max(L+30,Math.min(W-R-30,x(xs[index]))));axisX.textContent=fmt(xs[index])+' pts';axisY.setAttribute('y',Math.max(T+14,Math.min(H-B-7,y(ys[index])-8)));axisY.textContent=fmt(ys[index])+' '+metric.unit;chart.setAttribute('aria-label',axisX.textContent+', '+axisY.textContent);chart.dataset.inspectedIndex=index;}
  chart.tabIndex=0;chart.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();inspect(event.key==='Home'?0:event.key==='End'?xs.length-1:Number(chart.dataset.inspectedIndex)+(event.key==='ArrowRight'?1:-1));}};
  chart.onpointermove=event=>{const rect=chart.getBoundingClientRect(),position=(event.clientX-rect.left)/rect.width*W;inspect(indexAt(xmin+(position-L)/(W-L-R)*(xmax-xmin)));};inspect(currentIndex);
 }
}
