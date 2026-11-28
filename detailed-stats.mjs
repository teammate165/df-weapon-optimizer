export const detailedStats = {
  adsTime: {label:'ADS time', unit:'ms', direction:'max', path:['handling','adsTimeMs']},
  adsSpeed: {label:'ADS movement speed', unit:'m/s', direction:'min', path:['handling','adsMoveSpeed']},
  velocity: {label:'Muzzle velocity', unit:'m/s', direction:'min', path:['weaponStats','muzzleVelocityMps']},
  horizontal: {label:'Horizontal recoil', unit:'×', direction:'max', path:['recoil','autoHorizontal']},
  vertical: {label:'Vertical recoil', unit:'×', direction:'max', path:['recoil','autoVertical']},
  randomKick: {label:'Random weapon kick', unit:'×', direction:'max', path:['recoil','randomKick']},
  springKick: {label:'Spring weapon kick', unit:'×', direction:'max', path:['recoil','springKick']},
  gunStability: {label:'Gun Stability', unit:'?', direction:'max', path:['recoil','fireWeaponStability']},
  breath: {label:'Breath sway range', unit:'°', direction:'max', path:['stability','breathRangeDeg']},
  movementSway: {label:'ADS movement sway', unit:'×', direction:'max', path:['stability','moveStability']},
};

export function detailedValue(current, id) {
  const [group, key] = detailedStats[id].path;
  return current?.[group]?.[key];
}
