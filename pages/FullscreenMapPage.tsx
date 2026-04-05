
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, WifiOff, Battery, Maximize, ArrowLeft } from 'lucide-react';
import { storageService } from '../services/storageService';
import { Event } from '../types';

// Lazy load map component
const EventMap = lazy(() => import('../components/EventMap').then(module => ({ default: module.EventMap })));

export const FullscreenMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      if (id) {
        try {
            // Force une synchro pour récupérer les données publiques (events, markers, locations)
            const { syncService } = await import('../services/syncService');
            syncService.pullLatestData();

            const e = await storageService.getEventById(id);
            if (e) setEvent(e);
        } catch (err) {
            console.error("Erreur chargement événement TV:", err);
        }
      }
    };
    
    // Chargement immédiat
    load();

    // Rafraîchissement périodique au cas où le premier échoue (ex: session en cours d'init)
    const refreshInterval = setInterval(load, 3000);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => {
        clearInterval(refreshInterval);
        clearInterval(timer);
    };
  }, [id]);

  if (!id) return <div className="h-screen flex items-center justify-center bg-black text-white">ID Événement manquant</div>;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden text-white relative">
      {/* Header Overlay Tactique */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-gradient-to-b from-black/90 to-transparent p-4 flex flex-col md:flex-row justify-between items-center md:items-start pointer-events-none gap-4">
        <div className="flex items-center gap-4 pointer-events-auto">
            <button 
                onClick={() => navigate(-1)} 
                className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-full border border-slate-600 text-white transition-colors"
                title="Retour"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center md:items-start">
                <h1 className="text-2xl font-black uppercase tracking-tighter text-blue-500 drop-shadow-md">
                    {event ? event.name : 'CHARGEMENT...'}
                </h1>
                <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                    <span className="bg-blue-900/50 px-2 py-0.5 rounded border border-blue-800">SITAC LIVE</span>
                    <span>{event?.location}</span>
                </div>
            </div>
        </div>

        {/* Clock in the middle (on desktop) */}
        <div className="md:absolute md:left-1/2 md:transform md:-translate-x-1/2 text-center">
            <div className="text-4xl font-black font-mono tracking-[0.2em] text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]">
                {currentTime.toLocaleTimeString('fr-FR')}
            </div>
            <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">Temps Réel Opérationnel</div>
        </div>

        <div className="hidden md:block text-right">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Poste de Commandement</div>
            <div className="text-[10px] text-slate-500 font-mono">DPS 65 - SUIVI LIVE</div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 w-full h-full bg-slate-900 relative z-0">
         <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /></div>}>
            <EventMap eventId={id} isFullscreen={true} />
         </Suspense>
      </div>

      {/* Footer Info Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md border border-slate-700 rounded-lg p-2 flex items-center gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span>Connexion Cloud Active</span>
              </div>
              <div className="flex items-center gap-1 text-slate-500">
                  <Maximize className="w-3 h-3" />
                  <span>Affichage Projecteur 16:9</span>
              </div>
          </div>
      </div>
    </div>
  );
};
