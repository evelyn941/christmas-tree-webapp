import React, { useRef, useMemo } from 'react';
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

interface TreeParticlesProps {
  mode: ParticleMode;
  targetPos?: { x: number, y: number }; // Normalized screen position -1 to 1 from gesture
  gesture?: GestureType;
  onTreeClick?: () => void;
}

// Calculate ranges
const END_TREE = TREE_PARTICLE_COUNT;
const END_SPIRAL = END_TREE + SPIRAL_PARTICLE_COUNT;
const END_BLUE = END_SPIRAL + EXTRA_BLUE_COUNT;
const END_PURPLE = END_BLUE + EXTRA_PURPLE_COUNT;
const END_PINK = END_PURPLE + EXTRA_PINK_COUNT;
const TOTAL_PARTICLE_COUNT = END_PINK;

// Ranges for "Rua Says" Composite Shape
const RUA_QIU_COUNT = 1500;
const RUA_MERRY_COUNT = 2000;
// Remainder is heart

// Helper to generate text positions via canvas scanning
const generateTextPositions = (
    text: string, 
    count: number, 
    scale: number = 5, 
    font: string = 'bold 200px "Playfair Display", serif', 
    yOffset: number = 0,
    zThickness: number = 0.05 // New parameter to control thickness (Default reduced from 0.5 to 0.05)
): Float32Array => {
  const canvas = document.createElement('canvas');
  const size = 1024;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const positions = new Float32Array(count * 3);

  if (!ctx) return positions;

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'white';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const validPixels: number[] = [];

  for (let i = 0; i < data.length; i += 4 * 4) { // Sample every 4th pixel for sparse cloud
    if (data[i] > 128) { // If pixel is bright
      validPixels.push(i / 4);
    }
  }

  if (validPixels.length === 0) return positions;

  for (let i = 0; i < count; i++) {
    const pixelIndex = validPixels[Math.floor(Math.random() * validPixels.length)];
    const x = (pixelIndex % size);
    const y = Math.floor(pixelIndex / size);

    // Map to 3D space centered at 0
    positions[i * 3] = (x / size - 0.5) * scale * 2;
    positions[i * 3 + 1] = -(y / size - 0.5) * scale + yOffset; // Flip Y and add offset
    // Apply zThickness to flatten the text for clarity
    positions[i * 3 + 2] = (Math.random() - 0.5) * zThickness;
  }

  return positions;
};

// Helper for Star Flare Texture (Lens Flare style)
const getStarTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const cx = 64;
        const cy = 64;
        
        // Clear
        ctx.clearRect(0, 0, 128, 128);
        
        // 1. Central Glow (Hot core) - White/Bright
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 55); 
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(220, 230, 255, 0.4)'); // Slight blue tint for "white" feel
        grad.addColorStop(1, 'rgba(0,0,0,0)'); // Soft edge fade
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        
        // Helper to draw rays
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

        // 2. Main Cross Rays
        drawRay(60, 2, 0.8, 20); 
        drawRay(2, 60, 0.8, 20); 

        // 3. Diagonal Rays
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

// Procedural soft particle texture
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
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

