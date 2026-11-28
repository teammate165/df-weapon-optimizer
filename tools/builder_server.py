"""Local builder and optimizer: python tools/builder_server.py (Python 3 + Node)."""
import argparse
import json
import sqlite3
import subprocess
import tempfile
import threading
from queue import Queue, Empty
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from sync_dfttk_database import ROOT, assemble, load
from prepare_project_runtime import prepare

REFERENCE = ROOT / '.scratch/calibration-check'
prepare(REFERENCE)
MANIFEST = load('manifest.json')
M250_ID = '18040000003'
MONOLITH_ID = 'local-m250-monolith-magazine'
MONOLITH_NAME = 'HVK Monolith Magazine'


def add_m250_monolith(weapon):
    assembly = weapon['assembly']
    sockets = assembly['socketProviders'][M250_ID]['sockets']
    magazine = next(socket for socket in sockets if socket['socketId'] == 5)
    stock_options = magazine['optionItemIds']
    index = sockets.index(magazine)
    sockets[index:index + 1] = [
        {**magazine, 'modes': ['bd']},
        {**magazine, 'modes': ['sol', 'mp'], 'optionItemIds': [*stock_options, MONOLITH_ID]},
    ]
    # Occupying the barrel removes its nested muzzle. The magazine provides its own.
    stock_barrel = assembly['socketProviders']['13020000478']['sockets']
    muzzle = next(socket for socket in stock_barrel if socket['socketId'] == 6)
    assembly['socketProviders'][MONOLITH_ID] = {'sockets': [muzzle.copy()]}
    assembly['extraOccupancy'][MONOLITH_ID] = {'occupiedSocketIds': [2]}

    weapon['parts'][MONOLITH_ID] = {'effectSetIds': dict(sol=None, mp=None, bd=None), 'tuneIds': []}
    weapon['display']['objects'][MONOLITH_ID] = {
        'objectType': 'part', 'categoryId': 'magazine', 'playerSelectable': True,
    }
    stats_by_mode = {'sol': (8, -16, 8, 4), 'mp': (6, -12, 2, 4)}
    weapon['effectsByItemId'][MONOLITH_ID] = {
        mode: [
            dict(operation='StaticAttributeModify', target=f'{prefix}.{stat_id}',
                 modifier='Addend', value=value, scope='NONE')
            for stat_id, value in zip((3, 4, 5, 6), stats)
            for prefix in ('WeaponMainAttribute.MainAttrValues', 'DisplayAttrValues')
        ]
        for mode, stats in stats_by_mode.items()
    }
    weapon['effectsByItemId'][MONOLITH_ID]['bd'] = []

    peak_rpm = 626
    stock_interval = weapon['weapon']['fireControl']['fireIntervalSeconds']
    # Provisional linear RPM ramp. Native schedule entries are intervals into shots 2–10.
    opening_rpm = [450 + (peak_rpm - 450) * step / 8 for step in range(9)]
    weapon['combat']['specialFire']['itemOverrides'][MONOLITH_ID] = {
        'weaponId': M250_ID,
        'baseStatModifiers': {'fireRate': peak_rpm * stock_interval / 60 - 1},
        'schedulePolicy': 'replace',
        'fireScheduleRules': [{
            'type': 'fireSchedule', 'mode': 'intervalScaleSequence',
            'intervalScales': [peak_rpm / rpm for rpm in opening_rpm], 'sustainedIntervalScale': 1,
        }],
    }


