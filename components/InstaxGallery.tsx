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
  isIntro?: boolean;
}

const BASE_RADIUS = 7.0; 
const BASE_PHOTO_SCALE = 1.0;   
const FOCUS_SCALE_BOOST = 1.15;  
const GALLERY_Z_OFFSET = 0;     
const GALLERY_Y_OFFSET = 1.0;   
const CLUSTER_HEIGHT_SCALE = 0.85; 
const CLUSTER_LIFT_Y = 2.0;       

const COLOR_WHITE = new THREE.Color('#ffffff');
const COLOR_BLUE = new THREE.Color('#6abce2');
// Increased emissive color from #222222 to #888888 for a much brighter "white paper" appearance
const COLOR_OFF_WHITE_EMISSIVE = new THREE.Color('#888888'); 

const getClusterLayout = (id: number, total: number) => {
    const phi = Math.PI * (3 - Math.sqrt(5)); 
    const y_norm = 1 - (id / (total - 1 || 1)) * 2; 
    const radius_at_y = Math.sqrt(1 - y_norm * y_norm);
    const theta = phi * id;
    const DEPTH_VARIATION = 0.8; 
    const rVar = (Math.sin(id * 12.9898) * DEPTH_VARIATION);
    const r = BASE_RADIUS + rVar;
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
  isIntro?: boolean;
  introTimer: number;
}> = ({ photo, totalPhotos, mode, globalRotation, scrollRotation, scrollPitch, swaySpeed, handPos, handSize, isFocus, onClick, isIntro, introTimer }) => {
  const meshRef = useRef<THREE.Group>(null);
  const frameMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const photoMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const backMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const texture = useMemo(() => new THREE.TextureLoader().load(photo.url), [photo.url]);
  const { camera } = useThree();
  
  const physics = useMemo(() => ({
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 0.5
  }), []);

  const clusterPos = useMemo(() => getClusterLayout(photo.id, totalPhotos), [photo.id, totalPhotos]);

  const treeParams = useMemo(() => {
     const radius = Math.hypot(photo.position[0], photo.position[2]);
     const angle = Math.atan2(photo.position[2], photo.position[0]);
     return { radius, angle, y: photo.position[1] };
  }, [photo.position]);

  const startDelay = useMemo(() => {
    const relY = (treeParams.y - (-1.2)) / 5.8; 
    return (1.0 - relY) * 3.0 + 0.5;
  }, [treeParams.y]);

  useEffect(() => {
    if (isIntro && meshRef.current) {
        meshRef.current.position.set(0, 10, 20); 
        meshRef.current.scale.set(0, 0, 0);
    }
  }, [isIntro]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const isScatter = mode === 'SCATTER';
    const canAppear = !isIntro || introTimer > startDelay;

    let targetX, targetY, targetZ;
    let targetScale;
    let targetRot = new THREE.Euler(0, 0, 0);

    if (mode === 'HEART') {
        const basePos = clusterPos;
        const isRight = basePos.x >= 0;
        const sideOffset = isRight ? 18.0 : -18.0; 
        targetX = basePos.x + sideOffset;
        targetY = basePos.y + GALLERY_Y_OFFSET;
        targetZ = basePos.z;
        const swayX = Math.sin(time * swaySpeed.x) * 0.05;
        const swayZ = Math.cos(time * swaySpeed.z) * 0.05;
        meshRef.current.rotation.x += swayX;
        meshRef.current.rotation.z += swayZ;
        targetScale = BASE_PHOTO_SCALE;
        meshRef.current.lookAt(camera.position);
        targetRot.copy(meshRef.current.rotation);
    } 
    else if (isScatter) {
        const cosYaw = Math.cos(scrollRotation);
        const sinYaw = Math.sin(scrollRotation);
        const cosPitch = Math.cos(scrollPitch);
        const sinPitch = Math.sin(scrollPitch);
        const basePos = clusterPos;
        const yawX = basePos.x * cosYaw - basePos.z * sinYaw;
        const yawY = basePos.y;
        const yawZ = basePos.x * sinYaw + basePos.z * cosYaw;
        const rotX = yawX;
        const rotY = yawY * cosPitch - yawZ * sinPitch;
        const rotZ = yawY * sinPitch + yawZ * cosPitch;
        const zFactor = THREE.MathUtils.smoothstep(rotZ, 3.0, 12.0);
        const centerStrength = zFactor * 0.85; 
        const anchorX = rotX * (1 - centerStrength);
        const anchorY = rotY * (1 - centerStrength);
        const anchorZ = rotZ + GALLERY_Z_OFFSET;
        const interactDamp = 1.0 - (zFactor * 0.5); 
        const interactX = ((handPos.x - 0.5) * 8.0) * interactDamp; 
        const interactY = (-(handPos.y - 0.5) * 4.0) * interactDamp;
        const floatAmp = 0.3;
        const floatY = Math.sin(time * 0.8 + physics.phase) * floatAmp;
        const floatX = Math.cos(time * 0.5 + physics.phase) * (floatAmp * 0.5);
        const liftY = zFactor * CLUSTER_LIFT_Y;
        targetX = anchorX + floatX + interactX;
        targetY = anchorY + floatY + interactY + liftY + GALLERY_Y_OFFSET;
        targetZ = anchorZ; 
        const scaleMultiplier = 1.0 + (zFactor * FOCUS_SCALE_BOOST); 
        targetScale = BASE_PHOTO_SCALE * scaleMultiplier;
        meshRef.current.lookAt(camera.position);
        const swayX = Math.sin(time * swaySpeed.x) * 0.05;
        const swayZ = Math.cos(time * swaySpeed.z) * 0.05;
        meshRef.current.rotation.x += swayX;
        meshRef.current.rotation.z += swayZ;
        targetRot.copy(meshRef.current.rotation);
    } else {
        const currentAngle = treeParams.angle + globalRotation;
        const currentRadius = treeParams.radius + Math.sin(time * 0.5 + photo.id) * 0.05;
        targetX = Math.cos(currentAngle) * currentRadius;
        targetZ = Math.sin(currentAngle) * currentRadius;
        targetY = treeParams.y + Math.sin(time + photo.id) * 0.15;
        targetScale = 0.38;
        meshRef.current.lookAt(camera.position);
        targetRot.copy(meshRef.current.rotation);
    }

    const lerpSpeed = 0.03;
    const targetPos = new THREE.Vector3(targetX, targetY, targetZ);

    if (canAppear || !isIntro) {
        meshRef.current.position.lerp(targetPos, lerpSpeed);
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpSpeed);
        meshRef.current.quaternion.slerp(new THREE.Quaternion().setFromEuler(targetRot), lerpSpeed);
    }

    if (frameMaterialRef.current && photoMaterialRef.current && backMaterialRef.current) {
        let opacityProgress = 1.0;
        if (isIntro) {
            opacityProgress = THREE.MathUtils.smoothstep(introTimer, startDelay, startDelay + 1.0);
        }
        frameMaterialRef.current.opacity = opacityProgress;
        photoMaterialRef.current.opacity = opacityProgress;
        backMaterialRef.current.opacity = opacityProgress;
        
        // Boosted emissive intensity to ensure the "white" looks crisp and illuminated
        let targetEmissiveIntensity = isFocus ? 2.5 : 1.5; 
        let targetEmissiveColor = isFocus ? COLOR_BLUE : COLOR_OFF_WHITE_EMISSIVE;
        
        if (isScatter && isFocus) {
            targetEmissiveIntensity = 3.0;
        }

        frameMaterialRef.current.emissiveIntensity = THREE.MathUtils.lerp(frameMaterialRef.current.emissiveIntensity, targetEmissiveIntensity, 0.05);
        frameMaterialRef.current.color.lerp(COLOR_WHITE, 0.05);
        frameMaterialRef.current.emissive.lerp(targetEmissiveColor, 0.05);
    }
  });

  return (
    <group ref={meshRef} 
        onClick={(e) => { 
            e.stopPropagation(); 
            onClick(photo.id); 
        }}
        onPointerOver={() => { 
            document.body.style.cursor = 'pointer'; 
        }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.1, 1.4, 0.04]} />
        <meshStandardMaterial 
          ref={frameMaterialRef} 
          roughness={0.1} 
          metalness={0.0} 
          transparent={true} 
          opacity={1.0} 
          color="#ffffff"
          emissive="#888888"
          emissiveIntensity={1.5}
        />
      </mesh>
      <mesh position={[0, 0.1, 0.026]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial 
          ref={photoMaterialRef}
          map={texture} 
          transparent={true} 
          opacity={1.0} 
        />
      </mesh>
      <mesh position={[0, 0, -0.026]} rotation={[0, Math.PI, 0]}>
         <planeGeometry args={[1.05, 1.35]} />
         <meshStandardMaterial 
          ref={backMaterialRef}
          color="#222222" 
          roughness={0.8} 
          transparent={true} 
          opacity={1.0} 
         />
      </mesh>
    </group>
  );
};