const TreeParticles: React.FC<TreeParticlesProps> = ({ mode, targetPos, gesture, onTreeClick }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const starGroupRef = useRef<THREE.Group>(null);
  const starHaloRef = useRef<THREE.Sprite>(null);
  const starLightRef = useRef<THREE.PointLight>(null);
  
  const starTexture = useMemo(() => getStarTexture(), []);
  const particleTexture = useMemo(() => getSoftParticleTexture(), []);
  
  // Rotation accumulator & Momentum Physics
  const rotationRef = useRef(0);
  const momentumRef = useRef(0);
  const lastXRef = useRef(0.5);

  // Initialize Buffers
  const { currentPositions, targetPositionsMap, colors, baseColors, sizes, lightIndices, spiralIndices, baseSizes, bounceData } = useMemo(() => {
    // Check for mobile device inside useMemo to set scale
    const isMobile = window.innerWidth < 768;
    const textScaleQiu = isMobile ? 2.5 : 4.5;
    const textScaleMerry = isMobile ? 3.5 : 6.0;
    const heartScale = isMobile ? 0.12 : 0.18;

    const current = new Float32Array(TOTAL_PARTICLE_COUNT * 3);
    const cols = new Float32Array(TOTAL_PARTICLE_COUNT * 3);
    const baseCols = new Float32Array(TOTAL_PARTICLE_COUNT * 3); // Store original colors
    const szs = new Float32Array(TOTAL_PARTICLE_COUNT);
    const baseSzs = new Float32Array(TOTAL_PARTICLE_COUNT);
    const lIndices: number[] = [];
    const sIndices: number[] = []; // Spiral Indices
    const bData = new Float32Array(TOTAL_PARTICLE_COUNT * 2); // [phase, speed]

    const treePos = new Float32Array(TOTAL_PARTICLE_COUNT * 3);
    const scatterPos = new Float32Array(TOTAL_PARTICLE_COUNT * 3);
    
    // New Blue Palette
    const colorPrimary = new THREE.Color('#6abce2'); // 70% Light Blue
    const colorSecondary = new THREE.Color('#46a2da'); // 30% Darker Blue
    const colorWhite = new THREE.Color('#FFFFFF');
    
    // New Gold Colors
    const colorGold1 = new THREE.Color('#F1E3A4');
    const colorGold2 = new THREE.Color('#FAF9D0');
    
    const luxuryLightColors = [
        '#F1E3A4',        
        '#FAF9D0',        
        COLORS.LIGHT_WHITE, 
        COLORS.LIGHT_WHITE, 
        COLORS.LIGHT_GOLD,  
        '#F1E3A4'    
    ];

    // --- GENERATE PARTICLES ---
    for (let i = 0; i < TOTAL_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      let x = 0, y = 0, z = 0;
      let r, g, b, size;

      // Initialize bounce data (random phase and speed)
      bData[i * 2] = Math.random() * Math.PI * 2; // Phase
      bData[i * 2 + 1] = 0.5 + Math.random() * 1.5; // Speed multiplier (0.5x to 2.0x)

      // ============================================
      // 1. SPIRAL RIBBON
      // ============================================
      if (i >= TREE_PARTICLE_COUNT && i < END_SPIRAL) {
          const spiralIdx = i - TREE_PARTICLE_COUNT;
          const norm = spiralIdx / SPIRAL_PARTICLE_COUNT;
          
          const totalRotations = 7.5; 
          const startY = 5.2; 
          const endY = -1.4;  
          const heightRange = startY - endY;
          
          const yPos = startY - norm * heightRange;
          
          const treeBaseY = -1.5;
          const treeTotalHeight = 7.0;
          let relH = (yPos - treeBaseY) / treeTotalHeight;
          if (relH < 0) relH = 0;
          if (relH > 1) relH = 1;

          const treeRadiusAtY = 3.5 * (1 - Math.pow(relH, 0.9));
          const spiralRadius = treeRadiusAtY * 0.92;

          const angle = norm * Math.PI * 2 * totalRotations;

          // --- RIBBON DISTRIBUTION LOGIC ---
          const ribbonWidth = 0.06; 
          
          const side = Math.random() > 0.5 ? 1 : -1;
          const offsetNorm = Math.pow(Math.random(), 0.5); 
          const yOffset = side * offsetNorm * (ribbonWidth * 0.5);

          const rEffective = spiralRadius + (Math.random() - 0.5) * 0.02;

          x = rEffective * Math.cos(angle);
          y = yPos + yOffset; 
          z = rEffective * Math.sin(angle);
          
          // NEW COLOR LOGIC: 90% White, 10% Gold
          const isWhite = Math.random() < 0.9;
          const c = isWhite ? colorWhite : (Math.random() < 0.5 ? colorGold1 : colorGold2);

          // Multiplier for Glow Effect (Bloom)
          r = c.r * 2.5; 
          g = c.g * 2.5; 
          b = c.b * 2.5;
          
          size = 0.03 + Math.random() * 0.04;

          if (norm > 0.85) { 
              const tailProgress = (norm - 0.85) / 0.15; 
              if (Math.random() < tailProgress) { 
                  size = 0; 
              } else {
                  const alpha = 1.0 - Math.pow(tailProgress, 1.5); 
                  r *= alpha; g *= alpha; b *= alpha;
              }
          }

          sIndices.push(i);
      } 
      // ============================================
      // 2. EXTRA LIGHTS
      // ============================================
      else if (i >= END_SPIRAL) {
          const height = 7;
          const baseY = -1.5;
          const h = Math.random() * height; 
          y = baseY + h;
          const relHeight = h / height; 
          const maxRadius = 3.4 * (1 - Math.pow(relHeight, 0.9)); 
          const radius = Math.random() * maxRadius;
          const theta = Math.random() * Math.PI * 2;
          
          x = radius * Math.cos(theta);
          z = radius * Math.sin(theta);
          
          size = 0.14 + Math.random() * 0.06;
          
          r = colorWhite.r * 2.5;
          g = colorWhite.g * 2.5;
          b = colorWhite.b * 2.5;
          
          lIndices.push(i); 
      }
      // ============================================
      // 3. TREE LEAVES
      // ============================================
      else {
          const height = 7; 
          const baseY = -1.5;
          const h = Math.random() * height; 
          y = baseY + h;
          
          const relHeight = h / height; 
          const maxRadius = 3.5 * (1 - Math.pow(relHeight, 0.9)); 
          const radius = Math.random() * maxRadius;
          const theta = Math.random() * Math.PI * 2;
          
          x = radius * Math.cos(theta);
          z = radius * Math.sin(theta);

          if (Math.random() > 0.96) { 
              // Random ornaments
              const c = new THREE.Color(luxuryLightColors[Math.floor(Math.random() * luxuryLightColors.length)]);
              const intensity = 3.5; 
              r = c.r * intensity; g = c.g * intensity; b = c.b * intensity;
              size = Math.random() * 0.15 + 0.1; 
              lIndices.push(i);
          } else {
              const solidProb = Math.pow(relHeight, 0.7); 
              const isSolid = Math.random() < solidProb;

              if (isSolid) {
                  // NEW COLOR LOGIC: 70% Primary Blue, 30% Secondary Blue
                  const isPrimary = Math.random() < 0.70;
                  let selectedColor;
                  
                  if (isPrimary) {
                      selectedColor = colorPrimary;
                      size = Math.random() * 0.09 + 0.04;
                  } else {
                      selectedColor = colorSecondary;
                      size = Math.random() * 0.08 + 0.03;
                  }

                  // Apply Glow Factor to colors (x2.5 intensity)
                  r = selectedColor.r * 2.5;
                  g = selectedColor.g * 2.5;
                  b = selectedColor.b * 2.5;

              } else {
                  // Sparse/Outer leaves (usually darker, use secondary)
                  r = colorSecondary.r * 1.5; 
                  g = colorSecondary.g * 1.5;
                  b = colorSecondary.b * 1.5;
                  size = Math.random() * 0.06 + 0.02;
              }
          }
      }
      
      szs[i] = size;
      baseSzs[i] = size;

      treePos[i3] = x;
      treePos[i3+1] = y;
      treePos[i3+2] = z;

      current[i3] = x;
      current[i3+1] = y;
      current[i3+2] = z;
      
      cols[i3] = r;
      cols[i3+1] = g;
      cols[i3+2] = b;
      
      baseCols[i3] = r;
      baseCols[i3+1] = g;
      baseCols[i3+2] = b;

      // --- SCATTER SHAPE ---
      const sr = 10 + Math.random() * 5;
      const stheta = Math.random() * Math.PI * 2;
      const sphi = Math.random() * Math.PI;
      scatterPos[i3] = sr * Math.sin(sphi) * Math.cos(stheta);
      scatterPos[i3+1] = sr * Math.sin(sphi) * Math.sin(stheta);
      scatterPos[i3+2] = sr * Math.cos(sphi);
    }

    // --- RUA SAYS COMPOSITE SHAPE ---
    const ruaSaysPos = new Float32Array(TOTAL_PARTICLE_COUNT * 3);
    
    // 1. Generate "Qiu" (Center) - Font: Great Vibes (Festive)
    // Scale: 4.5 | Y-Offset: 1.4 (Raised) | Z-Thickness: 0.01 (Very thin)
    // Updated: Scale depends on device
    const qiuPos = generateTextPositions("Qiu", RUA_QIU_COUNT, textScaleQiu, '400 200px "Great Vibes", cursive', 1.4, 0.01);

    // 2. Generate "Merry Christmas" (Bottom) - Font: Great Vibes (Festive)
    // Scale: 6.0 (Larger) | Y-Offset: -2.0 (Lower/Moved) | Z-Thickness: 0.01 (Very thin)
    // Updated: Scale depends on device
    const merryPos = generateTextPositions("Merry Christmas", RUA_MERRY_COUNT, textScaleMerry, '400 90px "Great Vibes", cursive', -2.0, 0.01);

    // 3. Generate Heart (Background)
    const HEART_COUNT = TOTAL_PARTICLE_COUNT - RUA_QIU_COUNT - RUA_MERRY_COUNT;
    const heartPos = new Float32Array(HEART_COUNT * 3);
    for(let i=0; i<HEART_COUNT; i++) {
        const t = Math.random() * Math.PI * 2;
        const hScale = heartScale; // Updated: scale depends on device
        
        // Edge Logic: No rFill random multiplication for X/Y.
        // Parametric Heart
        // x = 16sin^3(t)
        // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
        const hx = (16 * Math.pow(Math.sin(t), 3));
        const hy = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
        
        // Apply slight jitter to make the edge look like a neon tube, not a 1px line
        const thickness = (Math.random() - 0.5) * 0.4;

        heartPos[i*3] = (hx + thickness) * hScale;
        // RAISED HEART Y-OFFSET from 1.0 to 1.8
        heartPos[i*3+1] = (hy + thickness) * hScale + 1.8; 
        heartPos[i*3+2] = (Math.random() - 0.5) * 0.4; // Z Depth thickness
    }

    // Combine into ruaSaysPos
    // Order: Qiu -> Merry -> Heart
    // Z-Shift: Move them forward to Z + 1.0 (Text) and Z + 1.0 (Heart) to fit close to tree layer
    let cursor = 0;
    
    // Copy Qiu (Front)
    for(let i=0; i<RUA_QIU_COUNT; i++) {
        ruaSaysPos[cursor*3] = qiuPos[i*3];
        ruaSaysPos[cursor*3+1] = qiuPos[i*3+1];
        ruaSaysPos[cursor*3+2] = qiuPos[i*3+2] + 1.0; 
        cursor++;
    }
    // Copy Merry (Front)
    for(let i=0; i<RUA_MERRY_COUNT; i++) {
        ruaSaysPos[cursor*3] = merryPos[i*3];
        ruaSaysPos[cursor*3+1] = merryPos[i*3+1];
        ruaSaysPos[cursor*3+2] = merryPos[i*3+2] + 1.0;
        cursor++;
    }
    // Copy Heart (Together with text at Z+1, slightly behind via order if depth test was strict, but here roughly same plane)
    for(let i=0; i<HEART_COUNT; i++) {
        ruaSaysPos[cursor*3] = heartPos[i*3];
        ruaSaysPos[cursor*3+1] = heartPos[i*3+1];
        ruaSaysPos[cursor*3+2] = heartPos[i*3+2] + 1.0; 
        cursor++;
    }

    // --- PLAIN TEXT MODES (Reuse Logic) ---
    const textMerryPos = generateTextPositions("Merry Christmas", TOTAL_PARTICLE_COUNT, 8);

    return {
      currentPositions: current,
      targetPositionsMap: {
        TREE: treePos,
        SCATTER: scatterPos,
        HEART: ruaSaysPos, 
        TEXT_MERRY: textMerryPos,
      },
      colors: cols,
      baseColors: baseCols,
      sizes: szs,
      baseSizes: baseSzs,
      lightIndices: lIndices,
      spiralIndices: sIndices,
      bounceData: bData
    };
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const time = state.clock.getElapsedTime();
    const geometry = pointsRef.current.geometry;
    const posAttr = geometry.attributes.position;
    const colAttr = geometry.attributes.color;
    const sizeAttr = geometry.attributes.size;
    
    let target = targetPositionsMap.TREE;
    if (mode === 'SCATTER') target = targetPositionsMap.SCATTER;
    else if (mode === 'HEART') target = targetPositionsMap.HEART;
    else if (mode === 'TEXT_MERRY') target = targetPositionsMap.TEXT_MERRY;
    else target = targetPositionsMap.TREE;

    let offsetX = 0;
    let offsetY = 0;
    if (targetPos && mode !== 'TREE') {
         offsetX = (targetPos.x - 0.5) * 10;
         offsetY = -(targetPos.y - 0.5) * 5;
    }

    const positions = posAttr.array as Float32Array;
    const currentColors = colAttr.array as Float32Array;
    const speed = 0.08; 

    // Target Colors for "Rua Says" (Pink #FFC0CB and Glowing White/Gold)
    const pink = new THREE.Color('#FFC0CB');
    const gold = new THREE.Color('#FFFACD'); // LemonChiffon/Gold for Qiu

    // Boost intensity for bloom
    const pinkR = pink.r * 2.0; const pinkG = pink.g * 2.0; const pinkB = pink.b * 2.0;
    const goldR = gold.r * 4.0; const goldG = gold.g * 4.0; const goldB = gold.b * 4.0;

    for (let i = 0; i < TOTAL_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      // --- POSITION UPDATE ---
      let tx = target[i3] + offsetX;
      let ty = target[i3+1] + offsetY;
      let tz = target[i3+2];

      if (mode === 'TREE') {
          if (i < TREE_PARTICLE_COUNT) {
             const sway = Math.sin(time * 0.5 + positions[i3+1]) * 0.02; 
             tx += sway;
          }
          const phase = bounceData[i * 2];
          const bounceSpeed = bounceData[i * 2 + 1];
          const bounceAmp = 0.035; 
          
          const bounce = Math.sin(time * bounceSpeed + phase) * bounceAmp;
          ty += bounce;
      }

      positions[i3] += (tx - positions[i3]) * speed;
      positions[i3+1] += (ty - positions[i3+1]) * speed;
      positions[i3+2] += (tz - positions[i3+2]) * speed;

      // --- COLOR UPDATE (GRADUAL) ---
      let tr, tg, tb;

      if (mode === 'HEART') {
          // Determine which part of the layout we are in
          if (i < RUA_QIU_COUNT) {
              // "Qiu" -> SAME AS MERRY CHRISTMAS (Tree Colors)
              tr = baseColors[i3]; tg = baseColors[i3+1]; tb = baseColors[i3+2];
          } else if (i < (RUA_QIU_COUNT + RUA_MERRY_COUNT)) {
              // "Merry Christmas" -> Original Tree Color (Greens/Golds)
              tr = baseColors[i3]; tg = baseColors[i3+1]; tb = baseColors[i3+2];
          } else {
              // Heart Background -> Pink Glowing
              tr = pinkR; tg = pinkG; tb = pinkB;
          }
      } else {
          // Revert to Tree Colors
          tr = baseColors[i3];
          tg = baseColors[i3+1];
          tb = baseColors[i3+2];
      }

      // Lerp Color
      const colorLerpSpeed = 0.05;
      currentColors[i3] += (tr - currentColors[i3]) * colorLerpSpeed;
      currentColors[i3+1] += (tg - currentColors[i3+1]) * colorLerpSpeed;
      currentColors[i3+2] += (tb - currentColors[i3+2]) * colorLerpSpeed;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    const sizeArray = sizeAttr.array as Float32Array;
    
    // 1. Ornaments blinking
    for(let idx of lightIndices) {
        const blink = 0.8 + 0.6 * Math.sin(time * 3 + idx * 0.1); 
        sizeArray[idx] = baseSizes[idx] * blink;
    }

    // 2. Spiral flowing effect
    if (mode === 'TREE') {
        for(let idx of spiralIndices) {
            const twinkle = 0.8 + 0.4 * Math.sin(time * 8 + idx * 0.5);
            const normIdx = (idx - TREE_PARTICLE_COUNT) / SPIRAL_PARTICLE_COUNT;
            const flow = 1.0 + 0.3 * Math.sin(time * 3 - normIdx * 10);
            
            sizeArray[idx] = baseSizes[idx] * twinkle * flow;
        }
    } else {
        for(let idx of spiralIndices) {
            sizeArray[idx] = baseSizes[idx];
        }
    }

    sizeAttr.needsUpdate = true;
    
    // --- GLOBAL ROTATION LOGIC (Synced with InstaxGallery) ---
    if (mode === 'TREE') {
        let rotationSpeed = 0.25; // Base idle spin speed
        
        // FIST Gesture Directional Spin Control (Momentum-based)
        if (gesture === GestureType.FIST && targetPos) {
            // Calculate velocity (dx)
            const dx = targetPos.x - lastXRef.current;
            
            // Apply impulse to momentum (Sensitivity factor)
            // Moving hand left (dx < 0) adds negative momentum -> Spin Left (CW)
            // Moving hand right (dx > 0) adds positive momentum -> Spin Right (CCW)
            if (Math.abs(dx) > 0.001) {
                momentumRef.current += dx * 35.0; // Increased sensitivity from 20 to 35
            }
            
            lastXRef.current = targetPos.x;
        } else {
            // Sync last position when not interacting to prevent jumps on next grab
            if (targetPos) lastXRef.current = targetPos.x;
        }

        // Apply Momentum + Friction
        momentumRef.current *= 0.92; // Decay factor (simulates friction)
        rotationSpeed += momentumRef.current; // Add momentum to base speed

        rotationRef.current += rotationSpeed * delta;
        pointsRef.current.rotation.y = rotationRef.current;
        
        // Star Breathing Animation
        if (starGroupRef.current) {
            starGroupRef.current.position.y = 5.6 + Math.sin(time * 1.5) * 0.05;
            
            // Re-enable visibility just in case we came back from a mode where it was hidden
            // Although we handle scale below, ensure visible property is true
            starGroupRef.current.visible = true;

            const breath = (Math.sin(time * 1.5) + 1) * 0.5; 
            const scalePulse = 0.93 + breath * 0.1; 
            const opacityPulse = 0.5 + breath * 0.5; 
            const lightIntensity = 4.0 + breath * 3.0;
            
            // Scale Back UP if it was hidden (Fix for disappearing star)
            // Linear interpolation towards 1 (or slightly pulsing scale)
            starGroupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);

            if (starHaloRef.current) {
                starHaloRef.current.scale.set(scalePulse, scalePulse, 1);
                starHaloRef.current.material.opacity = opacityPulse;
                starHaloRef.current.material.rotation += 0.005; 
            }
            if (starLightRef.current) {
                starLightRef.current.intensity = lightIntensity;
            }
        }
    } else {
        // Reset rotation in other modes
        pointsRef.current.rotation.y += (0 - pointsRef.current.rotation.y) * 0.1;
        
        if (starGroupRef.current) {
            // Shrink away when not in Tree mode
            starGroupRef.current.scale.lerp(new THREE.Vector3(0, 0, 0), 0.1);
        }
    }
  });

  return (
    <group>
        <points 
            ref={pointsRef} 
            onClick={(e) => {
                if(onTreeClick) {
                    e.stopPropagation();
                    onTreeClick();
                }
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
        <bufferGeometry>
            <bufferAttribute
            attach="attributes-position"
            count={TOTAL_PARTICLE_COUNT}
            array={currentPositions}
            itemSize={3}
            />
            <bufferAttribute
            attach="attributes-color"
            count={TOTAL_PARTICLE_COUNT}
            array={colors}
            itemSize={3}
            />
            <bufferAttribute
            attach="attributes-size" 
            count={TOTAL_PARTICLE_COUNT}
            array={sizes}
            itemSize={1}
            />
        </bufferGeometry>
        <pointsMaterial
            vertexColors
            size={0.12}
            sizeAttenuation={true}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            transparent={true}
            opacity={0.9}
            map={particleTexture} 
        />
        </points>
        
        {/* Breathing Star Light Source - Color changed to Pure White (#FFFFFF) */}
        <group ref={starGroupRef} position={[0, 5.6, 0]}>
            <pointLight ref={starLightRef} distance={10} color="#FFFFFF" decay={1.5} />
            <sprite ref={starHaloRef} scale={[0.93, 0.93, 1]} position={[0, 0, 0]}>
                <spriteMaterial 
                    map={starTexture} 
                    transparent 
                    opacity={0.9} 
                    depthWrite={false} 
                    blending={THREE.AdditiveBlending} 
                />
            </sprite>
        </group>
    </group>
  );
};

export default TreeParticles;