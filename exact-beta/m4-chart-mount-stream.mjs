import {assert} from './chart-fixture-runtime.mjs?v=67f0054380987872';
import {compileMounts} from '../model/scip_mount_model.mjs?v=67f0054380987872';
import {createMountSearch} from '../model/mount_search.mjs?v=67f0054380987872';
import {timedRecoil} from '../model/timed_recoil.mjs?v=67f0054380987872';
import {isOptic} from '../model/optimizer_mounts.mjs?v=67f0054380987872';
import {createChoiceGroups} from '../model/choice_groups.mjs?v=67f0054380987872';
import {activeControls, kickAxes, minimizeKick} from './m4-active-controls.mjs?v=67f0054380987872';
import {searchCategories} from './category-search.mjs?v=67f0054380987872';
import {deterministicNorm, deterministicNormFloor} from './deterministic-norm.mjs?v=67f0054380987872';
import {v8NormFloorFor} from './v8-norm-floor.mjs?v=67f0054380987872';
import {createCalibratedMountBound} from './m4-calibrated-mount-bound.mjs?v=67f0054380987872';
import {pack, shop, mode, resolve, modules, preset, stock, createChartPreset,
  split, createAxisContext} from './m4-chart-axis-boxes.mjs?v=67f0054380987872';

const paths = ['1', '3', '4/8', '2', '2/6'];
const tunedPaths = paths.slice(0, 3);
const variants = ['13020000173', '13130000169'];
const levels = [
  {name: 'reference', budget: 400, choices: [
    ['13030000109', '13030000110', '13030000113', '13030000114'],
    ['13040000104', '13040000106', '13040000108', '13040000179'],
    ['13140000024', '13140000027', '13140000028'],
    variants.slice(0, 1), variants.slice(1),
  ]},
  {name: 'expanded', budget: 800, limits: [6, 8, 9, 2, 3]},
  {name: 'tight-expanded', budget: 400, limits: [6, 8, 9, 2, 3]},
  {name: 'all-five-paths', budget: 800},
  {name: 'eight-paths', budget: 800, paths: [...paths, '11', '5', '5/44'],
    limits: [4, 4, 3, 2, 3, Infinity, Infinity, Infinity]},
  {name: 'optional-eight-paths', budget: 800, paths: [...paths, '11', '5', '5/44'],
    limits: [2, 2, 2, 2, 2, 4, 2, 1], variableControls: true},
  {name: 'full-ordinary', budget: 800, fullOrdinary: true, variableControls: true,
    fixed: [{slotPath: '11', itemId: '13110000091'}]},
  {name: 'optional-eight-wide', budget: 800, paths: [...paths, '11', '5', '5/44'],
    limits: [3, 3, 3, 2, 2, 6, 3, 1], variableControls: true},
];
function availableChoices(groups, fixturePaths) {
  const initial = resolve([]);
  return fixturePaths.map((path, index) => groups.options(initial.slots.find(slot => slot.slotPath === path).options, path)
    .filter(id => {
      if (path === '11') return isOptic(pack, id);
      if (index >= 3) return true;
      const build = resolve([{slotPath: path, itemId: id}]);
      const part = build.mounted.find(row => row.slotPath === path && row.itemId === id);
      return part && pack.parts[id]?.tuneIds.some(tune => {
        const control = modules.curves.c(pack, part, tune);
        return control && control.enabled !== false &&
          ['GRecoil_H', 'GRecoil_V'].every(target => control.functions.some(f => f.target === target));
      });
    }));
}
function resolveLevel(level, groups) {
  const fixturePaths = level.paths ?? paths;
  const available = level.choices ?
    level.choices.map((choices, i) => groups.options(choices, fixturePaths[i])) :
    availableChoices(groups, fixturePaths);
  const choices = level.limits ? available.map((list, i) => list.slice(0, level.limits[i])) : available;
  return {...level, paths: fixturePaths, choices};
}
export function mountStreamFixture(name) {
  const level = levels.find(level => level.name === name);
  assert(level);
  const groups = createChoiceGroups({pack, shop, mode, preset, ...modules});
  return {...resolveLevel(level, groups), tunedPaths: level.variableControls ? [] : tunedPaths};
}
function key(config) {
  return JSON.stringify(config.map(part => [part.slotPath, part.itemId]).sort());
}
function price(build) {
  return build.mounted.filter(part => part.source === 'equipped')
    .reduce((sum, part) => sum + (shop.partCosts[part.itemId] ?? Infinity), 0);
}

