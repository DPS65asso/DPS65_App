
import React, { useEffect, useState, useRef } from 'react';
import { Siren, X, AlertTriangle } from 'lucide-react';
import { LogbookEntry } from '../types';
import { useAuth } from '../context/AuthContext';

export const GlobalAlerts: React.FC = () => {
  const { currentTeam } = useAuth();
  const [alertData, setAlertData] = useState<LogbookEntry | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sirenIntervalRef = useRef<any>(null);
  
  // Utilisation d'une Ref pour accéder à l'état actuel dans le callback de l'event listener
  const currentTeamRef = useRef(currentTeam);

  useEffect(() => {
      currentTeamRef.current = currentTeam;
  }, [currentTeam]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    const bc = new BroadcastChannel('dps65_comms_channel');
    bc.onmessage = (event) => {
        // On écoute NEW_LOG (création locale) ET UPDATE_LOGBOOK (arrivée distante via SyncService)
        const isLogEvent = event.data.type === 'NEW_LOG' || event.data.type === 'UPDATE_LOGBOOK';
        
        if (isLogEvent && event.data.entry?.category === 'ALERTE_GEN') {
            // CONDITION CRITIQUE : L'utilisateur doit avoir pris son service (Équipe sélectionnée)
            if (!currentTeamRef.current) return;

            const entry = event.data.entry as LogbookEntry;
            const ignoredId = sessionStorage.getItem('ignore_alert_id');
            
            // Si c'est l'auteur (ignoredId), on ne montre pas la MODALE pour ne pas bloquer le guide RCP,
            // mais on joue quand même un son bref ou une notif native pour confirmation.
            if (ignoredId && entry.id === ignoredId) {
                return;
            }
            
            triggerAlert(entry);
        }
    };

    return () => {
        bc.close();
        stopSiren();
    };
  }, []);

  const triggerAlert = (entry: LogbookEntry) => {
    setAlertData(entry);
    startSiren();
    
    // Pattern de vibration SOS agressif
    if (navigator.vibrate) {
        navigator.vibrate([500, 100, 500, 100, 500, 500, 1000, 500, 1000, 500, 1000, 500, 500, 100, 500, 100, 500]);
    }

    // Notification Native Système (Redondance avec SyncService pour assurer la réception locale instantanée)
    if ("Notification" in window && Notification.permission === "granted") {
        try {
            const teamMatch = entry.message.match(/\(([^)]+)\)/);
            const teamName = teamMatch ? teamMatch[1] : "";
            
            const title = `🚨 URGENCE VITALE ${teamName ? `[${teamName.toUpperCase()}]` : ''}`;
            
            // On utilise le même tag que SyncService pour éviter les doublons sur l'écran
            const notif = new Notification(title, {
                body: `${entry.message}\nCLIQUEZ POUR AFFICHER.`, 
                icon: "/pwa-192x192.png",
                tag: "emergency-alert",
                requireInteraction: true,
                renotify: true,
                silent: false // Le son est géré par startSiren, mais on laisse le son système aussi
            } as any);
            
            notif.onclick = () => { window.focus(); notif.close(); };
        } catch(e) {
            console.error("Erreur Notification Native", e);
        }
    }
  };

  const startSiren = () => {
    try {
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        if (oscillatorRef.current) stopSiren();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square'; 
        gain.gain.value = 0.8; // Volume fort

        let high = false;
        // Démarrage immédiat
        osc.frequency.setValueAtTime(435, ctx.currentTime);
        osc.start();
        oscillatorRef.current = osc;
        gainRef.current = gain;

        // Alternance de fréquence (Sirène type pompier/ambulance)
        sirenIntervalRef.current = setInterval(() => {
            if (osc) {
                // Alternance 435Hz / 580Hz (Tons français)
                osc.frequency.setValueAtTime(high ? 435 : 580, ctx.currentTime);
                high = !high;
            }
        }, 1500); // Cycle de 3s (1.5s haut, 1.5s bas) - Rythme lent et lourd
    } catch (e) {}
  };

  const stopSiren = () => {
    if (oscillatorRef.current) {
        try {
            oscillatorRef.current.stop();
            oscillatorRef.current.disconnect();
        } catch(e) {}
        oscillatorRef.current = null;
    }
    if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
    }
  };

  const handleAcknowledge = () => {
    stopSiren();
    setAlertData(null);
  };

  if (!alertData) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 bg-red-600/95 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
      {/* Effet stroboscopique en arrière-plan */}
      <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none"></div>
      
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border-8 border-red-500 relative overflow-hidden transform scale-110">
        <div className="relative z-10 flex flex-col items-center">
            <div className="mb-6 p-4 bg-red-600 rounded-full text-white animate-bounce shadow-lg shadow-red-500/50">
                <Siren className="w-20 h-20" />
            </div>
            <h2 className="text-4xl font-black text-red-600 uppercase mb-4 tracking-tighter leading-none animate-pulse">ALERTE GÉNÉRALE</h2>
            
            <div className="w-full h-2 bg-red-100 mb-6 rounded-full overflow-hidden">
                <div className="h-full bg-red-600 w-full animate-[wiggle_1s_ease-in-out_infinite]"></div>
            </div>
            
            <p className="text-2xl font-bold text-slate-900 mb-4 uppercase leading-tight">{alertData.message}</p>
            
            <p className="text-sm text-slate-500 mb-8 font-mono bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
                Reçu à {new Date(alertData.timestamp).toLocaleTimeString()}
            </p>
            
            <button onClick={handleAcknowledge} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black text-2xl rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 border-4 border-red-800">
                <AlertTriangle className="w-8 h-8 fill-current" /> J'AI REÇU L'ALERTE
            </button>
        </div>
      </div>
    </div>
  );
};
