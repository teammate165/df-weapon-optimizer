"""Build per-weapon/mode stat responses and publication-ready reference figures.

uv run --no-project tools/verify_calibration_reference.py
uv run --no-project --with matplotlib tools/generate_stat_curves.py
"""
import csv
import hashlib
import json
import subprocess
from pathlib import Path

from sync_dfttk_database import ROOT, assemble, load


def main():
    manifest = load('manifest.json')
    sources = load('download_provenance.json')
    for relative, source in sources.items():
        cache = ROOT / 'data' / 'dfttk' / relative
        if hashlib.sha256(cache.read_bytes()).hexdigest() != source['sha256']:
            raise ValueError(f'Cache mismatch: {relative}')
    reference = ROOT / '.scratch' / 'calibration-check'
    if not (reference / 'kernel.mjs').exists():
        raise ValueError('Run tools/verify_calibration_reference.py first')
    work = ROOT / '.scratch' / 'stat-curves'
    packs = work / 'packs'
    packs.mkdir(parents=True, exist_ok=True)
    translations = json.loads((ROOT / 'translation' / 'translations.json').read_text('utf-8'))
    names = load('locales/zh-CN/items.json')['items']
    weapons = []
    for wid, spec in manifest['weaponPacks'].items():
        (packs / (wid + '.json')).write_text(json.dumps(assemble(spec)), encoding='utf-8')
        weapons.append(dict(id=wid, name=names.get(wid, wid),
            english=translations.get('weapon:' + wid + ':base', {}).get('english') or wid))
    (work / 'inputs.json').write_text(json.dumps(dict(weapons=weapons,
        data_version=manifest['dataVersion'], runtime_version=manifest['version'],
        source_snapshot=manifest['resourceBaseUrl'])), encoding='utf-8')
    subprocess.run(['node', str(ROOT / 'tools' / 'build_stat_curves.mjs'), str(work), str(reference)], check=True)
    data = json.loads((work / 'responses.json').read_text('utf-8'))
    checks = json.loads((ROOT / 'data' / 'calibration' / 'reference_checks.json').read_text('utf-8'))
    data['calculator_sources'] = checks['sources']
    data['generator'] = 'tools/generate_stat_curves.py + tools/build_stat_curves.mjs'
    output = ROOT / 'data' / 'stat_curves'
    output.mkdir(exist_ok=True)
    # Keep machine-readable output compact and supply a browser-local viewer.
    (output / 'responses.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (output / 'responses.js').write_text('window.STAT_CURVES=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    with (output / 'responses.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['weapon_id','name','mode','stat','effective_main_points','metric','unit','value','default_main_points','default_value','relative_to_default'])
        for response in data['responses']:
            for line in response['series']:
                for x, y in zip(response['xs'], line['values']):
                    writer.writerow([response['weapon_id'],response['name'],response['mode'],response['stat'],x,line['key'],line['unit'],y,
                        response['base_x'],line['baseline'],y/line['baseline'] if line['baseline'] else ''])
    plot_reference(data, output)
    print('Outputs:', output, flush=True)


def plot_reference(data, output):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    selected = [r for r in data['responses'] if r['weapon_id']=='18010000001' and r['mode']=='sol']
    figure, axes = plt.subplots(2, 2, figsize=(14, 9), constrained_layout=True)
    titles = dict(control='Control', handling='Handling', stability='Stability', accuracy='Hip-fire accuracy')
    colors = ['#126b9d','#c36316','#29803e','#9b439b','#947100','#b82b4e','#477777']
    for axis, response in zip(axes.flat, selected):
        seen = set()
        for index, line in enumerate(response['series']):
            if not line['baseline']:
                continue
            normalized = tuple(round(y/line['baseline']*100, 8) for y in line['values'])
            # Consolidate coincident curves while retaining all raw series in exports.
            if normalized in seen:
                continue
            seen.add(normalized)
            peers = [s['label'] for s in response['series'] if s['baseline'] and
                     tuple(round(y/s['baseline']*100,8) for y in s['values'])==normalized]
            label = ' / '.join(peers)
            peer_keys = {s['key'] for s in response['series'] if s['label'] in peers}
            if peer_keys == {'auto_vertical','auto_horizontal','single_vertical','single_horizontal'}:
                label = 'Horizontal / vertical recoil (auto + single)'
            elif peer_keys == {'random_kick','spring_kick'}:
                label = 'Random / spring weapon kick'
            elif peer_keys == {'camera_h','camera_v'}:
                label = 'Horizontal / vertical firing camera shake'
            elif peer_keys == {'hip_deg','hip_max_deg','hip_moving_deg'}:
                label = 'Initial / maximum / moving hip spread'
            axis.plot(response['xs'], normalized, label=label, color=colors[index%len(colors)], linewidth=1.8)
        axis.axhline(100, color='#777777', linewidth=.7, linestyle='--')
        axis.axvline(response['base_x'], color='#777777', linewidth=.7, linestyle=':')
        axis.set(title=titles[response['stat']], xlabel='Effective main attribute points', ylabel='Response relative to default (%)')
        axis.grid(alpha=.2)
        axis.legend(fontsize=7, loc='best')
    figure.suptitle('M4A1 | Operations (sol) | dfttk model responses\nOne main attribute varied; default build fixed; 100% = its default performance', fontsize=14)
    for ext in ['png','svg','pdf']:
        figure.savefig(output / ('m4a1_sol_response_curves.' + ext), dpi=180)
    plt.close(figure)


if __name__ == '__main__':
    main()
