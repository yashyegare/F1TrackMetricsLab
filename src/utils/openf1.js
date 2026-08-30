/**
 * OpenF1 API client with localStorage caching.
 * API docs: https://openf1.org/docs/
 * Free, keyless, CORS-friendly. Data available from 2023 onward.
 */

const BASE = 'https://api.openf1.org/v1';
const CACHE_PREFIX = 'openf1_';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days (immutable historical data)

function cacheKey(endpoint, params) {
  const sorted = Object.entries(params)
    .filter(([, v]) => v != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${CACHE_PREFIX}${endpoint}_${sorted}`;
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // Storage full — clear old entries
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.sort().slice(0, Math.floor(keys.length / 2)).forEach(k => localStorage.removeItem(k));
    try {
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* give up */ }
  }
}

async function fetchAPI(endpoint, params = {}, retries = 3) {
  const key = cacheKey(endpoint, params);
  const cached = getCached(key);
  if (cached) return cached;

  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null)
  ).toString();
  const url = `${BASE}/${endpoint}${qs ? '?' + qs : ''}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      // Rate limited — wait with exponential backoff
      const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    if (!res.ok) throw new Error(`OpenF1 ${res.status}: ${url}`);
    const data = await res.json();
    setCache(key, data);
    return data;
  }
  throw new Error(`OpenF1 rate limited after ${retries} retries: ${url}`);
}

// ---- High-level helpers ----

/**
 * Map our circuit IDs to OpenF1's circuit_short_name.
 * Returns null if the circuit isn't on the current calendar.
 */
const CIRCUIT_MAP = {
  'us-2012': 'Austin',        // Circuit of the Americas
  'az-2016': 'Baku',          // Baku City Circuit
  'es-1991': 'Catalunya',     // Circuit de Barcelona-Catalunya
  'hu-1986': 'Hungaroring',   // Hungaroring
  'it-1953': 'Imola',         // Autodromo Enzo e Dino Ferrari
  'mc-1929': 'Monte Carlo',   // Circuit de Monaco
  'ca-1978': 'Montreal',      // Circuit Gilles-Villeneuve
  'at-1969': 'Spielberg',     // Red Bull Ring
  'gb-1948': 'Silverstone',   // Silverstone Circuit
  'be-1925': 'Spa-Francorchamps', // Circuit de Spa-Francorchamps
  'nl-1948': 'Zandvoort',     // Circuit Zandvoort
  'it-1922': 'Monza',         // Autodromo Nazionale Monza
  'sg-2008': 'Singapore',     // Marina Bay Street Circuit
  'jp-1962': 'Suzuka',        // Suzuka International Racing Course
  'mx-1962': 'Mexico City',   // Autódromo Hermanos Rodríguez
  'br-1940': 'Interlagos',    // Autódromo José Carlos Pace
  'us-2023': 'Las Vegas',     // Las Vegas Street Circuit
  'qa-2004': 'Lusail',        // Losail International Circuit
  'ae-2009': 'Yas Marina Circuit', // Yas Marina Circuit
  'sa-2021': 'Jeddah',        // Jeddah Corniche Circuit
  'au-1953': 'Melbourne',     // Albert Park Circuit
  'cn-2004': 'Shanghai',      // Shanghai International Circuit
  'bh-2002': 'Sakhir',        // Bahrain International Circuit
  'us-2022': 'Miami',         // Miami International Autodrome
};

export function getOpenF1CircuitName(circuitId) {
  return CIRCUIT_MAP[circuitId] || null;
}

export function isTelemetryAvailable(circuitId) {
  return circuitId in CIRCUIT_MAP;
}

/**
 * Get all sessions for a circuit in a given year.
 */
export async function getSessions(circuitId, year = 2024) {
  const circuitName = getOpenF1CircuitName(circuitId);
  if (!circuitName) return [];
  const data = await fetchAPI('sessions', { year, circuit_short_name: circuitName });
  return data;
}

/**
 * Get all laps for a session, sorted by duration.
 * Returns [{ driver_number, lap_number, lap_duration, date_start, ... }]
 */
export async function getLaps(sessionKey) {
  const data = await fetchAPI('laps', { session_key: sessionKey });
  return data
    .filter(l => l.lap_duration && l.lap_duration > 0)
    .sort((a, b) => a.lap_duration - b.lap_duration);
}

