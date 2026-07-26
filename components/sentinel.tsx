"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */
export type SentinelState = {
  mode: "idle" | "focused" | "typing" | "submitting" | "success" | "error";
  focusedField: string | null;
  filledCount: number;
  keystrokeId: number;
};

const PARTICLE_COUNT = 60;

/* ═══════════════════════════════════════════
   OUTER SHELL — Wireframe Icosahedron
   The sentinel's protective shield. Spins
   faster as more fields are verified.
   ═══════════════════════════════════════════ */
function OuterShell({ state }: { state: SentinelState }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const speed =
      state.mode === "focused" || state.mode === "typing" ? 2 : 1;
    const energy = 1 + state.filledCount * 0.25;
    ref.current.rotation.y += delta * 0.12 * speed * energy;
    ref.current.rotation.x += delta * 0.06 * speed;
  });

  const intensity = 0.08 + state.filledCount * 0.04;

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[2.2, 1]} />
      <meshStandardMaterial
        wireframe
        transparent
        opacity={0.12 + state.filledCount * 0.03}
        color="#7DF9FF"
        emissive="#7DF9FF"
        emissiveIntensity={intensity}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════
   MIDDLE SHELL — Counter-rotating Octahedron
   The sentinel's processor core. Counter-rotates
   and accelerates during typing.
   ═══════════════════════════════════════════ */
function MiddleShell({ state }: { state: SentinelState }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const speed = state.mode === "typing" ? 2.5 : 1;
    const energy = 1 + state.filledCount * 0.3;
    ref.current.rotation.y -= delta * 0.18 * speed * energy;
    ref.current.rotation.z += delta * 0.1;
    ref.current.rotation.x += delta * 0.05;
  });

  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[1.5, 0]} />
      <meshStandardMaterial
        wireframe
        transparent
        opacity={0.18 + state.filledCount * 0.03}
        color="#4B0082"
        emissive="#4B0082"
        emissiveIntensity={0.15 + state.filledCount * 0.05}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════
   INNER CORE — Glowing Eye Sphere
   The sentinel's consciousness. Tracks cursor
   on idle, locks toward the form on focus,
   and pulses on every keystroke.
   ═══════════════════════════════════════════ */
