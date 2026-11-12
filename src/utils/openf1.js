// Validated, cancellable and deduplicated OpenF1 requests.
import { fetchAPI } from '../services/apiClient';

// ---- High-level helpers ----

const CIRCUIT_MAP = {
  'us-2012': 'Austin',
  'az-2016': 'Baku',
  'es-1991': 'Catalunya',
  'hu-1986': 'Hungaroring',
  'it-1953': 'Imola',
  'mc-1929': 'Monte Carlo',
  'ca-1978': 'Montreal',
  'at-1969': 'Spielberg',
  'gb-1948': 'Silverstone',
  'be-1925': 'Spa-Francorchamps',
  'nl-1948': 'Zandvoort',
  'it-1922': 'Monza',
  'sg-2008': 'Singapore',
  'jp-1962': 'Suzuka',
  'mx-1962': 'Mexico City',
  'br-1940': 'Interlagos',
  'us-2023': 'Las Vegas',
  'qa-2004': 'Lusail',
  'ae-2009': 'Yas Marina Circuit',
  'sa-2021': 'Jeddah',
  'au-1953': 'Melbourne',
  'cn-2004': 'Shanghai',
  'bh-2002': 'Sakhir',
  'us-2022': 'Miami',
};

export function getOpenF1CircuitName(circuitId) {
  return CIRCUIT_MAP[circuitId] || null;
}

export function isTelemetryAvailable(circuitId) {
  return circuitId in CIRCUIT_MAP;
}

export async function getSessions(circuitId, year = 2024, signal) {
  const circuitName = getOpenF1CircuitName(circuitId);
  if (!circuitName) return [];
  return fetchAPI('sessions', { year, circuit_short_name: circuitName }, signal);
}

export async function getLaps(sessionKey, signal) {
  const data = await fetchAPI('laps', { session_key: sessionKey }, signal);
  return data
    .filter(l => l.lap_duration && l.lap_duration > 0)
    .sort((a, b) => a.lap_duration - b.lap_duration);
}

export async function getLocation(sessionKey, driverNumber, range = {}, signal) {
  return fetchAPI('location', { session_key: sessionKey, driver_number: driverNumber, ...range }, signal);
}

export async function getCarData(sessionKey, driverNumber, range = {}, signal) {
  return fetchAPI('car_data', { session_key: sessionKey, driver_number: driverNumber, ...range }, signal);
}

export async function getDrivers(sessionKey, signal) {
  return fetchAPI('drivers', { session_key: sessionKey }, signal);
}

// ---- New endpoints (Fastlytics-inspired) ----

/**
 * Fetch pit stops for a session.
 * Returns array of { driver_number, lap_number, pit_duration, date, ... }
 */
export async function getPitStops(sessionKey, signal) {
  return fetchAPI('pit', { session_key: sessionKey }, signal);
}

/**
 * Fetch race control messages (flags, SC, VSC, etc.)
 * Returns array of { category, message, flag, lap_number, date, ... }
 */
export async function getRaceControl(sessionKey, signal) {
  return fetchAPI('race_control', { session_key: sessionKey }, signal);
}

/**
 * Fetch weather data for a session.
 * Returns array of { air_temperature, track_temperature, humidity, rainfall, wind_speed, wind_direction, date }
 */
export async function getWeather(sessionKey, signal) {
  return fetchAPI('weather', { session_key: sessionKey }, signal);
}

/**
 * Fetch interval/gap data for a session.
 * Returns array of { driver_number, gap_to_leader, interval, date, ... }
 */
export async function getIntervals(sessionKey, signal) {
  return fetchAPI('intervals', { session_key: sessionKey }, signal);
}

/**
 * Fetch stint data for a session (tire compound per stint).
 * Returns array of { driver_number, stint_number, compound, lap_start, lap_end, ... }
 */
export async function getStints(sessionKey, signal) {
  return fetchAPI('stints', { session_key: sessionKey }, signal);
}

// ---- Tire compound mapping ----

const COMPOUND_COLORS = {
  SOFT: '#e10600',
  MEDIUM: '#ffd700',
  HARD: '#e8e8e8',
  INTERMEDIATE: '#00cc44',
  WET: '#0099ff',
  UNKNOWN: '#666',
};

const COMPOUND_SHORT = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
  UNKNOWN: '?',
};

export function getCompoundColor(compound) {
  return COMPOUND_COLORS[compound?.toUpperCase()] || COMPOUND_COLORS.UNKNOWN;
}

export function getCompoundShort(compound) {
  return COMPOUND_SHORT[compound?.toUpperCase()] || '?';
}

// ---- Core telemetry fetch ----

/**
 * Core telemetry fetch: given a session + driver + lap, fetch and join location+car_data.
 * Returns { session, lap, telemetry } or null.
 */
