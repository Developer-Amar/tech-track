"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Shield, Compass, MapPin, Code2, Trophy } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ═══════════════════════════════════════════
   TIMELINE DATA
   ═══════════════════════════════════════════ */
const TIMELINE_NODES = [
  {
    step: "01",
    title: "ASSEMBLE YOUR SQUAD",
    subtitle: "REGISTRATION PHASE",
    description:
      "Form a team of elite coders or brave the trek solo. Lock in your roster before the gates close. Your unit is your lifeline.",
    glowColor: "#4B0082",
    icon: Shield,
  },
  {
    step: "02",
    title: "DECODE THE SIGNAL",
    subtitle: "RIDDLE PHASE",
    description:
      "Each round begins with a cryptic riddle. Crack the logic, decode the clue, and reveal the coordinates of your next destination.",
    glowColor: "#7DF9FF",
    icon: Compass,
  },
  {
    step: "03",
    title: "TREK ACROSS CAMPUS",
    subtitle: "CHECKPOINT PHASE",
    description:
      "Navigate to the physical location on campus. Find the outpost. Get verified by staff with a secure access code to prove you were there.",
    glowColor: "#7DF9FF",
    icon: MapPin,
  },
  {
    step: "04",
    title: "DEPLOY YOUR CODE",
    subtitle: "CODING PHASE",
    description:
      "Enter the proctored IDE terminal. Solve the coding challenge under live surveillance. Tab switches are monitored. Clipboard is blocked. Write clean code under pressure.",
    glowColor: "#EF4444",
    icon: Code2,
  },
  {
    step: "05",
    title: "ASCEND OR FALL",
    subtitle: "FINAL PROGRESSION",
    description:
      "Complete all rounds to reach the summit. The leaderboard updates in real-time. Every second counts. Only the fastest and smartest survive.",
    glowColor: "#7DF9FF",
    icon: Trophy,
  },
];

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

/** Returns 0→1→0 visibility curve for a node based on overall scroll progress */
function getNodeVisibility(
  progress: number,
  index: number,
  total: number
): number {
  const segmentSize = 1 / total;
  const nodeCenter = (index + 0.5) * segmentSize;
  const halfWindow = segmentSize * 0.55;
  const distance = Math.abs(progress - nodeCenter);
  if (distance > halfWindow) return 0;
  // Smooth ease-in-out curve
  const raw = 1 - distance / halfWindow;
  return raw * raw * (3 - 2 * raw); // smoothstep
}

/* ═══════════════════════════════════════════
   3D COMPONENTS
   ═══════════════════════════════════════════ */

/** Floating icosahedron node in 3D space with zero-gravity sway & magnetic cursor pull */
function FloatingNode({
  basePos,
  color,
  index,
  mousePos,
}: {
  basePos: [number, number, number];
  color: string;
  index: number;
  mousePos: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    // Zero-gravity floating sway
    const swayX = Math.sin(t * 0.35 + index * 1.7) * 0.6;
    const swayY = Math.sin(t * 0.45 + index * 2.3) * 0.5;
    const swayZ = Math.sin(t * 0.25 + index * 1.1) * 0.4;

    // Magnetic pull toward cursor (normalized -1 to 1)
    const pullX = (mousePos.current.x - 0.5) * 2;
    const pullY = -(mousePos.current.y - 0.5) * 2;
    const magnetStrength = 0.4;

    meshRef.current.position.x =
      basePos[0] + swayX + pullX * magnetStrength;
    meshRef.current.position.y =
      basePos[1] + swayY + pullY * magnetStrength;
    meshRef.current.position.z = basePos[2] + swayZ;

    // Slow organic rotation
    meshRef.current.rotation.x = t * 0.12 + index;
    meshRef.current.rotation.y = t * 0.18 + index * 0.7;
    meshRef.current.rotation.z = t * 0.08 + index * 0.3;

    // Sync glow sphere
    if (glowRef.current) {
      glowRef.current.position.copy(meshRef.current.position);
      // Pulsing glow
      const pulse = 0.8 + Math.sin(t * 2 + index * 1.5) * 0.2;
      glowRef.current.scale.setScalar(1.8 * pulse);
    }
  });

  return (
    <>
      {/* Wireframe icosahedron */}
      <mesh ref={meshRef} position={basePos}>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial
          color={color}
          wireframe
          transparent
          opacity={0.7}
          emissive={color}
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Glow halo */}
      <mesh ref={glowRef} position={basePos}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  );
}

/** Camera rig: Z-axis forward flight driven by scroll progress */
function CameraRig({ progress }: { progress: number }) {
  const { camera } = useThree();
  const targetZ = useRef(25);

  useFrame(() => {
    // Map scroll progress (0→1) to camera Z (25 → -35)
    targetZ.current = 25 - progress * 60;
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      targetZ.current,
      0.08
    );

    // Subtle organic camera sway
    const t = performance.now() * 0.001;
    camera.position.x = Math.sin(t * 0.25) * 0.25;
    camera.position.y = Math.cos(t * 0.18) * 0.18;

    camera.lookAt(0, 0, camera.position.z - 15);
  });

  return null;
}

