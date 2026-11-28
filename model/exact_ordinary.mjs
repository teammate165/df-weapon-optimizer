import {retainsFixedSlots} from './optimizer_mounts.mjs?v=9799ef2d762bb270';
import {compileMounts} from './scip_mount_model.mjs?v=9799ef2d762bb270';
import {createMountSearch} from './mount_search.mjs?v=9799ef2d762bb270';
import {createChoiceGroups} from './choice_groups.mjs?v=9799ef2d762bb270';
import {configKey} from './exhaustive_attachment_gate.mjs?v=9799ef2d762bb270';
import {createPatternConstraint, policy, shortfall, statIds} from './optimizer_policy.mjs?v=9799ef2d762bb270';
import {presets} from './optimizer_presets.mjs?v=9799ef2d762bb270';
import {timedRecoil} from './timed_recoil.mjs?v=9799ef2d762bb270';
import {createOrdinaryChartMemo, createOrdinaryControls, prepareOrdinaryBound} from './exact_ordinary_bounds.mjs?v=9799ef2d762bb270';
import {createExactOrdinaryMountBound} from './exact_ordinary_mount_bounds.mjs?v=9799ef2d762bb270';
import {createExactOrdinaryPhase, ordinaryBalancedMerit} from './exact_ordinary_phase.mjs?v=9799ef2d762bb270';
import {partitionExactMounts, restrictExactMountPartition, exactMountPartitionContains, validateExactMountPartitions} from './exact_ordinary_partitions.mjs?v=9799ef2d762bb270';

function stronger(a, b) {
  if (a.loss !== b.loss) return a.loss < b.loss;
  if (a.handling !== b.handling) return a.handling < b.handling;
  return (a.cost ?? 0) < (b.cost ?? 0);
}

function categories(archive, maximum) {
  let min, balanced;
  if (maximum.cost === null || maximum.score <= 0) return {Max: maximum};
  for (const row of archive.values()) {
    if (row.score >= 0.6 * maximum.score && (!min || row.cost < min.cost)) min = row;
  }
  if (!min || min === maximum) return {Max: maximum};
  const balancedMerit = ordinaryBalancedMerit(maximum, min);
  const merit = row => balancedMerit(row.score, row.cost);
  for (const row of archive.values()) {
    if (row.cost <= min.cost || row.cost >= maximum.cost || row.score <= min.score) continue;
    if (!balanced || merit(row) > merit(balanced) ||
        (merit(row) === merit(balanced) && stronger(row, balanced))) balanced = row;
  }
  return {Max: maximum, Balanced: balanced, Min: min};
}

function prepareExactOrdinary(input, modules, groupEquivalentPrices = false) {
  const {pack, request, shop, prices} = input;
  const {curves, kernel} = modules;
  const {mode, fixed = [], time_limit_seconds: limit = 30} = request;
  const settings = policy(request);
  if (settings.preset !== 'recoil' || !settings.automatic || request.validationConfig ||
      (request.budgets?.length ?? 1) !== 1) throw Error('Exact ordinary requires Lowest Recoil and one budget');
  if (!Number.isFinite(limit) || limit < 0 || limit > 1000 || (limit > 0 && limit < 1)) {
    throw Error('Exact ordinary search time must be 0 (unlimited) or 1–1000 seconds');
  }
  if (mode === 'bd' && request.budget !== undefined && request.budget > shop.weapons[pack.weaponId]?.gunsmithLimit) {
    throw Error('Attachment budget exceeds the weapon cap');
  }
  const resolve = config => curves.o(pack, config, mode);
  const scorer = presets.recoil.create({pack, request, ...modules, mode, resolve});
  const patternConstraint = createPatternConstraint(scorer, resolve, request, settings.patternReduction);
  const compiled = compileMounts(input, kernel);
  const groups = createChoiceGroups({pack, mode, shop, prices, kernel, curves, preset: scorer, fixed});
  groups.constrain(compiled, {preserveIdentities: true, preserveBundled: true});
  const restrictions = new Map();
  const locked = (path, item) => fixed.some(row => !row.keepDefault && row.slotPath === path && row.itemId === item);
  for (const player of compiled.players.values()) {
    if (typeof player.value === 'string' && groups.isTactical(player.path, player.item) && !locked(player.path, player.item)) {
      restrictions.set(player.value, 0);
    }
  }
  if (groupEquivalentPrices) for (const [variable, value] of groups.exactPriceRestrictions(compiled, request.config)) {
    restrictions.set(variable, value);
  }
  return {settings, mode, fixed, limit, resolve, scorer, patternConstraint, compiled, restrictions, locked};
}

