"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Float, Sphere, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function AnimatedSphere() {
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (sphereRef.current) {
      sphereRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      sphereRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={1} floatIntensity={2}>
      <Sphere ref={sphereRef} args={[1, 64, 64]} scale={1.5}>
        <MeshDistortMaterial
          color="#4B0082"
          attach="material"
          distort={0.4}
          speed={2}
          roughness={0.2}
          metalness={0.8}
          transparent
          opacity={0.3}
        />
      </Sphere>
    </Float>
  );
}

export default function WebGLBackground() {
  return (
    <div className="fixed inset-0 z-[-1] bg-[#000000] overflow-hidden pointer-events-none">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} gl={{ alpha: false, antialias: true }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} color="#7DF9FF" />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#4B0082" />
        
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
        
        <group position={[-2, 1, -2]}>
          <AnimatedSphere />
        </group>
        
        <group position={[3, -2, -5]} scale={1.5}>
          <Float speed={1} rotationIntensity={2} floatIntensity={1.5}>
            <Sphere args={[1, 64, 64]} scale={1.2}>
              <MeshDistortMaterial
                color="#7DF9FF"
                attach="material"
                distort={0.5}
                speed={1.5}
                roughness={0.4}
                metalness={0.6}
                transparent
                opacity={0.15}
              />
            </Sphere>
          </Float>
        </group>
      </Canvas>
    </div>
  );
}
