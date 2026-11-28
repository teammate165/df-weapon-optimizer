export const defaultRecoilWeights=Object.freeze({pattern:0.4,camera:0.2,kick:0.4});
export const defaultAgilityWeights=Object.freeze({handling:0.5,accuracy:0.3,recoil:0.2});

// Allocate whole slider points while preserving the requested total.
export function distributeWeightPoints(weights,total) {
  const sum=weights.reduce((a,b)=>a+b,0);
  const shares=weights.map(weight=>total*(sum?weight/sum:1/weights.length));
  const points=shares.map(Math.floor);
  const remainder=total-points.reduce((a,b)=>a+b,0);
  const order=points.map((_,i)=>i).sort((a,b)=>(shares[b]-points[b])-(shares[a]-points[a]));
  for(const i of order.slice(0,remainder))points[i]++;
  return points;
}

export function validateWeights(weights,defaults) {
  if(!weights||typeof weights!=='object'||Array.isArray(weights)||
    Object.keys(weights).length!==Object.keys(defaults).length||
    Object.keys(defaults).some(key=>!Object.hasOwn(weights,key)||!Number.isFinite(weights[key])||weights[key]<0))
    throw Error('Invalid weights');
  const total=Object.values(weights).reduce((sum,value)=>sum+value,0);
  if(!Number.isFinite(total)||total<=0)throw Error('Weights must have a finite, positive total');
  return total;
}