export function planExactOrdinaryPartitions(input, modules, {workers = 4, jobs = workers, staged = false} = {}) {
  const {compiled, restrictions, patternConstraint} = prepareExactOrdinary(input, modules, staged);
  // Uncapped CI-19 has a disproportionately expensive barrel. Splitting by
  // stock spreads that barrel's work across the existing worker pool.
  const splitByStock = staged && !patternConstraint && input.pack.weaponId === '18010000038' && input.request.mode === 'bd';
  return partitionExactMounts(compiled, restrictions, workers, splitByStock ? '3' : undefined, jobs);
}

function ordinaryResult({input, modules, archive, maximum, scorer, patternConstraint, budget, solver, certified}) {
  const {pack, request} = input;
  const {mode} = request;
  const {exhausted} = solver;
  const scope = 'Ordinary attachment identities and all legal tuning positions under the modeled catalog rules';
  const results = maximum ? Object.entries(categories(archive, maximum)).filter(([, row]) => row)
    .map(([label, row]) => {
      const build = modules.curves.o(pack, row.config, mode);
      const raw = scorer.raw(build, row.tunes);
      const [loss, handling] = scorer.objectives(raw);
      if (loss !== row.loss || handling !== row.handling ||
          JSON.stringify(raw) !== JSON.stringify(row.components) ||
          (patternConstraint && raw.pattern > patternConstraint.maximum)) {
        throw Error('Exact ordinary result failed native score replay');
      }
      return {...row, label, budget, status: 'best_found',
        proof: (certified ? certified.has(label) : exhausted) ? 'Proven optimal' : 'Best found',
        recoil_path: timedRecoil(pack, build, row.tunes, request, modules)};
    }) : [{label: 'Max', status: exhausted ? 'not_found' : 'unresolved',
      reason: exhausted ? 'No qualifying build exists in the modeled ordinary domain.' : 'The deadline passed before a qualifying ordinary build was found.'}];
  solver.proven = Object.fromEntries([['maximum', 'Max'], ['minimum', 'Min'], ['balanced', 'Balanced']]
    .map(([key, label]) => [key, results.some(row => row.label === label && row.proof === 'Proven optimal')]));
  solver.infeasible = exhausted && !maximum;
  return {weapon_id: pack.weaponId, mode, preset: 'recoil', weights: scorer.weights, baseline: scorer.baseline,
    score_direction: 'higher', proof_scope: scope, pattern_constraint: patternConstraint, results, solver};
}

function mergeShards(partitions, shards, phase) {
  const seen = new Set();
  const archive = new Map();
  let maximum;
  const pruning = {};
  for (const shard of shards) {
    const partition = partitions.find(part => part.id === shard.partition_id);
    if (!partition || seen.has(shard.partition_id) || !Array.isArray(shard.price_archive) || shard.phase !== phase) {
      throw Error('Unexpected exact ordinary shard');
    }
    seen.add(shard.partition_id);
    for (const row of shard.price_archive) {
      if (!exactMountPartitionContains(partition, row.config)) throw Error('Witness outside its exact ordinary partition');
      if (!archive.has(row.cost) || stronger(row, archive.get(row.cost))) archive.set(row.cost, row);
      if (!maximum || stronger(row, maximum)) maximum = row;
    }
    for (const [key, value] of Object.entries(shard.solver.pruning)) {
      pruning[key] = (pruning[key] ?? 0) + value;
    }
  }
  const sum = key => shards.reduce((total, shard) => total + shard.solver[key], 0);
  const exhausted = seen.size === partitions.length && partitions.length > 0 && shards.every(shard => shard.solver.exhausted);
  const solver = {name: 'Exact ordinary', exhausted, workers: partitions.length, layouts: sum('layouts'), evaluated: sum('evaluated'), nodes: sum('nodes'),
    pruning, elapsed_ms: Math.max(0, ...shards.map(shard => shard.solver.elapsed_ms)),
    partitions: partitions.map(part => {
      const shard = shards.find(row => row.partition_id === part.id);
      return {...part, exhausted: shard?.solver.exhausted ?? false, layouts: shard?.solver.layouts,
        evaluated: shard?.solver.evaluated, nodes: shard?.solver.nodes, elapsed_ms: shard?.solver.elapsed_ms,
        calibration_ms: shard?.solver.calibration_ms, mount_pruning: shard?.solver.mount_pruning};
    })};
  return {archive, maximum, solver};
}

