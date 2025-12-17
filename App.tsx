import React, { useState, Suspense, useCallback, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import CameraFeed from './components/CameraFeed';
import TreeParticles from './components/TreeParticles';
import InstaxGallery from './components/InstaxGallery';
import Snow from './components/Snow';
import PhotoViewer from './components/PhotoViewer';
import LotteryOverlay from './components/LotteryOverlay';
import { GestureType, ParticleMode, InstaxPhoto } from './types';
import { COLORS, FALLBACK_PHOTOS, generatePhotoPositions } from './constants';
import { USER_PHOTOS, USER_BACKGROUND, USER_MUSIC } from './assets';

const GesturePanel: React.FC<{ activeGesture: GestureType }> = ({ activeGesture }) => {
  const items = [
    { id: GestureType.FIST, label: 'ASSEMBLE', icon: '\uD83D\uDC4A' }, // Fist
    { id: GestureType.OPEN_HAND, label: 'SCATTER', icon: '\u270B' },   // Hand
    { id: GestureType.HEART, label: 'Rua Says', icon: '\uD83E\uDEF6' }, // Heart Hands
    { id: GestureType.SCISSORS, label: 'WISH', icon: '\u270C\uFE0F' }, // Victory
  ];

  return (
    <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none select-none w-full sm:w-auto flex justify-center">
       <div className="flex items-center gap-4 sm:gap-10 px-6 py-3 sm:px-10 sm:py-5 bg-black/30 backdrop-blur-md border border-white/10 rounded-[15px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] transform scale-90 sm:scale-100 origin-bottom">
          {items.map((item) => {
             const isActive = activeGesture === item.id;
             return (
               <div key={item.id} className={`flex flex-col items-center gap-1 sm:gap-3 transition-all duration-500 ${isActive ? 'scale-110 opacity-100' : 'opacity-70 hover:opacity-100'}`}>
                  <span className={`text-2xl sm:text-4xl transition-transform duration-300 filter drop-shadow-lg ${isActive ? 'animate-pulse brightness-125' : 'brightness-90 grayscale-[0.3]'}`}>
                    {item.icon}
                  </span>
                  <span className={`text-[8px] sm:text-[11px] font-['Cinzel'] tracking-[0.25em] font-bold transition-colors duration-300 ${isActive ? 'text-[#6abce2] drop-shadow-[0_0_10px_rgba(106,188,226,0.8)]' : 'text-white'}`}>
                    {item.label}
                  </span>
                  {/* Active Indicator Dot */}
                  <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#6abce2] shadow-[0_0_10px_#6abce2] transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
               </div>
             )
          })}
       </div>
    </div>
  );
};

// --- SETTINGS / UPLOAD PANEL ---
const SettingsPanel: React.FC<{ 
    onUploadBackground: (file: File) => void,
    onUploadPhotos: (files: FileList) => void 
}> = ({ onUploadBackground, onUploadPhotos }) => {
    const [isOpen, setIsOpen] = useState(false);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const photosInputRef = useRef<HTMLInputElement>(null);

    return (
        // Positioned below the video feed (top-24 mobile, top-44 desktop) and aligned right
        <div className="absolute top-24 right-4 sm:top-44 sm:right-4 z-50">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-black/40 border border-white/20 text-white hover:bg-white/10 transition-colors backdrop-blur-sm"
            >
                ⚙️
            </button>
            {isOpen && (
                <div className="absolute top-12 right-0 w-56 sm:w-64 bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg p-3 sm:p-4 shadow-2xl flex flex-col gap-4">
                    <h3 className="text-white/80 font-['Cinzel'] text-xs tracking-widest border-b border-white/10 pb-2">CUSTOMIZE</h3>
                    
                    {/* Background Upload */}
                    <div className="flex flex-col gap-2">
                        <label className="text-white/60 text-xs">Background Image</label>
                        <button 
                            onClick={() => bgInputRef.current?.click()}
                            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded text-xs text-white transition-colors text-left"
                        >
                            Upload Background
                        </button>
                        <input 
                            ref={bgInputRef} 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                                if(e.target.files?.[0]) {
                                    onUploadBackground(e.target.files[0]);
                                    setIsOpen(false);
                                }
                            }}
                        />
                    </div>

                    {/* Photos Upload */}
                    <div className="flex flex-col gap-2">
                        <label className="text-white/60 text-xs">Memory Photos</label>
                        <button 
                            onClick={() => photosInputRef.current?.click()}
                            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded text-xs text-white transition-colors text-left"
                        >
                            Upload Memories
                        </button>
                        <input 
                            ref={photosInputRef} 
                            type="file" 
                            accept="image/*" 
                            multiple
                            className="hidden" 
                            onChange={(e) => {
                                if(e.target.files && e.target.files.length > 0) {
                                    onUploadPhotos(e.target.files);
                                    setIsOpen(false);
                                }
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// --- MUSIC CONTROL BUTTON ---
const MusicControl: React.FC = () => {
    const [audio] = useState(() => {
        if (!USER_MUSIC) return null;
        const a = new Audio(USER_MUSIC);
        a.loop = true;
        a.volume = 0.5;
        return a;
    });
    const [isPlaying, setIsPlaying] = useState(false);

    const toggleMusic = () => {
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(e => console.log("Audio playback failed:", e));
        }
        setIsPlaying(!isPlaying);
    };

    if (!audio) return null;

    return (
        // Positioned next to Settings (Left of it)
        <div className="absolute top-24 right-14 sm:top-44 sm:right-16 z-50">
            <button 
                onClick={toggleMusic}
                className={`
                    w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full 
                    border border-white/20 text-white transition-colors backdrop-blur-sm
                    ${isPlaying ? 'bg-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-black/40 hover:bg-white/10'}
                `}
            >
                {isPlaying ? '🔊' : '🔇'}
            </button>
        </div>
    );
};


// --- CONFIGURATION ---
const SCATTER_ZOOM_IDLE = 17;   // Camera Z when hand is far/absent
const SCATTER_ZOOM_ACTIVE = 10; // Camera Z when hand is very close

// --- Camera Controller based on Hand Depth ---
const CameraRig: React.FC<{ mode: ParticleMode; handSize: number }> = ({ mode, handSize }) => {
  const { camera } = useThree();
  const targetZ = useRef(12); // Default resting position

  useFrame((state, delta) => {
    // Only zoom in SCATTER / OPEN_HAND mode
    if (mode === 'SCATTER' || mode === 'OPEN_HAND') {
       const MIN_HAND = 0.05;
       const MAX_HAND = 0.35;
       
       // Normalize hand size 0 to 1
       const t = Math.max(0, Math.min(1, (handSize - MIN_HAND) / (MAX_HAND - MIN_HAND)));
       
       // Invert logic: t=1 (Close hand) should be min Z value
       targetZ.current = SCATTER_ZOOM_IDLE - (t * (SCATTER_ZOOM_IDLE - SCATTER_ZOOM_ACTIVE));
    } else {
       // Reset to default in Tree mode
       targetZ.current = 12;
    }

    // Smooth Camera Movement
    // Use a dampening factor for cinematic smoothness
    const damping = 2.0; 
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ.current, damping * delta);
  });

  return null;
};

// Component to handle the 3D Scene Background Image
const SceneBackground: React.FC<{ imageUrl: string | null }> = ({ imageUrl }) => {
    const { scene } = useThree();
    const textureLoader = useMemo(() => new THREE.TextureLoader(), []);

    useEffect(() => {
        if (imageUrl) {
            textureLoader.load(imageUrl, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                scene.background = texture;
            });
        } else {
            scene.background = new THREE.Color(COLORS.BG_DARK);
        }
    }, [imageUrl, scene, textureLoader]);

    return null;
}

const App: React.FC = () => {
  const [gesture, setGesture] = useState<GestureType>(GestureType.NONE);
  const [handPos, setHandPos] = useState<{ x: number, y: number }>({ x: 0.5, y: 0.5 });
  const [handSize, setHandSize] = useState<number>(0);
  
  // Customization State
  // 1. Initialize Background with User Asset or Null
  const [bgImage, setBgImage] = useState<string | null>(USER_BACKGROUND);

  // 2. Initialize Photos with User Assets (if exist) or Fallback
  const [galleryPhotos, setGalleryPhotos] = useState<InstaxPhoto[]>(() => {
      // If user provided photos in assets.ts
      if (USER_PHOTOS.length > 0) {
          const positions = generatePhotoPositions(USER_PHOTOS.length);
          return USER_PHOTOS.map((url, i) => ({
              id: i,
              url: url,
              position: positions[i].position,
              rotation: positions[i].rotation
          }));
      }
      // Otherwise use the fallback constants
      return FALLBACK_PHOTOS;
  });

  // Manual overrides & Modes
  const [overrideMode, setOverrideMode] = useState<ParticleMode | null>(null);
  const [activeFocusId, setActiveFocusId] = useState<number | null>(null); // For 3D Focus
  
  // Lottery State
  const [isLotteryOpen, setIsLotteryOpen] = useState(false);
  const [lotteryHistory, setLotteryHistory] = useState<string[]>([]);
  const MAX_CHANCES = 5;

  // Mouse vs Camera Priority
  const lastMouseTime = useRef<number>(0);

  // Debouncing refs to prevent mode flickering
  const pendingGestureRef = useRef<GestureType>(GestureType.NONE);
  const gestureStartTimeRef = useRef<number>(0);

  // Map Gesture to Mode
  const getMode = (): ParticleMode => {
    // 0. If Lottery is active, force Tree or maintain current visual, but logically standard.
    if (isLotteryOpen) return 'TREE';

    // 1. Priority Gestures: Always activate regardless of override status
    if (gesture === GestureType.HEART) return 'HEART';

    // 2. Overrides (e.g., clicked to Scatter)
    if (overrideMode) return overrideMode;

    // 3. Standard Mapping
    switch (gesture) {
      case GestureType.OPEN_HAND: return 'SCATTER';
      case GestureType.FIST: return 'TREE';
      // SCISSORS (V-Sign) now triggers UI, not a particle mode directly, 
      // but we can map it to TREE while the UI handles the interaction
      case GestureType.SCISSORS: return 'TREE'; 
      default: return 'TREE'; // Default state
    }
  };

  const mode = getMode();

  // Optimized Gesture Handling with Debounce
  const handleGestureChange = useCallback((newGesture: GestureType, newPos: { x: number, y: number }, newSize: number) => {
    // BLOCK interactions if lottery is running
    // EXCEPTION: We still need to track position and gesture inside lottery for the cursor
    // But we don't want to trigger 3D mode switches.
    const now = Date.now();

    // 1. GESTURE STABILIZATION (Debounce)
    if (newGesture !== pendingGestureRef.current) {
        pendingGestureRef.current = newGesture;
        gestureStartTimeRef.current = now;
    } else {
        // Only apply gesture if it has been stable for 200ms
        if (now - gestureStartTimeRef.current > 200) {
            setGesture(newGesture);
            
            // SPECIAL TRIGGER: SCISSORS -> LOTTERY
            // Always allow trigger, LotteryOverlay will handle logic if 0 chances left
            if (!isLotteryOpen && newGesture === GestureType.SCISSORS) {
                setIsLotteryOpen(true);
            }
        }
    }
    
    // 2. HAND POSITION
    // Only update position from camera if mouse hasn't moved recently (1.5s)
    if (now - lastMouseTime.current > 1500) {
        setHandPos(newPos);
    }

    // 3. HAND SIZE (ZOOM) SMOOTHING
    setHandSize(prev => {
        if (newSize === 0) {
            return Math.max(0, prev - 0.05); // Decay
        }
        return newSize;
    });

    // 4. OVERRIDE RESET LOGIC (Based on stable gesture)
    if (!isLotteryOpen) {
        if (newGesture === GestureType.FIST && now - gestureStartTimeRef.current > 200) {
            setOverrideMode(null);
            setActiveFocusId(null);
        }
        if (newGesture === GestureType.OPEN_HAND && now - gestureStartTimeRef.current > 200) {
            setOverrideMode('SCATTER');
        }
    }
  }, [isLotteryOpen, lotteryHistory]);

  const handleMouseMove = (e: React.MouseEvent) => {
      // Allow mouse movement even if lottery is open, so cursor works with mouse too
      lastMouseTime.current = Date.now();
      // Normalize to 0..1
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      setHandPos({ x, y });
  };

  const handleCanvasClick = () => {
      if (activeFocusId !== null) {
          setActiveFocusId(null);
      }
  };

  const handleTreeClick = () => {
      if (mode === 'TREE' && !isLotteryOpen) {
          setOverrideMode('SCATTER');
      }
  };

  const handlePhoto3DClick = (id: number) => {
      if (!isLotteryOpen) {
          setActiveFocusId(prev => prev === id ? null : id);
      }
  };

  const handleLotteryComplete = (prize: string | null) => {
      if (prize) {
          setLotteryHistory(prev => [...prev, prize]);
      }
      setIsLotteryOpen(false);
      // Reset gesture to avoid immediate re-trigger
      setGesture(GestureType.NONE); 
      pendingGestureRef.current = GestureType.NONE;
  };

  // --- UPLOAD HANDLERS ---
  const handleUploadBackground = (file: File) => {
      const url = URL.createObjectURL(file);
      setBgImage(url);
  };

  const handleUploadPhotos = (files: FileList) => {
      const newPhotos: InstaxPhoto[] = [];
      const count = files.length;
      
      // Calculate positions using the helper from constants
      const positions = generatePhotoPositions(count);

      Array.from(files).forEach((file, index) => {
          const url = URL.createObjectURL(file);
          const posData = positions[index];
          newPhotos.push({
              id: index,
              url: url,
              position: posData.position,
              rotation: posData.rotation
          });
      });
      setGalleryPhotos(newPhotos);
  };

  return (
    <div 
        className="w-full h-screen relative bg-[#020502]"
        onMouseMove={handleMouseMove}
        onClick={handleCanvasClick} // Catch background clicks
    >
      {/* --- UI LAYER --- */}
      
      {/* Title */}
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-40 text-[#e0f2fe] pointer-events-none select-none">
         <h1 
           className="text-4xl sm:text-7xl tracking-normal drop-shadow-[0_0_15px_rgba(106,188,226,0.8)]"
           style={{ fontFamily: '"Pinyon Script", cursive' }}
         >
           Qiu's Christmas Gift
         </h1>
      </div>

      {/* Settings / Uploads */}
      <SettingsPanel 
        onUploadBackground={handleUploadBackground} 
        onUploadPhotos={handleUploadPhotos}
      />

      {/* Music Control */}
      <MusicControl />

      {/* Gesture Control Panel */}
      <GesturePanel activeGesture={gesture} />

      {/* Lottery Overlay (Cinematic Prize Reveal) */}
      <LotteryOverlay 
        isOpen={isLotteryOpen} 
        onClose={handleLotteryComplete} 
        gesture={gesture}
        handPos={handPos}
        history={lotteryHistory}
        remainingChances={MAX_CHANCES - lotteryHistory.length}
      />

      {/* Camera Feed */}
      <CameraFeed 
        onGestureChange={handleGestureChange} 
      />

      {/* --- 3D SCENE --- */}
      <Canvas 
        dpr={[1, 2]} 
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2, antialias: false }}
        // We handle mouse move on parent div to cover UI too, but click raycasting handled by components
      >
        <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={50} />
        
        {/* Environment */}
        <SceneBackground imageUrl={bgImage} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        {/* Fog should adapt to background image presence, but for now keeping it dark for contrast */}
        <fog attach="fog" args={[COLORS.BG_DARK, 8, 30]} />

        {/* Lights */}
        <ambientLight intensity={0.5} color="#FFFFFF" />
        <spotLight 
          position={[10, 10, 10]} 
          angle={0.15} 
          penumbra={1} 
          intensity={1} 
          color={COLORS.GOLD} 
          castShadow 
        />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="blue" />

        {/* Content */}
        <Suspense fallback={null}>
          <group position={[0, -2, 0]}>
             <TreeParticles 
                mode={mode} 
                targetPos={handPos} 
                gesture={gesture} 
                onTreeClick={handleTreeClick}
             />
             <InstaxGallery 
                photos={galleryPhotos}
                mode={mode}
                onPhotoClick={handlePhoto3DClick} 
                gesture={gesture}
                handPos={handPos}
                handSize={handSize}
                activeFocusId={activeFocusId}
             />
             <Snow />
          </group>
        </Suspense>

        <CameraRig mode={mode} handSize={handSize} />

        {/* Controls */}
        <OrbitControls 
          enablePan={false} 
          enableZoom={true} 
          enableRotate={false} // Disable orbit rotation so mouse moves cursor/gallery instead
          maxDistance={45} 
          minDistance={4} 
        />

        {/* Post Processing */}
        <EffectComposer enableNormalPass={false}>
           <Bloom 
             luminanceThreshold={0.2} 
             mipmapBlur 
             intensity={1.5} 
             radius={0.4}
           />
           <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default App;