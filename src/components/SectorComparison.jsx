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
 * OpenF1 lap objects have: sector_1_time, sector_2_time, sector_3_time (in seconds).
 */
export default function SectorComparison({ primaryLap, secondaryLap, primaryName, secondaryName }) {
  if (!primaryLap && !secondaryLap) return null;

  // Extract sector times from raw OpenF1 lap data
  const primarySectors = [
    primaryLap?.sector_1_time,
    primaryLap?.sector_2_time,
    primaryLap?.sector_3_time,
  ];
  const secondarySectors = [
    secondaryLap?.sector_1_time,
    secondaryLap?.sector_2_time,
    secondaryLap?.sector_3_time,
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
      </div>
    </div>
  );
}
