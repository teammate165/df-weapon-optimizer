export const cheapestGate=50;

// Selection is exact over the supplied candidates, not a global-search proof.
export function selectCategories(frontier) {
  if(!frontier.length)return null;
  const strongest=frontier.reduce((a,b)=>compareObjectives(b,a)<0||(compareObjectives(b,a)===0&&b.cost<a.cost)?b:a);
  if(strongest.score>=100-1e-8)return {strongest,cheapest:null,value:null};
  const limit=100-(100-strongest.score)*cheapestGate/100;
  const eligible=frontier.filter(c=>c.score<=limit+1e-8);
  const same=(a,b)=>a.signature!==undefined&&b.signature!==undefined?a.signature===b.signature:a===b;
  const cheaper=eligible.filter(c=>c.cost<strongest.cost-1e-9&&!same(c,strongest));
  if(!cheaper.length)return {strongest,cheapest:null,value:null};
  const cheapest=cheaper.reduce((a,b)=>b.cost<a.cost||(b.cost===a.cost&&compareObjectives(b,a)<0)?b:a);
  const costSpan=strongest.cost-cheapest.cost,scoreSpan=cheapest.score-strongest.score;
  if(costSpan<=1e-9||scoreSpan<=1e-9)return {strongest,cheapest,value:null};
  const interior=eligible.filter(c=>c.cost>cheapest.cost+1e-9&&c.cost<strongest.cost-1e-9&&!same(c,strongest)&&!same(c,cheapest));
  if(!interior.length)return {strongest,cheapest,value:null};
  // Maximum normalized performance gain minus normalized additional cost:
  // distance toward the ideal corner from the endpoint chord (the knee).
  // If the curve is straight, prefer the point closest to the ideal corner.
  const position=c=>{
    const x=(c.cost-cheapest.cost)/costSpan,y=(cheapest.score-c.score)/scoreSpan;
    return {knee:y-x,ideal:x*x+(1-y)*(1-y)};
  };
  const value=interior.reduce((a,b)=>{
    const pa=position(a),pb=position(b);
    if(Math.abs(pb.knee-pa.knee)>1e-9)return pb.knee>pa.knee?b:a;
    if(Math.abs(pb.ideal-pa.ideal)>1e-9)return pb.ideal<pa.ideal?b:a;
    return b.cost<a.cost?b:a;
  });
  return {strongest,cheapest,value};
}
import {compareObjectives} from './optimizer_policy.mjs?v=d9e647a2a2b1ee40';
