import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Loader2, AlertCircle, CheckCircle2, Map as MapIcon, Users, Activity } from 'lucide-react';

export const TvDebugPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [event, setEvent] = useState<any>(null);
    const [victims, setVictims] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
    };

    useEffect(() => {
        const checkConnection = async () => {
            if (!id) {
                setError("ID d'événement manquant");
                setLoading(false);
                return;
            }

            addLog(`Démarrage du test pour l'événement : ${id}`);
            setLoading(true);
            setError(null);

            try {
                // 1. Test de l'événement
                addLog("Tentative de récupération de l'événement sur Supabase...");
                const { data: eventData, error: eventError } = await supabase
                    .from('events')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle();

                if (eventError) throw new Error(`Erreur Event: ${eventError.message}`);
                if (!eventData) {
                    addLog("⚠️ Événement non trouvé sur Supabase.");
                } else {
                    addLog(`✅ Événement trouvé : ${eventData.name}`);
                    setEvent(eventData);
                }

                // 2. Test des victimes
                addLog("Tentative de récupération des victimes (via event_id)...");
                const { data: victimsData, error: victimsError } = await supabase
                    .from('victims')
                    .select('*')
                    .eq('event_id', id);

                if (victimsError) {
                    addLog(`❌ Erreur Victimes (event_id) : ${victimsError.message}`);
                    addLog("Tentative alternative via eventId...");
                    const { data: victimsDataAlt, error: victimsErrorAlt } = await supabase
                        .from('victims')
                        .select('*')
                        .eq('eventId', id);
                    
                    if (victimsErrorAlt) throw new Error(`Erreur Victimes finale: ${victimsErrorAlt.message}`);
                    addLog(`✅ Victimes trouvées (eventId) : ${victimsDataAlt?.length || 0}`);
                    setVictims(victimsDataAlt || []);
                } else {
                    addLog(`✅ Victimes trouvées (event_id) : ${victimsData?.length || 0}`);
                    setVictims(victimsData || []);
                }

                addLog("Test terminé avec succès.");
            } catch (err: any) {
                console.error(err);
                setError(err.message);
                addLog(`🔴 ERREUR FATALE : ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        checkConnection();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <h1 className="text-2xl font-bold">Diagnostic de connexion TV...</h1>
                <div className="mt-8 w-full max-w-2xl bg-black/50 rounded-lg p-4 font-mono text-sm overflow-hidden">
                    {logs.map((log, i) => (
                        <div key={i} className="mb-1">{log}</div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Activity className="text-blue-500" />
                        Diagnostic TV
                    </h1>
                    <Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                        Retour à l'accueil
                    </Link>
                </div>

                {error ? (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 mb-8 flex items-start gap-4">
                        <AlertCircle className="text-red-500 shrink-0 w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-semibold text-red-500 mb-1">Erreur de connexion</h2>
                            <p className="text-slate-300">{error}</p>
                            <button 
                                onClick={() => window.location.reload()}
                                className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                                Réessayer
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-4 text-slate-400 uppercase text-xs font-bold tracking-wider">
                                <CheckCircle2 className="text-green-500 w-4 h-4" />
                                État de l'événement
                            </div>
                            {event ? (
                                <div>
                                    <h3 className="text-xl font-bold mb-2">{event.name}</h3>
                                    <p className="text-slate-400 text-sm">{event.location}</p>
                                    <p className="text-slate-500 text-xs mt-2">ID: {event.id}</p>
                                </div>
                            ) : (
                                <p className="text-amber-500">Événement introuvable sur Supabase.</p>
                            )}
                        </div>

                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-4 text-slate-400 uppercase text-xs font-bold tracking-wider">
                                <Users className="text-blue-500 w-4 h-4" />
                                Données Victimes
                            </div>
                            <div className="text-4xl font-black text-white mb-1">
                                {victims.length}
                            </div>
                            <p className="text-slate-400 text-sm">Victimes récupérées en direct</p>
                        </div>
                    </div>
                )}

                <div className="bg-black rounded-xl p-6 shadow-2xl border border-slate-800">
                    <h2 className="text-sm font-bold text-slate-500 uppercase mb-4 tracking-widest">Logs de diagnostic</h2>
                    <div className="font-mono text-sm space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {logs.map((log, i) => (
                            <div key={i} className={`pb-1 border-b border-slate-900 last:border-0 ${
                                log.includes('✅') ? 'text-green-400' : 
                                log.includes('❌') || log.includes('🔴') ? 'text-red-400' : 
                                log.includes('⚠️') ? 'text-amber-400' : 'text-slate-400'
                            }`}>
                                {log}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8 text-center text-slate-500 text-sm italic">
                    Cette page interroge Supabase directement sans passer par le cache local.
                </div>
            </div>
        </div>
    );
};
