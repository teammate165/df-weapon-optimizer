// Presets own objective semantics; the search owns mounting, tuning and costs.
import {presets} from './optimizer_presets.mjs?v=c734d8eb6933df72';
export const statIds = {control:'3', handling:'5', stability:'6', accuracy:'4'};
export function policy(request) {
  const preset=request.preset??'recoil';
  if(!Object.hasOwn(presets,preset))throw Error('Unknown optimizer preset');
  const minimums=request.minimum_stats??{};
  if(!minimums || Array.isArray(minimums) || typeof minimums!=='object' || Object.entries(minimums).some(([k,v])=>!Object.hasOwn(statIds,k)||!Number.isFinite(v)||v<0))throw Error('minimum_stats accepts nonnegative control, handling, stability and accuracy only');
  const automatic=request.effectiveness_targets===undefined;
  const targets=request.effectiveness_targets??[50,60,70,80,90];
  if(!Array.isArray(targets)||targets.length>8||targets.some(v=>!Number.isFinite(v)||v<=0||v>100))throw Error('effectiveness_targets must contain up to eight percentages in (0,100]');
  return {preset,minimums,automatic,targets:[...new Set(targets)].sort((a,b)=>a-b)};
}
export const shortfall=(stats,minimums)=>Object.entries(minimums).reduce((sum,[key,min])=>sum+Math.max(0,min-stats[key]),0);
// Floating-point equality only: no gameplay trade-off tolerance.
export function compareObjectives(a,b) {
  const av=a.objectives??[a.score],bv=b.objectives??[b.score];
  for(let i=0;i<av.length;i++){
    const delta=av[i]-bv[i];
    if(Math.abs(delta)>1e-12*Math.max(1,Math.abs(av[i]),Math.abs(bv[i])))return Math.sign(delta);
  }
  return 0;
}
export function comparator(minimums, targetScore=null) {
  const violation=c=>shortfall(c.stats,minimums)+(targetScore===null?0:Math.max(0,c.score-targetScore));
  return (a,b)=>{
    const av=violation(a),bv=violation(b);
    if(Math.abs(av-bv)>1e-8)return av<bv;
    if(targetScore!==null && av<1e-8 && a.cost!==b.cost)return a.cost<b.cost;
    const order=compareObjectives(a,b);
    return order<0 || (order===0 && (a.cost??0)<(b.cost??0));
  };
}
