
import React, { useState, useEffect } from 'react';
import { EyeOff, Radio, Lock, MapPin } from 'lucide-react';
import { useWakeLock } from '../hooks/useWakeLock';

interface ScreenCurtainProps {
  onClose: () => void;
}

export const ScreenCurtain: React.FC<ScreenCurtainProps> = ({ onClose }) => {
  const [tapCount, setTapCount] = useState(0);

  // SOLUTION 3 : Force le Wake Lock tant que le rideau est actif
  // Cela empêche le téléphone de se mettre en veille réelle et maintient le CPU/GPS actif
  useWakeLock(true);

  // Reset tap count after delay
  useEffect(() => {
    if (tapCount > 0) {
      const timer = setTimeout(() => setTapCount(0), 500);
      return () => clearTimeout(timer);
    }
  }, [tapCount]);

  const handleTap = () => {
    if (tapCount === 1) {
      // Double tap detected
      onClose();
    } else {
      setTapCount(prev => prev + 1);
    }
  };

  return (
    <div 
      onClick={handleTap}
      className="fixed inset-0 z-[9999] bg-black cursor-pointer touch-none flex flex-col items-center justify-center select-none screen-curtain-container overflow-hidden"
    >
      {/* Contenu FIXE et plus VISIBLE (Gris moyen sur noir au lieu de gris très sombre) */}
      <div className="flex flex-col items-center">
        
        {/* Icône principale */}
        <div className="relative mb-6">
            <EyeOff className="w-24 h-24 text-neutral-600" />
            <div className="absolute top-0 right-0 w-4 h-4 bg-green-900 rounded-full animate-ping"></div>
        </div>

        <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-neutral-600 mb-2">Ghost Mode</h2>
        
        {/* Status GPS */}
        <div className="flex items-center gap-2 mb-8 bg-neutral-900 px-4 py-2 rounded-full border border-neutral-800">
            <Radio className="w-4 h-4 text-green-700 animate-pulse" />
            <span className="text-xs font-bold text-neutral-500 tracking-widest">GPS ACTIF</span>
        </div>

        {/* Instructions Critiques */}
        <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-neutral-500 font-bold text-xs uppercase border border-neutral-800 p-2 rounded">
                <Lock className="w-3 h-3" /> 
                <span>Ne pas verrouiller l'écran</span>
            </div>
            <p className="text-[10px] text-neutral-600">Double-tap pour réveiller</p>
        </div>

      </div>

      {/* Moving pixel pour éviter le burn-in écran OLED si affiché très longtemps */}
      <div className="absolute top-10 left-10 w-1 h-1 bg-neutral-800 rounded-full animate-bounce duration-[10000ms]"></div>
    </div>
  );
};

export const CurtainTrigger: React.FC<{onActivate: () => void}> = ({ onActivate }) => {
    return (
        <button 
            onClick={onActivate}
            className="flex flex-col items-center justify-center gap-1 p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors group bg-white/50 dark:bg-slate-800/50 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-sm"
            title="Activer Rideau Noir (Économie Max + GPS Actif)"
        >
            <div className="relative">
                <EyeOff className="w-5 h-5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></div>
            </div>
            <span className="text-[10px] uppercase font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400">Rideau</span>
        </button>
    );
};
