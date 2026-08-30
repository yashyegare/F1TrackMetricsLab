import { describe, it, expect } from 'vitest';
import {
  distanceMeters,
  buildCumulativeDistances,
  interpolateAlongPath,
  projectToLocalMeters,
  boundingSize,
} from '../geometry';

describe('distanceMeters', () => {
  it('returns 0 for identical points', () => {
    expect(distanceMeters([40.0, -75.0], [40.0, -75.0])).toBe(0);
  });

  it('computes known distance (1 degree lat ≈ 111 km)', () => {
    const d = distanceMeters([40.0, -75.0], [41.0, -75.0]);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('is symmetric', () => {
    const a = distanceMeters([40.0, -75.0], [41.0, -74.0]);
    const b = distanceMeters([41.0, -74.0], [40.0, -75.0]);
    expect(a).toBeCloseTo(b, 6);
  });

  it('computes nonzero distance for diagonal move', () => {
    const d = distanceMeters([0, 0], [1, 1]);
    expect(d).toBeGreaterThan(100_000);
  });
});

describe('buildCumulativeDistances', () => {
  it('starts at 0', () => {
    const { cumulative } = buildCumulativeDistances([[0, 0], [1, 0], [2, 0]]);
    expect(cumulative[0]).toBe(0);
  });

  it('monotonically increases', () => {
    const { cumulative } = buildCumulativeDistances([[0, 0], [0, 0.01], [0, 0.02]]);
    for (let i = 1; i < cumulative.length; i++) {
      expect(cumulative[i]).toBeGreaterThan(cumulative[i - 1]);
    }
  });

  it('total equals last cumulative value', () => {
    const pts = [[0, 0], [0, 0.01], [0, 0.02]];
    const { cumulative, total } = buildCumulativeDistances(pts);
    expect(total).toBeCloseTo(cumulative[cumulative.length - 1], 6);
  });

  it('single point → total 0', () => {
    const { cumulative, total } = buildCumulativeDistances([[0, 0]]);
    expect(cumulative).toEqual([0]);
    expect(total).toBe(0);
  });
});

describe('interpolateAlongPath', () => {
  const positions = [[0, 0], [0, 0.01], [0, 0.02]];
  const { cumulative, total } = buildCumulativeDistances(positions);

  it('ratio 0 returns first point', () => {
    const { position } = interpolateAlongPath(positions, cumulative, total, 0);
    expect(position[0]).toBeCloseTo(0, 4);
    expect(position[1]).toBeCloseTo(0, 4);
  });

  it('ratio 1 returns last point', () => {
    const { position } = interpolateAlongPath(positions, cumulative, total, 1);
    expect(position[0]).toBeCloseTo(0, 4);
    expect(position[1]).toBeCloseTo(0.02, 4);
  });

  it('ratio 0.5 returns midpoint', () => {
    const { position } = interpolateAlongPath(positions, cumulative, total, 0.5);
    expect(position[0]).toBeCloseTo(0, 4);
    expect(position[1]).toBeCloseTo(0.01, 4);
  });

  it('returns heading in degrees', () => {
    const { heading } = interpolateAlongPath(positions, cumulative, total, 0.5);
    expect(typeof heading).toBe('number');
    expect(heading).not.toBeNaN();
  });
});

describe('projectToLocalMeters', () => {
  it('returns array of same length', () => {
    const coords = [[-75.0, 40.0], [-75.01, 40.01], [-75.02, 40.02]];
    const result = projectToLocalMeters(coords);
    expect(result).toHaveLength(3);
  });

  it('each point is [x, y] number pair', () => {
    const coords = [[-75.0, 40.0], [-75.01, 40.01]];
    const result = projectToLocalMeters(coords);
    for (const [x, y] of result) {
      expect(typeof x).toBe('number');
      expect(typeof y).toBe('number');
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it('centroid approximately at origin', () => {
    const coords = [[-75.0, 40.0], [-75.01, 40.01], [-75.02, 40.02]];
    const result = projectToLocalMeters(coords);
    const avgX = result.reduce((s, p) => s + p[0], 0) / result.length;
    const avgY = result.reduce((s, p) => s + p[1], 0) / result.length;
    expect(Math.abs(avgX)).toBeLessThan(100); // close to 0
    expect(Math.abs(avgY)).toBeLessThan(100);
  });
});

describe('boundingSize', () => {
  it('returns width and height', () => {
    const pts = [[0, 0], [100, 0], [100, 50], [0, 50]];
    const { width, height } = boundingSize(pts);
    expect(width).toBeCloseTo(100, 0);
    expect(height).toBeCloseTo(50, 0);
  });

  it('single point → 0 dimensions', () => {
    const { width, height } = boundingSize([[5, 5]]);
    expect(width).toBe(0);
    expect(height).toBe(0);
  });
});