/**
 * Get location samples for a driver in a session.
 * Returns [{ date, x, y, z }]
 */
export async function getLocation(sessionKey, driverNumber) {
  return fetchAPI('location', { session_key: sessionKey, driver_number: driverNumber });
}

/**
 * Get car telemetry for a driver in a session.
 * Returns [{ date, speed, throttle, brake, drs, n_gear, rpm }]
 */
export async function getCarData(sessionKey, driverNumber) {
  return fetchAPI('car_data', { session_key: sessionKey, driver_number: driverNumber });
}

/**
 * Get driver info for a session.
 * Returns [{ driver_number, full_name, team_name, ... }]
 */
export async function getDrivers(sessionKey) {
  return fetchAPI('drivers', { session_key: sessionKey });
}

/**
 * Core telemetry fetch: given a session + driver + lap, fetch and join location+car_data.
 * Returns { session, lap, telemetry } or null.
 */
export async function getLapTelemetry(circuitId, year, sessionKey, driverNumber, lapInfo, drivers = []) {
  const circuitName = getOpenF1CircuitName(circuitId);

  await new Promise(r => setTimeout(r, 300));
  const locationRaw = await getLocation(sessionKey, driverNumber);
  await new Promise(r => setTimeout(r, 300));
  const carDataRaw = await getCarData(sessionKey, driverNumber);

  const lapStart = new Date(lapInfo.date_start).getTime();
  const lapEnd = lapStart + lapInfo.lap_duration * 1000;

  const location = locationRaw.filter(d => {
    const t = new Date(d.date).getTime();
    return t >= lapStart && t <= lapEnd
      && d.x != null && d.y != null
      && (d.x !== 0 || d.y !== 0);
  });

  const carData = carDataRaw.filter(d => {
    const t = new Date(d.date).getTime();
    return t >= lapStart && t <= lapEnd;
  });

  const telemetry = location.map(loc => {
    let closest = null;
    let minDiff = Infinity;
    for (const cd of carData) {
      const diff = Math.abs(new Date(cd.date) - new Date(loc.date));
      if (diff < minDiff) {
        minDiff = diff;
        closest = cd;
      }
    }
    return {
      x: loc.x,
      y: loc.y,
      z: loc.z,
      date: loc.date,
      speed: closest?.speed ?? 0,
      throttle: closest?.throttle ?? 0,
      brake: closest?.brake ?? 0,
      drs: closest?.drs ?? 0,
      gear: closest?.n_gear ?? 0,
    };
  });

  const driverInfo = drivers.find(d => d.driver_number === driverNumber);

  return {
    session: {
      key: sessionKey,
      name: sessionKey, // will be overridden by caller
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
    },
    telemetry,
  };
}

/**
 * Find the best qualifying session for a circuit+year, preferring main over sprint.
 * Returns { sessions, quali, laps, drivers } or null.
 */
export async function getQualifyingData(circuitId, year = 2024) {
  const sessions = await getSessions(circuitId, year);
  const allQualis = sessions.filter(s => s.session_type === 'Qualifying');
  let quali;
  if (allQualis.length > 1) {
    quali = allQualis.find(s => !s.session_name?.toLowerCase().includes('sprint'))
      || allQualis[allQualis.length - 1];
  } else {
    quali = allQualis[0] || sessions.find(s => s.session_type === 'Race');
  }
  if (!quali) return null;

  const laps = await getLaps(quali.session_key);
  if (laps.length === 0) return null;

  const drivers = await getDrivers(quali.session_key);
  return { sessions, quali, laps, drivers };
}

/**
 * Full pipeline: get the fastest lap's telemetry for a circuit+year.
 * Returns null if no data available.
 */
export async function getFastestLapTelemetry(circuitId, year = 2024) {
  const circuitName = getOpenF1CircuitName(circuitId);
  if (!circuitName) return null;

  const data = await getQualifyingData(circuitId, year);
  if (!data) return null;
  const { quali, laps, drivers } = data;
  const fastest = laps[0];

  const result = await getLapTelemetry(
    circuitId, year, quali.session_key,
    fastest.driver_number, fastest, drivers
  );
  if (!result) return null;
  result.session.name = quali.session_name;
  return result;
}