@lru_cache(maxsize=69)
def pack(weapon_id):
    weapon = assemble(MANIFEST['weaponPacks'][weapon_id])
    if weapon_id == M250_ID:
        add_m250_monolith(weapon)
    if weapon_id == '18010000052':
        # Preserve the published AN-94 default-barrel foregrip compatibility in BD.
        sockets = weapon['assembly']['socketProviders']['13050000424']['sockets']
        bd_foregrips = {
            '13140000021', '13140000023', '13140000025', '13140000026',
            '13140000029', '13140000032', '13140000033', '13140000035',
            '13140000037', '13140000038', '13140000040', '13140000043',
        }
        for index, socket in enumerate(sockets):
            if socket['socketId'] == 8 and 'modes' not in socket:
                sockets[index:index + 1] = [
                    {**socket, 'modes': ['sol', 'mp']},
                    {**socket, 'optionItemIds': [
                        item for item in socket['optionItemIds'] if item in bd_foregrips
                    ], 'modes': ['bd']},
                ]
                break
    return weapon


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
    names[MONOLITH_ID] = MONOLITH_NAME
    slots[MONOLITH_ID] = 'magazine'
    return dict(weapons=weapons, names=names, slots=slots, shop=shop, prices=prices, provenance=dict(data_version=MANIFEST['dataVersion'], runtime_version=MANIFEST['version'], price_sources=sources, model_policies={'laser_bonus_stacking': 'strongest_per_stat_v1'}, global_verified=False))


def execute(action, request, on_progress=None):
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
    if on_progress is not None:
        payload['stream_progress'] = True
    with tempfile.TemporaryDirectory(prefix='df-builder-') as directory:
        source = Path(directory) / 'input.json'
        source.write_text(json.dumps(payload), 'utf-8')
        if on_progress is not None:
            return execute_stream(source, on_progress)
        # Exhaustive screening has no deadline; the solve budget starts at calibration.
        timeout = None if action == 'optimize' else 180
        result = subprocess.run(['node', str(ROOT / 'tools/builder_bridge.mjs'), str(source), str(REFERENCE)], capture_output=True, text=True, encoding='utf-8', timeout=timeout)
    if result.returncode:
        error = next((line.strip() for line in result.stderr.splitlines() if line.startswith('Error:')), 'The model could not resolve this build.')
        raise ValueError(error.removeprefix('Error: '))
    return json.loads(result.stdout)


def execute_stream(source, on_progress):
    """Heartbeat writes detect disconnected browsers even during a SCIP solve."""
    with tempfile.TemporaryFile(mode='w+', encoding='utf-8') as errors:
        process = subprocess.Popen(['node', str(ROOT / 'tools/builder_bridge.mjs'), str(source), str(REFERENCE)], stdout=subprocess.PIPE, stderr=errors, text=True, encoding='utf-8')
        lines = Queue()

        def read_lines():
            try:
                for line in process.stdout:
                    lines.put(line)
            finally:
                lines.put(None)

        reader = threading.Thread(target=read_lines, daemon=True)
        reader.start()
        result = None
        try:
            while True:
                try:
                    line = lines.get(timeout=1)
                except Empty:
                    on_progress(None)
                    continue
                if line is None:
                    break
                event = json.loads(line)
                if 'progress' in event:
                    on_progress(event['progress'])
                if 'result' in event:
                    result = event['result']
            process.wait()
            if process.returncode or result is None:
                errors.seek(0)
                error = next((line.strip() for line in errors if line.startswith('Error:')), 'Search ended without a complete result.')
                raise ValueError(error.removeprefix('Error: '))
            return result
        finally:
            if process.poll() is None:
                process.kill()
            process.wait()
            reader.join(timeout=2)
            process.stdout.close()


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript'}

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
            if action == 'optimize' and self.headers.get('X-Progress-Stream') == '1':
                self.send_response(200)
                self.send_header('Content-Type', 'application/x-ndjson; charset=utf-8')
                self.end_headers()

                def send(event):
                    self.wfile.write((json.dumps(event, ensure_ascii=False) + '\n').encode('utf-8'))
                    self.wfile.flush()

                try:
                    result = execute(action, request, lambda progress: send({'progress': progress} if progress else {'heartbeat': True}))
                    send({'result': result})
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    return  # execute_stream has already stopped the subprocess.
                except (ValueError, TypeError, KeyError) as error:
                    try:
                        send({'error': str(error)})
                    except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                        pass
                return
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
