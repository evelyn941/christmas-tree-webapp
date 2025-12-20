
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleMode, InstaxPhoto, GestureType } from '../types';

interface InstaxGalleryProps {
  photos: InstaxPhoto[];
  mode: ParticleMode;
  onPhotoClick: (id: number) => void;
  gesture: GestureType;
  handPos: { x: number, y: number };
  handSize: number;
  activeFocusId: number | null;
  isIntro: boolean;
}

const BASE_RADIUS = 7.0; 
const BASE_PHOTO_SCALE = 1.0;
const FOCUS_SCALE_BOOST = 1.15;
const GALLERY_Z_OFFSET = 0;
const GALLERY_Y_OFFSET = 1.0;
const CLUSTER_HEIGHT_SCALE = 0.85;
const CLUSTER_LIFT_Y = 2.0;

const getClusterLayout = (id: number, total: number) => {
    const phi = Math.PI * (3 - Math.sqrt(5)); 
    const y_norm = 1 - (id / (total - 1 || 1)) * 2; 
    const radius_at_y = Math.sqrt(1 - y_norm * y_norm);
    const theta = phi * id;
    const r = BASE_RADIUS + (Math.sin(id * 12.9898) * 0.8);
    const x = Math.cos(theta) * radius_at_y * r;
    const z = Math.sin(theta) * radius_at_y * r;
    const y = y_norm * r * CLUSTER_HEIGHT_SCALE;
    return new THREE.Vector3(x, y, z);
};

const InstaxFrame: React.FC<{
  photo: InstaxPhoto;
  totalPhotos: number;
  mode: ParticleMode;
  globalRotation: number;
  scrollRotation: number;
  scrollPitch: number;
  swaySpeed: {x:number, y:number, z:number};
  handPos: { x: number, y: number };
  handSize: number;
  isFocus: boolean;
  onClick: (id: number) => void;
  isIntro: boolean;
}> = ({ photo, totalPhotos, mode, globalRotation, scrollRotation, scrollPitch, swaySpeed, handPos, handSize, isFocus, onClick, isIntro }) => {
  const meshRef = useRef<THREE.Group>(null);
  const frameMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const texture = useMemo(() => new THREE.TextureLoader().load(photo.url), [photo.url]);
  const { camera } = useThree();
  const introTimer = useRef(0);
  
  const physics = useMemo(() => ({ phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 0.5 }), []);
  const clusterPos = useMemo(() => getClusterLayout(photo.id, totalPhotos), [photo.id, totalPhotos]);
  
  // Normalized height 0..1 (0 bottom, 1 top)
  const relY = (photo.position[1] - (-1.5)) / 7.0;

  const treeParams = useMemo(() => {
     const radius = Math.hypot(photo.position[0], photo.position[2]);
     const angle = Math.atan2(photo.position[2], photo.position[0]);
     return { radius, angle, y: photo.position[1] };
  }, [photo.position]);

  useEffect(() => {
      if (meshRef.current) {
          // Photos start far back and invisible during intro
          meshRef.current.position.set(photo.position[0], photo.position[1], 20);
          meshRef.current.scale.set(0, 0, 0);
      }
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    introTimer.current += delta;
    
    // Top-to-bottom sequence delay
    // relY=1 (top) starts at 0.5s, relY=0 (bottom) starts at 3.5s
    const startDelay = (1.0 - relY) * 3.0 + 0.5;
    const appearanceProgress = Math.min(1, Math.max(0, (introTimer.current - startDelay) * 1.5));

    const isScatter = mode === 'SCATTER';
    let targetX, targetY, targetZ, targetScale, targetRot = new THREE.Euler(0, 0, 0);

    if (mode === 'HEART') {
        const isRight = clusterPos.x >= 0;
        targetX = clusterPos.x + (isRight ? 18.0 : -18.0);
        targetY = clusterPos.y + GALLERY_Y_OFFSET;
        targetZ = clusterPos.z;
        targetScale = BASE_PHOTO_SCALE;
        meshRef.current.lookAt(camera.position);
        targetRot.copy(meshRef.current.rotation);
    } else if (isScatter) {
        const cosYaw = Math.cos(scrollRotation), sinYaw = Math.sin(scrollRotation), cosPitch = Math.cos(scrollPitch), sinPitch = Math.sin(scrollPitch);
        const yawX = clusterPos.x * cosYaw - clusterPos.z * sinYaw, yawY = clusterPos.y, yawZ = clusterPos.x * sinYaw + clusterPos.z * cosYaw;
        const rotX = yawX, rotY = yawY * cosPitch - yawZ * sinPitch, rotZ = yawY * sinPitch + yawZ * cosPitch;
        const zFactor = THREE.MathUtils.smoothstep(rotZ, 3.0, 12.0), centerStrength = zFactor * 0.85; 
        const interactDamp = 1.0 - (zFactor * 0.5), interactX = ((handPos.x - 0.5) * 8.0) * interactDamp, interactY = (-(handPos.y - 0.5) * 4.0) * interactDamp;
        targetX = rotX * (1 - centerStrength) + Math.cos(time * 0.5 + physics.phase) * 0.15 + interactX;
        targetY = rotY * (1 - centerStrength) + Math.sin(time * 0.8 + physics.phase) * 0.3 + interactY + zFactor * CLUSTER_LIFT_Y + GALLERY_Y_OFFSET;
        targetZ = rotZ + GALLERY_Z_OFFSET; 
        targetScale = BASE_PHOTO_SCALE * (1.0 + (zFactor * FOCUS_SCALE_BOOST));
        meshRef.current.lookAt(camera.position);
        targetRot.copy(meshRef.current.rotation);
    } else {
        const currentAngle = treeParams.angle + globalRotation;
        targetX = Math.cos(currentAngle) * (treeParams.radius + Math.sin(time * 0.5 + photo.id) * 0.05);
        targetZ = Math.sin(currentAngle) * (treeParams.radius + Math.sin(time * 0.5 + photo.id) * 0.05);
        targetY = treeParams.y + Math.sin(time + photo.id) * 0.15;
        targetScale = 0.38;
        meshRef.current.lookAt(camera.position);
        targetRot.copy(meshRef.current.rotation);
    }

    const lerpSpeed = isIntro ? 0.03 : 0.05;
    
    if (introTimer.current > startDelay || !isIntro) {
        meshRef.current.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), lerpSpeed);
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpSpeed);
        meshRef.current.quaternion.slerp(new THREE.Quaternion().setFromEuler(targetRot), lerpSpeed);
    }

    if (frameMaterialRef.current) {
        const targetMetal = isScatter && isFocus ? 0.20 : 0.35;
        frameMaterialRef.current.metalness = THREE.MathUtils.lerp(frameMaterialRef.current.metalness, targetMetal, 0.05);
        
        // Sequential Opacity Control
        if (isIntro) {
            frameMaterialRef.current.opacity = appearanceProgress;
            frameMaterialRef.current.transparent = true;
        } else {
            frameMaterialRef.current.opacity = 1.0;
            frameMaterialRef.current.transparent = false;
        }
    }
  });

  return (
    <group ref={meshRef} onClick={(e) => { e.stopPropagation(); onClick(photo.id); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.1, 1.4, 0.04]} />
        <meshStandardMaterial 
          ref={frameMaterialRef} 
          color="#ffffff" 
          roughness={0.4} 
          metalness={0.0}
          emissive="#000000" 
          transparent={isIntro} 
        />
      </mesh>
      <mesh position={[0, 0.1, 0.026]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial map={texture} transparent={isIntro} />
      </mesh>
      <mesh position={[0, 0, -0.026]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.05, 1.35]} />
        <meshStandardMaterial color="#222" roughness={0.9} transparent={isIntro} />
      </mesh>
    </group>
  );
};