export function combineExactOrdinaryShards(partitions, shards, input, modules) {
  const {scorer, patternConstraint, compiled, restrictions} = prepareExactOrdinary(input, modules);
  validateExactMountPartitions(compiled, restrictions, partitions);
  return ordinaryResult({input, modules, ...mergeShards(partitions, shards),
    scorer, patternConstraint, budget: compiled.budget});
}

function useCI19Starts(input) {
  const {pack, request, solver_starts: starts} = input;
  return pack.weaponId === '18010000038' && request.mode === 'bd' &&
    starts?.weapon_id === pack.weaponId && Array.isArray(starts.ordinary_starts) &&
    !request.config?.length && !request.fixed?.length && !request.ammoItemId &&
    request.pattern_reduction_percent === undefined && !Object.keys(request.minimum_stats ?? {}).length;
}

function replayOrdinaryStarts(input, modules, compiled, restrictions, scorer) {
  if (!useCI19Starts(input)) return [];
  const {pack, request, shop, solver_starts} = input;
  const {curves, kernel} = modules;
  const {mode} = request;
  const search = createMountSearch(compiled);
  const decisions = [...compiled.players.values()].filter(player => typeof player.value === 'string');
  const result = [];
  for (const {config, tunes} of solver_starts.ordinary_starts) {
    try {
      const build = curves.o(pack, config, mode);
      if (configKey(build.config) !== configKey(config) || !retainsFixedSlots(build, fixed)) continue;
      const selected = new Set(config.map(row => row.slotPath + '|' + row.itemId));
      if (decisions.filter(player => selected.has(player.path + '|' + player.item)).length !== selected.size) continue;
      const candidate = new Map(restrictions);
      let excluded = false;
      for (const {path, item, value} of decisions) {
        const chosen = Number(selected.has(path + '|' + item));
        if (chosen && restrictions.get(value) === 0) {
          excluded = true;
          break;
        }
        candidate.set(value, chosen);
      }
      if (excluded || search.enumerate(candidate).next().done) continue;
      for (const [path, values] of Object.entries(tunes)) {
        const mounted = build.mounted.find(row => row.slotPath === path);
        if (!mounted) throw Error('Start tuning requires its attachment');
        for (const [id, value] of Object.entries(values)) {
          const control = curves.c(pack, mounted, id);
          if (!control || control.enabled === false || !curves.n(control).includes(value)) {
            throw Error('Start tuning is outside the native grid');
          }
        }
      }
      const cost = build.mounted.filter(row => row.source === 'equipped')
        .reduce((sum, row) => sum + shop.partCosts[row.itemId], 0);
      if (!Number.isFinite(cost) || cost > compiled.budget) continue;
      const state = kernel.u(pack, build, {mode, tacticalEffective: true, tunes});
      const components = scorer.raw(build, tunes, state);
      const [loss, handling] = scorer.objectives(components);
      if (!Number.isFinite(loss) || !Number.isFinite(handling)) continue;
      const stats = Object.fromEntries(Object.entries(statIds).map(([key, id]) => [key, state.numeric.mainAttr[id]]));
      result.push({cost, loss, handling, score: 100 - loss, components, stats,
        config: build.config, tunes, mounted: build.mounted});
    } catch {
      // A stale start can be skipped without affecting the search domain.
    }
  }
  return result;
}

