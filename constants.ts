
/**
 * ASSETS MANAGEMENT
 */

import { InstaxPhoto } from './types';

export const USER_BACKGROUND: string | null = null; 
export const USER_PHOTOS: string[] = [];
export const USER_MUSIC: string | null = null;

// --- PARTICLE SYSTEM CONSTANTS ---
export const TREE_PARTICLE_COUNT = 15000;
export const SPIRAL_PARTICLE_COUNT = 3000;
export const EXTRA_BLUE_COUNT = 500;
export const EXTRA_PURPLE_COUNT = 500;
export const EXTRA_PINK_COUNT = 500;
export const SNOW_COUNT = 1000;

export const COLORS = {
  BG_DARK: '#020502',
  GOLD: '#D1D5DB', // Changed from gold to a silver/grey to match the icy theme
  LIGHT_GOLD: '#FCFCFF', // Changed to pure silver-white
  LIGHT_WHITE: '#F0F4F8',
};

// HELPER: Calculate tree radius at height y (Tree height from -1.5 to 5.5)
const getTreeRadiusAtY = (y: number) => {
  const treeBaseY = -1.5;
  const treeTotalHeight = 7.0;
  let relH = (y - treeBaseY) / treeTotalHeight;
  if (relH < 0) relH = 0;
  if (relH > 1) relH = 1;
  return 3.5 * (1 - Math.pow(relH, 0.9));
};

export const generatePhotoPositions = (count: number) => {
  return Array.from({ length: count }).map((_, i) => {
    // Spiral distribution
    const norm = i / count;
    const angle = norm * Math.PI * 2 * 3.5 + (Math.random() * 0.5); // 3.5 rotations
    const y = -1.5 + (norm * 6.0); // Spread across the tree height
    
    // Position photos slightly embedded into the foliage for "attachment" feel
    const treeRadius = getTreeRadiusAtY(y);
    const radius = treeRadius * 0.95 + (Math.random() * 0.2); 

    return {
      position: [
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      ] as [number, number, number],
      rotation: [0, -angle, 0] as [number, number, number]
    };
  });
};

export const FALLBACK_PHOTOS: InstaxPhoto[] = Array.from({ length: 14 }).map((_, i) => {
    const norm = i / 14;
    const angle = norm * Math.PI * 2 * 3.5;
    const y = -1.2 + (norm * 5.8);
    const treeRadius = getTreeRadiusAtY(y);
    const radius = treeRadius * 0.95;

    return {
        id: i,
        url: `https://picsum.photos/seed/${i + 123}/600/800`,
        position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
        rotation: [0, -angle, 0]
    };
});
