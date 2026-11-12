export type LapResult = {
  session:{key:number;year:number;circuit:string};
  lap:{driver:number;driverName:string;duration:number;sector1?:number|null;sector2?:number|null;sector3?:number|null};
};
export function compareDrivers(a:LapResult|null,b:LapResult|null) {
  if (!a || !b) return null;
  if (a.session.key !== b.session.key || a.session.circuit !== b.session.circuit || a.session.year !== b.session.year || a.lap.driver === b.lap.driver) return null;
  if (![a.lap.duration,b.lap.duration].every(n => Number.isFinite(n) && n > 0)) return null;
  const delta = b.lap.duration-a.lap.duration;
  const sectors = (['sector1','sector2','sector3'] as const).map((key,index) => {
    const x=a.lap[key],y=b.lap[key];
    return {sector:index+1,delta:typeof x === 'number' && typeof y === 'number' && x > 0 && y > 0 ? y-x : null};
  });
  const gains = sectors.filter((s):s is {sector:number;delta:number} => s.delta != null).sort((x,y) => Math.abs(y.delta)-Math.abs(x.delta));
  return {delta,sectors,largestSector:gains[0] || null};
}
