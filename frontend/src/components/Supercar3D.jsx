import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Float, OrbitControls } from '@react-three/drei';

function Wheel({ position }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <torusGeometry args={[0.28, 0.1, 16, 32]} />
      <meshStandardMaterial color="#11191a" metalness={0.8} roughness={0.25} />
    </mesh>
  );
}

function SupercarModel() {
  const carRef = useRef();

  useFrame((state) => {
    if (!carRef.current) return;
    carRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.12 - 0.28;
  });

  return (
    <group ref={carRef} position={[0, -0.42, 0]} scale={1.28}>
      <mesh castShadow position={[0, 0.35, 0]}>
        <boxGeometry args={[2.7, 0.42, 1.15]} />
        <meshStandardMaterial color="#c9683e" metalness={0.75} roughness={0.2} />
      </mesh>
      <mesh castShadow position={[0.14, 0.7, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.35, 0.48, 0.98]} />
        <meshStandardMaterial color="#e37b47" metalness={0.7} roughness={0.18} />
      </mesh>
      <mesh position={[0.14, 0.73, 0]}>
        <boxGeometry args={[0.9, 0.3, 0.9]} />
        <meshStandardMaterial color="#173238" metalness={0.7} roughness={0.12} />
      </mesh>
      <mesh position={[0, 0.38, -0.59]}>
        <boxGeometry args={[1.8, 0.12, 0.04]} />
        <meshStandardMaterial color="#f3bd76" emissive="#d36c38" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 0.25, 0.59]}>
        <boxGeometry args={[1.45, 0.08, 0.04]} />
        <meshStandardMaterial color="#11191a" metalness={0.5} />
      </mesh>
      <Wheel position={[-0.85, 0.08, -0.57]} />
      <Wheel position={[0.85, 0.08, -0.57]} />
      <Wheel position={[-0.85, 0.08, 0.57]} />
      <Wheel position={[0.85, 0.08, 0.57]} />
      <mesh position={[0.75, 0.64, -0.58]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.42, 0.04, 0.2]} />
        <meshStandardMaterial color="#11191a" metalness={0.5} />
      </mesh>
      <mesh position={[-0.75, 0.64, -0.58]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.42, 0.04, 0.2]} />
        <meshStandardMaterial color="#11191a" metalness={0.5} />
      </mesh>
    </group>
  );
}

export default function Supercar3D() {
  return (
    <div className="supercar-stage" aria-label="Interactive 3D supercar">
      <Canvas shadows camera={{ position: [3.6, 1.7, 4.5], fov: 34 }}>
        <ambientLight intensity={1.2} />
        <spotLight position={[3, 5, 4]} intensity={40} angle={0.35} penumbra={1} castShadow color="#ffd4a5" />
        <pointLight position={[-3, 1, -2]} intensity={18} color="#8ed7b0" />
        <Environment preset="city" />
        <Float speed={1.4} rotationIntensity={0.12} floatIntensity={0.2}>
          <SupercarModel />
        </Float>
        <ContactShadows position={[0, -0.8, 0]} opacity={0.55} scale={5} blur={2.4} far={3} />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 2.7} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <div className="supercar-caption"><span>TOXIC GT</span><small>DESIGNED FOR MOMENTUM</small></div>
    </div>
  );
}