const InstaxGallery: React.FC<InstaxGalleryProps> = ({ photos, mode, onPhotoClick, gesture, handPos, handSize, activeFocusId, isIntro }) => {
  const rotationRef = useRef(0), scrollRotationRef = useRef(0), scrollPitchRef = useRef(0), momentumRef = useRef(0), lastXRef = useRef(0.5);
  const swaySpeeds = useMemo(() => photos.map(() => ({ x: 0.5 + Math.random() * 0.5, y: 0.5 + Math.random() * 0.5, z: 0.3 + Math.random() * 0.4 })), [photos.length]);

  useFrame((state, delta) => {
      if (mode === 'TREE' || isIntro) {
          if (gesture === GestureType.FIST) { const dx = handPos.x - lastXRef.current; if (Math.abs(dx) > 0.001) momentumRef.current += dx * 35.0; lastXRef.current = handPos.x; } else lastXRef.current = handPos.x;
          momentumRef.current *= 0.92; rotationRef.current += (0.25 + momentumRef.current) * delta;
      } else if (mode === 'SCATTER') {
          const centerThreshold = 0.15, valX = handPos.x - 0.5, valY = handPos.y - 0.5;
          if (Math.abs(valX) > centerThreshold) scrollRotationRef.current += Math.pow((Math.abs(valX) - centerThreshold) / (0.5 - centerThreshold), 2.0) * 0.5 * -(valX > 0 ? 1 : -1) * delta;
          if (Math.abs(valY) > centerThreshold) scrollPitchRef.current += Math.pow((Math.abs(valY) - centerThreshold) / (0.5 - centerThreshold), 2.0) * 0.5 * -(valY > 0 ? 1 : -1) * delta;
      }
  });

  return (
    <group>
      {photos.map((photo, i) => (
        <InstaxFrame key={photo.id} photo={photo} totalPhotos={photos.length} mode={mode} globalRotation={rotationRef.current} scrollRotation={scrollRotationRef.current} scrollPitch={scrollPitchRef.current} swaySpeed={swaySpeeds[i] || {x:1, y:1, z:1}} handPos={handPos} handSize={handSize} isFocus={activeFocusId === photo.id} onClick={onPhotoClick} isIntro={isIntro} />
      ))}
    </group>
  );
};

export default InstaxGallery;
