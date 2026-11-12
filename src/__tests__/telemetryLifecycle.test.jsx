import {renderHook,waitFor,act} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
vi.mock('../utils/openf1',() => ({isTelemetryAvailable:() => true,getQualifyingData:vi.fn(),getLapTelemetry:vi.fn(),getRaceContext:vi.fn(async () => ({}))}));
vi.mock('../services/projection',() => ({projectLap:vi.fn(async () => ({projected:[],binned:[]}))}));
import {getQualifyingData,getLapTelemetry} from '../utils/openf1';
import {useTelemetryForCircuit} from '../hooks/useTelemetryForCircuit';
const circuit={id:'us-2012',coordinates:[[1,1],[2,2]]};
const data={quali:{session_key:1,meeting_key:1,session_name:'Qualifying'},drivers:[{driver_number:1,full_name:'One'}],laps:[{driver_number:1,lap_duration:90}],sessions:[]};
describe('telemetry hook lifecycle',() => {
  it('ignores a late session result after year changes and aborts its subscription',async () => {
    let release=() => {};
    let oldSignal;
    vi.mocked(getQualifyingData).mockImplementationOnce((_id,_year,signal) => {
      oldSignal=signal;return new Promise(resolve => {release=resolve;});
    }).mockResolvedValue(data);
    vi.mocked(getLapTelemetry).mockResolvedValue({session:{},lap:{driver:1},telemetry:[]});
    const {result,rerender}=renderHook(({year}) => useTelemetryForCircuit(circuit,year,{enabled:true}),{initialProps:{year:2023}});
    rerender({year:2024});
    await waitFor(() => expect(result.current.telemetry).not.toBeNull());
    await act(async () => release(data));
    expect(oldSignal.aborted).toBe(true);
    expect(getLapTelemetry).toHaveBeenCalledTimes(1);
    expect(getLapTelemetry.mock.calls[0][1]).toBe(2024);
  });
});
