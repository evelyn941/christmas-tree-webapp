import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SNOW_COUNT } from '../constants';

const Snow: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(SNOW_COUNT * 3);
    const vel = new Float32Array(SNOW_COUNT); // fall speed
    
    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20; // x spread
      pos[i * 3 + 1] = Math.random() * 15;      // y spread
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20; // z spread
      
      vel[i] = 0.02 + Math.random() * 0.05;
    }
    return { positions: pos, velocities: vel };
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const positionsAttr = pointsRef.current.geometry.attributes.position;
    const array = positionsAttr.array as Float32Array;

    for (let i = 0; i < SNOW_COUNT; i++) {
      const i3 = i * 3;
      array[i3 + 1] -= velocities[i];

      // Reset if below floor
      if (array[i3 + 1] < -5) {
        array[i3 + 1] = 10;
        array[i3] = (Math.random() - 0.5) * 20;
        array[i3 + 2] = (Math.random() - 0.5) * 20;
      }
    }
    positionsAttr.needsUpdate = true;
    pointsRef.current.rotation.y += 0.0005; // Gentle rotation of whole snow system
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={SNOW_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#FFFFFF"
        size={0.035}
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default Snow;