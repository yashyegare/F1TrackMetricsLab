import React, { useMemo, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine, CartesianGrid,
} from 'recharts';
import { calculateTimeDelta, prepareTraceStack } from '../utils/telemetryAnalysis';

const CAR_A_COLOR = '#e10600';
const CAR_B_COLOR = '#00a3ff';
const THROTTLE_COLOR = '#00cc44';
const BRAKE_COLOR = '#ff3333';
const DRS_COLOR = '#00ff88';

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

function ScrubCursor({ data, sharedProgressRef, onScrub }) {
  return null; // Handled via onMouseMove on parent charts
}

/**
 * TelemetryScrubber — synchronized trace stack for head-to-head telemetry comparison.
 *
 * 4 lanes sharing a common distance axis (0→100%):
 * 1. Speed trace (Car A vs Car B)
 * 2. Time delta (who's ahead where)
 * 3. Throttle & brake overlay
 * 4. Gear & DRS states
 *
 * Bidirectional: hovering the chart snaps the 3D CarDot to that position.
 */
export default function TelemetryScrubber({ primaryProjected, secondaryProjected, sharedProgressRef, primaryName, secondaryName }) {
  const resolution = 500;
  const hoverProgressRef = useRef(null);

  const { speedTrace, throttleBrakeTrace, gearTrace, deltaTrace } = useMemo(() => {
    const { speedTrace, throttleBrakeTrace, gearTrace } = prepareTraceStack(
      primaryProjected, secondaryProjected, resolution
    );
    const deltaTrace = calculateTimeDelta(primaryProjected, secondaryProjected, resolution);
    return { speedTrace, throttleBrakeTrace, gearTrace, deltaTrace };
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

  return (
    <div className="telemetry-scrubber">
      {/* Lane 1: Speed Trace */}
      <div className="scrubber-lane">
        <div className="scrubber-lane-header">
          <span className="scrubber-lane-title">Speed</span>
          <span className="scrubber-legend">
            <span style={{ color: CAR_A_COLOR }}>● {primaryName || 'Car A'}</span>
            <span style={{ color: CAR_B_COLOR }}>● {secondaryName || 'Car B'}</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={speedTrace} onMouseMove={handleScrub} onMouseLeave={() => {}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2c2c31" />
            <XAxis dataKey="distance" tick={{ fontSize: 9, fill: '#6a6a70' }} interval={99} />
            <YAxis tick={{ fontSize: 9, fill: '#6a6a70' }} width={35} unit=" km/h" />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="carA" stroke={CAR_A_COLOR} dot={false} strokeWidth={1.5} name="Speed A" />
            <Line type="monotone" dataKey="carB" stroke={CAR_B_COLOR} dot={false} strokeWidth={1.5} name="Speed B" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Lane 2: Time Delta */}
      {deltaTrace.length > 0 && (
        <div className="scrubber-lane">
          <div className="scrubber-lane-header">
            <span className="scrubber-lane-title">Time Delta</span>
            <span className="scrubber-legend">
              ▲ {secondaryName || 'Car B'} ahead · ▼ {primaryName || 'Car A'} ahead
            </span>
          </div>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={deltaTrace} onMouseMove={handleScrub}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2c2c31" />
              <XAxis dataKey="distance" tick={{ fontSize: 9, fill: '#6a6a70' }} interval={99} />
              <YAxis tick={{ fontSize: 9, fill: '#6a6a70' }} width={35} unit="s" domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#4a4a50" strokeWidth={1} />
              <Area
                type="monotone" dataKey="delta" stroke="#f2f2f2"
                fill="url(#deltaGradient)" strokeWidth={1}
                name="Δt (s)"
              />
              <defs>
                <linearGradient id="deltaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CAR_B_COLOR} stopOpacity={0.4} />
                  <stop offset="50%" stopColor="transparent" stopOpacity={0} />
                  <stop offset="100%" stopColor={CAR_A_COLOR} stopOpacity={0.4} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Lane 3: Throttle & Brake */}
      <div className="scrubber-lane">
        <div className="scrubber-lane-header">
          <span className="scrubber-lane-title">Throttle / Brake</span>
          <span className="scrubber-legend">
            <span style={{ color: THROTTLE_COLOR }}>▬ Throttle</span>
            <span style={{ color: BRAKE_COLOR }}>▬ Brake</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={throttleBrakeTrace} onMouseMove={handleScrub}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2c2c31" />
            <XAxis dataKey="distance" tick={{ fontSize: 9, fill: '#6a6a70' }} interval={99} />
            <YAxis tick={{ fontSize: 9, fill: '#6a6a70' }} width={35} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="stepAfter" dataKey="throttleA" stroke={THROTTLE_COLOR} fill={THROTTLE_COLOR} fillOpacity={0.15} dot={false} strokeWidth={1} name="Throttle A" />
            <Area type="stepAfter" dataKey="brakeA" stroke={BRAKE_COLOR} fill={BRAKE_COLOR} fillOpacity={0.2} dot={false} strokeWidth={1} name="Brake A" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Lane 4: Gear & DRS */}
      <div className="scrubber-lane">
        <div className="scrubber-lane-header">
          <span className="scrubber-lane-title">Gear & DRS</span>
          <span className="scrubber-legend">
            <span style={{ color: '#d8d8db' }}>━ Gear</span>
            <span style={{ color: DRS_COLOR }}>▬ DRS</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={50}>
          <LineChart data={gearTrace} onMouseMove={handleScrub}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2c2c31" />
            <XAxis dataKey="distance" tick={{ fontSize: 9, fill: '#6a6a70' }} interval={99} />
            <YAxis tick={{ fontSize: 9, fill: '#6a6a70' }} width={35} domain={[0, 8]} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="stepAfter" dataKey="gearA" stroke="#d8d8db" dot={false} strokeWidth={1.5} name="Gear A" />
            <Line type="stepAfter" dataKey="drsA" stroke={DRS_COLOR} dot={false} strokeWidth={2} name="DRS A" strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
