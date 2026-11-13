"""Replay representative detailed-stat interventions in the preserved calculator."""
import json
import subprocess
from sync_dfttk_database import ROOT, assemble, load


def main():
    manifest = load('manifest.json')
    specs = [
        ('18010000001','13130000167','bd','GRecoil_H'),
        ('18010000001','13130000167','bd','GRecoil_HShake'),
        ('18010000001','13130000167','bd','GGunkickH'),
        ('18010000001','13130000168','bd','GRecoil_V'),
        ('18010000001','13030000178','bd','GAiming_ADSTime'),
        ('18010000006','13020000355','mp','GSprintToFireTime'),
        ('18010000006','13120000241','bd','ChangeClipTimewhenEmpty'),
        ('18010000001','13140000038','bd','WeaponAppearanceTable.HoldBreathId.StandBreathFactor'),
        ('18010000001','13030000109','bd',None),
    ]
    directory = ROOT/'.scratch/detailed-stat-examples'
    directory.mkdir(parents=True, exist_ok=True)
    source = directory/'inputs.json'
    source.write_text(json.dumps([dict(weapon_id=w,item_id=i,mode=m,target=t,
         pack=assemble(manifest['weaponPacks'][w])) for w,i,m,t in specs]),'utf-8')
    script = r'''
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const [source,runtime]=process.argv.slice(1);
const curves=await import(pathToFileURL(runtime+'/curves.mjs'));
const {t:calculate}=await import(pathToFileURL(runtime+'/attributes.mjs'));
const rows=[];
for(const {pack,...spec} of JSON.parse(fs.readFileSync(source,'utf8'))){
 const base=curves.o(pack,[],spec.mode);
 const slot=base.slots.find(s=>s.options.includes(spec.item_id));
 assert(slot,'Example must mount on a default-visible socket: '+spec.item_id);
 const build=curves.o(pack,[{slotPath:slot.slotPath,itemId:spec.item_id}],spec.mode);
 assert(build.mounted.some(m=>m.itemId===spec.item_id),'Example was displaced');
 const options={mode:spec.mode,resolvedLoadout:build,tunes:{},preservePrecision:true,tacticalEffective:true};
 const snapshot=p=>{const c=calculate(p,options).current;return {main:c.mainAttr,raw:c.raw,handling:c.handling,stability:c.stability};};
 const equipped=snapshot(pack);
 if(spec.target){
  const probe=structuredClone(pack);
  const effects=probe.effectsByItemId[spec.item_id][spec.mode];
  assert(effects.some(e=>e.target===spec.target),'Example target must exist');
  probe.effectsByItemId[spec.item_id][spec.mode]=effects.filter(e=>e.target!==spec.target);
  const without_direct_target=snapshot(probe);
  assert.deepEqual(equipped.main,without_direct_target.main,'Direct target must bypass main points');
  const output_changed=JSON.stringify(equipped)!==JSON.stringify(without_direct_target);
  if(spec.item_id!=='13140000038')assert(output_changed,'Direct target must reach public output');
  rows.push({...spec,config:build.config,kind:'same-build direct-target removal diagnostic; not another legal build',
    tactical_effective:true,output_changed,equipped,without_direct_target});
 }else{
  for(const id of pack.parts[spec.item_id].tuneIds){
   const mounted=build.mounted.find(m=>m.itemId===spec.item_id);
   const control=curves.c(pack,mounted,id);
   assert(control&&control.enabled!==false);
   const value=curves.n(control).at(-1);
   options.tunes={[slot.slotPath]:{[id]:value}};
   const tuned=snapshot(pack);
   assert.deepEqual(equipped.main,tuned.main,'Calibration example must retain main points');
   assert.notDeepEqual(equipped,tuned,'Calibration must reach public output');
   rows.push({...spec,config:build.config,kind:'legal same-build calibration',tune_id:id,tunes:options.tunes,equipped,tuned});
  }
 }
}
console.log(JSON.stringify(rows));
'''
    process = subprocess.run(['node','--input-type=module','-e',script,str(source),str(ROOT/'.scratch/calibration-check')],
                             capture_output=True,text=True,encoding='utf-8')
    if process.returncode:
        raise RuntimeError(process.stderr)
    rows = json.loads(process.stdout)
    output = ROOT/'data/detailed_stat_examples.json'
    output.write_text(json.dumps(dict(data_version=manifest['dataVersion'],global_verified=False,examples=rows),ensure_ascii=False,indent=2)+'\n','utf-8')
    print(f'{len(rows)} source-calculator checks passed; {output}')


if __name__ == '__main__':
    main()
