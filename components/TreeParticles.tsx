import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { 
    COLORS, 
    TREE_PARTICLE_COUNT, 
    SPIRAL_PARTICLE_COUNT,
    EXTRA_BLUE_COUNT,
    EXTRA_PURPLE_COUNT,
    EXTRA_PINK_COUNT
} from '../constants';
import { ParticleMode, GestureType } from '../types';

// --- CONFIGURATION CONSTANTS ---
const TEXT_X_OFFSET = 0.5; // Controls left/right position of the "Merry Christmas" text
const TEXT_Y_OFFSET = 2.2;  // Controls up/down position (2.2 is centered for this scene)
const GLOBAL_PARTICLE_SIZE = 0.12; // Base size for all particles in the Points system

interface TreeParticlesProps {
  mode: ParticleMode;
  targetPos?: { x: number, y: number };
  gesture?: GestureType;
  onTreeClick?: () => void;
}

const END_TREE = TREE_PARTICLE_COUNT;
const END_SPIRAL = END_TREE + SPIRAL_PARTICLE_COUNT;
const END_BLUE = END_SPIRAL + EXTRA_BLUE_COUNT;
const END_PURPLE = END_BLUE + EXTRA_PURPLE_COUNT;
const END_PINK = END_PURPLE + EXTRA_PURPLE_COUNT;
const TOTAL_PARTICLE_COUNT = END_PINK;

const generateTextPositions = (
    text: string, 
    count: number, 
    scale: number = 5, 
    font: string = 'bold 200px "Playfair Display", serif', 
    xOffset: number = 0,
    yOffset: number = 0,
    zThickness: number = 0.05 
): Float32Array => {
  const canvas = document.createElement('canvas');
  const size = 2048; 
  canvas.width = size;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const positions = new Float32Array(count * 3);

  if (!ctx) return positions;

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, 512);
  ctx.fillStyle = 'white';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, 256);

  const imageData = ctx.getImageData(0, 0, size, 512);
  const data = imageData.data;
  const validPixels: number[] = [];

  for (let i = 0; i < data.length; i += 4 * 4) {
    if (data[i] > 128) {
      validPixels.push(i / 4);
    }
  }

  if (validPixels.length === 0) return positions;

  for (let i = 0; i < count; i++) {
    const pixelIndex = validPixels[Math.floor(Math.random() * validPixels.length)];
    const x = (pixelIndex % size);
    const y = Math.floor(pixelIndex / size);

    positions[i * 3] = (x / size - 0.5) * scale * 4 + xOffset; 
    positions[i * 3 + 1] = -(y / 512 - 0.5) * scale + yOffset; 
    positions[i * 3 + 2] = (Math.random() - 0.5) * zThickness;
  }

  return positions;
};

const getStarTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const cx = 64;
        const cy = 64;
        ctx.clearRect(0, 0, 128, 128);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 55); 
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(220, 230, 255, 0.4)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        
        const drawRay = (w: number, h: number, opacity: number, blur: number) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
            ctx.shadowBlur = blur; 
            ctx.beginPath();
            ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        };

        drawRay(60, 2, 0.8, 20); 
        drawRay(2, 60, 0.8, 20); 

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.translate(-cx, -cy);
        drawRay(35, 1.5, 0.5, 15);
        drawRay(1.5, 35, 0.5, 15);
        ctx.restore();
    }
    return new THREE.CanvasTexture(canvas);
};

function getSoftParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
    }
    return new THREE.CanvasTexture(canvas);
}

class HeartFirework {
    particles: THREE.Points;
    geometry: THREE.BufferGeometry;
    startTime: number;
    lifeTime: number = 1.0;
    center: THREE.Vector3;
    count: number = 450;
    vels: Float32Array;
    
