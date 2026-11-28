import {assert} from './chart-fixture-runtime.mjs?v=f14ddb691f1b06d1';

const point = value => [value, value];
const staticTypes = new Set(['StaticAttributeModify', 'StaticAttributeReplace']);
const ignoredTuneTargets = new Set(['GBreathScale', 'GAiming_ADSTime']);
const cachedRanges = new WeakMap();
const tableIds = new WeakMap();
let nextTableId = 0;

function tableRange(table, axis, lo, hi, memoize) {
  let lower = table[lo][axis], upper = lower;
  if (lo === hi) return point(lower);
  let ranges, key;
  if (memoize) {
    ranges = cachedRanges.get(table);
    if (!ranges) cachedRanges.set(table, ranges = new Map());
    key = (axis * table.length + lo) * table.length + hi;
    const known = ranges.get(key);
    if (known) return known;
  }
  for (let index = lo + 1; index <= hi; index++) {
    const value = table[index][axis];
    lower = Math.min(lower, value);
    upper = Math.max(upper, value);
  }
  const result = [lower, upper];
  if (ranges && ranges.size < 512) ranges.set(key, result);
  return result;
}

export function createOrderedAxisIntervals({pack, build, mode, controls, fixed, axes, kernel, cache = null, ignoredTargets = ignoredTuneTargets, fallback = axis => fixed.baseTargets[axis]}) {
  const collector = kernel.u.screeningStateContract;
  assert(collector?.evaluate === kernel.u);
  const collect = (mounted, tunes) => collector.collect(pack, {mounted},
    {mode, tacticalEffective: true, tunes, includeAmmo: false, ammoItemId: null}).operations;

  const ids = new Map();
  const tunes = {};
  const tables = controls.map(({slotPath, id, positions}, index) => {
    const mounted = build.mounted.find(row => row.slotPath === slotPath);
    assert(mounted && !ids.has(id));
    ids.set(id, {index, itemId: mounted.itemId});
    const tableKey = cache ? JSON.stringify([mounted.itemId, mounted.slotPath, mounted.hostItemId,
      mounted.socketId, id, axes, positions]) : null;
    let rows = cache?.get(tableKey);
    if (!rows) rows = positions.map(position => {
      const operations = collect([mounted], {[slotPath]: {[id]: position}})
        .filter(op => op.sourceTuneId === id);
      for (const op of operations) {
        assert(op.operation === 'StaticAttributeModify' && op.scope === 'NONE' &&
          Number.isFinite(op.value) && (axes.includes(op.target)
            ? op.modifier === 'Mult_A' : ignoredTargets.has(op.target)));
      }
      return axes.map(axis => {
        const matches = operations.filter(op => op.target === axis);
        assert.equal(matches.length, 1);
        return matches[0].value;
      });
    });
    cache?.set(tableKey, rows);
    (tunes[slotPath] ??= {})[id] = positions[0];
    return rows;
  });

  function writes(op, axis) {
    if (!staticTypes.has(op.operation)) return 0;
    const main = /^WeaponMainAttribute\.MainAttrValues\.(\d+)$/.exec(op.target);
    const rule = main && (pack.attributeRules?.weaponOverrides?.[main[1]] ??
      pack.attributeRules?.defaults?.[main[1]]);
    const direct = rule?.curveMappings?.some(row => row.target === axis) ? 0 :
      (rule?.directRuleTargets ?? []).filter(target => target === axis).length;
    return Number(op.target === axis) + direct;
  }

  const operations = collect(build.mounted, tunes);
  const initialValues = axes.map(axis => Number(fallback(axis)) || 0);
  const plans = axes.map((axis, index) => {
    const program = [];
    const markers = new Set();
    for (const op of operations) {
      const count = writes(op, axis);
      if (!count) continue;
      const value = Number(op.value);
      if (op.sourceTuneId) {
        const control = ids.get(op.sourceTuneId);
        assert(control?.itemId === op.sourceItemId && count === 1 && op.modifier === 'Mult_A');
        assert(!markers.has(control.index) && value === tables[control.index][0][index]);
        markers.add(control.index);
        program.push({control: control.index, modifier: op.modifier});
      } else if (Number.isFinite(value)) {
        for (let i = 0; i < count; i++) program.push({modifier: op.modifier, value});
      }
    }
    assert.equal(markers.size, controls.length);
    const mappings = ['2', '3', '4', '5', '6'].flatMap(id => {
      const rule = pack.attributeRules?.weaponOverrides?.[id] ?? pack.attributeRules?.defaults?.[id];
      return (rule?.curveMappings ?? []).filter(map =>
        map.target === axis && pack.curves?.[map.curveIds?.[mode]]);
    });
    // The enabled tunings do not write any main attributes or references.
    // Consequently the already-computed native mapping is constant here.
    assert(mappings.length <= 1);
    if (mappings.length) {
      const type = mappings[0].mappingType;
      assert(type === 'DeltaMappingThenScale' || type === 'AbsoluteMapping');
      const value = fixed.mappedValues.get(axis);
      assert(Number.isFinite(value));
      program.push({modifier: type === 'AbsoluteMapping' ? 'Initial' : 'Mult_C', value});
    }
    return program;
  });

  // Only Mult_A has variable writers. Fold the other buckets once without
  // changing the source order of additions in the Mult_A bucket.
  const folds = plans.map((program, axis) => {
    let initial = initialValues[axis], addend = 0, multC = 1, prefix = 0;
    const terms = [];
    for (const op of program) {
      switch (op.modifier) {
        case 'Initial': case 'final': initial = op.value; break;
        case 'Addend': addend += op.value; break;
        case 'Mult_A':
          if (!terms.length && op.control === undefined) prefix += op.value;
          else terms.push(op);
          break;
        case 'Mult_C': multC *= op.value; break;
      }
    }
    return {base: initial + addend, multC, prefix, terms};
  });
  function orderedAxisRange(box, axis) {
    const {base, multC, prefix, terms} = folds[axis];
    let lower = prefix, upper = prefix;
    for (const {control, value} of terms) {
      if (control === undefined) {
        lower += value;
        upper += value;
      } else {
        const [lo, hi] = box[control];
        const range = tableRange(tables[control], axis, lo, hi, cache !== null);
        lower += range[0];
        upper += range[1];
      }
    }
    const a = (base * (1 + lower)) * multC;
    const b = (base * (1 + upper)) * multC;
    assert(Number.isFinite(a) && Number.isFinite(b));
    return [Math.min(a, b), Math.max(a, b)];
  }
  orderedAxisRange.minimizingPositions = (box, axis) => {
    const {base, multC} = folds[axis];
    if (base < 0 || multC < 0 || !orderedAxisRange(box, axis).every(Number.isFinite)) return null;
    return tables.map(rows => rows.reduce((best, row, index) =>
      row[axis] < rows[best][axis] ? index : best, 0));
  };
  // Encode the entire immutable ordered program, including the native
  // position tables and the sign of zero in the program's operands.
  orderedAxisRange.inputKey = () => JSON.stringify([initialValues, plans, tables],
    (_, value) => Object.is(value, -0) ? '-0' : value);
  orderedAxisRange.programKey = () => JSON.stringify([initialValues, plans, tables.map(table => {
    if (!tableIds.has(table)) tableIds.set(table, nextTableId++);
    return tableIds.get(table);
  })], (_, value) => Object.is(value, -0) ? '-0' : value);
  return orderedAxisRange;
}
