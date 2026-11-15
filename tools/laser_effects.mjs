// Project policy: enabled laser bonuses do not accumulate. Source data and
// ordinary mounted effects (including every device's penalties) stay intact.
// Mixed-device strongest-per-target selection is provisional pending client tests.
export function nonstackLaserOperations(operations) {
  const best=new Map();
  for(const op of operations) {
    if(op.sourceKind!=='part'||op.scope!=='TacticalEffective')continue;
    if(op.operation!=='StaticAttributeModify'||op.modifier!=='Addend'||!Number.isFinite(op.value))throw Error('Unsupported enabled laser operation');
    const key=op.target;
    if(!best.has(key)||op.value>best.get(key).value)best.set(key,op);
  }
  return operations.filter(op=>op.sourceKind!=='part'||op.scope!=='TacticalEffective'||best.get(op.target)===op);
}
