import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, Grid, ContactShadows, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { getCachedEdges, getCachedRibbonGeometry } from '../utils/ribbonCache';

// --- Elevation computation ---------------------------------------------------

function computeElevation(points, corners, altitudeMeters) {
  const n = points.length;
  if (!altitudeMeters || altitudeMeters === 0) return new Float32Array(n).fill(0);
  const maxLift = Math.min(Math.abs(altitudeMeters) / 200, 6);
  const radius = Math.max(Math.floor(n * 0.08), 3);
  const raw = new Float32Array(n);
  for (const c of corners) {
    const intensity = Math.min(Math.abs(c.angleDeg) / 60, 1) * maxLift;
    for (let d = -radius; d <= radius; d++) {
      const idx = ((c.index + d) % n + n) % n;
      const falloff = Math.exp(-(d * d) / (2 * (radius * 0.4) ** 2));
      raw[idx] = Math.max(raw[idx], intensity * falloff);
    }
  }
  return raw;
}

// --- 3D cumulative distances -------------------------------------------------

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
  // Close loop
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
  return [x, y0 + 0.15, z];
}

// --- Checker texture ---------------------------------------------------------

function makeCheckerTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cell = size / 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f2f2f2' : '#111114';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// --- Corner marker (clickable) ----------------------------------------------

function CornerMarker({ corner, poleHeight, accentColor, y = 0, onZoom }) {
  const [x, z] = corner.position;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, poleHeight / 2, 0]}>
        <cylinderGeometry args={[poleHeight * 0.012, poleHeight * 0.012, poleHeight, 6]} />
        <meshStandardMaterial color="#3a3a40" />
      </mesh>
      <mesh
        position={[0, poleHeight, 0]}
        onClick={(e) => { e.stopPropagation(); onZoom?.([x, y + poleHeight * 1.5, z]); }}
      >
        <sphereGeometry args={[poleHeight * 0.09, 12, 12]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.4} />
      </mesh>
      <Html position={[0, poleHeight * 1.18, 0]} center distanceFactor={poleHeight * 26} occlude={false}>
        <div className="corner-pill" onClick={(e) => { e.stopPropagation(); onZoom?.([x, y + poleHeight * 1.5, z]); }} style={{ cursor: 'pointer' }}>
          T{corner.number}
        </div>
      </Html>
    </group>
  );
}

// --- Start/finish gantry ----------------------------------------------------

function StartFinishGantry({ points, trackWidth, poleHeight, checkerTexture }) {
  const start = points[0];
  const next = points[1] ?? points[points.length - 1];
  const dx = next[0] - start[0];
  const dz = next[1] - start[1];
  const heading = Math.atan2(dx, dz);
  return (
    <group position={[start[0], 0, start[1]]} rotation={[0, heading, 0]}>
      <mesh position={[0, poleHeight * 0.62, 0]}>
        <planeGeometry args={[trackWidth * 1.15, poleHeight * 0.5]} />
        <meshStandardMaterial map={checkerTexture} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-trackWidth * 0.62, poleHeight * 0.31, 0]}>
        <cylinderGeometry args={[poleHeight * 0.015, poleHeight * 0.015, poleHeight * 0.62, 6]} />
        <meshStandardMaterial color="#3a3a40" />
      </mesh>
      <mesh position={[trackWidth * 0.62, poleHeight * 0.31, 0]}>
        <cylinderGeometry args={[poleHeight * 0.015, poleHeight * 0.015, poleHeight * 0.62, 6]} />
        <meshStandardMaterial color="#3a3a40" />
      </mesh>
      <Html position={[0, poleHeight * 0.98, 0]} center distanceFactor={poleHeight * 26} occlude={false}>
        <div className="startfinish-pill">START / FINISH</div>
      </Html>
    </group>
  );
}

// --- Animated car dot --------------------------------------------------------

