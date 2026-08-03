
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { supabase, isLive } from '../services/supabaseClient';
import { initDB } from '../services/db';
import { syncService } from '../services/syncService';
import { storageService } from '../services/storageService';
import { authService } from '../services/authService';
import { 
    Loader2, Database, Cloud, Zap, Shield, AlertTriangle, CheckCircle2, 
    XCircle, RefreshCw, Trash2, Info, Activity, Wifi, WifiOff, Download, 
    Copy, Terminal, Radio, HardDrive, Smartphone, Globe, Bell, Play, Check
} from 'lucide-react';

interface DiagnosticLog {
    id: string;
    test: string;
    status: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARN';
    message: string;
    time: string;
}

export const DiagnosticsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SUPABASE' | 'STORAGE' | 'NETWORK' | 'LOGS'>('OVERVIEW');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<DiagnosticLog[]>([]);
    const [syncQueue, setSyncQueue] = useState<any[]>([]);
    const [dbStats, setDbStats] = useState<Record<string, number>>({});
    const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number; percent: number } | null>(null);
    const [latency, setLatency] = useState<number | null>(null);
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
    const [copied, setCopied] = useState(false);
    const [tableAuditResults, setTableAuditResults] = useState<Record<string, { read: boolean; count?: number; error?: string }>>({});
    const [swStatus, setSwStatus] = useState<string>('Vérification...');
    const [cachesList, setCachesList] = useState<string[]>([]);

    const addLog = (test: string, status: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARN', message: string) => {
        setResults(prev => [{ id: Math.random().toString(36).substring(7), test, status, message, time: new Date().toLocaleTimeString('fr-FR') }, ...prev]);
    };

    // Auto load stats
    const loadStats = async () => {
        try {
            const db = await initDB();
            const queue = await db.getAll('sync_queue');
            setSyncQueue(queue);

            const counts: Record<string, number> = {
                sync_queue: queue.length,
                victims: await db.count('victims'),
                events: await db.count('events'),
                profiles: await db.count('profiles'),
                logbook: await db.count('logbook'),
                team_locations: await db.count('team_locations'),
                custom_markers: await db.count('custom_markers')
            };

            setDbStats(counts);

            // Storage quota estimation
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const usage = estimate.usage || 0;
                const quota = estimate.quota || 1;
                setStorageUsage({
                    usage,
                    quota,
                    percent: Math.round((usage / quota) * 100)
                });
            }

            // Service worker & cache check
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                setSwStatus(reg ? `Actif (${reg.scope})` : 'Non enregistré');
            } else {
                setSwStatus('Non supporté');
            }

            if ('caches' in window) {
                const keys = await caches.keys();
                setCachesList(keys);
            }
        } catch (e: any) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadStats();
        const unsub = syncService.subscribe(() => loadStats());

        const handleOnline = () => { setIsOnline(true); addLog('Réseau', 'SUCCESS', 'Connexion rétablie'); };
        const handleOffline = () => { setIsOnline(false); addLog('Réseau', 'WARN', 'Appareil hors-ligne'); };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            unsub();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 1. Supabase Speed & Ping Check
    const runPingCheck = async () => {
        setLoading(true);
        addLog('Ping Supabase', 'INFO', 'Mesure du temps de réponse...');
        try {
            const start = performance.now();
            const { error } = await supabase.from('config').select('key').limit(1);
            const duration = Math.round(performance.now() - start);
            setLatency(duration);
            if (error) throw error;
            addLog('Ping Supabase', duration < 200 ? 'SUCCESS' : 'WARN', `Réponse reçue en ${duration} ms`);
        } catch (e: any) {
            setLatency(null);
            addLog('Ping Supabase', 'ERROR', `Échec : ${e.message || 'Erreur réseau/Supabase'}`);
        } finally {
            setLoading(false);
        }
    };

    // 2. Full Table Audit (Supabase tables)
    const runFullTableAudit = async () => {
        setLoading(true);
        addLog('Audit Tables', 'INFO', 'Test de lecture sur toutes les tables Cloud...');
        const tables = ['events', 'victims', 'logbook', 'profiles', 'config', 'missions', 'news', 'documents', 'courses', 'fleet', 'bags', 'uniforms'];
        const audit: Record<string, { read: boolean; count?: number; error?: string }> = {};

        for (const tbl of tables) {
            try {
                const { data, error, count } = await supabase.from(tbl).select('*', { count: 'exact', head: true });
                if (error) {
                    audit[tbl] = { read: false, error: error.message };
                    addLog(`Audit [${tbl}]`, 'WARN', `Erreur : ${error.message}`);
                } else {
                    audit[tbl] = { read: true, count: count ?? 0 };
                    addLog(`Audit [${tbl}]`, 'SUCCESS', `Accès OK (${count ?? 0} éléments)`);
                }
            } catch (err: any) {
                audit[tbl] = { read: false, error: err.message };
            }
        }
        setTableAuditResults(audit);
        setLoading(false);
    };

    // 3. Broadcast Channel Test
    const runBroadcastTest = () => {
        addLog('BroadcastChannel', 'INFO', 'Envoi du message de test inter-onglets...');
        try {
            const bc = new BroadcastChannel('dps65_diagnostic_channel');
            let received = false;

            bc.onmessage = (event) => {
                received = true;
                addLog('BroadcastChannel', 'SUCCESS', `Message reçu : ${event.data}`);
                bc.close();
            };

            bc.postMessage('Ping Diagnostic DPS65 - ' + Date.now());

            setTimeout(() => {
                if (!received) {
                    addLog('BroadcastChannel', 'INFO', 'Message émis (ouvre un 2nd onglet pour tester la réception)');
                    bc.close();
                }
            }, 1000);
        } catch (e: any) {
            addLog('BroadcastChannel', 'ERROR', e.message);
        }
    };

    // 4. Notification Test
    const runNotificationTest = async () => {
        if (!('Notification' in window)) {
            addLog('Notifications', 'WARN', 'Notifications non supportées par ce navigateur');
            return;
        }

        if (Notification.permission === 'granted') {
            new Notification('DPS 65 - Test Système', {
                body: 'Les notifications système fonctionnent correctement sur cet appareil.',
                icon: '/favicon.ico'
            });
            addLog('Notifications', 'SUCCESS', 'Notification de test envoyée');
        } else if (Notification.permission !== 'denied') {
            const perm = await Notification.requestPermission();
            if (perm === 'granted') {
                new Notification('DPS 65 - Test Système', {
                    body: 'Permission accordée ! Notifications actives.',
                    icon: '/favicon.ico'
                });
                addLog('Notifications', 'SUCCESS', 'Permission accordée et notification envoyée');
            } else {
                addLog('Notifications', 'WARN', 'Permission refusée par l\'utilisateur');
            }
        } else {
            addLog('Notifications', 'WARN', 'Notifications bloquées dans les paramètres du navigateur');
        }
    };

    // 5. Force Sync
    const handleForceSync = async () => {
        setLoading(true);
        addLog('Sync', 'INFO', 'Forçage de la synchronisation bidirectionnelle...');
        try {
            await syncService.processQueue(true);
            await syncService.pullLatestData();
            addLog('Sync', 'SUCCESS', 'Synchronisation globale réussie');
            await loadStats();
        } catch (e: any) {
            addLog('Sync', 'ERROR', e.message);
        } finally {
            setLoading(false);
        }
    };

    // 6. Clear Sync Queue
    const handleClearQueue = async () => {
        if (!confirm("Voulez-vous vraiment vider la file d'attente ? Les actions non synchronisées seront supprimées.")) return;
        try {
            const db = await initDB();
            const tx = db.transaction('sync_queue', 'readwrite');
            await tx.store.clear();
            await tx.done;
            addLog('Sync Queue', 'SUCCESS', 'File d\'attente vidée');
            loadStats();
        } catch (e: any) {
            addLog('Sync Queue', 'ERROR', e.message);
        }
    };

    // 7. Clear Caches & Service Worker
    const handleClearCacheAPI = async () => {
        if (!confirm("Voulez-vous vider le cache d'application (Service Worker) ?")) return;
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
                addLog('Cache API', 'SUCCESS', `${keys.length} caches supprimés`);
                setCachesList([]);
            }
        } catch (e: any) {
            addLog('Cache API', 'ERROR', e.message);
        }
    };

    // 8. Wipe Local Data
    const handleClearLocalData = async () => {
        if (!confirm("ATTENTION : Cela va effacer TOUTES les données locales (IndexedDB & LocalStorage) et recharger la page.")) return;
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
            addLog('Wipe Local', 'SUCCESS', 'Toutes les données locales ont été nettoyées. Rechargement...');
            setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
            addLog('Wipe Local', 'ERROR', e.message);
            setLoading(false);
        }
    };

    // Export Full Diagnostic JSON
    const handleExportReport = () => {
        const report = {
            generatedAt: new Date().toISOString(),
            appVersion: '2.1.0',
            online: navigator.onLine,
            userAgent: navigator.userAgent,
            storageUsage,
            dbStats,
            syncQueueLength: syncQueue.length,
            latency,
            swStatus,
            cachesList,
            tableAuditResults,
            logs: results
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dps65-diagnostic-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        addLog('Rapport', 'SUCCESS', 'Rapport de diagnostic exporté au format JSON');
    };

    const copyLogsToClipboard = () => {
        const text = results.map(r => `[${r.time}] [${r.status}] ${r.test}: ${r.message}`).join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Layout title="Diagnostics & Maintenance Système" showBack="/admin">
            <div className="p-3 sm:p-4 space-y-4 sm:space-y-6 pb-24 max-w-6xl mx-auto w-full min-w-0">
                
                {/* EN-TÊTE RÉSEAU & ÉTAT SYSTÈME */}
                <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full min-w-0">
                    <div className="flex items-start sm:items-center gap-3 min-w-0 w-full md:w-auto">
                        <div className={`p-3 rounded-2xl shrink-0 ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6 animate-pulse" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-black text-base sm:text-lg flex flex-wrap items-center gap-2">
                                Appareil {isOnline ? 'En Ligne' : 'Hors Ligne'}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isLive ? 'bg-blue-500/30 text-blue-300' : 'bg-amber-500/30 text-amber-300'}`}>
                                    {isLive ? 'Supabase Connecté' : 'Mode Démo/Local'}
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400 font-medium break-all sm:break-normal">
                                Navigateur: {navigator.userAgent.split(' ')[0]} | Stockage: {storageUsage ? `${(storageUsage.usage / (1024 * 1024)).toFixed(1)} MB (${storageUsage.percent}%)` : 'Inconnu'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <Button variant="outline" className="text-white border-slate-700 hover:bg-slate-800 flex-1 sm:flex-none" onClick={runPingCheck} disabled={loading} icon={<Activity className="w-4 h-4 text-emerald-400" />}>
                            {latency !== null ? `${latency} ms` : 'Tester Latence'}
                        </Button>
                        <Button variant="secondary" className="flex-1 sm:flex-none" onClick={handleExportReport} icon={<Download className="w-4 h-4" />}>
                            Exporter Rapport
                        </Button>
                    </div>
                </div>

                {/* ONGLETS NAVIGATION DIAGNOSTICS */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto w-full min-w-0">
                    <button 
                        onClick={() => setActiveTab('OVERVIEW')} 
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'OVERVIEW' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <Activity className="w-4 h-4" /> Vue d'ensemble
                    </button>
                    <button 
                        onClick={() => setActiveTab('SUPABASE')} 
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'SUPABASE' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <Cloud className="w-4 h-4" /> Audit Supabase & Tables
                    </button>
                    <button 
                        onClick={() => setActiveTab('STORAGE')} 
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'STORAGE' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <Database className="w-4 h-4" /> IndexedDB & Caches
                    </button>
                    <button 
                        onClick={() => setActiveTab('NETWORK')} 
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'NETWORK' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <Radio className="w-4 h-4" /> Réseau & PWA
                    </button>
                    <button 
                        onClick={() => setActiveTab('LOGS')} 
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'LOGS' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <Terminal className="w-4 h-4" /> Console Logs ({results.length})
                    </button>
                </div>

                {/* CONTENU ONGLETS */}

                {/* 1. OVERVIEW */}
                {activeTab === 'OVERVIEW' && (
                    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
                        {/* STATS DE STOCKAGE */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 w-full min-w-0">
                            <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm min-w-0">
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1 truncate">File de Sync</span>
                                <span className={`text-xl sm:text-2xl font-black ${dbStats.sync_queue > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                    {dbStats.sync_queue || 0}
                                </span>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm min-w-0">
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1 truncate">Victimes en BD</span>
                                <span className="text-xl sm:text-2xl font-black text-blue-500">{dbStats.victims || 0}</span>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm min-w-0">
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1 truncate">Événements DPS</span>
                                <span className="text-xl sm:text-2xl font-black text-purple-500">{dbStats.events || 0}</span>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm min-w-0">
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1 truncate">Membres Sync</span>
                                <span className="text-xl sm:text-2xl font-black text-indigo-500">{dbStats.profiles || 0}</span>
                            </div>
                        </div>

                        {/* RACCOURCIS ACTIONS RAPIDES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full min-w-0">
                            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 min-w-0">
                                <h3 className="font-black uppercase text-xs text-slate-500 tracking-wider flex items-center gap-2">
                                    <Cloud className="w-4 h-4 text-blue-500" /> Actions de Synchronisation
                                </h3>
                                <div className="space-y-2">
                                    <Button fullWidth variant="primary" onClick={handleForceSync} disabled={loading} icon={<RefreshCw className={loading ? 'animate-spin' : ''} />}>
                                        Lancer Synchronisation Complète
                                    </Button>
                                    <Button fullWidth variant="outline" onClick={runPingCheck} disabled={loading} icon={<Zap />}>
                                        Mesurer Latence Serveur Cloud
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 min-w-0">
                                <h3 className="font-black uppercase text-xs text-slate-500 tracking-wider flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-amber-500" /> Purges de Sécurité
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Button variant="danger" onClick={handleClearQueue} disabled={loading} icon={<Trash2 />}>
                                        Vider la File
                                    </Button>
                                    <Button variant="danger" onClick={handleClearLocalData} disabled={loading} icon={<AlertTriangle />}>
                                        Réinitialiser
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* FILE DE SYNC DÉTAILLÉE */}
                        {syncQueue.length > 0 && (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden w-full min-w-0">
                                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center gap-2">
                                    <h3 className="font-black uppercase text-xs text-slate-500 flex items-center gap-2 min-w-0">
                                        <RefreshCw className="w-4 h-4 text-orange-500 animate-spin shrink-0" /> <span className="truncate">Éléments en attente ({syncQueue.length})</span>
                                    </h3>
                                    <Button size="sm" variant="danger" onClick={handleClearQueue} className="shrink-0">Vider</Button>
                                </div>
                                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                    {syncQueue.map((item) => (
                                        <div key={item.id} className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                                            <div className="min-w-0 flex-1">
                                                <span className="font-bold uppercase text-blue-600 dark:text-blue-400 mr-2">{item.table}</span>
                                                <span className="text-slate-400 break-words">{new Date(item.timestamp).toLocaleTimeString('fr-FR')} - Action: <span className="font-semibold text-slate-700 dark:text-slate-200">{item.action}</span></span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full font-black text-[10px] shrink-0 ${
                                                item.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 
                                                item.status === 'FAILED' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                                            }`}>
                                                {item.status} ({item.retries || 0} essais)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. TAB SUPABASE */}
                {activeTab === 'SUPABASE' && (
                    <div className="space-y-6 w-full min-w-0">
                        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-black text-sm uppercase text-slate-800 dark:text-white flex items-center gap-2">
                                        <Cloud className="w-5 h-5 text-blue-500" /> Audit des Tables Supabase
                                    </h3>
                                    <p className="text-xs text-slate-400">Vérifie l'accessibilité et le nombre d'enregistrements table par table.</p>
                                </div>
                                <Button onClick={runFullTableAudit} disabled={loading} icon={<Play className="w-4 h-4" />}>
                                    Lancer l'Audit Complet
                                </Button>
                            </div>

                            {Object.keys(tableAuditResults).length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 w-full min-w-0">
                                    {Object.entries(tableAuditResults).map(([table, res]) => (
                                        <div key={table} className={`p-3 rounded-xl border flex justify-between items-center min-w-0 ${res.read ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800'}`}>
                                            <div className="min-w-0 flex-1 mr-2">
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase truncate">{table}</p>
                                                <p className="text-[10px] text-slate-500 truncate">
                                                    {res.read ? `${res.count} enregistrements` : res.error || 'Accès refusé'}
                                                </p>
                                            </div>
                                            {res.read ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-xs text-slate-400 py-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4">
                                    Cliquez sur "Lancer l'Audit Complet" pour tester l'accès à toutes les tables.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. TAB STORAGE */}
                {activeTab === 'STORAGE' && (
                    <div className="space-y-6 w-full min-w-0">
                        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 min-w-0">
                            <h3 className="font-black text-sm uppercase text-slate-800 dark:text-white flex items-center gap-2">
                                <Database className="w-5 h-5 text-purple-500" /> Détails de la Base IndexedDB (`dps65_db`)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full min-w-0">
                                {Object.entries(dbStats).map(([store, count]) => (
                                    <div key={store} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 min-w-0">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 truncate">{store}</p>
                                        <p className="text-lg font-black text-slate-800 dark:text-white">{count}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 min-w-0">
                            <h3 className="font-black text-sm uppercase text-slate-800 dark:text-white flex items-center gap-2">
                                <HardDrive className="w-5 h-5 text-amber-500" /> Caches navigateur (Cache Storage API)
                            </h3>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl min-w-0">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 dark:text-white break-words">Service Worker: <span className="text-blue-500">{swStatus}</span></p>
                                    <p className="text-[11px] text-slate-400 break-words">{cachesList.length} conteneur(s) de cache actif(s): {cachesList.join(', ') || 'Aucun'}</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={handleClearCacheAPI} icon={<Trash2 className="w-4 h-4" />} className="w-full sm:w-auto shrink-0">
                                    Vider Caches SW
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. TAB NETWORK */}
                {activeTab === 'NETWORK' && (
                    <div className="space-y-6 w-full min-w-0">
                        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 min-w-0">
                            <h3 className="font-black text-sm uppercase text-slate-800 dark:text-white flex items-center gap-2">
                                <Radio className="w-5 h-5 text-emerald-500" /> Communication Multi-onglets & Notifications
                            </h3>
                            <p className="text-xs text-slate-400">Testez la propagation des messages entre onglets via `BroadcastChannel` et les permissions de notifications PWA.</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 w-full min-w-0">
                                <Button variant="outline" onClick={runBroadcastTest} icon={<Radio className="w-4 h-4" />}>
                                    Test BroadcastChannel Inter-onglets
                                </Button>
                                <Button variant="outline" onClick={runNotificationTest} icon={<Bell className="w-4 h-4" />}>
                                    Test Notification Navigateur
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. TAB LOGS */}
                {activeTab === 'LOGS' && (
                    <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3 font-mono text-xs text-slate-300 w-full min-w-0 overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                                <Terminal className="w-4 h-4 text-emerald-400 shrink-0" /> Diagnostic Logs ({results.length})
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <Button size="sm" variant="outline" className="text-white border-slate-700 hover:bg-slate-800" onClick={copyLogsToClipboard} icon={copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}>
                                    {copied ? 'Copié !' : 'Copier'}
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => setResults([])} icon={<Trash2 className="w-3 h-3" />}>
                                    Effacer
                                </Button>
                            </div>
                        </div>

                        <div className="max-h-[450px] overflow-y-auto space-y-3 pr-1">
                            {results.length === 0 && <p className="text-slate-600 italic py-4">Aucun log enregistré dans la session active.</p>}
                            {results.map((log) => (
                                <div key={log.id} className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/60 space-y-1.5 font-mono text-xs w-full min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                        <span className="text-slate-500 font-medium">[{log.time}]</span>
                                        <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded border ${
                                            log.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                                            log.status === 'ERROR' ? 'bg-red-950 text-red-400 border-red-800' :
                                            log.status === 'WARN' ? 'bg-amber-950 text-amber-400 border-amber-800' : 'bg-blue-950 text-blue-400 border-blue-800'
                                        }`}>
                                            {log.status}
                                        </span>
                                        <span className="font-bold text-slate-200">{log.test}</span>
                                    </div>
                                    <div className={`p-2 rounded-lg text-xs leading-relaxed break-words whitespace-pre-wrap ${
                                        log.status === 'ERROR' 
                                            ? 'bg-red-950/50 text-red-200 border border-red-900/80 font-semibold' 
                                            : log.status === 'WARN'
                                            ? 'bg-amber-950/30 text-amber-200 border border-amber-900/50'
                                            : 'bg-slate-900/70 text-slate-300 border border-slate-800/50'
                                    }`}>
                                        {log.message}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </Layout>
    );
};

