import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { GestureType, HandLandmark, GestureState } from '../types';

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
      numHands: 2 // CHANGED: Enable 2 hands detection
    });
  }

  setVideoElement(video: HTMLVideoElement) {
    this.videoElement = video;
  }

  detect(): GestureState | null {
    if (!this.handLandmarker || !this.videoElement || this.videoElement.readyState < 2) return null;

    const startTimeMs = performance.now();
    const result = this.handLandmarker.detectForVideo(this.videoElement, startTimeMs);

    if (result.landmarks && result.landmarks.length > 0) {
      const landmarksList = result.landmarks;

      // --- CHECK FOR TWO-HANDED GESTURES FIRST ---
      if (landmarksList.length === 2) {
          const hand1 = landmarksList[0];
          const hand2 = landmarksList[1];

          if (this.isTwoHandHeart(hand1, hand2)) {
               // Calculate center between both hands
               const centerX = (hand1[9].x + hand2[9].x) / 2;
               const centerY = (hand1[9].y + hand2[9].y) / 2;
               // Average size
               const size1 = this.calculateHandSize(hand1);
               const size2 = this.calculateHandSize(hand2);

               return {
                   gesture: GestureType.HEART,
                   center: { x: centerX, y: centerY },
                   handSize: (size1 + size2) / 2
               };
          }
      }

      // --- FALLBACK TO SINGLE HAND GESTURE ---
      // We prioritize the first detected hand
      const landmarks = landmarksList[0];
      const gesture = this.classifyGesture(landmarks);
      
      // Calculate approximate center of hand (using wrist and middle finger mcp)
      const centerX = (landmarks[0].x + landmarks[9].x) / 2;
      const centerY = (landmarks[0].y + landmarks[9].y) / 2;

      const handSize = this.calculateHandSize(landmarks);

      return { gesture, center: { x: centerX, y: centerY }, handSize };
    }

    return { gesture: GestureType.NONE, center: { x: 0.5, y: 0.5 }, handSize: 0 };
  }

  private calculateHandSize(landmarks: HandLandmark[]): number {
      // Distance from Wrist(0) to Middle Finger Tip(12)
      return Math.hypot(landmarks[0].x - landmarks[12].x, landmarks[0].y - landmarks[12].y);
  }

  private isTwoHandHeart(hand1: HandLandmark[], hand2: HandLandmark[]): boolean {
      // 1. Check Index Tips Proximity (Indices 8)
      const indexDist = this.getDistance(hand1[8], hand2[8]);
      
      // 2. Check Thumb Tips Proximity (Indices 4)
      const thumbDist = this.getDistance(hand1[4], hand2[4]);

      // Thresholds - normalized coordinates, so 0.1 is roughly 10% of screen width
      const TOUCH_THRESHOLD = 0.15; 

      // 3. Basic Check: Tips must be close
      if (indexDist < TOUCH_THRESHOLD && thumbDist < TOUCH_THRESHOLD) {
          // 4. Orientation Check: 
          // For a proper heart, the wrists should be lower than the fingertips
          // Y is 0 at top, 1 at bottom. So Wrist Y > Tip Y
          const wristsLower = hand1[0].y > hand1[8].y && hand2[0].y > hand2[8].y;
          return wristsLower;
      }

      return false;
  }

  private classifyGesture(landmarks: HandLandmark[]): GestureType {
    // Fingers state: true if extended
    const thumbIsOpen = this.isThumbOpen(landmarks);
    const indexIsOpen = this.isFingerOpen(landmarks, 8, 6, 5);
    const middleIsOpen = this.isFingerOpen(landmarks, 12, 10, 9);
    const ringIsOpen = this.isFingerOpen(landmarks, 16, 14, 13);
    const pinkyIsOpen = this.isFingerOpen(landmarks, 20, 18, 17);

    // Calculate distance between Thumb Tip (4) and Index Tip (8)
    const pinchDistance = this.getDistance(landmarks[4], landmarks[8]);
    const isPinch = pinchDistance < 0.05;

    // 1. FIST: All fingers closed
    if (!indexIsOpen && !middleIsOpen && !ringIsOpen && !pinkyIsOpen && !thumbIsOpen) {
      return GestureType.FIST;
    }

    // 2. OPEN HAND: All fingers open (and not a pinch)
    if (indexIsOpen && middleIsOpen && ringIsOpen && pinkyIsOpen && thumbIsOpen && !isPinch) {
      return GestureType.OPEN_HAND;
    }

    // 3. SCISSORS (Victory): Index and Middle open, others closed
    if (indexIsOpen && middleIsOpen && !ringIsOpen && !pinkyIsOpen && !isPinch) {
      return GestureType.SCISSORS;
    }

    // 4. OK GESTURE: Thumb & Index touching (Pinch), but other fingers are OPEN
    if (isPinch && middleIsOpen && ringIsOpen && pinkyIsOpen) {
        return GestureType.OK;
    }

    return GestureType.NONE;
  }

  private isFingerOpen(landmarks: HandLandmark[], tipIdx: number, dipIdx: number, pipIdx: number): boolean {
    // Check if tip is above PIP (assuming hand is upright). 
    // Y coordinates are normalized [0,1], 0 is top. So Tip Y < PIP Y means tip is higher.
    return landmarks[tipIdx].y < landmarks[pipIdx].y;
  }
  
  private isThumbOpen(landmarks: HandLandmark[]): boolean {
      // Thumb is tricky depending on orientation, checking x distance from pinky base
      return Math.abs(landmarks[4].x - landmarks[17].x) > 0.15; // Simple heuristic
  }

  private getDistance(p1: HandLandmark, p2: HandLandmark) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
  }
}

export const gestureService = new GestureService();