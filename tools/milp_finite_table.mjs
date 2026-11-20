// Experimental exact finite-domain encoding. The caller must enumerate the
// declared domain completely; this module does not discover missing builds.
import {compareObjectives} from './optimizer_policy.mjs';

export function rankRows(rows) {
  if(!rows.length)throw Error('The declared table is empty');
  const ids=new Set();
  for(const row of rows){
    if(typeof row.id!=='string'||ids.has(row.id))throw Error('Unique string row IDs required');
    ids.add(row.id);
    if(!Array.isArray(row.objectives)||row.objectives.length!==rows[0].objectives.length||!row.objectives.length||row.objectives.some(v=>!Number.isFinite(v))||!Number.isSafeInteger(row.cost)||row.cost<0)throw Error('Finite objectives of equal length and nonnegative integer costs required');
    if(!Array.isArray(row.config)||!row.stats||['control','handling','stability','accuracy'].some(key=>!Number.isFinite(row.stats[key])))throw Error('Config and four finite stats required');
  }
  const compare=(a,b)=>compareObjectives(a,b)||a.cost-b.cost||a.id.localeCompare(b.id);
  const sorted=[...rows].sort(compare);
  // Relative-tolerance comparisons can be nontransitive. Reject such a domain
  // rather than silently claim a rank preserves an inconsistent ordering.
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
    if(compare(sorted[i],sorted[j])>0)throw Error('Tolerance comparator has no consistent total order for this table');
  }
  const ranks=new Map(sorted.map((row,i)=>[row.id,i+1]));
  return rows.map(row=>({...row,rank:ranks.get(row.id)}));
}

export function allowed(row, {minimums={},locks=[]}={}) {
  return Object.entries(minimums).every(([key,value])=>row.stats[key]>=value)
    &&locks.every(lock=>row.config.some(c=>c.slotPath===lock.slotPath&&c.itemId===lock.itemId));
}

export function encodeTable(rows, request={}) {
  const {budget,minimums={},locks=[]}=request;
  if(!Number.isSafeInteger(budget)||budget<0)throw Error('Budget must be a nonnegative safe integer');
  if(Object.entries(minimums).some(([key,value])=>!['control','handling','stability','accuracy'].includes(key)||!Number.isFinite(value)||value<0))throw Error('Invalid stat floor');
  if(!Array.isArray(locks)||locks.some(l=>typeof l.slotPath!=='string'||typeof l.itemId!=='string'))throw Error('Invalid locks');
  const ranked=rankRows(rows);
  // These are linear predicates over a complete table. Prohibited rows have
  // upper bound zero; no rounded stat coefficient can admit an invalid row.
  const variables=ranked.map((row,i)=>`  [binary] <r${i}>: obj=${row.rank}, original bounds=[0,${allowed(row,request)?1:0}]`);
  const terms=field=>ranked.map((row,i)=>field(row)===0?'':`+${field(row)} <r${i}>`).filter(Boolean).join(' ');
  const budgetTerms=terms(row=>row.cost);
  const cip=`STATISTICS\n  Problem name : bounded-weapon-table-milp\nOBJECTIVE\n  Sense : minimize\nVARIABLES\n${variables.join('\n')}\nCONSTRAINTS\n  [linear] <one_build>: ${terms(()=>1)} == 1;\n${budgetTerms?`  [linear] <budget>: ${budgetTerms} <= ${budget};\n`:''}END\n`;
  return {cip,ranked,variables:ranked.length,constraints:budgetTerms?2:1};
}
