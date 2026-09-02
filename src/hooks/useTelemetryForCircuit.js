/**
 * useTelemetryForCircuit — fetches qualifying data, driver telemetry, and race context
 * for a single circuit. Encapsulates the data-fetching logic that was previously
 * duplicated in Compare3DPanel's fetchSide function.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { isTelemetryAvailable, getQualifyingData, getLapTelemetry, getPitStops, getStints, getRaceControl, getWeather } from '../utils/openf1';

export function useTelemetryForCircuit(circuit, year, driverNumber, getCachedProjection) {
  const [telemetry, setTelemetry] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState('');
  const [error, setError] = useState(null);
  const [raceContext, setRaceContext] = useState({
    stints: null,
    pitStops: null,
    raceControl: null,
    weather: null,
    totalLaps: 0,
  });
  const qualiDataRef = useRef(null);
  const cancelledRef = useRef(false);

  const fetchTelemetry = useCallback(async (targetDriver) => {
    if (!isTelemetryAvailable(circuit.id)) return;
    setLoading(true);
    setError(null);
    setLoadStep('Resolving session…');

    try {
      const qualiData = await getQualifyingData(circuit.id, year);
      if (cancelledRef.current || !qualiData) throw new Error('No qualifying data available');
      qualiDataRef.current = qualiData;

      // Deduplicate drivers
      const seen = new Set();
      const uniqueDrivers = qualiData.drivers.filter(d => {
        if (seen.has(d.driver_number)) return false;
        seen.add(d.driver_number);
        return true;
      }).sort((a, b) => a.full_name.localeCompare(b.full_name));
      setDrivers(uniqueDrivers);

      // Determine which driver to fetch
      const driver = targetDriver ?? qualiData.laps[0]?.driver_number;
      if (driver == null) throw new Error('No laps found');

      const drvName = qualiData.drivers.find(d => d.driver_number === driver)?.full_name?.split(' ').pop() || '';
      const fastestTime = qualiData.laps[0] ? `${Math.floor(qualiData.laps[0].lap_duration / 60)}:${(qualiData.laps[0].lap_duration % 60).toFixed(3)}` : '';
      setLoadStep(`Finding fastest lap (${drvName} ${fastestTime})…`);

      const fastestLap = qualiData.laps[0];
      const result = await getLapTelemetry(circuit.id, year, qualiData.quali.session_key, driver, fastestLap, qualiData.drivers);
      if (cancelledRef.current || !result) throw new Error('Telemetry fetch failed');

      result.session.name = qualiData.quali.session_name;

      setLoadStep('Projecting ribbon alignment…');
      const { projected, binned } = getCachedProjection(circuit.id, year, circuit.coordinates, result.telemetry);
      setTelemetry({ ...result, binned, projected });

      // Fetch race context in parallel
      const raceSession = qualiData.sessions.find(s => s.session_type === 'Race');
      if (raceSession) {
        const raceKey = raceSession.session_key;
        const [stintsData, pitData, rcData, wxData] = await Promise.allSettled([
          getStints(raceKey),
          getPitStops(raceKey),
          getRaceControl(raceKey),
          getWeather(raceKey),
        ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null));

        setRaceContext({
          stints: stintsData,
          pitStops: pitData,
          raceControl: rcData,
          weather: wxData,
          totalLaps: qualiData.laps.length || raceSession.totalLaps || 57,
        });
      }
    } catch (e) {
      console.warn('[useTelemetryForCircuit]', circuit.id, e);
      setError(e.message || 'Telemetry unavailable');
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
        setLoadStep('');
      }
    }
  }, [circuit.id, circuit.coordinates, year, getCachedProjection]);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, [circuit.id, year]);

  const changeDriver = useCallback((newDriver) => {
    fetchTelemetry(newDriver);
  }, [fetchTelemetry]);

  return {
    telemetry,
    drivers,
    loading,
    loadStep,
    error,
    raceContext,
    fetchTelemetry,
    changeDriver,
    qualiData: qualiDataRef.current,
  };
}
