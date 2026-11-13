export const cheapestGate=50;

// Selection is exact over the supplied candidates, not a global-search proof.
export function selectCategories(frontier) {
  if(!frontier.length)return null;
  const strongest=frontier.reduce((a,b)=>b.score<a.score-1e-9||(Math.abs(b.score-a.score)<1e-9&&b.cost<a.cost)?b:a);
  if(strongest.score>=100-1e-8)return {strongest,cheapest:null,value:null};
  const limit=100-(100-strongest.score)*cheapestGate/100;
  const eligible=frontier.filter(c=>c.score<=limit+1e-8);
  const cheapest=eligible.reduce((a,b)=>b.cost<a.cost||(b.cost===a.cost&&b.score<a.score)?b:a);
  const costSpan=strongest.cost-cheapest.cost,scoreSpan=cheapest.score-strongest.score;
  if(costSpan<=1e-9||scoreSpan<=1e-9)return {strongest,cheapest,value:cheapest};
  // Maximum normalized performance gain minus normalized additional cost:
  // distance toward the ideal corner from the endpoint chord (the knee).
  // If the curve is straight, prefer the point closest to the ideal corner.
  const position=c=>{
    const x=(c.cost-cheapest.cost)/costSpan,y=(cheapest.score-c.score)/scoreSpan;
    return {knee:y-x,ideal:x*x+(1-y)*(1-y)};
  };
  const value=eligible.reduce((a,b)=>{
    const pa=position(a),pb=position(b);
    if(Math.abs(pb.knee-pa.knee)>1e-9)return pb.knee>pa.knee?b:a;
    if(Math.abs(pb.ideal-pa.ideal)>1e-9)return pb.ideal<pa.ideal?b:a;
    return b.cost<a.cost?b:a;
  });
  return {strongest,cheapest,value};
}
