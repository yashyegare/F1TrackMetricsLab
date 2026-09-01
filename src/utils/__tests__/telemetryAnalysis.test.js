import { describe, it, expect } from 'vitest';
import { calculateTimeDelta, calculateGForces, prepareTraceStack } from '../telemetryAnalysis';

// Helper to build a minimal projected array with date timestamps
function makeProjected(count, baseTime = 1000, lapDuration = 90) {
  return Array.from({ length: count }, (_, i) => {
    const progress = i / (count - 1);
    const elapsed = progress * lapDuration;
    return {
      progress,
      speed: 100 + Math.sin(progress * Math.PI * 2) * 100, // oscillating 0–200
      throttle: progress < 0.5 ? 80 : 30,
      brake: progress > 0.7 ? 1 : 0,
      drs: progress > 0.8 ? 1 : 0,
      gear: Math.min(8, Math.floor(progress * 7) + 1),
      date: new Date(baseTime + elapsed * 1000).toISOString(),
    };
  });
}

describe('calculateTimeDelta', () => {
  it('returns array of delta points', () => {
    const ref = makeProjected(50, 0, 90);
    const comp = makeProjected(50, 2000, 88); // 2 seconds faster
    const delta = calculateTimeDelta(ref, comp, 100);
    expect(Array.isArray(delta)).toBe(true);
    expect(delta.length).toBeGreaterThan(0);
  });

  it('each point has progress and delta fields', () => {
    const ref = makeProjected(50);
    const comp = makeProjected(50);
    const delta = calculateTimeDelta(ref, comp, 10);
    for (const d of delta) {
      expect(d).toHaveProperty('progress');
      expect(d).toHaveProperty('delta');
      expect(typeof d.progress).toBe('number');
      expect(typeof d.delta).toBe('number');
    }
  });

  it('faster comparison car → negative delta at same progress', () => {
    // Car A: 90s lap, Car B: 85s lap (B is faster)
    const ref = makeProjected(100, 0, 90);
    const comp = makeProjected(100, 0, 85);
    const delta = calculateTimeDelta(ref, comp, 50);
    // At any given progress, B should have taken less time → delta < 0
    const midPoint = delta.find(d => Math.abs(d.progress - 0.5) < 0.02);
    expect(midPoint).toBeDefined();
    expect(midPoint.delta).toBeLessThan(0);
  });

  it('identical laps → delta near 0', () => {
    const ref = makeProjected(50, 0, 90);
    const comp = makeProjected(50, 0, 90);
    const delta = calculateTimeDelta(ref, comp, 50);
    for (const d of delta) {
      expect(Math.abs(d.delta)).toBeLessThan(0.5); // near zero
    }
  });
});

describe('calculateGForces', () => {
  it('returns array with gLong and gLat', () => {
    const telemetry = makeProjected(50);
    const trackPoints = Array.from({ length: 50 }, (_, i) => [
      Math.cos(i * 0.1) * 1000,
      Math.sin(i * 0.1) * 1000,
    ]);
    const gForces = calculateGForces(telemetry, trackPoints, 20);
    expect(Array.isArray(gForces)).toBe(true);
    for (const g of gForces) {
      expect(g).toHaveProperty('gLong');
      expect(g).toHaveProperty('gLat');
      expect(typeof g.gLong).toBe('number');
      expect(typeof g.gLat).toBe('number');
      expect(Number.isFinite(g.gLong)).toBe(true);
      expect(Number.isFinite(g.gLat)).toBe(true);
    }
  });

  it('g-forces are within reasonable bounds', () => {
    const telemetry = makeProjected(50);
    const trackPoints = Array.from({ length: 50 }, (_, i) => [i * 10, 0]);
    const gForces = calculateGForces(telemetry, trackPoints, 20);
    for (const g of gForces) {
      expect(Math.abs(g.gLong)).toBeLessThan(10); // F1 cars max ~6g
      expect(Math.abs(g.gLat)).toBeLessThan(10);
    }
  });
});

describe('prepareTraceStack', () => {
  it('returns speedTrace, throttleBrakeTrace, gearTrace, rpmTrace', () => {
    const primary = makeProjected(50);
    const secondary = makeProjected(50, 1000, 88);
    const { speedTrace, throttleBrakeTrace, gearTrace, rpmTrace } = prepareTraceStack(primary, secondary, 20);
    expect(Array.isArray(speedTrace)).toBe(true);
    expect(Array.isArray(throttleBrakeTrace)).toBe(true);
    expect(Array.isArray(gearTrace)).toBe(true);
    expect(Array.isArray(rpmTrace)).toBe(true);
  });

  it('rpmTrace has rpmA and rpmB fields', () => {
    const primary = makeProjected(50);
    const secondary = makeProjected(50);
    const { rpmTrace } = prepareTraceStack(primary, secondary, 10);
    for (const r of rpmTrace) {
      expect(r).toHaveProperty('rpmA');
      expect(r).toHaveProperty('rpmB');
      expect(typeof r.rpmA).toBe('number');
      expect(typeof r.rpmB).toBe('number');
    }
  });

  it('speedTrace has carA and carB fields', () => {
    const primary = makeProjected(50);
    const secondary = makeProjected(50);
    const { speedTrace } = prepareTraceStack(primary, secondary, 10);
    for (const s of speedTrace) {
      expect(s).toHaveProperty('carA');
      expect(s).toHaveProperty('carB');
      expect(typeof s.carA).toBe('number');
      expect(typeof s.carB).toBe('number');
    }
  });

  it('throttleBrakeTrace has A and B series', () => {
    const primary = makeProjected(50);
    const secondary = makeProjected(50);
    const { throttleBrakeTrace } = prepareTraceStack(primary, secondary, 10);
    for (const t of throttleBrakeTrace) {
      expect(t).toHaveProperty('throttleA');
      expect(t).toHaveProperty('throttleB');
      expect(t).toHaveProperty('brakeA');
      expect(t).toHaveProperty('brakeB');
    }
  });

  it('gearTrace has A and B series', () => {
    const primary = makeProjected(50);
    const secondary = makeProjected(50);
    const { gearTrace } = prepareTraceStack(primary, secondary, 10);
    for (const g of gearTrace) {
      expect(g).toHaveProperty('gearA');
      expect(g).toHaveProperty('gearB');
      expect(g).toHaveProperty('drsA');
      expect(g).toHaveProperty('drsB');
    }
  });

  it('handles null/empty inputs gracefully', () => {
    const { speedTrace, throttleBrakeTrace, gearTrace, rpmTrace } = prepareTraceStack(null, null, 10);
    // Returns zero-filled traces (not empty) — carA/carB both 0
    expect(speedTrace.length).toBe(11);
    expect(speedTrace.every(s => s.carA === 0 && s.carB === 0)).toBe(true);
    expect(throttleBrakeTrace.every(t => t.throttleA === 0 && t.brakeA === 0)).toBe(true);
    expect(gearTrace.every(g => g.gearA === 1 && g.gearB === 1)).toBe(true);
    expect(rpmTrace.every(r => r.rpmA === 0 && r.rpmB === 0)).toBe(true);
  });
});
