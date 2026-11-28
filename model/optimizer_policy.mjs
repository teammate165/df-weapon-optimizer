// Presets own objective semantics; the search owns mounting, tuning and costs.
import {detailedStats} from '../detailed-stats.mjs?v=2ef137a83bb81d8a';
import {presets} from './optimizer_presets.mjs?v=2ef137a83bb81d8a';
export const statIds = {control:'3', handling:'5', stability:'6', accuracy:'4'};
export function policy(request) {
  const preset=request.preset??'recoil';
  if(!Object.hasOwn(presets,preset))throw Error('Unknown optimizer preset');
  const minimums=request.minimum_stats??{};
  if(!minimums || Array.isArray(minimums) || typeof minimums!=='object' || Object.entries(minimums).some(([k,v])=>!Object.hasOwn(statIds,k)||!Number.isFinite(v)||v<0))throw Error('minimum_stats accepts nonnegative control, handling, stability and accuracy only');
  const detailedLimits=request.stat_limits===undefined?{}:request.stat_limits;
  if(!detailedLimits || typeof detailedLimits!=='object' || Array.isArray(detailedLimits) ||
    Object.entries(detailedLimits).some(([id,value])=>!Object.hasOwn(detailedStats,id)||!Number.isFinite(value)||value<0)){
    throw Error('stat_limits requires known detailed stats and finite nonnegative values');
  }
  if(Object.keys(detailedLimits).length && request.search_method!==undefined && !['anytime','coordinate_passes'].includes(request.search_method)){
    throw Error('Detailed stat limits require Anytime or Coordinate passes');
  }
  const automatic=request.effectiveness_targets===undefined;
  const targets=request.effectiveness_targets??[50,60,70,80,90];
  if(!Array.isArray(targets)||targets.length>8||targets.some(v=>!Number.isFinite(v)||v<=0||v>100))throw Error('effectiveness_targets must contain up to eight percentages in (0,100]');
  const patternReduction=request.pattern_reduction_percent;
  if(patternReduction!==undefined&&(preset!=='recoil'||!Number.isFinite(patternReduction)||patternReduction<=0||patternReduction>=100))throw Error('pattern_reduction_percent requires Lowest Recoil and a percentage between 0 and 100');
  return {preset,minimums,detailedLimits,patternReduction,automatic,targets:[...new Set(targets)].sort((a,b)=>a-b)};
}
export const shortfall=(stats,minimums)=>Object.entries(minimums).reduce((sum,[key,min])=>sum+Math.max(0,min-stats[key]),0);
export function createPatternConstraint(preset, resolve, request, reductionPercent) {
  if (reductionPercent === undefined) return null;
  const raw = preset.raw(resolve(request.config ?? []), request.tunes ?? {});
  const reference = raw.pattern;
  return {reference, maximum: reference * (1 - reductionPercent / 100),
    reduction_percent: reductionPercent, pattern_model: raw.pattern_model};
}
// Floating-point equality only: no gameplay trade-off tolerance.
export function compareObjectives(a,b) {
  const av=a.objectives??[a.score],bv=b.objectives??[b.score];
  for(let i=0;i<av.length;i++){
    const delta=av[i]-bv[i];
    if(Math.abs(delta)>1e-12*Math.max(1,Math.abs(av[i]),Math.abs(bv[i])))return Math.sign(delta);
  }
  return 0;
}
export function comparator(minimums, targetScore=null, patternCap=null) {
  const violation=c=>shortfall(c.stats,minimums)+(targetScore===null?0:Math.max(0,c.score-targetScore));
  return (a,b)=>{
    if(patternCap!==null){
      const ap=Math.max(0,a.components.pattern-patternCap),bp=Math.max(0,b.components.pattern-patternCap);
      if(ap!==bp)return ap<bp;
    }
    const ad=a.detailedViolation??0,bd=b.detailedViolation??0;
    if(ad!==bd)return ad<bd;
    const av=violation(a),bv=violation(b);
    if(Math.abs(av-bv)>1e-8)return av<bv;
    if(targetScore!==null && av<1e-8 && a.cost!==b.cost)return a.cost<b.cost;
    const order=compareObjectives(a,b);
    return order<0 || (order===0 && (a.cost??0)<(b.cost??0));
  };
}
