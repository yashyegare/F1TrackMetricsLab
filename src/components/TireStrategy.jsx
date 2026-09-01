/**
 * TireStrategy — renders a stint strip showing tire compounds and pit stops.
 * Uses /stints endpoint for real compound data per stint.
 * Uses /pit endpoint only for pit stop duration markers.
 */
import React, { useMemo } from 'react';
import { getCompoundColor, getCompoundShort } from '../utils/openf1';

export default function TireStrategy({ stints, pitStops, totalLaps, driverNumber, driverName }) {
  const driverStints = useMemo(() => {
    if (!stints || stints.length === 0) return null;

    const filtered = stints
      .filter(s => s.driver_number === driverNumber)
      .sort((a, b) => (a.stint_number || 0) - (b.stint_number || 0));

    if (filtered.length === 0) return null;

    // Build stint list from /stints data (real compound per stint)
    return filtered.map(s => ({
      start: s.lap_start || s.lap_number || 1,
      end: s.lap_end || s.lap_start || 1,
      compound: s.compound || 'UNKNOWN',
    }));
  }, [stints, driverNumber]);

  // Pit stops only used for duration markers, NOT for compound
  const pitDurations = useMemo(() => {
    if (!pitStops || pitStops.length === 0) return [];
    return pitStops
      .filter(p => p.driver_number === driverNumber)
      .sort((a, b) => a.lap_number - b.lap_number)
      .map(p => ({ lap: p.lap_number, duration: p.pit_duration }));
  }, [pitStops, driverNumber]);

  if (!driverStints || driverStints.length === 0) return null;

  const lapsMax = totalLaps || driverStints.reduce((max, s) => Math.max(max, s.end), 0);

  return (
    <div className="tire-strategy">
      <div className="tire-strategy-header">
        <span className="tire-strategy-title">🏁 Tire Strategy</span>
        {driverName && <span className="tire-strategy-driver">{driverName}</span>}
      </div>
      <div className="tire-strategy-strip">
        {driverStints.map((stint, i) => {
          const laps = stint.end - stint.start + 1;
          const width = (laps / lapsMax) * 100;
          const color = getCompoundColor(stint.compound);
          const short = getCompoundShort(stint.compound);
          const pitDur = pitDurations.find(p => p.lap === stint.start);
          return (
            <div
              key={i}
              className="tire-stint"
              style={{ width: `${width}%`, backgroundColor: color }}
              title={`${short} — Laps ${stint.start}–${stint.end} (${laps} laps)${pitDur ? ` · Pit: ${pitDur.duration.toFixed(1)}s` : ''}`}
            >
              <span className="tire-stint-label" style={{ color: ['SOFT', 'INTERMEDIATE', 'WET'].includes(stint.compound?.toUpperCase()) ? '#fff' : '#000' }}>
                {short}
                <span className="tire-stint-laps">{laps}</span>
              </span>
            </div>
          );
        })}
      </div>
      {pitDurations.length > 0 && (
        <div className="tire-strategy-pits">
          {pitDurations.map((p, i) => (
            <span key={i} className="tire-pit-marker">
              ⛑ Lap {p.lap}: {p.duration.toFixed(1)}s
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
