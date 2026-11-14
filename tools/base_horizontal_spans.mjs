// Input: assembled packs and names. Uses preserved source runtime, never the optimizer proxy.
import fs from 'node:fs';
import * as curves from '../.scratch/calibration-check/curves.mjs';
import * as kernel from '../.scratch/calibration-check/kernel.mjs';
import {t as calculate} from '../.scratch/calibration-check/attributes.mjs';
import {timedRecoil} from './timed_recoil.mjs';

const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const rows=[];
for(const {pack,name} of input.weapons) for(const mode of ['bd','sol','mp']) {
  const build=curves.o(pack,[],mode);
  const path=timedRecoil(pack,build,{}, {mode,shot_count:20},{curves,kernel,calculate});
  const shorter=path.fire_control.supportedModes.includes('Auto') && path.capacity<20 && path.capacity>=2
    ?timedRecoil(pack,build,{}, {mode,shot_count:path.capacity},{curves,kernel,calculate}):null;
  rows.push({weapon_id:pack.weaponId,name,mode,automatic:path.fire_control.supportedModes.includes('Auto'),
    status:path.status,reason:path.reason??null,capacity:path.capacity,
    profile_id:path.recoil_profile_id,metrics:path.metrics??null,
    shorter_magazine:shorter?{shot_count:path.capacity,status:shorter.status,metrics:shorter.metrics??null}:null});
}
fs.writeFileSync(process.argv[3],JSON.stringify({data_version:input.data_version,shot_count:20,
  definition:'max(x) - min(x), first through twentieth post-shot ADS chart points; source-model units',
  default_configuration:'Resolved empty selection, source defaults retained, no user tuning',
  global_verified:false,rows},null,2)+'\n');