// Native timing primitives used by createRecoilScreeningBound. This
// research shortcut is checked against the complete chart preparation.
function prepareChart(state) {
  const {kernel, curves} = modules;
  const fireControl = pack.weapon.fireControl;
  const overrides = kernel.s(pack, state.appliedParts);
  const legacyFireRateMultiplier = overrides.reduce((rate, row) =>
    rate * (1 + (Number(row.override.baseStatModifiers?.fireRate) || 0)), 1);
  const rpm = kernel.r({baseFireIntervalSeconds: fireControl.fireIntervalSeconds,
    value: state.value, legacyFireRateMultiplier});
  const fc = kernel.n(pack, state.appliedParts, rpm / (60 / fireControl.fireIntervalSeconds),
    null, kernel.t(pack, state.value));
  assert(rpm > 0 && Number.isFinite(rpm) && fc.selectedFireMode === 'Auto');
  assert(!['unmodeled', 'modeOnly'].includes(fc.scheduleStatus));
  assert((fc.fireScheduleRules ?? []).every(rule =>
    ['firstShotsRpm', 'intervalScaleSequence', 'repeatedBurst'].includes(rule.mode)));
  const times = [0];
  const timeline = {...fc, fireRate: rpm};
  for (let shot = 2; shot <= 20; shot++) {
    const interval = curves.u(timeline, shot);
    assert(Number.isFinite(interval) && interval > 0);
    times.push(times.at(-1) + interval);
  }
  assert(times.at(-1) >= 200);
  return {times, fixedRaw: nativeFixedComponents(state)};
}
function nativeFixedComponents(state, norm = Math.hypot) {
  const behavior = pack.handling.weaponBehaviorProfiles?.[pack.weapon.references.weaponBehaviorProfileId];
  const camera = norm(state.value('GRecoil_HShake', 1), state.value('GRecoil_VShake', 1));
  const kick = norm(state.value('GGunkickRandom', behavior?.kickScales?.randomKickScale ?? 1),
    state.value('GGunkickSpring', behavior?.kickScales?.springKickScale ?? 1));
  return {camera, kick};
}
function chartFromManifest(state, manifest, norm) {
  assert(manifest.profileIds.includes(state.references.adsRecoilProfileId));
  const mask = manifest.timingItems.reduce((value, item, i) =>
    state.appliedParts.includes(item) ? value | (1 << i) : value, 0);
  return {times: manifest.timelines[mask], fixedRaw: nativeFixedComponents(state, norm)};
}


export function runMountStream({name = 'reference', batchSize = 64, reference = null,
  auditMounts = name !== 'all-five-paths', fast = false, auditPreparation = false,
  nodeLimit = Infinity, cachePreparation = false, budgetBound = false, gainBound = false, auditGain = false, nativeChartIntervals = false, nativeStatIntervals = false, nativeContexts = false, portableScore = false, normRuntime = null, deterministic = false, deterministicFloor = true, mountGainCuts = true,
  deadlineMs = Infinity, progress = null, seedRows = [], gainCacheOptions, priorityPaths = [],
  guaranteedMinimumBound = false, minimumShare = 0.5, balancedWindow, balancedSeed,
  partitionCount, partition, endpointArchive = false} = {}) {
  const scorer = deterministic ? createChartPreset(deterministicNorm) : preset;
  const baseline = scorer.score(scorer.baseline);
  const variableNormLower = deterministic && deterministicFloor ? deterministicNormFloor :
    normRuntime ? v8NormFloorFor(normRuntime) : null;
  assert(!deterministic || portableScore && !normRuntime);
  assert(!normRuntime || (portableScore && variableNormLower));
  assert(!portableScore || (gainBound && nativeContexts && nativeStatIntervals && nativeChartIntervals));
  assert(deadlineMs > 0);
  assert(Number.isSafeInteger(batchSize) && batchSize > 0);
  assert(!auditMounts || nodeLimit === Infinity);
  assert(!auditMounts || !gainBound);
  assert(!auditGain || (gainBound && nodeLimit === Infinity));
  const level = levels.find(level => level.name === name);
  assert(level);
  const fixed = level.fixed ?? [];
  const groups = createChoiceGroups({pack, shop, mode, preset: scorer, ...modules, fixed});
  assert(groups.enabled, 'Shared grouping requires the source state contract');
  const started = performance.now();
  const deadline = started + deadlineMs;
  const settings = level.fullOrdinary ? level : resolveLevel(level, groups);
  const {budget, choices, paths: fixturePaths = [], variableControls = false} = settings;
  const requiredPaths = variableControls ? [] : tunedPaths;
  assert(!variableControls || deterministic && portableScore);
  assert(!level.fullOrdinary || !auditGain && !auditMounts);
  const compiled = compileMounts({pack, shop, request: {mode, budget, fixed}}, modules.kernel);
  groups.constrain(compiled);
  const allowed = new Set(level.fullOrdinary ? compiled.groups.flatMap(group => group.slots.flatMap(slot =>
    groups.options(slot.options, slot.path).filter(item => {
      const lock = fixed.find(row => row.slotPath === slot.path);
      return lock ? lock.itemId === item : !groups.isTactical(slot.path, item);
    }).map(item => slot.path + '|' + item))) :
    fixturePaths.flatMap((path, i) => choices[i].map(item => path + '|' + item)));
  const mandatory = requiredPaths.map(path => {
    const alternatives = [...compiled.players].filter(([key, part]) =>
      part.path === path && allowed.has(key) && typeof part.value === 'string');
    assert(alternatives.length > 0);
    compiled.model.constrain(compiled.model.add(...alternatives.map(([, part]) => part.value)),
      '==', 1, 'fixture_required_control');
    return alternatives.map(([, part]) => part);
  });
  const restrictions = new Map([...compiled.players].flatMap(([key, part]) =>
    typeof part.value === 'string' && !allowed.has(key) ? [[part.value, 0]] : []));
  for (const lock of fixed) {
    const entry = compiled.players.get(lock.slotPath + '|' + lock.itemId);
    assert(typeof entry?.value === 'string');
    restrictions.set(entry.value, 1);
  }
  // Every mount picks at most one explicit barrel. Include the bundled/default
  // case as a separate alternative, then balance bins by exact layout counts.
  const barrelPath = '2';
  const barrelChoices = [...compiled.players.entries()].filter(([key, part]) =>
    part.path === barrelPath && allowed.has(key) && typeof part.value === 'string');
  if (partition) {
    assert(level.fullOrdinary);
    const selected = new Set(partition.items);
    assert(selected.size === partition.items.length);
    for (const [key, part] of barrelChoices) {
      if (!selected.has(key.split('|')[1])) restrictions.set(part.value, 0);
    }
    if (!selected.has(null)) {
      const values = barrelChoices.filter(([key]) => selected.has(key.split('|')[1])).map(([, part]) => part.value);
      assert(values.length > 0);
      compiled.model.constrain(compiled.model.add(...values), '==', 1, 'partition_barrel');
    }
  }
  const mountSearch = createMountSearch(compiled, {priorityPaths});
  const compileMs = performance.now() - started;
  const expectedMountCount = level.fullOrdinary ? String(mountSearch.count(restrictions).total) : null;
  if (level.fullOrdinary) assert.equal(expectedMountCount, partition ? String(partition.layouts) : '12268642');
  if (partitionCount) {
    assert(level.fullOrdinary && !partition && Number.isSafeInteger(partitionCount) && partitionCount > 0);
    const entries = [[null, null], ...barrelChoices.map(([key, part]) => [key.split('|')[1], part.value])];
    const weights = entries.map(([item, value]) => {
      const branch = new Map(restrictions);
      if (value === null) for (const [, part] of barrelChoices) branch.set(part.value, 0);
      else branch.set(value, 1);
      return {item, layouts: Number(mountSearch.count(branch).total)};
    });
    assert.equal(weights.reduce((sum, row) => sum + row.layouts, 0), Number(expectedMountCount));
    const partitions = Array.from({length: partitionCount}, () => ({items: [], layouts: 0}));
    for (const {item, layouts} of weights.sort((a, b) => b.layouts - a.layouts)) {
      const lightest = partitions.reduce((a, b) => a.layouts <= b.layouts ? a : b);
      lightest.items.push(item);
      lightest.layouts += layouts;
    }
    assert(partitions.every(row => row.layouts > 0));
    return partitions;
  }
  const inPartition = config => !partition || partition.items.includes(
    config.find(part => part.slotPath === barrelPath)?.itemId ?? null);
  const initialBuild = resolve(fixed);
  const initialCost = price(initialBuild);
  const initial = fixed.length ? {cost: initialCost,
    gain: baseline - scorer.score(scorer.raw(initialBuild, {})), config: initialBuild.config, tunes: {}} : stock;
  const seeds = seedRows.flatMap(row => {
    const config = [...row.config.filter(part => !fixed.some(lock => lock.slotPath === part.slotPath)), ...fixed];
    if (!inPartition(config)) return [];
    const build = resolve(config);
    if (price(build) > budget || key(build.config) !== key(config) ||
        key(groups.normalizeSights(build)) !== key(config)) return [];
    const selected = new Set(config.map(part => part.slotPath + '|' + part.itemId));
    if ([...selected].some(key => !allowed.has(key))) return [];
    const witness = new Map(restrictions);
    for (const [key, part] of compiled.players) {
      if (typeof part.value === 'string' && !restrictions.has(part.value)) {
        witness.set(part.value, selected.has(key) ? 1 : 0);
      }
    }
    if (mountSearch.count(witness).total !== 1n) return [];
    for (const [path, tunes] of Object.entries(row.tunes)) {
      const mounted = build.mounted.find(part => part.slotPath === path);
      if (!mounted) return [];
      for (const [id, value] of Object.entries(tunes)) {
        const control = modules.curves.c(pack, mounted, id);
        if (!control || control.enabled === false || !modules.curves.n(control).includes(value)) return [];
      }
    }
    return [{config: build.config, tunes: row.tunes, cost: price(build),
      gain: baseline - scorer.score(scorer.raw(build, row.tunes))}];
  });
  const mountStats = {};
  let mountNodes = 0;
  const purchases = [...compiled.players.values()].filter(part =>
    typeof part.value === 'string' && restrictions.get(part.value) !== 0);
  const optional = purchases.filter(part => !requiredPaths.includes(part.path));
  const maximumCostSum = purchases.reduce((sum, part) => sum + part.cost, 0);
  assert(Number.isSafeInteger(maximumCostSum) &&
    purchases.every(part => Number.isSafeInteger(part.cost) && part.cost >= 0));
  let budgetChecks = 0, budgetPrunes = 0, gainPrunes = 0;
  let calibratedBound, cannotImprove;
  const cutWitnesses = [];

  function pruneMount(branch) {
    const {interval} = branch;
    budgetChecks++;
    // Exactly one mandatory purchase per path. A completion must buy an
    // option that remains possible there, so it pays at least this minimum.
    let lower = level.fullOrdinary ? branch.selectedCost : 0;
    for (const options of mandatory) {
      let minimum = Infinity;
      for (const part of options) if (interval(part.value)[1]) {
        minimum = Math.min(minimum, part.cost);
      }
      lower += minimum;
    }
    // Optional purchases count only when already irrevocably selected.
    if (!level.fullOrdinary) for (const part of optional) if (interval(part.value)[0]) lower += part.cost;
    if (lower > budget) {
      budgetPrunes++;
      return true;
    }
    if (!gainBound) return false;
    calibratedBound ??= createCalibratedMountBound(compiled, interval, tunedPaths, allowed, nativeChartIntervals, nativeStatIntervals, nativeContexts, portableScore, variableNormLower, scorer, variableControls, gainCacheOptions) ?? false;
    if (!mountGainCuts) return false;
    const upperGain = calibratedBound ? calibratedBound.upperGain(branch) : Infinity;
    if (cannotImprove({lowerCost: lower, upperGain})) {
      if (auditGain) cutWitnesses.push({lower, upperGain,
        decisions: purchases.map(part => [part.path + '|' + part.item, ...interval(part.value)])});
      gainPrunes++;
      return true;
    }
    return false;
  }
  const stop = Symbol('mount deadline');
  let lastProgress = started;
  const layouts = mountSearch.enumerate(restrictions, () => {
    mountNodes++;
    if (mountNodes % 512) return;
    const now = performance.now();
    if (now >= deadline) throw stop;
    if (progress && now - lastProgress >= 5000) {
      progress({elapsedMs: now - started, mountNodes, prepared, gainPrunes, bounds, scores});
      lastProgress = now;
    }
  }, {
    stats: mountStats, prune: budgetBound || gainBound ? pruneMount : undefined,
  });
  let prepared = 0, bounds = 0, scores = 0, maxPreparedBatch = 0;
  let gridMass = 0n;
  let contextMs = 0, mountIterationMs = 0;
  const domainSize = level.fullOrdinary ? null : choices.reduce((n, list, i) => n * (list.length + (requiredPaths.includes(fixturePaths[i]) ? 0 : 1)), 1);
  const profiles = new Set(), schedules = new Set();
  const controlCounts = new Map();
  let kickNodes = 0;
  const cache = cachePreparation ? {controls: new Map(), geometry: new Map(), orderedTables: new Map()} : null;
  const identities = auditMounts || auditGain ? new Set() : null;
  const byGain = (a, b) => a.upperGain - b.upperGain;
  function bound(layout, box) {
    bounds++;
    return {layout, box, upperGain: layout.context.upperGain(box), lowerCost: layout.cost};
  }
  const unseen = {stream: true, upperGain: baseline, lowerCost: fixed.reduce((sum, lock) => sum + shop.partCosts[lock.itemId], 0)};
  function nextBatch() {
    const next = [];
    for (let i = 0; i < batchSize; i++) {
      const tick = performance.now();
      if (tick >= deadline) return [unseen, ...next.sort(byGain)];
      let item;
      try { item = layouts.next(); }
      catch (error) {
        if (error !== stop) throw error;
        return [unseen, ...next.sort(byGain)];
      }
      mountIterationMs += performance.now() - tick;
      if (item.done) return next.sort(byGain);
      const setup = performance.now();
      const build = resolve(item.value);
      const cost = price(build);
      assert.equal(key(build.config), key(item.value));
      assert(cost <= budget);
      assert.equal(key(groups.normalizeSights(build)), key(build.config));
      if (identities) {
        const id = key(build.config);
        assert(!identities.has(id));
        identities.add(id);
      }
      assert(!variableControls || calibratedBound?.contexts, 'Variable controls require a guarded native manifest');
      const selected = variableControls ?
        build.mounted.flatMap(mounted => activeControls(pack, mounted, modules.curves)) : null;
      const chartControls = selected?.filter(control =>
        control.axisTargets.length && control.axisTargets[0] !== kickAxes[0]) ?? null;
      const kickControls = selected?.filter(control => control.axisTargets[0] === kickAxes[0]) ?? [];
      const chart = portableScore
        ? (calibratedBound?.contexts ? state => {
          const context = chartFromManifest(state, calibratedBound.contexts, scorer.norm);
          if (!kickControls.length) return context;
          const kick = minimizeKick({pack, build, mode, controls: kickControls, fixed: state,
            kernel: modules.kernel, norm: scorer.norm, split, cache: cache?.orderedTables});
          kickNodes += kick.visited;
          return {...context, fixedRaw: {...context.fixedRaw, kick: kick.minimum}, kickTunes: kick.tunes};
        } : null)
        : (fast ? prepareChart : null);
      assert(!kickControls.length || chart, 'Kick controls require a covered chart context');
      const context = createAxisContext(build, tunedPaths, undefined, chart, cache, portableScore, scorer, chartControls);
      const dimensions = chartControls === null ? tunedPaths.length : chartControls.length + kickControls.length;
      controlCounts.set(dimensions, (controlCounts.get(dimensions) ?? 0) + 1);
      if (auditPreparation) {
        const native = createAxisContext(build, tunedPaths, undefined, null, null, portableScore, scorer, chartControls);
        assert.deepEqual(context.unit, native.unit);
        assert.equal(context.fixedRaw.camera, native.fixedRaw.camera);
        assert.deepEqual(context.calibrationTables, native.calibrationTables);
        if (variableControls) {
          const witness = context.tunesAt(context.full.map(([lo]) => lo));
          assert.equal(context.fixedRaw.kick, scorer.raw(build, witness).kick);
          const replay = timedRecoil(pack, build, witness, {mode, shot_count: 20}, modules,
            {abstractProfile: true});
          assert.deepEqual(replay.points.map(point => point.time_ms),
            context.unit.map(point => point.time_ms));
        } else {
          assert.equal(context.fixedRaw.kick, native.fixedRaw.kick);
          assert.equal(context.upperGain(context.full), native.upperGain(native.full));
        }
      }
      prepared++;
      contextMs += performance.now() - setup;
      gridMass += context.full.reduce((n, [, hi]) => n * BigInt(hi + 1), 1n) *
        kickControls.reduce((n, control) => n * BigInt(control.positions.length), 1n);
      profiles.add(context.fixed.references.adsRecoilProfileId);
      schedules.add(JSON.stringify(context.unit.map(point => point.time_ms)));
      next.push(bound({context, cost}, context.full));
      maxPreparedBatch = Math.max(maxPreparedBatch, next.length);
    }
    // Leave the unresolved mount stream on the frontier until the batch ends.
    return [unseen, ...next.sort(byGain)];
  }
  const solveStart = performance.now();
  const result = searchCategories({root: true, upperGain: baseline, lowerCost: 0}, {
    budget, nodeLimit, deadline, guaranteedMinimumBound, minimumShare, balancedWindow, balancedSeed, endpointArchive,
    expand(node, assessment) {
      cannotImprove = assessment.cannotImprove;
      if (node.root) return [unseen, ...[initial, ...seeds].filter(row => inPartition(row.config)).map(row =>
        ({row, upperGain: row.gain, lowerCost: row.cost}))];
      if (node.stream) return nextBatch();
      const {layout, box} = node;
      const children = split(box);
      if (children.length) return children.map(child => bound(layout, child)).sort(byGain);
      const {context, cost} = layout;
      const tunes = context.tunesAt(box.map(range => range[0]));
      const gain = baseline - scorer.score(scorer.raw(context.build, tunes));
      scores++;
      return [{row: {cost, gain, config: context.build.config, tunes},
        upperGain: gain, lowerCost: cost}];
    },
  });
  const solveMs = performance.now() - solveStart;
  const gridTuples = gridMass <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(gridMass) : String(gridMass);
  if (result.pending) {
    layouts.return();
    if (reference) {
      assert(result.bounds.upperGain >= reference.outputs.maximum.gain);
      assert(result.bounds.lowerCost <= reference.outputs.minimum.cost);
      const balanced = reference.outputs.balanced;
      assert(result.bounds.upperEfficiency >= balanced.gain / balanced.cost);
      if (result.minimum) assert(result.minimum.gain >= reference.outputs.maximum.gain * minimumShare);
      for (const key of ['maximum', 'minimum', 'balanced']) {
        if (!result.proven[key]) continue;
        assert.equal(result[key].gain, reference.outputs[key].gain);
        assert.equal(result[key].cost, reference.outputs[key].cost);
      }
    }
    return {name, prepared, pending: result.pending, nodes: result.visited, mountNodes, gainPrunes,
      expectedMountCount, priorityPaths, guaranteedMinimumBound, solveMs, elapsedMs: performance.now() - started, bounds, scores,
      outputs: {maximum: result.maximum, minimum: result.minimum, balanced: result.balanced},
      provisionalMinimum: result.provisionalMinimum, certificate: result.bounds, proven: result.proven,
      ...(endpointArchive ? {archive: result.archive} : {}),
      gainStats: calibratedBound ? calibratedBound.stats() : null,
      nativeContextManifest: calibratedBound?.contexts ?? null};
  }
  assert.equal(result.pending, 0);
  if (!balancedWindow && !endpointArchive) assert.deepEqual(result.proven, {maximum: true, minimum: true, balanced: true});
  if (!balancedWindow && !endpointArchive) assert(result.minimum.gain >= result.maximum.gain * minimumShare);
  const outputs = {maximum: result.maximum, minimum: result.minimum, balanced: result.balanced};
  if (reference) {
    if (!gainBound) {
      assert.equal(prepared, reference.prepared);
      assert.equal(gridTuples, reference.gridTuples);
    }
    for (const [key, row] of Object.entries(outputs)) {
      assert.equal(row.cost, reference.outputs[key].cost);
      assert.equal(row.gain, reference.outputs[key].gain);
    }
  }

  let audited = null, gainAudit = null;
  if (identities) {
    function* requests(index, config) {
      if (index === fixturePaths.length) {
        yield config;
        return;
      }
      if (!requiredPaths.includes(fixturePaths[index])) yield* requests(index + 1, config);
      for (const itemId of choices[index]) {
        yield* requests(index + 1, [...config, {slotPath: fixturePaths[index], itemId}]);
      }
    }
    let matched = 0;
    let omitted = 0, sampled = 0;
    for (const config of requests(0, [])) {
      const build = resolve(config);
      const id = key(config);
      if (key(build.config) !== id || price(build) > budget) continue;
      if (build.mounted.some(part => shop.hiddenItemIds.includes(part.itemId))) continue;
      if (key(groups.normalizeSights(build)) !== id) continue;
      if (identities.delete(id)) {
        matched++;
        continue;
      }
      assert(auditGain, 'Native layout missing from mount stream');
      const bought = new Set(config.map(part => part.slotPath + '|' + part.itemId));
      const cuts = cutWitnesses.filter(cut => cut.decisions.every(([key, lo, hi]) =>
        bought.has(key) ? hi === 1 : lo === 0));
      assert(cuts.length > 0, 'Missing cut for omitted layout');
      assert(cuts.every(cut => cut.lower <= price(build)));
      const sample = positions =>
        [0, 1, 2, 3, 4].map(i => positions[Math.round((positions.length - 1) * i / 4)]);
      const auditControls = variableControls
        ? build.mounted.flatMap(mounted => activeControls(pack, mounted, modules.curves))
          .filter(control => control.axisTargets.length)
        : createAxisContext(build, tunedPaths).calibrationTables;
      function replay(index, tunes) {
        if (index === auditControls.length) {
          const gain = baseline - scorer.score(scorer.raw(build, tunes));
          assert(cuts.every(cut => cut.upperGain >= gain), 'Cut missed a native gain');
          sampled++;
          return;
        }
        const {slotPath, id, positions} = auditControls[index];
        for (const position of sample(positions)) {
          replay(index + 1, {...tunes, [slotPath]: {...tunes[slotPath], [id]: position}});
        }
      }
      replay(0, {});
      omitted++;
    }
    assert.equal(identities.size, 0);
    audited = matched + omitted;
    if (auditGain) gainAudit = {omitted, sampled};
  }

  return {name, paths: fixturePaths, fullOrdinary: Boolean(level.fullOrdinary), expectedMountCount, priorityPaths, guaranteedMinimumBound, seedCount: seeds.length,
    elapsedMs: performance.now() - started, proven: result.proven, pending: result.pending, variableControls, controlCounts: Object.fromEntries(controlCounts), kickNodes, batchSize, fast, auditPreparation, budget, budgetBound, budgetChecks, budgetPrunes,
    gainBound, mountGainCuts, nativeChartIntervals, nativeStatIntervals, nativeContexts, portableScore, normRuntime, normVersion: scorer.normVersion, deterministicFloor: deterministic && deterministicFloor, nativeContextManifest: calibratedBound?.contexts ?? null, gainPrunes, gainAudit, gainStats: calibratedBound ? calibratedBound.stats() : null,
    envelopeCount: calibratedBound ? calibratedBound.envelopeCount : 0,
    cachePreparation, cacheEntries: cache ? {controls: cache.controls.size, geometry: cache.geometry.size} : null, choiceCounts: choices?.map(list => list.length) ?? null, domainSize,
    prepared, gridTuples, bounds, scores, nodes: result.visited, maxPreparedBatch,
    mountNodes, mountStats, compileMs, contextMs, mountIterationMs, solveMs, audited, certificate: result.bounds,
    ...(endpointArchive ? {archive: result.archive} : {}),
    profiles: profiles.size, schedules: schedules.size, grouping: groups.getStats(), outputs};
}
if (import.meta.main) {
  const flags = process.argv.slice(2);
  const names = flags.filter(arg => !arg.startsWith('--'));
  const batchSize = Number(flags.find(arg => arg.startsWith('--batch='))?.slice('--batch='.length) ?? 64);
  const runs = (names.length ? names : levels.map(level => level.name))
    .map(name => runMountStream({name, batchSize, fast: flags.includes('--fast'),
      auditPreparation: flags.includes('--audit-preparation'),
      cachePreparation: flags.includes('--cache-preparation'),
      budgetBound: flags.includes('--budget-bound'),
      gainBound: flags.includes('--gain-bound'),
      nativeChartIntervals: flags.includes('--native-chart-intervals') || flags.includes('--native-stat-intervals') || flags.includes('--native-contexts') || flags.includes('--portable-score'),
      nativeStatIntervals: flags.includes('--native-stat-intervals') || flags.includes('--native-contexts') || flags.includes('--portable-score'),
      nativeContexts: flags.includes('--native-contexts') || flags.includes('--portable-score'),
      portableScore: flags.includes('--portable-score'),
      auditGain: flags.includes('--audit-gain'),
      auditMounts: flags.includes('--audit-mounts') || (!flags.includes('--gain-bound') && name !== 'all-five-paths')}));
  console.log(JSON.stringify({runs}, null, 2));
}