function* exactOrdinaryPhases(partitions, input, modules) {
  const {scorer, patternConstraint, compiled, restrictions} = prepareExactOrdinary(input, modules, true);
  validateExactMountPartitions(compiled, restrictions, partitions);
  const archive = new Map();
  const certified = new Set();
  const phases = [];
  let maximum;
  for (const row of replayOrdinaryStarts(input, modules, compiled, restrictions, scorer)) {
    if (!archive.has(row.cost) || stronger(row, archive.get(row.cost))) archive.set(row.cost, row);
    if (!maximum || stronger(row, maximum)) maximum = row;
  }
  function* run(phase) {
    const merged = mergeShards(partitions, yield phase, phase.kind);
    phases.push({phase: phase.kind, ...merged.solver});
    for (const row of merged.archive.values()) {
      if (!archive.has(row.cost) || stronger(row, archive.get(row.cost))) archive.set(row.cost, row);
      if (!maximum || stronger(row, maximum)) maximum = row;
    }
    return merged.solver.exhausted;
  }
  let exhausted = yield* run({kind: 'maximum', incumbent: maximum});
  if (exhausted && maximum) {
    certified.add('Max');
    if (maximum.cost !== null && maximum.score > 0) {
      const originalMaximum = maximum;
      exhausted = yield* run({kind: 'minimum', maximum, incumbent: categories(archive, maximum).Min ?? maximum});
      if (maximum !== originalMaximum) throw Error('Minimum phase contradicted certified Maximum');
      if (exhausted) {
        certified.add('Min');
        const {Min: minimum, Balanced: incumbent} = categories(archive, maximum);
        if (minimum && maximum.score > minimum.score) {
          exhausted = yield* run({kind: 'balanced', maximum, minimum, incumbent});
          if (maximum !== originalMaximum || categories(archive, maximum).Min !== minimum) {
            throw Error('Balanced phase contradicted certified endpoints');
          }
          if (exhausted) certified.add('Balanced');
        }
      }
    }
  }
  const solver = {...phases.at(-1), exhausted, phases};
  for (const key of ['layouts', 'evaluated', 'nodes', 'elapsed_ms']) {
    solver[key] = phases.reduce((sum, row) => sum + row[key], 0);
  }
  solver.partitions = solver.partitions.map(part => ({
    ...part, exhausted: phases.every(phase => phase.partitions.find(row => row.id === part.id)?.exhausted),
  }));
  return ordinaryResult({input, modules, archive, maximum, scorer, patternConstraint, budget: compiled.budget, solver, certified});
}

export async function runExactOrdinaryPhases(partitions, execute, input, modules) {
  const phases = exactOrdinaryPhases(partitions, input, modules);
  let step = phases.next();
  while (!step.done) step = phases.next(await execute(step.value));
  return step.value;
}

export function advanceExactOrdinaryPhases(partitions, reports, input, modules) {
  const phases = exactOrdinaryPhases(partitions, input, modules);
  let step = phases.next();
  for (const shards of reports) {
    if (step.done) throw Error('Unexpected extra exact ordinary phase');
    step = phases.next(shards);
  }
  return step.done ? {result: step.value} : {phase: step.value};
}