    constructor(scene: THREE.Group, center: THREE.Vector3, texture: THREE.Texture) {
        this.center = center;
        this.startTime = performance.now() / 1000;
        this.geometry = new THREE.BufferGeometry();
        const pos = new Float32Array(this.count * 3);
        const cols = new Float32Array(this.count * 3);
        this.vels = new Float32Array(this.count * 3);

        const color = new THREE.Color('#ffb7c5').multiplyScalar(1.0);

        for (let i = 0; i < this.count; i++) {
            const t = Math.random() * Math.PI * 2;
            const hx = 16 * Math.pow(Math.sin(t), 3);
            const hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
            
            pos[i*3] = center.x;
            pos[i*3+1] = center.y;
            pos[i*3+2] = center.z;

            const speed = 0.4 + Math.random() * 0.6;
            this.vels[i*3] = hx * 0.1 * speed;
            this.vels[i*3+1] = hy * 0.1 * speed;
            this.vels[i*3+2] = (Math.random() - 0.5) * 0.5;

            cols[i*3] = color.r;
            cols[i*3+1] = color.g;
            cols[i*3+2] = color.b;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.25,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 1,
            map: texture,
            fog: false
        });

        this.particles = new THREE.Points(this.geometry, mat);
        scene.add(this.particles);
    }

    update(time: number) {
        const elapsed = time - this.startTime;
        const norm = elapsed / this.lifeTime;
        if (norm >= 1) {
            this.particles.visible = false;
            return false;
        }

        const posAttr = this.geometry.attributes.position;
        const array = posAttr.array as Float32Array;

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            array[i3] += this.vels[i3] * 0.05;
            array[i3+1] += this.vels[i3+1] * 0.05 - 0.003; 
            array[i3+2] += this.vels[i3+2] * 0.05;

            this.vels[i3] *= 0.97;
            this.vels[i3+1] *= 0.97;
            this.vels[i3+2] *= 0.97;
        }
        posAttr.needsUpdate = true;
        (this.particles.material as THREE.PointsMaterial).opacity = Math.pow(1 - norm, 3.0);
        return true;
    }

    destroy(scene: THREE.Group) {
        scene.remove(this.particles);
        this.geometry.dispose();
        (this.particles.material as THREE.Material).dispose();
    }
}

