/**
 * Projects OpenF1 raw telemetry coordinates onto our track's polyline.
 *
 * Strategy:
 * 1. Both our track (lon/lat → local meters) and OpenF1 (x,z) are in meters
 * 2. OpenF1's coordinate system has an arbitrary origin and rotation
 * 3. We try rotations from 0-360° and find the best alignment
 * 4. Then find nearest-point correspondences via arc-length matching
 * 5. Return projected points tagged with real speed/throttle/brake data
 */

import { projectToLocalMeters } from './geometry.js';

// ---- Path utilities ----

function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    len += Math.hypot(dx, dy);
  }
  return len;
}

function cumulativeLengths(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return cum;
}

function rotatePoints(points, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
}

function translateToOrigin(points) {
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return points.map(([x, y]) => [x - cx, y - cy]);
}

function normalizeScale(points) {
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const rangeX = Math.max(...xs) - Math.min(...xs) || 1;
  const rangeY = Math.max(...ys) - Math.min(...ys) || 1;
  const scale = 1 / Math.max(rangeX, rangeY);
  return points.map(([x, y]) => [x * scale, y * scale]);
}

function nearestPointOnPolyline(query, points, cumLengths, totalLen) {
  let bestDist = Infinity;
  let bestT = 0;

  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [qx, qy] = points[i];
    const dx = qx - px;
    const dy = qy - py;
    const lenSq = dx * dx + dy * dy;

    let t;
    if (lenSq < 1e-10) {
      t = 0;
    } else {
      t = Math.max(0, Math.min(1, ((query[0] - px) * dx + (query[1] - py) * dy) / lenSq));
    }

    const projX = px + t * dx;
    const projY = py + t * dy;
    const dist = Math.hypot(query[0] - projX, query[1] - projY);

    if (dist < bestDist) {
      bestDist = dist;
      const segStart = cumLengths[i - 1];
      const segLen = cumLengths[i] - cumLengths[i - 1];
      bestT = (segStart + t * segLen) / totalLen;
    }
  }

  return { t: bestT, distance: bestDist };
}

// ---- Main projection ----

/**
 * Find the best rotation angle that aligns OpenF1 points to our track.
 * Uses a coarse-to-fine search: 360 steps, then refine around the best.
 */
function findBestRotation(trackNorm, openf1Norm, trackCum, trackTotal) {
  function searchAngle(points, startDeg, endDeg, step) {
    let best = { angle: 0, avgDist: Infinity };
    for (let deg = startDeg; deg < endDeg; deg += step) {
      const angle = (deg * Math.PI) / 180;
      const rotated = rotatePoints(points, angle);
      let totalDist = 0;
      let count = 0;
      for (let i = 0; i < rotated.length; i += (step < 1 ? 3 : 5)) {
        const { distance } = nearestPointOnPolyline(rotated[i], trackNorm, trackCum, trackTotal);
        totalDist += distance;
        count++;
      }
      const avgDist = totalDist / count;
      if (avgDist < best.avgDist) {
        best = { angle, avgDist };
      }
    }
    return best;
  }

  // Coarse search on normal orientation
  const normal = searchAngle(openf1Norm, 0, 360, 1);

  // Coarse search on mirrored (y-negated) orientation
  const mirrored = openf1Norm.map(([x, y]) => [x, -y]);
  const mirrorResult = searchAngle(mirrored, 0, 360, 1);

  let bestPoints, coarseAngle, bestAvgDist;
  if (mirrorResult.avgDist < normal.avgDist) {
    bestPoints = mirrored;
    coarseAngle = mirrorResult.angle;
    bestAvgDist = mirrorResult.avgDist;
  } else {
    bestPoints = openf1Norm;
    coarseAngle = normal.angle;
    bestAvgDist = normal.avgDist;
  }

  // Fine search: ±5° around best, step 0.1°
  const fine = searchAngle(bestPoints, (coarseAngle * 180 / Math.PI) - 5, (coarseAngle * 180 / Math.PI) + 5, 0.1);

  return { angle: fine.angle, avgDistance: fine.avgDist, mirrored: mirrorResult.avgDist < normal.avgDist };
}

/**
 * Project OpenF1 telemetry onto our track path.
 *
 * @param {Array} trackCoords - Our circuit coordinates [[lon, lat], ...]
 * @param {Array} openf1Telemetry - [{ x, y, z, speed, throttle, brake, drs, gear }]
 * @returns {{ projected: Array, alignment: { angle, avgDistance } }}
 */