export function solveExactOrdinary(input, modules, {
  pruneCalibration = true, pruneMounts = pruneCalibration, partition = null, collectArchive = false, deadlineEpochMs,
  sharedIncumbents, phase, diagnoseRootCuts = false,
} = {}) {
  if (phase && !collectArchive) throw Error('An ordinary phase requires a shard archive');
  const start = performance.now();
  const {pack, request, shop, prices} = input;
  const {curves, kernel} = modules;
  const {settings, mode, fixed, limit, resolve, scorer, patternConstraint, compiled, restrictions: baseRestrictions, locked} =
    prepareExactOrdinary(input, modules, Boolean(phase));
  const restrictions = restrictExactMountPartition(compiled, baseRestrictions, partition);
  const priorityPaths = [partition?.path, partition?.secondary_path].filter(Boolean);
  if (mode === 'bd' && !patternConstraint) {
    const ci19 = pack.weaponId === '18010000038';
    const aks74 = pack.weaponId === '18010000010';
    // Prioritize the high-impact recoil mounts before the optics choices.
    if ((phase?.kind === 'maximum' && (ci19 || aks74)) || (phase?.kind === 'balanced' && ci19)) {
      for (const path of ['2', '2/6', '1', '4/8', ci19 ? '2/47' : '1/43', '11']) {
        if (!priorityPaths.includes(path)) priorityPaths.push(path);
      }
    }
  }
  if (phase) {
    const affected = new Map();
    for (const {path, item, value} of compiled.players.values()) {
      if (typeof value !== 'string' || restrictions.get(value) === 0) continue;
      const part = pack.parts[item];
      const effects = pack.effectsByItemId?.[item]?.[mode] ??
        pack.effectSets?.[part?.effectSetIds?.[mode]]?.operations ?? [];
      const tunings = (part?.tuneIds ?? []).flatMap(id => pack.tunes[id]?.functions ?? []);
      const scored = effects.concat(tunings).some(({target}) =>
        /^(?:GRecoil_|GGunkick|AimingId\.RecoilId|FireInterval|GRateOfFire|WeaponMainAttribute\.MainAttrValues\.[36]$)/.test(target));
      if (scored) affected.set(path, (affected.get(path) ?? 0) + 1);
    }
    for (const [path] of [...affected].sort(([a, countA], [b, countB]) =>
      a.split('/').length - b.split('/').length || countB - countA || a.localeCompare(b))) {
      if (!priorityPaths.includes(path)) priorityPaths.push(path);
    }
  }
  const search = createMountSearch(compiled, {priorityPaths});
  const costs = mode === 'bd' ? shop.partCosts : prices;
  const archive = new Map();
  const deadline = deadlineEpochMs === undefined
    ? (limit === 0 ? Infinity : start + limit * 1000)
    : performance.now() + (deadlineEpochMs - Date.now());
  const timeout = Symbol('exact ordinary deadline');
  const tableCache = new Map();
  const orderingStart = phase?.kind === 'maximum' && useCI19Starts(input)
    ? input.solver_starts.starts?.filter(row => row.preset === 'recoil' && row.source_mode === mode)
      .reduce((best, row) => (!best || row.config.length > best.config.length) ? row : best, null)
    : null;
  const orderingRequest = orderingStart ? {...request, config: orderingStart.config, tunes: orderingStart.tunes} : request;
  const controlsFor = createOrdinaryControls(pack, orderingRequest, curves);
  const pruning = {bounded_layouts: 0, fallback_layouts: 0, pattern_cuts: 0, loss_cuts: 0,
    root_pattern_cuts: 0, root_loss_cuts: 0,
    invariant_controls: 0, handling_controls: 0, chart_memo_hits: 0, chart_memo_misses: 0,
    pattern_program_cuts: 0, max_program_cuts: 0};
  if (diagnoseRootCuts) pruning.root_loss_cuts_without_kick = 0;
  const memoChart = phase ? createOrdinaryChartMemo(pruning) : undefined;
  const rejectedPatterns = new Set();
  const rejectedMaximum = new Map();
  let calibrationMs = 0;
  let maximum, evaluated = 0, layouts = 0, nodes = 0, lastProgress = start, exhausted = false;
  const maximumPhase = phase?.kind === 'maximum';
  const maximumLoss = () => Math.min(maximum?.loss ?? Infinity, sharedIncumbents?.lossAt(null) ?? Infinity);
  const lossAt = cost => Math.min(archive.get(cost)?.loss ?? Infinity, sharedIncumbents?.lossAt(cost) ?? Infinity);
  const stage = phase && createExactOrdinaryPhase(phase, compiled.budget, () => sharedIncumbents?.lossAt(null) ?? Infinity);
  const mountBound = pruneMounts ? createExactOrdinaryMountBound({pack, request, compiled, modules, scorer, patternConstraint,
    getIncumbentLoss: stage ? undefined : () => lossAt(null), getPriceLoss: stage ? undefined : lossAt,
    phaseCut: stage?.mountCut, finiteKick: maximumPhase || (phase?.kind === 'balanced' && !patternConstraint)}) : null;
  const checkpoint = () => {
    input.signal?.throwIfAborted();
    const now = performance.now();
    if (now >= deadline) throw timeout;
    if (now - lastProgress < 250) return;
    lastProgress = now;
    input.onProgress?.({phase: 'exact_ordinary', category: phase?.kind, evaluated, tree_nodes: nodes, candidates: archive.size,
      calibration_evaluations: evaluated, best_loss: maximum?.loss, scored_per_second: evaluated * 1000 / (now - start)});
  };
  const referenceConfig = new Map((orderingRequest.config ?? []).map(row => [row.slotPath, row.itemId]));
  const seed = new Map();
  for (const player of compiled.players.values()) {
    if (typeof player.value !== 'string') continue;
    seed.set(player.value, Number(restrictions.get(player.value) !== 0 &&
      (locked(player.path, player.item) || referenceConfig.get(player.path) === player.item)));
  }
  const scoreLayout = (config, seedOnly = false) => {
    const build = resolve(config);
    if (configKey(config) !== configKey(build.config) || !retainsFixedSlots(build, fixed)) {
      throw Error('Ordinary mount model and native resolver disagree');
    }
    const cost = mode === 'mp' ? null : build.mounted.filter(row => row.source === 'equipped')
      .reduce((total, row) => total + costs[row.itemId], 0);
    if (cost !== null && (!Number.isFinite(cost) || cost > compiled.budget + 1e-8)) {
      throw Error('Ordinary mount model and native price disagree');
    }
    if (stage && !stage.eligibleCost(cost)) return;
    const controls = controlsFor(build, seedOnly);
    if (tableCache.size >= 2048) tableCache.clear();
    let bound = !seedOnly && controls.length && pruneCalibration
      ? prepareOrdinaryBound({pack, build, mode, controls, modules, scorer, tableCache, memoChart,
        firing: request.firing}) : null;
    if (bound) pruning.bounded_layouts++;
    else if (!seedOnly && controls.length) pruning.fallback_layouts++;
    const cut = (kickNode, root = false) => {
      if (!bound) return false;
      checkpoint();
      try {
        const pattern = bound.patternLower();
        if (patternConstraint && pattern > patternConstraint.maximum) {
          pruning.pattern_cuts++;
          if (root) pruning.root_pattern_cuts++;
          return true;
        }
        const incumbent = maximumPhase ? maximumLoss() : lossAt(cost);
        if (stage || Number.isFinite(incumbent)) {
          const lower = bound.lossLower(pattern, kickNode?.minimum);
          if (lower > incumbent || stage?.layoutCut(lower, cost)) {
            pruning.loss_cuts++;
            if (root) {
              pruning.root_loss_cuts++;
              if (diagnoseRootCuts) {
                const withoutKick = bound.lossLower(pattern, 0);
                if (withoutKick > incumbent || stage?.layoutCut(withoutKick, cost)) {
                  pruning.root_loss_cuts_without_kick++;
                }
              }
            }
            return true;
          }
        }
      } catch {
        bound = null;
      }
      return false;
    };
    if (cut(undefined, true)) return;
    const patternProgram = phase && patternConstraint && bound ? bound.patternProgramKey() : undefined;
    if (patternProgram !== undefined && rejectedPatterns.has(patternProgram)) {
      pruning.pattern_program_cuts++;
      return;
    }
    const lossProgram = maximumPhase && bound ? bound.lossProgramKey() : undefined;
    const previousCutoff = rejectedMaximum.get(lossProgram);
    if (previousCutoff !== undefined && maximumLoss() <= previousCutoff) {
      pruning.max_program_cuts++;
      return;
    }
    if (bound) {
      const {inert, handlingPositions, kick} = bound;
      pruning.invariant_controls += inert.size;
      for (const index of inert) controls[index].positions = controls[index].positions.slice(0, 1);
      pruning.handling_controls += handlingPositions.size;
      for (const [index, value] of handlingPositions) controls[index].positions = [value];
      if (kick) {
        const {indices} = kick;
        controls.sort((a, b) => Number(indices.has(a.index)) - Number(indices.has(b.index)));
      }
    }
    const tunes = {};
    const score = () => {
      checkpoint();
      evaluated++;
      const state = kernel.u(pack, build, {mode, tacticalEffective: true, tunes});
      const stats = Object.fromEntries(Object.entries(statIds).map(([key, id]) => [key, state.numeric.mainAttr[id]]));
      if (shortfall(stats, settings.minimums) > 1e-8) return;
      const components = scorer.raw(build, tunes, state, bound?.project);
      if (patternConstraint && components.pattern > patternConstraint.maximum) return;
      const [loss, handling] = scorer.objectives(components);
      if (!Number.isFinite(loss) || !Number.isFinite(handling)) throw Error('Nonfinite ordinary objective');
      const row = {cost, loss, handling, score: 100 - loss};
      if (stage && !stage.eligibleScore(row.score)) return;
      if (archive.has(cost) && !stronger(row, archive.get(cost))) return;
      Object.assign(row, {stats, components, config: build.config, tunes: structuredClone(tunes),
        mounted: build.mounted});
      archive.set(cost, row);
      stage?.observe(row);
      sharedIncumbents?.publish(cost, loss);
      if (phase?.kind === 'maximum') sharedIncumbents?.publish(null, loss);
      if (!maximum || stronger(row, maximum)) maximum = row;
    };
    const visit = (depth, kickNode) => {
      if (depth === controls.length) return score();
      const {path, id, index, positions} = controls[depth];
      const values = tunes[path] ??= {};
      const axisIndex = bound?.byIndex.get(index);
      if (axisIndex === undefined) {
        const kick = bound?.kick;
        const kickControl = kick?.indices.has(index);
        const children = kickControl ? kickNode?.children : undefined;
        for (let offset = 0; offset < positions.length; offset++) {
          const child = children?.[offset] ?? (kickControl ? kick.select?.(index, offset) : undefined);
          if (child && cut(child)) continue;
          values[id] = positions[offset];
          visit(depth + 1, child ?? kickNode);
        }
        return;
      }
      const box = bound.box;
      const visitRange = (lo, hi) => {
        box[axisIndex] = [lo, hi];
        if (cut()) return;
        if (lo === hi) {
          values[id] = positions[lo];
          visit(depth + 1, kickNode);
          return;
        }
        const middle = (lo + hi) >> 1;
        visitRange(lo, middle);
        visitRange(middle + 1, hi);
      };
      visitRange(0, positions.length - 1);
      box[axisIndex] = [0, positions.length - 1];
    };
    const previousEvaluated = evaluated;
    const previousLossCuts = pruning.loss_cuts;
    const previousPatternCuts = pruning.pattern_cuts;
    visit(0, bound?.kick?.root);
    if (patternProgram !== undefined && bound && evaluated === previousEvaluated &&
        pruning.loss_cuts === previousLossCuts && pruning.pattern_cuts - previousPatternCuts >= 16) {
      // Every rejected range was excluded by the fixed cap. The exact axis
      // program and chart are sufficient to replay that exclusion elsewhere.
      if (rejectedPatterns.size >= 1024) rejectedPatterns.delete(rejectedPatterns.values().next().value);
      rejectedPatterns.add(patternProgram);
    }
    if (lossProgram !== undefined && bound && evaluated === previousEvaluated &&
        pruning.loss_cuts > previousLossCuts &&
        pruning.loss_cuts - previousLossCuts + pruning.pattern_cuts - previousPatternCuts >= 16) {
      // The Max cutoff is nonincreasing. A cutoff at least this strict
      // suffices to repeat every loss cut made during this traversal.
      if (rejectedMaximum.size >= 1024) rejectedMaximum.delete(rejectedMaximum.keys().next().value);
      rejectedMaximum.set(lossProgram, maximumLoss());
    }
  };
  const tick = () => { nodes++; checkpoint(); };
  try {
    for (const config of search.enumerate(seed, tick)) {
      if (exactMountPartitionContains(partition, config)) scoreLayout(config, true);
    }
    for (const config of search.enumerate(restrictions, tick, {
      priority: (path, item) => referenceConfig.get(path) === item ? -1 : item === null ? 0 : 1,
      prune: stage ? branch => stage.costCut(branch) || mountBound?.prune(branch) : mountBound?.prune,
      priceBudget: stage?.priceBudget ?? mountBound?.priceBudget,
      priceCeiling: stage?.priceCeiling,
      stats: stage?.priceCeiling ? pruning : undefined,
      pruneLeaves: Boolean(stage),
    })) {
      const layoutStart = performance.now();
      try {
        scoreLayout(config);
      } finally {
        calibrationMs += performance.now() - layoutStart;
      }
      layouts++;
    }
    checkpoint();
    exhausted = true;
  } catch (error) {
    if (error !== timeout) throw error;
  }
  const mountPruning = mountBound?.getStats();
  const solver = {name: 'Exact ordinary', exhausted, layouts, evaluated, nodes, pruning,
    mount_pruning: mountPruning, calibration_ms: calibrationMs, elapsed_ms: performance.now() - start};
  if (collectArchive) return {partition_id: partition?.id ?? 0, price_archive: [...archive.values()], solver,
    ...(phase ? {phase: phase.kind} : {})};
  return ordinaryResult({input, modules, archive, maximum, scorer,
    patternConstraint, budget: compiled.budget, solver});
}
