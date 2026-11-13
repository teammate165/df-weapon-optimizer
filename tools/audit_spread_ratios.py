"""Audit static source spread ratios across all weapons/modes and hip profiles."""
import json
import sqlite3
import subprocess
from pathlib import Path
from sync_dfttk_database import ROOT, assemble, load


def main():
    manifest = load('manifest.json')
    classes = {'突击步枪': 'AR', '冲锋枪': 'SMG', '轻机枪': 'LMG',
               '精确射手步枪': 'MR', '狙击步枪': 'SR', '特殊武器': 'Special', '手枪': 'Pistol'}
    with sqlite3.connect(f'{(ROOT / "delta_force_weapons.sqlite").as_uri()}?mode=ro', uri=True) as db:
        names = {wid: (name, classes.get(category, 'Shotgun' if '霰弹枪' in name else 'Unclassified'))
                 for wid, name, category in db.execute('SELECT weapon_id,name,category FROM weapons WHERE is_variant=0')}
    translations = json.loads((ROOT / 'translation/translations.json').read_text('utf-8'))
    inputs = []
    for wid, entry in manifest['weaponPacks'].items():
        pack = assemble(entry)
        name, category = names[wid]
        name = translations.get('weapon:' + wid + ':base', {}).get('english') or name
        inputs.append(dict(pack=pack, name=name, category=category))
    directory = ROOT / '.scratch/spread-ratios'
    directory.mkdir(parents=True, exist_ok=True)
    source = directory / 'inputs.json'
    source.write_text(json.dumps(inputs), 'utf-8')
    script = r'''
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const [source,runtime]=process.argv.slice(1);
const curves=await import(pathToFileURL(runtime+'/curves.mjs'));
const kernel=await import(pathToFileURL(runtime+'/kernel.mjs'));
const rows=[],profiles=[];
for(const {pack,name,category} of JSON.parse(fs.readFileSync(source,'utf8'))){
 for(const mode of ['sol','mp','bd']){
  const build=curves.o(pack,[],mode),state=kernel.u(pack,build,{mode,tunes:{}});
  const profile=pack.handling.spreadProfiles[state.references.waistSpreadProfileId];
  const idle=state.value('GSpread_Hip',profile.baseSpreadDegrees.horizontal);
  const maximum=state.value('GSpread_Hip_Continuous',profile.maximumSpreadDegrees.horizontal);
  rows.push({weapon_id:pack.weaponId,name,category,mode,profile_id:state.references.waistSpreadProfileId,
   idle_deg:idle,moving_deg:idle*profile.runtimeScaleFactor,moving_idle_ratio:idle===0?null:profile.runtimeScaleFactor,
   declared_movement_scale:profile.runtimeScaleFactor,max_deg:maximum,max_idle_ratio:idle===0?null:maximum/idle});
 }
 const ids=new Set([pack.weapon.references.waistSpreadProfileId]);
 for(const modes of Object.values(pack.effectsByItemId))for(const effects of Object.values(modes))
  for(const effect of effects)if(effect.target==='WaistShootSpreadId')ids.add(effect.value);
 for(const id of ids){const p=pack.handling.spreadProfiles[id];if(p)profiles.push({weapon_id:pack.weaponId,category,profile_id:id,
  movement_scale:p.runtimeScaleFactor,idle_deg:p.baseSpreadDegrees.horizontal,max_deg:p.maximumSpreadDegrees.horizontal});}
}
console.log(JSON.stringify({rows,profiles}));
'''
    result = subprocess.run(['node', '--input-type=module', '-e', script, str(source), str(ROOT/'.scratch/calibration-check')],
                            check=True, capture_output=True, text=True, encoding='utf-8')
    report = dict(data_version=manifest['dataVersion'], runtime_version=manifest['version'],
                  global_verified=False, **json.loads(result.stdout))
    output = ROOT/'data/spread_ratio_audit.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', 'utf-8')
    for category in sorted({r['category'] for r in report['rows']}):
        rows = [r for r in report['rows'] if r['category']==category]
        print(category, len(rows)//3, 'weapons;', 'movement scales:', sorted({r['declared_movement_scale'] for r in rows}),
              'max/idle:', sorted({round(r['max_idle_ratio'],6) for r in rows if r['max_idle_ratio'] is not None}))
    print('Hip profile movement scales:', sorted({p['movement_scale'] for p in report['profiles']}))
    print('Wrote', output)


if __name__ == '__main__':
    main()
