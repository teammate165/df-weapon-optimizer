"""Import the verified dfttk cache into SQLite, with per-mode data and conflict audit.

uv run --no-project tools/fetch_dfttk.py
uv run --no-project tools/sync_dfttk_database.py [--database PATH]
"""
import argparse
import copy
import hashlib
import json
import sqlite3
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from fetch_dfttk import CACHE, ROOT
from vendor.delta_gun_tierlist import normalize as norm


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def load(path):
    return json.loads((CACHE / path).read_text('utf-8'))


def branch(obj, dotted):
    for key in dotted.split('.'):
        obj = obj[key]
    return obj


def assemble(spec):
    core = load(spec['sharedBuild']['core'])
    result = copy.deepcopy(core['payload'])
    records = {}
    for path in spec['sharedBuild']['shards']:
        payload = load(path)['payload']
        for category in core['sharedRecordKeys']:
            try:
                values = branch(payload, category)
            except KeyError:
                continue
            bucket = records.setdefault(category, {})
            for key, value in values.items():
                if key in bucket and bucket[key] != value:
                    raise ValueError(f'Inconsistent shared record {category}/{key}')
                bucket[key] = value
    for category, keys in core['sharedRecordKeys'].items():
        target = branch(result, category)
        for key in keys:
            value = records[category][key]
            if key in target and target[key] != value:
                raise ValueError(f'Core/shared conflict {category}/{key}')
            target[key] = value
    return result


SCHEMA = '''
CREATE TABLE IF NOT EXISTS dfttk_snapshots (
 snapshot_id TEXT PRIMARY KEY, imported_at TEXT NOT NULL, data_version TEXT NOT NULL,
 manifest_sha256 TEXT NOT NULL, game_build_version TEXT, provenance_json TEXT NOT NULL CHECK(json_valid(provenance_json)));
CREATE TABLE IF NOT EXISTS dfttk_raw_files (
 snapshot_id TEXT NOT NULL, path TEXT NOT NULL, source_url TEXT NOT NULL, sha256 TEXT NOT NULL,
 record_json TEXT NOT NULL CHECK(json_valid(record_json)), PRIMARY KEY(snapshot_id,path));
CREATE TABLE IF NOT EXISTS weapon_mode_stats (
 weapon_id TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('sol','mp','bd')), snapshot_id TEXT NOT NULL,
 name TEXT NOT NULL, rpm REAL, muzzle_velocity_mps REAL, flesh_damage REAL, armor_damage REAL,
 clip_capacity INTEGER, max_carried_ammo INTEGER, effective_range_m REAL,
 recoil_control REAL, handling REAL, stability REAL, hip_fire_accuracy REAL,
 record_json TEXT NOT NULL CHECK(json_valid(record_json)),
 library_json TEXT NOT NULL CHECK(json_valid(library_json)), PRIMARY KEY(weapon_id,mode));
CREATE TABLE IF NOT EXISTS part_mode_stats (
 item_id TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('sol','mp','bd')), snapshot_id TEXT NOT NULL,
 record_json TEXT NOT NULL CHECK(json_valid(record_json)), PRIMARY KEY(item_id,mode));
CREATE TABLE IF NOT EXISTS dfttk_part_effects (
 weapon_id TEXT NOT NULL, item_id TEXT NOT NULL, mode TEXT NOT NULL, snapshot_id TEXT NOT NULL,
 effects_json TEXT NOT NULL CHECK(json_valid(effects_json)), PRIMARY KEY(weapon_id,item_id,mode));
CREATE TABLE IF NOT EXISTS dfttk_conflicts (
 run_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, mode TEXT,
 field_path TEXT NOT NULL, change_kind TEXT NOT NULL, previous_json TEXT, incoming_json TEXT,
 resolution TEXT NOT NULL, source_url TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS dfttk_conflicts_run ON dfttk_conflicts(run_id);
CREATE VIEW IF NOT EXISTS weapon_library_stats AS
 SELECT weapon_id,mode,name,
 json_extract(library_json,'$.ads') AS ads_ms,
 json_extract(library_json,'$.sprintToFire') AS sprint_to_fire_ms,
 json_extract(library_json,'$.reload') AS reload_seconds,
 json_extract(library_json,'$.emptyReload') AS empty_reload_seconds,
 json_extract(library_json,'$.walk') AS walk_mps,
 json_extract(library_json,'$.sprint') AS sprint_mps,
 json_extract(library_json,'$.adsMove') AS ads_move_mps,
 json_extract(library_json,'$.silent') AS silent_move_mps,
 json_extract(library_json,'$.hipSpread') AS hip_spread_degrees,
 json_extract(library_json,'$.hipMaxSpread') AS hip_max_spread_degrees,
 json_extract(library_json,'$.breath') AS breath_sway_degrees,
 library_json,snapshot_id FROM weapon_mode_stats;
'''


