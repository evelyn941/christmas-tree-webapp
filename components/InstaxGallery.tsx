import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleMode, InstaxPhoto, GestureType } from '../types';

interface InstaxGalleryProps {
  photos: InstaxPhoto[]; // Changed: accept photos as prop
  mode: ParticleMode;
  onPhotoClick: (id: number) => void;
  gesture: GestureType;
  handPos: { x: number, y: number };
  handSize: number; // 0.0 to 1.0 (Approx proxy for Z depth)
  activeFocusId: number | null;
}

// --- CONFIGURATION CONSTANTS ---
// 1. Distance between photos (Sphere Radius)
const BASE_RADIUS = 7.0; 

// 2. Photo Scale Configuration
const BASE_PHOTO_SCALE = 1.0;    // Size of photos in the background
const FOCUS_SCALE_BOOST = 1.15;   // Extra scale percentage (1.0 = +100%) when at the front

// 3. Gallery Positioning
const GALLERY_Z_OFFSET = 0;      // Offsets the entire cluster forward/backward
const GALLERY_Y_OFFSET = 1.0;    // Offsets the entire cluster up/down (Global Height)

// 4. Shape & Layout
const CLUSTER_HEIGHT_SCALE = 0.85; // Controls vertical spread relative to width (Y-axis stretch)
const CLUSTER_LIFT_Y = 2.0;        // How much photos rise vertically when they come to the front

