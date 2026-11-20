import assert from 'node:assert/strict';
import {searchCategories} from './category-search.mjs';
import {readFileSync} from 'node:fs';

const root = new URL('../../.scratch/full-budget-validation/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
const curves = await import(new URL('runtime-source/curves.mjs', root));
const kernel = await import(new URL('runtime-source/kernel.mjs', root));
const {t: calculate} = await import(new URL('runtime-source/attributes.mjs', root));
const {presets} = await import(new URL('runtime-scorer/optimizer_presets.mjs', root));
const {emptyRisers} = await import(new URL('runtime-scorer/optimizer_mounts.mjs', root));
const {pack, prices, shop} = read('18070000005.json');

function categories(rows, baseline) {
  const scored = rows.map(row => ({...row, gain: baseline - row.loss}));
  const strongest = scored.reduce((a, b) => b.gain > a.gain ||
    (b.gain === a.gain && b.cost < a.cost) ? b : a);
  const threshold = strongest.gain / 2;
  const positive = scored.filter(row => row.gain > 0);
  const minimum = positive.filter(row => row.gain >= threshold).reduce((a, b) =>
    !a || b.cost < a.cost || (b.cost === a.cost && b.gain > a.gain) ? b : a, null);
  const efficiency = row => row.cost === 0 ? Infinity : row.gain / row.cost;
  const balanced = positive.reduce((a, b) =>
    !a || efficiency(b) > efficiency(a) ||
    (efficiency(b) === efficiency(a) && b.gain > a.gain) ? b : a, null);
  return {strongest, threshold, minimum, balanced,
    efficiency: balanced ? (balanced.cost ? efficiency(balanced) : 'free improvement') : null};
}

function checkSearch(rows, baseline, budget, expected) {
  const leaves = rows.map(row => {
    const gain = baseline - row.loss;
    return {row: {...row, gain}, upperGain: gain, lowerCost: row.cost};
  });
  function tree(begin, end) {
    if (end - begin === 1) return leaves[begin];
    const middle = Math.floor((begin + end) / 2);
    const children = [tree(begin, middle), tree(middle, end)];
    return {children, upperGain: Math.max(...children.map(node => node.upperGain)),
      lowerCost: Math.min(...children.map(node => node.lowerCost))};
  }
  const root = tree(0, leaves.length);
  const results = [];
  for (const nodeLimit of [0, 1, 10, 100, 1000, Infinity]) {
    const result = searchCategories(root, {budget, nodeLimit, expand: node => node.children});
    for (const key of ['maximum', 'minimum', 'balanced']) {
      const target = expected[key === 'maximum' ? 'strongest' : key];
      if (result.proven[key] || nodeLimit === Infinity) {
        assert.equal(result[key].gain, target.gain);
        assert.equal(result[key].cost, target.cost);
        assert(result.proven[key]);
      }
    }
    assert(result.bounds.upperGain >= expected.strongest.gain);
    assert(result.bounds.lowerCost <= expected.minimum.cost);
    assert(result.bounds.upperEfficiency >= expected.efficiency);
    if (result.minimum) assert(result.minimum.gain >= expected.threshold);
    results.push({nodeLimit: Number.isFinite(nodeLimit) ? nodeLimit : 'unlimited',
      visited: result.visited, pending: result.pending, proven: result.proven});
  }
  const expired = searchCategories(root, {budget, deadline: 10, clock: () => 10,
    expand: () => assert.fail('Expanded after deadline')});
  assert.equal(expired.visited, 0);
  assert(expired.bounds.upperGain >= expected.strongest.gain);
  return results;
}

for (const mode of ['bd', 'sol']) {
  const resolve = config => curves.o(pack, config, mode);
  const preset = presets.recoil.create({pack, mode, resolve, curves, kernel, calculate, request: {mode}});
  const costs = mode === 'bd' ? shop.partCosts : prices;
  const budget = mode === 'bd' ? shop.weapons[pack.weaponId].gunsmithLimit : 5_000_000;
  const evaluate = (build, tunes) => preset.score(preset.raw(build, tunes));
  const baseline = evaluate(resolve([]), {});
  const start = performance.now();
  const reduced = read('g18-' + mode + '-certified-configurations.json').map(row => {
    const build = resolve(row.config);
    assert.deepEqual(build.config, row.config);
    const cost = build.mounted.filter(part => part.source === 'equipped')
      .reduce((sum, part) => sum + costs[part.itemId], 0);
    assert.equal(cost, row.cost);
    assert(cost <= budget);
    for (const [path, entries] of Object.entries(row.tunes)) {
      const mounted = build.mounted.find(part => part.slotPath === path);
      for (const [id, value] of Object.entries(entries)) {
        const control = curves.c(pack, mounted, id);
        assert(control.enabled !== false && curves.n(control).includes(value));
      }
    }
    const loss = evaluate(build, row.tunes);
    assert.equal(loss, row.objectives[0]);
    return {cost, loss, config: row.config, tunes: row.tunes};
  });
  assert.equal(reduced.length, mode === 'bd' ? 582 : 3360);

  // Independently enumerate every slider setting on one stock and two
  // single-muzzle layouts, then compare each result against the old reduction.
  const subset = reduced.filter(row => row.config.length === 1 &&
    row.config[0].slotPath === '1' && Object.keys(row.tunes).length).slice(0, 2);
  assert.equal(subset.length, 2);
  const stock = reduced.find(row => row.config.length === 0);
  const exhaustive = [stock];
  const layouts = [];
  const targets = ['GRecoil_H', 'GRecoil_V', 'GRecoil_HShake', 'GRecoil_VShake',
    'GGunkickRandom', 'GGunkickSpring'];
  const ignored = new Set(['GAiming_ADSTime', 'GSprintToFireTime', 'GBullet_Velocity',
    'GMovement_ADSSpeed', 'AimMoveGunSway', 'GBreathScale', 'ScopeCameraTuneDistance',
    'ScopeZoomTuneRate']);
  assert.equal(preset.baseline.pattern_model, 'legacy-multiplier-v1');
  function calibrationGuard(build) {
    const controls = build.mounted.flatMap(part => (pack.parts[part.itemId]?.tuneIds ?? [])
      .flatMap(id => {
        const control = curves.c(pack, part, id);
        return control && control.enabled !== false ?
          [{path: part.slotPath, id, positions: curves.n(control), control}] : [];
      }));
    const state = kernel.u(pack, build, {mode, tacticalEffective: true, tunes: {}});
    const choices = controls.map(({control, positions}) => {
      for (const f of control.functions) {
        assert(targets.includes(f.target) || ignored.has(f.target));
        if (targets.includes(f.target)) {
          assert.equal(f.modifier, 'Mult_A');
          assert.equal(curves.r(pack.curves[f.curveId], control.range.defaultValue), 0);
        }
      }
      return positions.map(value => ({
        value,
        effects: targets.map(target => control.functions.filter(f => f.target === target)
          .map(f => curves.r(pack.curves[f.curveId], value))),
      }));
    });
    // Compare individual ordered contributions, avoiding reassociation.
    const minimums = choices.map(options => {
      const first = options[0];
      const minima = first.effects.map((row, axis) => row.map((_, i) =>
        Math.min(...options.map(option => option.effects[axis][i]))));
      const best = options.find(option => option.effects.every((row, axis) =>
        row.every((effect, i) => effect === minima[axis][i])));
      assert(best, 'No common per-operation minimum');
      return best;
    });
    for (const [axis, target] of targets.entries()) {
      const bucket = state.numeric.buckets.get(target) ?? {};
      const slope = ((bucket.initial ?? state.baseTargets[target] ?? 1) +
        (bucket.addend ?? 0)) * (bucket.multC ?? 1);
      assert(Number.isFinite(slope) && slope >= 0);
      const worstNegative = minimums.reduce((sum, option) =>
        sum + option.effects[axis].reduce((total, value) => total + Math.min(0, value), 0), 0);
      // Require a wide positive margin so tiny native rounding errors cannot
      // move this fixture across zero, where norm monotonicity would change.
      assert(1 + (bucket.multA ?? 0) + worstNegative > 0.01);
    }
    return {controls, minimums};
  }
  for (const reference of subset) {
    const build = resolve(reference.config);
    const {controls, minimums} = calibrationGuard(build);
    const bounds = new Map();
    layouts.push({reference, build, controls, minimums, bounds});
    let min = Infinity;
    function visit(index, tunes, prefix = []) {
      if (index === controls.length) {
        const loss = evaluate(build, tunes);
        min = Math.min(min, loss);
        for (let length = 0; length <= prefix.length; length++) {
          const key = JSON.stringify(prefix.slice(0, length));
          bounds.set(key, Math.max(bounds.get(key) ?? -Infinity, baseline - loss));
        }
        exhaustive.push({...reference, loss, tunes});
        return;
      }
      const {path, id, positions} = controls[index];
      for (const value of positions) {
        visit(index + 1, {...tunes, [path]: {...tunes[path], [id]: value}}, [...prefix, value]);
      }
    }
    visit(0, {});
    assert.equal(min, reference.loss);
  }
  const compact = ({strongest, minimum, balanced}) =>
    [strongest, minimum, balanced].map(({cost, loss}) => [cost, loss]);
  const small = categories(exhaustive, baseline);
  assert.deepEqual(compact(small), compact(categories([exhaustive[0], ...subset], baseline)));
  // The stock-normalized legacy loss combines nonnegative weighted norms.
  // Its loss is therefore at least zero for every legal tuning completion.
  // This gives an intentionally loose gain bound without evaluating a tuple.
  function lazySearch(tight) {
    const lazyStart = performance.now();
    let nativeEvaluations = 0;
    const scored = new Map();
    function score(layout, tunes, positions) {
      const key = JSON.stringify([layout.reference.config, positions]);
      if (!scored.has(key)) {
        scored.set(key, evaluate(layout.build, tunes));
        nativeEvaluations++;
      }
      return scored.get(key);
    }
    function makeNode(layout, positions, tunes) {
      const lowerCost = layout.reference.cost;
      if (!tight) return {layout, positions, tunes, lowerCost, upperGain: baseline};
      const completion = [...positions];
      let optimisticTunes = tunes;
      for (let i = positions.length; i < layout.controls.length; i++) {
        const {path, id} = layout.controls[i];
        const {value} = layout.minimums[i];
        completion.push(value);
        optimisticTunes = {...optimisticTunes,
          [path]: {...optimisticTunes[path], [id]: value}};
      }
      const loss = score(layout, optimisticTunes, completion);
      const upperGain = baseline - loss;
      assert(upperGain >= layout.bounds.get(JSON.stringify(positions)), 'Non-admissible bound');
      if (positions.length === completion.length) {
        return {lowerCost, upperGain, row: {...layout.reference, loss, gain: upperGain, tunes}};
      }
      return {layout, positions, tunes, lowerCost, upperGain};
    }
    const lazy = searchCategories({lowerCost: 0, upperGain: baseline}, {
      budget,
      expand(node) {
        if (!node.layout) {
          return [
            {lowerCost: 0, upperGain: 0, row: {...stock, gain: 0}},
            ...layouts.map(layout => makeNode(layout, [], {})),
          ];
        }
        const {layout, positions, tunes, lowerCost} = node;
        if (positions.length === layout.controls.length) {
          const loss = score(layout, tunes, positions);
          const gain = baseline - loss;
          return [{lowerCost, upperGain: gain,
            row: {...layout.reference, tunes, loss, gain}}];
        }
        const {path, id, positions: values} = layout.controls[positions.length];
        return values.map(value => makeNode(layout, [...positions, value],
          {...tunes, [path]: {...tunes[path], [id]: value}}));
      },
    });
    assert.equal(lazy.pending, 0);
    assert.deepEqual(lazy.proven, {maximum: true, minimum: true, balanced: true});
    assert.deepEqual(compact({...lazy, strongest: lazy.maximum}), compact(small));
    return {nativeCalibrationEvaluations: nativeEvaluations, visited: lazy.visited,
      elapsedMs: performance.now() - lazyStart, proven: lazy.proven};
  }
  const unrestrictedLazy = lazySearch(false);
  const tighterLazy = lazySearch(true);
  const fullStart = performance.now();
  const hidden = new Set(mode === 'bd' ? shop.hiddenItemIds : []);
  const seen = new Set();
  const expectedByConfig = new Map(reduced.map(row => [JSON.stringify(row.config), row]));
  function mountNode(config, done) {
    const build = resolve(config);
    if (!config.every(part => build.config.some(row =>
      row.slotPath === part.slotPath && row.itemId === part.itemId))) return [];
    if (build.mounted.some(part => hidden.has(part.itemId)) ||
        build.mounted.filter(part => kernel.l(pack, part.itemId, mode)).length > 1) return [];
    // Match the frozen oracle's partial affordability filter. This is a
    // fixture-specific domain contract, not a generic mount cost bound.
    const cost = build.mounted.filter(part => part.source === 'equipped')
      .reduce((sum, part) => sum + (costs[part.itemId] ?? Infinity), 0);
    if (!Number.isFinite(cost) || cost > budget) return [];
    return [{config, done, build, cost, lowerCost: 0, upperGain: baseline}];
  }
  const fullLazy = searchCategories(mountNode([], new Set())[0], {
    budget,
    expand({config, done, build, cost}) {
      const slot = build.slots.find(row => !done.has(row.slotPath));
      if (slot) {
        const next = new Set(done).add(slot.slotPath);
        return [config, ...slot.options.filter(itemId => !hidden.has(itemId))
          .map(itemId => [...config, {slotPath: slot.slotPath, itemId}])]
          .flatMap(choice => mountNode(choice, next));
      }
      if (emptyRisers(pack, build).length) return [];
      const key = JSON.stringify(build.mounted.map(part => [part.slotPath, part.itemId, part.source]));
      if (seen.has(key)) return [];
      seen.add(key);
      const {controls, minimums} = calibrationGuard(build);
      const tunes = {};
      controls.forEach(({path, id}, index) => {
        (tunes[path] ??= {})[id] = minimums[index].value;
      });
      const loss = evaluate(build, tunes);
      const configKey = JSON.stringify(build.config);
      const reference = expectedByConfig.get(configKey);
      assert(reference, 'Unexpected or duplicate legal layout');
      expectedByConfig.delete(configKey);
      assert.equal(loss, reference.loss);
      assert.equal(cost, reference.cost);
      const gain = baseline - loss;
      return [{lowerCost: cost, upperGain: gain, row: {config: build.config, cost, loss, gain, tunes}}];
    },
  });
  assert.equal(seen.size, reduced.length);
  assert.equal(expectedByConfig.size, 0);
  assert.deepEqual(fullLazy.proven, {maximum: true, minimum: true, balanced: true});
  assert.deepEqual(compact({...fullLazy, strongest: fullLazy.maximum}),
    compact(categories(reduced, baseline)));
  const fullMountSearch = {layouts: seen.size, visited: fullLazy.visited,
    elapsedMs: performance.now() - fullStart, proven: fullLazy.proven};
  console.log(JSON.stringify({mode, budget, baseline, calibratedLayoutsReplayed: reduced.length,
    fullyEnumeratedTuples: exhaustive.length, elapsedMs: performance.now() - start,
    full: categories(reduced, baseline), small, unrestrictedLazy, tighterLazy, fullMountSearch,
    certificateChecks: {
      small: checkSearch(exhaustive, baseline, budget, small),
      full: checkSearch(reduced, baseline, budget, categories(reduced, baseline)),
    }}, null, 2));
}


const edges = [
  {gain: 0, cost: 0},
  {gain: 1, cost: 0},
  {gain: 5, cost: 2},
  {gain: 10, cost: 9},
  {gain: 100, cost: 11},
].map(row => ({row, upperGain: row.gain, lowerCost: row.cost}));
const finish = searchCategories({upperGain: 100, lowerCost: 0}, {
  budget: 10, expand: () => edges,
});
assert.equal(finish.maximum.gain, 10);
assert.equal(finish.minimum.gain, 5);
assert.equal(finish.balanced.gain, 1);
assert.deepEqual(finish.proven, {maximum: true, minimum: true, balanced: true});
const stockOnly = searchCategories(edges[0], {budget: 0});
assert(stockOnly.proven.maximum);
assert.equal(stockOnly.minimum, null);
assert.equal(stockOnly.balanced, null);
