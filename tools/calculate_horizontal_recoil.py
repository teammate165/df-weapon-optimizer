"""Refresh both origin-distance reports: python tools/calculate_horizontal_recoil.py."""
import json
import sqlite3
import subprocess
from sync_dfttk_database import ROOT, assemble, load


def main():
    manifest = load('manifest.json')
    translations = json.loads((ROOT / 'translation/translations.json').read_text('utf-8'))
    with sqlite3.connect(ROOT / 'delta_force_weapons.sqlite') as db:
        names = {wid: translations.get('weapon:' + key, {}).get('english') or name
                 for key, wid, name in db.execute('SELECT profile_key,weapon_id,name FROM weapons WHERE is_variant=0')}
    payload = ROOT / '.scratch/horizontal-recoil/all-base-packs.json'
    payload.parent.mkdir(parents=True, exist_ok=True)
    payload.write_text(json.dumps(dict(data_version=manifest['dataVersion'], weapons=[
        dict(pack=assemble(spec), name=names.get(wid, wid))
        for wid, spec in manifest['weaponPacks'].items()])), encoding='utf-8')
    subprocess.run(['node', str(ROOT / 'tools/horizontal_recoil_reports.mjs'), str(payload)], check=True)
    from calculate_horizontal_speed import main as speed_report
    speed_report()
    from audit_horizontal_window_speed import main as window_trial
    window_trial()


if __name__ == '__main__':
    main()
