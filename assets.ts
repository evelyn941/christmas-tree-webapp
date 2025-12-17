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
 // Background image import commented out until you add ./images/bg.png to the project.
import myBackground from './images/bg.png'; 

// --- 2. IMPORT PHOTOS ---
import p1 from './images/1.jpg';
import p2 from './images/2.jpg';
import p3 from './images/3.jpg';
import p4 from './images/4.jpg';
import p5 from './images/5.jpg';
import p6 from './images/6.jpg';
import p7 from './images/7.jpg';
import p8 from './images/8.jpg';
import p9 from './images/9.png';
import p10 from './images/10.jpg';
import p11 from './images/11.jpg';
import p12 from './images/12.jpg';
import p13 from './images/13.jpg';
import p14 from './images/14.jpg';
import p15 from './images/15.jpg';
import p16 from './images/16.jpg';
import p17 from './images/17.jpg';
import p18 from './images/18.jpg';
import p19 from './images/19.jpg';
import p20 from './images/20.jpg';

// --- 3. IMPORT MUSIC ---
import myMusic from './images/song.mp3'; // Or ./audio/song.mp3 if you made an audio folder


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
//p1, p2, p3, p4, p5, p6, p7, p8, p9, p10,
//p11, p12, p13, p14, p15, p16, p17, p18, p19, p20
];

/**
 * EXPORT MUSIC
 * Set this to `myMusic` (or whatever you named the import above).
 * Supported formats: .mp3, .wav, .ogg, .m4a
 */
export const USER_MUSIC: string | null = null; 
