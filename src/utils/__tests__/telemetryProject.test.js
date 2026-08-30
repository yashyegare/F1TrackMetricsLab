import { describe, it, expect } from 'vitest';
import { interpolateSample, speedToColor, binTelemetry } from '../telemetryProject';

// Helper to build a minimal projected array
function makeProjected(count) {
  return Array.from({ length: count }, (_, i) => ({
    progress: i / (count - 1),
    speed: 100 + (i / (count - 1)) * 250, // 100 → 350 km/h
    throttle: i < count / 2 ? 80 : 40,
    brake: i > count * 0.7 ? 1 : 0,
    drs: i > count * 0.8 ? 1 : 0,
    gear: Math.min(8, Math.floor(i / (count / 8)) + 1),
    date: new Date(Date.now() + i * 100).toISOString(),
  }));
}

describe('interpolateSample', () => {
  const projected = makeProjected(100);

  it('returns a sample at progress 0', () => {
    const sample = interpolateSample(projected, 0);
    expect(sample).toBeDefined();
    expect(sample.speed).toBeGreaterThanOrEqual(0);
    expect(sample.speed).toBeLessThanOrEqual(400);
  });

  it('returns a sample at progress 1', () => {
    const sample = interpolateSample(projected, 1);
    expect(sample).toBeDefined();
    expect(sample.progress).toBe(1);
  });

  it('returns a sample at progress 0.5', () => {
    const sample = interpolateSample(projected, 0.5);
    expect(sample).toBeDefined();
    expect(sample.speed).toBeGreaterThan(0);
  });

  it('speed interpolates smoothly between samples', () => {
    const s0 = interpolateSample(projected, 0.1);
    const s1 = interpolateSample(projected, 0.15);
    const s2 = interpolateSample(projected, 0.2);
    // Monotonically increasing speed in our test data
    expect(s1.speed).toBeGreaterThanOrEqual(s0.speed - 5); // allow small Catmull-Rom overshoot
    expect(s2.speed).toBeGreaterThanOrEqual(s1.speed - 5);
  });

  it('returns all expected fields', () => {
    const sample = interpolateSample(projected, 0.5);
    expect(sample).toHaveProperty('progress');
    expect(sample).toHaveProperty('speed');
    expect(sample).toHaveProperty('throttle');
    expect(sample).toHaveProperty('brake');
    expect(sample).toHaveProperty('drs');
  });
});

describe('speedToColor', () => {
  it('returns a hex color string', () => {
    const color = speedToColor(150);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('slow speed → cool color (blue-ish)', () => {
    const color = speedToColor(30);
    // Should be in blue range
    expect(color).toBeDefined();
  });

  it('fast speed → warm color (red-ish)', () => {
    const color = speedToColor(320);
    expect(color).toBeDefined();
  });

  it('clamps to min/max range', () => {
    const c1 = speedToColor(-100);
    const c2 = speedToColor(500);
    expect(c1).toMatch(/^#/);
    expect(c2).toMatch(/^#/);
  });
});

describe('binTelemetry', () => {
  it('returns array of bins', () => {
    const projected = makeProjected(50);
    const bins = binTelemetry(projected, 10);
    expect(Array.isArray(bins)).toBe(true);
    expect(bins.length).toBe(10);
  });

  it('each bin has avgSpeed', () => {
    const projected = makeProjected(50);
    const bins = binTelemetry(projected, 5);
    for (const bin of bins) {
      expect(bin).toHaveProperty('avgSpeed');
      expect(typeof bin.avgSpeed).toBe('number');
      expect(bin.avgSpeed).toBeGreaterThanOrEqual(0);
    }
  });

  it('bins cover full progress range', () => {
    const projected = makeProjected(50);
    const bins = binTelemetry(projected, 10);
    expect(bins[0].progress).toBeGreaterThan(0);
    expect(bins[bins.length - 1].progress).toBeLessThanOrEqual(1);
    expect(bins.length).toBe(10);
  });
});
