import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line, Grid, ContactShadows, Billboard } from '@react-three/drei';
import * as THREE from 'three';

// --- geometry helpers (pure three.js, no React state) -----------------

// For every point, offsets it left/right of the direction of travel by
// half the track width, producing the two edges of a ribbon.
function computeOffsetEdges(points, width) {
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
  return { left, right };
}

function buildRibbonGeometry(points, edges) {
  const { left, right } = edges;
  const n = points.length;
  const arr = [];

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const L0 = left[i];
    const R0 = right[i];
    const L1 = left[j];
    const R1 = right[j];
    arr.push(L0[0], 0, L0[2], R0[0], 0, R0[2], L1[0], 0, L1[2]);
    arr.push(R0[0], 0, R0[2], R1[0], 0, R1[2], L1[0], 0, L1[2]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
  geometry.computeVertexNormals();
  return geometry;
}

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

// --- scene pieces --------------------------------------------------------

function CornerMarker({ corner, poleHeight, accentColor }) {
  const [x, z] = corner.position;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, poleHeight / 2, 0]}>
        <cylinderGeometry args={[poleHeight * 0.012, poleHeight * 0.012, poleHeight, 6]} />
        <meshStandardMaterial color="#3a3a40" />
      </mesh>
      <mesh position={[0, poleHeight, 0]}>
        <sphereGeometry args={[poleHeight * 0.09, 12, 12]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.4} />
      </mesh>
      <Html position={[0, poleHeight * 1.18, 0]} center distanceFactor={poleHeight * 26} occlude={false}>
        <div className="corner-pill">T{corner.number}</div>
      </Html>
    </group>
  );
}

function StartFinishGantry({ points, trackWidth, poleHeight, checkerTexture }) {
  const start = points[0];
  const next = points[1] ?? points[points.length - 1];
  const dx = next[0] - start[0];
  const dz = next[1] - start[1];
  const heading = Math.atan2(dx, dz); // rotate plane so it spans across the track

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

function TrackScene({ detail, accentColor }) {
  const { points, corners } = detail;

  const bbox = useMemo(() => {
    const xs = points.map((p) => p[0]);
    const zs = points.map((p) => p[1]);
    return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs) };
  }, [points]);

  const diag = Math.hypot(bbox.width, bbox.depth) || 1000;
  const trackWidth = Math.min(Math.max(diag * 0.006, 40), 220);
  const poleHeight = Math.min(Math.max(diag * 0.02, 26), 90);

  const edges = useMemo(() => computeOffsetEdges(points, trackWidth), [points, trackWidth]);
  const ribbonGeometry = useMemo(() => buildRibbonGeometry(points, edges), [points, edges]);
  const checkerTexture = useMemo(() => makeCheckerTexture(), []);

  const leftLoop = useMemo(() => [...edges.left, edges.left[0]], [edges]);
  const rightLoop = useMemo(() => [...edges.right, edges.right[0]], [edges]);
  const centerLoop = useMemo(
    () => [...points.map(([x, z]) => [x, 0.08, z]), [points[0][0], 0.08, points[0][1]]],
    [points]
  );

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

      <StartFinishGantry points={points} trackWidth={trackWidth} poleHeight={poleHeight} checkerTexture={checkerTexture} />

      {corners.map((corner) => (
        <CornerMarker key={corner.index} corner={corner} poleHeight={poleHeight * 0.55} accentColor={accentColor} />
      ))}

      <Billboard position={[0, poleHeight * 1.6, 0]}>
        <Html center distanceFactor={poleHeight * 30} occlude={false}>
          <div className="track3d-name-pill">{corners.length} corners</div>
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
    </>
  );
}

export default function Track3D({ detail, accentColor = '#e10600', height = 420 }) {
  const { points } = detail;

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
    <div className="track3d-canvas-wrap" style={{ height }}>
      <Canvas dpr={[1, 2]} camera={{ position: camera.position, fov: camera.fov, near: camera.near, far: camera.far }}>
        <TrackScene detail={detail} accentColor={accentColor} />
        <OrbitControls
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
          minDistance={camera.distance * 0.35}
          maxDistance={camera.distance * 2.4}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
