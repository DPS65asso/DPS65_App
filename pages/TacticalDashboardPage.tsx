
import React, { useEffect, useState, Suspense, lazy, useMemo } from 'react';
import { useVitalsNotifications } from '../hooks/useVitalsNotifications';
import { Layout } from '../components/Layout';
import { storageService } from '../services/storageService';
import { Event, Victim, TriageColor, Outcome } from '../types';
import { Loader2, AlertCircle, Users, Activity, Bed, Monitor, ExternalLink, Map as MapIcon, X, RefreshCw, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';

const EventMap = lazy(() => import('../components/EventMap').then(module => ({ default: module.EventMap })));

export const TacticalDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [victims, setVictims] = useState<Victim[]>([]);
    const [lastRefresh, setLastRefresh] = useState(Date.now());
    const [isLoading, setIsLoading] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [showPdf, setShowPdf] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    useVitalsNotifications(victims);

    const refreshData = async () => {
        setIsLoading(true);
        const data = await storageService.getVictimsByEvent(selectedEventId);
        setVictims(data);
        setLastRefresh(Date.now());
        setIsLoading(false);
    };

    useEffect(() => {
        const load = async () => {
            let evts = await storageService.getEvents();
            
            // Si c'est un organisateur, on ne montre que son événement
            if (profile?.role === 'organisateur' && profile.id.startsWith('organizer-')) {
                const eventId = profile.id.replace('organizer-', '');
                evts = evts.filter(e => e.id === eventId);
            }

            const sorted = evts.sort((a,b) => b.createdAt - a.createdAt);
            setEvents(sorted);
            if (sorted.length > 0) setSelectedEventId(sorted[0].id);
        };
        load();
    }, [profile]);

    useEffect(() => {
        if (!selectedEventId) return;
        
        refreshData();
        
        // BroadcastChannel pour les mises à jour instantanées
        const bc = new BroadcastChannel('dps65_victims_channel');
        bc.onmessage = (e) => {
            if (e.data.type === 'UPDATE_VICTIMS' && e.data.eventId === selectedEventId) {
                refreshData();
            }
        };

        const interval = setInterval(refreshData, 30000); // Polling de secours

        return () => {
            clearInterval(interval);
            bc.close();
        };
    }, [selectedEventId]);


    const handleOpenMapWindow = () => {
        if (!selectedEventId) return;
        const width = 1200;
        const height = 800;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        
        // Utilisation d'une URL absolue propre pour éviter les problèmes de routage
        const baseUrl = window.location.origin + window.location.pathname;
        const targetUrl = `${baseUrl}#/map/${selectedEventId}`;
        
        const newWindow = window.open(
            targetUrl, 
            `dps65_map_${selectedEventId}`, 
            `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`
        );
        if (newWindow) newWindow.focus();
    };

    const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId]);

    const filteredVictims = useMemo(() => {
        return victims
            .filter(v => v.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || (v.bibNumber && v.bibNumber.includes(searchQuery)))
            .sort((a, b) => new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime());
    }, [victims, searchQuery]);

    return (
        <Layout title="Dashboard P.C. Opérationnel" showBack>
            <div className="bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-700 mb-6 text-white">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex-1 w-full">
                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Événement en cours</label>
                        <select className="w-full bg-slate-800 text-white text-lg font-bold p-3 rounded-lg border border-slate-600 outline-none focus:border-blue-500" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <Button onClick={refreshData} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 flex-1 min-w-[120px] whitespace-nowrap" icon={<RefreshCw className="w-5 h-5" />} disabled={!selectedEventId}>Rafraîchir</Button>
                        <Button onClick={() => setShowMap(!showMap)} className={`flex-1 min-w-[120px] whitespace-nowrap ${showMap ? 'bg-slate-700' : 'bg-blue-600 hover:bg-blue-500'}`} icon={showMap ? <X className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />} disabled={!selectedEventId}>
                            {showMap ? "Masquer Carte" : "Afficher Carte"}
                        </Button>
                        {selectedEvent?.mapPdfUrl && (
                            <Button onClick={() => setShowPdf(!showPdf)} className={`flex-1 min-w-[120px] whitespace-nowrap ${showPdf ? 'bg-slate-700' : 'bg-red-600 hover:bg-red-500'}`} icon={showPdf ? <X className="w-5 h-5" /> : <FileText className="w-5 h-5" />}>
                                {showPdf ? "Masquer Plan" : "Plan PDF"}
                            </Button>
                        )}
                        <Button onClick={handleOpenMapWindow} className="hidden md:flex bg-slate-800 hover:bg-slate-700 border border-slate-600 flex-1 min-w-[80px] whitespace-nowrap" icon={<Monitor className="w-5 h-5" />} disabled={!selectedEventId}>TV</Button>
                    </div>
                </div>
                <div className="mt-4">
                    <input 
                        type="text" 
                        placeholder="Rechercher une victime..." 
                        className="w-full p-3 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Monitor className="w-3 h-3"/> Mode Local Multi-Onglets</span>
                    {isLoading ? <span className="flex items-center gap-1 text-blue-400"><Loader2 className="w-3 h-3 animate-spin"/> Sync...</span> : <span>MAJ: {new Date(lastRefresh).toLocaleTimeString()}</span>}
                </div>
            </div>

            {showMap && selectedEventId && (
                <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-slate-900 rounded-xl overflow-hidden border-2 border-blue-500 shadow-2xl relative h-[500px]">
                        <Suspense fallback={<div className="flex h-full items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
                            <EventMap eventId={selectedEventId} />
                        </Suspense>
                    </div>
                </div>
            )}

            {showPdf && selectedEvent?.mapPdfUrl && (
                <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-slate-900 rounded-xl overflow-hidden border-2 border-red-500 shadow-2xl relative h-[800px]">
                        <iframe 
                            src={selectedEvent.mapPdfUrl} 
                            className="w-full h-full border-none"
                            title="Plan de cartographie détaillé"
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-800 p-4 rounded-xl border-l-4 border-blue-500 shadow-lg">
                    <div className="text-slate-400 text-xs uppercase font-bold flex items-center gap-2"><Users className="w-4 h-4"/> Total Prise en charge</div>
                    <div className="text-3xl font-black text-white">{victims.length}</div>
                </div>
                <div className="bg-red-900/40 p-4 rounded-xl border-l-4 border-red-500 shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10"><AlertCircle className="w-16 h-16 text-red-500"/></div>
                    <div className="text-red-400 text-xs uppercase font-bold flex items-center gap-2 relative z-10"><AlertCircle className="w-4 h-4"/> Urgences Absolues</div>
                    <div className="text-3xl font-black text-red-500 relative z-10">{victims.filter(v => v.triageColor === TriageColor.UA).length}</div>
                </div>
                <div className="bg-yellow-900/40 p-4 rounded-xl border-l-4 border-yellow-500 shadow-lg">
                    <div className="text-yellow-400 text-xs uppercase font-bold flex items-center gap-2"><Activity className="w-4 h-4"/> Urgences Relatives</div>
                    <div className="text-3xl font-black text-yellow-500">{victims.filter(v => v.triageColor === TriageColor.UR).length}</div>
                </div>
                 <div className="bg-slate-800 p-4 rounded-xl border-l-4 border-slate-500 shadow-lg">
                    <div className="text-slate-400 text-xs uppercase font-bold flex items-center gap-2"><Bed className="w-4 h-4"/> Actifs au Poste</div>
                    <div className="text-3xl font-black text-white">{victims.filter(v => v.outcome === Outcome.TREATMENT_IN_PROGRESS).length}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVictims.map(v => (
                    <div 
                        key={v.id} 
                        onClick={() => profile?.role !== 'organisateur' && navigate(`/events/${selectedEventId}/edit/${v.id}`)} 
                        className={`p-4 rounded-xl border-2 shadow-lg transition-transform relative overflow-hidden ${profile?.role !== 'organisateur' ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'} ${v.triageColor === TriageColor.UA ? 'bg-red-950 border-red-600' : v.triageColor === TriageColor.UR ? 'bg-yellow-950 border-yellow-600' : 'bg-slate-800 border-slate-600'}`}
                    >
                        <div className={`absolute left-0 top-0 bottom-0 w-2 ${v.triageColor === TriageColor.UA ? 'bg-red-600 animate-pulse' : v.triageColor === TriageColor.UR ? 'bg-yellow-500' : 'bg-green-600'}`}></div>
                        <div className="pl-4">
                            <div className="flex justify-between items-start mb-2">
                                 <div className="flex flex-col">
                                     <span className="text-3xl font-black text-white leading-none mb-1 tracking-tight">{v.bibNumber || '---'}</span>
                                     <span className="text-sm font-bold text-slate-300 truncate w-40">{v.fullName}</span>
                                 </div>
                                 <div className={`px-2 py-1 rounded text-xs font-black uppercase shadow-sm ${v.triageColor === TriageColor.UA ? 'bg-red-600 text-white' : v.triageColor === TriageColor.UR ? 'bg-yellow-500 text-black' : 'bg-green-600 text-white'}`}>{v.triageColor || 'NOVI'}</div>
                            </div>
                            <div className="text-xs text-slate-400 border-t border-white/10 pt-2 mt-2 flex justify-between">
                                 <span>Arrivée: {new Date(v.arrivalTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                 <span>{v.responderTeam}</span>
                            </div>
                             {v.isAdvancedMode && <div className="mt-2 text-[9px] text-purple-300 bg-purple-900/50 px-2 py-1 rounded inline-block font-bold uppercase tracking-wider border border-purple-700/50">SOINS IDE/MED EN COURS</div>}
                        </div>
                    </div>
                ))}
            </div>
        </Layout>
    );
};
