import assert from 'node:assert/strict';
import {mountStreamFixture, runMountStream} from './m4-chart-mount-stream.mjs';
import {pack, shop, mode, modules, resolve, axisControlFor} from './m4-chart-axis-boxes.mjs';
import {timedRecoil} from '../../tools/timed_recoil.mjs';

const findings = [];
for (const name of ['reference', 'expanded']) {
  const settings = {name, fast: true, cachePreparation: true};
  const baseline = runMountStream(settings);
  const bounded = runMountStream({...settings, gainBound: true, nativeChartIntervals: true,
    nativeStatIntervals: true, nativeContexts: true, auditMounts: false, reference: baseline});
  const manifest = bounded.nativeContextManifest;
  assert(manifest);
  const {paths, choices, tunedPaths, budget} = mountStreamFixture(name);
  const request = {mode, shot_count: 20};
  const all = paths.reduce((rows, slotPath, i) => rows.flatMap(config =>
    [...(i < 3 ? [] : [null]), ...choices[i]].map(itemId =>
      itemId ? [...config, {slotPath, itemId}] : config)), [[]]);
  const key = config => JSON.stringify(config.map(part => [part.slotPath, part.itemId]).sort());
  const profiles = new Set(), schedules = new Set();
  let layouts = 0, nativeReplays = 0;
  for (const config of all) {
    const build = resolve(config);
    if (key(config) !== key(build.config)) continue;
    if (build.mounted.some(part => shop.hiddenItemIds.includes(part.itemId))) continue;
    const cost = build.mounted.filter(part => part.source === 'equipped').reduce((sum, part) =>
      sum + (shop.partCosts[part.itemId] ?? Infinity), 0);
    if (cost > budget) continue;
    const mask = manifest.timingItems.reduce((mask, item, i) =>
      mask | (build.mounted.some(part => part.itemId === item) ? 1 << i : 0), 0);
    const maximum = Object.fromEntries(tunedPaths.map(path => {
      const mounted = build.mounted.find(part => part.slotPath === path);
      const {id, control} = axisControlFor(mounted);
      return [path, {[id]: modules.curves.n(control).at(-1)}];
    }));
    for (const tunes of [{}, maximum]) {
      const native = timedRecoil(pack, build, tunes, request, modules, {abstractProfile: true});
      assert.equal(native.status, 'modeled');
      assert(manifest.profileIds.includes(native.recoil_profile_id));
      assert.deepEqual(native.points.map(point => point.time_ms), manifest.timelines[mask]);
      profiles.add(native.recoil_profile_id);
      schedules.add(mask);
      nativeReplays++;
    }
    layouts++;
  }
  assert.equal(layouts, baseline.prepared);
  assert.equal(profiles.size, manifest.profileIds.length);
  assert.equal(schedules.size, manifest.timelines.length);
  findings.push({name, layouts, nativeReplays, manifest, boundedPrepared: bounded.prepared,
    baseline: baseline.outputs, bounded: bounded.outputs});
}
console.log(JSON.stringify({findings}, null, 2));
