/**
 * @typedef {Object} Circuit
 * @property {string} id - Unique circuit identifier (e.g. "us-1956")
 * @property {string} name - Full circuit name
 * @property {string} location - City/region
 * @property {string} continent - Geographic continent
 * @property {number} lat - Latitude
 * @property {number} lon - Longitude
 * @property {number} zoom - Default map zoom level
 * @property {number} [length] - Track length in meters
 * @property {number} altitude - Altitude above sea level in meters
 * @property {number} [drsZones] - Number of DRS zones
 * @property {number} [opened] - Year the circuit opened
 * @property {number[][]} coordinates - Array of [lon, lat] pairs defining the track outline
 * @property {{ time: string, driver: string, year: number }} [lapRecord] - Lap record info
 * @property {{ yearsHosted?: number[], layoutChanges?: string }} [trackHistory] - Historical data
 */

/**
 * @typedef {Object} TrackDetail
 * @property {number} lengthMeters - Track length in meters
 * @property {{ lat: number, lng: number }[]} corners - Detected corner positions
 * @property {string} direction - "Clockwise" or "Counter-clockwise"
 * @property {number} longestStraightMeters - Length of the longest straight in meters
 */

/**
 * @typedef {Object} ProjectedTelemetry
 * @property {{ x: number, y: number, z: number, progress: number, speed: number, throttle: number, brake: number, drs: number, gear: number, date: string }[]} projected - Telemetry points projected onto track geometry
 * @property {{ avgSpeed: number, maxSpeed: number, segmentLength: number, color: string }[]} binned - Binned telemetry for ribbon coloring
 */

/**
 * @typedef {Object} OpenF1Session
 * @property {number} session_key - OpenF1 session identifier
 * @property {string} session_name - Human-readable session name (e.g. "Qualifying")
 * @property {string} session_type - "Practice" | "Qualifying" | "Race"
 * @property {number} year - Season year
 */

/**
 * @typedef {Object} OpenF1Lap
 * @property {number} driver_number - Driver's permanent number
 * @property {number} lap_number - Lap number within the session
 * @property {number} lap_duration - Lap time in seconds
 * @property {string} date_start - ISO date string of lap start
 * @property {number} [duration_sector_1] - Sector 1 time in seconds
 * @property {number} [duration_sector_2] - Sector 2 time in seconds
 * @property {number} [duration_sector_3] - Sector 3 time in seconds
 */

/**
 * @typedef {Object} OpenF1Driver
 * @property {number} driver_number - Driver's permanent number
 * @property {string} full_name - Full name
 * @property {string} team_name - Team name
 */

/**
 * @typedef {Object} QualifyingData
 * @property {OpenF1Session} quali - Qualifying session info
 * @property {OpenF1Session[]} sessions - All sessions for the event
 * @property {OpenF1Lap[]} laps - All qualifying laps sorted by duration
 * @property {OpenF1Driver[]} drivers - Driver info for the event
 */

/**
 * @typedef {Object} Stint
 * @property {string} compound - Tire compound (SOFT, MEDIUM, HARD, INTERMEDIATE, WET)
 * @property {number} lap_start - Lap the stint started
 * @property {number} lap_end - Lap the stint ended
 * @property {number} driver_number - Driver number
 * @property {number} stint_number - Stint sequence number
 */

/**
 * @typedef {Object} PitStop
 * @property {number} driver_number
 * @property {number} lap_number
 * @property {number} pit_duration - Duration in seconds
 */

/**
 * @typedef {Object} RaceControlEvent
 * @property {string} [flag] - Flag type (Yellow, Red, SC, VSC, Chequered)
 * @property {string} [category] - Event category
 * @property {string} [message] - Human-readable message
 * @property {number} lap_number - Lap when the event occurred
 */

/**
 * @typedef {Object} Weather
 * @property {number} air_temperature - Air temp in °C
 * @property {number} track_temperature - Track temp in °C
 * @property {number} humidity - Humidity percentage
 * @property {number} wind_speed - Wind speed in km/h
 * @property {string} [rainfall] - "1" if raining
 */
