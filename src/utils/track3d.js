// Helpers that turn a circuit's raw [lon, lat] coordinate loop into
// something a 3D scene (and a stats panel) can use: centered local
// coordinates, a rough "how many corners" count, a spin direction, and
// the longest straight-ish run of track.
//
// None of this is timing/engineering data (the source GeoJSON only gives
// us the outline) — it's a stylized read of the track shape, good enough
// to make the 3D comparison feel informative rather than exact telemetry.

import { projectToLocalMeters } from './geometry';

// Converts a circuit into a closed loop of [x, z] points (meters),
// centered on its own centroid, ready to drop into a three.js scene
// on the X/Z plane (Y stays "up").
export function toSceneCoords(circuit) {
  const raw = projectToLocalMeters(circuit.coordinates); // [x(east), y(north)] meters
  // The source data closes the loop by repeating the first coordinate -
  // drop that duplicate, we treat the array as a closed loop by index math.
  const deduped =
    raw.length > 1 &&
    Math.abs(raw[0][0] - raw[raw.length - 1][0]) < 0.5 &&
    Math.abs(raw[0][1] - raw[raw.length - 1][1]) < 0.5
      ? raw.slice(0, -1)
      : raw;

  const pts = deduped.map(([x, y]) => [x, -y]); // z = -north, keeps a consistent scene orientation

  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;

  return pts.map(([x, z]) => [x - cx, z - cz]);
}

function angleBetweenDeg(v1, v2) {
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const det = v1[0] * v2[1] - v1[1] * v2[0];
  return (Math.atan2(det, dot) * 180) / Math.PI; // signed, -180..180
}

// Per-point signed turn angle (degrees) between the incoming and outgoing
// segment, treating the point array as a closed loop.
export function computeTurnAngles(points) {
  const n = points.length;
  const angles = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const v1 = [cur[0] - prev[0], cur[1] - prev[1]];
    const v2 = [next[0] - cur[0], next[1] - cur[1]];
    const len1 = Math.hypot(v1[0], v1[1]);
    const len2 = Math.hypot(v2[0], v2[1]);
    if (len1 < 1e-6 || len2 < 1e-6) continue;
    angles[i] = angleBetweenDeg(v1, v2);
  }
  return angles;
}

// Cumulative arc length around the closed loop, cumulative[i] = distance
// from point 0 to point i, plus the total loop length.
function buildLoopCumulative(points) {
  const n = points.length;
  const cumulative = [0];
  let total = 0;
  for (let i = 1; i < n; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    cumulative.push(total);
  }
  total += Math.hypot(points[0][0] - points[n - 1][0], points[0][1] - points[n - 1][1]);
  return { cumulative, total };
}

function loopDistance(cumulative, total, i, j) {
  const d = Math.abs(cumulative[i] - cumulative[j]);
  return Math.min(d, total - d);
}

// Finds turn "apexes" - local clusters of sharp direction change - and
// thins them out so two vertices from the same real corner don't both
// get counted. Approximate by design; treat the count as illustrative.
export function detectCorners(points, opts = {}) {
  const { angleThresholdDeg = 15, minGapMeters = 110, maxCorners = 28 } = opts;
  const n = points.length;
  const angles = computeTurnAngles(points);
  const { cumulative, total } = buildLoopCumulative(points);

  const candidates = [];
  for (let i = 0; i < n; i++) {
    if (Math.abs(angles[i]) >= angleThresholdDeg) {
      candidates.push({ index: i, angle: angles[i], absAngle: Math.abs(angles[i]) });
    }
  }
  candidates.sort((a, b) => b.absAngle - a.absAngle);

  const accepted = [];
  for (const c of candidates) {
    if (accepted.length >= maxCorners) break;
    const tooClose = accepted.some(
      (a) => loopDistance(cumulative, total, a.index, c.index) < minGapMeters
    );
    if (!tooClose) accepted.push(c);
  }

  accepted.sort((a, b) => a.index - b.index);

  return accepted.map((c, i) => ({
    number: i + 1,
    index: c.index,
    position: points[c.index],
    angleDeg: Math.round(c.angle),
    turn: c.angle < 0 ? 'right' : 'left',
  }));
}

// Rough "which way round" read of the outline, from the signed area of
// the polygon (shoelace formula). Describes the drawn shape, not an
// official race direction.
export function trackDirection(points) {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[(i + 1) % n];
    area += x1 * z2 - x2 * z1;
  }
  return area > 0 ? 'Counter-clockwise' : 'Clockwise';
}

// Longest run of consecutive points where the track barely turns at all,
// reported as the straight-line distance between the run's ends.
export function longestStraight(points, opts = {}) {
  const { angleThresholdDeg = 5 } = opts;
  const n = points.length;
  const angles = computeTurnAngles(points);
  const isStraight = angles.map((a) => Math.abs(a) < angleThresholdDeg);

  // Collect runs of straight indices, allowing wrap-around.
  const runs = [];
  let i = 0;
  let guard = 0;
  while (i < n && guard < n) {
    if (!isStraight[i]) {
      i++;
      guard++;
      continue;
    }
    let start = i;
    let len = 0;
    while (isStraight[(start + len) % n] && len < n) len++;
    runs.push({ start, length: len });
    i += Math.max(len, 1);
    guard += Math.max(len, 1);
  }

  if (runs.length === 0) return { startIndex: 0, endIndex: 0, lengthMeters: 0 };

  let best = runs[0];
  for (const r of runs) if (r.length > best.length) best = r;

  const startIndex = best.start % n;
  const endIndex = (best.start + Math.max(best.length - 1, 0)) % n;
  const p1 = points[startIndex];
  const p2 = points[endIndex];
  const lengthMeters = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);

  return { startIndex, endIndex, lengthMeters };
}

// One-stop shop: everything a 3D view or a stats card needs about a circuit.
export function getTrackDetail(circuit) {
  const points = toSceneCoords(circuit);
  const corners = detectCorners(points);
  const direction = trackDirection(points);
  const straight = longestStraight(points);
  const lengthMeters =
    circuit.length ?? points.reduce((sum, p, i) => {
      const next = points[(i + 1) % points.length];
      return sum + Math.hypot(next[0] - p[0], next[1] - p[1]);
    }, 0);

  return {
    points,
    corners,
    direction,
    longestStraightMeters: straight.lengthMeters,
    lengthMeters,
  };
}
