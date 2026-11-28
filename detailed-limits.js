import {detailedStats,detailedValue} from './detailed-stats.mjs?v=8e593db3b6670458';

export function createDetailedLimits(root,onChange){
  const add=root.querySelector('#add-limit');
  const picker=root.querySelector('#stat-picker');
  const menu=root.querySelector('#picker');
  const rows=root.querySelector('#limit-rows');
  const fields=new Map();
  let current;

  function closePicker(){
    menu.hidden=true;
    add.setAttribute('aria-expanded','false');
  }

  function refreshPicker(){
    picker.replaceChildren(new Option('Select a stat...', ''));
    for(const [id,stat] of Object.entries(detailedStats)){
      if(!fields.has(id))picker.add(new Option(stat.label,id));
    }
    add.disabled=picker.options.length===1;
  }

  function update(stats){
    current=stats;
    for(const [id,{label,reference}] of fields){
      const value=detailedValue(current,id);
      const text=Number.isFinite(value)?'Current build '+formatDetailed(id,value):'Current build value unavailable';
      label.title=text;
      reference.textContent=text;
    }
  }

  function addRow(id){
    const {label:name,unit,direction}=detailedStats[id];
    const row=document.createElement('div');
    row.className='limit-row';
    row.innerHTML=`<label for="limit-${id}">${name}<span class="current" id="current-${id}"></span></label>
      <div class="requirement"><span aria-hidden="true" title="${direction==='max'?'At most':'At least'}">${direction==='max'?'&le;':'&ge;'}</span>
      <input id="limit-${id}" type="number" min="0" step="any" required aria-describedby="current-${id}" aria-label="${name}, ${direction==='max'?'maximum':'minimum'}, ${unit}">
      <span>${unit}</span></div>
      <button type="button" class="remove" aria-label="Remove ${name}" title="Remove ${name}">&times;</button>`;
    const field=row.querySelector('input');
    const value=detailedValue(current,id);
    if(Number.isFinite(value))field.value=value;
    fields.set(id,{field,label:row.querySelector('label'),reference:row.querySelector('.current')});
    row.querySelector('.remove').onclick=()=>{
      fields.delete(id);
      row.remove();
      refreshPicker();
      add.focus();
      onChange();
    };
    field.oninput=onChange;
    rows.append(row);
    update(current);
    closePicker();
    refreshPicker();
    field.focus();
    field.select();
    onChange();
  }

  add.onclick=()=>{
    if(!menu.hidden){closePicker();return;}
    menu.hidden=false;
    add.setAttribute('aria-expanded','true');
    picker.focus();
  };
  picker.onchange=()=>{if(picker.value)addRow(picker.value);};
  picker.onkeydown=event=>{if(event.key==='Escape'){closePicker();add.focus();}};
  refreshPicker();
  return {
    update,
    active:()=>fields.size>0,
    valid:()=>[...fields.values()].every(({field})=>field.validity.valid),
    values:()=>Object.fromEntries([...fields].map(([id,{field}])=>[id,field.valueAsNumber])),
    refreshPicker,
  };
}

export function formatDetailed(id,value){
  const unit=detailedStats[id].unit;
  const number=value.toLocaleString(undefined,{maximumFractionDigits:4});
  return unit==='×'||unit==='°'?number+unit:number+' '+unit;
}
