import { useGraphicsQuality } from '../hooks/useGraphicsQuality';
import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Grid, ContactShadows, Html } from '@react-three/drei';
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

// --- Interpolate speed from telemetry at a given progress ---

function interpolateTelemetrySpeed(telemetry, progress) {
  if (!telemetry || telemetry.length === 0) return null;
  const p = ((progress % 1) + 1) % 1;
  // Find the two nearest telemetry points by progress
  let i = 1;
  while (i < telemetry.length && telemetry[i].progress < p) i++;
  if (i >= telemetry.length) return telemetry[telemetry.length - 1].speed;
  const prev = telemetry[i - 1];
  const curr = telemetry[i];
  const segLen = Math.abs(curr.progress - prev.progress) || 0.001; // abs to handle non-monotonic projection dips
  const t = Math.max(0, Math.min(1, (p - prev.progress) / segLen)); // clamp t to [0,1] for safety
  return prev.speed + (curr.speed - prev.speed) * t;
}

/** Sort a projected telemetry array by progress once, memoized. */
function useSortedTelemetry(telemetry) {
  return useMemo(() => {
    if (!telemetry || telemetry.length === 0) return [];
    return [...telemetry].sort((a, b) => a.progress - b.progress);
  }, [telemetry]);
}

// --- Ghost trail positions store ---
const TRAIL_LENGTH = 12;

// --- Animated car dot for overlay with ghost trail ---

