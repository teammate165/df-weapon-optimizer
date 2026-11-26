export function retainsFixedSlots(build,fixed){
  return fixed.every(({slotPath,itemId,keepDefault})=>{
    const part=build.mounted.find(m=>m.slotPath===slotPath);
    if(!keepDefault)return part?.itemId===itemId;
    return itemId
      ?part?.itemId===itemId&&part.source!=='equipped'
      :!part&&build.slots.some(slot=>slot.slotPath===slotPath);
  });
}

export function fixedSlotSeed(resolve,fixed,equippedConfig=[]){
  const minimal=resolve(fixed.filter(row=>!row.keepDefault));
  return retainsFixedSlots(minimal,fixed)?minimal:resolve(equippedConfig);
}

// Source IDs for the three sight risers. A scope-category label alone cannot
// distinguish a riser from an actual optic in this catalog.
export const riserIds=new Set(['13210000012','13210000013','13210000014']);
export const isOptic=(pack,id)=>pack.display.objects[id]?.categoryId==='scope'&&!riserIds.has(id);
export function emptyRisers(pack,build) {
  return build.mounted.filter(m=>riserIds.has(m.itemId)&&!build.mounted.some(child=>
    child.slotPath.startsWith(m.slotPath+'/')&&isOptic(pack,child.itemId)));
}
// Explore each compatible sight as an atomic purchase with its riser. Never
// admit an empty mount into the objective/frontier, including locked mounts.
export function* completeRiserOptics(pack,build,resolve,fixed=[],depth=0,choices=ids=>ids) {
  const missing=emptyRisers(pack,build).sort((a,b)=>b.slotPath.length-a.slotPath.length);
  if(!missing.length){yield build;return;}
  if(depth>=build.mounted.length)return;
  const riser=missing[0];
  for(const slot of build.slots.filter(s=>s.slotPath.startsWith(riser.slotPath+'/'))) {
    if(fixed.some(f=>f.slotPath===slot.slotPath))continue;
    for(const itemId of choices(slot.options,slot.slotPath).filter(id=>isOptic(pack,id))) {
      const config=build.config.filter(c=>c.slotPath!==slot.slotPath&&!c.slotPath.startsWith(slot.slotPath+'/'));
      const next=resolve([...config,{slotPath:slot.slotPath,itemId}]);
      if(!next.mounted.some(m=>m.slotPath===slot.slotPath&&m.itemId===itemId))continue;
      yield* completeRiserOptics(pack,next,resolve,fixed,depth+1,choices);
    }
  }
}
