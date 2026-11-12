// Session-level cache for ribbon BufferGeometry objects, keyed by circuit ID.
// Avoids rebuilding geometry when the user switches back and forth between
// circuits in Compare 3D.  The cache lives for the duration of the page
// session (module-level Map) and is automatically freed on reload.

import * as THREE from 'three';

const ribbonCache = new Map();   // id → BufferGeometry
const edgeCache = new Map();     // id → { left, right }
const identities = new WeakMap();
let nextIdentity = 0;
function identity(value) { if (!identities.has(value)) identities.set(value,++nextIdentity); return identities.get(value); }

// Offset edges (same algorithm as in Track3D / Overlay3DPanel but cached).
export function getCachedEdges(circuitId, points, width) {
  const key = `${circuitId}_p${identity(points)}_w${width}`;
  if (edgeCache.has(key)) return edgeCache.get(key);

  const n = points.length;
  const hw = width / 2;
  const left = new Array(n);
  const right = new Array(n);

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const px = -dz;
    const pz = dx;
    left[i] = [points[i][0] + px * hw, 0.06, points[i][1] + pz * hw];
    right[i] = [points[i][0] - px * hw, 0.06, points[i][1] - pz * hw];
  }

  const edges = { left, right };
  edgeCache.set(key, edges);
  if (edgeCache.size > 128) edgeCache.delete(edgeCache.keys().next().value);
  return edges;
}

// Build or retrieve a cached ribbon geometry.
// `elevation` is a Float32Array (may be empty/flat for circuits without altitude).
export function getCachedRibbonGeometry(circuitId, points, edges, elevation) {
  // Include elevation hash in key so banking changes don't serve stale geo.
  let elevHash = 0;
  if (elevation) {
    for (let i = 0; i < elevation.length; i++) {
      elevHash = ((elevHash << 5) - elevHash + elevation[i] * 1000) | 0;
    }
  }
  const key = `${circuitId}_p${identity(points)}_edges${identity(edges)}_e${elevHash}`;
  if (ribbonCache.has(key)) return ribbonCache.get(key);

  const { left, right } = edges;
  const n = points.length;
  const arr = [];

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const L0 = left[i];
    const R0 = right[i];
    const L1 = left[j];
    const R1 = right[j];
    const y0 = elevation?.[i] ?? 0;
    const y1 = elevation?.[j] ?? 0;
    arr.push(L0[0], y0, L0[2], R0[0], y0, R0[2], L1[0], y1, L1[2]);
    arr.push(R0[0], y0, R0[2], R1[0], y1, R1[2], L1[0], y1, L1[2]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
  geometry.computeVertexNormals();

  ribbonCache.set(key, geometry);
  if (ribbonCache.size > 64) {
    const oldest=ribbonCache.keys().next().value;
    ribbonCache.get(oldest).dispose(); ribbonCache.delete(oldest);
  }
  return geometry;
}

export function cacheSize() {
  return ribbonCache.size;
}
