/**
 * ASSETS MANAGEMENT
 * -----------------
 * This file is where you import your local images.
 * 
 * INSTRUCTIONS:
 * 1. Create a folder named 'images' inside your 'src' folder (or alongside this file).
 * 2. Put your background image (e.g., 'bg.jpg') and photos (e.g., '1.jpg', '2.jpg') there.
 * 3. Uncomment the import lines below and add them to the arrays.
 */

// --- 1. IMPORT BACKGROUND ---
// import myBackground from './images/bg.jpg'; 

// --- 2. IMPORT PHOTOS ---
// import p1 from './images/1.jpg';
// import p2 from './images/2.jpg';
// import p3 from './images/3.jpg';
// import p4 from './images/4.jpg';
// import p5 from './images/5.jpg';

// --- 3. IMPORT MUSIC ---
// import myMusic from './images/song.mp3'; // Or ./audio/song.mp3 if you made an audio folder


/**
 * EXPORT BACKGROUND
 * Set this to `myBackground` (or whatever you named the import above).
 * If null, it uses the default dark green 3D scene.
 */
export const USER_BACKGROUND: string | null = null; 

/**
 * EXPORT PHOTOS
 * Add your imported photo variables to this array.
 * Example: [p1, p2, p3, p4, p5]
 * 
 * If this array is empty [], the app will load the random internet placeholders.
 */
export const USER_PHOTOS: string[] = [
    // p1, p2, p3...
];

/**
 * EXPORT MUSIC
 * Set this to `myMusic` (or whatever you named the import above).
 * Supported formats: .mp3, .wav, .ogg, .m4a
 */
export const USER_MUSIC: string | null = null; 
