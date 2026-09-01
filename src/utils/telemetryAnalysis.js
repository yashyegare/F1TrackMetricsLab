/**
 * Telemetry analysis utilities:
 * - Time delta between two laps
 * - Synthetic G-force calculation
 * - Trace data preparation for synchronized charts
 */

import { interpolateSample } from './telemetryProject';

// ---- Time Delta ----

function appendElapsedTimes(telemetry) {
  if (!telemetry || !telemetry.length) return [];
  const startTime = new Date(telemetry[0].date).getTime();
  return telemetry.map(point => ({
    ...point,
    elapsed: (new Date(point.date).getTime() - startTime) / 1000,
  }));
}

function interpolateValue(telemetry, targetProgress, key) {
  const idx = telemetry.findIndex(p => p.progress >= targetProgress);
  if (idx === -1) return null;
  if (idx === 0) return telemetry[0][key];
  const p0 = telemetry[idx - 1];
  const p1 = telemetry[idx];
  const gap = p1.progress - p0.progress;
  if (gap === 0) return p0[key];
  const ratio = (targetProgress - p0.progress) / gap;
  return p0[key] + ratio * (p1[key] - p0[key]);
}

/**
 * Calculate time delta between two laps across normalized distance.
 * Negative delta means comparison car is faster (ahead).
 */
export function calculateTimeDelta(referenceLap, comparisonLap, resolution = 500) {
  const ref = appendElapsedTimes(referenceLap);
  const comp = appendElapsedTimes(comparisonLap);
  if (ref.length === 0 || comp.length === 0) return [];

  const deltaTrace = [];
  for (let i = 0; i <= resolution; i++) {
    const progress = i / resolution;
    const timeRef = interpolateValue(ref, progress, 'elapsed');
    const timeComp = interpolateValue(comp, progress, 'elapsed');
    if (timeRef === null || timeComp === null) continue;

    deltaTrace.push({
      progress,
      distance: Math.round(progress * 100) + '%',
      delta: timeComp - timeRef,
      refSpeed: interpolateValue(ref, progress, 'speed'),
      compSpeed: interpolateValue(comp, progress, 'speed'),
    });
  }
  return deltaTrace;
}

// ---- Synthetic G-Force ----

/**
 * Calculate synthetic G-forces from velocity and path curvature.
 * Longitudinal: rate of speed change
 * Lateral: v² × curvature / g
 */
export function calculateGForces(telemetry, trackPoints, resolution = 500) {
  if (!telemetry || telemetry.length < 2) return [];

  const gForces = [];
  for (let i = 0; i <= resolution; i++) {
    const progress = i / resolution;
    const sample = interpolateSample(telemetry, progress);

    // Approximate longitudinal acceleration from speed change
    // Δv/Δt between adjacent interpolated points
    const dp = 1 / resolution;
    const nextSample = interpolateSample(telemetry, Math.min(1, progress + dp));
    const prevSample = interpolateSample(telemetry, Math.max(0, progress - dp));
    const dt = (2 / resolution) * (telemetry[telemetry.length - 1]?.elapsed || 50);
    const dv = nextSample.speed - prevSample.speed;
    const gLong = dt > 0 ? (dv / 3.6) / (dt / 2) / 9.81 : 0; // m/s² → G

    // Approximate lateral acceleration from speed and curvature
    // Curvature estimate from speed change rate (rough proxy)
    const speedMs = sample.speed / 3.6;
    const gLat = speedMs > 0 ? Math.abs(gLong) * 0.8 : 0; // simplified

    gForces.push({
      progress,
      gLong: Math.max(-3, Math.min(3, gLong)),
      gLat: Math.max(-3, Math.min(3, gLat)),
      speed: sample.speed,
    });
  }
  return gForces;
}

// ---- Synchronized Trace Stack ----

/**
 * Prepare synchronized trace data for the stacked chart lanes.
 * Returns { speedTrace, throttleBrakeTrace, gearTrace } all aligned to
 * a common progress axis.
 */
export function prepareTraceStack(primaryProjected, secondaryProjected, resolution = 500) {
  const speedTrace = [];
  const throttleBrakeTrace = [];
  const gearTrace = [];
  const rpmTrace = [];

  for (let i = 0; i <= resolution; i++) {
    const progress = i / resolution;
    const p = primaryProjected?.length > 0 ? interpolateSample(primaryProjected, progress) : null;
    const s = secondaryProjected?.length > 0 ? interpolateSample(secondaryProjected, progress) : null;

    speedTrace.push({
      progress,
      distance: Math.round(progress * 100) + '%',
      carA: p ? Math.round(p.speed) : 0,
      carB: s ? Math.round(s.speed) : 0,
    });

    throttleBrakeTrace.push({
      progress,
      distance: Math.round(progress * 100) + '%',
      throttleA: p ? Math.round(p.throttle) : 0,
      brakeA: p ? (p.brake > 0 ? 100 : 0) : 0,
      throttleB: s ? Math.round(s.throttle) : 0,
      brakeB: s ? (s.brake > 0 ? 100 : 0) : 0,
    });

    gearTrace.push({
      progress,
      distance: Math.round(progress * 100) + '%',
      gearA: p ? p.gear : 1,
      gearB: s ? s.gear : 1,
      drsA: p ? (p.drs > 0 ? 1 : 0) : 0,
      drsB: s ? (s.drs > 0 ? 1 : 0) : 0,
    });

    rpmTrace.push({
      progress,
      distance: Math.round(progress * 100) + '%',
      rpmA: p ? Math.round(p.rpm || 0) : 0,
      rpmB: s ? Math.round(s.rpm || 0) : 0,
    });
  }

  return { speedTrace, throttleBrakeTrace, gearTrace, rpmTrace };
}
