import React, { useMemo, useRef, useState, useCallback } from 'react';
import OverlayScene from './OverlayScene';

export default function Overlay3DPanel({ primary, secondary, primaryDetail, secondaryDetail, animSpeed = 0, animPaused = false, primaryTelemetry, secondaryTelemetry, primaryWeather, secondaryWeather, primaryLap, secondaryLap, primaryAllLaps, secondaryAllLaps }) {
  const [showLabels, setShowLabels] = useState(true);
  const [showTrackA, setShowTrackA] = useState(true);
  const [showTrackB, setShowTrackB] = useState(true);
  const [syncMode, setSyncMode] = useState(false);
  const [seaLevelMode, setSeaLevelMode] = useState(false);
  const sharedProgressRef = useRef(Math.random());
  const gapRef = useRef({ primaryProgress: null, secondaryProgress: null, primaryTime: null, secondaryTime: null });
  const canvasWrapRef = useRef(null);

  // Screenshot/export
  const handleScreenshot = useCallback(() => {
    const canvas = canvasWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `overlay-${primary.id}-vs-${secondary.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [primary.id, secondary.id]);

  // Best theoretical lap from qualifying sector times
  const bestTheoretical = useMemo(() => {
    const compute = (laps) => {
      if (!laps || laps.length === 0) return null;
      const s1s = laps.map(l => l.duration_sector_1).filter(v => v != null);
      const s2s = laps.map(l => l.duration_sector_2).filter(v => v != null);
      const s3s = laps.map(l => l.duration_sector_3).filter(v => v != null);
      if (s1s.length === 0 || s2s.length === 0 || s3s.length === 0) return null;
      const best = Math.min(...s1s) + Math.min(...s2s) + Math.min(...s3s);
      return best;
    };
    return {
      primary: compute(primaryAllLaps),
      secondary: compute(secondaryAllLaps),
    };
  }, [primaryAllLaps, secondaryAllLaps]);

  // Weather info for overlay HUD
  const wx = useMemo(() => {
    const get = (w) => {
      if (!w) return null;
      const data = Array.isArray(w) ? w[w.length - 1] : w;
      return data ? {
        trackTemp: data.track_temperature,
        airTemp: data.air_temperature,
        rainfall: data.rainfall,
        humidity: data.humidity,
        windSpeed: data.wind_speed,
      } : null;
    };
    return { primary: get(primaryWeather), secondary: get(secondaryWeather) };
  }, [primaryWeather, secondaryWeather]);

  const fmtTime = (s) => {
    if (s == null) return '—';
    const mins = Math.floor(s / 60);
    const secs = (s % 60).toFixed(3);
    return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : secs;
  };

  return (
    <div className="compare3d-wrapper">
      <div className="overlay-3d-container">
        {/* Overlay controls */}
        <div className="overlay-controls">
          <button className={`overlay-ctrl-btn ${showLabels ? 'active' : ''}`} onClick={() => setShowLabels(l => !l)} title="Toggle circuit name labels">
            🏷 Labels
          </button>
          <button className={`overlay-ctrl-btn ${syncMode ? 'active' : ''}`} onClick={() => setSyncMode(s => !s)} title="Sync both car dots to the same lap progress">
            🔗 Sync Progress
          </button>
          <button className={`overlay-ctrl-btn ${seaLevelMode ? 'active' : ''}`} onClick={() => setSeaLevelMode(s => !s)} title="Show tracks at their sea-level altitude">
            🏔 Sea Level
          </button>
          <div className="toolbar-separator" style={{ height: 16, alignSelf: 'center' }} />
          <button
            className={`overlay-ctrl-btn track-toggle ${showTrackA ? 'active' : ''}`}
            style={showTrackA ? { borderColor: '#e10600' } : {}}
            onClick={() => setShowTrackA(a => !a)}
            title={`Show/hide ${primary.name}`}
          >
            <span className="track-toggle-dot" style={{ background: '#e10600' }} />
            {primary.name}
          </button>
          <button
            className={`overlay-ctrl-btn track-toggle ${showTrackB ? 'active' : ''}`}
            style={showTrackB ? { borderColor: '#00a3ff' } : {}}
            onClick={() => setShowTrackB(b => !b)}
            title={`Show/hide ${secondary.name}`}
          >
            <span className="track-toggle-dot" style={{ background: '#00a3ff' }} />
            {secondary.name}
          </button>
        </div>

        {/* Screenshot button */}
        <button className="overlay-screenshot-btn" onClick={handleScreenshot} title="Download overlay as PNG">
          📷
        </button>

        {/* Weather + Best Theoretical Lap bar */}
        {(wx.primary || wx.secondary || bestTheoretical.primary != null) && (
          <div className="overlay-info-bar">
            {wx.primary && (
              <span className="overlay-wx-chip" style={{ borderColor: '#e10600' }}>
                {wx.primary.rainfall ? '🌧' : '☀️'} {wx.primary.airTemp != null ? `${wx.primary.airTemp}°C air` : ''}
                {wx.primary.trackTemp != null ? ` · ${wx.primary.trackTemp}°C track` : ''}
              </span>
            )}
            {wx.secondary && (
              <span className="overlay-wx-chip" style={{ borderColor: '#00a3ff' }}>
                {wx.secondary.rainfall ? '🌧' : '☀️'} {wx.secondary.airTemp != null ? `${wx.secondary.airTemp}°C air` : ''}
                {wx.secondary.trackTemp != null ? ` · ${wx.secondary.trackTemp}°C track` : ''}
              </span>
            )}
            {bestTheoretical.primary != null && (
              <span className="overlay-theoretical">
                Best theoretical: {fmtTime(bestTheoretical.primary)}
                {bestTheoretical.secondary != null && ` vs ${fmtTime(bestTheoretical.secondary)}`}
              </span>
            )}
          </div>
        )}

        <div className="overlay-3d-canvas-wrap" ref={canvasWrapRef}>
          <OverlayScene
            primaryDetail={primaryDetail}
            secondaryDetail={secondaryDetail}
            primaryAltitude={primary.altitude}
            secondaryAltitude={secondary.altitude}
            primaryId={primary.id}
            secondaryId={secondary.id}
            primaryDrsZones={primary.drsZones || 0}
            secondaryDrsZones={secondary.drsZones || 0}
            animSpeed={animSpeed}
            animPaused={animPaused}
            showLabels={showLabels}
            showTrackA={showTrackA}
            showTrackB={showTrackB}
            syncMode={syncMode}
            seaLevelMode={seaLevelMode}
            sharedProgressRef={sharedProgressRef}
            primaryTelemetry={primaryTelemetry}
            secondaryTelemetry={secondaryTelemetry}
            gapRef={gapRef}
          />
        </div>

        {/* Circuit name labels — lower-third overlay inside canvas container */}
        {showLabels && (
          <div className="overlay-labels">
            <span className="overlay-label" style={{ color: '#e10600' }}>{primary.name}</span>
            <span className="overlay-label-sep">vs</span>
            <span className="overlay-label" style={{ color: '#00a3ff' }}>{secondary.name}</span>
          </div>
        )}

      </div>

      {/* Track stats section — same width as canvas */}
      <div className="overlay-section-panel">
        <div className="overlay-section-title">
          <span className="overlay-section-icon h2h">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </span>
          Head-to-Head
        </div>
        <div className="overlay-stat-card">
        <div className="overlay-stat-diff">
          <span className="overlay-stat-label">Length</span>
          <span className="overlay-stat-val" style={{ color: '#e10600' }}>{(primary.length / 1000).toFixed(3)} km</span>
          <span className="overlay-stat-vs">vs</span>
          <span className="overlay-stat-val" style={{ color: '#00a3ff' }}>{(secondary.length / 1000).toFixed(3)} km</span>
          <span className={`overlay-stat-badge ${primary.length > secondary.length ? 'winner-a' : 'winner-b'}`}>
            {primary.length > secondary.length ? '▲' : '▼'} {Math.abs((primary.length - secondary.length) / 1000).toFixed(3)} km
          </span>
        </div>
        <div className="overlay-stat-diff">
          <span className="overlay-stat-label">Corners</span>
          <span className="overlay-stat-val" style={{ color: '#e10600' }}>{primaryDetail.corners.length}</span>
          <span className="overlay-stat-vs">vs</span>
          <span className="overlay-stat-val" style={{ color: '#00a3ff' }}>{secondaryDetail.corners.length}</span>
          <span className={`overlay-stat-badge ${primaryDetail.corners.length > secondaryDetail.corners.length ? 'winner-a' : primaryDetail.corners.length < secondaryDetail.corners.length ? 'winner-b' : 'tie'}`}>
            {primaryDetail.corners.length > secondaryDetail.corners.length ? '▲' : primaryDetail.corners.length < secondaryDetail.corners.length ? '▼' : '—'} {Math.abs(primaryDetail.corners.length - secondaryDetail.corners.length)}
          </span>
        </div>
        <div className="overlay-stat-diff">
          <span className="overlay-stat-label">Altitude</span>
          <span className="overlay-stat-val" style={{ color: '#e10600' }}>{primary.altitude} m</span>
          <span className="overlay-stat-vs">vs</span>
          <span className="overlay-stat-val" style={{ color: '#00a3ff' }}>{secondary.altitude} m</span>
          <span className={`overlay-stat-badge ${primary.altitude > secondary.altitude ? 'winner-a' : 'winner-b'}`}>
            {primary.altitude > secondary.altitude ? '▲' : '▼'} {Math.abs(primary.altitude - secondary.altitude)} m
          </span>
        </div>
        <div className="overlay-stat-diff">
          <span className="overlay-stat-label">Archived DRS count</span>
          <span className="overlay-stat-val" style={{ color: '#e10600' }}>{primary.drsZones || 0}</span>
          <span className="overlay-stat-vs">vs</span>
          <span className="overlay-stat-val" style={{ color: '#00a3ff' }}>{secondary.drsZones || 0}</span>
          <span className="overlay-stat-badge tie">
            — {Math.abs((primary.drsZones || 0) - (secondary.drsZones || 0))}
          </span>
        </div>
        <div className="overlay-stat-diff">
          <span className="overlay-stat-label">Opened</span>
          <span className="overlay-stat-val" style={{ color: '#e10600' }}>{primary.opened}</span>
          <span className="overlay-stat-vs">vs</span>
          <span className="overlay-stat-val" style={{ color: '#00a3ff' }}>{secondary.opened}</span>
          <span className={`overlay-stat-badge ${primary.opened < secondary.opened ? 'winner-a' : 'winner-b'}`}>
            {primary.opened < secondary.opened ? '▲' : '▼'} {Math.abs(primary.opened - secondary.opened)}
          </span>
        </div>
        <div className="overlay-stat-diff">
          <span className="overlay-stat-label">Direction</span>
          <span className="overlay-stat-val" style={{ color: '#e10600' }}>{primaryDetail.direction}</span>
          <span className="overlay-stat-vs">vs</span>
          <span className="overlay-stat-val" style={{ color: '#00a3ff' }}>{secondaryDetail.direction}</span>
        </div>
        </div>
      </div>

      {/* Layout history badges */}
      {(() => {
        const hasHistory = (
          (primary.trackHistory?.layoutChanges && primary.trackHistory.layoutChanges !== 'Original layout unchanged since opening') ||
          (secondary.trackHistory?.layoutChanges && secondary.trackHistory.layoutChanges !== 'Original layout unchanged since opening')
        );
        if (!hasHistory) return null;
        return (
          <div className="overlay-section-panel">
            <div className="overlay-section-title">
              <span className="overlay-section-icon history">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
              Track History
            </div>
            <div className="overlay-layout-history">
              {primary.trackHistory?.layoutChanges && primary.trackHistory.layoutChanges !== 'Original layout unchanged since opening' && (
                <span className="overlay-layout-badge" style={{ borderColor: '#e10600' }}>
                  <span style={{ color: '#e10600', fontWeight: 700 }}>{primary.name.split(' ')[0]}</span> {primary.trackHistory.layoutChanges}
                </span>
              )}
              {secondary.trackHistory?.layoutChanges && secondary.trackHistory.layoutChanges !== 'Original layout unchanged since opening' && (
                <span className="overlay-layout-badge" style={{ borderColor: '#00a3ff' }}>
                  <span style={{ color: '#00a3ff', fontWeight: 700 }}>{secondary.name.split(' ')[0]}</span> {secondary.trackHistory.layoutChanges}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      <div className="overlay-footer">
        <div className="overlay-footer-info">
          <span className="overlay-footer-note">
            Normalized to same bounding box · Corner markers stylized, not to scale
          </span>
          {syncMode && <span className="overlay-footer-sync">● Sync active</span>}
          {seaLevelMode && <span className="overlay-footer-sync" style={{ color: '#c8a000' }}>● Sea level view</span>}
        </div>
        <div className="overlay-footer-legend">
          <span className="overlay-legend-item">
            <span className="overlay-legend-dot" style={{ background: '#e10600' }} />
            {primary.name}{primaryLap?.driverName ? <span className="overlay-legend-driver"> — {primaryLap.driverName.split(' ').pop()}</span> : ''}
          </span>
          <span className="overlay-legend-sep">vs</span>
          <span className="overlay-legend-item">
            <span className="overlay-legend-dot" style={{ background: '#00a3ff' }} />
            {secondary.name}{secondaryLap?.driverName ? <span className="overlay-legend-driver"> — {secondaryLap.driverName.split(' ').pop()}</span> : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
