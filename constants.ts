import { InstaxPhoto } from './types';

// Palette
export const COLORS = {
  EMERALD: '#2ECC71', 
  DARK_GREEN: '#013220',
  GOLD: '#FFD700', 
  TRUNK: '#4B3621',
  BG_DARK: '#020502',
  LIGHT_RED: '#FF4444',
  LIGHT_BLUE: '#4444FF', 
  LIGHT_WHITE: '#FFFFFF',
  LIGHT_PURPLE: '#AA44FF', 
  LIGHT_GOLD: '#FFFACD', 
  NEON_BLUE: '#00BFFF',
  NEON_PURPLE: '#BF00FF',
  NEON_PINK: '#FF1493',
};

// Particle Counts
export const TREE_PARTICLE_COUNT = 5000;
export const SPIRAL_PARTICLE_COUNT = 2500; 
export const SNOW_COUNT = 500;
export const ORNAMENT_LIGHT_COUNT = 150;

// New Special Lights
export const EXTRA_BLUE_COUNT = 20;
export const EXTRA_PURPLE_COUNT = 10;
export const EXTRA_PINK_COUNT = 10;

// Helper to generate positions for ANY list of photos (Default or User Uploaded)
export const generatePhotoPositions = (count: number): { position: [number, number, number], rotation: [number, number, number] }[] => {
  const positions: { position: [number, number, number], rotation: [number, number, number] }[] = [];
  
  // Tree Dimensions
  const TREE_BASE_Y = -1.5;
  const TREE_HEIGHT = 7.0;
  const MAX_TREE_RADIUS = 3.5;

  // Distribution Configuration
  // We want a few at the top, most at the bottom
  const TOP_PERCENT = 0.25; // 25% at top
  const TOP_COUNT = Math.ceil(count * TOP_PERCENT);
  
  // Y Ranges for distribution
  const TOP_Y_START = 5.0;
  const TOP_Y_END = 2.5;
  const BOTTOM_Y_START = 2.0;
  const BOTTOM_Y_END = -1.2;

  const TOTAL_ROTATIONS = 4.0; 

  for (let i = 0; i < count; i++) {
    let y: number;

    if (i < TOP_COUNT) {
        // Top Batch
        const t = i / (TOP_COUNT - 1 || 1);
        y = TOP_Y_START - t * (TOP_Y_START - TOP_Y_END);
    } else {
        // Bottom Batch
        const bottomIndex = i - TOP_COUNT;
        const bottomTotal = count - TOP_COUNT;
        const t = bottomIndex / (bottomTotal - 1 || 1);
        y = BOTTOM_Y_START - t * (BOTTOM_Y_START - BOTTOM_Y_END);
    }

    // Radius at this height (Outer Tree Line)
    const relHeight = Math.max(0, Math.min(1, (y - TREE_BASE_Y) / TREE_HEIGHT));
    const treeRadiusAtY = MAX_TREE_RADIUS * (1 - Math.pow(relHeight, 0.9));
    
    const r = treeRadiusAtY + 0.02;

    // Angle (Spiral)
    const globalProgress = i / (count - 1 || 1);
    const theta = globalProgress * TOTAL_ROTATIONS * Math.PI * 2;

    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);

    positions.push({
      position: [x, y, z],
      rotation: [0, 0, 0]
    });
  }

  return positions;
};

// Fallback Generator (Used if no user assets are provided)
export const FALLBACK_PHOTOS: InstaxPhoto[] = (() => {
  const TOTAL_PHOTOS = 20;
  const layout = generatePhotoPositions(TOTAL_PHOTOS);

  return layout.map((pos, i) => ({
      id: i,
      url: `https://picsum.photos/400/500?random=${i + 600}`,
      rotation: pos.rotation,
      position: pos.position,
  }));
})();