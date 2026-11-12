import React, { Suspense, useMemo, useState, useRef, useCallback, useEffect } from 'react';
import Track3D from './Track3D.jsx';
import { getTrackDetail } from '../utils/track3d';
import { isTelemetryAvailable } from '../utils/openf1';
import { useTelemetryForCircuit } from '../hooks/useTelemetryForCircuit';
import { useStore } from '../store';
import RaceDataPanel from './RaceDataPanel';
import DriverInsights from './DriverInsights';
import WeatherChip from './WeatherChip';

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

function StatCard({ circuit, detail, color, unit, sharedCameraRef, instanceId, animSpeed, animPaused, canvasRef, telemetry, telemetryLoading, loadStep, telemetryError, sharedProgressRef }) {
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
          sharedProgressRef={sharedProgressRef}
        />
      </div>
      <p className="track3d-caption">Drag to rotate · Scroll or pinch to zoom · Click an inferred corner to focus. Green sections mark inferred straights, not verified DRS locations.</p>

      <h3 className="track3d-title">{circuit.name}</h3>
      <p className="compare-location">{circuit.location}</p>

      {telemetry && (
        <div className="telemetry-badge">
          <span className="telemetry-badge-dot" />
          Real telemetry — {telemetry.session.name} {telemetry.session.year}
        </div>
      )}
      {telemetryError && !telemetryLoading && (
        <div className="telemetry-badge error">
          <span className="telemetry-badge-dot error" />
          {telemetryError}
        </div>
      )}
      {telemetryLoading && (
        <div className="telemetry-badge loading">
          <span className="telemetry-badge-dot loading" />
          {loadStep || 'Fetching telemetry…'}
        </div>
      )}

      <details className="lab-track-statistics" open={window.innerWidth > 768}><summary>Circuit details</summary>
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
            <span className="label">Archived DRS count</span>
            <span className="value">{circuit.drsZones}</span>
          </div>
        )}
        {circuit.lapRecord && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span className="label">Archived lap record</span>
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
      </details>
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
export default function Compare3DPanel({ primary, secondary, unit = 'metric', initialTelemetry }) {
  const [viewMode, setViewMode] = useState('sidebyside');
  const [animSpeed, setAnimSpeed] = useState(0);
  const [animPaused, setAnimPaused] = useState(false);
  const [telemetryMode, setTelemetryMode] = useState(initialTelemetry?.racePace ?? false);
  const [telemetryYear, setTelemetryYear] = useState(initialTelemetry?.year || 2024);
  const driverMode = useStore(state => state.analysisMode === 'drivers');
  const setAnalysisMode = useStore(state => state.setAnalysisMode);
  const graphicsQuality = useStore(state => state.graphicsQuality);
  const setGraphicsQuality = useStore(state => state.setGraphicsQuality);
  const telemetryEnabled = driverMode || telemetryMode;
  const [primaryChoice,setPrimaryChoice] = useState(initialTelemetry?.driverA ?? null);
  const [secondaryChoice,setSecondaryChoice] = useState(initialTelemetry?.driverB ?? null);
  const [cameraReset,setCameraReset] = useState(0);
  const [rendererError,setRendererError] = useState(false);
  const workspaceRef = useRef(null);
  useEffect(() => {
    const root=workspaceRef.current;
    const lost=event => {event.preventDefault();setRendererError(true);};
    root?.addEventListener('webglcontextlost',lost,true);
    return () => root?.removeEventListener('webglcontextlost',lost,true);
  },[rendererError]);
  const a = useTelemetryForCircuit(primary,telemetryYear,{enabled:telemetryEnabled,driverNumber:primaryChoice});
  const b = useTelemetryForCircuit(secondary,telemetryYear,{enabled:telemetryEnabled,driverNumber:secondaryChoice,rank:driverMode?1:0,excludeDriver:driverMode?a.driver:null});
  const primaryTelemetry=a.telemetry, secondaryTelemetry=b.telemetry;
  const primaryLoading=a.loading, secondaryLoading=b.loading;
  const primaryError=a.error, secondaryError=b.error;
  const primaryDrivers=a.drivers, secondaryDrivers=b.drivers;
  const primaryDriver=a.driver, secondaryDriver=b.driver;
  const primaryLoadStep=a.loadStep, secondaryLoadStep=b.loadStep;
  const primaryQualiData={current:a.qualiData}, secondaryQualiData={current:b.qualiData};
  const primaryStints=a.raceContext.stints, secondaryStints=b.raceContext.stints;
  const primaryPitStops=a.raceContext.pitStops, secondaryPitStops=b.raceContext.pitStops;
  const primaryRaceControl=a.raceContext.raceControl, secondaryRaceControl=b.raceContext.raceControl;
  const primaryWeather=a.raceContext.weather, secondaryWeather=b.raceContext.weather;
  const primaryTotalLaps=a.raceContext.totalLaps, secondaryTotalLaps=b.raceContext.totalLaps;
  const handleDriverChange=(side,driver) => side === 'primary' ? setPrimaryChoice(driver) : setSecondaryChoice(driver);

  // Sync telemetry state to URL for deep linking
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    p.set('circuit',primary.id); p.set('vs',secondary.id); p.set('mode','compare3d'); p.set('analysis',driverMode?'drivers':'tracks');
    if (telemetryEnabled) {
      p.set('racePace', '1');
      p.set('year', String(telemetryYear));
      if (primaryDriver != null) p.set('driverA', String(primaryDriver));
      if (secondaryDriver != null) p.set('driverB', String(secondaryDriver));
    } else {
      p.delete('racePace');
      p.delete('year');
      p.delete('driverA');
      p.delete('driverB');
    }
    const qs = p.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [telemetryEnabled, telemetryYear, primaryDriver, secondaryDriver, driverMode, primary.id, secondary.id]);

  const primaryDetail = useMemo(() => getTrackDetail(primary), [primary]);
  const secondaryDetail = useMemo(() => getTrackDetail(secondary), [secondary]);

  // Shared camera state for sync
  const sharedCameraRef = useRef({ position: null, target: null, _instanceId: null, _targetId: null });
  // Shared animation progress for syncing CarDots in side-by-side
  const sharedProgressRef = useRef({ progress: 0, active: false });
  useEffect(() => {
    Object.assign(sharedProgressRef.current,{elapsed:0,synchronizeTime:driverMode,cycleMs:Math.max(primaryTelemetry?.lap.duration || 0,secondaryTelemetry?.lap.duration || 0)*1000});
  },[driverMode,primaryTelemetry,secondaryTelemetry]);

  // Canvas refs for screenshot
  const primaryCanvasRef = useRef();
  const secondaryCanvasRef = useRef();

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

  if (rendererError) return <section className="loading-3d" role="alert"><h2>3D view interrupted</h2><p>The graphics context was lost. Your selections are preserved.</p><div className="lab-recovery"><button onClick={() => setRendererError(false)}>Retry 3D view</button><button onClick={() => useStore.getState().setMode('map')}>Open map</button><button onClick={() => useStore.getState().setMode('compare')}>Open 2D comparison</button></div></section>;

  return (
    <div className="compare3d-wrapper">
      <div className="compare3d-inner" ref={workspaceRef}>
        <div className="lab-analysis-toggle" aria-label="Analysis mode"><button aria-pressed={!driverMode} onClick={() => setAnalysisMode('tracks')}>Compare tracks</button><button aria-pressed={driverMode} onClick={() => setAnalysisMode('drivers')}>Compare drivers</button></div>
        <p className="lab-analysis-help">{driverMode ? 'Same circuit and qualifying session. Pick two different drivers to examine where time was gained.' : 'Compare track geometry. Cross-track replay is illustrative; it does not measure driver performance.'}</p>
        <div className="compare3d-mode-toggle">
          <button
            className={viewMode === 'sidebyside' ? 'active' : ''}
            aria-pressed={viewMode === 'sidebyside'}
            onClick={() => setViewMode('sidebyside')}
          >
            Side by Side
          </button>
          <button
            className={viewMode === 'overlay' ? 'active' : ''}
            aria-pressed={viewMode === 'overlay'}
            onClick={() => setViewMode('overlay')}
          >
            Overlay
          </button>
        </div>

        <div className="compare3d-toolbar">
          <label className="lab-quality-label">Graphics<select aria-label="3D graphics quality" value={graphicsQuality} onChange={event => setGraphicsQuality(event.target.value)}><option value="auto">Auto</option><option value="low">Low power</option><option value="high">High</option></select></label>
          <button className="anim-btn" onClick={() => { sharedCameraRef.current = { position:null, target:null, _instanceId:null, _targetId:null }; setCameraReset(n => n+1); }}>Reset camera</button>
          <div className="anim-controls">
            <span className="toolbar-label">Playback</span>
            <button className={`anim-btn${animSpeed === 0 ? ' active' : ''}`} onClick={() => { setAnimSpeed(0); setAnimPaused(false); }}>Off</button>
            <button className={`anim-btn${animSpeed === 0.5 ? ' active' : ''}`} onClick={() => { setAnimSpeed(0.5); setAnimPaused(false); }}>0.5×</button>
            <button className={`anim-btn${animSpeed === 1 ? ' active' : ''}`} onClick={() => { setAnimSpeed(1); setAnimPaused(false); }}>1×</button>
            <button className={`anim-btn${animSpeed === 2 ? ' active' : ''}`} onClick={() => { setAnimSpeed(2); setAnimPaused(false); }}>2×</button>
            {animSpeed > 0 && (
              <button className="anim-btn" aria-label={animPaused ? 'Resume lap animation' : 'Pause lap animation'} onClick={() => setAnimPaused(p => !p)}>
                {animPaused ? '▶' : '⏸'}
              </button>
            )}
          </div>

          <div className="toolbar-separator" />

          <div className="anim-controls telemetry-controls">
            <button
              className={`anim-btn${telemetryEnabled ? ' active telemetry-active' : ''}`}
              aria-pressed={telemetryEnabled}
              onClick={() => setTelemetryMode(t => !t)}
              disabled={driverMode || (!telemetryEnabled && !primaryHasTelemetry && !secondaryHasTelemetry)}
              title="Load historical qualifying laps from OpenF1"
            >
              Qualifying telemetry
            </button>
            {(
              <select
                className="telemetry-year-select"
                aria-label="Telemetry session year"
                value={telemetryYear}
                onChange={e => {
                  const y = Number(e.target.value);
                  setTelemetryYear(y);
                  setPrimaryChoice(null);
                  setSecondaryChoice(null);
                }}
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
                <option value={2023}>2023</option>
              </select>
            )}
          </div>

          <div className="toolbar-separator" />

          <details className="lab-export"><summary>Export</summary><div className="screenshot-controls">
            <button className="anim-btn" onClick={handleShareCard} title="Download branded comparison card for social sharing">Comparison card</button>
            <button className="anim-btn" disabled={viewMode !== 'sidebyside'} onClick={() => handleScreenshot('A')} title="Available in Side by Side view">Track A image</button>
            <button className="anim-btn" disabled={viewMode !== 'sidebyside'} onClick={() => handleScreenshot('B')} title="Available in Side by Side view">Track B image</button>
          </div></details>
        </div>

        <div className="lab-session-status" role="status">
          <strong>Qualifying · {telemetryYear} · OpenF1</strong>
          <span>{primary.location}: {primaryHasTelemetry ? 'historical coverage' : 'not covered'} · {secondary.location}: {secondaryHasTelemetry ? 'historical coverage' : 'not covered'}</span>
          <small>Choose a year, then load qualifying telemetry. Some sessions or laps may be unavailable. Driver menus appear after loading; race context is shown separately.</small>
          {telemetryEnabled && (primaryError || secondaryError) && <button className="anim-btn" onClick={() => { a.retry(); b.retry(); }}>Retry telemetry</button>}
        </div>

        {/* Driver pickers + Weather — only in Side-by-Side mode */}
        {viewMode === 'sidebyside' && telemetryEnabled && (
          <>
            <div className="driver-picker-row">
              {primaryHasTelemetry && primaryDrivers.length > 0 ? (
                <div className="driver-picker-group">
                  <label className="driver-picker-label" style={{ color: '#e10600' }}>Track A Driver</label>
                  <select
                    className="driver-picker-select"
                    aria-label="Track A driver"
                    disabled={primaryLoading}
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
              ) : primaryHasTelemetry ? (
                <div className="driver-picker-group">
                  <label className="driver-picker-label" style={{ color: '#e10600' }}>Track A Driver</label>
                  <span className="driver-picker-unavailable">{primaryLoading ? 'Loading drivers…' : 'No drivers available for this session'}</span>
                </div>
              ) : (
                <div className="driver-picker-group">
                  <label className="driver-picker-label" style={{ color: '#666' }}>Track A</label>
                  <span className="driver-picker-unavailable">Telemetry not available</span>
                </div>
              )}
              {secondaryHasTelemetry && secondaryDrivers.length > 0 ? (
                <div className="driver-picker-group">
                  <label className="driver-picker-label" style={{ color: '#00a3ff' }}>Track B Driver</label>
                  <select
                    className="driver-picker-select"
                    aria-label="Track B driver"
                    disabled={secondaryLoading}
                    value={secondaryDriver ?? ''}
                    onChange={e => handleDriverChange('secondary', Number(e.target.value) || null)}
                  >
                    {secondaryDrivers.map(d => (
                      <option key={d.driver_number} value={d.driver_number} disabled={driverMode && d.driver_number === primaryDriver}>
                        {d.full_name} {d.team_name ? `(${d.team_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : secondaryHasTelemetry ? (
                <div className="driver-picker-group">
                  <label className="driver-picker-label" style={{ color: '#00a3ff' }}>Track B Driver</label>
                  <span className="driver-picker-unavailable">{secondaryLoading ? 'Loading drivers…' : 'No drivers available for this session'}</span>
                </div>
              ) : (
                <div className="driver-picker-group">
                  <label className="driver-picker-label" style={{ color: '#666' }}>Track B</label>
                  <span className="driver-picker-unavailable">Telemetry not available</span>
                </div>
              )}
            </div>
            {(primaryWeather || secondaryWeather) && (
              <div className="weather-chips-row">
                {primaryWeather && <WeatherChip weather={primaryWeather} />}
                {secondaryWeather && <WeatherChip weather={secondaryWeather} />}
              </div>
            )}
          </>
        )}

        {viewMode === 'sidebyside' ? (
          <div className="compare3d-panel">
            <StatCard
              key={`A-${cameraReset}`}
              circuit={primary} detail={primaryDetail} color="#e10600" unit={unit}
              sharedCameraRef={sharedCameraRef} instanceId="A"
              animSpeed={animSpeed} animPaused={animPaused}
              canvasRef={primaryCanvasRef}
              telemetry={primaryTelemetry} telemetryLoading={primaryLoading} loadStep={primaryLoadStep} telemetryError={primaryError}
              sharedProgressRef={sharedProgressRef}
            />
            <StatCard
              key={`B-${cameraReset}`}
              circuit={secondary} detail={secondaryDetail} color="#00a3ff" unit={unit}
              sharedCameraRef={sharedCameraRef} instanceId="B"
              animSpeed={animSpeed} animPaused={animPaused}
              canvasRef={secondaryCanvasRef}
              telemetry={secondaryTelemetry} telemetryLoading={secondaryLoading} loadStep={secondaryLoadStep} telemetryError={secondaryError}
              sharedProgressRef={sharedProgressRef}
            />
          </div>
        ) : (
          <Suspense fallback={<div className="loading-3d">Loading overlay…</div>}>
            <Overlay3DPanel
              key={cameraReset}
              primary={primary}
              secondary={secondary}
              primaryDetail={primaryDetail}
              secondaryDetail={secondaryDetail}
              animSpeed={animSpeed}
              animPaused={animPaused}
              primaryTelemetry={primaryTelemetry?.projected}
              secondaryTelemetry={secondaryTelemetry?.projected}
              primaryWeather={primaryWeather}
              secondaryWeather={secondaryWeather}
              primaryLap={primaryTelemetry?.lap}
              secondaryLap={secondaryTelemetry?.lap}
              comparable={driverMode}
              primaryAllLaps={primaryQualiData.current?.laps?.filter(l => l.driver_number === primaryDriver)}
              secondaryAllLaps={secondaryQualiData.current?.laps?.filter(l => l.driver_number === secondaryDriver)}
            />
          </Suspense>
        )}

        {driverMode && <DriverInsights primary={primaryTelemetry} secondary={secondaryTelemetry} sharedProgressRef={sharedProgressRef} />}

        {/* Speed legend — immediately below 3D viewports */}
        {viewMode === 'sidebyside' && telemetryEnabled && (
          <div className="speed-legend-bar-wrap">
            <div className="speed-legend-inner">
              <span className="speed-legend-label">Ribbon Speed</span>
              <div className="speed-legend-track">
                <div className="speed-legend-bar" />
                <div className="speed-legend-ticks">
                  <span>80</span>
                  <span>160</span>
                  <span>240</span>
                  <span>320 km/h</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Race Data — collapsible banner wrapping tire/race-control/sectors */}
        {viewMode === 'sidebyside' && telemetryEnabled && (
          <RaceDataPanel comparable={driverMode}
            primaryTelemetry={primaryTelemetry}
            secondaryTelemetry={secondaryTelemetry}
            primaryStints={primaryStints}
            secondaryStints={secondaryStints}
            primaryPitStops={primaryPitStops}
            secondaryPitStops={secondaryPitStops}
            primaryTotalLaps={primaryTotalLaps}
            secondaryTotalLaps={secondaryTotalLaps}
            primaryRaceControl={primaryRaceControl}
            secondaryRaceControl={secondaryRaceControl}
            primaryQualiData={primaryQualiData}
            secondaryQualiData={secondaryQualiData}
          />
        )}

        {viewMode === 'sidebyside' && (
          <p className="compare-note">
            {telemetryEnabled ? (
              <>Speed-colored ribbon uses real telemetry from OpenF1 ({primaryTelemetry?.lap?.driverName || ('Driver #' + (primaryTelemetry?.lap?.driver ?? '?'))}/{secondaryTelemetry?.lap?.driverName || ('Driver #' + (secondaryTelemetry?.lap?.driver ?? '?'))} qualifying laps). Pick any driver from the dropdown to compare head-to-head.</>
            ) : (
              <>Track shape comes from the same outline data as the map view. Corner count, spin direction and longest straight are computed from that outline (not official telemetry), and the road width / marker heights are stylized for visibility, not to scale.</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
