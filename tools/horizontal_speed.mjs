// Exact maximum net speed of a piecewise-linear cumulative source-chart path.
export function fastestHorizontalSpeed(points,windowMs=200) {
  if(!(windowMs>0)||!Number.isFinite(windowMs)||points.length<2)throw Error('Invalid horizontal speed window');
  const times=points.map(p=>p.time_ms);
  if(points.some((p,i)=>!Number.isFinite(p.x)||!Number.isFinite(p.time_ms)||(i&&p.time_ms<=times[i-1])))throw Error('Invalid horizontal speed trajectory');
  const first=times[0],last=times.at(-1)-windowMs;
  if(last<first)throw Error('Trajectory shorter than horizontal speed window');
  const position=t=>{
    let i=0;
    while(i<points.length-2&&times[i+1]<=t)i++;
    const a=points[i],b=points[i+1];
    return a.x+(b.x-a.x)*(t-a.time_ms)/(b.time_ms-a.time_ms);
  };
  const starts=new Set([first,last]);
  for(const t of times)for(const start of [t,t-windowMs])if(start>=first&&start<=last)starts.add(start);
  let speed=-1,startMs=first;
  for(const start of [...starts].sort((a,b)=>a-b)) {
    const value=Math.abs(position(start+windowMs)-position(start))/(windowMs/1000);
    if(value>speed){speed=value;startMs=start;}
  }
  return {speed,start_ms:startMs,end_ms:startMs+windowMs};
}
export function horizontalSpeedMultiplier(speed) {
  if(!Number.isFinite(speed)||speed<0)throw Error('Invalid horizontal speed');
  return speed>5?5:speed>4?3:speed>3?2:1;
}
