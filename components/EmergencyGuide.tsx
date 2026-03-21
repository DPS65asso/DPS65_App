
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, Zap, X, ShieldCheck, ChevronRight } from 'lucide-react';
import { Metronome } from './Metronome';
import { storageService } from '../services/storageService';
import { generateUUID } from '../utils/security';

interface Step {
  title: string;
  msg: string;
  duration: number;
  color: string;
  icon: React.ReactNode;
}

export const EmergencyGuide: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { id: eventId } = useParams<{ id: string }>();
  const [stepIndex, setStepIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [showMetronome, setShowMetronome] = useState(false);

  const steps: Step[] = [
    { title: "SÉCURITÉ", msg: "Zone sûre ? Protections ?", duration: 3, color: "bg-orange-600", icon: <ShieldAlert className="w-24 h-24" /> },
    { title: "CONSCIENCE", msg: "Répond ? Sert les mains ?", duration: 3, color: "bg-red-600", icon: <AlertTriangle className="w-24 h-24" /> },
    { title: "RESPIRATION", msg: "LVA + Évaluer pendant 10s", duration: 10, color: "bg-red-700", icon: <Zap className="w-24 h-24" /> },
    { title: "ALERTE", msg: "Demander renforts + DÉFIBRILLATEUR", duration: 4, color: "bg-blue-700", icon: <ShieldCheck className="w-24 h-24" /> },
  ];

  useEffect(() => {
    if (showMetronome) {
        if (eventId) {
            storageService.addLogbookEntry({
                id: generateUUID(),
                eventId,
                timestamp: Date.now(),
                message: "DÉBUT R.C.P. - Guidage actif.",
                category: 'ALERTE',
                author: 'SYSTÈME'
            });
        }
        return;
    }
    
    setCountdown(steps[stepIndex].duration);
    
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          if (stepIndex < steps.length - 1) {
            setStepIndex(stepIndex + 1);
            return steps[stepIndex + 1].duration;
          } else {
            setShowMetronome(true);
            clearInterval(timer);
            return 0;
          }
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stepIndex, showMetronome, eventId]);

  if (showMetronome) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 text-white text-center animate-in fade-in duration-500 overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors z-[110]">
          <X className="w-8 h-8" />
        </button>
        <div className="w-full flex flex-col items-center py-10">
            <h2 className="text-3xl font-black mb-8 text-red-500 uppercase tracking-tighter italic">GUIDE RCP</h2>
            <Metronome autoStart eventId={eventId} />
        </div>
      </div>
    );
  }

  const currentStep = steps[stepIndex];

  return (
    <div className={`fixed inset-0 z-[100] ${currentStep.color} flex flex-col items-center justify-center p-6 text-white text-center transition-colors duration-500 animate-in fade-in`}>
      <button onClick={onClose} className="absolute top-6 left-6 p-2 bg-black/20 rounded-full hover:bg-black/40">
        <X className="w-8 h-8" />
      </button>
      
      <button 
        onClick={() => setShowMetronome(true)}
        className="absolute top-6 right-6 px-4 py-2 bg-white/20 rounded-full font-bold text-xs uppercase flex items-center gap-1 hover:bg-white/30"
      >
        Passer <ChevronRight className="w-4 h-4" />
      </button>
      
      <div className="mb-10 animate-bounce">{currentStep.icon}</div>
      <h2 className="text-5xl font-black mb-6 uppercase tracking-tighter">{currentStep.title}</h2>
      <p className="text-3xl font-bold opacity-95 max-w-sm mb-16 leading-tight">{currentStep.msg}</p>
      
      <div className="text-9xl font-black tabular-nums">{countdown}</div>
      
      <div className="w-full max-w-xs bg-black/20 h-4 rounded-full mt-12 overflow-hidden border border-white/20">
        <div 
          className="bg-white h-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
          style={{ width: `${(countdown / currentStep.duration) * 100}%` }}
        />
      </div>
    </div>
  );
};
