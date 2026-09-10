"use client";

import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Float, Sphere, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function AnimatedSphere({ isVisible }: { isVisible: boolean }) {
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!isVisible) return;
    if (sphereRef.current) {
      sphereRef.current.rotation.x = state.clock.elapsedTime * 0.15;
      sphereRef.current.rotation.y = state.clock.elapsedTime * 0.25;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.8} floatIntensity={1.5}>
      <Sphere ref={sphereRef} args={[1, 32, 32]} scale={1.4}>
        <MeshDistortMaterial
          color="#A855F7"
          attach="material"
          distort={0.35}
          speed={1.8}
          roughness={0.25}
          metalness={0.75}
          transparent
          opacity={0.25}
        />
      </Sphere>
    </Float>
  );
}

export default function WebGLBackground() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] bg-[#000000] overflow-hidden pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: false,
          antialias: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.9} color="#00E5FF" />
        <directionalLight position={[-10, -10, -5]} intensity={0.4} color="#A855F7" />

        <Stars radius={80} depth={40} count={1800} factor={3} saturation={0} fade speed={0.8} />

        <group position={[-2, 1, -2]}>
          <AnimatedSphere isVisible={isVisible} />
        </group>

        <group position={[3, -2, -5]} scale={1.4}>
          <Float speed={0.8} rotationIntensity={1.5} floatIntensity={1.2}>
            <Sphere args={[1, 32, 32]} scale={1.1}>
              <MeshDistortMaterial
                color="#00E5FF"
                attach="material"
                distort={0.4}
                speed={1.2}
                roughness={0.4}
                metalness={0.6}
                transparent
                opacity={0.12}
              />
            </Sphere>
          </Float>
        </group>
      </Canvas>
    </div>
  );
}
