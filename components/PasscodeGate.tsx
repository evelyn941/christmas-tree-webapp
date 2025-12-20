import React, { useState, useEffect, useRef } from 'react';
import { GestureType } from '../types';

interface PasscodeGateProps {
  onSuccess: () => void;
  gesture: GestureType;
  handPos: { x: number, y: number };
}

const CORRECT_CODE = "05312022";

const PasscodeGate: React.FC<PasscodeGateProps> = ({ onSuccess, gesture, handPos }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  const handleSubmit = () => {
    if (code === CORRECT_CODE) {
      onSuccess();
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
      setCode("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // Gesture Interaction Logic
  useEffect(() => {
    if (!submitBtnRef.current) return;

    const screenX = handPos.x * window.innerWidth;
    const screenY = handPos.y * window.innerHeight;
    const rect = submitBtnRef.current.getBoundingClientRect();
    
    const padding = 15;
    const isOver = (
        screenX >= rect.left - padding && 
        screenX <= rect.right + padding &&
        screenY >= rect.top - padding && 
        screenY <= rect.bottom + padding
    );

    setIsHovering(isOver);

    if (isOver && (gesture === GestureType.OK || gesture === GestureType.FIST)) {
        if (code.length === 8) {
            handleSubmit();
        }
    }
  }, [handPos, gesture, code]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#01080e] overflow-hidden">
      {/* Decorative Background - Icy/Arctic Theme */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-slate-400/10 blur-[140px] rounded-full" />
        {/* Arctic shimmer lines */}
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-200/20 to-transparent rotate-12 transform scale-150" />
      </div>

      <div className={`
        relative z-10 w-full max-w-md p-8 sm:p-12 mx-4 
        bg-white/5 backdrop-blur-3xl border border-blue-200/20 rounded-[2rem] 
        shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-all duration-500
        ${error ? 'animate-shake border-red-500/50' : ''}
      `}>
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-['Pinyon_Script'] text-blue-100 mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">Qiu's Christmas Gift</h1>
          <p className="text-[10px] sm:text-xs font-['Cinzel'] tracking-[0.4em] text-slate-400 uppercase">Secure Memory Access</p>
        </div>

        <div className="space-y-6 sm:space-y-8">
          <div className="relative group">
            <input 
              type="text"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
              className="w-full bg-transparent border-b-2 border-slate-500/30 py-4 text-center text-3xl sm:text-4xl tracking-[0.5em] text-white focus:outline-none focus:border-blue-300/50 transition-all placeholder:text-blue-200/10 font-light"
              autoFocus
            />
            {/* Icy Blue/Silver Input Glow */}
            <div className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-blue-400 to-slate-200 shadow-[0_0_15px_#60a5fa] transition-all duration-500" style={{ width: `${(code.length / 8) * 100}%` }} />
          </div>

          <div className="flex flex-col items-center gap-6">
            <button
              ref={submitBtnRef}
              onClick={handleSubmit}
              disabled={code.length !== 8}
              className={`
                relative px-12 py-3 rounded-full border transition-all duration-500 group overflow-hidden
                ${code.length === 8 
                  ? 'border-blue-300/40 text-blue-500 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(96,165,250,0.1)]' 
                  : 'border-white/5 text-slate-600 cursor-not-allowed'}
                ${isHovering && code.length === 8 ? 'bg-blue-400/10 border-blue-200 scale-110 shadow-[0_0_40px_rgba(96,165,250,0.3)] text-blue-100' : ''}
              `}
            >
              <span className="relative z-10 font-['Cinzel'] text-xs tracking-[0.3em] font-bold">Unlock</span>
              <div className={`absolute inset-0 bg-blue-300/10 transition-transform duration-500 translate-y-full ${isHovering ? 'translate-y-0' : ''}`} />
            </button>

            {/* Hint for Gestures */}
            <div className={`text-[9px] font-['Cinzel'] tracking-widest text-slate-500 transition-opacity duration-500 ${code.length === 8 ? 'opacity-100' : 'opacity-0'}`}>
              <span className="animate-pulse">Use OK Gesture to Select</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gesture Cursor - Icy Blue */}
      <div 
        className="fixed pointer-events-none z-[200] transition-transform duration-75 ease-out"
        style={{ 
            left: 0, 
            top: 0,
            transform: `translate3d(${handPos.x * window.innerWidth}px, ${handPos.y * window.innerHeight}px, 0)`
        }}
      >
        <div className={`
            w-8 h-8 rounded-full border-2 transition-all duration-300
            ${isHovering ? 'border-blue-400 scale-125 bg-blue-400/20 shadow-[0_0_15px_rgba(96,165,250,0.4)]' : 'border-slate-400/30 scale-100'}
            ${(gesture === GestureType.OK || gesture === GestureType.FIST) ? 'bg-blue-300 border-blue-100 scale-90' : ''}
        `}>
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-1.5 h-1.5 bg-white/80 rounded-full shadow-[0_0_5px_#fff]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasscodeGate;