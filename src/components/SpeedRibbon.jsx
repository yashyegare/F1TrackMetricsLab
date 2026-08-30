import React, { useMemo } from 'react';
import * as THREE from 'three';
import { interpolateSample, speedToColor } from '../utils/telemetryProject';

/**
 * SpeedRibbon — renders a single vertex-colored tube mesh.
 * Each vertex's color corresponds to the interpolated speed at that position.
 * Replaces multiple overlapping <Line> components with 1 draw call.
 */
export default function SpeedRibbon({ points, elevation, cumulative, total, projected, width = 0.6, opacity = 1 }) {
  const geometry = useMemo(() => {
    if (!projected || projected.length < 2 || !points || points.length < 2) return null;

    // Build 3D positions along the track path with elevation
    const positions = [];
    const numSegments = Math.max(points.length * 2, 200);
    for (let i = 0; i <= numSegments; i++) {
      const progress = i / numSegments;
      // Interpolate position along track
      const idx = Math.min(Math.floor(progress * (points.length - 1)), points.length - 2);
      const t = (progress * (points.length - 1)) - idx;
      const x = points[idx][0] + (points[idx + 1][0] - points[idx][0]) * t;
      const y = points[idx][1] + (points[idx + 1][1] - points[idx][1]) * t;
      const elev = elevation ? (elevation[idx] || 0) * (1 - t) + (elevation[Math.min(idx + 1, elevation.length - 1)] || 0) * t : 0;
      positions.push(new THREE.Vector3(x, elev, y));
    }

    // Create smooth curve and tube
    const curve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0.5);
    const tubeSegments = Math.max(projected.length, 100);
    const radialSegments = 4; // Low poly for performance
    const tubeGeo = new THREE.TubeGeometry(curve, tubeSegments, width, radialSegments, false);

    // Map vertex colors from interpolated speed
    // TubeGeometry vertices are laid out in rings: (radialSegments+1) vertices per ring
    const vertsPerRing = radialSegments + 1;
    const numRings = tubeSegments + 1;
    const colorAttr = new Float32Array(tubeGeo.attributes.position.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < tubeGeo.attributes.position.count; i++) {
      // Compute progress per ring — all vertices in the same ring get the same color
      const ringIndex = Math.floor(i / vertsPerRing);
      const vertexProgress = ringIndex / (numRings - 1);

      const sample = interpolateSample(projected, vertexProgress);
      const hex = speedToColor(sample.speed);
      color.set(hex);

      colorAttr[i * 3] = color.r;
      colorAttr[i * 3 + 1] = color.g;
      colorAttr[i * 3 + 2] = color.b;
    }

    tubeGeo.setAttribute('color', new THREE.Float32BufferAttribute(colorAttr, 3));
    return tubeGeo;
  }, [points, elevation, projected, width]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}
