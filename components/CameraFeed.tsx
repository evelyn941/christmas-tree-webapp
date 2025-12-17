import React, { useEffect, useRef, useState } from 'react';
import { gestureService } from '../services/gestureService';
import { GestureType } from '../types';

interface CameraFeedProps {
  onGestureChange: (gesture: GestureType, position: { x: number, y: number }, handSize: number) => void;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ onGestureChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Request Camera Access first (fails fast if denied)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 320, 
          height: 240,
          frameRate: { ideal: 30 }
        } 
      });

      // 2. Initialize Vision Model
      await gestureService.initialize();
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
           videoRef.current?.play();
           gestureService.setVideoElement(videoRef.current!);
           setPermissionGranted(true);
           setLoading(false);
           
           // Start detection loop
           const detectLoop = () => {
             const result = gestureService.detect();
             if (result) {
               // Mirror X coordinate (1 - x) to match the CSS mirrored video feed
               const mirroredPos = { x: 1 - result.center.x, y: result.center.y };
               onGestureChange(result.gesture, mirroredPos, result.handSize);
             }
             requestAnimationFrame(detectLoop);
           };
           detectLoop();
        };
      }
    } catch (err: any) {
      console.error("Camera access denied or error:", err);
      setLoading(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError("Camera permission denied.");
      } else {
          setError("Camera unavailable.");
      }
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
        const stream = videoRef.current?.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
    };
  }, [onGestureChange]);

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="relative rounded-xl sm:rounded-2xl overflow-hidden border-2 border-amber-400/50 shadow-[0_0_20px_rgba(255,215,0,0.3)] bg-black/50 w-24 h-18 sm:w-48 sm:h-36 backdrop-blur-sm transition-all duration-300">
        <video 
          ref={videoRef} 
          className={`w-full h-full object-cover transform -scale-x-100 ${loading || error ? 'opacity-0' : 'opacity-100'}`}
          playsInline
          muted
        />
        
        {loading && !error && (
           <div className="absolute inset-0 flex items-center justify-center text-amber-300 text-[8px] sm:text-xs font-serif text-center">
             Initializing...
           </div>
        )}

        {error && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-2 z-10 pointer-events-auto">
             <div className="text-red-400 text-[8px] sm:text-xs font-serif text-center mb-1 sm:mb-2 leading-tight">
               {error}
             </div>
             <button 
                onClick={startCamera}
                className="px-2 py-0.5 sm:px-3 sm:py-1 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 rounded text-amber-200 text-[8px] sm:text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
             >
                Retry
             </button>
           </div>
        )}

        {!loading && !permissionGranted && !error && (
           <div className="absolute inset-0 flex items-center justify-center text-red-400 text-[8px] sm:text-xs font-serif text-center p-2">
             Disconnected
           </div>
        )}

        <div className="absolute bottom-1 right-2 text-[8px] sm:text-[10px] text-amber-200/80 font-mono tracking-widest pointer-events-none hidden sm:block">
            {permissionGranted ? "SYSTEM ONLINE" : "OFFLINE"}
        </div>
      </div>
    </div>
  );
};

export default CameraFeed;