export function projectTelemetry(trackCoords, openf1Telemetry) {
  if (!trackCoords?.length || !openf1Telemetry?.length) return { projected: [], alignment: null };

  // 1. Convert our track to local meters, then normalize
  const trackMeters = projectToLocalMeters(trackCoords);
  const trackNorm = normalizeScale(translateToOrigin(trackMeters));

  // 2. Extract OpenF1 x,y as 2D horizontal ground-plane points (z is elevation)
  const openf1Points = openf1Telemetry.map(d => [d.x, d.y]);
  const openf1Norm = normalizeScale(translateToOrigin(openf1Points));

  // 3. Compute cumulative lengths for track
  const trackCum = cumulativeLengths(trackNorm);
  const trackTotal = trackCum[trackCum.length - 1] || 1;

  // 4. Find best rotation (tests both normal and mirrored orientations)
  const alignment = findBestRotation(trackNorm, openf1Norm, trackCum, trackTotal);
  const bestPoints = alignment.mirrored
    ? openf1Norm.map(([x, y]) => [x, -y])
    : openf1Norm;
  const rotatedOpenf1 = rotatePoints(bestPoints, alignment.angle);

  // 5. For each OpenF1 point, find nearest point on track
  const projected = openf1Telemetry.map((sample, i) => {
    const normPoint = rotatedOpenf1[i];
    const { t, distance } = nearestPointOnPolyline(normPoint, trackNorm, trackCum, trackTotal);

    return {
      progress: t,
      distance,
      speed: sample.speed,
      throttle: sample.throttle,
      brake: sample.brake,
      drs: sample.drs,
      gear: sample.gear,
      raw: { x: sample.x, y: sample.y, z: sample.z },
    };
  });

  const avgDist = projected.reduce((sum, p) => sum + p.distance, 0) / projected.length;
  alignment.avgDistance = avgDist;

  // Warn if alignment is poor (threshold: 15% of track bounding box)
  const trackBbox = Math.max(
    Math.max(...trackNorm.map(p => p[0])) - Math.min(...trackNorm.map(p => p[0])),
    Math.max(...trackNorm.map(p => p[1])) - Math.min(...trackNorm.map(p => p[1]))
  );
  if (avgDist > trackBbox * 0.15) {
    console.warn(
      `OpenF1 telemetry alignment may be poor: avg distance ${avgDist.toFixed(4)} ` +
      `vs track scale ${trackBbox.toFixed(4)} (${((avgDist / trackBbox) * 100).toFixed(1)}%)`
    );
  }

  return { projected, alignment };
}

/**
 * Bin projected telemetry into N evenly-spaced buckets along the track.
 */
export function binTelemetry(projected, numBins = 100) {
  const bins = new Array(numBins).fill(null).map(() => ({
    speeds: [],
    throttles: [],
    brakes: [],
    drs: [],
  }));

  for (const p of projected) {
    const binIdx = Math.min(Math.floor(p.progress * numBins), numBins - 1);
    if (binIdx < 0 || binIdx >= numBins) continue;
    bins[binIdx].speeds.push(p.speed);
    bins[binIdx].throttles.push(p.throttle);
    bins[binIdx].brakes.push(p.brake);
    bins[binIdx].drs.push(p.drs);
  }

  return bins.map((bin, i) => ({
    progress: (i + 0.5) / numBins,
    avgSpeed: bin.speeds.length > 0 ? bin.speeds.reduce((a, b) => a + b, 0) / bin.speeds.length : 0,
    maxSpeed: bin.speeds.length > 0 ? Math.max(...bin.speeds) : 0,
    avgThrottle: bin.throttles.length > 0 ? bin.throttles.reduce((a, b) => a + b, 0) / bin.throttles.length : 0,
    drsActive: bin.drs.some(d => d > 0),
    sampleCount: bin.speeds.length,
  }));
}

/**
 * Map a speed value to a color on a blue → yellow → red gradient.
 */
export function speedToColor(speed, minSpeed = 0, maxSpeed = 350) {
  const t = Math.max(0, Math.min(1, (speed - minSpeed) / (maxSpeed - minSpeed)));

  let r, g, b;
  if (t < 0.5) {
    const s = t * 2;
    r = Math.round(255 * s);
    g = Math.round(255 * s);
    b = Math.round(255 * (1 - s));
  } else {
    const s = (t - 0.5) * 2;
    r = 255;
    g = Math.round(255 * (1 - s));
    b = 0;
  }

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
