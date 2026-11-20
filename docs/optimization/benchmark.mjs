import {solve} from './prototype.mjs';

function oracle({slots, budget, threshold, penalty}) {
  const answer = [-Infinity, -Infinity, -Infinity];
  const feasible = [0, 0, 0];
  function visit(i, delta, cost) {
    if (i < slots.length) {
      for (const row of slots[i]) visit(i + 1, delta + row.delta, cost + row.cost);
      return;
    }
    const score = 1000 - delta ** 2;
    if (cost <= budget) {
      feasible[0]++;
      feasible[2]++;
      answer[0] = Math.max(answer[0], score);
      answer[2] = Math.max(answer[2], score - penalty * cost);
    }
    if (score >= threshold) {
      feasible[1]++;
      answer[1] = Math.max(answer[1], -cost);
    }
  }
  visit(0, 0, 0);
  return {answer, feasible};
}

export function benchmark(repeats = 7) {
  let seed = 6437;
  function random(n) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  }
  function fixture(dimensions, budget, threshold) {
    return {budget, threshold, penalty: 3, slots: dimensions.map(size =>
      Array.from({length: size}, () => ({delta: random(31) - 10, cost: random(20)})))};
  }
  const reversal = {budget: 5, threshold: 1000, penalty: 1, slots: [
    [{delta: 0, cost: 1}, {delta: 4, cost: 2}],
    [{delta: -4, cost: 0}, {delta: -3, cost: 0}],
  ]};
  const staged = {...reversal, slots: [[reversal.slots[0][0]], reversal.slots[1]]};
  if (oracle(staged).answer[0] !== 991 || oracle(reversal).answer[0] !== 1000) throw Error('Reversal fixture');
  const medium = fixture([5, 5, 5, 5, 5, 13, 13], 25, 996);
  const fixtures = {
    reversal, infeasible: {...reversal, budget: 0, threshold: 1001},
    small: fixture([3, 4, 6, 7], 21, 999),
    tight: medium,
    loose: {...medium, budget: 125},
  };
  function check(input, limits) {
    const {answer: expected} = oracle(input);
    for (const limit of limits) {
      const {best, certificate} = solve(input, {limit});
      best.forEach((row, i) => {
        if (row) {
          const selected = row.path.map((choice, depth) => input.slots[depth][choice]);
          const cost = selected.reduce((sum, option) => sum + option.cost, 0);
          const score = 1000 - selected.reduce((sum, option) => sum + option.delta, 0) ** 2;
          const replay = [
            cost <= input.budget ? score : -Infinity,
            score >= input.threshold ? -cost : -Infinity,
            cost <= input.budget ? score - input.penalty * cost : -Infinity,
          ];
          if (row.value !== replay[i] || row.cost !== cost || row.score !== score) throw Error('Replay');
        }
        const {status, upper} = certificate[i];
        const observed = row?.value ?? -Infinity;
        if (observed > expected[i] || (upper ?? -Infinity) < expected[i] ||
            ((limit === Infinity || status === 'optimal' || status === 'infeasible') &&
              observed !== expected[i])) throw Error('Wrong certificate');
      });
    }
    return expected.map(value => Number.isFinite(value) ? value : null);
  }
  for (let i = 0; i < 100; i++) check(fixture([3, 4, 5], random(40), 950 + random(60)), [0, 1, 10, Infinity]);
  return Object.fromEntries(Object.entries(fixtures).map(([name, input]) => {
    const expected = check(input, [0, 1, 10, 100, Infinity]);
    const samples = {enumeration: [], bounded: []};
    for (let i = -1; i < repeats; i++) {
      for (const bounded of i % 2 ? [true, false] : [false, true]) {
        const run = solve(input, {bounded});
        if (JSON.stringify(run.best.map(row => row?.value ?? null)) !== JSON.stringify(expected)) throw Error('Oracle mismatch');
        if (i >= 0) samples[bounded ? 'bounded' : 'enumeration'].push(
          {ms: run.elapsedMs, ...run.metrics});
      }
    }
    return [name, {expected, feasible: oracle(input).feasible, CartesianLeaves: input.slots.reduce((n, slot) => n * slot.length, 1),
      at100Nodes: solve(input, {limit: 100}).certificate, samples}];
  }));
}
