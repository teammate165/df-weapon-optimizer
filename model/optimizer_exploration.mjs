// Additional heuristic search over the same source-model candidates. The caller
// owns legality, floors, pricing, objective comparisons and frontier collection.
// Proposal hints never replace evaluating a build with the actual preset.
export function exploreAttachments({seed,pack,curves,resolve,evaluate,complete,fixed,
  hidden,better,priorities=[],passes,diagnostics}) {
  if(!seed)return seed;
  let best=seed;
  const cache=new Map(),controlCache=new Map();
  let randomState=20261116;
  const random=()=>((randomState=(Math.imul(1664525,randomState)+1013904223)>>>0)/4294967296);
  const locked=path=>fixed.some(f=>f.slotPath===path||f.slotPath.startsWith(path+'/'));
  const remember=candidate=>{if(candidate&&better(candidate,best))best=candidate;};
  const controls=build=>build.mounted.flatMap(m=>(pack.parts[m.itemId]?.tuneIds??[]).flatMap(id=>{
    const c=curves.c(pack,m,id);if(!c||c.enabled===false)return [];
    const key=JSON.stringify([m.itemId,m.socketId,m.hostItemId,id]);
    if(!controlCache.has(key)){
      const positions=curves.n(c);
      const vectors=positions.map(value=>{const vec={};for(const f of c.functions??[]){const v=curves.r(pack.curves?.[f.curveId],value);if(Number.isFinite(v))vec[f.target]=(vec[f.target]??0)+v;}return {value,vec};});
      let keep=vectors;
      for(const group of priorities){
        const targets=group.filter(t=>keep.some(v=>v.vec[t]!==undefined));
        const minima=Object.fromEntries(targets.map(t=>[t,Math.min(...keep.map(v=>v.vec[t]??0))]));
        const next=keep.filter(v=>targets.every(t=>(v.vec[t]??0)===minima[t]));
        if(next.length)keep=next;
      }
      const proposal=(keep.find(v=>v.value===c.range.defaultValue)??keep[0])?.value;
      controlCache.set(key,{id,positions,proposal,defaultValue:c.range.defaultValue});
    }
    return [{path:m.slotPath,...controlCache.get(key)}];
  }));
  const score=(config,tunes)=>{diagnostics.evaluations++;return evaluate(config,tunes);};
  const propose=build=>{
    const key=JSON.stringify(build.config);
    if(cache.has(key))return cache.get(key);
    // The shared evaluator applies every constraint before doing expensive work.
    let candidate=score(build.config,{});
    if(!candidate)return null;
    const cs=controls(candidate.build),tunes={};
    for(const c of cs)if(c.proposal!==undefined&&c.proposal!==c.defaultValue)(tunes[c.path]??={})[c.id]=c.proposal;
    const hinted=score(build.config,tunes);
    if(hinted&&better(hinted,candidate))candidate=hinted;
    // Unrecognized future presets still get legal joint endpoint proposals.
    // Intermediate positions remain covered by coordinate refinement below.
    if(!priorities.length)for(const end of [0,-1]){
      const joint={};for(const c of cs)(joint[c.path]??={})[c.id]=c.positions.at(end);
      const row=score(build.config,joint);if(row&&better(row,candidate))candidate=row;
    }
    cache.set(key,candidate);if(cache.size>2048)cache.delete(cache.keys().next().value);
    diagnostics.configurations++;return candidate;
  };
  function* neighbors(build){
    for(const slot of build.slots){
      if(locked(slot.slotPath))continue;
      for(const itemId of [null,...slot.options]){
        if(hidden.has(itemId))continue;
        const config=build.config.filter(c=>c.slotPath!==slot.slotPath&&!c.slotPath.startsWith(slot.slotPath+'/'));
        if(itemId)config.push({slotPath:slot.slotPath,itemId});
        const changed=resolve(config);
        if(itemId&&!changed.config.some(c=>c.slotPath===slot.slotPath&&c.itemId===itemId))continue;
        for(const b of complete(changed))yield b;
      }
    }
  }
  const descend=seed=>{
    let current=seed;
    for(let pass=0;pass<passes;pass++){
      let next=current;
      for(const build of neighbors(current.build)){
        const candidate=propose(build);if(candidate&&better(candidate,next))next=candidate;
      }
      diagnostics.passes++;remember(next);
      if(!better(next,current))break;
      current=next;
    }
    return current;
  };
  const refine=candidate=>{
    let current=candidate;
    // Full legal positions, checked by the preset, including interior optima.
    // The whole incumbent is retained when a hint or coordinate move is worse.
    for(const c of controls(current.build))for(const value of c.positions){
      const tunes=structuredClone(current.tunes);(tunes[c.path]??={})[c.id]=value;
      const row=score(current.config,tunes);if(row&&better(row,current))current=row;
    }
    remember(current);return current;
  };
  remember(propose(seed.build));
  descend(best);
  for(const build of complete(resolve(fixed))){const candidate=propose(build);if(candidate)descend(candidate);}
  // Changing a structural part can expose a different attachment tree whose
  // first move is worse. Give those parent choices their own descent.
  const structural=[];
  for(const b of neighbors(best.build)){
    const changed=b.config.filter(c=>!best.config.some(x=>x.slotPath===c.slotPath&&x.itemId===c.itemId));
    if(changed.some(c=>(pack.assembly.socketProviders[c.itemId]?.sockets?.length??0)>0)){
      const candidate=propose(b);if(candidate)structural.push(candidate);
    }
  }
  structural.sort((a,b)=>better(a,b)?-1:better(b,a)?1:0);
  for(const candidate of structural.slice(0,Math.max(2,Math.floor(passes/2)))){descend(candidate);diagnostics.structural_starts++;}
  for(let restart=0;restart<passes*2;restart++){
    let build=best.build;
    for(let change=0;change<2+restart%4;change++){
      const slots=build.slots.filter(s=>!locked(s.slotPath));if(!slots.length)break;
      const slot=slots[Math.floor(random()*slots.length)],options=[null,...slot.options.filter(id=>!hidden.has(id))];
      const itemId=options[Math.floor(random()*options.length)];
      const config=build.config.filter(c=>c.slotPath!==slot.slotPath&&!c.slotPath.startsWith(slot.slotPath+'/'));
      if(itemId)config.push({slotPath:slot.slotPath,itemId});
      // Validate cost, locks, hidden parts and enabled-device policy through the
      // shared evaluator. Complete required sights before checking the budget.
      for(const completed of complete(resolve(config))){if(score(completed.config,{})){build=completed;break;}}
    }
    const candidate=propose(build);if(candidate)descend(candidate);
    diagnostics.restarts++;
  }
  refine(best);
  return best;
}
