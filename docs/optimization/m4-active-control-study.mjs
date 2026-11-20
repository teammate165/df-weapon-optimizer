import {assert} from './chart-fixture-runtime.mjs';
import {mountStreamFixture, runMountStream} from './m4-chart-mount-stream.mjs';
import {activeControls, kickAxes, minimizeKick} from './m4-active-controls.mjs';
import {createChartPreset, pack, shop, mode, modules, resolve, split} from './m4-chart-axis-boxes.mjs';
import {deterministicNorm} from './deterministic-norm.mjs';

const options = {
  fast: true, cachePreparation: true, budgetBound: true, gainBound: true, nativeChartIntervals: true,
  nativeStatIntervals: true, nativeContexts: true, portableScore: true, deterministic: true, auditMounts: false,
};

const scorer = createChartPreset(deterministicNorm);
const costOf = build => build.mounted.filter(part => part.source === 'equipped')
  .reduce((sum, part) => sum + shop.partCosts[part.itemId], 0);
const identity = config => JSON.stringify(config.map(p => [p.slotPath, p.itemId]).sort());

function verifyKick() {
  const {paths, choices, budget} = mountStreamFixture('optional-eight-paths');
  const controlsByCount = new Map();
  const requests = paths.reduce((current, slotPath, index) => current.flatMap(config =>
    [null, ...choices[index]].map(itemId => itemId ? [...config, {slotPath, itemId}] : config)), [[]]);
  for (const config of requests) {
    const build = resolve(config);
    if (identity(build.config) !== identity(config) || costOf(build) > budget) continue;
    const controls = build.mounted.flatMap(mounted => activeControls(pack, mounted, modules.curves));
    const kick = controls.filter(control => control.axisTargets[0] === kickAxes[0]);
    const chart = controls.filter(control => control.axisTargets[0] === 'GRecoil_H');
    if (!kick.length) continue;
    const count = kick.length + '/' + chart.length;
    if (!controlsByCount.has(count)) controlsByCount.set(count, {build, kick, chart});
  }
  let kickTuples = 0, chartChecks = 0;
  const cache = new Map();
  const {kernel} = modules;
  const behavior = pack.handling.weaponBehaviorProfiles[pack.weapon.references.weaponBehaviorProfileId];
  const kickValue = state => scorer.norm(
    state.value(kickAxes[0], behavior?.kickScales?.randomKickScale ?? 1),
    state.value(kickAxes[1], behavior?.kickScales?.randomKickScale ?? 1));
  for (const {build, kick, chart} of controlsByCount.values()) {
    const evaluate = tunes => kernel.u(pack, build, {mode, tacticalEffective: true, tunes});
    const fixed = evaluate({});
    const chosen = minimizeKick({pack, build, mode, controls: kick, fixed, kernel, norm: scorer.norm, split, cache});
    let exact = Infinity;
    function visit(index, tunes) {
      if (index === kick.length) {
        exact = Math.min(exact, kickValue(evaluate(tunes)));
        kickTuples++;
        return;
      }
      const {slotPath, id, positions} = kick[index];
      for (const value of positions) {
        visit(index + 1, {...tunes, [slotPath]: {...tunes[slotPath], [id]: value}});
      }
    }
    visit(0, {});
    assert.equal(chosen.minimum, exact);
    for (const endpoint of [0, -1]) {
      let tunes = chosen.tunes;
      for (const {slotPath, id, positions} of chart) {
        tunes = {...tunes, [slotPath]: {...tunes[slotPath], [id]: positions.at(endpoint)}};
      }
      const raw = scorer.raw(build, tunes);
      assert.equal(raw.kick, exact);
      const onlyChart = Object.fromEntries(Object.entries(tunes).map(([path, controls]) =>
        [path, Object.fromEntries(Object.entries(controls).filter(([id]) => !kick.some(control => control.id === id)))]));
      const fixedKick = scorer.raw(build, onlyChart);
      for (const field of ['pattern', 'camera', 'horizontal_speed', 'horizontal_multiplier']) {
        assert.equal(raw[field], fixedKick[field]);
      }
      chartChecks++;
    }
  }
  assert(controlsByCount.size > 0 && kickTuples > 0);
  return {families: [...controlsByCount.keys()].sort(), kickTuples, chartChecks};
}

export function compareActiveControls({audit = true} = {}) {
  const runs = [];
  const kickAudit = audit ? verifyKick() : null;
  const baselineLoss = scorer.score(scorer.baseline);
  for (const name of ['optional-eight-paths', 'optional-eight-wide']) {
    const baseline = runMountStream({...options, name, mountGainCuts: false, auditGain: audit});
    const bounded = runMountStream({...options, name, reference: baseline});
    if (audit) assert.equal(baseline.audited, baseline.prepared);
    assert.equal(baseline.gainPrunes, 0);
    assert(bounded.gainPrunes > 0 && bounded.prepared < baseline.prepared && bounded.kickNodes > 0);
    assert(Object.keys(baseline.controlCounts).length > 3 && baseline.controlCounts[0] > 0);
    for (const category of ['maximum', 'minimum', 'balanced']) {
      assert.equal(bounded.outputs[category].cost, baseline.outputs[category].cost);
      assert.equal(bounded.outputs[category].gain, baseline.outputs[category].gain);
      for (const row of [baseline.outputs[category], bounded.outputs[category]]) {
        const build = resolve(row.config);
        assert.deepEqual(build.config, row.config);
        assert.equal(costOf(build), row.cost);
        for (const [path, tunes] of Object.entries(row.tunes)) {
          const mounted = build.mounted.find(part => part.slotPath === path);
          for (const [id, value] of Object.entries(tunes)) {
            const control = modules.curves.c(pack, mounted, id);
            assert(control.enabled !== false && modules.curves.n(control).includes(value));
          }
        }
        assert.equal(baselineLoss - scorer.score(scorer.raw(build, row.tunes)), row.gain);
      }
    }
    runs.push({name, baseline, bounded});
  }
  return {kickAudit, runs};
}
if (import.meta.main) console.log(JSON.stringify(compareActiveControls(), null, 2));
