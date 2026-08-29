import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line, Grid, ContactShadows, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { getCachedEdges, getCachedRibbonGeometry } from '../utils/ribbonCache';
import { detectStraights } from '../utils/drsDetect';

// --- Normalizes two sets of scene coords so they fit inside the same bounding box ---

function normalizePoints(pts) {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  const scale = 1 / Math.max(rangeX, rangeZ);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  return pts.map(([x, z]) => [(x - cx) * scale, (z - cz) * scale]);
}

// --- 3D cumulative distances for animation along normalized track ---

function buildCumulativeDist3D(points, elevation) {
  const cumulative = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = (elevation[i] ?? 0) - (elevation[i - 1] ?? 0);
    const dz = points[i][1] - points[i - 1][1];
    total += Math.hypot(dx, dy, dz);
    cumulative.push(total);
  }
  const dx = points[0][0] - points[points.length - 1][0];
  const dy = (elevation[0] ?? 0) - (elevation[points.length - 1] ?? 0);
  const dz = points[0][1] - points[points.length - 1][1];
  total += Math.hypot(dx, dy, dz);
  return { cumulative, total };
}

function interpolateAlongPath3D(points, elevation, cumulative, total, ratio) {
  if (points.length === 0 || total === 0) return [0, 0, 0];
  const targetDist = (((ratio % 1) + 1) % 1) * total;
  let i = 1;
  while (i < cumulative.length && cumulative[i] < targetDist) i++;
  if (i >= points.length) i = points.length - 1;
  const prev = points[i - 1];
  const curr = points[i];
  const segStart = cumulative[i - 1];
  const segEnd = cumulative[i];
  const segLen = segEnd - segStart || 1;
  const segRatio = Math.min(1, Math.max(0, (targetDist - segStart) / segLen));
  const x = prev[0] + (curr[0] - prev[0]) * segRatio;
  const y0 = (elevation[i - 1] ?? 0) + ((elevation[i] ?? 0) - (elevation[i - 1] ?? 0)) * segRatio;
  const z = prev[1] + (curr[1] - prev[1]) * segRatio;
  return [x, y0 + 0.003, z];
}

// --- Animated car dot for overlay ---