function CarDot({ points, elevation, cumulative, total, speed, paused, size = 1 }) {
  const groupRef = useRef();
  const progress = useRef(Math.random());

  const sphereR = size * 0.45;
  const ringInner = size * 0.3;
  const ringOuter = size * 0.65;

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

  // Set initial position once on mount
  const initPos = useMemo(() =>
    interpolateAlongPath3D(points, elevation, cumulative, total, progress.current),
    [points, elevation, cumulative, total]
  );

  return (
    <group ref={groupRef} position={initPos} visible={speed > 0}>
      <mesh>
        <sphereGeometry args={[sphereR, 20, 20]} />
        <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <pointLight color="#ffcc00" intensity={sphereR * 80} distance={sphereR * 30} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -sphereR * 0.15, 0]}>
        <ringGeometry args={[ringInner, ringOuter, 24]} />
        <meshStandardMaterial color="#ffcc00" transparent opacity={0.4} emissive="#ffcc00" emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// --- Track scene -------------------------------------------------------------

function TrackScene({ detail, accentColor, altitude, circuitId, sharedCameraRef, instanceId, animSpeed, animPaused, onCornerZoom }) {
  const { points, corners } = detail;
  const controlsRef = useRef();
  const { camera } = useThree();

  const bbox = useMemo(() => {
    const xs = points.map((p) => p[0]);
    const zs = points.map((p) => p[1]);
    return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs) };
  }, [points]);

  const diag = Math.hypot(bbox.width, bbox.depth) || 1000;
  const trackWidth = Math.min(Math.max(diag * 0.006, 40), 220);
  const poleHeight = Math.min(Math.max(diag * 0.02, 26), 90);

  const elevation = useMemo(() => computeElevation(points, corners, altitude), [points, corners, altitude]);
  const hasElevation = altitude != null && altitude !== 0;
  const { cumulative, total } = useMemo(() => buildCumulativeDist3D(points, elevation), [points, elevation]);

  const edges = useMemo(() => getCachedEdges(circuitId, points, trackWidth), [circuitId, points, trackWidth]);
  const ribbonGeometry = useMemo(() => getCachedRibbonGeometry(circuitId, points, edges, elevation), [circuitId, points, edges, elevation]);
  const checkerTexture = useMemo(() => makeCheckerTexture(), []);

  const leftLoop = useMemo(() => edges.left.map(([x, _y, z], i) => [x, elevation[i] ?? 0, z]), [edges, elevation]);
  const rightLoop = useMemo(() => edges.right.map(([x, _y, z], i) => [x, elevation[i] ?? 0, z]), [edges, elevation]);
  const centerLoop = useMemo(
    () => [...points.map(([x, z], i) => [x, (elevation[i] ?? 0) + 0.08, z]), [points[0][0], (elevation[0] ?? 0) + 0.08, points[0][1]]],
    [points, elevation]
  );
  const startElev = elevation[0] ?? 0;

  // Camera sync: broadcast position on change, apply external changes
  const broadcastCamera = useCallback(() => {
    if (!sharedCameraRef?.current || !instanceId) return;
    const state = sharedCameraRef.current;
    // Apply external update if another instance changed
    if (state._lastUpdater && state._lastUpdater !== instanceId && state.position && state.target) {
      camera.position.set(state.position[0], state.position[1], state.position[2]);
      if (controlsRef.current) {
        controlsRef.current.target.set(state.target[0], state.target[1], state.target[2]);
        controlsRef.current.update();
      }
      state._appliedBy = instanceId;
    }
  }, [sharedCameraRef, instanceId, camera]);

  // Broadcast on each orbit change
  const handleControlsChange = useCallback(() => {
    if (!sharedCameraRef?.current || !instanceId) return;
    const state = sharedCameraRef.current;
    // Skip if we just applied an external update
    if (state._appliedBy === instanceId) {
      state._appliedBy = null;
      return;
    }
    state.position = [camera.position.x, camera.position.y, camera.position.z];
    const t = controlsRef.current?.target;
    state.target = t ? [t.x, t.y, t.z] : [0, 0, 0];
    state._lastUpdater = instanceId;
  }, [sharedCameraRef, instanceId, camera]);

  // Apply external camera changes periodically
  useFrame(() => {
    broadcastCamera();
  });

  const handleCornerZoom = useCallback((pos) => {
    if (controlsRef.current) {
      const cc = controlsRef.current;
      const camDist = diag * 0.35;
      // Smoothly move camera closer to the corner
      const targetPos = new THREE.Vector3(pos[0] + camDist * 0.4, pos[1] + camDist * 0.5, pos[2] + camDist * 0.4);
      const targetLook = new THREE.Vector3(pos[0], pos[1], pos[2]);
      // Animate over a few frames
      const startPos = camera.position.clone();
      const startTarget = cc.target.clone();
      let t = 0;
      const animate = () => {
        t += 0.05;
        if (t >= 1) {
          camera.position.copy(targetPos);
          cc.target.copy(targetLook);
          cc.update();
          return;
        }
        const ease = 1 - Math.pow(1 - t, 3); // ease out cubic
        camera.position.lerpVectors(startPos, targetPos, ease);
        cc.target.lerpVectors(startTarget, targetLook, ease);
        cc.update();
        requestAnimationFrame(animate);
      };
      animate();
    }
    onCornerZoom?.();
  }, [controlsRef, camera, diag, onCornerZoom]);

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[diag * 0.6, diag * 0.9, diag * 0.35]} intensity={1.15} />
      <directionalLight position={[-diag * 0.5, diag * 0.4, -diag * 0.4]} intensity={0.35} />

      <mesh geometry={ribbonGeometry} receiveShadow>
        <meshStandardMaterial color="#2a2a2f" roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      <Line points={leftLoop} color="#f2f2f2" lineWidth={1.2} transparent opacity={0.55} />
      <Line points={rightLoop} color="#f2f2f2" lineWidth={1.2} transparent opacity={0.55} />
      <Line points={centerLoop} color={accentColor} lineWidth={1.4} dashed dashSize={trackWidth * 0.4} gapSize={trackWidth * 0.4} />

      <group position={[0, startElev, 0]}>
        <StartFinishGantry points={points} trackWidth={trackWidth} poleHeight={poleHeight} checkerTexture={checkerTexture} />
      </group>

      {corners.map((corner) => (
        <CornerMarker
          key={corner.index}
          corner={corner}
          poleHeight={poleHeight * 0.55}
          accentColor={accentColor}
          y={elevation[corner.index] ?? 0}
          onZoom={handleCornerZoom}
        />
      ))}

      <CarDot points={points} elevation={elevation} cumulative={cumulative} total={total} speed={animSpeed} paused={animPaused} size={trackWidth} />

      <Billboard position={[0, poleHeight * 1.6 + (hasElevation ? 1 : 0), 0]}>
        <Html center distanceFactor={poleHeight * 30} occlude={false}>
          <div className="track3d-name-pill">{corners.length} corners{hasElevation ? ' • elevation stylized' : ''}</div>
        </Html>
      </Billboard>

      <Grid
        position={[0, -0.4, 0]}
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
      <ContactShadows position={[0, -0.35, 0]} opacity={0.5} scale={diag * 2.4} blur={2.2} far={diag * 0.6} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        minDistance={diag * 0.15}
        maxDistance={diag * 2.4}
        target={[0, 0, 0]}
        onChange={handleControlsChange}
      />
    </>
  );
}