def synchronize(database, artifacts_root=None):
    artifacts_root = artifacts_root or ROOT / 'data'
    manifest = load('manifest.json')
    sources = load('download_provenance.json')
    for path, source in sources.items():
        if hashlib.sha256((CACHE / path).read_bytes()).hexdigest() != source['sha256']:
            raise ValueError(f'Cache hash mismatch: {path}; fetch again')
    if sources['manifest.json']['sha256'] != hashlib.sha256((CACHE / 'manifest.json').read_bytes()).hexdigest():
        raise ValueError('Manifest mismatch')
    for path, source in sources.items():
        if path in manifest['files'] and source['sha256'] != manifest['files'][path]['sha256']:
            raise ValueError(f'Manifest/file mismatch: {path}')
    modes = manifest['supportedModes']
    if set(modes) != {'sol', 'mp', 'bd'}:
        raise ValueError('Unsupported mode schema')
    now = datetime.now(timezone.utc)
    run_id = now.strftime('%Y%m%dT%H%M%S%fZ')
    snapshot = manifest['version'] + '-' + sources['manifest.json']['sha256'][:12]
    packs = {wid: assemble(spec) for wid, spec in manifest['weaponPacks'].items()}
    combat = {wid: load(spec['combat']) for wid, spec in manifest['weaponPacks'].items()}
    catalog = load('catalog/weapons.json')['objects']
    names = load('locales/zh-CN/items.json')['items']
    libraries = {mode: load(manifest['entrypoints']['library'][mode]) for mode in modes}
    for mode in modes:
        if libraries[mode]['mode'] != mode or set(libraries[mode]['weapons']) != set(packs):
            raise ValueError(f'Incomplete mode library: {mode}')
    # Compatibility tables keep the same normalized schema as the original import.
    overrides = dict(weapons={}, ammo={}, armor={})
    ammo_catalog = load('catalog/ammo.json')
    ammo_profiles = {}
    for payload in combat.values():
        ammo_profiles.update(payload.get('combat', {}).get('ammoProfiles', {}))
    ammo = norm.normalize_ammo(ammo_catalog, load('combat/defense/ammo-interactions.json'),
                               overrides, [], ammo_profiles=ammo_profiles)
    caliber = norm.ammo_type_to_caliber_map(ammo)
    ammo_types = {}
    for item_id, value in ammo_catalog['ammo'].items():
        ammo_types.setdefault(str(value.get('ammoTypeId', '')), []).append(item_id)
    mode_weapons = {}
    source_cross_checks = []
    for mode in modes:
        norm.DEFAULT_MODE = mode
        for wid, pack in packs.items():
            obj = copy.deepcopy(catalog[wid])
            # The legacy helper uses a literal sol summary, but its profile resolver
            # uses DEFAULT_MODE. Provide the selected summary without changing source.
            summary = catalog[wid]['combatSummaryByMode'][mode]
            obj['combatSummaryByMode']['sol'] = summary
            checks = []
            record = norm.normalize_weapon(wid, pack, obj, names.get(wid, wid), ammo_types,
                                           overrides, [], combat_pack=combat[wid],
                                           cross_checks=checks, ammo_type_to_caliber=caliber)
            if record is None:
                raise ValueError(f'Missing weapon summary {wid}/{mode}')
            source_cross_checks.extend(dict(mode=mode, **check) for check in checks)
            record.update(mode=mode, source='dfttk', snapshot_id=snapshot,
                          fire_schedule_rules=summary.get('fireScheduleRules'),
                          schedule_status=summary.get('scheduleStatus'),
                          trigger_delay_ms=summary.get('triggerDelayMs'),
                          raw_catalog_summary=summary,
                          raw_weapon=pack['weapon'],
                          library_stats=libraries[mode]['weapons'][wid])
            record['max_carried_ammo'] = pack['weapon']['ammunition'].get('maxCarriedAmmoByMode', {}).get(mode)
            record['combat_variant_item_ids'] = pack.get('combatVariantItemIds', {}).get(mode, [])
            # Zero armor damage (mp) must remain zero, never use truthy fallback.
            record['flesh_damage'] = summary.get('baseFleshDamage')
            record['armor_damage'] = summary.get('baseArmorDamage')
            mode_weapons[wid, mode] = record
    norm.DEFAULT_MODE = 'sol'
    parts = norm.normalize_parts(packs, names)
    profiles = norm.normalize_profiles(packs, combat)
    mechanisms = norm.normalize_mechanism_curves(packs)
    if profiles['conflicts'] or mechanisms['disagreements']:
        raise ValueError('Nonunique source profiles/curves; resolve before a global compatibility import')
    # Prove shared reconstruction matches a full pack, if downloaded for inspection.
    inspected = CACHE / manifest['weaponPacks']['18010000001']['build']
    if inspected.exists() and json.loads(inspected.read_text('utf-8')) != packs['18010000001']:
        raise ValueError('Shared-build reconstruction differs from full M4A1 build pack')
    database = database.resolve()
    if not database.exists():
        raise ValueError('Existing project database required')
    backups = artifacts_root / 'backups'
    backups.mkdir(parents=True, exist_ok=True)
    backup = backups / (database.stem + '.before-dfttk-' + run_id + '.sqlite')
    db = sqlite3.connect(database)
    with closing(sqlite3.connect(backup)) as target:
        db.backup(target)
    changes = []

    def difference(entity, entity_id, old, new, url, mode='sol', path=''):
        if isinstance(old, dict) and isinstance(new, dict):
            for key in sorted(set(old) | set(new)):
                field = path + '/' + key
                if key not in old:
                    changes.append((entity, entity_id, mode, field, 'added', None, encode(new[key]), 'dfttk', url))
                elif key not in new:
                    changes.append((entity, entity_id, mode, field, 'removed', encode(old[key]), None, 'dfttk', url))
                else:
                    difference(entity, entity_id, old[key], new[key], url, mode, field)
        elif old != new:
            changes.append((entity, entity_id, mode, path, 'changed', encode(old), encode(new), 'dfttk', url))

    try:
        # executescript commits before running. All data updates below share one transaction.
        db.executescript(SCHEMA)
        db.execute('BEGIN IMMEDIATE')
        db.execute('INSERT OR REPLACE INTO dfttk_snapshots VALUES (?,?,?,?,?,?)',
                   (snapshot, now.isoformat(), manifest['dataVersion'], sources['manifest.json']['sha256'],
                    manifest.get('gameBuildVersion'), encode(dict(manifest=manifest, sources=sources))))
        for path, source in sources.items():
            db.execute('INSERT OR REPLACE INTO dfttk_raw_files VALUES (?,?,?,?,?)',
                       (snapshot, path, source['url'], source['sha256'], (CACHE / path).read_text('utf-8')))
        for (wid, mode), record in mode_weapons.items():
            attrs = record['panel_attributes']
            previous = db.execute('SELECT record_json FROM weapon_mode_stats WHERE weapon_id=? AND mode=?', (wid, mode)).fetchone()
            if previous:
                difference('weapon_mode_stats', wid, json.loads(previous[0]), record,
                           sources[manifest['entrypoints']['library'][mode]]['url'], mode)
            db.execute('INSERT OR REPLACE INTO weapon_mode_stats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                (wid, mode, snapshot, record['name'], record['rpm'], record['muzzle_velocity_mps'],
                 record['flesh_damage'], record['armor_damage'], record['clip_capacity'], record['max_carried_ammo'],
                 record['panel_attributes'].get('effective_range'), attrs.get('recoil_control'), attrs.get('handling'),
                 attrs.get('stability'), attrs.get('waist_accuracy'), encode(record),
                 encode(libraries[mode]['weapons'][wid])))
        # Explicit columns avoid silently assuming a later migration's column order.
        for wid, mode in mode_weapons:
            record = mode_weapons[wid, mode]
            if mode != 'sol':
                continue
            for profile_key, old_json in db.execute('SELECT profile_key,record_json FROM weapons WHERE weapon_id=?', (wid,)).fetchall():
                old = json.loads(old_json)
                new = {**old, **record}
                difference('weapons', profile_key, old, new, sources[manifest['weaponPacks'][wid]['sharedBuild']['core']]['url'])
                attrs = new['panel_attributes']
                db.execute('UPDATE weapons SET name=?,category=?,caliber=?,rpm=?,muzzle_velocity_mps=?,flesh_damage=?,armor_damage=?,clip_capacity=?,effective_range_m=?,recoil_control=?,stability=?,handling=?,hip_fire_accuracy=?,source_path=?,record_json=? WHERE profile_key=?',
                    (new['name'], new['category'], new['caliber'], new['rpm'], new['muzzle_velocity_mps'], new['flesh_damage'],
                     new['armor_damage'], new['clip_capacity'], attrs.get('effective_range'), attrs.get('recoil_control'),
                     attrs.get('stability'), attrs.get('handling'), attrs.get('waist_accuracy'),
                     sources[manifest['weaponPacks'][wid]['sharedBuild']['core']]['url'], encode(new), profile_key))
        for item_id, part in parts.items():
            url = sources['locales/zh-CN/items.json']['url']
            old = db.execute('SELECT record_json FROM parts WHERE item_id=?', (item_id,)).fetchone()
            if old:
                difference('parts', item_id, json.loads(old[0]), part, url)
            db.execute('INSERT OR REPLACE INTO parts VALUES (?,?,?,?,?,?)',
                       (item_id, part['name'], part['slot'], int(part['selectable']), url, encode(part)))
            db.execute('DELETE FROM part_effects WHERE item_id=?', (item_id,))
            db.execute('DELETE FROM part_tune_functions WHERE item_id=?', (item_id,))
            db.execute('DELETE FROM part_tunes WHERE item_id=?', (item_id,))
            for ordinal, effect in enumerate(part['effects']):
                db.execute('INSERT INTO part_effects VALUES (?,?,?,?,?,?,?,?)',
                    (item_id, ordinal, effect.get('target'), effect.get('operation'), effect.get('modifier'),
                     effect.get('scope'), effect.get('value'), effect.get('value_ref')))
            for tune in part['tunes']:
                db.execute('INSERT INTO part_tunes VALUES (?,?,?,?,?,?,?,?)',
                    (item_id, tune['tune_id'], tune.get('dimension'), tune.get('unit'), tune.get('min_value'),
                     tune.get('max_value'), tune.get('step'), tune.get('default_value')))
                for ordinal, function in enumerate(tune.get('functions', [])):
                    db.execute('INSERT INTO part_tune_functions VALUES (?,?,?,?,?,?)',
                        (item_id, tune['tune_id'], ordinal, function.get('target'), function.get('modifier'), encode(function.get('curve'))))
        for mode, library in libraries.items():
            for item_id, part in library['parts'].items():
                previous = db.execute('SELECT record_json FROM part_mode_stats WHERE item_id=? AND mode=?', (item_id, mode)).fetchone()
                if previous:
                    difference('part_mode_stats', item_id, json.loads(previous[0]), part, sources[manifest['entrypoints']['library'][mode]]['url'], mode)
                db.execute('INSERT OR REPLACE INTO part_mode_stats VALUES (?,?,?,?)', (item_id, mode, snapshot, encode(part)))
        for wid, pack in packs.items():
            for item_id, effects in pack['effectsByItemId'].items():
                for mode in modes:
                    db.execute('INSERT OR REPLACE INTO dfttk_part_effects VALUES (?,?,?,?,?)',
                               (wid, item_id, mode, snapshot, encode(effects.get(mode))))
        for table, key, values in [('profiles', 'profile_id', profiles['profiles']), ('mechanism_curves', 'curve_id', mechanisms['curves'])]:
            for item_id, value in values.items():
                old = db.execute(f'SELECT record_json FROM {table} WHERE {key}=?', (item_id,)).fetchone()
                if old:
                    difference(table, item_id, json.loads(old[0]), value, sources['manifest.json']['url'], None)
                if table == 'profiles':
                    db.execute('INSERT OR REPLACE INTO profiles VALUES (?,?,?)', (item_id, value['kind'], encode(value)))
                else:
                    db.execute('INSERT OR REPLACE INTO mechanism_curves VALUES (?,?)', (item_id, encode(value)))
        # Refresh compatibility options from refreshed normalized weapon records.
        db.execute('DELETE FROM weapon_socket_options')
        for profile_key, record_json in db.execute('SELECT profile_key,record_json FROM weapons').fetchall():
            record = json.loads(record_json)
            providers = {None: record.get('sockets', [])}
            providers.update(record.get('provider_sockets', {}))
            for provider, sockets in providers.items():
                for socket in sockets:
                    for item_id in socket['options']:
                        default = record.get('default_items', {}).get(str(socket['socket_id'])) == item_id
                        db.execute('INSERT INTO weapon_socket_options VALUES (?,?,?,?,?)',
                                   (profile_key, provider, str(socket['socket_id']), item_id, int(default)))
        db.executemany('INSERT INTO dfttk_conflicts VALUES (?,?,?,?,?,?,?,?,?,?)', [(run_id, *change) for change in changes])
        for key, value in dict(dfttk_snapshot_id=snapshot, dfttk_data_version=manifest['dataVersion'],
            dfttk_source_of_truth='https://dfttk.com; conflicts resolve to dfttk per user instruction; Garena equivalence unverified',
            weapon_stat_definition='Legacy weapons/parts are sol raw-input compatibility tables. Use weapon_mode_stats and part_mode_stats for explicit modes. Library resolved values are separate from raw inputs.',
            dfttk_latest_sync_run=run_id).items():
            db.execute('INSERT OR REPLACE INTO metadata VALUES (?,?)', (key, value))
        assert db.execute('SELECT count(*) FROM weapon_mode_stats WHERE snapshot_id=?', (snapshot,)).fetchone()[0] == len(packs) * len(modes)
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Database integrity failure')
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    directory = artifacts_root / 'dfttk_sync_logs'
    directory.mkdir(parents=True, exist_ok=True)
    fields = ['entity', 'entity_id', 'mode', 'field_path', 'change_kind', 'previous_json', 'incoming_json', 'resolution', 'source_url']
    log = directory / (run_id + '.jsonl')
    log.write_text(''.join(encode(dict(zip(fields, change))) + '\n' for change in changes), encoding='utf-8')
    summary = dict(run_id=run_id, snapshot_id=snapshot, data_version=manifest['dataVersion'], backup=str(backup),
        database=str(database), weapon_mode_rows=len(mode_weapons), library_part_rows=sum(len(l['parts']) for l in libraries.values()),
        raw_sources=len(sources), changes=dict(Counter(change[4] for change in changes)),
        source_cross_checks=source_cross_checks, profiles=len(profiles['profiles']), curves=len(mechanisms['curves']),
        counts_by_entity=dict(Counter(change[0] for change in changes)), log=str(log))
    (directory / (run_id + '.summary.json')).write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=True, indent=2))
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=ROOT / 'delta_force_weapons.sqlite')
    synchronize(parser.parse_args().database)
