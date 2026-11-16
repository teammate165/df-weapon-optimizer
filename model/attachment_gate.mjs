// Shared heuristic attachment screening. A discarded combination can still be
// optimal after calibration. Production ranking is comparator-driven; the
// sampled/diversity selector below is retained for offline experiments.
import {compareObjectives,shortfall} from './optimizer_policy.mjs?v=6be8e9ba4f046b71';

export const attachmentGateFraction=.05;

// Production gate: rank complete default-tuned replacement configurations with
// the caller's comparator, including preset objectives, floors and price targets.
// Shared by every preset; the incumbent is retained separately by the engine.
export function retainTopAttachmentCandidates(candidates,better) {
  const unique=new Map();
  for(const candidate of candidates)if(!unique.has(candidate.signature))unique.set(candidate.signature,candidate);
  const ranked=[...unique.values()].sort((a,b)=>better(a,b)?-1:better(b,a)?1:a.signature.localeCompare(b.signature));
  const retained=ranked.slice(0,Math.ceil(ranked.length*attachmentGateFraction));
  return {retained,screened:ranked.length};
}

export function sampleOrder(a,b,minimums={}) {
  const violation=shortfall(a.stats,minimums)-shortfall(b.stats,minimums);
  if(Math.abs(violation)>1e-8)return Math.sign(violation);
  return compareObjectives(a,b)||a.cost-b.cost||a.id.localeCompare(b.id);
}

export function selectAttachmentGate(combinations,request,settings) {
  const {fraction=.1,thresholdPoints=null,diversity=false,costBucket=40}=settings;
  if(!Number.isFinite(fraction)||fraction<=0||fraction>1)throw Error('fraction must be in (0,1]');
  if(thresholdPoints!==null&&(!Number.isFinite(thresholdPoints)||thresholdPoints<0))throw Error('thresholdPoints must be nonnegative');
  if(!(costBucket>0)||!Number.isFinite(costBucket))throw Error('Invalid cost bucket');
  const minimums=request.minimums??{};
  const eligible=combinations.filter(c=>c.cost<=request.budget&&(request.locks??[]).every(lock=>c.config.some(s=>s.slotPath===lock.slotPath&&s.itemId===lock.itemId)));
  const scored=eligible.map(combo=>{
    if(!combo.samples?.length)throw Error('Every combination needs screening samples');
    return {...combo,representative:[...combo.samples].sort((a,b)=>sampleOrder(a,b,minimums))[0]};
  }).sort((a,b)=>sampleOrder(a.representative,b.representative,minimums));
  const selected=new Set(scored.slice(0,Math.ceil(scored.length*fraction)).map(c=>c.id));
  if(thresholdPoints!==null&&scored.length){
    const best=scored[0].representative,bestViolation=shortfall(best.stats,minimums);
    for(const combo of scored){
      const sample=combo.representative;
      if(shortfall(sample.stats,minimums)<=bestViolation+1e-8&&sample.objectives[0]<=best.objectives[0]+thresholdPoints)selected.add(combo.id);
    }
  }
  if(diversity){
    // Retain a good candidate in each price band, including cheap alternatives.
    const buckets=new Set();
    for(const combo of scored){const bucket=Math.floor(combo.cost/costBucket);if(!buckets.has(bucket)){buckets.add(bucket);selected.add(combo.id);}}
    // Floors are NOT checked against untuned builds to exclude combinations.
    // Preserve sampled stat extremes and the fastest sampled Handling candidate.
    for(const key of Object.keys(minimums)){
      const champion=[...scored].sort((a,b)=>b.representative.stats[key]-a.representative.stats[key]||sampleOrder(a.representative,b.representative,minimums))[0];
      if(champion)selected.add(champion.id);
    }
    const handling=[...scored].sort((a,b)=>a.representative.objectives[1]-b.representative.objectives[1]||sampleOrder(a.representative,b.representative,minimums))[0];
    if(handling)selected.add(handling.id);
  }
  return {selectedIds:[...selected],eligible:scored.length,retained:selected.size,status:'heuristic',proof:false};
}
