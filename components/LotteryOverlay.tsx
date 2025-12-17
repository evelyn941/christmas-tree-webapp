import React, { useEffect, useState, useRef } from 'react';
import { GestureType } from '../types';

interface LotteryOverlayProps {
  isOpen: boolean;
  onClose: (prize: string | null) => void;
  gesture: GestureType;
  handPos: { x: number, y: number };
  history: string[];
  remainingChances: number;
}

// Updated Prize List: Sky Blue (#BAE6FD) and Pale Pink (#FBCFE8)
const PRIZES = [
  { name: "Fogo de Chão 🥩", weight: 20, color: "#BAE6FD" },       
  { name: "PS5 Gift Card 🎮", weight: 20, color: "#BAE6FD" },      
  { name: "Name a Dessert 🍰", weight: 20, color: "#BAE6FD" },     
  { name: "Qiu Be Punished 😈", weight: 20, color: "#FBCFE8" },    
  { name: "Rua Gets a Waiver 🎭", weight: 20, color: "#FBCFE8" },  
];

const LotteryOverlay: React.FC<LotteryOverlayProps> = ({ isOpen, onClose, gesture, handPos, history, remainingChances }) => {
  const [displayPrize, setDisplayPrize] = useState(PRIZES[0]);
  const [isFinished, setIsFinished] = useState(false);
  const [phase, setPhase] = useState<'IDLE' | 'SPINNING' | 'SLOWING' | 'REVEAL' | 'GAME_OVER'>('IDLE');
  
  // Interaction State
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isHoveringButton, setIsHoveringButton] = useState(false);

  // Weighted Random Selection
  const selectWinner = () => {
    const totalWeight = PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const prize of PRIZES) {
      if (random < prize.weight) return prize;
      random -= prize.weight;
    }
    return PRIZES[0];
  };

  useEffect(() => {
    if (isOpen && phase === 'IDLE') {
      if (remainingChances > 0) {
        startLottery();
      } else {
        // No chances left, display game over message immediately
        setPhase('GAME_OVER');
        setDisplayPrize({ name: "ここまでだ", weight: 0, color: "#FFFFFF" });
        setIsFinished(true);
      }
    }
    if (!isOpen) {
        // Reset if closed remotely (although App keeps state, local phase needs reset)
        setPhase('IDLE');
        setIsFinished(false);
    }
  }, [isOpen]);

  // Hand Cursor Interaction Logic
  useEffect(() => {
    if (!isOpen || !isFinished || !buttonRef.current) {
        setIsHoveringButton(false);
        return;
    }

    // Convert normalized handPos (0..1) to screen coordinates
    const screenX = handPos.x * window.innerWidth;
    const screenY = handPos.y * window.innerHeight;

    const rect = buttonRef.current.getBoundingClientRect();
    
    // Check Collision (Simple AABB)
    // Add some padding to make it easier to hit
    const padding = 20;
    const isOver = (
        screenX >= rect.left - padding && 
        screenX <= rect.right + padding &&
        screenY >= rect.top - padding && 
        screenY <= rect.bottom + padding
    );

    setIsHoveringButton(isOver);

    // Trigger Click if hovering and performing a "Select" gesture (FIST or OK)
    if (isOver && (gesture === GestureType.FIST || gesture === GestureType.OK)) {
        // Pass the winner back (or null if game over)
        const result = phase === 'GAME_OVER' ? null : displayPrize.name;
        onClose(result);
    }

  }, [handPos, gesture, isOpen, isFinished, onClose, displayPrize, phase]);

  const startLottery = () => {
    setPhase('SPINNING');
    setIsFinished(false);
    
    const winner = selectWinner();
    let speed = 50; // Initial speed (ms)
    let steps = 0;
    const maxSteps = 25; // How many shuffles before slowing down
    
    // Fast Spin Loop
    const spinInterval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * PRIZES.length);
      setDisplayPrize(PRIZES[randomIdx]);
      steps++;

      if (steps > maxSteps) {
        clearInterval(spinInterval);
        slowDown(winner);
      }
    }, speed);
  };

  const slowDown = (winner: typeof PRIZES[0]) => {
    setPhase('SLOWING');
    let speed = 100;
    let steps = 0;
    const slowSteps = 8; // Steps to stop

    const slowLoop = () => {
        if (steps >= slowSteps) {
            // STOP
            setDisplayPrize(winner);
            setPhase('REVEAL');
            setIsFinished(true);
            return;
        }

        // Pick random except on last step
        const randomIdx = Math.floor(Math.random() * PRIZES.length);
        setDisplayPrize(PRIZES[randomIdx]);
        
        steps++;
        speed += 60; // Decelerate
        setTimeout(slowLoop, speed);
    };

    slowLoop();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050505]/80 backdrop-blur-2xl transition-opacity duration-700 cursor-none">
      <div className="flex flex-col items-center justify-center w-full h-full relative overflow-hidden p-8">
        
        {/* Cinematic Background Elements: Minimal Light Beams */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-30"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.02)_0%,_transparent_60%)]"></div>

        {/* Combined Stats UI (Bottom Right) */}
        {/* Hidden when in Game Over to keep focus on the message? The user asked to show history, so we keep it. */}
        <div className="absolute bottom-4 right-4 sm:bottom-10 sm:right-10 flex flex-col items-end gap-2 sm:gap-6 text-right">
            
            {/* Counter */}
            <div className="flex flex-col items-end gap-1">
                <span className="text-white/40 font-['Cinzel'] text-[8px] sm:text-[10px] tracking-[0.2em] uppercase">Wishes Remaining</span>
                <div className="text-xl sm:text-3xl text-white/90 font-light font-sans">{remainingChances}</div>
            </div>

            {/* History */}
            {history.length > 0 && (
                <div className="flex flex-col items-end gap-1 sm:gap-2 mt-2 sm:mt-4">
                     <span className="text-white/40 font-['Cinzel'] text-[8px] sm:text-[10px] tracking-[0.2em] uppercase border-b border-white/10 pb-1 mb-1">Collected</span>
                     <div className="flex flex-col items-end gap-0.5 sm:gap-1">
                        {history.map((prize, idx) => (
                            <div key={idx} className="text-white/70 font-['Playfair_Display'] italic text-xs sm:text-sm tracking-wide">
                                {prize}
                            </div>
                        ))}
                     </div>
                </div>
            )}
        </div>

        {/* Header - Minimalist */}
        {phase !== 'GAME_OVER' && (
            <h2 className="text-white/50 font-['Cinzel'] text-[10px] sm:text-sm tracking-[0.6em] mb-10 sm:mb-20 uppercase transition-all duration-1000">
            {phase === 'REVEAL' ? "Qiu got" : "CONSULTING THE STARS"}
            </h2>
        )}
        {phase === 'GAME_OVER' && (
            // Spacer to keep layout roughly similar even without header
            <div className="mb-20 h-4"></div>
        )}

        {/* The Prize Display */}
        <div className="relative flex items-center justify-center h-48 w-full">
            {/* Soft Glow Effect behind text */}
            <div 
                className={`absolute inset-0 blur-[120px] transition-all duration-700 ease-in-out opacity-20 rounded-full`}
                style={{ backgroundColor: displayPrize.color }}
            />
            
            <div 
                className={`
                    relative z-10 text-center transition-all duration-500 transform
                    ${phase === 'SPINNING' ? 'opacity-60 blur-[0.5px] scale-95' : 'opacity-100 scale-100'}
                    ${phase === 'REVEAL' || phase === 'GAME_OVER' ? 'scale-110' : ''}
                `}
            >
                <div 
                    className="font-['Playfair_Display'] text-3xl sm:text-5xl md:text-8xl font-light italic tracking-wide px-4 py-2 sm:px-8 sm:py-4 transition-colors duration-500"
                    style={{ 
                        color: phase === 'REVEAL' || phase === 'GAME_OVER' ? displayPrize.color : '#F3F4F6',
                        textShadow: phase === 'REVEAL' || phase === 'GAME_OVER' ? `0 0 40px ${displayPrize.color}30` : 'none'
                    }}
                >
                    {displayPrize.name}
                </div>
            </div>
        </div>

        {/* Footer / Action Area */}
        <div className="mt-12 sm:mt-24 h-24 flex flex-col items-center justify-center w-full relative">
            {isFinished ? (
              <>
               <button 
                 ref={buttonRef}
                 onClick={() => {
                     const result = phase === 'GAME_OVER' ? null : displayPrize.name;
                     onClose(result);
                 }}
                 className={`
                    group relative px-6 py-2 sm:px-12 sm:py-3 overflow-hidden rounded-full border transition-all duration-300
                    ${isHoveringButton 
                        ? 'border-white bg-white/10 scale-110 shadow-[0_0_30px_rgba(255,255,255,0.2)]' 
                        : 'border-white/20 hover:border-white/50'
                    }
                 `}
               >
                 <div className={`absolute inset-0 translate-y-full transition-transform duration-500 ease-out ${isHoveringButton ? 'translate-y-0 bg-white/20' : 'group-hover:translate-y-0 bg-white/10'}`}></div>
                 <span className={`relative font-['Cinzel'] text-[10px] sm:text-xs tracking-[0.3em] transition-colors ${isHoveringButton ? 'text-white' : 'text-white/70 group-hover:text-white'}`}>
                    {phase === 'GAME_OVER' ? "CLOSE" : "ACCEPT"}
                 </span>
               </button>
               
               {/* Hint Text */}
               <div className={`mt-2 sm:mt-4 text-[8px] sm:text-[10px] text-white/30 font-sans tracking-widest uppercase transition-opacity duration-500 ${isHoveringButton ? 'opacity-100' : 'opacity-0'}`}>
                  {gesture === GestureType.FIST || gesture === GestureType.OK ? "Releasing..." : "Make a Fist to Select"}
               </div>
              </>
            ) : (
                /* Minimal Breathing Line Loader */
                <div className="w-[1px] h-8 sm:h-12 bg-gradient-to-b from-transparent via-white/40 to-transparent animate-pulse opacity-50"></div>
            )}
        </div>
        
        {/* Custom Hand Cursor Layer */}
        {isFinished && (
            <div 
                className="fixed pointer-events-none z-[200] transition-transform duration-75 ease-out will-change-transform flex items-center justify-center"
                style={{ 
                    left: 0, 
                    top: 0,
                    transform: `translate3d(${handPos.x * window.innerWidth}px, ${handPos.y * window.innerHeight}px, 0)`
                }}
            >
                {/* Cursor Ring */}
                <div className={`
                    w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 transition-all duration-200
                    ${isHoveringButton ? 'border-white scale-125 bg-white/10' : 'border-white/40 scale-100'}
                    ${(gesture === GestureType.FIST || gesture === GestureType.OK) && isHoveringButton ? 'bg-white scale-90' : ''}
                `}></div>
                
                {/* Center Dot */}
                <div className="absolute w-1 h-1 bg-white rounded-full"></div>
            </div>
        )}

      </div>
    </div>
  );
};

export default LotteryOverlay;