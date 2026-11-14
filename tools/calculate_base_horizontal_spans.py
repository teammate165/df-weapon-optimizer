"""Reproduce 20-shot default ADS spans: python tools/calculate_base_horizontal_spans.py."""
import csv
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
    scratch = ROOT / '.scratch/horizontal-recoil'
    scratch.mkdir(parents=True, exist_ok=True)
    payload = scratch / 'all-base-packs.json'
    payload.write_text(json.dumps(dict(data_version=manifest['dataVersion'], weapons=[
        dict(pack=assemble(spec), name=names.get(wid, wid))
        for wid, spec in manifest['weaponPacks'].items()])), encoding='utf-8')
    output = ROOT / 'data/base_horizontal_spans.json'
    subprocess.run(['node', str(ROOT / 'tools/base_horizontal_spans.mjs'), str(payload), str(output)], check=True)
    result = json.loads(output.read_text('utf-8'))
    automatic = [r for r in result['rows'] if r['automatic']]
    with (ROOT / 'data/base_horizontal_spans.csv').open('w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['weapon_id', 'name', 'mode', 'status', 'horizontal_span_model_units', 'reason', 'shorter_magazine_shots', 'shorter_magazine_span'])
        for r in automatic:
            writer.writerow([r['weapon_id'], r['name'], r['mode'], r['status'],
                             (r['metrics'] or {}).get('horizontal_span_model_units', ''), r['reason'],
                             (r['shorter_magazine'] or {}).get('shot_count', ''),
                             ((r['shorter_magazine'] or {}).get('metrics') or {}).get('horizontal_span_model_units', '')])
    ranked = sorted([r for r in automatic if r['mode'] == 'bd' and r['metrics']],
                    key=lambda r: r['metrics']['horizontal_span_model_units'], reverse=True)
    threshold = 1.5  # User-selected excessive-horizontal threshold.
    lines = ['# Base automatic-weapon horizontal spans', '',
             '20-shot uninterrupted ADS, resolved base configuration, no user tuning. '
             'Span = max(x) - min(x) across all 20 post-shot source-chart points. '
             'Units are source-model units, not calibrated angles or client measurements.', '',
             f"Source snapshot: `{result['data_version']}`. Reproduce: `python tools/calculate_base_horizontal_spans.py`.", '',
             '| Rank | Weapon | Weapon ID | Detonation span | Above threshold 1.5 |',
             '| --- | --- | --- | ---: | --- |']
    for rank, r in enumerate(ranked, 1):
        h = r['metrics']['horizontal_span_model_units']
        lines.append(f"| {rank} | {r['name']} | `{r['weapon_id']}` | {h:.4f} | {'Yes' if h > threshold + 1e-12 else 'No'} |")
    excluded = [r for r in automatic if r['mode'] == 'bd' and not r['metrics']]
    lines += ['', f'{len(ranked)} automatic weapons calculated in Detonation; {len(excluded)} automatic weapons unavailable.', '']
    for r in excluded:
        lines.append(f"- {r['name']} (`{r['weapon_id']}`): {r['reason']}.")
    lines += ['', '## Shorter base magazines: separate full-magazine windows', '',
              'These spans use fewer shots and must not be ranked against the 20-shot threshold.', '',
              '| Weapon | Shots | Horizontal span |', '| --- | ---: | ---: |']
    for r in excluded:
        short = r['shorter_magazine']
        if short and short['metrics']:
            lines.append(f"| {r['name']} | {short['shot_count']} | {short['metrics']['horizontal_span_model_units']:.4f} |")
    by_id = {}
    for r in automatic:
        by_id.setdefault(r['weapon_id'], []).append(r)
    same = all(len(rs) == 3 and len({json.dumps(r['metrics'], sort_keys=True) for r in rs}) == 1 for rs in by_id.values())
    lines += ['', f'All three modes have identical metrics/status availability: {same}.', '',
              'JSON retains all weapon/mode rows, including nonautomatic exclusions. CSV contains all automatic weapon/mode rows, including unavailable values. No magazine truncation, invented dynamics, or synthetic jitter. Base fire-mode capability is used; automatic conversions requiring attachments are excluded. Translation names remain provisional.', '',
              '[All-mode CSV](../data/base_horizontal_spans.csv) | [Full JSON](../data/base_horizontal_spans.json)', '']
    (ROOT / 'docs/base_horizontal_spans.md').write_text('\n'.join(lines), encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