const InstaxGallery: React.FC<InstaxGalleryProps> = ({ photos, mode, onPhotoClick, gesture, handPos, handSize, activeFocusId, isIntro }) => {
  const rotationRef = useRef(0);
  const scrollRotationRef = useRef(0);
  const scrollPitchRef = useRef(0); 
  const momentumRef = useRef(0);
  const lastXRef = useRef(0.5);
  const [introTimer, setIntroTimer] = useState(0);
  
  const swaySpeeds = useMemo(() => {
     return photos.map(() => ({
         x: 0.5 + Math.random() * 0.5,
         y: 0.5 + Math.random() * 0.5,
         z: 0.3 + Math.random() * 0.4
     }));
  }, [photos.length]);

  useFrame((state, delta) => {
      if (isIntro) {
          setIntroTimer(prev => prev + delta);
      }
      let rotationSpeed = 0.25; 
      if (mode === 'TREE') {
          if (gesture === GestureType.FIST) {
              const dx = handPos.x - lastXRef.current;
              if (Math.abs(dx) > 0.001) {
                  momentumRef.current += dx * 35.0;
              }
              lastXRef.current = handPos.x;
          } else {
              lastXRef.current = handPos.x;
          }
          momentumRef.current *= 0.92;
          rotationSpeed += momentumRef.current;
          rotationRef.current += rotationSpeed * delta;
      } else {
          momentumRef.current = 0;
      }

      if (mode === 'SCATTER') {
          const centerThreshold = 0.15; 
          const valX = handPos.x - 0.5;
          if (Math.abs(valX) > centerThreshold) {
              const direction = valX > 0 ? 1 : -1;
              const normalizedPower = (Math.abs(valX) - centerThreshold) / (0.5 - centerThreshold); 
              const rotationSpeedX = Math.pow(normalizedPower, 2.0) * 0.5 * -direction; 
              scrollRotationRef.current += rotationSpeedX * delta;
          }
          const valY = handPos.y - 0.5;
          if (Math.abs(valY) > centerThreshold) {
              const direction = valY > 0 ? 1 : -1;
              const normalizedPower = (Math.abs(valY) - centerThreshold) / (0.5 - centerThreshold);
              const rotationSpeedY = Math.pow(normalizedPower, 2.0) * 0.5 * -direction;
              scrollPitchRef.current += rotationSpeedY * delta;
          }
      }
  });

  return (
    <group>
      {photos.map((photo, i) => {
          const isClickFocus = activeFocusId === photo.id;
          return (
            <InstaxFrame 
                key={photo.id} 
                photo={photo} 
                totalPhotos={photos.length}
                mode={mode} 
                globalRotation={rotationRef.current}
                scrollRotation={scrollRotationRef.current}
                scrollPitch={scrollPitchRef.current}
                swaySpeed={swaySpeeds[i] || {x:1, y:1, z:1}}
                handPos={handPos}
                handSize={handSize}
                isFocus={isClickFocus}
                onClick={onPhotoClick}
                isIntro={isIntro}
                introTimer={introTimer}
            />
          );
      })}
    </group>
  );
};

export default InstaxGallery;