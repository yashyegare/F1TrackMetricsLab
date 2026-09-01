import React, { useMemo, useCallback, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine, CartesianGrid,
} from 'recharts';
import { calculateTimeDelta, prepareTraceStack } from '../utils/telemetryAnalysis';

const CAR_A_COLOR = '#e10600';
const CAR_B_COLOR = '#00a3ff';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="scrubber-tooltip">
      {payload.map((entry, i) => (
        <div key={i} style={{ color: entry.color || '#d8d8db' }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
        </div>
      ))}
    </div>
  );
}

/**
 * TelemetryScrubber — synchronized trace stack for head-to-head telemetry comparison.
 *
 * Lanes sharing a common distance axis (0→100%):
 * 1. Speed trace (Car A vs Car B)
 * 2. Time delta (who's ahead where)
 * 3. Throttle & brake overlay (both cars)
 * 4. Gear & DRS states (both cars)
 * 5. RPM (both cars)
 *
 * Collapsible: hidden by default, shown when expanded.
 * Bidirectional: hovering the chart snaps the 3D CarDot to that position.
 */
export default function TelemetryScrubber({ primaryProjected, secondaryProjected, sharedProgressRef, primaryName, secondaryName }) {
  const [expanded, setExpanded] = useState(false);
  const resolution = 500;
  const hoverProgressRef = useRef(null);

  const nameA = primaryName || 'Car A';
  const nameB = secondaryName || 'Car B';

  const { speedTrace, throttleBrakeTrace, gearTrace, rpmTrace, deltaTrace } = useMemo(() => {
    const { speedTrace, throttleBrakeTrace, gearTrace, rpmTrace } = prepareTraceStack(
      primaryProjected, secondaryProjected, resolution
    );
    const deltaTrace = calculateTimeDelta(primaryProjected, secondaryProjected, resolution);
    return { speedTrace, throttleBrakeTrace, gearTrace, rpmTrace, deltaTrace };
  }, [primaryProjected, secondaryProjected]);

  // Bidirectional scrub: chart hover → 3D CarDot
  const handleScrub = useCallback((e) => {
    if (!e || !e.activePayload || !sharedProgressRef) return;
    const progress = e.activePayload[0]?.payload?.progress;
    if (progress != null) {
      sharedProgressRef.current.progress = progress;
      sharedProgressRef.current.active = true;
      hoverProgressRef.current = progress;
    }
  }, [sharedProgressRef]);

  if (!primaryProjected?.length && !secondaryProjected?.length) return null;

  const tickStyle = { fontSize: 9, fill: '#6a6a70' };

  return (
    <div className="telemetry-scrubber">
      <button
        className="scrubber-toggle"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? '▾ Hide Telemetry Traces' : '▸ Show Telemetry Traces'}
        <span className="scrubber-toggle-hint">speed · delta · throttle · gears · RPM</span>
      </button>

      {expanded && (
        <>
          {/* Lane 1: Speed Trace — both drivers */}
          <div className="scrubber-lane">
            <div className="scrubber-lane-header">
              <span className="scrubber-lane-title">Speed</span>
              <span className="scrubber-legend">
                <span style={{ color: CAR_A_COLOR }}>● {nameA}</span>
                <span style={{ color: CAR_B_COLOR }}>● {nameB}</span>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={speedTrace} onMouseMove={handleScrub} onMouseLeave={() => {}} syncId="telemetrySync">
                <CartesianGrid strokeDasharray="3 3" stroke="#2c2c31" />
                <XAxis dataKey="distance" tick={tickStyle} interval={99} />
                <YAxis tick={tickStyle} width={40} unit=" km/h" />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="carA" stroke={CAR_A_COLOR} dot={false} strokeWidth={1.5} name={nameA} />
                <Line type="monotone" dataKey="carB" stroke={CAR_B_COLOR} dot={false} strokeWidth={1.5} name={nameB} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Lane 2: Time Delta */}
          {deltaTrace.length > 0 && (
            <div className="scrubber-lane">
              <div className="scrubber-lane-header">
                <span className="scrubber-lane-title">Time Delta</span>
                <span className="scrubber-legend">
                  ▲ {nameA} ahead · ▼ {nameB} ahead
                </span>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={deltaTrace} onMouseMove={handleScrub} syncId="telemetrySync">
                  <CartesianGrid strokeDasharray="3 3" stroke="#2c2c31" />
                  <XAxis dataKey="distance" tick={tickStyle} interval={99} />
                  <YAxis tick={tickStyle} width={40} unit="s" domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#4a4a50" strokeWidth={1} />
                  <Area
                    type="monotone" dataKey="delta" stroke="#f2f2f2"
                    fill="url(#deltaGradient)" strokeWidth={1}
                    name="Δt (s)"
                  />
                  <defs>
                    <linearGradient id="deltaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CAR_A_COLOR} stopOpacity={0.4} />
                      <stop offset="50%" stopColor="transparent" stopOpacity={0} />
                      <stop offset="100%" stopColor={CAR_B_COLOR} stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Lane 3: Throttle & Brake — both drivers */}
          <div className="scrubber-lane">
            <div className="scrubber-lane-header">
              <span className="scrubber-lane-title">Throttle / Brake</span>
              <span className="scrubber-legend">
                <span style={{ color: CAR_A_COLOR }}>● {nameA}</span>
                <span style={{ color: CAR_B_COLOR }}>● {nameB}</span>
                <span style={{ color: '#00cc44', marginLeft: 4 }}>▬ throttle</span>
                <span style={{ color: '#ff3333' }}>▬ brake</span>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={throttleBrakeTrace} onMouseMove={handleScrub} syncId="telemetrySync">
                <CartesianGrid strokeDasharray="3 3" stroke="#2c2c31" />
                <XAxis dataKey="distance" tick={tickStyle} interval={99} />
                <YAxis tick={tickStyle} width={40} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="stepAfter" dataKey="throttleA" stroke={CAR_A_COLOR} fill={CAR_A_COLOR} fillOpacity={0.1} dot={false} strokeWidth={1} name={`Throttle ${nameA}`} />
                <Area type="stepAfter" dataKey="brakeA" stroke={CAR_A_COLOR} fill={CAR_A_COLOR} fillOpacity={0.25} dot={false} strokeWidth={1} strokeDasharray="4 2" name={`Brake ${nameA}`} />
                <Area type="stepAfter" dataKey="throttleB" stroke={CAR_B_COLOR} fill={CAR_B_COLOR} fillOpacity={0.1} dot={false} strokeWidth={1} name={`Throttle ${nameB}`} />
                <Area type="stepAfter" dataKey="brakeB" stroke={CAR_B_COLOR} fill={CAR_B_COLOR} fillOpacity={0.25} dot={false} strokeWidth={1} strokeDasharray="4 2" name={`Brake ${nameB}`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Lane 4: Gear & DRS — both drivers */}
          <div className="scrubber-lane">
            <div className="scrubber-lane-header">
              <span className="scrubber-lane-title">Gear & DRS</span>
              <span className="scrubber-legend">
                <span style={{ color: CAR_A_COLOR }}>● {nameA}</span>
                <span style={{ color: CAR_B_COLOR }}>● {nameB}</span>
                <span style={{ color: '#00ff88', marginLeft: 4 }}>▬ DRS</span>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={gearTrace} onMouseMove={handleScrub} syncId="telemetrySync">
                <CartesianGrid strokeDasharray="3 3" stroke="#2c2c31" />
                <XAxis dataKey="distance" tick={tickStyle} interval={99} />
                <YAxis tick={tickStyle} width={40} domain={[0, 8]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="stepAfter" dataKey="gearA" stroke={CAR_A_COLOR} dot={false} strokeWidth={1.5} name={`Gear ${nameA}`} />
                <Line type="stepAfter" dataKey="drsA" stroke="#00ff88" dot={false} strokeWidth={2} name={`DRS ${nameA}`} strokeDasharray="4 2" />
                <Line type="stepAfter" dataKey="gearB" stroke={CAR_B_COLOR} dot={false} strokeWidth={1.5} name={`Gear ${nameB}`} />
                <Line type="stepAfter" dataKey="drsB" stroke="#00ff88" dot={false} strokeWidth={2} name={`DRS ${nameB}`} strokeDasharray="8 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Lane 5: RPM — both drivers */}
          <div className="scrubber-lane">
            <div className="scrubber-lane-header">
              <span className="scrubber-lane-title">RPM</span>
              <span className="scrubber-legend">
                <span style={{ color: CAR_A_COLOR }}>● {nameA}</span>
                <span style={{ color: CAR_B_COLOR }}>● {nameB}</span>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={rpmTrace} onMouseMove={handleScrub} syncId="telemetrySync">
                <CartesianGrid strokeDasharray="3 3" stroke="#2c2c31" />
                <XAxis dataKey="distance" tick={tickStyle} interval={99} />
                <YAxis tick={tickStyle} width={40} domain={[0, 15000]} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="rpmA" stroke={CAR_A_COLOR} dot={false} strokeWidth={1.5} name={`RPM ${nameA}`} />
                <Line type="monotone" dataKey="rpmB" stroke={CAR_B_COLOR} dot={false} strokeWidth={1.5} name={`RPM ${nameB}`} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
