"""Audit every local weapon/part mode against atlas effects; optionally fetch live atlas."""
import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from fetch_dfttk import fetch, ORIGIN, ROOT
from sync_dfttk_database import assemble, load


def audit(live=False):
    manifest = load('manifest.json')
    folder = ROOT / 'data/special_effect_audit'
    folder.mkdir(parents=True, exist_ok=True)
    current = None
    live_changes = []
    if live or (folder / 'live-manifest.json').exists():
        raw = fetch(ORIGIN + '/data/v3/manifest.json') if live else (folder / 'live-manifest.json').read_bytes()
        current = json.loads(raw)
        (folder / 'live-manifest.json').write_bytes(raw)
        for mode, path in current['entrypoints']['library'].items():
            raw = fetch(ORIGIN + current['resourceBaseUrl'].rstrip('/') + '/' + path) if live else (folder / ('live-library-' + mode + '.json')).read_bytes()
            if hashlib.sha256(raw).hexdigest() != current['files'][path]['sha256']:
                raise ValueError('Live atlas hash mismatch: ' + path)
            (folder / ('live-library-' + mode + '.json')).write_bytes(raw)
            incoming = json.loads(raw)
            previous = load(path)
            for kind in ('weapons', 'parts'):
                for item in sorted(set(incoming[kind]) | set(previous[kind])):
                    if incoming[kind].get(item) != previous[kind].get(item):
                        live_changes.append(dict(mode=mode, kind=kind, item_id=item,
                                                 before=previous[kind].get(item), after=incoming[kind].get(item)))
    libraries = {mode: load('library/' + mode + '.json') for mode in ('sol', 'mp', 'bd')}
    missing = []
    scopes = Counter()
    operations = Counter()
    targets = Counter()
    tactical = {}
    special_parts = {}
    weapons = []
    checked = 0
    for weapon, spec in manifest['weaponPacks'].items():
        pack = assemble(spec)
        weapons.append(dict(weapon_id=weapon, effects=pack['effectsByItemId'].get(weapon),
                            special_fire=pack.get('combat', {}).get('specialFire', {})))
        for item, part in pack['parts'].items():
            for mode, library in libraries.items():
                entry = library['parts'].get(item)
                if not entry:
                    continue
                for effect in entry.get('effects', []):
                    if weapon not in effect.get('weaponIds', []):
                        continue
                    checked += 1
                    source = effect['data'].get('operations', [])
                    actual = pack['effectsByItemId'].get(item, {}).get(mode) or []
                    absent = [op for op in source if op not in actual]
                    if absent:
                        missing.append(dict(weapon_id=weapon, item_id=item, mode=mode, operations=absent))
                    for op in source:
                        scopes[op.get('scope', 'NONE')] += 1
                        operations[op['operation']] += 1
                        targets[op['target']] += 1
                    active = [op for op in source if op.get('scope') == 'TacticalEffective']
                    if active:
                        tactical.setdefault(item, dict(name=entry['name'], modes={} ))['modes'][mode] = active
                    special = [op for op in source if not op['target'].startswith(('DisplayAttrValues.', 'WeaponMainAttribute.MainAttrValues.'))]
                    data = effect['data']
                    if special or data.get('override') or data.get('bulletProfile') or data.get('damageProfile'):
                        special_parts.setdefault(item, dict(name=entry['name'], contexts=[]))['contexts'].append(
                            dict(weapon_id=weapon, mode=mode, operations=special,
                                 override=data.get('override'), bullet_profile=data.get('bulletProfile'), damage_profile=data.get('damageProfile')))
    # Textual consumer scan is a conservative review queue, not proof that an
    # effect is absent: some combat effects are represented by explicit profiles.
    runtime = ''.join((ROOT / ('.scratch/calibration-check/' + name + '.mjs')).read_text('utf-8')
                      for name in ('kernel', 'attributes'))
    consumer_review = []
    for target in targets:
        if target.startswith(('DisplayAttrValues.', 'WeaponMainAttribute.')) or target in runtime:
            continue
        affected = []
        for item, part in special_parts.items():
            contexts = [dict(weapon_id=c['weapon_id'], mode=c['mode']) for c in part['contexts']
                        if any(op['target'] == target for op in c['operations'])]
            if contexts:
                affected.append(dict(item_id=item, name=part['name'], contexts=contexts))
        weapon_effects = [dict(weapon_id=w['weapon_id'], mode=mode, operations=[op for op in ops or [] if op['target'] == target])
                          for w in weapons for mode, ops in (w['effects'] or {}).items()
                          if any(op['target'] == target for op in ops or [])]
        consumer_review.append(dict(target=target, status='needs-consumer-review', parts=affected, weapon_effects=weapon_effects))
    game_text = load('runtime-ui.json').get('attachmentGameText', {})
    game_text_inventory = [dict(caption_id=caption, caption=label,
        parts=[dict(item_id=item, source_modes=[mode for mode, ids in modes.items() if int(caption) in ids])
               for item, modes in game_text.get('parts', {}).items()
               if any(int(caption) in ids for ids in modes.values())])
        for caption, label in game_text.get('captions', {}).items()]
    report = dict(audited_at=datetime.now(timezone.utc).isoformat(), local_version=manifest['version'],
                  data_version=manifest['dataVersion'], game_build_version='unknown',
                  live_version=current['version'] if current else None, live_changes=live_changes,
                  summary=dict(weapons=len(weapons), library_part_mode_rows=sum(len(l['parts']) for l in libraries.values()),
                               checked_weapon_part_mode_contexts=checked, missing_operation_contexts=len(missing),
                               tactical_items=len(tactical), special_parts=len(special_parts)),
                  missing=missing, consumer_review=consumer_review, scopes=dict(scopes), operations=dict(operations), targets=dict(targets),
                  game_text_source=game_text.get('source'), game_text_inventory=game_text_inventory,
                  tactical_items=tactical, special_parts=special_parts, weapons=weapons)
    (folder / 'audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(json.dumps(report['summary']))
    print('Live atlas changed rows:', len(live_changes))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true')
    audit(parser.parse_args().live)
