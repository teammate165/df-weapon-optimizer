// One global K is supplied to every disjoint worker/shard. A class contributes
// its reconstructed paths, never one synthetic vote for its representative.
export function createRankingHeap(capacity,compare){
 if(!Number.isSafeInteger(capacity)||capacity<0)throw Error('Invalid exact ranking capacity');
 const heap=[];
 const swap=(a,b)=>{[heap[a],heap[b]]=[heap[b],heap[a]];};
 function offer(row){
  if(!capacity)return false;
  if(heap.length<capacity){heap.push(row);let i=heap.length-1;while(i){const p=(i-1)>>1;if(compare(heap[p],heap[i])>=0)break;swap(p,i);i=p;}return true;}
  if(compare(row,heap[0])>=0)return false;
  heap[0]=row;let i=0;for(;;){const l=2*i+1,r=l+1;let worst=i;if(l<heap.length&&compare(heap[l],heap[worst])>0)worst=l;if(r<heap.length&&compare(heap[r],heap[worst])>0)worst=r;if(worst===i)break;swap(i,worst);i=worst;}return true;
 }
 return {offer,rows:()=>[...heap].sort(compare),get size(){return heap.length;},get cutoff(){return heap.length===capacity?heap[0]:null;}};
}
