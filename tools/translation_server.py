"""Dependency-free local translation editor. Run: uv run --no-project tools/translation_server.py"""
import json
import sqlite3
import shutil
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAVE = ROOT / 'translation' / 'translations.json'


def readable_slot(slot):
    import re
    labels = {'functional': 'Laser / light / accessory', 'scope': 'Scope / sight',
              'muzzle': 'Muzzle device', 'rearGrip': 'Pistol grip',
              'unknown': 'Unclassified', 'unique': 'Weapon-specific component'}
    return labels.get(slot, re.sub(r'(?<!^)(?=[A-Z])', ' ', slot or 'Unclassified').capitalize())


def catalog():
    with sqlite3.connect(f'{(ROOT / "delta_force_weapons.sqlite").as_uri()}?mode=ro', uri=True) as db:
        weapons = [dict(key='weapon:' + r[0], kind='Weapon', id=r[1], name=r[2], detail=r[3] or '', source=r[4])
                   for r in db.execute('SELECT profile_key, weapon_id, name, category, source_path FROM weapons WHERE is_variant=0 ORDER BY category, name, profile_key')]
        weapon_ids = {w['id'] for w in weapons}
        for weapon in weapons:
            weapon.update(slot='', weapon_ids=[weapon['id']], compatible=[], selectable=True)
        compatibility = {}
        for item_id, weapon_id in db.execute('SELECT DISTINCT o.item_id, w.weapon_id FROM weapon_socket_options o JOIN weapons w ON w.profile_key=o.profile_key'):
            compatibility.setdefault(item_id, set()).add(weapon_id)
        names = {w['id']: w['name'] for w in weapons}
        parts = []
        for item_id, name, slot, source, selectable in db.execute('SELECT item_id, name, slot, source_path, selectable FROM parts ORDER BY slot, name, item_id'):
            if item_id in weapon_ids:
                continue
            ids = sorted(compatibility.get(item_id, set()))
            parts.append(dict(key='part:' + item_id, kind='Attachment' if selectable else 'Internal component',
                              id=item_id, name=name, detail=readable_slot(slot), slot=slot,
                              source=source, selectable=bool(selectable), weapon_ids=ids,
                              compatible=[names[i] for i in ids]))
    return weapons + parts


ITEMS = catalog()
KEYS = {item['key'] for item in ITEMS}
with sqlite3.connect(f'{(ROOT / "delta_force_weapons.sqlite").as_uri()}?mode=ro', uri=True) as db:
    ALIASES = {'weapon:' + profile: 'weapon:' + weapon + ':base'
               for profile, weapon in db.execute('SELECT profile_key, weapon_id FROM weapons')}
    ALIASES.update({'part:' + weapon: 'weapon:' + weapon + ':base'
                    for weapon, in db.execute('SELECT DISTINCT weapon_id FROM weapons')})


def consolidate(data):
    """Accept older profile-keyed exports without silently discarding conflicts."""
    if not isinstance(data, dict):
        raise ValueError('Expected a JSON object keyed by item key.')
    result = {}
    for key, value in data.items():
        target = ALIASES.get(key, key)
        if target in result and result[target] != value:
            raise ValueError(f'Conflicting profile translations for {target}; reconcile the exported entries first.')
        result[target] = value
    return result


def load_translations():
    if not SAVE.exists():
        return {}
    original = json.loads(SAVE.read_text('utf-8'))
    merged = validate(consolidate(original))
    if merged != original:
        backup = SAVE.with_suffix('.profiles-backup.json')
        if not backup.exists():
            shutil.copy2(SAVE, backup)
        write_translations(merged)
    return merged


def write_translations(data):
    temp = SAVE.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(SAVE)


def validate(data):
    if not isinstance(data, dict):
        raise ValueError('Expected a JSON object keyed by item key.')
    for key, value in data.items():
        if key not in KEYS or not isinstance(value, dict):
            raise ValueError(f'Unknown item or invalid entry: {key}')
        if set(value) != {'english', 'status', 'notes'}:
            raise ValueError(f'Invalid fields: {key}')
        if any(not isinstance(v, str) for v in value.values()):
            raise ValueError('All entry values must be text.')
        if value['status'] not in ('untranslated', 'provisional', 'verified'):
            raise ValueError('Invalid translation status.')
        if value['status'] != 'untranslated' and not value['english'].strip():
            raise ValueError('Translated entries need an English name.')
    return data


class Handler(BaseHTTPRequestHandler):
    def reply(self, data, status=200, content_type='application/json'):
        body = data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type + '; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/':
            return self.reply((ROOT / 'translation' / 'index.html').read_bytes(), content_type='text/html')
        if self.path == '/api/data':
            try:
                reference = ROOT / 'data' / 'official_accessory_names.json'
                official = json.loads(reference.read_text('utf-8'))['matches'] if reference.exists() else {}
                return self.reply(dict(items=ITEMS, translations=load_translations(), aliases=ALIASES, official_names=official))
            except (ValueError, OSError) as exc:
                return self.reply({'error': str(exc)}, 400)
        self.reply({'error': 'Not found'}, 404)

    def do_POST(self):
        if self.path != '/api/save':
            return self.reply({'error': 'Not found'}, 404)
        if self.headers.get('Origin') != 'http://' + self.headers.get('Host', ''):
            return self.reply({'error': 'Origin rejected'}, 403)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 5_000_000:
                raise ValueError('Invalid file size')
            data = validate(consolidate(json.loads(self.rfile.read(length))))
            write_translations(data)
            self.reply({'saved': True})
        except (ValueError, OSError) as exc:
            self.reply({'error': str(exc)}, 400)


if __name__ == '__main__':
    print('Translation editor: http://127.0.0.1:8765', flush=True)
    HTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
