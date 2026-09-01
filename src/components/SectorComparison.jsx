/**
 * SectorComparison — sector-by-sector delta table for two drivers.
 * Shows individual sector times and deltas, highlighting the faster sector.
 */
import React from 'react';

function fmtTime(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : secs;
}

function fmtDelta(delta) {
  if (!delta && delta !== 0) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}s`;
}

/**
 * Extracts sector times from a lap object.
 * OpenF1 lap objects have: duration_sector_1, duration_sector_2, duration_sector_3 (in seconds).
 * getLapTelemetry maps these to sector1, sector2, sector3 on the returned lap object.
 */
export default function SectorComparison({ primaryLap, secondaryLap, primaryName, secondaryName, primaryAllLaps, secondaryAllLaps }) {
  if (!primaryLap && !secondaryLap) return null;

  // Best theoretical lap from all qualifying sector times
  const bestTheoretical = (() => {
    const compute = (laps) => {
      if (!laps || laps.length === 0) return null;
      const s1 = laps.map(l => l.duration_sector_1).filter(v => v != null);
      const s2 = laps.map(l => l.duration_sector_2).filter(v => v != null);
      const s3 = laps.map(l => l.duration_sector_3).filter(v => v != null);
      if (s1.length === 0 || s2.length === 0 || s3.length === 0) return null;
      return Math.min(...s1) + Math.min(...s2) + Math.min(...s3);
    };
    return { primary: compute(primaryAllLaps), secondary: compute(secondaryAllLaps) };
  })();

  // Extract sector times from the lap object mapped in getLapTelemetry
  // (duration_sector_1/2/3 from OpenF1 are mapped to sector1/2/3)
  const primarySectors = [
    primaryLap?.sector1 ?? primaryLap?.duration_sector_1,
    primaryLap?.sector2 ?? primaryLap?.duration_sector_2,
    primaryLap?.sector3 ?? primaryLap?.duration_sector_3,
  ];
  const secondarySectors = [
    secondaryLap?.sector1 ?? secondaryLap?.duration_sector_1,
    secondaryLap?.sector2 ?? secondaryLap?.duration_sector_2,
    secondaryLap?.sector3 ?? secondaryLap?.duration_sector_3,
  ];

  const hasSectors = primarySectors.some(s => s != null) || secondarySectors.some(s => s != null);
  if (!hasSectors) return null;

  const nameA = primaryName || 'Car A';
  const nameB = secondaryName || 'Car B';

  return (
    <div className="sector-comparison">
      <div className="sector-header">
        <span className="sector-title">📊 Sector Comparison</span>
      </div>
      <div className="sector-table">
        <div className="sector-row sector-row-header">
          <div className="sector-cell sector-label">Sector</div>
          <div className="sector-cell" style={{ color: '#e10600' }}>{nameA}</div>
          <div className="sector-cell" style={{ color: '#00a3ff' }}>{nameB}</div>
          <div className="sector-cell">Delta</div>
        </div>
        {[0, 1, 2].map(i => {
          const sA = primarySectors[i];
          const sB = secondarySectors[i];
          const delta = (sA != null && sB != null) ? sB - sA : null;
          const faster = delta != null ? (delta > 0 ? 'A' : delta < 0 ? 'B' : null) : null;

          return (
            <div key={i} className="sector-row">
              <div className="sector-cell sector-label">S{i + 1}</div>
              <div className={`sector-cell ${faster === 'A' ? 'sector-faster' : ''}`}>
                {fmtTime(sA)}
              </div>
              <div className={`sector-cell ${faster === 'B' ? 'sector-faster' : ''}`}>
                {fmtTime(sB)}
              </div>
              <div className="sector-cell" style={{
                color: delta != null
                  ? (delta < 0 ? '#00cc44' : delta > 0 ? '#e10600' : '#8a8a90')
                  : '#666',
                fontWeight: 600,
              }}>
                {fmtDelta(delta)}
              </div>
            </div>
          );
        })}
        {/* Total row */}
        {(() => {
          const totalA = primarySectors.every(s => s != null) ? primarySectors.reduce((a, b) => a + b, 0) : null;
          const totalB = secondarySectors.every(s => s != null) ? secondarySectors.reduce((a, b) => a + b, 0) : null;
          const totalDelta = (totalA != null && totalB != null) ? totalB - totalA : null;
          return (
            <div className="sector-row sector-row-total">
              <div className="sector-cell sector-label">Total</div>
              <div className="sector-cell" style={{ fontWeight: 700 }}>{fmtTime(totalA)}</div>
              <div className="sector-cell" style={{ fontWeight: 700 }}>{fmtTime(totalB)}</div>
              <div className="sector-cell" style={{
                color: totalDelta != null
                  ? (totalDelta < 0 ? '#00cc44' : totalDelta > 0 ? '#e10600' : '#8a8a90')
                  : '#666',
                fontWeight: 700,
              }}>
                {fmtDelta(totalDelta)}
              </div>
            </div>
          );
        })()}
        {/* Best theoretical lap row */}
        {bestTheoretical.primary != null && (
          <div className="sector-row" style={{ borderTop: '1px solid #222226', background: 'rgba(200, 160, 0, 0.04)' }}>
            <div className="sector-cell sector-label" style={{ color: '#c8a000' }}>Best</div>
            <div className="sector-cell" style={{ color: '#c8a000', fontWeight: 700 }}>
              {fmtTime(bestTheoretical.primary)}
            </div>
            <div className="sector-cell" style={{ color: bestTheoretical.secondary != null ? '#c8a000' : '#666', fontWeight: 700 }}>
              {bestTheoretical.secondary != null ? fmtTime(bestTheoretical.secondary) : '—'}
            </div>
            <div className="sector-cell" style={{ color: '#6a6a70', fontSize: 9 }}>
              theoretical
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
