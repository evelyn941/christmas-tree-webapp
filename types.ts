export enum GestureType {
  NONE = 'NONE',
  OPEN_HAND = 'OPEN_HAND', // Scatter
  FIST = 'FIST', // Tree
  HEART = 'HEART', // "Qiu"
  SCISSORS = 'SCISSORS', // "Merry Christmas"
  OK = 'OK', // Select Photo
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface ParticleConfig {
  count: number;
  color: string;
  size: number;
}

export interface InstaxPhoto {
  id: number;
  url: string;
  rotation: [number, number, number];
  position: [number, number, number];
}

export type ParticleMode = 'TREE' | 'SCATTER' | 'HEART' | 'TEXT_MERRY' | 'TEXT_QIU';

export interface GestureState {
    gesture: GestureType;
    center: { x: number, y: number };
    handSize: number; // 0 to ~1, proxy for Z-depth (how close hand is to camera)
}