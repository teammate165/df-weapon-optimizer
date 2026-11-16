"""Local builder and optimizer: python tools/builder_server.py (Python 3 + Node)."""
import argparse
import json
import sqlite3
import subprocess
import tempfile
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from sync_dfttk_database import ROOT, assemble, load
from prepare_project_runtime import prepare

REFERENCE = ROOT / '.scratch/calibration-check'
prepare(REFERENCE)
MANIFEST = load('manifest.json')


@lru_cache(maxsize=69)
def pack(weapon_id):
    return assemble(MANIFEST['weaponPacks'][weapon_id])


def catalog():
    translations = json.loads((ROOT / 'translation/translations.json').read_text('utf-8'))
    with sqlite3.connect(f'{(ROOT / "delta_force_weapons.sqlite").as_uri()}?mode=ro', uri=True) as db:
        shop = json.loads(db.execute("SELECT record_json FROM dfttk_raw_files WHERE path='catalog/bd-shop.json' ORDER BY rowid DESC LIMIT 1").fetchone()[0])
        weapon_prices = dict(db.execute("SELECT item_id,price_daily FROM prices WHERE item_type='weapon'"))
        prices = dict(db.execute("SELECT item_id,price_daily FROM prices WHERE item_type='part'"))
        sources = [dict(zip(('type', 'currency', 'updated_at', 'source'), r)) for r in db.execute('SELECT item_type,currency,updated_at,source FROM price_sources')]
        weapons = [dict(id=i, name=translations.get('weapon:' + key, {}).get('english') or name, original=name, category=category, price=weapon_prices.get(i), tier=shop['weapons'].get(i)) for key, i, name, category in db.execute('SELECT profile_key,weapon_id,name,category FROM weapons WHERE is_variant=0') if i in MANIFEST['weaponPacks']]
        names = {i: translations.get('part:' + i, {}).get('english') or name for i, name in db.execute('SELECT item_id,name FROM parts')}
        slots = dict(db.execute('SELECT item_id,slot FROM parts'))
    return dict(weapons=weapons, names=names, slots=slots, shop=shop, prices=prices, provenance=dict(data_version=MANIFEST['dataVersion'], runtime_version=MANIFEST['version'], price_sources=sources, model_policies={'laser_bonus_stacking': 'strongest_per_stat_v1'}, global_verified=False))


def execute(action, request):
    if action not in ('evaluate', 'optimize'):
        raise ValueError('Unknown action')
    if request.get('weapon_id') not in MANIFEST['weaponPacks']:
        raise ValueError('Unknown weapon')
    if request.get('mode') not in ('bd', 'mp', 'sol'):
        raise ValueError('Unknown mode')
    if not isinstance(request.get('shot_count', 20), int) or not 2 <= request.get('shot_count', 20) <= 200:
        raise ValueError('Shot count must be 2–200')
    data = catalog()
    if action == 'optimize' and request['mode'] == 'bd':
        request['budgets'] = [data['shop']['weapons'][request['weapon_id']]['gunsmithLimit']]
    payload = dict(action=action, request=request, pack=pack(request['weapon_id']), **{k: data[k] for k in ('shop', 'prices', 'provenance')})
    with tempfile.TemporaryDirectory(prefix='df-builder-') as directory:
        source = Path(directory) / 'input.json'
        source.write_text(json.dumps(payload), 'utf-8')
        timeout = max(180, min(660, float(request.get('time_limit_seconds', 30)) + 60)) if action == 'optimize' else 180
        result = subprocess.run(['node', str(ROOT / 'tools/builder_bridge.mjs'), str(source), str(REFERENCE)], capture_output=True, text=True, encoding='utf-8', timeout=timeout)
    if result.returncode:
        error = next((line.strip() for line in result.stderr.splitlines() if line.startswith('Error:')), 'The model could not resolve this build.')
        raise ValueError(error.removeprefix('Error: '))
    return json.loads(result.stdout)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'builder'), **kwargs)

    def end_headers(self):
        # This is a local editor preview. Do not retain stale ES-module labels
        # or styles between iterations, including imported child modules.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def reply(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlsplit(self.path).path == '/api/catalog':
            self.reply(200, catalog())
        else:
            super().do_GET()

    def do_POST(self):
        # Keep the local computational API same-origin, including browser requests.
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host', ''):
            self.reply(403, dict(error='Cross-origin request rejected'))
            return
        action = {'/api/evaluate': 'evaluate', '/api/optimize': 'optimize'}.get(self.path)
        if not action:
            self.reply(404, dict(error='Unknown endpoint'))
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 100_000:
                raise ValueError('Invalid request size')
            request = json.loads(self.rfile.read(length))
            self.reply(200, execute(action, request))
        except (ValueError, TypeError, KeyError, subprocess.TimeoutExpired) as error:
            self.reply(400, dict(error=str(error)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    if not all((REFERENCE / name).exists() for name in ('curves.mjs', 'attributes.mjs', 'kernel.mjs')):
        raise SystemExit('Run python tools/verify_calibration_reference.py first.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Builder: http://127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
