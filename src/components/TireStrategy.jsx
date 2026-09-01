/**
 * TireStrategy — renders a stint strip showing tire compounds and pit stops.
 * Each stint is a colored bar with the compound letter, separated by pit stop markers.
 */
import React, { useMemo } from 'react';
import { getCompoundColor, getCompoundShort } from '../utils/openf1';

export default function TireStrategy({ pitStops, totalLaps, driverNumber, driverName }) {
  const stints = useMemo(() => {
    if (!pitStops || pitStops.length === 0) return null;

    const driverPits = pitStops
      .filter(p => p.driver_number === driverNumber)
      .sort((a, b) => a.lap_number - b.lap_number);

    if (driverPits.length === 0) return null;

    const result = [];
    let startLap = 1;

    for (const pit of driverPits) {
      const compound = pit.compound || pit.tyre?.toUpperCase() || guessCompound(pit.pit_duration);
      result.push({
        start: startLap,
        end: pit.lap_number - 1,
        compound,
        pitDuration: pit.pit_duration,
      });
      startLap = pit.lap_number;
    }
    // Final stint after last pit
    result.push({
      start: startLap,
      end: totalLaps || startLap + 10,
      compound: driverPits[driverPits.length - 1]?.next_compound || driverPits[driverPits.length - 1]?.compound || 'UNKNOWN',
      pitDuration: null,
    });

    return result;
  }, [pitStops, driverNumber, totalLaps]);

  if (!stints || stints.length === 0) return null;

  const totalLapsCalc = stints.reduce((max, s) => Math.max(max, s.end), 0);

  return (
    <div className="tire-strategy">
      <div className="tire-strategy-header">
        <span className="tire-strategy-title">🏁 Tire Strategy</span>
        {driverName && <span className="tire-strategy-driver">{driverName}</span>}
      </div>
      <div className="tire-strategy-strip">
        {stints.map((stint, i) => {
          const width = ((stint.end - stint.start + 1) / totalLapsCalc) * 100;
          const color = getCompoundColor(stint.compound);
          const short = getCompoundShort(stint.compound);
          const laps = stint.end - stint.start + 1;
          return (
            <div
              key={i}
              className="tire-stint"
              style={{ width: `${width}%`, backgroundColor: color }}
              title={`${short} — Laps ${stint.start}–${stint.end} (${laps} laps)${stint.pitDuration ? ` · Pit: ${stint.pitDuration.toFixed(1)}s` : ''}`}
            >
              <span className="tire-stint-label" style={{ color: ['SOFT', 'INTERMEDIATE', 'WET'].includes(stint.compound?.toUpperCase()) ? '#fff' : '#000' }}>
                {short}
                <span className="tire-stint-laps">{laps}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="tire-strategy-pits">
        {stints.filter(s => s.pitDuration).map((stint, i) => (
          <span key={i} className="tire-pit-marker">
            ⛑ {stint.pitDuration.toFixed(1)}s
          </span>
        ))}
      </div>
    </div>
  );
}

function guessCompound(duration) {
  if (!duration) return 'UNKNOWN';
  if (duration < 2.5) return 'HARD';
  if (duration < 3.5) return 'MEDIUM';
  return 'SOFT';
}
