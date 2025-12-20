
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureType, GestureState } from '../types';

export class GestureService {
  private handLandmarker: HandLandmarker | null = null;
  private runningMode: 'IMAGE' | 'VIDEO' = 'VIDEO';
  private videoElement: HTMLVideoElement | null = null;

  async initialize() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU"
      },
      runningMode: this.runningMode,
      numHands: 2
    });
  }

  setVideoElement(video: HTMLVideoElement) {
    this.videoElement = video;
  }

  detect(): GestureState | null {
    if (!this.handLandmarker || !this.videoElement || this.videoElement.readyState < 2) {
      return null;
    }

    const startTimeMs = performance.now();
    const results = this.handLandmarker.detectForVideo(this.videoElement, startTimeMs);

    if (!results.landmarks || results.landmarks.length === 0) {
      return { gesture: GestureType.NONE, center: { x: 0.5, y: 0.5 }, handSize: 0 };
    }

    // Use the first detected hand for basic gestures
    const hand = results.landmarks[0];
    const wrist = hand[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];

    // Distance helper
    const dist = (p1: { x: number, y: number }, p2: { x: number, y: number }) => 
      Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    // Hand size as proxy for depth
    const handScale = dist(wrist, hand[9]);

    // Simple Finger Extension Logic
    // A finger is "up" if its tip is higher than its PIP joint (approx)
    const isIndexUp = indexTip.y < hand[6].y;
    const isMiddleUp = middleTip.y < hand[10].y;
    const isRingUp = ringTip.y < hand[14].y;
    const isPinkyUp = pinkyTip.y < hand[18].y;

    const upCount = [isIndexUp, isMiddleUp, isRingUp, isPinkyUp].filter(Boolean).length;

    let gesture = GestureType.NONE;

    // 1. HEART (Two hands present)
    if (results.landmarks.length >= 2) {
      gesture = GestureType.HEART;
    } 
    // 2. OK (Thumb and Index tips close)
    else if (dist(thumbTip, indexTip) < 0.04 && isMiddleUp && isRingUp) {
      gesture = GestureType.OK;
    }
    // 3. FIST (All fingers down)
    else if (upCount === 0) {
      gesture = GestureType.FIST;
    }
    // 4. OPEN HAND (All fingers up)
    else if (upCount >= 3) {
      gesture = GestureType.OPEN_HAND;
    }
    // 5. SCISSORS (Index and Middle up)
    else if (upCount === 2 && isIndexUp && isMiddleUp) {
      gesture = GestureType.SCISSORS;
    }

    return {
      gesture,
      center: { x: hand[9].x, y: hand[9].y },
      handSize: handScale
    };
  }
}

export const gestureService = new GestureService();
