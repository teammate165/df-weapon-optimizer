import assert from 'node:assert/strict';
import {rankRows,encodeTable,allowed} from '../tools/milp_finite_table.mjs';
const row=(id,objectives,cost)=>({id,objectives,cost,config:[{slotPath:'1',itemId:id}],stats:{control:50,handling:50,stability:50,accuracy:50}});
const rows=[row('a',[10,50],100),row('b',[10,40],200),row('c',[11,0],0),row('d',[10,40],100)];
assert.deepEqual(rankRows(rows).map(r=>r.rank),[3,2,4,1]);
assert.equal(allowed(rows[0],{locks:[{slotPath:'1',itemId:'b'}]}),false);
assert.equal(allowed(rows[0],{minimums:{control:51}}),false);
assert.equal(allowed(rows[0],{minimums:{control:50}}),true);
const model=encodeTable(rows,{budget:100});
assert.equal(model.variables,4);
// SCIP's linear reader rejects explicit zero terms; preserve the zero-cost
// row in the exactly-one constraint, but omit it from the budget expression.
assert(model.cip.includes('+1 <r2>'));
assert(!model.cip.includes('+0 <r2>'));
assert.equal(encodeTable([row('free',[1,1],0)],{budget:0}).constraints,1);
assert.throws(()=>encodeTable(rows,{budget:-1}));
assert.throws(()=>encodeTable(rows,{budget:1,minimums:{unknown:1}}));
assert.throws(()=>rankRows([rows[0],rows[0]]));
assert.throws(()=>rankRows([row('a',[1],0),row('b',[1,2],0)]));
assert.throws(()=>rankRows([row('a',[100,3],0),row('b',[100+0.75e-10,2],0),row('c',[100+1.5e-10,1],0)]),/consistent total order/);
console.log('Finite-table priority, constraints, validation and tolerance-cycle checks pass');
