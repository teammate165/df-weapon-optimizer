import assert from 'node:assert/strict';
import {compileMounts} from '../../tools/scip_mount_model.mjs';
import {createMountSearch} from '../../tools/mount_search.mjs';
import {createChoiceGroups} from '../../tools/choice_groups.mjs';
import {pack, shop, mode, modules, createChartPreset} from './m4-chart-axis-boxes.mjs';
import {deterministicNorm} from './deterministic-norm.mjs';

const fixed = [{slotPath: '11', itemId: '13110000091'}];
const budget = 800;
const {kernel, curves} = modules;
const preset = createChartPreset(deterministicNorm);
const groups = createChoiceGroups({pack, shop, mode, preset, ...modules, fixed});
const compiled = compileMounts({pack, shop, request: {mode, budget, fixed}}, kernel);
groups.constrain(compiled);
const restrictions = new Map([...compiled.players.values()]
  .filter(part => typeof part.value === 'string' && groups.isTactical(part.path, part.item))
  .map(part => [part.value, 0]));
const oracleStart = performance.now();
const mountCount = createMountSearch(compiled).count(restrictions);
const mountCountMs = performance.now() - oracleStart;
assert.equal(mountCount.total, 12268642n);

const collector = kernel.u.screeningStateContract;
const axes = new Set(['GRecoil_H', 'GRecoil_V']);
const currentlyIrrelevant = new Set(['GBreathScale', 'GAiming_ADSTime']);
const otherNonScoring = new Set(['AimMoveGunSway', 'GBullet_Velocity', 'GMovement_ADSSpeed',
  'ScopeCameraTuneDistance', 'ScopeZoomTuneRate']);
const gunKick = new Set(['GGunkickRandom', 'GGunkickSpring']);
const timing = new Set(['FireInterval', 'GRateOfFire', 'FireRateMode', 'FireCD',
  'FireDelayTime', 'ChamberTime']);
const contexts = new Map();
for (const group of compiled.groups) for (const slot of group.slots) {
  const authorized = new Set(groups.options(slot.options, slot.path));
  const lock = fixed.find(row => row.slotPath === slot.path);
  for (const node of slot.nodes) {
    if (node.active === 0 || (lock && lock.itemId !== node.item)) continue;
    const selectable = slot.options.includes(node.item);
    if (selectable && (!authorized.has(node.item) || groups.isTactical(node.path, node.item))) continue;
    const mounted = {itemId: node.item, slotPath: node.path, socketId: Number(node.socketId),
      hostItemId: node.host, source: selectable ? 'equipped' : 'default'};
    contexts.set(JSON.stringify([node.path, node.host, node.item]), mounted);
  }
}
const timingWriters = new Map(), profileWriters = new Map(), controlClasses = new Map();
const effectsOutsideGuard = new Map();
let activeControls = 0, projectedControls = 0, projectedPositions = 0;
function save(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
for (const mounted of contexts.values()) {
  const context = {path: mounted.slotPath, item: mounted.itemId, host: mounted.hostItemId};
  const {operations} = collector.collect(pack, {mounted: [mounted]},
    {mode, tacticalEffective: true, tunes: {}, includeAmmo: false, ammoItemId: null});
  for (const operation of operations.filter(op => op.sourceKind === 'part')) {
    if (operation.operation === 'StaticAttributeReplace' && operation.target === 'AimingId.RecoilId') {
      save(profileWriters, String(operation.value), context);
    }
    for (const target of collector.numeric(pack, [operation]).buckets.keys()) {
      if (timing.has(target)) save(timingWriters, mounted.itemId, {...context, target});
    }
  }
  for (const id of pack.parts[mounted.itemId]?.tuneIds ?? []) {
    const control = curves.c(pack, mounted, id);
    if (!control || control.enabled === false) continue;
    activeControls++;
    const functions = control.functions ?? [];
    const axisGuard = [...axes].every(target => functions.filter(f => f.target === target).length === 1) &&
      functions.every(f => f.modifier === 'Mult_A' && (axes.has(f.target) || currentlyIrrelevant.has(f.target)));
    const visible = functions.filter(f => !currentlyIrrelevant.has(f.target) && !otherNonScoring.has(f.target));
    const kind = axisGuard ? 'shared-axis control' : !visible.length ? 'non-objective targets only' :
      visible.every(f => gunKick.has(f.target)) ? 'gun-kick control' : 'other score-affecting control';
    save(controlClasses, kind, {...context, id, positions: curves.n(control).length});
    if (kind === 'non-objective targets only') {
      for (const position of curves.n(control)) {
        const collected = collector.collect(pack, {mounted: [mounted]}, {
          mode, tacticalEffective: true, tunes: {[mounted.slotPath]: {[id]: position}},
          includeAmmo: false, ammoItemId: null,
        }).operations.filter(op => op.sourceTuneId === id);
        assert(collected.every(op => op.operation === 'StaticAttributeModify' &&
          op.scope === 'NONE' && Number.isFinite(op.value)));
        for (const target of collector.numeric(pack, collected).buckets.keys()) {
          assert(currentlyIrrelevant.has(target) || otherNonScoring.has(target));
        }
        projectedPositions++;
      }
      projectedControls++;
    }
    if (kind !== 'shared-axis control') {
      for (const f of functions) save(effectsOutsideGuard, f.target + '/' + f.modifier, {...context, id});
    }
  }
}
function counts(map) {
  return Object.fromEntries([...map].map(([key, rows]) => [key, {contexts: rows.length, examples: rows.slice(0, 3)}]));
}
console.log(JSON.stringify({weapon: pack.weaponId, mode, budget, fixed, ordinaryLayouts: String(mountCount.total),
  mountCountMs, mountStats: mountCount.stats, inspectedProviderContexts: contexts.size,
  paths: [...new Set([...contexts.values()].map(row => row.slotPath))].sort(),
  activeControls, projectedControls, projectedPositions, controlClasses: counts(controlClasses), timingWriters: counts(timingWriters),
  profileWriters: counts(profileWriters), effectsOutsideGuard: counts(effectsOutsideGuard)}, null, 2));
