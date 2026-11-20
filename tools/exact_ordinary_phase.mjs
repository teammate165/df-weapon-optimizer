function stronger(a, b) {
  return a.loss < b.loss || (a.loss === b.loss &&
    (a.handling < b.handling || (a.handling === b.handling && (a.cost ?? 0) < (b.cost ?? 0))));
}

// Compute the floating-point merit in the same order as the ordinary archive.
export function ordinaryBalancedMerit(maximum, minimum) {
  const slope = (maximum.score - minimum.score) / (maximum.cost - minimum.cost);
  return (score, cost) => score - minimum.score - slope * (cost - minimum.cost);
}

export function createExactOrdinaryPhase(phase, budget, globalMaximumLoss) {
  const {kind, maximum, minimum} = phase;
  let incumbent = phase.incumbent;
  const merit = kind === 'balanced' ? ordinaryBalancedMerit(maximum, minimum) : null;
  const threshold = kind === 'minimum' ? 0.6 * maximum.score : minimum?.score;
  const eligibleCost = cost => kind === 'minimum' ? cost <= (incumbent?.cost ?? budget)
    : kind === 'balanced' ? cost > minimum.cost && cost < maximum.cost : true;
  const eligibleScore = score => kind === 'minimum' ? score >= threshold
    : kind === 'balanced' ? score > threshold : true;
  const prefer = (row, best) => {
    if (!best) return true;
    if (kind === 'minimum' && row.cost !== best.cost) return row.cost < best.cost;
    if (merit) {
      const value = merit(row.score, row.cost), previous = merit(best.score, best.cost);
      if (value !== previous) return value > previous;
    }
    return stronger(row, best);
  };
  const cut = (lower, cost) => {
    if (kind === 'maximum') return lower > Math.min(incumbent?.loss ?? Infinity, globalMaximumLoss());
    const upper = 100 - lower;
    if (!eligibleScore(upper)) return true;
    if (kind === 'minimum') return Boolean(incumbent && cost === incumbent.cost && lower > incumbent.loss);
    return incumbent && cost !== undefined && merit(upper, cost) < merit(incumbent.score, incumbent.cost);
  };
  const eligibleSuffix = branch => {
    for (const suffix of branch.suffixCosts) {
      const cost = branch.selectedCost + suffix;
      if (cost > budget) break;
      if (eligibleCost(cost)) return cost;
    }
    return undefined;
  };
  return {
    priceBudget: kind === 'maximum' ? undefined : budget,
    eligibleCost,
    eligibleScore,
    costCut: branch => Boolean(branch.suffixCosts && eligibleSuffix(branch) === undefined),
    layoutCut: cut,
    mountCut: (lower, branch) => {
      // The cheapest eligible completion maximizes the upper bound on merit.
      // For Minimum, a cheaper completion prevents a same-price loss cut.
      const cost = branch.suffixCosts ? eligibleSuffix(branch) : undefined;
      return cut(lower, cost);
    },
    observe(row) {
      if (prefer(row, incumbent)) incumbent = row;
    },
  };
}
