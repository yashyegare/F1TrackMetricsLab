import React, { Suspense, useMemo, useState, useRef, useCallback, useEffect } from 'react';
import Track3D from './Track3D.jsx';
import { getTrackDetail } from '../utils/track3d';
import { isTelemetryAvailable, getFastestLapTelemetry } from '../utils/openf1';
import { projectTelemetry, binTelemetry, speedToColor } from '../utils/telemetryProject';

const Overlay3DPanel = React.lazy(() => import('./Overlay3DPanel.jsx'));

function fmtLen(m, unit) {
  if (m == null) return '—';
  const km = m / 1000;
  return unit === 'imperial' ? `${(km * 0.621371).toFixed(2)} mi` : `${km.toFixed(3)} km`;
}
function fmtAlt(m, unit) {
  if (m == null) return '—';
  return unit === 'imperial' ? `${(m * 3.28084).toFixed(0)} ft` : `${m} m`;
}

function StatCard({ circuit, detail, color, unit, sharedCameraRef, instanceId, animSpeed, animPaused, canvasRef, telemetry, telemetryLoading }) {
  return (
    <div className="track3d-card">
      <div className="track3d-canvas-wrap-outer" style={{ borderColor: color }}>
        <Track3D
          detail={detail}
          accentColor={color}
          height={380}
          altitude={circuit.altitude}
          circuitId={circuit.id}
          drsZones={circuit.drsZones || 0}
          sharedCameraRef={sharedCameraRef}
          instanceId={instanceId}
          animSpeed={animSpeed}
          animPaused={animPaused}
          canvasRef={canvasRef}
          telemetry={telemetry}
        />
      </div>
      <p className="track3d-caption">Drag to rotate • Scroll to zoom • Click corner to focus</p>

      <h3 className="track3d-title">{circuit.name}</h3>
      <p className="compare-location">{circuit.location}</p>

      {telemetry && (
        <div className="telemetry-badge">
          <span className="telemetry-badge-dot" />
          Real telemetry — {telemetry.session.name} 2024
        </div>
      )}
      {telemetryLoading && (
        <div className="telemetry-badge loading">
          <span className="telemetry-badge-dot loading" />
          Fetching telemetry…
        </div>
      )}

      <div className="track3d-stats">
        <div>
          <span className="label">Length</span>
          <span className="value">{fmtLen(detail.lengthMeters, unit)}</span>
        </div>
        <div>
          <span className="label">Corners (approx.)</span>
          <span className="value">{detail.corners.length}</span>
        </div>
        <div>
          <span className="label">Direction</span>
          <span className="value">{detail.direction}</span>
        </div>
        <div>
          <span className="label">Longest straight</span>
          <span className="value">{fmtLen(detail.longestStraightMeters, unit)}</span>
        </div>
        <div>
          <span className="label">Opened</span>
          <span className="value">{circuit.opened ?? '—'}</span>
        </div>
        <div>
          <span className="label">Altitude</span>
          <span className="value">{fmtAlt(circuit.altitude, unit)}</span>
        </div>
        {circuit.drsZones > 0 && (
          <div>
            <span className="label">DRS Zones</span>
            <span className="value">{circuit.drsZones}</span>
          </div>
        )}
        {circuit.lapRecord && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span className="label">Lap Record</span>
            <span className="value" style={{ fontSize: '12px' }}>{circuit.lapRecord.time} {circuit.lapRecord.driver} ({circuit.lapRecord.year})</span>
          </div>
        )}
        {telemetry && telemetry.lap && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span className="label">Telemetry Lap</span>
            <span className="value" style={{ fontSize: '12px', color: '#00ff88' }}>
              {formatLapDuration(telemetry.lap.duration)} {telemetry.lap.driverName || 'Driver #' + telemetry.lap.driver}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatLapDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
}

export default function Compare3DPanel({ primary, secondary, unit = 'metric' }) {
  const [viewMode, setViewMode] = useState('sidebyside');
  const [animSpeed, setAnimSpeed] = useState(0);
  const [animPaused, setAnimPaused] = useState(false);
  const [telemetryMode, setTelemetryMode] = useState(false);
  const [telemetryYear, setTelemetryYear] = useState(2024);
  const [primaryTelemetry, setPrimaryTelemetry] = useState(null);
  const [secondaryTelemetry, setSecondaryTelemetry] = useState(null);
  const [primaryLoading, setPrimaryLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(false);

  const primaryDetail = useMemo(() => getTrackDetail(primary), [primary]);
  const secondaryDetail = useMemo(() => getTrackDetail(secondary), [secondary]);

  // Shared camera state for sync
  const sharedCameraRef = useRef({ position: null, target: null, _instanceId: null, _targetId: null });

  // Canvas refs for screenshot
  const primaryCanvasRef = useRef();
  const secondaryCanvasRef = useRef();

  // Fetch telemetry when mode is enabled
  useEffect(() => {
    if (!telemetryMode) {
      setPrimaryTelemetry(null);
      setSecondaryTelemetry(null);
      return;
    }

    let cancelled = false;

    async function fetchTelemetry() {
      // Only fetch for circuits with available data
      if (isTelemetryAvailable(primary.id)) {
        setPrimaryLoading(true);
        try {
          const data = await getFastestLapTelemetry(primary.id, telemetryYear);
          if (!cancelled && data) {
            const { projected } = projectTelemetry(primary.coordinates, data.telemetry);
            const binned = binTelemetry(projected, primary.coordinates.length);
            setPrimaryTelemetry({ ...data, binned, projected });
          }
        } catch (e) {
          console.warn('Telemetry fetch failed for', primary.id, e);
        }
        if (!cancelled) setPrimaryLoading(false);
      }

      if (isTelemetryAvailable(secondary.id)) {
        setSecondaryLoading(true);
        try {
          const data = await getFastestLapTelemetry(secondary.id, telemetryYear);
          if (!cancelled && data) {
            const { projected } = projectTelemetry(secondary.coordinates, data.telemetry);
            const binned = binTelemetry(projected, secondary.coordinates.length);
            setSecondaryTelemetry({ ...data, binned, projected });
          }
        } catch (e) {
          console.warn('Telemetry fetch failed for', secondary.id, e);
        }
        if (!cancelled) setSecondaryLoading(false);
      }
    }

    fetchTelemetry();
    return () => { cancelled = true; };
  }, [telemetryMode, telemetryYear, primary.id, secondary.id, primary.coordinates, secondary.coordinates]);

  const handleScreenshot = useCallback((name) => {
    const cards = document.querySelectorAll('.track3d-canvas-wrap-outer');
    const card = cards[name === 'A' ? 0 : 1];
    const canvas = card?.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `f1-track-${name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }, []);

  const primaryHasTelemetry = isTelemetryAvailable(primary.id);
  const secondaryHasTelemetry = isTelemetryAvailable(secondary.id);

  return (
    <div className="compare3d-wrapper">
      <div className="compare3d-inner">
        <div className="compare3d-mode-toggle">
          <button
            className={viewMode === 'sidebyside' ? 'active' : ''}
            onClick={() => setViewMode('sidebyside')}
          >
            Side by Side
          </button>
          <button
            className={viewMode === 'overlay' ? 'active' : ''}
            onClick={() => setViewMode('overlay')}
          >
            Overlay
          </button>
        </div>

        <div className="track3d-toolbar">
          <div className="anim-controls">
            <span className="toolbar-label">Animate</span>
            <button className={`anim-btn${animSpeed === 0 ? ' active' : ''}`} onClick={() => { setAnimSpeed(0); setAnimPaused(false); }}>Off</button>
            <button className={`anim-btn${animSpeed === 0.5 ? ' active' : ''}`} onClick={() => { setAnimSpeed(0.5); setAnimPaused(false); }}>0.5×</button>
            <button className={`anim-btn${animSpeed === 1 ? ' active' : ''}`} onClick={() => { setAnimSpeed(1); setAnimPaused(false); }}>1×</button>
            <button className={`anim-btn${animSpeed === 2 ? ' active' : ''}`} onClick={() => { setAnimSpeed(2); setAnimPaused(false); }}>2×</button>
            {animSpeed > 0 && (
              <button className="anim-btn" onClick={() => setAnimPaused(p => !p)}>
                {animPaused ? '▶' : '⏸'}
              </button>
            )}
          </div>

          <div className="anim-controls telemetry-controls">
            <button
              className={`anim-btn${telemetryMode ? ' active telemetry-active' : ''}`}
              onClick={() => setTelemetryMode(t => !t)}
              title="Toggle real telemetry data from OpenF1 (2023+ circuits only)"
            >
              {telemetryMode ? '⚡ Race Pace' : 'Race Pace'}
            </button>
            {telemetryMode && (
              <select
                className="telemetry-year-select"
                value={telemetryYear}
                onChange={e => setTelemetryYear(Number(e.target.value))}
              >
                <option value={2024}>2024</option>
                <option value={2023}>2023</option>
              </select>
            )}
          </div>

          {viewMode === 'sidebyside' && (
            <div className="screenshot-controls">
              <button className="anim-btn" onClick={() => handleScreenshot('A')} title="Screenshot Track A">📷 A</button>
              <button className="anim-btn" onClick={() => handleScreenshot('B')} title="Screenshot Track B">📷 B</button>
            </div>
          )}
        </div>

        {viewMode === 'sidebyside' ? (
          <div className="compare3d-panel">
            <StatCard
              circuit={primary} detail={primaryDetail} color="#e10600" unit={unit}
              sharedCameraRef={sharedCameraRef} instanceId="A"
              animSpeed={animSpeed} animPaused={animPaused}
              canvasRef={primaryCanvasRef}
              telemetry={primaryTelemetry} telemetryLoading={primaryLoading}
            />
            <StatCard
              circuit={secondary} detail={secondaryDetail} color="#00a3ff" unit={unit}
              sharedCameraRef={sharedCameraRef} instanceId="B"
              animSpeed={animSpeed} animPaused={animPaused}
              canvasRef={secondaryCanvasRef}
              telemetry={secondaryTelemetry} telemetryLoading={secondaryLoading}
            />
          </div>
        ) : (
          <Suspense fallback={<div className="loading-3d">Loading overlay…</div>}>
            <Overlay3DPanel
              primary={primary}
              secondary={secondary}
              primaryDetail={primaryDetail}
              secondaryDetail={secondaryDetail}
              animSpeed={animSpeed}
              animPaused={animPaused}
            />
          </Suspense>
        )}

        <p className="compare-note">
          {telemetryMode ? (
            <>Speed-colored ribbon uses real telemetry from OpenF1 ({primaryTelemetry?.lap?.driverName || ('Driver #' + (primaryTelemetry?.lap?.driver ?? '?'))}/{secondaryTelemetry?.lap?.driverName || ('Driver #' + (secondaryTelemetry?.lap?.driver ?? '?'))} fastest qualifying laps). Corner count and track shape from outline data, not official telemetry.</>
          ) : (
            <>Track shape comes from the same outline data as the map view. Corner count, spin direction and longest straight are computed from that outline (not official telemetry), and the road width / marker heights are stylized for visibility, not to scale.</>
          )}
        </p>
      </div>
    </div>
  );
}
