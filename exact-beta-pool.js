const preferred = (rows, better) => rows.reduce((best, row) =>
  row && (!best || better(row, best)) ? row : best, null);
const cheaper = (a, b) => a.cost < b.cost || (a.cost === b.cost && a.gain > b.gain);
const stronger = (a, b) => a.gain > b.gain || (a.gain === b.gain && a.cost < b.cost);
const utility = (row, window) => row.gain - window.gainFloor -
  window.tradeoffSlope * (row.cost - window.min);

export function combineEndpoints(shards, minimumShare) {
  const maximum = preferred(shards.map(shard => shard.outputs.maximum), stronger);
  const upperGain = Math.max(...shards.map(shard => shard.certificate.upperGain));
  const archive = shards.flatMap(shard => shard.archive);
  const minimum = preferred(archive.filter(row => row.gain >= upperGain * minimumShare), cheaper);
  const pending = shards.reduce((sum, shard) => sum + shard.pending, 0);
  const proven = {maximum: !pending && Boolean(maximum), minimum: !pending && Boolean(minimum), balanced: false};
  const lowerCost = pending ? Math.min(...shards.map(shard => shard.certificate.lowerCost))
    : minimum?.cost ?? Infinity;
  return {outputs: {maximum, minimum, balanced: null}, proven, pending: pending || 1,
    certificate: {upperGain, lowerCost, upperEfficiency: null}, archive, minimumShare};
}

export function balancedWindow(endpoints) {
  const {maximum, minimum} = endpoints.outputs;
  if (!endpoints.proven.maximum || !endpoints.proven.minimum) return null;
  const span = maximum.cost - minimum.cost;
  return {min: minimum.cost, max: maximum.cost, gainFloor: minimum.gain,
    tradeoffSlope: span > 0 ? (maximum.gain - minimum.gain) / span : 0};
}

export function sharedBalancedSeed(rows, window) {
  return preferred(rows.filter(row => row.cost > window.min && row.cost < window.max &&
      row.gain > window.gainFloor), (a, b) => utility(a, window) > utility(b, window) ||
    (utility(a, window) === utility(b, window) && stronger(a, b)));
}

export function combineBalanced(endpoints, shards, window) {
  const balanced = sharedBalancedSeed(shards.map(shard => shard.outputs.balanced).filter(Boolean), window);
  return {...endpoints, outputs: {...endpoints.outputs, balanced},
    proven: {...endpoints.proven, balanced: shards.every(shard => shard.proven.balanced)},
    pending: shards.reduce((sum, shard) => sum + shard.pending, 0),
    certificate: {...endpoints.certificate,
      upperEfficiency: Math.max(...shards.map(shard => shard.certificate.upperEfficiency))}};
}
