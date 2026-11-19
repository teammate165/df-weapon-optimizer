import {assert} from './chart-fixture-runtime.mjs?v=fee7ceeff9061201';

const point = value => [value, value];
function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function multiply(a, b) {
  const products = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]];
  return [Math.min(...products), Math.max(...products)];
}
const staticTypes = new Set(['StaticAttributeModify', 'StaticAttributeReplace']);
const ignoredTuneTargets = new Set(['GBreathScale', 'GAiming_ADSTime']);

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
      assert.equal(mappings[0].mappingType, 'DeltaMappingThenScale');
      const value = fixed.mappedValues.get(axis);
      assert(Number.isFinite(value));
      program.push({modifier: 'Mult_C', value});
    }
    return program;
  });

  return function orderedAxisRange(box, axis) {
    let initial = point(Number(fallback(axes[axis])) || 0);
    let addend = point(0), multA = point(0), multC = point(1);
    for (const op of plans[axis]) {
      let range;
      if (op.control !== undefined) {
        const [lo, hi] = box[op.control];
        const values = tables[op.control].slice(lo, hi + 1).map(row => row[axis]);
        range = [Math.min(...values), Math.max(...values)];
      } else {
        range = point(op.value);
      }
      switch (op.modifier) {
        case 'Initial': case 'final': initial = range; break;
        case 'Addend': addend = add(addend, range); break;
        case 'Mult_A': multA = add(multA, range); break;
        case 'Mult_C': multC = multiply(multC, range); break;
      }
    }
    const range = multiply(multiply(add(initial, addend), add(point(1), multA)), multC);
    assert(range.every(Number.isFinite));
    return range;
  };
}