/** The full 3D scene rendered inside the Canvas */
function TimelineScene({
  progress,
  mousePos,
}: {
  progress: number;
  mousePos: React.MutableRefObject<{ x: number; y: number }>;
}) {
  // Node positions spread along Z-axis for camera fly-through
  const nodePositions: [number, number, number][] = useMemo(
    () => [
      [-2.5, 1.2, 12],
      [3.0, -0.8, -1],
      [-1.5, 1.5, -14],
      [2.5, -0.3, -27],
      [0.0, 0.8, -40],
    ],
    []
  );

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight
        position={[15, 10, 10]}
        intensity={0.6}
        color="#7DF9FF"
        distance={80}
      />
      <pointLight
        position={[-15, -8, -20]}
        intensity={0.4}
        color="#4B0082"
        distance={80}
      />

      <Stars
        radius={200}
        depth={120}
        count={1500}
        factor={5}
        saturation={0}
        fade
        speed={0.3}
      />

      {TIMELINE_NODES.map((node, i) => (
        <FloatingNode
          key={i}
          basePos={nodePositions[i]}
          color={node.glowColor}
          index={i}
          mousePos={mousePos}
        />
      ))}

      <CameraRig progress={progress} />
    </>
  );
}

/* ═══════════════════════════════════════════
   DOM OVERLAY COMPONENTS
   ═══════════════════════════════════════════ */

/** Glassmorphic card that emerges from depth as the camera approaches its node */
function TimelineCard({
  node,
  visibility,
}: {
  node: (typeof TIMELINE_NODES)[0];
  visibility: number;
}) {
  const Icon = node.icon;
  const cardRef = useRef<HTMLDivElement>(null);
  const [glintPos, setGlintPos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      setGlintPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    []
  );

  if (visibility <= 0.02) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
      style={{
        opacity: visibility,
        transform: `scale(${0.75 + visibility * 0.25})`,
      }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative overflow-hidden rounded-2xl max-w-lg w-full mx-6 pointer-events-auto hud-corner-card"
        style={{
          background: "rgba(10, 10, 15, 0.7)",
          border: `1px solid ${node.glowColor}25`,
          backdropFilter: "blur(30px)",
          boxShadow: `0 20px 60px -15px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05), 0 0 80px ${node.glowColor}08`,
        }}
      >
        {/* Mouse-tracking edge glint */}
        {isHovered && (
          <div
            className="pointer-events-none absolute -inset-px z-0 transition-opacity duration-200"
            style={{
              background: `radial-gradient(350px circle at ${glintPos.x}px ${glintPos.y}px, ${node.glowColor}35, transparent 40%)`,
              opacity: 0.7,
            }}
          />
        )}

        {/* Large step watermark */}
        <div
          className="absolute top-3 right-5 font-display text-[130px] font-extrabold leading-none pointer-events-none select-none"
          style={{ color: `${node.glowColor}08` }}
        >
          {node.step}
        </div>

        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow: `inset 0 0 40px ${node.glowColor}08`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 p-8 md:p-10">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{
                backgroundColor: `${node.glowColor}12`,
                border: `1px solid ${node.glowColor}35`,
                boxShadow: `0 0 15px ${node.glowColor}15`,
              }}
            >
              <Icon className="w-5 h-5" style={{ color: node.glowColor }} />
            </div>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.2em] font-semibold"
              style={{ color: node.glowColor }}
            >
              {node.subtitle}
            </span>
          </div>

          <h3 className="font-display text-2xl md:text-3xl font-extrabold text-white uppercase tracking-tight mb-4 leading-tight">
            {node.title}
          </h3>

          <p className="text-[#94A3B8] text-sm md:text-base font-body leading-relaxed">
            {node.description}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Dot-style progress indicator showing which node is active */
function ScrollProgress({ progress }: { progress: number }) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
      <div className="flex items-center gap-2.5">
        {TIMELINE_NODES.map((_, i) => {
          const nodeCenter = (i + 0.5) / TIMELINE_NODES.length;
          const isActive = Math.abs(progress - nodeCenter) < 0.12;
          return (
            <div
              key={i}
              className="rounded-full transition-all duration-500"
              style={{
                width: isActive ? "28px" : "8px",
                height: "8px",
                backgroundColor: isActive ? "#7DF9FF" : "rgba(255,255,255,0.15)",
                boxShadow: isActive
                  ? "0 0 12px #7DF9FF, 0 0 25px rgba(125,249,255,0.3)"
                  : "none",
              }}
            />
          );
        })}
      </div>
      <span className="font-mono text-[9px] text-[#94A3B8] uppercase tracking-[0.25em] opacity-60">
        SCROLL TO EXPLORE
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function ScrollTimeline() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const mousePos = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (!sectionRef.current) return;

    // GSAP ScrollTrigger with scrub — driven by Lenis via client-layout sync
    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.5,
      onUpdate: (self) => {
        setProgress(self.progress);
      },
    });

    return () => {
      trigger.kill();
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePos.current = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: "500vh" }}
      onMouseMove={handleMouseMove}
    >
      {/* Pinned viewport — sticky keeps it in view while the 500vh section scrolls */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Section identifier */}
        <div className="absolute top-6 left-6 z-30 pointer-events-none">
          <span className="font-mono text-[10px] text-[#94A3B8] uppercase tracking-[0.2em]">
            [ MISSION PROTOCOL ]
          </span>
        </div>

        {/* 3D WebGL Canvas — Camera flies forward on Z-axis */}
        <Canvas
          camera={{ position: [0, 0, 25], fov: 55 }}
          gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
          className="!absolute inset-0"
          style={{ position: "absolute" }}
        >
          <color attach="background" args={["#000000"]} />
          <fog attach="fog" args={["#000000", 30, 70]} />
          <TimelineScene progress={progress} mousePos={mousePos} />
        </Canvas>

        {/* DOM Card Overlays — emerge from depth into focus */}
        {TIMELINE_NODES.map((node, i) => (
          <TimelineCard
            key={i}
            node={node}
            visibility={getNodeVisibility(progress, i, TIMELINE_NODES.length)}
          />
        ))}

        {/* Progress indicator */}
        <ScrollProgress progress={progress} />
      </div>
    </section>
  );
}
