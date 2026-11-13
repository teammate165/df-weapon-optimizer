"""Export every dfttk calibration definition/context and expose it in SQLite.

uv run --no-project tools/document_calibration.py
"""
import csv
import hashlib
import json
import sqlite3
from collections import Counter
from contextlib import closing
from pathlib import Path

from sync_dfttk_database import CACHE, ROOT, assemble, encode, load


def main():
    manifest = load('manifest.json')
    sources = load('download_provenance.json')
    for path, provenance in sources.items():
        if hashlib.sha256((CACHE / path).read_bytes()).hexdigest() != provenance['sha256']:
            raise ValueError(f'Corrupted source: {path}')
    names = load('locales/zh-CN/items.json')['items']
    definitions = {}
    for weapon_id, spec in manifest['weaponPacks'].items():
        pack = assemble(spec)
        for item_id, part in pack['parts'].items():
            for tune_id in part.get('tuneIds', []):
                raw = pack['tunes'][tune_id]
                curves = {f['curveId']: pack['curves'][f['curveId']] for f in raw.get('functions', [])}
                digest = hashlib.sha256(encode(dict(raw=raw, curves=curves)).encode()).hexdigest()
                key = (item_id, tune_id, digest)
                if key not in definitions:
                    definitions[key] = dict(item_id=item_id, name=names.get(item_id, ''), tune_id=tune_id,
                        definition_sha256=digest, weapon_ids=[], raw_tune=raw, curves=curves)
                definitions[key]['weapon_ids'].append(weapon_id)
    rows = []
    for definition in definitions.values():
        definition['weapon_ids'].sort()
        raw = definition['raw_tune']
        availability = raw.get('availability') or raw.get('availabilityByItem', {}).get(definition['item_id'])
        contexts = dict(availability.get('contexts', {})) if availability else {}
        contexts['default'] = availability['default'] if availability else dict(
            enabled=raw.get('enabled', True), positions=raw.get('positions'), notch=raw.get('notch'),
            min=raw['range']['minValue'], max=raw['range']['maxValue'], step=raw['range']['step'], dflt=raw['range']['defaultValue'])
        for context, control in contexts.items():
            rows.append(dict(item_id=definition['item_id'], name=definition['name'], tune_id=definition['tune_id'],
                definition_sha256=definition['definition_sha256'], context=context,
                slider_type=raw.get('sliderType'), enabled=control.get('enabled'), positions=control.get('positions'),
                notch=control.get('notch'), min_value=control['min'], max_value=control['max'],
                step=control['step'], default_value=control['dflt'],
                dimension=raw.get('labels', {}).get('mainLocId', '').removeprefix('authoring:'),
                unit=raw.get('labels', {}).get('unitLocId', '').removeprefix('authoring:'),
                targets=';'.join(f['target'] for f in raw.get('functions', [])),
                modifiers=';'.join(f['modifier'] for f in raw.get('functions', [])),
                weapon_ids=';'.join(definition['weapon_ids'])))
    output = ROOT / 'data' / 'calibration'
    output.mkdir(exist_ok=True)
    inventory = dict(data_version=manifest['dataVersion'], runtime_version=manifest['version'],
        source_manifest=sources['manifest.json'],
        definitions=list(definitions.values()), contexts=rows)
    (output / 'inventory.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    with (output / 'controls.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    with closing(sqlite3.connect(ROOT / 'delta_force_weapons.sqlite')) as db:
        snapshot = db.execute("SELECT value FROM metadata WHERE key='dfttk_snapshot_id'").fetchone()[0]
        if not snapshot.startswith(manifest['version'] + '-'):
            raise ValueError('Database/cache snapshot mismatch')
        db.execute('''CREATE TABLE IF NOT EXISTS calibration_definitions (
            item_id TEXT NOT NULL, tune_id TEXT NOT NULL, definition_sha256 TEXT NOT NULL,
            snapshot_id TEXT NOT NULL, record_json TEXT NOT NULL CHECK(json_valid(record_json)),
            PRIMARY KEY(item_id,tune_id,definition_sha256))''')
        db.execute('''CREATE TABLE IF NOT EXISTS calibration_controls (
            item_id TEXT NOT NULL,tune_id TEXT NOT NULL,definition_sha256 TEXT NOT NULL,context_key TEXT NOT NULL,
            slider_type TEXT,enabled INTEGER,positions INTEGER,notch REAL,min_value REAL,max_value REAL,
            step REAL,default_value REAL,dimension TEXT,unit TEXT,weapon_ids_json TEXT NOT NULL,
            PRIMARY KEY(item_id,tune_id,definition_sha256,context_key))''')
        for definition in definitions.values():
            db.execute('INSERT OR REPLACE INTO calibration_definitions VALUES (?,?,?,?,?)',
                (definition['item_id'], definition['tune_id'], definition['definition_sha256'], snapshot, encode(definition)))
        for row in rows:
            db.execute('INSERT OR REPLACE INTO calibration_controls VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                tuple(row[key] for key in ['item_id','tune_id','definition_sha256','context','slider_type','enabled',
                    'positions','notch','min_value','max_value','step','default_value','dimension','unit'])
                + (encode(row['weapon_ids'].split(';')),))
        db.commit()
    summary = dict(definitions=len(definitions), items=len({d['item_id'] for d in definitions.values()}),
        context_rows=len(rows), enabled_context_rows=sum(bool(r['enabled']) for r in rows),
        slider_types=dict(Counter(r['slider_type'] for r in rows)),
        function_modifiers=dict(Counter(f['modifier'] for d in definitions.values() for f in d['raw_tune'].get('functions', []))),
        function_targets=dict(Counter(f['target'] for d in definitions.values() for f in d['raw_tune'].get('functions', []))))
    (output / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
