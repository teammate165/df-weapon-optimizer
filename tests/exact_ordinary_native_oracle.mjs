import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import { t as calculate } from '../.scratch/calibration-check/attributes.mjs';
import { combineExactOrdinaryShards, planExactOrdinaryPartitions, runExactOrdinaryPhases,
  solveExactOrdinary } from '../tools/exact_ordinary.mjs';
import { runExactOrdinaryNodePool } from '../tools/exact_ordinary_node_pool.mjs';
import { presets } from '../tools/optimizer_presets.mjs';

const [data, ...options] = process.argv.slice(2);
if (!data) throw Error('Pass a local Pages export data directory, optionally with --catalog or --full-budget-catalog');
const reportPath = options.find(option => !option.startsWith('--'));
const optionValue = (name, fallback) => options.find(option => option.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const runtime = new URL('../.scratch/calibration-check/', import.meta.url);

function read(path) {
  const bytes = readFileSync(path);
  const text = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8');
  return JSON.parse(text.replace(/^\uFEFF/, ''));
}

const { shop, prices, weapons } = read(join(data, 'catalog.json'));
const loadPack = id => read(join(data, 'weapons', id + '.json'));
const modules = { curves, kernel, calculate };
const targets = { control: '3', handling: '5', stability: '6', accuracy: '4' };
const compare = (a, b) => a.loss - b.loss || a.handling - b.handling || a.cost - b.cost;

function equipmentKey(config) {
  return JSON.stringify(config.map(({ slotPath, itemId }) => [slotPath, itemId]).sort());
}

function native(pack, request) {
  const mode = request.mode;
  const resolve = config => curves.o(pack, config, mode);
  const scorer = presets.recoil.create({ pack, request, ...modules, mode, resolve });
  const reference = scorer.raw(resolve(request.config ?? []), request.tunes ?? {}).pattern;
  const cap = request.pattern_reduction_percent === undefined
    ? Infinity : reference * (1 - request.pattern_reduction_percent / 100);
  const costs = mode === 'bd' ? shop.partCosts : prices;
  function score(config, tunes) {
    const build = resolve(config);
    assert.equal(equipmentKey(build.config), equipmentKey(config), 'Native mount identities changed on replay');
    for (const lock of request.fixed ?? []) {
      assert(build.mounted.some(row => row.slotPath === lock.slotPath && row.itemId === lock.itemId));
    }
    for (const [path, settings] of Object.entries(tunes)) {
      const attachment = build.mounted.find(row => row.slotPath === path);
      assert(attachment);
      for (const [id, value] of Object.entries(settings)) {
        const control = curves.c(pack, attachment, id);
        assert(control && control.enabled !== false && curves.n(control).includes(value),
          'Witness tuning position is outside the native grid');
      }
    }
    const cost = mode === 'mp' ? null : build.mounted
      .filter(row => row.source === 'equipped')
      .reduce((sum, row) => sum + costs[row.itemId], 0);
    assert(cost === null || Number.isFinite(cost));
    const state = kernel.u(pack, build, { mode, tacticalEffective: true, tunes });
    const stats = Object.fromEntries(Object.entries(targets).map(([key, id]) => [key, state.numeric.mainAttr[id]]));
    const components = scorer.raw(build, tunes, state);
    const [loss, handling] = scorer.objectives(components);
    const shortfall = Object.entries(request.minimum_stats ?? {})
      .reduce((sum, [key, minimum]) => sum + Math.max(0, minimum - stats[key]), 0);
    return { cost, loss, handling, gain: 100 - loss, components, stats,
      eligible: (cost === null || cost <= request.budget + 1e-8) && shortfall <= 1e-8 && components.pattern <= cap };
  }
  return { resolve, score, reference, cap };
}

function positions(control) {
  const all = curves.n(control);
  return [...new Set([all[0], all.find(value => value === control.range.defaultValue), all.at(-1)])]
    .filter(Number.isFinite);
}

// These fixtures expose only the explicit independent sockets listed below. All
// combinations are replayed through the native mount resolver before scoring.
function* selections(sockets, depth = 0, config = []) {
  if (depth === sockets.length) {
    yield config.slice();
    return;
  }
  const [slotPath, ...choices] = sockets[depth];
  yield* selections(sockets, depth + 1, config);
  for (const itemId of choices) {
    config.push({ slotPath, itemId });
    yield* selections(sockets, depth + 1, config);
    config.pop();
  }
}

function* tuneGrid(controls, index = 0, tuning = {}) {
  if (index === controls.length) {
    yield tuning;
    return;
  }
  const { path, id, control } = controls[index];
  for (const value of positions(control)) {
    (tuning[path] ??= {})[id] = value;
    yield* tuneGrid(controls, index + 1, tuning);
  }
}

function oracleCategories(rows) {
  const max = rows.slice().sort(compare)[0];
  if (!max) return new Map();
  const result = new Map([['Max', max]]);
  if (max.cost === null || max.gain <= 0) return result;
  const min = rows.filter(row => row.gain >= 0.6 * max.gain)
    .sort((a, b) => a.cost - b.cost || compare(a, b))[0];
  if (min.cost === max.cost) return result;
  result.set('Min', min);
  const slope = (max.gain - min.gain) / (max.cost - min.cost);
  const value = row => row.gain - min.gain - slope * (row.cost - min.cost);
  const balanced = rows.filter(row => row.cost > min.cost && row.cost < max.cost && row.gain > min.gain)
    .sort((a, b) => value(b) - value(a) || compare(a, b))[0];
  if (balanced) result.set('Balanced', balanced);
  return result;
}

function replay(row, model) {
  const exact = model.score(row.config, row.tunes);
  assert(exact.eligible, 'Generated witness violates the native budget, stat floors or pattern cap');
  assert.deepEqual([row.cost, row.loss, row.handling, row.score],
    [exact.cost, exact.loss, exact.handling, exact.gain]);
  assert.deepEqual(row.stats, exact.stats);
  assert.deepEqual(row.components, exact.components);
}

function verifyCertificate(result) {
  const { solver, results } = result;
  const phases = solver.phases ?? [{ exhausted: solver.exhausted, partitions: solver.partitions }];
  for (const phase of phases) {
    if (phase.exhausted) {
      assert(phase.partitions.length && phase.partitions.every(part => part.exhausted && !part.error),
        'Completed proof has an open or failed partition');
    }
  }
  if (solver.exhausted) assert(phases.length && phases.every(phase => phase.exhausted));
  const labels = { Max: 'maximum', Min: 'minimum', Balanced: 'balanced' };
  if (solver.phases) {
    const order = Object.values(labels);
    const indices = phases.map(({ phase }) => order.indexOf(phase));
    assert(indices[0] === 0 && indices.every((index, offset) => !offset || index > indices[offset - 1]),
      'Invalid proof phase order');
    for (const [index, phase] of phases.entries()) {
      if (index) assert(phases[index - 1].exhausted, 'Proof phase started before its prerequisite closed');
      if (phase.phase === 'balanced') assert.equal(phases[index - 1].phase, 'minimum');
      if (solver.proven[phase.phase]) assert(phase.exhausted, 'Proven result has an open phase');
    }
    for (const label of Object.values(labels)) {
      if (solver.proven[label]) assert(phases.some(phase => phase.phase === label));
    }
  }
  for (const row of results) {
    if (row.status === 'best_found') {
      assert(labels[row.label], 'Unknown result category');
      assert.equal(row.proof, solver.proven[labels[row.label]] ? 'Proven optimal' : 'Best found');
      if (!solver.phases && !solver.exhausted) assert.equal(row.proof, 'Best found');
      if (solver.exhausted) assert.equal(row.proof, 'Proven optimal');
    }
    if (row.label === 'Max' && row.status === 'not_found') assert(solver.exhausted || solver.infeasible);
  }
  if (solver.infeasible) assert(!results.some(row => row.status === 'best_found'));
}

const fixtures = [
  {
    id: '18010000038', mode: 'bd', budget: 2000, cap: 5,
    sockets: [['1', '13030000189'], ['3', '13040000110'], ['4/8', '13140000042']],
  },
  {
    id: '18010000001', mode: 'bd', budget: 280,
    sockets: [['1', '13030000109'], ['3', '13040000104', '13040000105'], ['4/8', '13140000021']],
    fixed: [{ slotPath: '1', itemId: '13030000109' }],
  },
  {
    id: '18010000052', mode: 'sol', budget: 30000, cap: 5,
    sockets: [['1', '13030000117'], ['4/8', '13140000021', '13140000023']],
    minimum_stats: { control: 40 },
  },
  {
    id: '18070000005', mode: 'mp', cap: 5,
    sockets: [['1', '13030000127', '13030000128'], ['2', '13020000456'], ['5', '13120000293']],
  },
  {
    id: '18040000003', mode: 'bd', cap: 5, budget: 40,
    sockets: [['1', '13030000109']],
  },
];

const report = [];
async function verifyFixture(fixture) {
  const { id, mode, budget, cap, sockets, fixed = [], minimum_stats } = fixture;
  const pack = loadPack(id);
  const allowed = new Set(sockets.flatMap(([, ...choices]) => choices));
  for (const [item, display] of Object.entries(pack.display.objects)) {
    if (!allowed.has(item)) display.playerSelectable = false;
  }
  const request = { mode, budget, time_limit_seconds: 0, fixed, minimum_stats, pattern_reduction_percent: cap };
  const model = native(pack, request);
  const rows = [];
  let layouts = 0;
  let evaluations = 0;
  const declaredSockets = new Set(sockets.flatMap(([path, ...choices]) => choices.map(item => path + '|' + item)));
  for (const config of selections(sockets)) {
    const build = model.resolve(config);
    for (const slot of build.slots) {
      for (const item of slot.options.filter(item => allowed.has(item))) {
        assert(declaredSockets.has(slot.slotPath + '|' + item), 'Fixture omitted a native socket choice');
      }
    }
    if (equipmentKey(config) !== equipmentKey(build.config)) continue;
    if (fixed.some(lock => !build.mounted.some(row => row.slotPath === lock.slotPath && row.itemId === lock.itemId))) continue;
    layouts++;
    const controls = build.mounted.flatMap(row => (pack.parts[row.itemId]?.tuneIds ?? []).flatMap(id => {
      const control = curves.c(pack, row, id);
      return control && control.enabled !== false ? [{ path: row.slotPath, id, control }] : [];
    }));
    for (const tunes of tuneGrid(controls)) {
      const exact = model.score(config, tunes);
      evaluations++;
      if (exact.eligible) rows.push(exact);
    }
  }
  const expected = oracleCategories(rows);
  const input = { pack, request, shop, prices };
  const runtime = { ...modules, curves: { ...curves, n: positions } };
  function verifyResult(result) {
    assert(result.solver.exhausted);
    const present = result.results.filter(row => row.status === 'best_found');
    assert.equal(present.length, expected.size,
      JSON.stringify({ id, mode, sockets, got: result.results, oracle: [...expected.entries()] }));
    for (const row of present) {
      const optimum = expected.get(row.label);
      assert(optimum, 'Unexpected generated category ' + row.label);
      assert.equal(row.proof, 'Proven optimal');
      assert.deepEqual([row.cost, row.loss, row.handling], [optimum.cost, optimum.loss, optimum.handling]);
      replay(row, model);
    }
    if (!expected.size) assert.equal(result.results[0].status, 'not_found');
  }
  verifyResult(solveExactOrdinary(input, runtime));
  if (options.includes('--staged-reduced')) {
    const partitions = planExactOrdinaryPartitions(input, runtime, { workers: 4, staged: true });
    const result = await runExactOrdinaryPhases(partitions, phase => partitions.map(partition =>
      solveExactOrdinary(input, runtime, { phase, partition, collectArchive: true })), input, runtime);
    verifyCertificate(result);
    verifyResult(result);
  }
  if (options.includes('--partitions')) {
    const parts = planExactOrdinaryPartitions(input, runtime, { workers: 4 });
    const shards = parts.map(partition => solveExactOrdinary(input, runtime, { partition, collectArchive: true }));
    verifyResult(combineExactOrdinaryShards(parts, shards, input, runtime));
    const partial = combineExactOrdinaryShards(parts, shards.slice(1), input, runtime);
    assert(!partial.solver.exhausted);
    assert(partial.results.every(row => row.proof !== 'Proven optimal' && row.status !== 'not_found'));
    for (const row of partial.results.filter(row => row.status === 'best_found')) replay(row, model);
  }
  return { id, mode, layouts, evaluations, eligible: rows.length, categories: [...expected.keys()] };
}

for (const fixture of fixtures) report.push(await verifyFixture(fixture));

if (options.includes('--staged-parity')) {
  const pack = loadPack('18010000001');
  const allowed = new Set(['13030000109', '13120000342', '13130000224', '13340000001']);
  for (const [part, display] of Object.entries(pack.display.objects)) {
    if (!allowed.has(part)) display.playerSelectable = false;
  }
  const request = { mode: 'bd', budget: 800, time_limit_seconds: 0,
    fixed: [{ slotPath: '2/6', itemId: '13130000224' }], minimum_stats: { control: 20 },
    pattern_reduction_percent: 5 };
  const input = { pack, request, shop, prices };
  const model = native(pack, request);
  const direct = solveExactOrdinary(input, modules, { pruneCalibration: false, pruneMounts: false });
  const staged = await runExactOrdinaryNodePool(input, modules, runtime, { workers: 4, staged: true });
  assert(direct.solver.exhausted && staged.solver.exhausted);
  verifyCertificate(staged);
  assert.deepEqual(staged.solver.phases.map(row => row.phase), ['maximum', 'minimum', 'balanced']);
  const objectives = rows => rows.map(({ label, cost, loss, handling }) => [label, cost, loss, handling]);
  assert.deepEqual(objectives(staged.results), objectives(direct.results));
  for (const row of staged.results) replay(row, model);
  const partitions = planExactOrdinaryPartitions(input, modules, { workers: 4, staged: true });
  const interrupted = await runExactOrdinaryPhases(partitions, phase => {
    const completed = phase.kind === 'balanced' ? partitions.slice(1) : partitions;
    return completed.map(partition => solveExactOrdinary(input, modules, { phase, partition, collectArchive: true }));
  }, input, modules);
  verifyCertificate(interrupted);
  assert(!interrupted.solver.exhausted);
  assert.deepEqual(interrupted.solver.proven, { maximum: true, minimum: true, balanced: false });
  for (const row of interrupted.results) replay(row, model);
  report.push({ staged_parity: { objectives: objectives(staged.results), partitions: partitions.length,
    phases: staged.solver.phases, interrupted: interrupted.solver.proven } });
}

if (options.includes('--catalog')) {
  const cases = [];
  let uncappedStock = 0;
  for (const { id } of weapons) {
    const pack = loadPack(id);
    for (const mode of ['bd', 'sol', 'mp']) {
      const cost = mode === 'bd' ? shop.partCosts : prices;
      const stock = curves.o(pack, [], mode);
      const eligible = (slot, item) => pack.display.objects[item]?.playerSelectable === true &&
        !pack.display.objects[item].selectionDisabledReason && !kernel.l(pack, item, mode) &&
        (mode === 'mp' || Number.isFinite(cost[item])) &&
        (mode !== 'bd' || cost[item] <= shop.weapons[id].gunsmithLimit && !shop.hiddenItemIds.includes(item)) &&
        !pack.assembly.socketProviders[item]?.sockets?.length &&
        stock.slots.every(other => other.slotPath === slot.slotPath || !other.options.includes(item));
      const slot = stock.slots.find(slot => ['1', '2', '3', '5'].includes(slot.slotPath) &&
        slot.options.some(item => eligible(slot, item)));
      const choice = slot?.options.find(item => eligible(slot, item));
      const budget = mode === 'bd' ? shop.weapons[id].gunsmithLimit : (cost[choice] ?? 0);
      cases.push(await verifyFixture({ id, mode, budget, cap: 5, sockets: slot ? [[slot.slotPath, choice]] : [] }));
      if (mode === 'mp') continue;
      const request = { mode, budget: 0, time_limit_seconds: 0 };
      const stockResult = solveExactOrdinary({ pack, request, shop, prices }, modules);
      assert(stockResult.solver.exhausted);
      assert(stockResult.results.some(row => row.status === 'best_found'), 'Missing uncapped stock for ' + id + ' ' + mode);
      for (const row of stockResult.results.filter(row => row.status === 'best_found')) replay(row, native(pack, request));
      uncappedStock++;
    }
  }
  report.push({ catalog: { cases: cases.length, uncappedStock, selections: cases.filter(row => row.layouts > 1).length,
    evaluations: cases.reduce((sum, row) => sum + row.evaluations, 0),
    feasible: cases.filter(row => row.eligible > 0).length, details: cases } });
}

// Run serial cases so each worker pool gets the machine's full time allowance.
// Detonation uses each weapon's cap, Operations uses the builder default unless
// specified, and Warfare has no price cap.
if (options.includes('--full-budget-catalog')) {
  const weapon = optionValue('weapon');
  const mode = optionValue('mode');
  const time_limit_seconds = Number(optionValue('seconds', '300'));
  const workers = Number(optionValue('workers', '4'));
  const jobs = Number(optionValue('partitions', workers));
  assert(Number.isSafeInteger(workers) && workers >= 1 && workers <= 16, 'Workers must be between 1 and 16');
  assert(Number.isSafeInteger(jobs) && jobs >= workers && jobs <= 128, 'Partitions must be between workers and 128');
  const operationsBudget = Number(optionValue('operations-budget', '300000'));
  const overridesPath = optionValue('request-overrides');
  const subtreeReference = optionValue('max-subtree-reference');
  const stock = optionValue('stock');
  const caseLog = optionValue('case-log');
  assert(time_limit_seconds === 0 ? weapon && mode :
    Number.isFinite(time_limit_seconds) && time_limit_seconds >= 1 && time_limit_seconds <= 1000,
  'Use 1–1000 seconds, or 0 for an unlimited single weapon and mode');
  assert(Number.isFinite(operationsBudget) && operationsBudget >= 0);
  assert(!mode || ['bd', 'sol', 'mp'].includes(mode));
  assert(!weapon || weapons.some(({ id }) => id === weapon), 'Unknown weapon ID');
  assert(!overridesPath || (weapon && mode), 'Request overrides require one weapon and mode');
  assert(!subtreeReference || (weapon && mode && options.includes('--staged')),
    'Max subtree timing requires one staged weapon and mode');
  const { config, tunes, fixed, minimum_stats, pattern_reduction_percent } = overridesPath ? read(overridesPath) : {};
  const cap = optionValue('pattern-cap', pattern_reduction_percent);
  const modes = mode ? [mode] : ['bd', 'sol', 'mp'];
  const cases = [];
  const selectedWeapons = weapons.filter(row => !weapon || row.id === weapon);
  const planned = selectedWeapons.length * modes.length;
  catalog: for (const { id } of selectedWeapons) {
    const pack = loadPack(id);
    for (const mode of modes) {
      const budget = mode === 'bd' ? shop.weapons[id].gunsmithLimit : mode === 'sol' ? operationsBudget : undefined;
      const request = { mode, budget, preset: 'recoil', shot_count: 20, time_limit_seconds,
        config, tunes, fixed, minimum_stats, pattern_reduction_percent: cap === undefined ? undefined : Number(cap) };
      const start = performance.now();
      let lastProgress = start, lastPhase;
      const onProgress = time_limit_seconds === 0 ? progress => {
        const now = performance.now();
        if (progress.category === lastPhase && now - lastProgress < 60_000) return;
        lastProgress = now;
        lastPhase = progress.category;
        console.error(`${id} ${mode} ${lastPhase ?? 'search'} at ${Math.round((now - start) / 1000)}s: ${progress.tree_nodes} nodes, ${progress.evaluated} full evaluations`);
      } : undefined;
      try {
        if (subtreeReference) {
          const saved = read(subtreeReference).at(-1).full_budget_catalog.cases
            .find(row => row.id === id && row.request.mode === mode);
          const incumbent = saved?.witnesses.find(row => row.label === 'Max' && row.proof === 'Proven optimal');
          assert(incumbent, 'Subtree timing requires a certified Max reference');
          if (stock) assert.equal(incumbent.config.find(row => row.slotPath === '3')?.itemId, stock,
            'Subtree stock must contain the reference Max witness');
          const model = native(pack, request);
          const exact = model.score(incumbent.config, incumbent.tunes);
          assert(exact.eligible);
          assert.deepEqual([exact.cost, exact.loss, exact.handling, exact.components.pattern],
            [incumbent.cost, incumbent.loss, incumbent.handling, incumbent.pattern]);
          const parent = planExactOrdinaryPartitions({pack, request, shop, prices}, modules, {workers: 4, staged: true})
            .find(row => row.path === '2' && row.choices.length === 1 &&
              row.choices[0] === incumbent.config.find(row => row.slotPath === '2')?.itemId);
          assert(parent, 'Expected a dedicated Max barrel partition');
          const partition = stock ? {...parent, secondary_path: '3', secondary_choices: [stock]} : parent;
          const shard = solveExactOrdinary({pack, request, shop, prices, onProgress}, modules, {
            partition, phase: {kind: 'maximum', incumbent}, collectArchive: true,
            diagnoseRootCuts: options.includes('--diagnose-root-cuts'),
          });
          for (const row of shard.price_archive) replay(row, model);
          const winner = shard.price_archive.sort(compare)[0];
          if (shard.solver.exhausted) {
            assert(winner && compare(winner, incumbent) === 0, 'Subtree must replay the incumbent optimum');
          }
          report.push({max_subtree: {id, request, partition, solver: shard.solver,
            winner: winner ? {config: winner.config, tunes: winner.tunes, cost: winner.cost, loss: winner.loss,
              handling: winner.handling, pattern: winner.components.pattern} : null}});
          if (!shard.solver.exhausted) process.exitCode = 1;
          continue;
        }
        const cpuStart = process.cpuUsage();
        const result = await runExactOrdinaryNodePool({ pack, request, shop, prices, onProgress }, modules, runtime,
          { workers, jobs, staged: options.includes('--staged') });
        const cpu = process.cpuUsage(cpuStart);
        verifyCertificate(result);
        const model = native(pack, request);
        assert.equal(result.pattern_constraint?.reference, cap === undefined ? undefined : model.reference);
        assert.equal(result.pattern_constraint?.maximum, cap === undefined ? undefined : model.cap);
        for (const row of result.results.filter(row => row.status === 'best_found')) {
          replay(row, model);
          if (mode === 'mp') assert.equal(row.label, 'Max', 'Warfare should return only unpriced Max');
        }
        cases.push({ id, request, wall_ms: performance.now() - start,
          cpu_ms: (cpu.user + cpu.system) / 1000, peak_rss_kib: process.resourceUsage().maxRSS,
          solver: result.solver, pattern_constraint: result.pattern_constraint,
          witnesses: result.results.map(({ label, status, proof, cost, loss, handling, components, config, tunes }) =>
            ({ label, status, proof, cost, loss, handling, pattern: components?.pattern, config, tunes })) });
      } catch (error) {
        cases.push({ id, request, wall_ms: performance.now() - start, error: error.stack ?? String(error) });
      }
      const last = cases.at(-1);
      if (caseLog) appendFileSync(caseLog, JSON.stringify(last) + '\n');
      console.error(`${id} ${mode} ${last.error ? 'failed' : last.solver.exhausted ? 'certified' : 'open'} (${Math.round(last.wall_ms)} ms)`);
      if (options.includes('--fail-fast') && (last.error || !last.solver.exhausted)) break catalog;
    }
  }
  const errors = cases.filter(row => row.error).length;
  const certified = cases.filter(row => row.solver?.exhausted).length;
  if (!subtreeReference || errors) report.push({ full_budget_catalog: { certified,
    open: cases.length - certified - errors, errors, total: cases.length, planned, cases } });
  if (errors || options.includes('--require-certificates') && certified !== cases.length) process.exitCode = 1;
}

if (reportPath) {
  const saved = read(reportPath);
  const id = saved.weapon_id;
  const pack = loadPack(id);
  const request = saved.request ?? { mode: saved.mode, budget: shop.weapons[id].gunsmithLimit };
  const model = native(pack, request);
  const rows = saved.results.filter(row => row.status === 'best_found');
  for (const row of rows) {
    replay(row, model);
    if (saved.pattern_constraint) assert(row.components.pattern <= saved.pattern_constraint.maximum);
    assert.equal(row.proof, saved.solver.exhausted ? 'Proven optimal' : 'Best found');
  }
  report.push({ id, mode: saved.mode, replayed: rows.length, exhausted: saved.solver.exhausted });
}

if (options.includes('--ci19-baseline')) {
  const pack = loadPack('18010000038');
  const referencePath = options.find(option => option.startsWith('--reference='))?.slice('--reference='.length);
  if (!referencePath) throw Error('Pass the original tuned reference report with --reference=path');
  const equipped = read(referencePath).results.find(row => row.label === 'Max');
  const request = { mode: 'bd', budget: 2000, preset: 'recoil', shot_count: 20,
    time_limit_seconds: Number(options.find(option => option.startsWith('--seconds='))?.slice('--seconds='.length) ?? '30'),
    pattern_reduction_percent: 5, config: equipped.config, tunes: equipped.tunes };
  const input = { pack, request, shop, prices };
  const result = options.includes('--node-workers')
    ? await runExactOrdinaryNodePool(input, modules, runtime, { workers: 4, staged: options.includes('--staged') })
    : solveExactOrdinary(input, modules, { pruneMounts: false });
  const witnesses = result.results.filter(row => row.status === 'best_found');
  assert(Math.abs(result.pattern_constraint.reference - equipped.components.pattern) < 1e-12);
  for (const row of witnesses) replay(row, native(pack, request));
  report.push({ ci19: { request, solver: result.solver, pattern_constraint: result.pattern_constraint,
    witnesses: witnesses.map(({ label, cost, proof, components, config, tunes }) =>
      ({ label, cost, proof, pattern: components.pattern, config, tunes })) } });
}

console.log(JSON.stringify(report, null, 2));
