import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
import {createChoiceGroups} from '../tools/choice_groups.mjs';
import {presets} from '../tools/optimizer_presets.mjs';
import {compileMounts} from '../tools/scip_mount_model.mjs';
import {createMountSearch} from '../tools/mount_search.mjs';

const data = process.argv[2];
if (!data) throw Error('Pass a local Pages export data directory');
const read = filename => JSON.parse(readFileSync(join(data, filename), 'utf8'));
const {shop, prices} = read('catalog.json');
const original = read('weapons/18010000038.json');
const mode = 'bd';
const setup = (pack = original, fixed = [], preferred = []) => {
  const request = {mode, budget: 2000, fixed};
  const resolve = config => curves.o(pack, config, mode);
  const modules = {kernel, curves, calculate};
  const scorer = presets.recoil.create({pack, request, mode, resolve, ...modules});
  const groups = createChoiceGroups({pack, mode, shop, prices, preset: scorer, fixed, ...modules});
  const compiled = compileMounts({pack, shop, prices, request}, kernel);
  groups.constrain(compiled, {preserveIdentities:true, preserveBundled:true});
  const equivalents = groups.exactPriceRestrictions(compiled, preferred);
  const dropped = (path, id) => equivalents.has(compiled.players.get(path+'|'+id)?.value);
  return {compiled, pack, scorer, resolve, groups, equivalents, dropped};
};
const firstSight = '13110000040';
const equivalentSight = '13110000043';
const differentPrice = '13110000089';
const magwells = ['13340000001', '13340000005', '13340000009'];
const fixture = setup();
assert(!fixture.dropped('11', firstSight));
assert(fixture.dropped('11', equivalentSight));
assert(!fixture.dropped('11', differentPrice));
assert(!fixture.dropped('5/44', magwells[0]));
assert(magwells.slice(1).every(id => fixture.dropped('5/44',id)));
assert(!setup(original, [{slotPath:'11', itemId:equivalentSight}]).dropped('11', equivalentSight));
assert(!setup(original, [], [{slotPath:'11', itemId:equivalentSight}]).dropped('11', equivalentSight));
assert(setup(original, [], [{slotPath:'11', itemId:equivalentSight}]).dropped('11', firstSight));

function evaluate({pack, resolve, scorer}, config, lastTune) {
  const build = resolve(config);
  assert(build.config.some(row => row.slotPath === config.at(-1).slotPath && row.itemId === config.at(-1).itemId));
  const tunes = {};
  if (lastTune !== undefined) for (const part of build.mounted) {
    for (const id of pack.parts[part.itemId]?.tuneIds ?? []) {
      const control = curves.c(pack, part, id);
      if (control?.enabled) (tunes[part.slotPath] ??= {})[id] = curves.n(control).at(lastTune);
    }
  }
  const state = kernel.u(pack, build, {mode, tacticalEffective:true, tunes});
  const raw = scorer.raw(build, tunes, state);
  return {stats:state.numeric.mainAttr, raw, objectives:scorer.objectives(raw)};
}
for (const tuning of [undefined, 0, -1]) {
  const sight = evaluate(fixture, [{slotPath:'11', itemId:firstSight}], tuning);
  assert.deepEqual(evaluate(fixture, [{slotPath:'11', itemId:equivalentSight}], tuning), sight);
  const config = [{slotPath:'11', itemId:firstSight}, {slotPath:'5/44', itemId:magwells[0]}];
  const expected = evaluate(fixture, config, tuning);
  for (const itemId of magwells.slice(1)) {
    assert.deepEqual(evaluate(fixture, [config[0], {slotPath:'5/44', itemId}], tuning), expected);
  }
}

const dependent = structuredClone(original);
dependent.combat.specialFire.itemOverrides[equivalentSight] = {requiresItemIds:[equivalentSight]};
assert(!setup(dependent).dropped('11', equivalentSight));
const scoredTune = structuredClone(original);
const tuneId = scoredTune.parts[equivalentSight].tuneIds[0];
scoredTune.tunes[tuneId].functions[0].target = 'GAiming_ADSTime';
assert(!setup(scoredTune).dropped('11', equivalentSight));
const changedHost = structuredClone(original);
const sockets = Object.values(changedHost.assembly.socketProviders).flatMap(provider => provider.sockets ?? []);
const socket = sockets.find(row => +row.socketId === 44 && row.optionItemIds?.includes(magwells[1]));
socket.optionItemIds = socket.optionItemIds.filter(id => id !== magwells[1]);
assert(!setup(changedHost).dropped('5/44', magwells[1]));

const report = {equivalent_player_choices:fixture.equivalents.size};
if (process.argv.includes('--count')) {
  const restrictions = new Map([...fixture.compiled.players.values()]
    .filter(player => typeof player.value === 'string' && fixture.groups.isTactical(player.path, player.item))
    .map(player => [player.value,0]));
  const search = createMountSearch(fixture.compiled);
  report.concrete_layouts = String(search.count(restrictions).total);
  report.same_price_layouts = String(search.count(new Map([...restrictions, ...fixture.equivalents])).total);
}
console.log(JSON.stringify(report, null, 2));
