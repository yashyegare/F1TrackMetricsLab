import React, { Suspense, useMemo, useState, useRef, useCallback } from 'react';
import Track3D from './Track3D.jsx';
import { getTrackDetail } from '../utils/track3d';

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

function StatCard({ circuit, detail, color, unit, sharedCameraRef, instanceId, animSpeed, animPaused, canvasRef }) {
  return (
    <div className="track3d-card">
      <div className="track3d-canvas-wrap-outer" style={{ borderColor: color }}>
        <Track3D
          detail={detail}
          accentColor={color}
          height={380}
          altitude={circuit.altitude}
          circuitId={circuit.id}
          sharedCameraRef={sharedCameraRef}
          instanceId={instanceId}
          animSpeed={animSpeed}
          animPaused={animPaused}
          canvasRef={canvasRef}
        />
      </div>
      <p className="track3d-caption">Drag to rotate • Scroll to zoom • Click corner to focus</p>

      <h3 className="track3d-title">{circuit.name}</h3>
      <p className="compare-location">{circuit.location}</p>

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
      </div>
    </div>
  );
}

export default function Compare3DPanel({ primary, secondary, unit = 'metric' }) {
  const [viewMode, setViewMode] = useState('sidebyside');
  const [animSpeed, setAnimSpeed] = useState(0); // 0 = off, 0.5/1/2 = speeds
  const [animPaused, setAnimPaused] = useState(false);
  const primaryDetail = useMemo(() => getTrackDetail(primary), [primary]);
  const secondaryDetail = useMemo(() => getTrackDetail(secondary), [secondary]);

  // Shared camera state for sync
  const sharedCameraRef = useRef({ position: null, target: null, _instanceId: null, _targetId: null });

  // Canvas refs for screenshot
  const primaryCanvasRef = useRef();
  const secondaryCanvasRef = useRef();

  const handleScreenshot = useCallback((name) => {
    // Find canvas by index inside the outer wrappers
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

        {viewMode === 'sidebyside' && (
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
            <div className="screenshot-controls">
              <button className="anim-btn" onClick={() => handleScreenshot('A')} title="Screenshot Track A">📷 A</button>
              <button className="anim-btn" onClick={() => handleScreenshot('B')} title="Screenshot Track B">📷 B</button>
            </div>
          </div>
        )}

        {viewMode === 'sidebyside' ? (
          <div className="compare3d-panel">
            <StatCard
              circuit={primary} detail={primaryDetail} color="#e10600" unit={unit}
              sharedCameraRef={sharedCameraRef} instanceId="A"
              animSpeed={animSpeed} animPaused={animPaused}
              canvasRef={primaryCanvasRef}
            />
            <StatCard
              circuit={secondary} detail={secondaryDetail} color="#00a3ff" unit={unit}
              sharedCameraRef={sharedCameraRef} instanceId="B"
              animSpeed={animSpeed} animPaused={animPaused}
              canvasRef={secondaryCanvasRef}
            />
          </div>
        ) : (
          <Suspense fallback={<div className="loading-3d">Loading overlay…</div>}>
            <Overlay3DPanel
              primary={primary}
              secondary={secondary}
              primaryDetail={primaryDetail}
              secondaryDetail={secondaryDetail}
            />
          </Suspense>
        )}

        <p className="compare-note">
          Track shape comes from the same outline data as the map view. Corner count, spin
          direction and longest straight are computed from that outline (not official telemetry),
          and the road width / marker heights are stylized for visibility, not to scale.
        </p>
      </div>
    </div>
  );
}