function OverlayCarDot({ points, elevation, cumulative, total, speed, paused, size = 0.02, color = '#ffcc00', sharedProgressRef, telemetry, gapRef, isPrimary, trailRef, lengthMeters }) {
  const groupRef = useRef();
  const progressRef = useRef(0);
  const lastTime = useRef(null);
  const trailPositions = useRef([]);
  const sortedTelemetry = useSortedTelemetry(telemetry);

  const sphereR = size;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (paused || speed <= 0) {
      groupRef.current.visible = false;
      lastTime.current = null; // reset so first frame after unpause doesn't jump
      return;
    }
    groupRef.current.visible = true;
    const dt = Math.min(delta, 0.1);

    if (sharedProgressRef) {
      progressRef.current = sharedProgressRef.current;
      lastTime.current = null; // sync mode drives progress, don't track locally
    } else if (sortedTelemetry.length > 0) {
      const now = performance.now();
      if (lastTime.current === null) { lastTime.current = now; return; } // skip first frame to get a valid dt
      const elapsed = Math.min((now - lastTime.current) / 1000, 0.1); // clamp to prevent jumps from background tabs
      lastTime.current = now;

      const rawSpeed = interpolateTelemetrySpeed(sortedTelemetry, progressRef.current);
      const currentSpeed = rawSpeed != null ? Math.max(rawSpeed, 60) : null;
      if (currentSpeed != null) {
        const trackLengthKm = (lengthMeters ?? 5000) / 1000;
        const progressPerSecond = (currentSpeed / 3600) / Math.max(trackLengthKm, 0.1);
        progressRef.current = (progressRef.current + elapsed * progressPerSecond * speed) % 1;
      } else {
        progressRef.current = (progressRef.current + dt * speed * 0.08) % 1;
      }

      if (gapRef && isPrimary) {
        gapRef.current.primaryProgress = progressRef.current;
        gapRef.current.primaryTime = performance.now();
      } else if (gapRef && !isPrimary) {
        gapRef.current.secondaryProgress = progressRef.current;
        gapRef.current.secondaryTime = performance.now();
      }
    } else {
      // No telemetry: constant speed
      if (lastTime.current === null) { lastTime.current = performance.now(); return; }
      const elapsed = Math.min((performance.now() - lastTime.current) / 1000, 0.1);
      lastTime.current = performance.now();
      progressRef.current = (progressRef.current + elapsed * speed * 0.08) % 1;

      if (gapRef && isPrimary) {
        gapRef.current.primaryProgress = progressRef.current;
        gapRef.current.primaryTime = performance.now();
      } else if (gapRef && !isPrimary) {
        gapRef.current.secondaryProgress = progressRef.current;
        gapRef.current.secondaryTime = performance.now();
      }
    }

    const pos = interpolateAlongPath3D(points, elevation, cumulative, total, progressRef.current);
    groupRef.current.position.set(pos[0], pos[1], pos[2]);

    // Ghost trail: store recent positions
    trailPositions.current.push([...pos]);
    if (trailPositions.current.length > TRAIL_LENGTH) {
      trailPositions.current.shift();
    }
    if (trailRef) trailRef.current = [...trailPositions.current];
  });

  const initPos = useMemo(() =>
    interpolateAlongPath3D(points, elevation, cumulative, total, 0.5),
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

// --- Ghost trail renderer ---

function GhostTrail({ trailRef, color, size }) {
  const meshRefs = useRef([]);

  useFrame(() => {
    const positions = trailRef.current || [];
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      if (i < positions.length) {
        mesh.visible = true;
        mesh.position.set(positions[i][0], positions[i][1], positions[i][2]);
        const t = i / TRAIL_LENGTH;
        mesh.scale.setScalar(t * 0.7);
        mesh.material.opacity = t * 0.35;
      } else {
        mesh.visible = false;
      }
    }
  });

  return (
    <group>
      {Array.from({ length: TRAIL_LENGTH }, (_, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[size, 8, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// --- Corner delta tooltip (hover-only) ---


// --- Single track ribbon (semi-transparent) ---

function OverlayRibbon({ points, color, opacity, elevation, circuitId }) {
  const { edges, geometry } = useMemo(() => {
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

// --- Start/Finish line marker ---
function StartFinishMarker({ position, elevation, diag }) {
  const markerWidth = diag * 0.04;
  const markerThickness = diag * 0.002;
  const y = elevation + 0.003;
  const checkers = 6;
  const checkerW = markerWidth / checkers;

  return (
    <group position={[position[0], y, position[1]]}>
      {/* Checkered line across the track */}
      {Array.from({ length: checkers }).map((_, i) => (
        <mesh key={i} position={[i * checkerW - markerWidth / 2 + checkerW / 2, 0, 0]}>
          <boxGeometry args={[checkerW, markerThickness, markerThickness * 3]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#ffffff' : '#111111'}
            emissive={i % 2 === 0 ? '#ffffff' : '#000000'}
            emissiveIntensity={i % 2 === 0 ? 0.3 : 0}
          />
        </mesh>
      ))}
      {/* Small label */}
      <Html position={[0, markerThickness * 4, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(8,8,10,0.85)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '3px',
          padding: '1px 5px',
          fontSize: '8px',
          fontWeight: 700,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.5px',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}>
          S/F
        </div>
      </Html>
    </group>
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

// --- Floating circuit label in 3D ---

// Circuit labels are rendered as DOM overlays, not inside Canvas

// --- Live gap readout ---


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
  const xs = normalizedPoints.map(p => p[0]);
  const zs = normalizedPoints.map(p => p[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);
  const diag = Math.hypot(width, depth) || 1;
  const targetScale = Math.min(Math.max(diag * 0.02, 0.008), 0.04);
  const rawMax = Math.max(...raw) || 1;
  const scale = targetScale / rawMax;
  for (let i = 0; i < raw.length; i++) raw[i] *= scale;
  return raw;
}

function OverlayTrack({ detail, color, opacity, showCorners, altitude, circuitId, animSpeed, animPaused, drsZones = 0, sharedProgressRef, telemetry, gapRef, isPrimary, seaLevelMode, lengthMeters }) {
  const normalizedPoints = useMemo(() => normalizePoints(detail.points), [detail.points]);
  const elevation = useMemo(
    () => computeOverlayElevation(detail.points, detail.corners, altitude, normalizedPoints),
    [detail.points, detail.corners, altitude, normalizedPoints]
  );

  // Sea-level vertical offset: lift track above grid based on altitude
  // Max altitude ~2232m (Mexico City) maps to ~0.10 units lift
  const seaLevelOffset = useMemo(() => {
    if (!seaLevelMode) return 0;
    return Math.min(Math.abs(altitude || 0) / 2232, 1) * 0.10;
  }, [seaLevelMode, altitude]);

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



  const trailRefA = useRef([]);
  const trailRefB = useRef([]);
  const trailRef = isPrimary ? trailRefA : trailRefB;

  return (
    <group position={[0, seaLevelOffset, 0]}>
      {seaLevelMode && altitude != null && (
        <Html position={[0, 0.16, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(8,8,10,0.85)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(50,50,55,0.5)',
            borderRadius: '5px',
            padding: '3px 8px',
            fontSize: '10px',
            fontWeight: 700,
            color: color,
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '0.3px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}>
            {altitude >= 0 ? '+' : ''}{altitude}m ASL
          </div>
        </Html>
      )}
      <StartFinishMarker position={normalizedPoints[0]} elevation={elevation[0] ?? 0} color={color} diag={diag} />
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

      {drsLines.map((pts, i) => (
        <Line key={`ov-drs-${i}`} points={pts} color="#00ff88" lineWidth={3} transparent opacity={0.5} />
      ))}

      <GhostTrail trailRef={trailRef} color={color} size={diag * 0.004} />

      <OverlayCarDot
        points={normalizedPoints}
        elevation={elevation}
        cumulative={cumulative}
        total={total}
        speed={animSpeed}
        paused={animPaused}
        size={diag * 0.008}
        color="#ffcc00"
        sharedProgressRef={sharedProgressRef}
        telemetry={telemetry}
        gapRef={gapRef}
        isPrimary={isPrimary}
        trailRef={trailRef}
        lengthMeters={lengthMeters}
      />
    </group>
  );
}

// --- Main overlay scene ---

export default function OverlayScene({ primaryDetail, secondaryDetail, primaryAltitude, secondaryAltitude, primaryId, secondaryId, primaryDrsZones, secondaryDrsZones, animSpeed, animPaused, showLabels, showTrackA, showTrackB, syncMode, seaLevelMode, sharedProgressRef, primaryTelemetry, secondaryTelemetry, gapRef }) {
  const graphics = useGraphicsQuality();
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
      dpr={[1, graphics.maxDpr]}
      gl={{ preserveDrawingBuffer: true }}
      camera={{ position: camera.position, fov: camera.fov, near: camera.near, far: camera.far }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[diag * 0.6, diag * 0.9, diag * 0.35]} intensity={1.15} />
      <directionalLight position={[-diag * 0.5, diag * 0.4, -diag * 0.4]} intensity={0.35} />

      {showTrackA && (
        <OverlayTrack
          detail={primaryDetail}
          color="#e10600"
          opacity={showTrackB ? 0.72 : 0.85}
          showCorners
          altitude={primaryAltitude}
          circuitId={primaryId}
          drsZones={primaryDrsZones}
          animSpeed={animSpeed}
          animPaused={animPaused}
          showLabel={showLabels}
          sharedProgressRef={syncMode ? sharedProgressRef : null}
          telemetry={primaryTelemetry}
          gapRef={gapRef}
          isPrimary={true}
          seaLevelMode={seaLevelMode}
          otherAltitude={secondaryAltitude}
          lengthMeters={primaryDetail.lengthMeters}
        />
      )}
      {showTrackB && (
        <OverlayTrack
          detail={secondaryDetail}
          color="#00a3ff"
          opacity={showTrackA ? 0.55 : 0.85}
          showCorners
          altitude={secondaryAltitude}
          circuitId={secondaryId}
          drsZones={secondaryDrsZones}
          animSpeed={animSpeed}
          animPaused={animPaused}
          showLabel={showLabels}
          sharedProgressRef={syncMode ? sharedProgressRef : null}
          telemetry={secondaryTelemetry}
          gapRef={gapRef}
          isPrimary={false}
          seaLevelMode={seaLevelMode}
          otherAltitude={primaryAltitude}
          lengthMeters={secondaryDetail.lengthMeters}
        />
      )}

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
      {graphics.shadows && <ContactShadows position={[0, -0.015, 0]} opacity={0.4} scale={diag * 2.4} blur={2.2} far={diag * 0.6} />}

      <SyncProgressDriver sharedProgressRef={sharedProgressRef} animSpeed={animSpeed} animPaused={animPaused} syncMode={syncMode} primaryTelemetry={primaryTelemetry} lengthMeters={primaryDetail.lengthMeters} />

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

// --- Sync progress driver (inside Canvas) ---

function SyncProgressDriver({ sharedProgressRef, animSpeed, animPaused, syncMode, primaryTelemetry, lengthMeters }) {
  const lastTime = useRef(null);
  const sortedTelemetry = useSortedTelemetry(primaryTelemetry);
  useFrame(() => {
    if (syncMode && animSpeed > 0 && !animPaused) {
      const now = performance.now();
      if (lastTime.current === null) { lastTime.current = now; return; } // skip first frame
      const elapsed = Math.min((now - lastTime.current) / 1000, 0.1); // clamp to prevent jumps from background tabs
      lastTime.current = now;

      // Use real telemetry speed if available, otherwise use a moderate default
      let progressDelta = 0;
      if (sortedTelemetry.length > 0) {
        const rawSpeed = interpolateTelemetrySpeed(sortedTelemetry, sharedProgressRef.current);
        const currentSpeed = rawSpeed != null ? Math.max(rawSpeed, 60) : null;
        if (currentSpeed != null) {
          const trackLengthKm = (lengthMeters ?? 5000) / 1000;
          progressDelta = (currentSpeed / 3600) / Math.max(trackLengthKm, 0.1);
        }
      }
      if (progressDelta <= 0) {
        progressDelta = 0.0167;
      }
      sharedProgressRef.current = (sharedProgressRef.current + elapsed * progressDelta * animSpeed) % 1;
    } else {
      lastTime.current = null;
    }
  });
  return null;
}

// --- Main export ---

