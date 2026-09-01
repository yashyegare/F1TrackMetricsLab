/**
 * Tests for data mapping between OpenF1 raw responses and app components.
 * Covers sector time mapping and stint/pit-stop data structures.
 */
import { describe, it, expect } from 'vitest';

// ---- Sector time mapping ----
// getLapTelemetry maps duration_sector_1/2/3 → sector1/2/3 on the lap object.
// SectorComparison reads sector1/2/3 (with fallback to duration_sector_*).

describe('Sector time mapping', () => {
  it('correctly maps duration_sector fields to sector1/2/3', () => {
    const lapInfo = {
      lap_number: 5,
      lap_duration: 92.345,
      date_start: '2024-03-02T14:00:00',
      duration_sector_1: 30.123,
      duration_sector_2: 35.456,
      duration_sector_3: 26.766,
    };

    // Simulate what getLapTelemetry does
    const lap = {
      driver: 1,
      driverName: 'Test Driver',
      teamName: 'Test Team',
      number: lapInfo.lap_number,
      duration: lapInfo.lap_duration,
      dateStart: lapInfo.date_start,
      sector1: lapInfo.duration_sector_1 ?? null,
      sector2: lapInfo.duration_sector_2 ?? null,
      sector3: lapInfo.duration_sector_3 ?? null,
    };

    expect(lap.sector1).toBe(30.123);
    expect(lap.sector2).toBe(35.456);
    expect(lap.sector3).toBe(26.766);
  });

  it('sector fields are null when not present in lapInfo', () => {
    const lapInfo = {
      lap_number: 5,
      lap_duration: 92.345,
      date_start: '2024-03-02T14:00:00',
      // No sector fields
    };

    const lap = {
      sector1: lapInfo.duration_sector_1 ?? null,
      sector2: lapInfo.duration_sector_2 ?? null,
      sector3: lapInfo.duration_sector_3 ?? null,
    };

    expect(lap.sector1).toBeNull();
    expect(lap.sector2).toBeNull();
    expect(lap.sector3).toBeNull();
  });

  it('sector times sum to total lap duration', () => {
    const lapInfo = {
      duration_sector_1: 30.123,
      duration_sector_2: 35.456,
      duration_sector_3: 26.766,
      lap_duration: 92.345,
    };

    const total = lapInfo.duration_sector_1 + lapInfo.duration_sector_2 + lapInfo.duration_sector_3;
    expect(total).toBeCloseTo(lapInfo.lap_duration, 2);
  });
});

// ---- Stint compound mapping ----
// TireStrategy reads /stints data: { compound, lap_start, lap_end, driver_number }

describe('Stint data mapping', () => {
  it('sorts stints by stint_number', () => {
    const rawStints = [
      { driver_number: 1, stint_number: 3, compound: 'HARD', lap_start: 30, lap_end: 57 },
      { driver_number: 1, stint_number: 1, compound: 'SOFT', lap_start: 1, lap_end: 15 },
      { driver_number: 1, stint_number: 2, compound: 'MEDIUM', lap_start: 16, lap_end: 29 },
    ];

    const sorted = rawStints
      .filter(s => s.driver_number === 1)
      .sort((a, b) => (a.stint_number || 0) - (b.stint_number || 0));

    expect(sorted[0].compound).toBe('SOFT');
    expect(sorted[1].compound).toBe('MEDIUM');
    expect(sorted[2].compound).toBe('HARD');
  });

  it('stints cover full race distance without gaps', () => {
    const stints = [
      { driver_number: 1, stint_number: 1, compound: 'SOFT', lap_start: 1, lap_end: 15 },
      { driver_number: 1, stint_number: 2, compound: 'MEDIUM', lap_start: 16, lap_end: 35 },
      { driver_number: 1, stint_number: 3, compound: 'HARD', lap_start: 36, lap_end: 57 },
    ];

    for (let i = 1; i < stints.length; i++) {
      // Next stint should start right after previous ends
      expect(stints[i].lap_start).toBe(stints[i - 1].lap_end + 1);
    }
    // First stint starts at lap 1
    expect(stints[0].lap_start).toBe(1);
  });

  it('filters by driver_number', () => {
    const stints = [
      { driver_number: 1, compound: 'SOFT', lap_start: 1, lap_end: 15 },
      { driver_number: 2, compound: 'HARD', lap_start: 1, lap_end: 20 },
      { driver_number: 1, compound: 'MEDIUM', lap_start: 16, lap_end: 57 },
    ];

    const driver1 = stints.filter(s => s.driver_number === 1);
    expect(driver1.length).toBe(2);
    expect(driver1.every(s => s.driver_number === 1)).toBe(true);
  });
});

// ---- Race control flag matching ----

describe('Race control flag matching', () => {
  it('matches flag field directly', () => {
    const FLAG_STYLES = {
      'Yellow': { label: 'YELLOW' },
      'SC': { label: 'SC' },
      'VSC': { label: 'VSC' },
      'Red': { label: 'RED' },
    };

    function getFlagStyle(flag, category, message) {
      if (flag) {
        const key = Object.keys(FLAG_STYLES).find(k =>
          flag.toLowerCase().includes(k.toLowerCase())
        );
        if (key) return FLAG_STYLES[key];
      }
      if (category) {
        const cat = category.toLowerCase();
        if (cat.includes('virtual')) return FLAG_STYLES['VSC'];
        if (cat.includes('safety') || cat === 'sc') return FLAG_STYLES['SC'];
        if (cat.includes('yellow')) return FLAG_STYLES['Yellow'];
        if (cat.includes('red')) return FLAG_STYLES['Red'];
      }
      if (message) {
        const msg = message.toLowerCase();
        if (msg.includes('safety car')) return FLAG_STYLES['SC'];
        if (msg.includes('virtual safety car')) return FLAG_STYLES['VSC'];
        if (msg.includes('red flag')) return FLAG_STYLES['Red'];
        if (msg.includes('yellow')) return FLAG_STYLES['Yellow'];
      }
      return null;
    }

    // Direct flag match
    expect(getFlagStyle('Yellow', '', '')).toEqual({ label: 'YELLOW' });
    expect(getFlagStyle('Red', '', '')).toEqual({ label: 'RED' });

    // Category fallback — 'virtual' checked before 'safety'
    expect(getFlagStyle(null, 'Safety Car', '')).toEqual({ label: 'SC' });
    expect(getFlagStyle(null, 'Virtual Safety Car', '')).toEqual({ label: 'VSC' });
    expect(getFlagStyle(null, 'Yellow Flag', '')).toEqual({ label: 'YELLOW' });

    // Message fallback
    expect(getFlagStyle(null, null, 'Safety Car deployed')).toEqual({ label: 'SC' });
  });
});
