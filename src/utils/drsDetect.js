/**
 * Detects DRS zone straights on a circuit path.
 * Returns an array of segments, each with start/end indices and a `drs` boolean.
 */

// Compute angle between three consecutive points
function angleBetween(a, b, c) {
  const ba = [a[0] - b[0], a[1] - b[1]];
  const bc = [c[0] - b[0], c[1] - b[1]];
  const dot = ba[0] * bc[0] + ba[1] * bc[1];
  const magBA = Math.hypot(...ba);
  const magBC = Math.hypot(...bc);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle);
}

/**
 * Identify straight segments on a track.
 * @param {Array} points - Array of [x, y] coordinate pairs
 * @param {number} drsZoneCount - Number of DRS zones to highlight
 * @param {number} windowSize - Number of consecutive points to smooth over
 * @returns {Array} Array of { start, end, straightLength, drs } objects
 */
export function detectStraights(points, drsZoneCount = 0, windowSize = 5) {
  const n = points.length;
  if (n < 3) return [];

  // Compute cumulative distances
  const cumDist = [0];
  for (let i = 1; i < n; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    cumDist.push(cumDist[i - 1] + Math.hypot(dx, dy));
  }
  const totalLength = cumDist[n - 1] + Math.hypot(
    points[0][0] - points[n - 1][0],
    points[0][1] - points[n - 1][1]
  );

  // For each point, compute the "straightness score" — average curvature over a window
  // Lower score = straighter
  const straightness = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let totalAngle = 0;
    let count = 0;
    for (let d = -windowSize; d <= windowSize; d++) {
      const prev = ((i + d - 1) % n + n) % n;
      const curr = ((i + d) % n + n) % n;
      const next = ((i + d + 1) % n + n) % n;
      totalAngle += angleBetween(points[prev], points[curr], points[next]);
      count++;
    }
    straightness[i] = count > 0 ? totalAngle / count : Math.PI;
  }

  // Threshold: points with angle < ~175° (0.087 rad from straight) are considered "straight"
  const threshold = 0.087; // ~5 degrees from perfectly straight
  const isStraight = straightness.map(s => s < threshold);

  // Find connected straight segments
  const segments = [];
  let segStart = -1;
  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    if (isStraight[idx] && segStart === -1) {
      segStart = i;
    } else if ((!isStraight[idx] || i === n) && segStart !== -1) {
      const segEnd = i;
      const startIdx = segStart % n;
      const endIdx = segEnd % n;
      // Compute straight length
      let straightLen;
      if (segEnd > segStart) {
        straightLen = cumDist[Math.min(segEnd, n - 1)] - cumDist[segStart];
      } else {
        straightLen = totalLength - cumDist[segStart] + cumDist[Math.min(segEnd, n - 1)];
      }
      segments.push({
        start: startIdx,
        end: endIdx,
        length: straightLen,
        straightness: straightness.slice(segStart % n, segEnd % n).reduce((a, b) => Math.min(a, b), Infinity),
      });
      segStart = -1;
    }
  }

  // Merge short segments that are very close together
  const merged = [];
  for (const seg of segments) {
    if (merged.length > 0) {
      const last = merged[merged.length - 1];
      const gap = Math.abs(seg.start - last.end);
      if (gap <= 3) {
        last.end = seg.end;
        last.length += seg.length;
        continue;
      }
    }
    merged.push({ ...seg });
  }

  // Sort by length (longest first), mark top N as DRS
  merged.sort((a, b) => b.length - a.length);
  for (let i = 0; i < merged.length; i++) {
    merged[i].drs = i < drsZoneCount;
  }

  return merged;
}

/**
 * Given a segment array from detectStraights, returns the color for each point index.
 * @param {number} totalPoints - Total number of points in the circuit
 * @param {Array} segments - Output from detectStraights
 * @param {string} normalColor - Color for non-DRS points
 * @param {string} drsColor - Color for DRS zone points
 * @returns {Array} Array of hex color strings, one per point
 */
export function segmentColors(totalPoints, segments, normalColor = '#555555', drsColor = '#00ff88') {
  const colors = new Array(totalPoints).fill(normalColor);
  for (const seg of segments) {
    if (!seg.drs) continue;
    if (seg.start < seg.end) {
      for (let i = seg.start; i <= seg.end && i < totalPoints; i++) {
        colors[i] = drsColor;
      }
    } else {
      // Wraps around
      for (let i = seg.start; i < totalPoints; i++) colors[i] = drsColor;
      for (let i = 0; i <= seg.end && i < totalPoints; i++) colors[i] = drsColor;
    }
  }
  return colors;
}
