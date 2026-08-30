import React, { Suspense, useMemo, useState, useRef, useCallback, useEffect } from 'react';
import Track3D from './Track3D.jsx';
import { getTrackDetail } from '../utils/track3d';
import { isTelemetryAvailable, getFastestLapTelemetry, getQualifyingData, getLapTelemetry } from '../utils/openf1';
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
          Real telemetry — {telemetry.session.name} {telemetry.session.year}
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

/**
 * Given qualifying data and a driver number, find that driver's fastest lap
 * and return the full telemetry result via getLapTelemetry.
 */
async function fetchDriverTelemetry(circuitId, year, qualiData, driverNumber) {
  const { quali, laps, drivers } = qualiData;
  // Find this driver's fastest lap
  const driverLaps = laps.filter(l => l.driver_number === driverNumber);
  if (driverLaps.length === 0) return null;
  const fastest = driverLaps[0]; // already sorted by duration

  const result = await getLapTelemetry(circuitId, year, quali.session_key, driverNumber, fastest, drivers);
  if (!result) return null;
  result.session.name = quali.session_name;
  return result;
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

  // Driver picker state
  const [primaryDrivers, setPrimaryDrivers] = useState([]);
  const [secondaryDrivers, setSecondaryDrivers] = useState([]);
  const [primaryDriver, setPrimaryDriver] = useState(null); // null = fastest
  const [secondaryDriver, setSecondaryDriver] = useState(null);
  const primaryQualiData = useRef(null);
  const secondaryQualiData = useRef(null);

  const primaryDetail = useMemo(() => getTrackDetail(primary), [primary]);
  const secondaryDetail = useMemo(() => getTrackDetail(secondary), [secondary]);

  // Shared camera state for sync
  const sharedCameraRef = useRef({ position: null, target: null, _instanceId: null, _targetId: null });

  // Canvas refs for screenshot
  const primaryCanvasRef = useRef();
  const secondaryCanvasRef = useRef();

  // Projection cache
  const projectionCache = useRef(new Map());

  function getCachedProjection(circuitId, year, coordinates, telemetry) {
    const key = `${circuitId}:${year}:${coordinates.length}`;
    if (projectionCache.current.has(key)) return projectionCache.current.get(key);
    const { projected } = projectTelemetry(coordinates, telemetry);
    const binned = binTelemetry(projected, coordinates.length);
    const result = { projected, binned };
    if (projectionCache.current.size > 20) {
      const firstKey = projectionCache.current.keys().next().value;
      projectionCache.current.delete(firstKey);
    }
    projectionCache.current.set(key, result);
    return result;
  }

  // Fetch telemetry when mode is enabled
  useEffect(() => {
    if (!telemetryMode) {
      setPrimaryTelemetry(null);
      setSecondaryTelemetry(null);
      setPrimaryDrivers([]);
      setSecondaryDrivers([]);
      setPrimaryDriver(null);
      setSecondaryDriver(null);
      primaryQualiData.current = null;
      secondaryQualiData.current = null;
      return;
    }

    let cancelled = false;

    async function fetchTelemetry() {
      // Primary
      if (isTelemetryAvailable(primary.id)) {
        setPrimaryLoading(true);
        try {
          const qualiData = await getQualifyingData(primary.id, telemetryYear);
          if (cancelled || !qualiData) return;
          primaryQualiData.current = qualiData;

          // Deduplicate drivers (some entries appear multiple times)
          const seen = new Set();
          const uniqueDrivers = qualiData.drivers.filter(d => {
            if (seen.has(d.driver_number)) return false;
            seen.add(d.driver_number);
            return true;
          }).sort((a, b) => a.full_name.localeCompare(b.full_name));
          setPrimaryDrivers(uniqueDrivers);

          // Default to fastest lap driver
          const fastestDriver = qualiData.laps[0]?.driver_number;
          if (fastestDriver != null) setPrimaryDriver(fastestDriver);

          const data = await fetchDriverTelemetry(primary.id, telemetryYear, qualiData, fastestDriver);
          if (!cancelled && data) {
            const { projected, binned } = getCachedProjection(primary.id, telemetryYear, primary.coordinates, data.telemetry);
            setPrimaryTelemetry({ ...data, binned, projected });
          }
        } catch (e) {
          console.warn('Telemetry fetch failed for', primary.id, e);
        }
        if (!cancelled) setPrimaryLoading(false);
      }

      // Secondary
      if (isTelemetryAvailable(secondary.id)) {
        setSecondaryLoading(true);
        try {
          const qualiData = await getQualifyingData(secondary.id, telemetryYear);
          if (cancelled || !qualiData) return;
          secondaryQualiData.current = qualiData;

          const seen = new Set();
          const uniqueDrivers = qualiData.drivers.filter(d => {
            if (seen.has(d.driver_number)) return false;
            seen.add(d.driver_number);
            return true;
          }).sort((a, b) => a.full_name.localeCompare(b.full_name));
          setSecondaryDrivers(uniqueDrivers);

          const fastestDriver = qualiData.laps[0]?.driver_number;
          if (fastestDriver != null) setSecondaryDriver(fastestDriver);

          const data = await fetchDriverTelemetry(secondary.id, telemetryYear, qualiData, fastestDriver);
          if (!cancelled && data) {
            const { projected, binned } = getCachedProjection(secondary.id, telemetryYear, secondary.coordinates, data.telemetry);
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

  // Handle driver selection change
  const handleDriverChange = useCallback(async (side, driverNumber) => {
    const setDriver = side === 'primary' ? setPrimaryDriver : setSecondaryDriver;
    const setData = side === 'primary' ? setPrimaryTelemetry : setSecondaryTelemetry;
    const setLoading = side === 'primary' ? setPrimaryLoading : setSecondaryLoading;
    const qualiDataRef = side === 'primary' ? primaryQualiData : secondaryQualiData;
    const circuit = side === 'primary' ? primary : secondary;
    const coords = side === 'primary' ? primary.coordinates : secondary.coordinates;

    setDriver(driverNumber);
    if (!qualiDataRef.current || !driverNumber) return;

    setLoading(true);
    try {
      const data = await fetchDriverTelemetry(circuit.id, telemetryYear, qualiDataRef.current, driverNumber);
      if (data) {
        const { projected, binned } = getCachedProjection(circuit.id, telemetryYear, coords, data.telemetry);
        setData({ ...data, binned, projected });
      }
    } catch (e) {
      console.warn('Driver telemetry fetch failed', e);
    }
    setLoading(false);
  }, [telemetryYear, primary, secondary]);

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

  const handleShareCard = useCallback(() => {
    const W = 1200, H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, W, H);

    // Header bar
    ctx.fillStyle = '#e10600';
    ctx.fillRect(0, 0, W, 4);

    // Title
    ctx.fillStyle = '#f2f2f2';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('F1 Track Comparison', 32, 40);

    // Subtitle with circuit names
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#8a8a90';
    ctx.fillText(`${primary.name}  vs  ${secondary.name}`, 32, 62);

    // Separator line
    ctx.strokeStyle = '#2c2c31';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, 74); ctx.lineTo(W - 32, 74); ctx.stroke();

    // Draw track canvases side by side
    const cards = document.querySelectorAll('.track3d-canvas-wrap-outer');
    const gap = 20;
    const cardW = (W - 64 - gap) / 2;
    const cardH = 360;
    const cardY = 90;

    cards.forEach((card, i) => {
      const cvs = card?.querySelector('canvas');
      if (!cvs) return;
      const x = 32 + i * (cardW + gap);
      // Draw border
      const borderColor = i === 0 ? '#e10600' : '#00a3ff';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, cardY, cardW, cardH);
      // Draw canvas content scaled
      ctx.drawImage(cvs, x, cardY, cardW, cardH);
    });

    // Stats row at bottom
    const statsY = cardY + cardH + 20;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    const stats = [
      { label: primary.name, color: '#e10600' },
      { label: `${(primaryDetail.lengthMeters / 1000).toFixed(3)} km` },
      { label: `${primaryDetail.corners.length} corners` },
      { label: 'vs', color: '#6a6a70' },
      { label: secondary.name, color: '#00a3ff' },
      { label: `${(secondaryDetail.lengthMeters / 1000).toFixed(3)} km` },
      { label: `${secondaryDetail.corners.length} corners` },
    ];
    let sx = 32;
    stats.forEach(s => {
      ctx.fillStyle = s.color || '#d8d8db';
      ctx.font = s.color ? 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif' : '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(s.label, sx, statsY);
      sx += ctx.measureText(s.label).width + 18;
    });

    // Footer branding
    ctx.fillStyle = '#4a4a50';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('F1 Track Metrics Lab · Unofficial · Track data from bacinger/f1-circuits', 32, H - 16);

    // Download
    const link = document.createElement('a');
    link.download = `f1-compare-${primary.id}-vs-${secondary.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [primary, secondary, primaryDetail, secondaryDetail]);

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

          {viewMode === 'sidebyside' && (
            <>
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
                    onChange={e => {
                      const y = Number(e.target.value);
                      setTelemetryYear(y);
                      // Reset driver selections on year change
                      setPrimaryDriver(null);
                      setSecondaryDriver(null);
                    }}
                  >
                    <option value={2024}>2024</option>
                    <option value={2023}>2023</option>
                  </select>
                )}
              </div>
              <div className="screenshot-controls">
                <button className="anim-btn" onClick={handleShareCard} title="Download branded comparison card for social sharing">🔗 Share Card</button>
                <button className="anim-btn" onClick={() => handleScreenshot('A')} title="Screenshot Track A">📷 A</button>
                <button className="anim-btn" onClick={() => handleScreenshot('B')} title="Screenshot Track B">📷 B</button>
              </div>
            </>
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

        {/* Driver picker — appears below the cards when Race Pace is active */}
        {viewMode === 'sidebyside' && telemetryMode && (primaryDrivers.length > 0 || secondaryDrivers.length > 0) && (
          <div className="driver-picker-row">
            {primaryHasTelemetry && primaryDrivers.length > 0 && (
              <div className="driver-picker-group">
                <label className="driver-picker-label" style={{ color: '#e10600' }}>Track A Driver</label>
                <select
                  className="driver-picker-select"
                  value={primaryDriver ?? ''}
                  onChange={e => handleDriverChange('primary', Number(e.target.value) || null)}
                >
                  {primaryDrivers.map(d => (
                    <option key={d.driver_number} value={d.driver_number}>
                      {d.full_name} {d.team_name ? `(${d.team_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {secondaryHasTelemetry && secondaryDrivers.length > 0 && (
              <div className="driver-picker-group">
                <label className="driver-picker-label" style={{ color: '#00a3ff' }}>Track B Driver</label>
                <select
                  className="driver-picker-select"
                  value={secondaryDriver ?? ''}
                  onChange={e => handleDriverChange('secondary', Number(e.target.value) || null)}
                >
                  {secondaryDrivers.map(d => (
                    <option key={d.driver_number} value={d.driver_number}>
                      {d.full_name} {d.team_name ? `(${d.team_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <p className="compare-note">
          {telemetryMode ? (
            <>Speed-colored ribbon uses real telemetry from OpenF1 ({primaryTelemetry?.lap?.driverName || ('Driver #' + (primaryTelemetry?.lap?.driver ?? '?'))}/{secondaryTelemetry?.lap?.driverName || ('Driver #' + (secondaryTelemetry?.lap?.driver ?? '?'))} qualifying laps). Pick any driver from the dropdown to compare head-to-head.</>
          ) : (
            <>Track shape comes from the same outline data as the map view. Corner count, spin direction and longest straight are computed from that outline (not official telemetry), and the road width / marker heights are stylized for visibility, not to scale.</>
          )}
        </p>
      </div>
    </div>
  );
}
