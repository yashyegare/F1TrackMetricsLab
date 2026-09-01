/**
 * OpenF1 API client with IndexedDB caching.
 * API docs: https://openf1.org/docs/
 * Free, keyless, CORS-friendly. Data available from 2023 onward.
 *
 * Uses idb-keyval (IndexedDB) instead of localStorage:
 * - Async: no main-thread blocking on JSON.parse/stringify
 * - Virtually unlimited storage (vs 5MB localStorage limit)
 * - Handles large telemetry arrays without truncation
 */

import { get, set, del, keys } from 'idb-keyval';

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

async function getCached(key) {
  try {
    const cached = await get(key);
    if (!cached) return null;
    if (Date.now() - cached.ts > CACHE_TTL) {
      await del(key);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

async function setCache(key, data) {
  try {
    await set(key, { data, ts: Date.now() });
  } catch {
    // Storage full — clear oldest half
    try {
      const allKeys = await keys();
      const cacheKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(CACHE_PREFIX)).sort();
      const toRemove = cacheKeys.slice(0, Math.floor(cacheKeys.length / 2));
      await Promise.all(toRemove.map(k => del(k)));
      await set(key, { data, ts: Date.now() });
    } catch { /* give up */ }
  }
}

async function fetchAPI(endpoint, params = {}, retries = 3) {
  const key = cacheKey(endpoint, params);
  const cached = await getCached(key);
  if (cached) return cached;

  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null)
  ).toString();
  const url = `${BASE}/${endpoint}${qs ? '?' + qs : ''}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    if (!res.ok) throw new Error(`OpenF1 ${res.status}: ${url}`);
    const data = await res.json();
    await setCache(key, data);
    return data;
  }
  throw new Error(`OpenF1 rate limited after ${retries} retries: ${url}`);
}

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

export async function getSessions(circuitId, year = 2024) {
  const circuitName = getOpenF1CircuitName(circuitId);
  if (!circuitName) return [];
  return fetchAPI('sessions', { year, circuit_short_name: circuitName });
}

export async function getLaps(sessionKey) {
  const data = await fetchAPI('laps', { session_key: sessionKey });
  return data
    .filter(l => l.lap_duration && l.lap_duration > 0)
    .sort((a, b) => a.lap_duration - b.lap_duration);
}

export async function getLocation(sessionKey, driverNumber) {
  return fetchAPI('location', { session_key: sessionKey, driver_number: driverNumber });
}

export async function getCarData(sessionKey, driverNumber) {
  return fetchAPI('car_data', { session_key: sessionKey, driver_number: driverNumber });
}

export async function getDrivers(sessionKey) {
  return fetchAPI('drivers', { session_key: sessionKey });
}

// ---- New endpoints (Fastlytics-inspired) ----

/**
 * Fetch pit stops for a session.
 * Returns array of { driver_number, lap_number, pit_duration, date, ... }
 */
export async function getPitStops(sessionKey) {
  return fetchAPI('pit', { session_key: sessionKey });
}

/**
 * Fetch race control messages (flags, SC, VSC, etc.)
 * Returns array of { category, message, flag, lap_number, date, ... }
 */
export async function getRaceControl(sessionKey) {
  return fetchAPI('race_control', { session_key: sessionKey });
}

/**
 * Fetch weather data for a session.
 * Returns array of { air_temperature, track_temperature, humidity, rainfall, wind_speed, wind_direction, date }
 */
export async function getWeather(sessionKey) {
  return fetchAPI('weather', { session_key: sessionKey });
}

/**
 * Fetch interval/gap data for a session.
 * Returns array of { driver_number, gap_to_leader, interval, date, ... }
 */
export async function getIntervals(sessionKey) {
  return fetchAPI('intervals', { session_key: sessionKey });
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
export async function getLapTelemetry(circuitId, year, sessionKey, driverNumber, lapInfo, drivers = []) {
  const circuitName = getOpenF1CircuitName(circuitId);

  // Fetch location and car_data in parallel (both only need session_key + driver)
  const [locationRaw, carDataRaw] = await Promise.all([
    getLocation(sessionKey, driverNumber),
    getCarData(sessionKey, driverNumber),
  ]);

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
      rpm: closest?.rpm ?? 0,
    };
  });

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
    },
    telemetry,
  };
}

// ---- Qualifying data ----

const qualiCache = new Map();
const QUALI_CACHE_MAX = 20;

export async function getQualifyingData(circuitId, year = 2024) {
  const cacheKey = `${circuitId}:${year}`;
  if (qualiCache.has(cacheKey)) {
    const val = qualiCache.get(cacheKey);
    qualiCache.delete(cacheKey); // bump to most-recently-used
    qualiCache.set(cacheKey, val);
    return val;
  }

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

  // Fetch laps and drivers in parallel (both only need session_key)
  const [laps, drivers] = await Promise.all([
    getLaps(quali.session_key),
    getDrivers(quali.session_key),
  ]);
  if (laps.length === 0) return null;

  const result = { sessions, quali, laps, drivers };
  if (qualiCache.size >= QUALI_CACHE_MAX) {
    const oldest = qualiCache.keys().next().value;
    qualiCache.delete(oldest);
  }
  qualiCache.set(cacheKey, result);
  return result;
}

/**
 * Full pipeline: get the fastest lap's telemetry for a circuit+year.
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
