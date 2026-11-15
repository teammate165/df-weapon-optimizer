import assert from 'node:assert/strict';
import {selectAttachmentGate,retainTopAttachmentCandidates,attachmentGateFraction} from '../tools/attachment_gate.mjs';
const combo=(id,loss,cost=40,handling=50)=>({id,cost,config:[{slotPath:'1',itemId:id}],samples:[{id,cost,objectives:[loss,100],stats:{control:50,handling,accuracy:50,stability:50}}]});
const rows=[combo('a',10),combo('b',12),combo('c',20,0)];
assert.deepEqual(selectAttachmentGate(rows,{budget:40},{fraction:.1}).selectedIds,['a']);
assert.deepEqual(selectAttachmentGate(rows,{budget:40},{fraction:.1,thresholdPoints:2}).selectedIds,['a','b']);
assert(selectAttachmentGate(rows,{budget:40},{fraction:.1,diversity:true}).selectedIds.includes('c'));
assert.deepEqual(selectAttachmentGate(rows,{budget:40,locks:[{slotPath:'1',itemId:'b'}]},{fraction:.1}).selectedIds,['b']);
// Do not reject all combinations just because screening misses a stat floor.
assert.equal(selectAttachmentGate([combo('a',10,40,49)],{budget:40,minimums:{handling:50}},{fraction:.1}).retained,1);
assert.equal(selectAttachmentGate(rows,{budget:0},{fraction:1}).retained,1);
assert.throws(()=>selectAttachmentGate(rows,{budget:40},{fraction:0}));
assert.throws(()=>selectAttachmentGate(rows,{budget:40},{thresholdPoints:-1}));
// Explicit ranking reversal: b calibrates from 12 to 1, while a remains 10.
const gate=selectAttachmentGate(rows.slice(0,2),{budget:40},{fraction:.1});
assert(!gate.selectedIds.includes('b'));
assert.equal(gate.proof,false);
assert.equal(attachmentGateFraction,.05);
const many=Array.from({length:41},(_,i)=>({signature:String(i).padStart(3,'0'),loss:41-i,cost:i}));
const lowerLoss=(a,b)=>a.loss<b.loss;
const retained=retainTopAttachmentCandidates([...many,many[0]],lowerLoss);
assert.equal(retained.screened,41);
assert.equal(retained.retained.length,3);
assert.deepEqual(retained.retained.map(c=>c.loss),[1,2,3]);
assert.deepEqual(retainTopAttachmentCandidates([],lowerLoss).retained,[]);
assert.equal(retainTopAttachmentCandidates(many.slice(0,1),lowerLoss).retained.length,1);
// Gate honors caller ordering, including price-priority searches and future
// objective vectors. It does not hardcode the recoil scoring formula.
assert.deepEqual(retainTopAttachmentCandidates(many,(a,b)=>a.cost<b.cost).retained.map(c=>c.cost),[0,1,2]);
console.log('Attachment gate: thresholds, diversity, locks, floors and ranking-reversal risk pass');
