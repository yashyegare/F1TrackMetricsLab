import { describe,it,expect,vi } from 'vitest';
vi.mock('../../services/apiClient',() => ({fetchAPI:vi.fn()}));
import { fetchAPI } from '../../services/apiClient';
import { completedRaceLaps,selectQualifyingSession,getLapTelemetry,getQualifyingData } from '../openf1';
import { compareDrivers } from '../../domain/driverComparison';
import { detectStraights } from '../drsDetect';
import { isDrsOpen } from '../drsStatus';
describe('session and timing integrity',() => {
  it('does not confuse DRS eligibility with activation',() => {
    expect(isDrsOpen(8)).toBe(false);expect(isDrsOpen(1)).toBe(false);
    expect(isDrsOpen(10)).toBe(true);expect(isDrsOpen(12)).toBe(true);expect(isDrsOpen(14)).toBe(true);
  });
  it('never substitutes race or sprint data for qualifying',() => {
    expect(selectQualifyingSession([{session_type:'Race',session_name:'Race'}])).toBeNull();
    expect(selectQualifyingSession([{session_type:'Qualifying',session_name:'Sprint Qualifying'}])).toBeNull();
  });
  it('returns no qualifying data for a race-only weekend',async () => {
    vi.mocked(fetchAPI).mockResolvedValueOnce([{session_key:10,session_type:'Race',session_name:'Race'}]);
    expect(await getQualifyingData('us-2012',2024)).toBeNull();
  });
  it('uses the maximum recorded completed race lap, not the row count',() => {
    expect(completedRaceLaps([{lap_number:1,lap_duration:90},{lap_number:2,lap_duration:91},{lap_number:1,lap_duration:92},{lap_number:70,lap_duration:null}])).toBe(2);
    expect(completedRaceLaps([])).toBeNull();
  });
  it('requests only the selected driver lap time window',async () => {
    const dates=['2024-01-01T00:00:00Z','2024-01-01T00:00:01Z'];
    vi.mocked(fetchAPI).mockImplementation(async endpoint => endpoint==='location' ? dates.map((date,i) => ({date,x:i+1,y:2})) : dates.map(date => ({date,speed:100,throttle:80,brake:0,drs:8,n_gear:5,rpm:10000})));
    const result=await getLapTelemetry('us-2012',2024,10,1,{date_start:dates[0],lap_duration:1,lap_number:1});
    expect(result.telemetry).toHaveLength(2);
    expect(fetchAPI).toHaveBeenCalledWith('location',expect.objectContaining({'date>':'2024-01-01T00:00:00.000Z','date<':'2024-01-01T00:00:01.000Z',driver_number:1}),undefined);
  });
  it('rejects timing comparisons across circuits, sessions or the same driver',() => {
    const a={session:{key:1,circuit:'Austin',year:2024},lap:{driver:1,driverName:'One',duration:90,sector1:30,sector2:30,sector3:30}};
    const b={session:a.session,lap:{driver:2,driverName:'Two',duration:91,sector1:30.2,sector2:30.7,sector3:30.1}};
    expect(compareDrivers(a,b)).toMatchObject({delta:1,largestSector:{sector:2}});
    expect(compareDrivers(a,{...b,session:{...a.session,key:2}})).toBeNull();
    expect(compareDrivers(a,{...b,session:{...a.session,circuit:'Monza'}})).toBeNull();
    expect(compareDrivers(a,a)).toBeNull();
  });
  it('recognizes a geometric straight as straight',() => {
    const line=Array.from({length:50},(_,i) => [i*10,0]);
    expect(detectStraights(line,1).length).toBeGreaterThan(0);
  });
});
