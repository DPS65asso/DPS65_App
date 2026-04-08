
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { supabase, isLive } from '../services/supabaseClient';
import { initDB } from '../services/db';
import { syncService } from '../services/syncService';
import { storageService } from '../services/storageService';
import { authService } from '../services/authService';
import { Loader2, Database, Cloud, Zap, Shield, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Trash2, Info } from 'lucide-react';
import { generateUUID } from '../utils/security';

export const DiagnosticsPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [syncQueue, setSyncQueue] = useState<any[]>([]);
    const [dbStats, setDbStats] = useState<any>({});

    const addResult = (test: string, status: 'SUCCESS' | 'ERROR' | 'INFO', message: string) => {
        setResults(prev => [{ test, status, message, time: new Date().toLocaleTimeString() }, ...prev]);
    };

    const loadStats = async () => {
        try {
            const db = await initDB();
            const queue = await db.getAll('sync_queue');
            setSyncQueue(queue);

            const victims = await db.count('victims');
            const events = await db.count('events');
            const profiles = await db.count('profiles');
            
            setDbStats({ victims, events, profiles, queue: queue.length });
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadStats();
        const unsub = syncService.subscribe(() => loadStats());
        return () => unsub();
    }, []);

    const runSupabaseTest = async () => {
        setLoading(true);
        addResult('Supabase Connection', 'INFO', 'Démarrage du test...');
        
        try {
            const start = Date.now();
            const { data, error } = await supabase.from('config').select('*').limit(1);
            const latency = Date.now() - start;

            if (error) throw error;
            addResult('Supabase Read', 'SUCCESS', `Lecture réussie (${latency}ms)`);

            // Test Write (on a dummy table or a safe one if exists, otherwise skip or use a known one)
            // We'll just test the connection for now as writing might be risky without a dedicated test table
            addResult('Supabase Write', 'INFO', 'Test d\'écriture ignoré (sécurité)');
        } catch (e: any) {
            addResult('Supabase Connection', 'ERROR', e.message || 'Erreur inconnue');
        } finally {
            setLoading(false);
        }
    };

    const runLocalDbTest = async () => {
        addResult('IndexedDB', 'INFO', 'Vérification de la base locale...');
        try {
            const db = await initDB();
            addResult('IndexedDB', 'SUCCESS', `Base ouverte : ${db.name} (v${db.version})`);
        } catch (e: any) {
            addResult('IndexedDB', 'ERROR', e.message);
        }
    };

    const handleForceSync = async () => {
        setLoading(true);
        addResult('Sync', 'INFO', 'Forçage de la synchronisation...');
        try {
            await syncService.processQueue(true);
            await syncService.pullLatestData();
            addResult('Sync', 'SUCCESS', 'Synchronisation terminée');
        } catch (e: any) {
            addResult('Sync', 'ERROR', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearQueue = async () => {
        if (!confirm("Voulez-vous vraiment vider la file d'attente ? Les actions non synchronisées seront perdues.")) return;
        try {
            const db = await initDB();
            const tx = db.transaction('sync_queue', 'readwrite');
            await tx.store.clear();
            await tx.done;
            addResult('Sync Queue', 'SUCCESS', 'File d\'attente vidée');
            loadStats();
        } catch (e: any) {
            addResult('Sync Queue', 'ERROR', e.message);
        }
    };

    const handleClearLocalData = async () => {
        if (!confirm("ATTENTION : Cela va supprimer TOUTES les données locales (victimes, événements, etc.) et vous déconnecter. Utile pour résoudre les problèmes de désynchronisation majeure.")) return;
        
        setLoading(true);
        try {
            localStorage.clear();
            sessionStorage.clear();
            const db = await initDB();
            const stores = ['victims', 'events', 'sync_queue', 'team_locations', 'custom_markers', 'logbook'];
            const tx = db.transaction(stores as any, 'readwrite');
            for (const store of stores) {
                await tx.objectStore(store as any).clear();
            }
            await tx.done;
            addResult('Local Wipe', 'SUCCESS', 'Données locales effacées. Redémarrage...');
            setTimeout(() => window.location.reload(), 2000);
        } catch (e: any) {
            addResult('Local Wipe', 'ERROR', e.message);
            setLoading(false);
        }
    };

    return (
        <Layout title="Diagnostics Système" showBack="/admin">
            <div className="p-4 space-y-6 pb-20">
                
                {/* STATS RAPIDES */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">File Sync</span>
                        <span className={`text-2xl font-black ${dbStats.queue > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                            {dbStats.queue || 0}
                        </span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Victimes</span>
                        <span className="text-2xl font-black text-blue-500">{dbStats.victims || 0}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Événements</span>
                        <span className="text-2xl font-black text-purple-500">{dbStats.events || 0}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Membres</span>
                        <span className="text-2xl font-black text-indigo-500">{dbStats.profiles || 0}</span>
                    </div>
                </div>

                {/* ACTIONS DE TEST */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                        <h3 className="font-black uppercase text-sm flex items-center gap-2 text-slate-700 dark:text-white">
                            <Cloud className="w-5 h-5 text-blue-500" /> Tests Cloud & Réseau
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            <Button fullWidth onClick={runSupabaseTest} disabled={loading} icon={<Zap />}>Tester Supabase</Button>
                            <Button fullWidth variant="outline" onClick={handleForceSync} disabled={loading} icon={<RefreshCw />}>Forcer Synchronisation</Button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                        <h3 className="font-black uppercase text-sm flex items-center gap-2 text-slate-700 dark:text-white">
                            <Database className="w-5 h-5 text-purple-500" /> Maintenance Locale
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            <Button fullWidth variant="outline" onClick={runLocalDbTest} disabled={loading} icon={<Database />}>Vérifier IndexedDB</Button>
                            <div className="flex gap-2">
                                <Button className="flex-1" variant="danger" onClick={handleClearQueue} disabled={loading} icon={<Trash2 />}>Vider File Sync</Button>
                                <Button className="flex-1" variant="danger" onClick={handleClearLocalData} disabled={loading} icon={<AlertTriangle />}>Wipe Local</Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FILE D'ATTENTE (SYNC QUEUE) */}
                {syncQueue.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                            <h3 className="font-black uppercase text-xs text-slate-500 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4" /> File de synchronisation ({syncQueue.length})
                            </h3>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {syncQueue.map((item) => (
                                <div key={item.id} className="p-3 border-b last:border-0 border-slate-100 dark:border-slate-700 flex justify-between items-center text-[10px]">
                                    <div className="flex flex-col">
                                        <span className="font-bold uppercase text-blue-600 dark:text-blue-400">{item.table}</span>
                                        <span className="text-slate-400">{new Date(item.timestamp).toLocaleTimeString()} - {item.action}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full font-black ${
                                            item.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 
                                            item.status === 'FAILED' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                        }`}>
                                            {item.status}
                                        </span>
                                        {item.retries > 0 && <span className="text-slate-400">({item.retries} essais)</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* RÉSULTATS DES TESTS */}
                <div className="bg-slate-900 rounded-2xl p-4 shadow-inner min-h-[200px] font-mono text-xs space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 border-b border-slate-800 pb-2 mb-2">
                        <Info className="w-4 h-4" /> Console de Diagnostic
                    </div>
                    {results.length === 0 && <div className="text-slate-600 italic">Aucun test effectué.</div>}
                    {results.map((res, i) => (
                        <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2">
                            <span className="text-slate-500">[{res.time}]</span>
                            <span className={`font-bold w-24 uppercase ${
                                res.status === 'SUCCESS' ? 'text-green-500' : 
                                res.status === 'ERROR' ? 'text-red-500' : 'text-blue-400'
                            }`}>
                                {res.status}
                            </span>
                            <span className="text-slate-300 flex-1">
                                <span className="font-bold text-white">{res.test}:</span> {res.message}
                            </span>
                        </div>
                    ))}
                </div>

            </div>
        </Layout>
    );
};
