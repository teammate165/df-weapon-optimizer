import {shortfall} from './optimizer_policy.mjs?v=67f0054380987872';

export const gateFraction=.005;
export const gateDenominator=200n;
export const rankingContract='exact-shortfall-objectives-cost-code-unit-signature-v1';
export function survivorCount(count){
 if(typeof count==='number'&&!Number.isSafeInteger(count))throw Error('Screening count must be an exact integer.');
 const n=BigInt(count);if(n<0n)throw Error('Screening count must be nonnegative.');
 return (n+gateDenominator-1n)/gateDenominator;
}

// Strict, transitive order for exhaustive selection across any traversal or
// partition order. Never use pairwise epsilon equality to build a rank heap.
export function screeningComparator(minimums={}){
 const finite=value=>{if(!Number.isFinite(value))throw Error('Nonfinite screening rank value.');return value;};
 return (a,b)=>{
  const violation=finite(shortfall(a.stats,minimums))-finite(shortfall(b.stats,minimums));
  if(violation)return Math.sign(violation);
  const av=a.objectives??[a.score],bv=b.objectives??[b.score];
  if(av.length!==bv.length)throw Error('Inconsistent screening objective dimensions.');
  for(let i=0;i<av.length;i++){const x=finite(av[i]),y=finite(bv[i]);if(x!==y)return x<y?-1:1;}
  const ac=finite(a.cost??0),bc=finite(b.cost??0);if(ac!==bc)return ac<bc?-1:1;
  if(typeof a.signature!=='string'||typeof b.signature!=='string')throw Error('Missing canonical screening identity.');
  return a.signature<b.signature?-1:a.signature>b.signature?1:0;
 };
}
