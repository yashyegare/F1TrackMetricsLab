// Small geometry helpers for animating a point along a lat/lon polyline.

const R = 6371000; // Earth radius in meters

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Haversine distance between two [lat, lon] points, in meters.
export function distanceMeters([lat1, lon1], [lat2, lon2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Given an array of [lat, lon] points, returns { cumulative, total }
// where cumulative[i] is the distance from the start to point i.
export function buildCumulativeDistances(positions) {
  const cumulative = [0];
  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    total += distanceMeters(positions[i - 1], positions[i]);
    cumulative.push(total);
  }
  return { cumulative, total };
}

// Given a progress ratio (0-1) along the path, returns the interpolated
// [lat, lon] position and the current heading in degrees (0 = north).
export function interpolateAlongPath(positions, cumulative, total, ratio) {
  if (positions.length === 0) return { position: null, heading: 0 };
  const targetDist = ratio * total;

  // Find the segment containing targetDist (linear scan is fine for ~a few hundred points).
  let i = 1;
  while (i < cumulative.length && cumulative[i] < targetDist) i++;
  if (i >= positions.length) i = positions.length - 1;

  const prev = positions[i - 1];
  const curr = positions[i];
  const segStart = cumulative[i - 1];
  const segEnd = cumulative[i];
  const segLen = segEnd - segStart || 1;
  const segRatio = Math.min(1, Math.max(0, (targetDist - segStart) / segLen));

  const lat = prev[0] + (curr[0] - prev[0]) * segRatio;
  const lon = prev[1] + (curr[1] - prev[1]) * segRatio;

  const heading =
    (Math.atan2(curr[1] - prev[1], curr[0] - prev[0]) * 180) / Math.PI;

  return { position: [lat, lon], heading };
}

// Projects [lon, lat] coordinates to local x/y meters using an equirectangular
// approximation around the track's own centroid. Good enough for comparing
// track shapes/sizes at this scale (a few km), not for navigation.
export function projectToLocalMeters(lonLatCoords) {
  const lats = lonLatCoords.map(([, lat]) => lat);
  const lons = lonLatCoords.map(([lon]) => lon);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lon0 = (Math.min(...lons) + Math.max(...lons)) / 2;
  const metersPerDegLat = 110540;
  const metersPerDegLon = 111320 * Math.cos(toRad(lat0));

  return lonLatCoords.map(([lon, lat]) => [
    (lon - lon0) * metersPerDegLon,
    (lat - lat0) * metersPerDegLat,
  ]);
}

// Bounding width/height (meters) of a set of local x/y points.
export function boundingSize(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