// --- Main exported component -------------------------------------------------

export default function Track3D({
  detail, accentColor = '#e10600', height = 420, altitude, circuitId,
  sharedCameraRef, instanceId, animSpeed = 0, animPaused = false,
  canvasRef: externalCanvasRef,
}) {
  const { points } = detail;
  const internalCanvasRef = useRef();

  const camera = useMemo(() => {
    const xs = points.map((p) => p[0]);
    const zs = points.map((p) => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    const diag = Math.hypot(width, depth) || 1000;
    const fovDeg = 42;
    const radius = (diag / 2) * 1.25;
    const distance = radius / Math.sin((fovDeg / 2) * (Math.PI / 180));
    const dir = new THREE.Vector3(0.5, 0.8, 0.5).normalize().multiplyScalar(distance);
    return {
      position: [dir.x, dir.y, dir.z],
      fov: fovDeg,
      near: 1,
      far: distance * 20,
      distance,
    };
  }, [points]);

  return (
    <div className="track3d-canvas-wrap" ref={externalCanvasRef} style={{ height }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: camera.position, fov: camera.fov, near: camera.near, far: camera.far }}
      >
        <TrackScene
          detail={detail}
          accentColor={accentColor}
          altitude={altitude}
          circuitId={circuitId}
          sharedCameraRef={sharedCameraRef}
          instanceId={instanceId}
          animSpeed={animSpeed}
          animPaused={animPaused}
        />
      </Canvas>
    </div>
  );
}
