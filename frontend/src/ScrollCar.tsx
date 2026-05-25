// A small low-poly car rendered with three.js / react-three-fiber, used as the
// scroll-progress marker on the section rail. Built from primitives (no glTF to
// source/ship), brand-coloured, transparent canvas. `frameloop="demand"` + a
// scroll-driven invalidate means it only renders while the user scrolls, so it
// costs nothing at rest. Lazy-loaded by ScrollRail (desktop + motion only).

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const WHEELS: [number, number, number][] = [
  [-0.62, -0.12, 0.42],
  [0.62, -0.12, 0.42],
  [-0.62, -0.12, -0.42],
  [0.62, -0.12, -0.42],
];

function Car() {
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const { invalidate } = useThree();
  const prog = useRef(0);
  const last = useRef(0);

  // Track scroll progress; invalidate so the demand loop renders this frame.
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      prog.current = max > 0 ? window.scrollY / max : 0;
      invalidate();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [invalidate]);

  useFrame(() => {
    const d = prog.current - last.current;
    last.current = prog.current;
    const spin = d * 42; // wheel roll proportional to scroll delta
    for (const g of wheelRefs.current) if (g) g.rotation.z -= spin;
  });

  return (
    <group rotation={[0, -0.35, 0]}>
      {/* body */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[2.1, 0.5, 0.92]} />
        <meshStandardMaterial color="#b8312e" roughness={0.45} metalness={0.15} />
      </mesh>
      {/* cabin */}
      <mesh position={[0.05, 0.52, 0]}>
        <boxGeometry args={[1.1, 0.44, 0.82]} />
        <meshStandardMaterial color="#8a1d1c" roughness={0.5} />
      </mesh>
      {/* wheels (each a dark cylinder + light spoke so the spin reads) */}
      {WHEELS.map((p, i) => (
        <group key={i} position={p} ref={(el) => { wheelRefs.current[i] = el; }}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.2, 22]} />
            <meshStandardMaterial color="#18130a" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.105]}>
            <boxGeometry args={[0.5, 0.09, 0.02]} />
            <meshStandardMaterial color="#f7f0df" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function ScrollCar() {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ position: [2.1, 1.35, 3.4], fov: 30 }}
      gl={{ alpha: true, antialias: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 5, 4]} intensity={1.15} />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} />
      <Car />
    </Canvas>
  );
}
