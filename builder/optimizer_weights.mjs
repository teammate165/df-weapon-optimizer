export const defaultRecoilWeights=Object.freeze({pattern:0.4,camera:0.3,kick:0.3});
export const defaultAgilityWeights=Object.freeze({handling:0.5,accuracy:0.3,recoil:0.2});

export function validateWeights(weights,defaults) {
  if(!weights||typeof weights!=='object'||Array.isArray(weights)||
    Object.keys(weights).length!==Object.keys(defaults).length||
    Object.keys(defaults).some(key=>!Object.hasOwn(weights,key)||!Number.isFinite(weights[key])||weights[key]<0))
    throw Error('Invalid weights');
  const total=Object.values(weights).reduce((sum,value)=>sum+value,0);
  if(!Number.isFinite(total)||total<=0)throw Error('Weights must have a finite, positive total');
  return total;
}