export async function getLapTelemetry(circuitId, year, sessionKey, driverNumber, lapInfo, drivers = [], signal) {
  const circuitName = getOpenF1CircuitName(circuitId);

  const lapStart = Date.parse(lapInfo.date_start);
  const lapEnd = lapStart + lapInfo.lap_duration * 1000;
  if (!Number.isFinite(lapStart) || !Number.isFinite(lapEnd) || lapEnd <= lapStart) throw new Error('Invalid lap timing.');
  const range = { 'date>=':new Date(lapStart).toISOString(), 'date<=':new Date(lapEnd).toISOString() };
  const [locationRaw, carDataRaw] = await Promise.all([
    getLocation(sessionKey,driverNumber,range,signal),
    getCarData(sessionKey,driverNumber,range,signal),
  ]);

  const location = locationRaw.filter(d => {
    const t = new Date(d.date).getTime();
    return t >= lapStart && t <= lapEnd
      && d.x != null && d.y != null
      && (d.x !== 0 || d.y !== 0);
  });

  const carData = carDataRaw.filter(d => {
    const t = new Date(d.date).getTime();
    return t >= lapStart && t <= lapEnd && ['speed','throttle','brake','drs','n_gear','rpm'].every(field => Number.isFinite(d[field]));
  });

  location.sort((a,b) => Date.parse(a.date)-Date.parse(b.date));
  carData.sort((a,b) => Date.parse(a.date)-Date.parse(b.date));

  // Two-pointer join: both arrays are date-sorted, so walk them together O(n+m)
  const telemetry = [];
  let carIdx = 0;
  for (const loc of location) {
    const locTime = new Date(loc.date).getTime();
    // Advance carIdx to the nearest car_data point
    while (carIdx < carData.length - 1 && Math.abs(new Date(carData[carIdx + 1].date).getTime() - locTime) < Math.abs(new Date(carData[carIdx].date).getTime() - locTime)) {
      carIdx++;
    }
    const closest = carData[carIdx];
    if (!closest || Math.abs(Date.parse(closest.date)-locTime) > 1000) continue;
    telemetry.push({
      x: loc.x,
      y: loc.y,
      z: loc.z,
      date: loc.date,
      speed: closest?.speed ?? 0,
      throttle: closest?.throttle ?? 0,
      brake: closest?.brake ?? 0,
      drs: closest?.drs ?? 0,
      gear: closest?.n_gear ?? 0,
      rpm: closest?.rpm ?? 0,
    });
  }

  if (telemetry.length < 2 || carData.length < 2) throw new Error('This lap has insufficient recorded telemetry.');
  const driverInfo = drivers.find(d => d.driver_number === driverNumber);

  return {
    session: {
      key: sessionKey,
      name: sessionKey,
      year,
      circuit: circuitName || circuitId,
    },
    lap: {
      driver: driverNumber,
      driverName: driverInfo?.full_name || 'Driver #' + driverNumber,
      teamName: driverInfo?.team_name || '',
      number: lapInfo.lap_number,
      duration: lapInfo.lap_duration,
      dateStart: lapInfo.date_start,
      sector1: lapInfo.duration_sector_1 ?? null,
      sector2: lapInfo.duration_sector_2 ?? null,
      sector3: lapInfo.duration_sector_3 ?? null,
    },
    telemetry,
  };
}

// ---- Qualifying data ----

export function selectQualifyingSession(sessions) {
  return sessions.filter(s => s.session_type === 'Qualifying' && !s.session_name.toLowerCase().includes('sprint'))
    .sort((a,b) => Date.parse(b.date_start)-Date.parse(a.date_start))[0] || null;
}

export async function getQualifyingData(circuitId, year = 2024, signal) {
  const sessions = await getSessions(circuitId,year,signal);
  const quali = selectQualifyingSession(sessions);
  if (!quali) return null; // Never substitute a race for missing qualifying.
  const [laps,drivers] = await Promise.all([getLaps(quali.session_key,signal),getDrivers(quali.session_key,signal)]);
  const valid = laps.filter(l => !l.is_pit_out_lap && Number.isFinite(Date.parse(l.date_start)));
  return valid.length ? { sessions,quali,laps:valid,drivers } : null;
}

export function completedRaceLaps(laps) {
  const recorded = laps.filter(l => Number.isInteger(l.lap_number) && l.lap_number > 0 && l.lap_duration > 0);
  return recorded.length ? Math.max(...recorded.map(l => l.lap_number)) : null;
}

export async function getRaceContext(qualiData,signal) {
  const race = qualiData.sessions.find(s => s.session_name === 'Race' && s.meeting_key === qualiData.quali.meeting_key);
  if (!race) return { totalLaps:null,partial:true };
  const requests = [getStints(race.session_key,signal),getPitStops(race.session_key,signal),getRaceControl(race.session_key,signal),getWeather(race.session_key,signal),getLaps(race.session_key,signal)];
  const results = await Promise.allSettled(requests);
  if (signal?.aborted) throw new DOMException('Cancelled','AbortError');
  const [stints,pitStops,raceControl,weather,laps] = results.map(r => r.status === 'fulfilled' ? r.value : null);
  return { stints,pitStops,raceControl,weather,totalLaps:completedRaceLaps(laps || []),partial:results.some(r => r.status === 'rejected'),session:race };
}