const TreeParticles: React.FC<TreeParticlesProps> = ({ mode, targetPos, gesture, onTreeClick }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const fireworksGroupRef = useRef<THREE.Group>(null);
  const starGroupRef = useRef<THREE.Group>(null);
  const starHaloRef = useRef<THREE.Sprite>(null);
  const starLightRef = useRef<THREE.PointLight>(null);
  
  const starTexture = useMemo(() => getStarTexture(), []);
  const particleTexture = useMemo(() => getSoftParticleTexture(), []);
  
  const rotationRef = useRef(0);
  const momentumRef = useRef(0);
  const lastXRef = useRef(0.5);
  
  const fireworksArr = useRef<HeartFirework[]>([]);
  const lastFireworkTime = useRef(0);

  const { currentPositions, targetPositionsMap, colors, baseColors, sizes, lightIndices, spiralIndices, baseSizes, bounceData, colorPrimary } = useMemo(() => {
    const isMobile = window.innerWidth < 768;
    const singleLineScale = isMobile ? 3.5 : 5.5;

    const current = new Float32Array(TOTAL_PARTICLE_COUNT * 3);
    const cols = new Float32Array(TOTAL_PARTICLE_COUNT * 3);
    const baseCols = new Float32Array(TOTAL_PARTICLE_COUNT * 3); 
    const szs = new Float32Array(TOTAL_PARTICLE_COUNT);
    const baseSzs = new Float32Array(TOTAL_PARTICLE_COUNT);
    const lIndices: number[] = [];
    const sIndices: number[] = []; 
    const bData = new Float32Array(TOTAL_PARTICLE_COUNT * 2);

    const treePos = new Float32Array(TOTAL_PARTICLE_COUNT * 3);
    const scatterPos = new Float32Array(TOTAL_PARTICLE_COUNT * 3);
    
    const colorPrimaryVal = new THREE.Color('#6abce2');
    const colorSecondary = new THREE.Color('#759cd0');
    const colorWhite = new THREE.Color('#FFFFFF');
    
    const luxuryLightColors = ['#FCFCFF', '#F0F4F8', '#F0F4F8', '#F0F4F8', '#D1D5DB', '#FCFCFF'];
    const BRIGHT_MULT = 1.1; 
    const ORNAMENT_INTENSITY = 1.6;

    for (let i = 0; i < TOTAL_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      let x = 0, y = 0, z = 0;
      let r, g, b, size;

      bData[i * 2] = Math.random() * Math.PI * 2; 
      bData[i * 2 + 1] = 0.5 + Math.random() * 1.5;

      if (i >= TREE_PARTICLE_COUNT && i < END_SPIRAL) {
          const spiralIdx = i - TREE_PARTICLE_COUNT;
          const norm = spiralIdx / SPIRAL_PARTICLE_COUNT;
          const totalRotations = 7.5; 
          const startY = 5.2; 
          const endY = -1.4;  
          const yPos = startY - norm * (startY - endY);
          const relH = Math.max(0, Math.min(1, (yPos - (-1.5)) / 7.0));
          const treeRadiusAtY = 3.5 * (1 - Math.pow(relH, 0.9));
          const spiralRadius = treeRadiusAtY * 0.92;
          const angle = norm * Math.PI * 2 * totalRotations;
          const ribbonWidth = 0.06; 
          const side = Math.random() > 0.5 ? 1 : -1;
          const offsetNorm = Math.pow(Math.random(), 0.5); 
          const yOffset = side * offsetNorm * (ribbonWidth * 0.5);
          const rEffective = spiralRadius + (Math.random() - 0.5) * 0.02;
          x = rEffective * Math.cos(angle);
          y = yPos + yOffset; 
          z = rEffective * Math.sin(angle);
          const c = Math.random() < 0.9 ? colorWhite : new THREE.Color(luxuryLightColors[Math.floor(Math.random() * luxuryLightColors.length)]);
          r = c.r * BRIGHT_MULT; g = c.g * BRIGHT_MULT; b = c.b * BRIGHT_MULT;
          size = 0.03 + Math.random() * 0.04;
          sIndices.push(i);
      } 
      else if (i >= END_SPIRAL) {
          const h = Math.random() * 7; 
          y = -1.5 + h;
          const relHeight = h / 7; 
          const maxRadius = 3.4 * (1 - Math.pow(relHeight, 0.9)); 
          const radius = Math.random() * maxRadius;
          const theta = Math.random() * Math.PI * 2;
          x = radius * Math.cos(theta);
          z = radius * Math.sin(theta);
          size = 0.14 + Math.random() * 0.06;
          r = colorWhite.r * BRIGHT_MULT; g = colorWhite.g * BRIGHT_MULT; b = colorWhite.b * BRIGHT_MULT;
          lIndices.push(i); 
      }
      else {
          const h = Math.random() * 7; 
          y = -1.5 + h;
          const relHeight = h / 7; 
          const maxRadius = 3.5 * (1 - Math.pow(relHeight, 0.9)); 
          const radius = Math.random() * maxRadius;
          const theta = Math.random() * Math.PI * 2;
          x = radius * Math.cos(theta);
          z = radius * Math.sin(theta);
          if (Math.random() > 0.96) { 
              const c = new THREE.Color(luxuryLightColors[Math.floor(Math.random() * luxuryLightColors.length)]);
              r = c.r * ORNAMENT_INTENSITY; g = c.g * ORNAMENT_INTENSITY; b = c.b * ORNAMENT_INTENSITY;
              size = Math.random() * 0.15 + 0.1; 
              lIndices.push(i);
          } else {
              const selectedColor = Math.random() < 0.70 ? colorPrimaryVal : colorSecondary;
              size = Math.random() * 0.09 + 0.04;
              r = selectedColor.r * BRIGHT_MULT; g = selectedColor.g * BRIGHT_MULT; b = selectedColor.b * BRIGHT_MULT;
          }
      }
      szs[i] = size; baseSzs[i] = size;
      treePos[i3] = x; treePos[i3+1] = y; treePos[i3+2] = z;
      current[i3] = x; current[i3+1] = y; current[i3+2] = z;
      cols[i3] = r; cols[i3+1] = g; cols[i3+2] = b;
      baseCols[i3] = r; baseCols[i3+1] = g; baseCols[i3+2] = b;
      const sr = 10 + Math.random() * 5;
      const stheta = Math.random() * Math.PI * 2;
      const sphi = Math.random() * Math.PI;
      scatterPos[i3] = sr * Math.sin(sphi) * Math.cos(stheta);
      scatterPos[i3+1] = sr * Math.sin(sphi) * Math.sin(stheta);
      scatterPos[i3+2] = sr * Math.cos(sphi);
    }

    // Positions for text targets using configured offsets
    const textTarget = generateTextPositions("Merry Christmas, Qiu", TOTAL_PARTICLE_COUNT, singleLineScale, '400 120px "Great Vibes", cursive', TEXT_X_OFFSET, TEXT_Y_OFFSET, 0.02);

    return {
      currentPositions: current,
      targetPositionsMap: {
        TREE: treePos,
        SCATTER: scatterPos,
        HEART: textTarget,
        TEXT_MERRY: generateTextPositions("Merry Christmas", TOTAL_PARTICLE_COUNT, 8, 'bold 200px "Playfair Display", serif', 0, 0),
      },
      colors: cols,
      baseColors: baseCols,
      sizes: szs,
      baseSizes: baseSzs,
      lightIndices: lIndices,
      spiralIndices: sIndices,
      bounceData: bData,
      colorPrimary: colorPrimaryVal
    };
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();
    const posAttr = pointsRef.current.geometry.attributes.position;
    const colAttr = pointsRef.current.geometry.attributes.color;
    const sizeAttr = pointsRef.current.geometry.attributes.size;
    
    let target = targetPositionsMap.TREE;
    if (mode === 'SCATTER') target = targetPositionsMap.SCATTER;
    else if (mode === 'HEART') target = targetPositionsMap.HEART;
    else if (mode === 'TEXT_MERRY') target = targetPositionsMap.TEXT_MERRY;

    let offsetX = 0, offsetY = 0;
    if (targetPos && mode !== 'TREE') {
         offsetX = (targetPos.x - 0.5) * 10;
         offsetY = -(targetPos.y - 0.5) * 5;
    }

    const positions = posAttr.array as Float32Array;
    const currentColors = colAttr.array as Float32Array;
    const speed = mode === 'HEART' ? 0.05 : 0.08; 

    for (let i = 0; i < TOTAL_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      let tx = target[i3] + offsetX;
      let ty = target[i3+1] + offsetY;
      let tz = target[i3+2];
      if (mode === 'TREE') {
          if (i < TREE_PARTICLE_COUNT) tx += Math.sin(time * 0.5 + positions[i3+1]) * 0.02;
          ty += Math.sin(time * bounceData[i * 2 + 1] + bounceData[i * 2]) * 0.035;
      }
      positions[i3] += (tx - positions[i3]) * speed;
      positions[i3+1] += (ty - positions[i3+1]) * speed;
      positions[i3+2] += (tz - positions[i3+2]) * speed;
      let tr, tg, tb;
      if (mode === 'HEART') {
          tr = colorPrimary.r; tg = colorPrimary.g; tb = colorPrimary.b;
      } else {
          tr = baseColors[i3]; tg = baseColors[i3+1]; tb = baseColors[i3+2];
      }
      currentColors[i3] += (tr - currentColors[i3]) * 0.05;
      currentColors[i3+1] += (tg - currentColors[i3+1]) * 0.05;
      currentColors[i3+2] += (tb - currentColors[i3+2]) * 0.05;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    const sizeArray = sizeAttr.array as Float32Array;
    
    for(let idx of lightIndices) {
        sizeArray[idx] = baseSizes[idx] * (0.8 + 0.6 * Math.sin(time * 3 + idx * 0.1));
    }
    if (mode === 'TREE') {
        for(let idx of spiralIndices) {
            const twinkle = 0.8 + 0.4 * Math.sin(time * 8 + idx * 0.5);
            const flow = 1.0 + 0.3 * Math.sin(time * 3 - ((idx - TREE_PARTICLE_COUNT) / SPIRAL_PARTICLE_COUNT) * 10);
            sizeArray[idx] = baseSizes[idx] * twinkle * flow;
        }
    }
    sizeAttr.needsUpdate = true;
    
    if (mode === 'HEART' && fireworksGroupRef.current) {
        if (time - lastFireworkTime.current > 0.6) {
            const range = 14;
            const x = (Math.random() - 0.5) * range;
            const y = (Math.random() - 0.5) * range + 1;
            const z = -6 - Math.random() * 6;
            fireworksArr.current.push(new HeartFirework(fireworksGroupRef.current, new THREE.Vector3(x, y, z), particleTexture));
            lastFireworkTime.current = time;
        }
    }

    fireworksArr.current = fireworksArr.current.filter(fw => {
        const active = fw.update(time);
        if (!active) fw.destroy(fireworksGroupRef.current!);
        return active;
    });

    if (mode === 'TREE') {
        if (gesture === GestureType.FIST && targetPos) {
            const dx = targetPos.x - lastXRef.current;
            if (Math.abs(dx) > 0.001) momentumRef.current += dx * 35.0;
            lastXRef.current = targetPos.x;
        } else if (targetPos) lastXRef.current = targetPos.x;
        momentumRef.current *= 0.92;
        rotationRef.current += (0.25 + momentumRef.current) * delta;
        pointsRef.current.rotation.y = rotationRef.current;
        if (starGroupRef.current) {
            starGroupRef.current.position.y = 5.6 + Math.sin(time * 1.5) * 0.05;
            starGroupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);
            const breath = (Math.sin(time * 1.5) + 1) * 0.5; 
            if (starHaloRef.current) {
                starHaloRef.current.scale.set(0.93 + breath * 0.1, 0.93 + breath * 0.1, 1);
                starHaloRef.current.material.opacity = (0.5 + breath * 0.5) * 0.7;
                starHaloRef.current.material.rotation += 0.005; 
            }
            if (starLightRef.current) starLightRef.current.intensity = (4.0 + breath * 3.0) * 0.7;
        }
    } else {
        pointsRef.current.rotation.y += (0 - pointsRef.current.rotation.y) * 0.1;
        if (starGroupRef.current) starGroupRef.current.scale.lerp(new THREE.Vector3(0, 0, 0), 0.1);
    }
  });

  return (
    <group>
        <group ref={fireworksGroupRef} />
        <points 
            ref={pointsRef} 
            onClick={(e) => { if(onTreeClick) { e.stopPropagation(); onTreeClick(); } }}
        >
        <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={TOTAL_PARTICLE_COUNT} array={currentPositions} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={TOTAL_PARTICLE_COUNT} array={colors} itemSize={3} />
            <bufferAttribute attach="attributes-size" count={TOTAL_PARTICLE_COUNT} array={sizes} itemSize={1} />
        </bufferGeometry>
        <pointsMaterial
            vertexColors
            size={GLOBAL_PARTICLE_SIZE}
            sizeAttenuation={true}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            transparent={true}
            opacity={0.9}
            map={particleTexture} 
        />
        </points>
        <group ref={starGroupRef} position={[0, 5.6, 0]}>
            <pointLight ref={starLightRef} distance={10} color="#FFFFFF" decay={1.5} />
            <sprite ref={starHaloRef} scale={[0.93, 0.93, 1]}>
                <spriteMaterial map={starTexture} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>
        </group>
    </group>
  );
};

export default TreeParticles;
