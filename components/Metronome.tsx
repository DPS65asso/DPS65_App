
import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, HeartPulse, Clock, RotateCcw, Volume2, AlertCircle, RefreshCcw, Users, Syringe, Wind, ShieldCheck } from 'lucide-react';
import { storageService } from '../services/storageService';
import { generateUUID } from '../utils/security';
import { CprEvent } from '../types';

interface MetronomeProps {
  autoStart?: boolean;
  eventId?: string; 
}

export const Metronome: React.FC<MetronomeProps> = ({ autoStart = false, eventId }) => {
  const [isActive, setIsActive] = useState(autoStart);
  const [tick, setTick] = useState(false);
  const [count, setCount] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [phase, setPhase] = useState<'MASSAGE' | 'VENTILATION' | 'ANALYSIS'>('MASSAGE');
  const [ventilationCountdown, setVentilationCountdown] = useState(5);
  
  const linkedVictimId = useRef<string | null>(null);
  const [isAlsMode, setIsAlsMode] = useState(false);
  const [adrenalineCycles, setAdrenalineCycles] = useState<number[]>([]);
  const [amiodaroneCycles, setAmiodaroneCycles] = useState<number[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<any>(null);
  const clockRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);
  const isAudioUnlocked = useRef(false);

  useEffect(() => {
    if (autoStart) {
        initAudio();
    }

    const initSilentRecord = async () => {
        try {
            let targetEventId = eventId;
            if (!targetEventId) {
                targetEventId = await storageService.ensureDailyEvent();
            }
            
            // Capture précise du temps de démarrage
            const startTime = Date.now();
            // Création de la victime avec ce timestamp pour cprStartTime
            const vId = await storageService.createEmergencyVictim(targetEventId, startTime);
            linkedVictimId.current = vId;
        } catch (e) {
            console.error("Erreur init silencieuse RCP", e);
        }
    };
    initSilentRecord();

    return () => {
        // Cleanup global
        if (timerRef.current) clearInterval(timerRef.current);
        if (clockRef.current) clearInterval(clockRef.current);
        if (audioContextRef.current) {
            try {
                if (audioContextRef.current.state !== 'closed') {
                    audioContextRef.current.close().catch(() => {});
                }
            } catch (e) {
                console.warn("[Metronome] Error closing AudioContext:", e);
            }
        }
    };
  }, []);

  const recordAction = async (action: CprEvent['action'], details?: string, timestamp: number = Date.now()) => {
      if (!linkedVictimId.current) {
          setTimeout(() => {
              if (linkedVictimId.current) {
                  storageService.addCprEvent(linkedVictimId.current, { timestamp, action, details });
              }
          }, 500);
          return;
      }
      return storageService.addCprEvent(linkedVictimId.current, { timestamp, action, details });
  };

  const speak = (text: string) => {
    if (!synthesisRef.current) return;
    if (synthesisRef.current.paused) synthesisRef.current.resume();
    
    synthesisRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.2;
    synthesisRef.current.speak(utterance);
  };

  const initAudio = async () => {
    if (!audioContextRef.current) {
      const AudioCtor = (window.AudioContext || (window as any).webkitAudioContext);
      audioContextRef.current = new AudioCtor({ latencyHint: 'interactive', sampleRate: 44100 });
    }
    
    if (audioContextRef.current.state === 'suspended') {
      try { await audioContextRef.current.resume(); } catch (e) {}
    }

    // Jouer un son silencieux une seule fois pour débloquer l'audio sur iOS
    if (!isAudioUnlocked.current) {
        try {
            const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            source.start(0);
            isAudioUnlocked.current = true;
        } catch(e) {}
    }
  };

  const playSound = (isMajor: boolean) => {
    if (!audioContextRef.current) return;
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume().catch(() => {});

    try {
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = isMajor ? 880 : 440;
      osc.type = 'square'; 
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.01); 
      gain.gain.linearRampToValueAtTime(0, now + (isMajor ? 0.2 : 0.1)); 
      osc.start(now);
      osc.stop(now + (isMajor ? 0.25 : 0.15));
    } catch (e) { }
  };

  const logDrug = async (drugName: string, dose: string) => {
      const now = Date.now();
      const timeStr = new Date(now).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit', second:'2-digit'});

      speak(`${drugName} noté.`);

      if (eventId) {
        await storageService.addLogbookEntry({
            id: generateUUID(), eventId, timestamp: now,
            message: `INJECTION : ${drugName} ${dose} administrée.`, category: 'ALERTE', author: 'METRONOME'
        });
      }
      
      if (linkedVictimId.current) {
          await recordAction('DRUG', `${drugName} ${dose}`, now);
          await storageService.addMedicationToVictim(linkedVictimId.current, drugName, dose, timeStr);
      }
  };

  useEffect(() => {
    if (isActive && phase === 'MASSAGE') {
      const interval = (60 / 110) * 1000;
      timerRef.current = setInterval(() => {
        setTick(t => !t);
        setCount(c => {
          const next = (c + 1) % 31;
          if (next === 30) {
              playSound(true);
              handleVentilationStart();
              return 30;
          } else {
              playSound(false);
              return next === 0 ? 1 : next;
          }
        });
      }, interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, phase]);

  useEffect(() => {
      if (isActive) {
          if (!audioContextRef.current) initAudio();
          clockRef.current = setInterval(() => {
              setTotalSeconds(s => {
                  const next = s + 1;
                  if (next > 0 && next % 120 === 0) handleAnalysisStart();
                  if (next % 120 === 110) speak("Changement de masseur dans dix secondes.");
                  return next;
              });
          }, 1000);
      } else {
          if (clockRef.current) clearInterval(clockRef.current);
      }
      return () => { if (clockRef.current) clearInterval(clockRef.current); }
  }, [isActive]);

  const handleVentilationStart = () => {
      setPhase('VENTILATION');
      setVentilationCountdown(5);
      speak("Stop. Insufflez deux fois.");
      recordAction('CYCLE', 'Fin cycle 30 compressions');
      let vCount = 5;
      const vTimer = setInterval(() => {
          vCount -= 1;
          setVentilationCountdown(vCount);
          if (vCount <= 0) {
              clearInterval(vTimer);
              setPhase('MASSAGE');
              setCount(0);
              speak("Reprenez.");
          }
      }, 1000);
  };

  const handleAnalysisStart = () => {
      setIsActive(false);
      setPhase('ANALYSIS');
      speak("STOP R.C.P. Analyse du rythme. Changez de masseur.");
      recordAction('ANALYSIS', 'Analyse Rythme (2 min)');
      if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
  };

  const handleResume = async () => {
      await initAudio();
      if (synthesisRef.current) synthesisRef.current.speak(new SpeechSynthesisUtterance(" "));
      
      setCount(0);
      setPhase('MASSAGE');
      setIsActive(true);
      recordAction('RESUME', 'Reprise après analyse');
      playSound(false);
      setTick(true);
      setCount(1);
      speak("Reprenez le massage.");
  };

  const handleToggle = async () => {
    const timestamp = Date.now();
    await initAudio();
    if (synthesisRef.current) synthesisRef.current.speak(new SpeechSynthesisUtterance(" "));

    if (!isActive) {
        playSound(false);
        setTick(true);
        setCount(1);
        recordAction('START', 'Démarrage manuel', timestamp);
        if (totalSeconds === 0) {
          setTimeout(() => speak("Début RCP. Cent dix compressions par minute."), 100);
        }
    } else {
        recordAction('PAUSE', 'Pause manuelle', timestamp);
    }
    setIsActive(!isActive);
  };

  const handleStop = async () => {
      const timestamp = Date.now();
      setIsActive(false);
      recordAction('STOP', 'Arrêt Métronome', timestamp);
      speak("Fin R.C.P.");
  };

  const cycleNum = Math.floor(totalSeconds / 120) + 1;
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const needsAdrenaline = isAlsMode && cycleNum >= 2 && cycleNum % 2 === 0 && !adrenalineCycles.includes(cycleNum);
  const needsAmiodarone = isAlsMode && (cycleNum === 3 || cycleNum === 5) && !amiodaroneCycles.includes(cycleNum);

  if (phase === 'ANALYSIS') {
      return (
          <div className="flex flex-col items-center justify-center p-8 bg-orange-600 rounded-3xl shadow-2xl w-full max-w-sm animate-pulse border-4 border-white">
              <AlertCircle className="w-20 h-20 text-white mb-6" />
              <h2 className="text-4xl font-black text-white mb-2 text-center uppercase leading-none">ANALYSE</h2>
              <p className="text-white font-bold text-center mb-8 uppercase tracking-widest text-lg">Changez de masseur</p>
              
              <div className="bg-black/20 p-4 rounded-2xl mb-8 w-full text-center">
                  <span className="font-black text-xl text-white">VÉRIFIER POULS</span>
              </div>

              <button onClick={handleResume} className="w-full py-6 bg-white text-orange-600 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                  <Play className="w-8 h-8 fill-current" /> REPRENDRE
              </button>
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden relative w-full max-w-sm">
      {isActive && phase === 'MASSAGE' && (
        <div className={`absolute inset-0 bg-red-500/10 transition-opacity duration-100 ${tick ? 'opacity-100' : 'opacity-0'}`} />
      )}
      
      <div className="relative z-10 flex flex-col items-center w-full">
        <div className="flex justify-between w-full mb-6 px-2">
            <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Durée Totale</span>
                <span className="text-2xl font-mono font-black text-white">{formatTime(totalSeconds)}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Cycle Analyse</span>
                <span className="text-2xl font-mono font-black text-blue-400">#{cycleNum}</span>
            </div>
        </div>

        <div className="w-full mb-6 bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <ShieldCheck className={`w-5 h-5 ${isAlsMode ? 'text-purple-500' : 'text-slate-600'}`} />
                <span className="text-xs font-bold text-slate-300">MODE MÉDICAL</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-end p-2 -mr-2">
                <input type="checkbox" className="sr-only peer" checked={isAlsMode} onChange={e => setIsAlsMode(e.target.checked)} />
                <div className="w-10 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:left-[10px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
        </div>

        {isAlsMode && (
            <div className="w-full mb-4 space-y-2">
                {needsAdrenaline && (
                    <div className="bg-red-900/40 border border-red-500 p-3 rounded-xl flex items-center justify-between animate-bounce">
                        <div className="flex items-center gap-2">
                            <Syringe className="w-5 h-5 text-red-500" />
                            <span className="text-xs font-black text-white">ADRÉNALINE 1mg !</span>
                        </div>
                        <button onClick={() => { setAdrenalineCycles([...adrenalineCycles, cycleNum]); logDrug("Adrénaline", "1mg"); }} className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">FAIT</button>
                    </div>
                )}
                {needsAmiodarone && (
                    <div className="bg-purple-900/40 border border-purple-500 p-3 rounded-xl flex items-center justify-between animate-pulse">
                        <div className="flex items-center gap-2">
                            <Syringe className="w-5 h-5 text-purple-400" />
                            <span className="text-xs font-black text-white">CORDARONE {cycleNum === 3 ? '300mg' : '150mg'} !</span>
                        </div>
                        <button onClick={() => { setAmiodaroneCycles([...amiodaroneCycles, cycleNum]); logDrug("Cordarone", cycleNum === 3 ? "300mg" : "150mg"); }} className="bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded">FAIT</button>
                    </div>
                )}
            </div>
        )}

        {phase === 'VENTILATION' ? (
            <div className="flex flex-col items-center justify-center mb-8 h-40 animate-in fade-in zoom-in duration-300">
                <Wind className="w-16 h-16 text-blue-400 mb-2 animate-pulse" />
                <div className="text-6xl font-black text-blue-400">{ventilationCountdown}s</div>
                <span className="text-sm font-bold text-blue-300 uppercase tracking-widest">Insufflations</span>
            </div>
        ) : (
            <div className="flex flex-col items-center mb-8 h-40 justify-center">
                <div className={`p-4 rounded-full mb-2 transition-all ${tick ? 'scale-125 bg-red-600' : 'bg-slate-800'}`}>
                    <HeartPulse className={`w-12 h-12 ${tick ? 'text-white' : 'text-slate-600'}`} />
                </div>
                <div className="text-7xl font-black text-white tabular-nums">
                    {count}<span className="text-2xl text-slate-600">/30</span>
                </div>
            </div>
        )}

        <div className="grid grid-cols-2 gap-3 w-full">
            <button 
              onClick={handleToggle}
              disabled={phase === 'VENTILATION'}
              className={`flex items-center gap-2 px-4 py-5 rounded-xl font-black text-lg transition-all active:scale-95 w-full justify-center disabled:opacity-30 ${isActive ? 'bg-orange-600 text-white shadow-lg' : 'bg-emerald-600 text-white shadow-lg'}`}
            >
              {isActive ? <><Square className="w-5 h-5 fill-current" /> PAUSE</> : <><Play className="w-5 h-5 fill-current" /> DÉMARRER</>}
            </button>
            <button 
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-5 rounded-xl font-black text-lg transition-all active:scale-95 w-full justify-center bg-red-800 text-white shadow-lg border border-red-600"
            >
                <Square className="w-5 h-5" /> FIN RCP
            </button>
        </div>
        
        <div className="mt-8 flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-tighter">
            <Volume2 className="w-4 h-4" /> Guidage vocal actif (SFAR/ERC)
        </div>
      </div>
    </div>
  );
};
