
import React, { useEffect, useState, Suspense, lazy, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, WifiOff, Battery, Maximize, Users, AlertCircle, Activity, Bed, CheckCircle2, Monitor, Map as MapIcon } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { Event, Victim, TriageColor, Outcome, TeamLocation, CustomMarker } from '../types';

// Lazy load map components
const EventMap = lazy(() => import('../components/EventMap').then(module => ({ 
  default: module.EventMap as React.ComponentType<{ 
    eventId: string; 
    isFullscreen?: boolean;
    liveTeams?: TeamLocation[];
    liveMarkers?: CustomMarker[];
    liveEvent?: Event | null;
    readOnly?: boolean;
  }> 
})));
const EventMap3D = lazy(() => import('../components/EventMap3D').then(module => ({ 
  default: module.EventMap3D as React.ComponentType<{ 
    eventId: string; 
    isFullscreen?: boolean;
    liveTeams?: TeamLocation[];
    liveMarkers?: CustomMarker[];
    liveEvent?: Event | null;
    readOnly?: boolean;
  }> 
})));

export const FullscreenMapPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [victims, setVictims] = useState<Victim[]>([]);
  const [teamLocations, setTeamLocations] = useState<TeamLocation[]>([]);
  const [customMarkers, setCustomMarkers] = useState<CustomMarker[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [is3D, setIs3D] = useState(true);

  const fetchDirectData = async () => {
    if (!id) return;
    
    try {
      // 1. Événement
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (eventData) setEvent(eventData);

      // 2. Victimes
      const { data: victimsData } = await supabase
        .from('victims')
        .select('*')
        .eq('event_id', id);

      if (victimsData) {
        setVictims(victimsData.map((v: any) => ({
          ...v,
          eventId: v.event_id || v.eventId
        })));
      }

      // 3. Équipes (GPS)
      const { data: teamsData } = await supabase
        .from('team_locations')
        .select('*');
      
      if (teamsData) {
        // On filtre les équipes de cet événement ou les équipes libres
        const STALE_THRESHOLD = 15 * 60 * 1000;
        const filteredTeams = teamsData.filter((l: any) => {
          const isStale = (Date.now() - l.timestamp) > STALE_THRESHOLD;
          return !isStale && (!l.event_id || l.event_id === id);
        });
        setTeamLocations(filteredTeams);
      }

      // 4. Marqueurs Perso
      const { data: markersData } = await supabase
        .from('custom_markers')
        .select('*')
        .eq('event_id', id);
      
      if (markersData) setCustomMarkers(markersData);

    } catch (err) {
      console.error("Erreur fetch direct:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    fetchDirectData();

    // ABONNEMENTS TEMPS RÉEL
    // Note: On écoute sans filtre sur DELETE pour être sûr de capter les suppressions
    const victimsChannel = supabase
      .channel(`tv-victims-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'victims' }, () => fetchDirectData())
      .subscribe();

    const teamsChannel = supabase
      .channel(`tv-teams-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_locations' }, () => fetchDirectData())
      .subscribe();

    const markersChannel = supabase
      .channel(`tv-markers-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_markers' }, () => fetchDirectData())
      .subscribe();

    const eventChannel = supabase
      .channel(`tv-event-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` }, (payload) => {
          setEvent(payload.new as Event);
      })
      .subscribe();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const slowRefresh = setInterval(fetchDirectData, 30000); // Sécurité
    
    return () => {
      supabase.removeChannel(victimsChannel);
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(markersChannel);
      supabase.removeChannel(eventChannel);
      clearInterval(timer);
      clearInterval(slowRefresh);
    };
  }, [id]);

  const stats = useMemo(() => {
    const active = victims.filter(v => v.outcome === Outcome.TREATMENT_IN_PROGRESS);
    const ua = victims.filter(v => v.triageColor === TriageColor.UA).length;
    const ur = victims.filter(v => v.triageColor === TriageColor.UR).length;
    const uip = victims.filter(v => v.triageColor === TriageColor.UIP).length;
    const dcd = victims.filter(v => v.triageColor === TriageColor.DCD).length;
    
    const stretchersOccupied = active.filter(v => v.resourceUsed === 'stretcher' || (!v.resourceUsed && (v.triageColor === TriageColor.UA || v.triageColor === TriageColor.UR))).length;
    const chairsOccupied = active.length - stretchersOccupied;

    return { total: victims.length, active: active.length, ua, ur, uip, dcd, stretchersOccupied, chairsOccupied };
  }, [victims]);

  if (!id) return <div className="h-screen flex items-center justify-center bg-black text-white">ID Événement manquant</div>;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden text-white relative">
      {/* Header Overlay Tactique */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-gradient-to-b from-black/95 via-black/80 to-transparent p-6 flex flex-col md:flex-row justify-between items-center md:items-start pointer-events-none gap-6">
        <div className="flex items-center gap-6 pointer-events-auto">
            <div className="flex flex-col items-center md:items-start">
                <h1 className="text-4xl font-black uppercase tracking-tighter text-blue-500 drop-shadow-[0_2px_10px_rgba(59,130,246,0.5)]">
                    {event ? event.name : (isLoading ? 'CHARGEMENT...' : 'ÉVÉNEMENT INTROUVABLE')}
                </h1>
                <div className="flex items-center gap-4 text-sm font-mono text-slate-300 mt-1">
                    <span className="flex items-center gap-2"><Maximize className="w-4 h-4 text-blue-400" /> {event?.location}</span>
                    <button 
                      onClick={() => setIs3D(!is3D)}
                      className="ml-4 flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 px-3 py-1 rounded-full transition-all active:scale-95"
                    >
                      <MapIcon className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Mode {is3D ? '2D' : '3D'}
                      </span>
                    </button>
                </div>
            </div>
        </div>

        {/* Clock in the middle */}
        <div className="md:absolute md:left-1/2 md:transform md:-translate-x-1/2 text-center bg-black/40 backdrop-blur-sm px-8 py-2 rounded-2xl border border-white/10">
            <div className="text-6xl font-black font-mono tracking-[0.1em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                {currentTime.toLocaleTimeString('fr-FR')}
            </div>
            <div className="text-xs text-blue-400 font-black uppercase tracking-[0.3em] mt-1">Temps Réel Opérationnel</div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 w-full h-full bg-slate-900 relative z-0">
         <Suspense fallback={<div className="flex h-full items-center justify-center bg-slate-950"><Loader2 className="w-16 h-16 text-blue-600 animate-spin" /></div>}>
            {is3D ? (
                <EventMap3D 
                  eventId={id} 
                  isFullscreen={true} 
                  liveTeams={teamLocations} 
                  liveMarkers={customMarkers}
                  liveEvent={event}
                  readOnly={true}
                />
            ) : (
                <EventMap 
                  eventId={id} 
                  isFullscreen={true} 
                  liveTeams={teamLocations} 
                  liveMarkers={customMarkers}
                  liveEvent={event}
                  readOnly={true}
                />
            )}
         </Suspense>
      </div>

      {/* STATS OVERLAY - LEFT SIDE */}
      <div className="absolute left-6 bottom-24 z-[1000] flex flex-col gap-4 pointer-events-none w-72">
          {/* Victim Stats */}
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" /> Bilan Victimes
                  </h3>
                  <span className="text-2xl font-black text-white">{stats.total}</span>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                  {/* Vital Emergency Alert */}
                  {stats.ua > 0 && (
                      <div className="bg-red-600 border-2 border-white animate-pulse p-3 rounded-xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.8)]">
                          <AlertCircle className="w-8 h-8 text-white mb-1" />
                          <span className="text-sm font-black text-white uppercase tracking-tighter text-center">Urgence Vitale Signalée</span>
                          <span className="text-3xl font-black text-white mt-1">{stats.ua} UA</span>
                          <div className="mt-2 w-full space-y-1">
                              {victims.filter(v => v.triageColor === TriageColor.UA).map(v => (
                                  <div key={v.id} className="text-[10px] font-black text-white bg-black/30 px-2 py-1 rounded flex justify-between items-center border border-white/20">
                                      <span>{v.fullName}</span>
                                      {v.bibNumber && <span className="bg-white text-red-600 px-1 rounded text-[8px]">#{v.bibNumber}</span>}
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Other categories only if present */}
                  {stats.ur > 0 && (
                      <div className="flex items-center justify-between bg-yellow-500/20 border border-yellow-500/30 p-3 rounded-xl">
                          <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]"></div>
                              <span className="text-sm font-bold text-yellow-100">Urgences Relatives</span>
                          </div>
                          <span className="text-xl font-black text-yellow-500">{stats.ur}</span>
                      </div>
                  )}

                  {stats.uip > 0 && (
                      <div className="flex items-center justify-between bg-green-600/20 border border-green-600/30 p-3 rounded-xl">
                          <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full bg-green-600 shadow-[0_0_10px_rgba(22,163,74,0.8)]"></div>
                              <span className="text-sm font-bold text-green-100">Urgences Légères</span>
                          </div>
                          <span className="text-xl font-black text-green-500">{stats.uip}</span>
                      </div>
                  )}

                  {/* If no categories but total > 0, show total detail */}
                  {stats.total > 0 && stats.ua === 0 && stats.ur === 0 && stats.uip === 0 && (
                      <div className="flex items-center justify-between bg-blue-600/20 border border-blue-600/30 p-3 rounded-xl">
                          <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.8)]"></div>
                              <span className="text-sm font-bold text-blue-100">Victimes Actuelles</span>
                          </div>
                          <span className="text-xl font-black text-blue-500">{stats.total}</span>
                      </div>
                  )}
              </div>
          </div>

          {/* Resources Stats */}
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Bed className="w-4 h-4 text-purple-500" /> Occupation Poste
              </h3>
              
              <div className="space-y-4">
                  <div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-1.5">
                          <span>Brancards</span>
                          <span className={stats.stretchersOccupied >= (event?.resourceConfig?.totalStretchers || 0) ? 'text-red-500' : 'text-blue-400'}>
                              {stats.stretchersOccupied} / {event?.resourceConfig?.totalStretchers || 0}
                          </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className={`h-full transition-all duration-1000 ${stats.stretchersOccupied >= (event?.resourceConfig?.totalStretchers || 0) ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-blue-600'}`} 
                            style={{ width: `${Math.min((stats.stretchersOccupied / (event?.resourceConfig?.totalStretchers || 1)) * 100, 100)}%` }}
                          />
                      </div>
                  </div>

                  <div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-1.5">
                          <span>Chaises / Assis</span>
                          <span className={stats.chairsOccupied >= (event?.resourceConfig?.totalChairs || 0) ? 'text-red-500' : 'text-green-400'}>
                              {stats.chairsOccupied} / {event?.resourceConfig?.totalChairs || 0}
                          </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className={`h-full transition-all duration-1000 ${stats.chairsOccupied >= (event?.resourceConfig?.totalChairs || 0) ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-green-600'}`} 
                            style={{ width: `${Math.min((stats.chairsOccupied / (event?.resourceConfig?.totalChairs || 1)) * 100, 100)}%` }}
                          />
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Footer Info Overlay */}
      <div className="absolute bottom-6 left-6 right-6 z-[1000] pointer-events-none flex justify-start items-end">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-6 text-xs font-bold text-slate-300 shadow-2xl">
              <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                  <span className="uppercase tracking-widest">Système Opérationnel</span>
              </div>
              <div className="h-4 w-px bg-white/10"></div>
              <div className="flex items-center gap-2 text-slate-400">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <span>Flux de données synchronisé</span>
              </div>
              <div className="h-4 w-px bg-white/10"></div>
              <div className="flex items-center gap-2 text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>MAJ: {currentTime.toLocaleTimeString('fr-FR')}</span>
              </div>
          </div>
      </div>
    </div>
  );
};
