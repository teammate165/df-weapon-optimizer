"""Offline experimental optimizer. See docs/recoil_generator.md."""
import argparse
import hashlib
import json
import sqlite3
import subprocess
from pathlib import Path
from sync_dfttk_database import ROOT, assemble, load
from prepare_project_runtime import prepare


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('request', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    request = json.loads(args.request.read_text('utf-8'))
    aliases = {'detonation': 'bd', 'blasting': 'bd', 'operations': 'sol', 'firefight': 'sol', 'warfare': 'mp'}
    request['mode'] = aliases.get(request['mode'].lower(), request['mode'].lower())
    if request['mode'] not in ('bd', 'sol', 'mp'):
        raise ValueError('Unknown mode')
    manifest = load('manifest.json')
    pack = assemble(manifest['weaponPacks'][str(request['weapon_id'])])
    directory = ROOT / '.scratch' / 'generator'
    directory.mkdir(parents=True, exist_ok=True)
    # Reuse the preserved, previously checked source snapshot without network access.
    reference = ROOT / '.scratch' / 'calibration-check'
    prepare(reference)
    calculator_hashes = {}
    for name in ('curves.mjs', 'kernel.mjs', 'attributes.mjs', 'laser_effects.mjs'):
        if not (reference / name).exists():
            raise ValueError('Run tools/verify_calibration_reference.py first')
        body = (reference / name).read_bytes()
        (directory / name).write_bytes(body)
        calculator_hashes[name] = hashlib.sha256(body).hexdigest()
    with sqlite3.connect(ROOT / 'delta_force_weapons.sqlite') as db:
        prices = {item: price for item, price in db.execute("SELECT item_id,price_daily FROM prices WHERE item_type='part'")}
        sources = [dict(zip(('type', 'currency', 'updated_at', 'source'), row)) for row in db.execute('SELECT item_type,currency,updated_at,source FROM price_sources')]
        # The original shop catalog, including tiers, is also preserved in dfttk_raw_files.
        shop = json.loads(db.execute("SELECT record_json FROM dfttk_raw_files WHERE path='catalog/bd-shop.json' ORDER BY rowid DESC LIMIT 1").fetchone()[0])
    payload = dict(request=request, pack=pack, shop=shop, prices=prices,
                   provenance=dict(data_version=manifest['dataVersion'], runtime_version=manifest['version'], calculator_module_sha256=calculator_hashes, price_sources=sources, model_policies={'laser_bonus_stacking': 'strongest_per_stat_v1'}, global_verified=False))
    input_path = directory / 'input.json'
    input_path.write_text(json.dumps(payload), encoding='utf-8')
    subprocess.run(['node', str(ROOT / 'tools' / 'recoil_generator.mjs'), str(input_path), str(args.output.resolve())], check=True)


if __name__ == '__main__':
    main()
