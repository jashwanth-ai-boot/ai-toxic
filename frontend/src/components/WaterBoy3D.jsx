import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function AnimatedBoy() {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    meshRef.current.rotation.y += delta * 0.8;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 2, 1]} />
      <meshStandardMaterial color="#3b82f6" />
    </mesh>
  );
}

export default function WaterBoy3D({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 p-6">
      <div className="relative h-[min(400px,70vw)] w-[min(400px,90vw)] overflow-hidden rounded-2xl bg-slate-900 shadow-2xl">
        <Canvas camera={{ position: [0, 0, 5] }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[2, 5, 2]} />
          <AnimatedBoy />
          <OrbitControls enableZoom={false} />
        </Canvas>
      </div>
      <p className="mt-4 text-lg font-semibold text-white">Time to Drink Water!</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-3 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
      >
        I Drank Water
      </button>
    </div>
  );
}
