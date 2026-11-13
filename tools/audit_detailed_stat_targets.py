"""Inventory observed attachment/calibration targets, not hypothetical support."""
import json
import sqlite3
from collections import defaultdict
from sync_dfttk_database import ROOT, assemble, load

TARGETS = {
    'control': ['GRecoil_H', 'GRecoil_V', 'GRecoil_H_singleorburst', 'GRecoil_V_singleorburst',
                'GGunkickRandom', 'GGunkickSpring', 'GGunKickH', 'GGunKickV', 'GGunkickH',
                'GGunkickV', 'GGunkick_ADSRecoilH', 'GRecoilRecovery'],
    'handling': ['GAiming_ADSTime', 'GSprintToFireTime', 'GMovement_ADSSpeed',
                 'GMovement_SilentWalkSpeed', 'GMovement_WalkSpeed', 'GMovement_SprintSpeed',
                 'GReload_Time', 'ChangeClipTime', 'ChangeClipTimewhenEmpty'],
    'stability': ['GBreathScale', 'WeaponAppearanceTable.HoldBreathId.StandBreathFactor',
                  'GBreathTime', 'GBreathRecoil', 'BehitGunSway', 'AimMoveGunSway',
                  'GRecoil_HShake', 'GRecoil_VShake'],
}
TARGETS['handling'] += ['SprintToFireSpeed', 'SuperSprintToFireSpeed']
TARGETS['stability'] += ['GunSwayBeHitscale', 'CameraSwayBeHitScale',
    'WeaponAppearanceTable.HoldBreathId.CrouchBreathFactor',
    'WeaponAppearanceTable.HoldBreathId.ProneBreathFactor']


def main():
    manifest = load('manifest.json')
    with sqlite3.connect(f'{(ROOT/"delta_force_weapons.sqlite").as_uri()}?mode=ro', uri=True) as db:
        names = {i: dict(original=n, slot=s) for i, n, s in db.execute('SELECT item_id,name,slot FROM parts')}
    translations = json.loads((ROOT/'translation/translations.json').read_text('utf-8'))
    direct, tuning, replacements = {}, {}, {}
    interesting = {t for ts in TARGETS.values() for t in ts}
    for wid, entry in manifest['weaponPacks'].items():
        pack = assemble(entry)
        for item, modes in pack['effectsByItemId'].items():
            if item == wid:
                continue
            meta = dict(item_id=item, **names.get(item, {}), english=translations.get('part:'+item, {}).get('english'))
            for mode, effects in modes.items():
                active = [e for e in effects if e.get('modifier') == 'Initial' or e.get('value') != 0]
                siblings = [e for e in active if e.get('target') in interesting or e.get('target','').startswith('WeaponMainAttribute.')]
                for e in active:
                    target = e.get('target','')
                    if target in interesting:
                        key = (item, mode, json.dumps(e, sort_keys=True))
                        direct.setdefault(key, dict(**meta, mode=mode, effect=e, sibling_effects=siblings, weapon_ids=[]))['weapon_ids'].append(wid)
                    if e.get('modifier') == 'Initial' and any(k in target for k in ['RecoilId','MovementSpeedId','AimingId','HoldBreath','SpreadId']):
                        replacements.setdefault((item, mode, target), dict(**meta, mode=mode, effect=e, weapon_ids=[]))['weapon_ids'].append(wid)
            for tid in pack['parts'].get(item, {}).get('tuneIds', []):
                tune = pack['tunes'][tid]
                functions = tune.get('functions', [])
                for f in functions:
                    if f.get('target') not in interesting:
                        continue
                    key = (item, tid, json.dumps(f, sort_keys=True))
                    tuning.setdefault(key, dict(**meta, tune_id=tid, labels=tune.get('labels'), range=tune.get('range'),
                        function=f, curve=pack['curves'].get(f.get('curveId')), sibling_functions=functions, weapon_ids=[]))['weapon_ids'].append(wid)
    result = dict(data_version=manifest['dataVersion'], runtime_version=manifest['version'],
                  global_verified=False, families=TARGETS, direct=list(direct.values()),
                  calibration=list(tuning.values()), profile_replacements=list(replacements.values()))
    output = ROOT/'data/detailed_stat_target_audit.json'
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n','utf-8')
    for family, targets in TARGETS.items():
        print(family)
        for target in targets:
            a=[r for r in result['direct'] if r['effect']['target']==target]
            b=[r for r in result['calibration'] if r['function']['target']==target]
            examples=[(r['item_id'],r.get('english') or r.get('original'),r['effect']['modifier'],r['effect'].get('value')) for r in a[:2]]
            print(target, 'direct',len(a),'tunes',len(b),str(examples).encode('ascii','backslashreplace').decode())
    print(output)


if __name__ == '__main__':
    main()