function OverlayCarDot({ points, elevation, cumulative, total, speed, paused, size = 0.02, color = '#ffcc00' }) {
  const groupRef = useRef();
  const progress = useRef(Math.random());

  const sphereR = size;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (paused || speed <= 0) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    const dt = Math.min(delta, 0.1);
    progress.current = (progress.current + dt * speed * 0.08) % 1;
    const pos = interpolateAlongPath3D(points, elevation, cumulative, total, progress.current);
    groupRef.current.position.set(pos[0], pos[1], pos[2]);
  });

  const initPos = useMemo(() =>
    interpolateAlongPath3D(points, elevation, cumulative, total, progress.current),
    [points, elevation, cumulative, total]
  );

  return (
    <group ref={groupRef} position={initPos} visible={speed > 0}>
      <mesh>
        <sphereGeometry args={[sphereR, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={sphereR * 80} distance={sphereR * 30} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -sphereR * 0.15, 0]}>
        <ringGeometry args={[sphereR * 0.6, sphereR * 1.3, 20]} />
        <meshStandardMaterial color={color} transparent opacity={0.3} emissive={color} emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// --- Single track ribbon (semi-transparent) ---

function OverlayRibbon({ points, color, opacity, elevation, circuitId }) {
  const { edges, geometry, trackWidth } = useMemo(() => {
    const xs = points.map((p) => p[0]);
    const zs = points.map((p) => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    const diag = Math.hypot(width, depth) || 1;
    const tw = Math.min(Math.max(diag * 0.006, 0.004), 0.02);
    const cacheKey = `${circuitId}_ov`;
    const e = getCachedEdges(cacheKey, points, tw);
    const g = getCachedRibbonGeometry(cacheKey, points, e, elevation);
    return { edges: e, geometry: g, trackWidth: tw };
  }, [points, elevation, circuitId]);

  const leftLoop = useMemo(() => [...edges.left, edges.left[0]], [edges]);
  const rightLoop = useMemo(() => [...edges.right, edges.right[0]], [edges]);

  return (
    <>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          roughness={0.85}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Line points={leftLoop} color={color} lineWidth={1.0} transparent opacity={opacity * 0.7} />
      <Line points={rightLoop} color={color} lineWidth={1.0} transparent opacity={opacity * 0.7} />
    </>
  );
}

// --- Corner marker (simplified for overlay) ---

function OverlayCornerMarker({ position, poleHeight, accentColor, y = 0 }) {
  return (
    <group position={[position[0], y, position[1]]}>
      <mesh position={[0, poleHeight / 2, 0]}>
        <cylinderGeometry args={[poleHeight * 0.015, poleHeight * 0.015, poleHeight, 6]} />
        <meshStandardMaterial color="#3a3a40" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, poleHeight, 0]}>
        <sphereGeometry args={[poleHeight * 0.1, 10, 10]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.4} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// --- Track wrapper inside the overlay scene ---

function computeOverlayElevation(originalPoints, corners, altitudeMeters, normalizedPoints) {
  const n = originalPoints.length;
  if (!altitudeMeters || altitudeMeters === 0) return new Float32Array(normalizedPoints.length).fill(0);
  const maxLift = Math.min(Math.abs(altitudeMeters) / 200, 6);
  const radius = Math.max(Math.floor(n * 0.08), 3);
  const raw = new Float32Array(n);
  for (const c of corners) {
    const intensity = Math.min(Math.abs(c.angleDeg) / 60, 1) * maxLift * 0.15;
    for (let d = -radius; d <= radius; d++) {
      const idx = ((c.index + d) % n + n) % n;
      const falloff = Math.exp(-(d * d) / (2 * (radius * 0.4) ** 2));
      raw[idx] = Math.max(raw[idx], intensity * falloff);
    }
  }
  return raw;
}

function OverlayTrack({ detail, color, opacity, showCorners, altitude, circuitId, animSpeed, animPaused, drsZones = 0 }) {
  const normalizedPoints = useMemo(() => normalizePoints(detail.points), [detail.points]);
  const elevation = useMemo(
    () => computeOverlayElevation(detail.points, detail.corners, altitude, normalizedPoints),
    [detail.points, detail.corners, altitude, normalizedPoints]
  );

  const xs = normalizedPoints.map((p) => p[0]);
  const zs = normalizedPoints.map((p) => p[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);
  const diag = Math.hypot(width, depth) || 1;
  const poleHeight = Math.min(Math.max(diag * 0.02, 0.008), 0.04);

  // DRS zone detection on normalized points
  const drsSegments = useMemo(() => {
    if (drsZones <= 0) return [];
    return detectStraights(normalizedPoints, drsZones);
  }, [normalizedPoints, drsZones]);

  const drsLines = useMemo(() => {
    if (drsSegments.length === 0) return [];
    return drsSegments
      .filter(s => s.drs)
      .map(seg => {
        const pts = [];
        if (seg.start <= seg.end) {
          for (let i = seg.start; i <= seg.end; i++) {
            pts.push([normalizedPoints[i][0], (elevation[i] ?? 0) + 0.004, normalizedPoints[i][1]]);
          }
        } else {
          for (let i = seg.start; i < normalizedPoints.length; i++) {
            pts.push([normalizedPoints[i][0], (elevation[i] ?? 0) + 0.004, normalizedPoints[i][1]]);
          }
          for (let i = 0; i <= seg.end; i++) {
            pts.push([normalizedPoints[i][0], (elevation[i] ?? 0) + 0.004, normalizedPoints[i][1]]);
          }
        }
        return pts;
      });
  }, [drsSegments, normalizedPoints, elevation]);

  // Cumulative distances for animation
  const { cumulative, total } = useMemo(
    () => buildCumulativeDist3D(normalizedPoints, elevation),
    [normalizedPoints, elevation]
  );

  // Normalize corners to match normalized points
  const normalizedCorners = useMemo(() => {
    if (!showCorners) return [];
    const origXs = detail.points.map((p) => p[0]);
    const origZs = detail.points.map((p) => p[1]);
    const origMinX = Math.min(...origXs);
    const origMaxX = Math.max(...origXs);
    const origMinZ = Math.min(...origZs);
    const origMaxZ = Math.max(...origZs);
    const origRangeX = origMaxX - origMinX || 1;
    const origRangeZ = origMaxZ - origMinZ || 1;
    const origScale = 1 / Math.max(origRangeX, origRangeZ);
    const origCx = (origMinX + origMaxX) / 2;
    const origCz = (origMinZ + origMaxZ) / 2;

    return detail.corners.map((c) => ({
      ...c,
      position: [
        (c.position[0] - origCx) * origScale,
        (c.position[1] - origCz) * origScale,
      ],
    }));
  }, [detail.corners, detail.points, showCorners]);

  return (
    <>
      <OverlayRibbon points={normalizedPoints} color={color} opacity={opacity} elevation={elevation} circuitId={circuitId} />
      {normalizedCorners.map((corner) => (
        <OverlayCornerMarker
          key={corner.number}
          position={corner.position}
          poleHeight={poleHeight}
          accentColor={color}
          y={elevation[corner.index] ?? 0}
        />
      ))}
      {/* DRS zone highlights */}
      {drsLines.map((pts, i) => (
        <Line key={`ov-drs-${i}`} points={pts} color="#00ff88" lineWidth={3} transparent opacity={0.5} />
      ))}

      <OverlayCarDot
        points={normalizedPoints}
        elevation={elevation}
        cumulative={cumulative}
        total={total}
        speed={animSpeed}
        paused={animPaused}
        size={diag * 0.025}
        color="#ffcc00"
      />
    </>
  );
}

// --- Main overlay scene ---

function OverlayScene({ primaryDetail, secondaryDetail, primaryAltitude, secondaryAltitude, primaryId, secondaryId, primaryDrsZones, secondaryDrsZones, animSpeed, animPaused }) {
  const diag = 1.4;

  const camera = useMemo(() => {
    const fovDeg = 42;
    const distance = (diag / 2) * 1.25 / Math.sin((fovDeg / 2) * (Math.PI / 180));
    const dir = new THREE.Vector3(0.5, 0.8, 0.5).normalize().multiplyScalar(distance);
    return {
      position: [dir.x, dir.y, dir.z],
      fov: fovDeg,
      near: 0.01,
      far: distance * 20,
      distance,
    };
  }, []);

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true }}
      camera={{ position: camera.position, fov: camera.fov, near: camera.near, far: camera.far }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[diag * 0.6, diag * 0.9, diag * 0.35]} intensity={1.15} />
      <directionalLight position={[-diag * 0.5, diag * 0.4, -diag * 0.4]} intensity={0.35} />

      <OverlayTrack detail={primaryDetail} color="#e10600" opacity={0.72} showCorners altitude={primaryAltitude} circuitId={primaryId} drsZones={primaryDrsZones} animSpeed={animSpeed} animPaused={animPaused} />
      <OverlayTrack detail={secondaryDetail} color="#00a3ff" opacity={0.55} showCorners altitude={secondaryAltitude} circuitId={secondaryId} drsZones={secondaryDrsZones} animSpeed={animSpeed} animPaused={animPaused} />

      <Grid
        position={[0, -0.02, 0]}
        args={[diag * 3, diag * 3]}
        cellSize={diag * 0.05}
        cellThickness={0.5}
        cellColor="#242428"
        sectionSize={diag * 0.25}
        sectionThickness={1}
        sectionColor="#3a3a42"
        fadeDistance={diag * 2.6}
        fadeStrength={1.2}
        infiniteGrid
      />
      <ContactShadows position={[0, -0.015, 0]} opacity={0.4} scale={diag * 2.4} blur={2.2} far={diag * 0.6} />

      <OrbitControls
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        minDistance={camera.distance * 0.35}
        maxDistance={camera.distance * 2.4}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}

export default function Overlay3DPanel({ primary, secondary, primaryDetail, secondaryDetail, animSpeed = 0, animPaused = false }) {
  return (
    <div className="compare3d-wrapper">
      <div className="overlay-3d-container">
        <div className="overlay-3d-canvas-wrap">
          <OverlayScene
            primaryDetail={primaryDetail}
            secondaryDetail={secondaryDetail}
            primaryAltitude={primary.altitude}
            secondaryAltitude={secondary.altitude}
            primaryId={primary.id}
            secondaryId={secondary.id}
            primaryDrsZones={primary.drsZones || 0}
            secondaryDrsZones={secondary.drsZones || 0}
            animSpeed={animSpeed}
            animPaused={animPaused}
          />
        </div>
        <div className="overlay-3d-legend">
          <span className="overlay-legend-item">
            <span className="overlay-legend-dot" style={{ background: '#e10600' }} />
            {primary.name} ({primary.location})
          </span>
          <span className="overlay-legend-item">
            <span className="overlay-legend-dot" style={{ background: '#00a3ff' }} />
            {secondary.name} ({secondary.location})
          </span>
        </div>
      </div>
      <p className="compare-note">
        Both tracks are normalized to the same bounding box so their shapes are directly comparable.
        Semi-transparency shows overlap. Corner markers and track width are stylized, not to scale.
      </p>
    </div>
  );
}