function InnerCore({
  state,
  mousePos,
}: {
  state: SentinelState;
  mousePos: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const pulseScale = useRef(1);
  const lastKeystrokeId = useRef(state.keystrokeId);

  useFrame(() => {
    if (!ref.current) return;

    // ── Gaze direction ──
    let targetX: number;
    let targetY: number;

    if (state.mode === "focused" || state.mode === "typing") {
      // Lock toward the right side (toward the form panel)
      targetX = 0.6;
      targetY = 0;
    } else if (state.mode === "submitting") {
      // Center focus
      targetX = 0;
      targetY = 0;
    } else {
      // Follow the cursor
      targetX = (mousePos.current.x - 0.5) * 2;
      targetY = -(mousePos.current.y - 0.5) * 2;
    }

    ref.current.position.x = THREE.MathUtils.lerp(
      ref.current.position.x,
      targetX,
      0.04
    );
    ref.current.position.y = THREE.MathUtils.lerp(
      ref.current.position.y,
      targetY,
      0.04
    );

    // ── Keystroke pulse: brief scale spike on each keypress ──
    if (state.keystrokeId !== lastKeystrokeId.current) {
      pulseScale.current = 1.4;
      lastKeystrokeId.current = state.keystrokeId;
    }
    pulseScale.current = THREE.MathUtils.lerp(pulseScale.current, 1, 0.08);
    ref.current.scale.setScalar(pulseScale.current);

    // ── Submitting: spiral inward ──
    if (state.mode === "submitting") {
      ref.current.rotation.z += 0.08;
    }

    // ── Sync glow halo position & scale ──
    if (glowRef.current) {
      glowRef.current.position.copy(ref.current.position);
      glowRef.current.scale.setScalar(pulseScale.current * 2.5);
    }
  });

  const isError = state.mode === "error";
  const isSuccess = state.mode === "success";
  const color = isError ? "#EF4444" : isSuccess ? "#22C55E" : "#7DF9FF";
  const emissiveIntensity = 0.4 + state.filledCount * 0.15;

  return (
    <>
      {/* Core sphere */}
      <mesh ref={ref}>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </mesh>
      {/* Atmospheric glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.04 + state.filledCount * 0.015}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  );
}

/* ═══════════════════════════════════════════
   PARTICLE RING — Orbiting Data Particles
   60 particles orbiting the sentinel. They
   accelerate with energy, pulse on keystrokes,
   converge on submit, explode on success,
   and scatter on error.
   ═══════════════════════════════════════════ */
function ParticleRing({ state }: { state: SentinelState }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const modeStartTime = useRef(0);
  const prevMode = useRef(state.mode);
  const lastKeystrokeId = useRef(state.keystrokeId);
  const pulse = useRef(0);

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        angle: (i / PARTICLE_COUNT) * Math.PI * 2,
        radius: 2.8 + (Math.random() - 0.5) * 0.5,
        speed: 0.15 + Math.random() * 0.15,
        yOff: (Math.random() - 0.5) * 0.5,
        phase: Math.random() * Math.PI * 2,
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;

    // Track mode transitions for time-based animations
    if (state.mode !== prevMode.current) {
      modeStartTime.current = t;
      prevMode.current = state.mode;
    }
    const elapsed = t - modeStartTime.current;

    // Keystroke expansion pulse
    if (state.keystrokeId !== lastKeystrokeId.current) {
      pulse.current = 0.6;
      lastKeystrokeId.current = state.keystrokeId;
    }
    pulse.current *= 0.94;

    // Energy scales with filled fields
    const energy = 1 + state.filledCount * 0.4;

    particles.forEach((p, i) => {
      let angle = p.angle + t * p.speed * energy;
      let radius = p.radius + pulse.current;
      let y = p.yOff + Math.sin(t * 0.4 + p.phase) * 0.15;
      let scale = 0.035 + state.filledCount * 0.006;

      // Submitting: converge to center over ~2 seconds
      if (state.mode === "submitting") {
        const factor = Math.min(1, elapsed * 0.6);
        radius *= 1 - factor * 0.92;
        scale *= 1 + factor * 0.5;
      }

      // Success: explode outward and fade
      if (state.mode === "success") {
        radius += elapsed * 4;
        scale *= Math.max(0.001, 1 - elapsed * 0.6);
      }

      // Error: chaotic scatter
      if (state.mode === "error") {
        radius += Math.sin(t * 7 + i * 3) * 0.6;
        y += Math.cos(t * 5 + i * 2) * 0.5;
      }

      dummy.position.set(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      );
      dummy.scale.setScalar(Math.max(0.001, scale));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const color =
    state.mode === "error"
      ? "#EF4444"
      : state.mode === "success"
      ? "#22C55E"
      : "#7DF9FF";

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </instancedMesh>
  );
}

/* ═══════════════════════════════════════════
   SENTINEL ENTITY — Groups all sub-components.
   Handles global shake (error) and float.
   ═══════════════════════════════════════════ */
function SentinelEntity({
  state,
  mousePos,
}: {
  state: SentinelState;
  mousePos: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const shakeIntensity = useRef(0);
  const prevMode = useRef(state.mode);

  useFrame(() => {
    if (!groupRef.current) return;

    // Trigger shake on error transition
    if (state.mode === "error" && prevMode.current !== "error") {
      shakeIntensity.current = 0.4;
    }
    prevMode.current = state.mode;

    // Apply and decay X-axis shake
    if (shakeIntensity.current > 0.005) {
      groupRef.current.position.x =
        Math.sin(performance.now() * 0.04) * shakeIntensity.current;
      shakeIntensity.current *= 0.93;
    } else {
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        0,
        0.1
      );
    }

    // Gentle zero-gravity float
    const t = performance.now() * 0.001;
    groupRef.current.position.y = Math.sin(t * 0.4) * 0.15;
  });

  return (
    <group ref={groupRef}>
      <OuterShell state={state} />
      <MiddleShell state={state} />
      <InnerCore state={state} mousePos={mousePos} />
      <ParticleRing state={state} />
    </group>
  );
}

/* ═══════════════════════════════════════════
   MAIN EXPORT — SentinelCanvas
   Renders the full 3D sentinel scene.
   Transparent background so the site's WebGL
   starfield shows through.
   ═══════════════════════════════════════════ */
export default function SentinelCanvas({
  state,
}: {
  state: SentinelState;
}) {
  const mousePos = useRef({ x: 0.5, y: 0.5 });

  return (
    <div
      className="w-full h-full"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mousePos.current = {
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        };
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.25} />
        <pointLight
          position={[8, 5, 8]}
          intensity={0.5}
          color="#7DF9FF"
          distance={30}
        />
        <pointLight
          position={[-8, -5, -5]}
          intensity={0.3}
          color="#4B0082"
          distance={25}
        />
        <SentinelEntity state={state} mousePos={mousePos} />
      </Canvas>
    </div>
  );
}
