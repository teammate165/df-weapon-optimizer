/* Research fixture solver. All arithmetic is exact Number integer arithmetic
   within the deliberately small fixture domain. */
export function solve({slots, budget, threshold, penalty}, {bounded = true, limit = Infinity} = {}) {
  const start = performance.now();
  const suffix = Array.from({length: slots.length + 1}, () => ({low: 0, high: 0, cost: 0}));
  for (let i = slots.length - 1; i >= 0; i--) {
    const next = suffix[i + 1];
    suffix[i] = {
      low: next.low + Math.min(...slots[i].map(row => row.delta)),
      high: next.high + Math.max(...slots[i].map(row => row.delta)),
      cost: next.cost + Math.min(...slots[i].map(row => row.cost)),
    };
  }
  const pending = [];
  const best = [null, null, null];
  const metrics = {nodes: 0, pruned: 0, evaluations: 0, peakPending: 0,
    firstFeasibleMs: null, lastImprovementMs: null};
  const score = delta => 1000 - delta * delta;
  function enqueue(depth, delta, cost, path) {
    const rest = suffix[depth];
    const closest = Math.max(delta + rest.low, Math.min(0, delta + rest.high));
    pending.push({depth, delta, cost, path, lowerCost: cost + rest.cost,
      upperScore: score(closest)});
  }
  function bounds({lowerCost, upperScore}) {
    const affordable = lowerCost <= budget;
    return [
      affordable ? upperScore : -Infinity,
      upperScore >= threshold ? -lowerCost : -Infinity,
      affordable ? upperScore - penalty * lowerCost : -Infinity,
    ];
  }
  enqueue(0, 0, 0, []);
  while (pending.length && metrics.nodes < limit) {
    metrics.peakPending = Math.max(metrics.peakPending, pending.length);
    const node = pending.pop();
    metrics.nodes++;
    if (bounded && bounds(node).every((value, i) => value <= (best[i]?.value ?? -Infinity))) {
      metrics.pruned++;
      continue;
    }
    if (node.depth === slots.length) {
      metrics.evaluations++;
      const values = bounds(node);
      if (values.some(Number.isFinite)) metrics.firstFeasibleMs ??= performance.now() - start;
      values.forEach((value, i) => {
        if (value > (best[i]?.value ?? -Infinity)) {
          best[i] = {value, cost: node.cost, score: score(node.delta), path: node.path};
          metrics.lastImprovementMs = performance.now() - start;
        }
      });
      continue;
    }
    const options = slots[node.depth];
    for (let i = options.length - 1; i >= 0; i--) {
      const {delta, cost} = options[i];
      enqueue(node.depth + 1, node.delta + delta, node.cost + cost, [...node.path, i]);
    }
  }
  const upper = best.map(row => row?.value ?? -Infinity);
  for (const node of pending) bounds(node).forEach((value, i) => {
    upper[i] = Math.max(upper[i], value);
  });
  const certificate = upper.map((value, i) => ({
    upper: Number.isFinite(value) ? value : null,
    status: value === -Infinity ? 'infeasible' : !best[i] ? 'unknown' :
      value === best[i].value ? 'optimal' : 'bounded',
    gap: best[i] ? value - best[i].value : null,
  }));
  return {best, certificate, metrics, elapsedMs: performance.now() - start};
}
