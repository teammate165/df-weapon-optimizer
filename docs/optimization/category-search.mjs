// A node bounds every descendant gain and cost. Children must cover the
// parent's domain. Unfinished nodes remain available to the certificate.
export function searchCategories(root, {budget, expand, clock = () => performance.now(),
  deadline = Infinity, nodeLimit = Infinity, guaranteedMinimumBound = false, minimumShare = 0.5,
  balancedWindow, endpointArchive = false, balancedSeed}) {
  const live = [root];
  const archive = [];
  let maximum = null;
  let balanced = null;
  let guaranteedMinimum = null;
  let visited = 0;
  const incremental = balancedWindow?.incremental;
  const tradeoffSlope = balancedWindow?.tradeoffSlope;
  const tradeoff = (gain, cost) => (gain - balancedWindow.gainFloor) -
    tradeoffSlope * (cost - balancedWindow.min);
  const ratio = row => tradeoffSlope !== undefined ? tradeoff(row.gain, row.cost) : incremental
    ? (row.gain - balancedWindow.gainFloor) / (row.cost - balancedWindow.min)
    : row.cost === 0 ? Infinity : row.gain / row.cost;
  const covers = (a, b) => a.cost <= b.cost && a.gain >= b.gain;

  function accept(row) {
    if (balancedWindow) {
      if (outsideWindow(row.cost, row.cost) || row.gain <= balancedWindow.gainFloor) return;
      if (!balanced || ratio(row) > ratio(balanced) ||
          (ratio(row) === ratio(balanced) && row.gain > balanced.gain)) balanced = row;
      return;
    }
    if (!maximum || row.gain > maximum.gain ||
        (row.gain === maximum.gain && row.cost < maximum.cost)) maximum = row;
    if (guaranteedMinimumBound && row.gain > 0 && row.gain >= root.upperGain * minimumShare &&
        (!guaranteedMinimum || row.cost < guaranteedMinimum.cost ||
          (row.cost === guaranteedMinimum.cost && row.gain > guaranteedMinimum.gain))) {
      guaranteedMinimum = row;
    }
    if (row.gain <= 0 || archive.some(other => covers(other, row))) return;
    for (let i = archive.length - 1; i >= 0; i--) {
      if (covers(row, archive[i])) archive.splice(i, 1);
    }
    archive.push(row);
    if (!balanced || ratio(row) > ratio(balanced) ||
        (ratio(row) === ratio(balanced) && row.gain > balanced.gain)) balanced = row;
  }

  function cheapest(threshold) {
    return archive.reduce((best, row) => row.gain >= threshold &&
      (!best || row.cost < best.cost || (row.cost === best.cost && row.gain > best.gain))
      ? row : best, null);
  }

  const outsideWindow = (lower, upper) => balancedWindow &&
    (balancedWindow.min + 1 >= balancedWindow.max || lower >= balancedWindow.max || upper <= balancedWindow.min);
  const nodeUpperCost = node => node.row?.cost ?? node.layout?.cost ?? Infinity;
  if (balancedWindow && balancedSeed && balancedSeed.cost <= budget) accept(balancedSeed);

  function efficiencyBound(node) {
    const {upperGain, lowerCost} = node;
    if (outsideWindow(lowerCost, nodeUpperCost(node)) ||
        (balancedWindow && upperGain <= balancedWindow.gainFloor)) return -Infinity;
    if (tradeoffSlope !== undefined) {
      return tradeoff(upperGain, Math.max(lowerCost, balancedWindow.min + 1));
    }
    if (incremental) {
      return (upperGain - balancedWindow.gainFloor) / Math.max(1, lowerCost - balancedWindow.min);
    }
    if (balancedWindow) {
      const divisor = upperGain >= 0 ? Math.max(lowerCost, balancedWindow.min + 1)
        : Math.min(nodeUpperCost(node), balancedWindow.max - 1);
      return upperGain / divisor;
    }
    if (upperGain <= 0) return -Infinity;
    return lowerCost === 0 ? Infinity : upperGain / lowerCost;
  }

  // Optional alternatives cover a node's domain with separate gain/cost
  // pairs. They need not be expanded independently.
  const alternatives = node => node.alternatives ?? [node];
  function cannotImprove(node) {
    if (node.lowerCost > budget) return true;
    const efficiency = efficiencyBound(node);
    const cannotImproveRatio = efficiency === -Infinity || (balanced &&
      (ratio(balanced) > efficiency ||
        (ratio(balanced) === efficiency && balanced.gain >= node.upperGain)));
    if (balancedWindow) return cannotImproveRatio;
    if (!maximum || maximum.gain < node.upperGain ||
        (maximum.gain === node.upperGain && maximum.cost > node.lowerCost)) return false;
    // Preserve possible winners at every still-possible relative performance threshold.
    const cannotImproveMinimum = node.upperGain <= 0 || node.upperGain < maximum.gain * minimumShare ||
      (guaranteedMinimum && (guaranteedMinimum.cost < node.lowerCost ||
        (guaranteedMinimum.cost === node.lowerCost && guaranteedMinimum.gain >= node.upperGain))) ||
      archive.some(row => row.gain >= node.upperGain && row.cost <= node.lowerCost);
    return Boolean(endpointArchive || cannotImproveRatio) && cannotImproveMinimum;
  }

  while (live.length && visited < nodeLimit && clock() < deadline) {
    const node = live.pop();
    visited++;
    if (alternatives(node).every(cannotImprove)) continue;
    if (node.row) {
      if (node.row.cost <= budget) accept(node.row);
    } else {
      live.push(...expand(node, {cannotImprove}));
    }
  }

  const affordable = live.flatMap(alternatives).filter(node => node.lowerCost <= budget);
  const upperGain = affordable.reduce((upper, node) => Math.max(upper, node.upperGain),
    maximum?.gain ?? -Infinity);
  const minimum = cheapest(upperGain * minimumShare);
  const provisionalMinimum = cheapest((maximum?.gain ?? -Infinity) * minimumShare);
  const lowerCost = affordable.reduce((lower, node) =>
    node.upperGain > 0 && node.upperGain >= (maximum?.gain ?? -Infinity) * minimumShare
      ? Math.min(lower, node.lowerCost) : lower, provisionalMinimum?.cost ?? Infinity);
  const upperEfficiency = affordable.reduce((upper, node) => Math.max(upper, efficiencyBound(node)),
    balanced ? ratio(balanced) : -Infinity);

  return {visited, pending: live.length, maximum, minimum, provisionalMinimum, balanced, archive,
    bounds: {upperGain, lowerCost, upperEfficiency},
    proven: {
      maximum: maximum !== null && maximum.gain === upperGain &&
        affordable.every(node => node.upperGain < upperGain || node.lowerCost >= maximum.cost),
      minimum: minimum !== null && minimum.cost === lowerCost &&
        affordable.every(node => node.lowerCost > minimum.cost || node.upperGain <= minimum.gain) &&
        (provisionalMinimum.cost !== minimum.cost || provisionalMinimum.gain === minimum.gain),
      balanced: (Boolean(balancedWindow) && !balanced && upperEfficiency === -Infinity) ||
        (balanced !== null && ratio(balanced) === upperEfficiency &&
        affordable.every(node => efficiencyBound(node) < upperEfficiency || node.upperGain <= balanced.gain)),
    }};
}