// --- MODE A: Floating Cluster Layout (Fibonacci Sphere) ---
// Distributes points evenly on a sphere surface (360 degrees) so there is no "back" side.
const getClusterLayout = (id: number, total: number) => {
    // Fibonacci Sphere Algorithm
    // golden_angle = pi * (3 - sqrt(5))
    const phi = Math.PI * (3 - Math.sqrt(5)); 
    
    // y goes from 1 to -1
    const y_norm = 1 - (id / (total - 1 || 1)) * 2; 
    
    // radius at y
    const radius_at_y = Math.sqrt(1 - y_norm * y_norm);
    
    const theta = phi * id;

    // Dimensions
    const DEPTH_VARIATION = 0.8; 

    // Deterministic random radius variation
    // Use a pseudo-random based on ID to keep it stable but organic
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
}> = ({ photo, totalPhotos, mode, globalRotation, scrollRotation, scrollPitch, swaySpeed, handPos, handSize, isFocus, onClick }) => {
  const meshRef = useRef<THREE.Group>(null);
  const frameMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const photoMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const backMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const texture = useMemo(() => new THREE.TextureLoader().load(photo.url), [photo.url]);
  const { camera } = useThree();
  
  // Physics Randomness
  const physics = useMemo(() => ({
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 0.5
  }), []);

  // Pre-calculate Cluster Layout - Now depends on total count
  const clusterPos = useMemo(() => getClusterLayout(photo.id, totalPhotos), [photo.id, totalPhotos]);

  // Tree Mode Position
  const treeParams = useMemo(() => {
     const radius = Math.hypot(photo.position[0], photo.position[2]);
     const angle = Math.atan2(photo.position[2], photo.position[0]);
     return { radius, angle, y: photo.position[1] };
  }, [photo.position]);

  const startDelay = useMemo(() => {
    // Top-to-bottom sequence
    // treeParams.y ranges from roughly -1.2 to 4.6
    const relY = (treeParams.y - (-1.2)) / 5.8; // 0 (bottom) to 1 (top)
    return (1.0 - relY) * 3.0 + 0.5; // Starts at 0.5s, spreads over 3s
  }, [treeParams.y]);

  useEffect(() => {
    if (isIntro && meshRef.current) {
        meshRef.current.position.set(0, 10, 20); // Far behind camera
        meshRef.current.scale.set(0, 0, 0);
    }
  }, [isIntro]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    // Fix: Removed invalid 'OPEN_HAND' comparison with ParticleMode type.
    const isScatter = mode === 'SCATTER';

    const canAppear = !isIntro || introTimer > startDelay;

    let targetX, targetY, targetZ;
    let targetScale;
    let targetRot = new THREE.Euler(0, 0, 0);

    // --- HEART MODE: SIDE SCATTER ---
    if (mode === 'HEART') {
        const basePos = clusterPos;
        // Split photos to the far left and right to clear center for the heart
        // Use initial X position to determine side to maintain stability
        const isRight = basePos.x >= 0;
        const sideOffset = isRight ? 18.0 : -18.0; 
        
        targetX = basePos.x + sideOffset;
        targetY = basePos.y + GALLERY_Y_OFFSET;
        targetZ = basePos.z; // Keep relative depth
        
        // Sway
        const swayX = Math.sin(time * swaySpeed.x) * 0.05;
        const swayZ = Math.cos(time * swaySpeed.z) * 0.05;
        meshRef.current.rotation.x += swayX;
        meshRef.current.rotation.z += swayZ;
        
        targetScale = BASE_PHOTO_SCALE;
        
        meshRef.current.lookAt(camera.position);
        targetRot.copy(meshRef.current.rotation);
    } 
    // --- SCATTER MODE (CLUSTER) ---
    else if (isScatter) {
        // Shared Rotation Logic (Momentum preserved)
        // 1. YAW Rotation (Horizontal Scroll)
        const cosYaw = Math.cos(scrollRotation);
        const sinYaw = Math.sin(scrollRotation);

        // 2. PITCH Rotation (Vertical Scroll)
        const cosPitch = Math.cos(scrollPitch);
        const sinPitch = Math.sin(scrollPitch);
        
        // Pick the base layout coordinate (Always Cluster)
        const basePos = clusterPos;

        // Apply Yaw (Rotate around Y-axis)
        const yawX = basePos.x * cosYaw - basePos.z * sinYaw;
        const yawY = basePos.y;
        const yawZ = basePos.x * sinYaw + basePos.z * cosYaw;

        // Apply Pitch (Rotate result around X-axis)
        // Standard 3D Rotation Matrix for X-axis:
        // y' = y*cos - z*sin
        // z' = y*sin + z*cos
        const rotX = yawX;
        const rotY = yawY * cosPitch - yawZ * sinPitch;
        const rotZ = yawY * sinPitch + yawZ * cosPitch;
        
        // --- Z-DEPTH CALCULATION & CENTERING ---
        // Determine how close the photo is to the front (Z-depth)
        // rotZ ranges approx -15 to +15.
        // Adjusted range to ensure front items get focus effect
        const zFactor = THREE.MathUtils.smoothstep(rotZ, 3.0, 12.0);
        
        // Centering Effect:
        // As items come to the front (zFactor -> 1), pull them towards (0,0).
        // centerStrength determines how "focused" the front item becomes.
        const centerStrength = zFactor * 0.85; 

        // 2. Global Offset & Centering
        const anchorX = rotX * (1 - centerStrength);
        const anchorY = rotY * (1 - centerStrength);
        const anchorZ = rotZ + GALLERY_Z_OFFSET;

        // 3. Cluster Interaction: Follow Hand (Parallax)
        // Mimic particle behavior: shift based on hand pos
        // We dampen interaction slightly at the front so centering holds better
        const interactDamp = 1.0 - (zFactor * 0.5); 
        const interactX = ((handPos.x - 0.5) * 8.0) * interactDamp; 
        const interactY = (-(handPos.y - 0.5) * 4.0) * interactDamp;

        // Ambient Floating
        const floatAmp = 0.3;
        const floatY = Math.sin(time * 0.8 + physics.phase) * floatAmp;
        const floatX = Math.cos(time * 0.5 + physics.phase) * (floatAmp * 0.5);
        
        // Vertical Lift for Visibility
        // When photos are brought to the front (zFactor ~ 1), lift them up so they aren't cut off by the bottom edge.
        const liftY = zFactor * CLUSTER_LIFT_Y;

        targetX = anchorX + floatX + interactX;
        targetY = anchorY + floatY + interactY + liftY + GALLERY_Y_OFFSET;
        targetZ = anchorZ; 
        
        // --- DYNAMIC SCALING ---
        const scaleMultiplier = 1.0 + (zFactor * FOCUS_SCALE_BOOST); 
        targetScale = BASE_PHOTO_SCALE * scaleMultiplier;

        meshRef.current.lookAt(camera.position);
        
        // Sway
        const swayX = Math.sin(time * swaySpeed.x) * 0.05;
        const swayZ = Math.cos(time * swaySpeed.z) * 0.05;
        meshRef.current.rotation.x += swayX;
        meshRef.current.rotation.z += swayZ;

        targetRot.copy(meshRef.current.rotation);

    } else {
        // --- TREE MODE ---
        const currentAngle = treeParams.angle + globalRotation;
        const currentRadius = treeParams.radius + Math.sin(time * 0.5 + photo.id) * 0.05;
        
        targetX = Math.cos(currentAngle) * currentRadius;
        targetZ = Math.sin(currentAngle) * currentRadius;
        targetY = treeParams.y + Math.sin(time + photo.id) * 0.15;
        targetScale = 0.38;

        meshRef.current.lookAt(camera.position);
        targetRot.copy(meshRef.current.rotation);
    }

    // Gentle transition for everything
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

        let targetEmissive = 0.2;
        if (isScatter && isFocus) targetEmissive = 0.35;
        
        frameMaterialRef.current.emissiveIntensity = THREE.MathUtils.lerp(frameMaterialRef.current.emissiveIntensity, targetEmissive, 0.05);
        frameMaterialRef.current.color.lerp(targetColor, 0.05);
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
          roughness={0.4} 
          metalness={0.0} 
          transparent={false} 
          opacity={1.0} 
        />
      </mesh>
      <mesh position={[0, 0.1, 0.026]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial 
          map={texture} 
          transparent={false} 
          opacity={1.0} 
        />
      </mesh>
      <mesh position={[0, 0, -0.026]} rotation={[0, Math.PI, 0]}>
         <planeGeometry args={[1.05, 1.35]} />
         <meshStandardMaterial 
          color="#222" 
          roughness={0.8} 
          transparent={false} 
          opacity={1.0} 
         />
      </mesh>
    </group>
  );
};

const InstaxGallery: React.FC<InstaxGalleryProps> = ({ photos, mode, onPhotoClick, gesture, handPos, handSize, activeFocusId }) => {
  const rotationRef = useRef(0);
  const scrollRotationRef = useRef(0);
  const scrollPitchRef = useRef(0); // Vertical Rotation
  const momentumRef = useRef(0);
  const lastXRef = useRef(0.5);
  const [introTimer, setIntroTimer] = useState(0);
  
  // Calculate random sway speeds once per photo count to avoid jitter on re-renders
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
      // 1. Tree Mode Rotation
      let rotationSpeed = 0.25; 

      if (mode === 'TREE') {
          // Momentum Logic: FIST Gesture
          if (gesture === GestureType.FIST) {
              const dx = handPos.x - lastXRef.current;
              // Add momentum (Increased sensitivity for responsiveness)
              if (Math.abs(dx) > 0.001) {
                  momentumRef.current += dx * 35.0;
              }
              lastXRef.current = handPos.x;
          } else {
              // Sync last position to avoid jumps when gesture starts
              lastXRef.current = handPos.x;
          }

          // Friction
          momentumRef.current *= 0.92;
          rotationSpeed += momentumRef.current;

          rotationRef.current += rotationSpeed * delta;
      } else {
          momentumRef.current = 0;
      }

      // 2. Scatter Mode Scroll (2-Axis Control)
      // Fix: Removed invalid 'OPEN_HAND' comparison with ParticleMode type.
      if (mode === 'SCATTER') {
          const centerThreshold = 0.15; 
          
          // A. Horizontal Scroll (Yaw)
          const valX = handPos.x - 0.5;
          if (Math.abs(valX) > centerThreshold) {
              const direction = valX > 0 ? 1 : -1;
              const normalizedPower = (Math.abs(valX) - centerThreshold) / (0.5 - centerThreshold); 
              const rotationSpeedX = Math.pow(normalizedPower, 2.0) * 0.5 * -direction; 
              scrollRotationRef.current += rotationSpeedX * delta;
          }

          // B. Vertical Scroll (Pitch) - Bring Bottom Up / Top Down
          const valY = handPos.y - 0.5;
          if (Math.abs(valY) > centerThreshold) {
              // If Hand is UP (valY < 0), we want bottom photos to come up.
              // To bring bottom up, we need positive Pitch (rotate forward/down around X axis means top goes back, bottom comes forward/up)
              // So Hand UP (negative valY) -> Positive Pitch Addition
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
            />
          );
      })}
    </group>
  );
};

export default InstaxGallery;