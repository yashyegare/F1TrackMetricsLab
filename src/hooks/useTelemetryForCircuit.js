import { useEffect, useState, useCallback } from 'react';
import { isTelemetryAvailable, getQualifyingData, getLapTelemetry, getRaceContext } from '../utils/openf1';
import { projectLap } from '../services/projection';

const empty = () => ({ telemetry:null,drivers:[],driver:null,loading:false,loadStep:'',error:null,qualiData:null,raceContext:{} });
export function useTelemetryForCircuit(circuit,year,{enabled=false,driverNumber=null,rank=0,excludeDriver=null} = {}) {
  const [state,setState] = useState(empty);
  const [attempt,setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(n => n+1),[]);
  useEffect(() => {
    const controller = new AbortController();
    const {signal} = controller;
    const update = patch => { if (!signal.aborted) setState(s => ({...s,...patch})); };
    setState(empty());
    if (!enabled || !isTelemetryAvailable(circuit.id)) return () => controller.abort();
    async function run() {
      update({loading:true,loadStep:'Resolving qualifying session…'});
      try {
        const qualiData = await getQualifyingData(circuit.id,year,signal);
        if (signal.aborted) return;
        if (!qualiData) throw new Error('No recorded qualifying session for this circuit and year.');
        const eligible = [...new Set(qualiData.laps.map(l => l.driver_number))];
        const seen = new Set();
        const drivers = qualiData.drivers.filter(d => eligible.includes(d.driver_number) && !seen.has(d.driver_number) && seen.add(d.driver_number))
          .sort((a,b) => a.full_name.localeCompare(b.full_name));
        const choices = eligible.filter(id => id !== excludeDriver);
        const driver = eligible.includes(driverNumber) && driverNumber !== excludeDriver ? driverNumber : (choices[excludeDriver == null ? rank : 0] ?? choices[0]);
        if (driver == null) throw new Error('No different driver with a recorded qualifying lap is available.');
        const lap = qualiData.laps.find(l => l.driver_number === driver);
        update({drivers,driver,qualiData,loadStep:'Loading selected lap…'});
        const result = await getLapTelemetry(circuit.id,year,qualiData.quali.session_key,driver,lap,qualiData.drivers,signal);
        result.session.name = qualiData.quali.session_name;
        result.session.meetingKey = qualiData.quali.meeting_key;
        update({loadStep:'Aligning lap to the circuit…'});
        const projection = await projectLap(circuit.coordinates,result.telemetry,signal);
        update({telemetry:{...result,...projection},loading:false,loadStep:''});
        // Race context is supplementary and must not hold up qualifying analysis.
        const raceContext = await getRaceContext(qualiData,signal);
        update({raceContext});
      } catch(error) {
        if (!signal.aborted) update({loading:false,loadStep:'',error:error.message || 'Telemetry unavailable. Please retry.'});
      }
    }
    run();
    return () => controller.abort();
  },[circuit.id,circuit.coordinates,year,enabled,driverNumber,excludeDriver,rank,attempt]);
  return {...state,retry};
}
