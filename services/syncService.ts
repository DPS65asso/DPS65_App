
import { initDB, SyncQueueItem } from './db';
import { supabase, isLive } from './supabaseClient';
import { generateUUID } from '../utils/security';
import { auditService } from './auditService';
import { authService } from './authService';

const getNormalizedTime = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = Date.parse(val);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

type SyncStatusCallback = (pendingCount: number, isOnline: boolean, hasError: boolean) => void;

class SyncService {
    private isProcessing = false;
    private listeners: SyncStatusCallback[] = [];
    private isOnline = navigator.onLine;
    private hasError = false;
    private connectivityInterval: any = null;
    private realtimeRetryCount = 0;
    private realtimeChannel: any = null;
    private realtimeRetryTimeout: any = null;
    
    constructor() {
        // En plus des évènements window, on fait un vrai ping actif toutes les 15 secondes
        this.checkConnectivity();
        
        window.addEventListener('online', () => {
            console.log("🌐 Événement ONLINE détecté.");
            this.checkConnectivity();
        });
        window.addEventListener('offline', () => { 
            this.isOnline = false; 
            this.notifyListeners(); 
        });

        // Surveillance du retour au premier plan (Crucial pour PWA iOS Safari / Android Chrome)
        const handleForegroundReturn = async () => {
            if (document.visibilityState === 'visible') {
                console.log("📱 PWA revenue au premier plan. Vérification connectivité, resynchronisation et reconnexion Realtime...");
                const connected = await this.checkConnectivity();
                if (connected) {
                    this.reconnectRealtime();
                    this.processQueue();
                    this.pullLatestData();
                }
            }
        };

        document.addEventListener('visibilitychange', handleForegroundReturn);
        window.addEventListener('focus', handleForegroundReturn);
        window.addEventListener('pageshow', handleForegroundReturn);

        this.connectivityInterval = setInterval(() => {
            this.checkConnectivity();
        }, 15000);

        // Verification périodique de l'état du canal Realtime (30s)
        setInterval(() => {
            if (this.isOnline && isLive) {
                const channelState = this.realtimeChannel?.state;
                if (!this.realtimeChannel || channelState === 'closed' || channelState === 'errored' || channelState === 'leaving') {
                    console.warn(`⚠️ Canal Realtime inactif ou déconnecté (état: ${channelState || 'null'}). Reconnexion de sécurité...`);
                    this.reconnectRealtime();
                }
            }
        }, 30000);

        this.initializeRealtime();

        // Polling de secours toutes les 2 minutes
        setInterval(() => {
            if (this.isOnline) {
                this.pullLatestData();
            }
        }, 120000);
    }

    public async checkConnectivity(): Promise<boolean> {
        if (!navigator.onLine) {
            if (this.isOnline) {
                this.isOnline = false;
                this.notifyListeners();
            }
            return false;
        }

        try {
            // Un ping asynchrone ultra léger (HEAD) sur /index.html ou Supabase (évite portail captif)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            const response = await fetch('/index.html?t=' + Date.now(), {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-store'
            });
            clearTimeout(timeoutId);
            
            const online = response.ok;
            if (this.isOnline !== online) {
                this.isOnline = online;
                this.notifyListeners();
                if (online) {
                    this.processQueue();
                    this.reconnectRealtime();
                    this.pullLatestData();
                }
            }
            return online;
        } catch (e) {
            if (this.isOnline) {
                this.isOnline = false;
                this.notifyListeners();
            }
            return false;
        }
    }

    public async reconnectRealtime() {
        if (!isLive || !supabase) return;
        if (this.realtimeRetryTimeout) {
            clearTimeout(this.realtimeRetryTimeout);
            this.realtimeRetryTimeout = null;
        }
        console.log("🔄 Reconnexion du socket Supabase Realtime...");
        try {
            if (this.realtimeChannel) {
                await supabase.removeChannel(this.realtimeChannel);
                this.realtimeChannel = null;
            }
            if ((supabase as any).realtime) {
                try {
                    (supabase as any).realtime.disconnect();
                    (supabase as any).realtime.connect();
                } catch (e) {
                    console.warn("WebSocket reconnect warning:", e);
                }
            }
        } catch (e) {
            console.warn("Erreur lors du nettoyage du canal Realtime:", e);
        }
        await this.initializeRealtime();
    }

    private async initializeRealtime() {
        if (!this.isOnline || !isLive) return;

        // On nettoie le canal précédent s'il existe
        if (this.realtimeChannel) {
            try {
                await supabase.removeChannel(this.realtimeChannel);
            } catch(e) {}
            this.realtimeChannel = null;
        }

        const channel = supabase.channel('global_app_changes');
        
        const tables = ['events', 'victims', 'logbook', 'team_locations', 'missions', 'profiles', 'bags', 'bag_items', 'uniforms', 'fleet', 'news', 'documents', 'courses', 'vehicle_checks', 'config', 'custom_markers'];
        tables.forEach(tableName => {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
                this.handleRemoteChange(tableName, payload);
                if (payload.eventType === 'INSERT') {
                    this.triggerNotification(tableName, payload.new);
                }
            });
        });

        channel.subscribe(async (status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log("⚡ Supabase Realtime connecté avec succès.");
                this.realtimeRetryCount = 0; // Reset
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                console.warn(`⚠️ Supabase Realtime déconnecté ou en erreur (${status}). Planification de tentative de reconnexion...`);
                
                // Exponential backoff + random jitter (2^retry * 1000ms + random_jitter)
                this.realtimeRetryCount++;
                const delay = Math.min(30000, Math.pow(2, this.realtimeRetryCount) * 1000) + (Math.random() * 1500);
                
                console.log(`[Realtime Reconnector] Reconnexion dans ${Math.round(delay)}ms (Essai #${this.realtimeRetryCount})`);
                if (this.realtimeRetryTimeout) clearTimeout(this.realtimeRetryTimeout);
                this.realtimeRetryTimeout = setTimeout(() => {
                    this.initializeRealtime();
                }, delay);
            }
        });

        this.realtimeChannel = channel;
    }

    private async triggerNotification(table: string, data: any) {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        
        const recentLocalId = sessionStorage.getItem(`local_create_${data.id}`);
        if (recentLocalId) return;

        const { profile } = await authService.getSession();
        const isManager = profile?.role === 'admin' || profile?.role === 'logisticien';

        let title = "DPS65";
        let body = "Mise à jour disponible.";
        let tag = `new-${table}-${data.id}`;
        let requireInteraction = false;
        let renotify = false;

        if (table === 'missions') { 
            title = "📅 Nouvelle Mission"; 
            body = `${data.title} le ${new Date(data.date).toLocaleDateString()}`; 
        }
        else if (table === 'news') { 
            title = data.isUrgent ? "⚠️ Alerte Importante" : "📢 Nouvelle Actu"; 
            body = data.title; 
        }
        else if (table === 'documents') { 
            title = "📄 Nouveau Document"; 
            body = data.title; 
        }
        else if (table === 'courses') { 
            title = "🎓 Nouvelle Formation"; 
            body = data.title; 
        }
        else if (table === 'logbook' && data.category === 'ALERTE_GEN') {
            title = "🚨 URGENCE VITALE 🚨";
            body = `${data.message}\nOUVREZ L'APPLICATION IMMÉDIATEMENT.`;
            tag = 'emergency-alert'; 
            requireInteraction = true;
            renotify = true;
        }
        else if (table === 'vehicle_checks' && isManager) {
            if (data.alerts && data.alerts.length > 0) {
                const alertText = data.alerts[0] as string;
                if (alertText.startsWith('PANNE')) {
                    title = "🚨 Panne Signalée";
                    body = `Véhicule concerné : ${data.vehicleId || 'Inconnu'}\n${alertText}`;
                } else if (alertText.startsWith('ENTRETIEN') || alertText.startsWith('PNEUS')) {
                    title = "🔧 Entretien Ajouté";
                    body = `${alertText}`;
                } else {
                    return;
                }
            } else {
                return;
            }
        }
        else if (table === 'config') {
            // Notification discrète pour les changements de config (équipes, code)
            // On ne notifie pas pour éviter le spam, mais on log
            console.log("Configuration mise à jour à distance.");
            return;
        }
        else {
            return; 
        }

        try {
            new Notification(title, { 
                body, 
                icon: "/pwa-192x192.png", 
                tag,
                requireInteraction,
                renotify,
                // @ts-ignore
                vibrate: [200, 100, 200, 100, 200, 100, 200]
            } as any);
        } catch (e) {
            console.error("Erreur notification", e);
        }
    }

    public async retrySync() {
        this.hasError = false;
        this.notifyListeners();
        try { await authService.getSession(); } catch(e) {}
        await this.processQueue(true);
        await this.pullLatestData();
    }

    public async pullLatestData() {
        if (!this.isOnline || !isLive) return;

        // Éviter la synchronisation globale pour les sessions organisateur
        const storedId = localStorage.getItem('dps65_active_user_id');
        if (storedId && storedId.startsWith('temp-organizer-')) {
            console.log("Sync: skipping global pull for organizer session. Triggering pullOrganizerData.");
            await this.pullOrganizerData();
            return;
        }
        
        try {
            const syncTable = async (tableName: string, dbStoreName: string) => {
                try {
                    const { data, error } = await supabase.from(tableName).select('*');
                    if (error) {
                        // On logge l'erreur mais on ne bloque pas les autres tables
                        console.warn(`Sync: Could not pull ${tableName}: ${error.message}`);
                        return;
                    }
                    if (data) {
                        const db = await initDB();
                        
                        // Récupérer les éléments en attente de suppression pour cette table
                        const queue = await db.getAll('sync_queue');
                        const pendingDeletes = new Set(
                            queue
                                .filter(item => item.table === tableName && item.action === 'DELETE')
                                .map(item => item.data.id)
                        );

                        const tx = db.transaction(dbStoreName as any, 'readwrite');
                        let changed = false;

                        // 1. Mise à jour / Ajout des données distantes
                        for (const remote of data) {
                            if (pendingDeletes.has(remote.id)) {
                                console.log(`[Sync Pull] Ignoré car en cours de suppression locale: ${tableName}:${remote.id}`);
                                continue;
                            }
                            // Mapping event_id -> eventId pour la compatibilité locale
                            const localData = { ...remote };
                            if (localData.event_id && !localData.eventId) {
                                localData.eventId = localData.event_id;
                            }

                            if (dbStoreName !== 'config') {
                                const localExisting = await tx.store.get(remote.id);
                                if (!localExisting || JSON.stringify(localExisting) !== JSON.stringify(localData)) {
                                    await tx.store.put(localData);
                                    changed = true;
                                }
                            } else {
                                const localExisting = await tx.store.get('main');
                                if (!localExisting || JSON.stringify(localExisting) !== JSON.stringify(localData)) {
                                    await tx.store.put(localData, 'main');
                                    changed = true;
                                }
                            }
                        }

                        // 2. Nettoyage (Pruning) des données supprimées/archivées sur Supabase
                        if (dbStoreName !== 'config') {
                            const localItems = await tx.store.getAll();
                            const remoteIds = new Set(data.map(r => r.id));
                            const pendingUpserts = new Set(
                                queue
                                    .filter(item => item.table === tableName && item.action === 'UPSERT')
                                    .map(item => item.data.id)
                            );

                            for (const localItem of localItems) {
                                if (localItem && localItem.id) {
                                    if (!remoteIds.has(localItem.id) && !pendingDeletes.has(localItem.id) && !pendingUpserts.has(localItem.id)) {
                                        console.log(`[Sync Prune] Suppression de l'élément local obsolète: ${tableName}:${localItem.id}`);
                                        await tx.store.delete(localItem.id);
                                        changed = true;
                                    }
                                }
                            }
                        }

                        await tx.done;

                        // 3. Notification de l'interface en cas de modification
                        if (changed) {
                            const bcMap: any = { 
                                'events': 'dps65_events_channel', 
                                'missions': 'dps65_events_channel', 
                                'victims': 'dps65_victims_channel', 
                                'logbook': 'dps65_comms_channel',
                                'config': 'dps65_config_channel',
                                'news': 'dps65_asso_channel',
                                'documents': 'dps65_asso_channel',
                                'custom_markers': 'dps65_gps_channel',
                                'team_locations': 'dps65_gps_channel'
                            };
                            const channelName = bcMap[tableName];
                            if (channelName) {
                                try {
                                    const channel = new BroadcastChannel(channelName);
                                    channel.postMessage({ type: 'UPDATE_' + tableName.toUpperCase() });
                                    channel.close();
                                } catch (bcErr) {
                                    console.error(`Error sending broadcast for ${tableName}:`, bcErr);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Sync: Error pulling ${tableName}`, e);
                }
            };
            
            const tasks = [
                syncTable('events', 'events'), syncTable('victims', 'victims'), syncTable('missions', 'missions'),
                syncTable('profiles', 'profiles'), syncTable('bags', 'bags'), syncTable('bag_items', 'bag_items'),
                syncTable('uniforms', 'uniforms'), syncTable('fleet', 'fleet'), syncTable('news', 'news'),
                syncTable('documents', 'documents'), syncTable('courses', 'courses'), syncTable('vehicle_checks', 'vehicle_checks'),
                syncTable('config', 'config'), syncTable('custom_markers', 'custom_markers'),
                syncTable('team_locations', 'team_locations') // Ajout explicite de team_locations
            ];
            
            await Promise.all(tasks);
            this.hasError = false;
            
        } catch (e) { 
            console.error("Sync Pull Global Error:", e);
            this.hasError = true; 
        } finally { 
            this.notifyListeners(); 
        }
    }

    public async pullOrganizerData() {
        if (!this.isOnline || !isLive) return;

        const storedId = localStorage.getItem('dps65_active_user_id');
        if (!storedId || !storedId.startsWith('temp-organizer-')) return;
        const eventId = storedId.replace('temp-organizer-', '');
        const organizerCode = localStorage.getItem('dps65_organizer_code') || '';

        console.log(`[Sync Organizer] Starting pull for eventId: ${eventId}`);

        try {
            const db = await initDB();

            // 1. Récupérer l'événement via RPC ou Direct Select
            let event: any = null;
            try {
                const { data, error } = await supabase.rpc('get_event_by_organizer_code', { code_param: organizerCode });
                if (!error && data && data.length > 0) {
                    event = data[0];
                }
            } catch (rpcErr) {
                console.warn("RPC get_event_by_organizer_code failed during organizer sync:", rpcErr);
            }

            if (!event) {
                try {
                    const { data, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
                    if (!error && data) {
                        event = data;
                    }
                } catch (selectErr) {
                    console.error("Direct event select failed during organizer sync:", selectErr);
                }
            }

            if (event) {
                await db.put('events', event);
                console.log("[Sync Organizer] Event synced successfully.");
            }

            // 2. Récupérer les victimes de l'événement via RPC ou Direct Select
            let victims: any[] = [];
            let victimsLoaded = false;
            try {
                const { data, error } = await supabase.rpc('get_victims_by_organizer_code', { 
                    event_id_param: eventId, 
                    code_param: organizerCode 
                });
                if (!error && data) {
                    victims = data;
                    victimsLoaded = true;
                } else if (error) {
                    console.warn("RPC get_victims_by_organizer_code failed during organizer sync:", error);
                }
            } catch (rpcErr) {
                console.warn("RPC get_victims_by_organizer_code raised exception:", rpcErr);
            }

            if (!victimsLoaded) {
                try {
                    const { data, error } = await supabase.from('victims').select('*').eq('event_id', eventId);
                    if (!error && data) {
                        victims = data;
                        victimsLoaded = true;
                    }
                } catch (selectErr) {
                    console.error("Direct victims select failed during organizer sync:", selectErr);
                }
            }

            if (victimsLoaded) {
                // Mettre à jour les victimes locales sans vider les autres événements
                const tx = db.transaction('victims', 'readwrite');
                
                // On récupère toutes les victimes locales de cet événement
                const localVictims = await tx.store.index('by-event').getAll(eventId);
                const remoteIds = new Set(victims.map(v => v.id));

                // 1. Enregistrer/Mettre à jour les victimes distantes
                for (const remote of victims) {
                    const localData = { ...remote, eventId: remote.event_id || remote.eventId };
                    await tx.store.put(localData);
                }

                // 2. Pruning local : supprimer les victimes locales qui n'existent plus à distance pour cet événement
                for (const local of localVictims) {
                    if (local && local.id && !remoteIds.has(local.id)) {
                        console.log(`[Sync Organizer Prune] Removing local victim ${local.id}`);
                        await tx.store.delete(local.id);
                    }
                }

                await tx.done;
                console.log(`[Sync Organizer] Synced ${victims.length} victims.`);

                // Diffuser l'événement pour mettre à jour l'IHM
                try {
                    const channel = new BroadcastChannel('dps65_victims_channel');
                    channel.postMessage({ type: 'UPDATE_VICTIMS' });
                    channel.close();
                } catch (bcErr) {
                    console.error("Error sending broadcast for victims update:", bcErr);
                }
            }

            // 3. Récupérer les marqueurs de l'événement (custom_markers)
            try {
                const { data: markersData, error: markersErr } = await supabase.from('custom_markers').select('*').eq('event_id', eventId);
                if (!markersErr && markersData) {
                    const txMarkers = db.transaction('custom_markers', 'readwrite');
                    const localMarkers = await txMarkers.store.index('by-event').getAll(eventId);
                    const remoteMarkerIds = new Set(markersData.map(m => m.id));

                    for (const m of markersData) {
                        const localData = { ...m, eventId: m.event_id || m.eventId };
                        await txMarkers.store.put(localData);
                    }

                    for (const lm of localMarkers) {
                        if (lm && lm.id && !remoteMarkerIds.has(lm.id)) {
                            await txMarkers.store.delete(lm.id);
                        }
                    }
                    await txMarkers.done;

                    const channel = new BroadcastChannel('dps65_gps_channel');
                    channel.postMessage({ type: 'UPDATE_CUSTOM_MARKERS' });
                    channel.close();
                }
            } catch (markerErr) {
                console.warn("Failed to sync custom markers for organizer:", markerErr);
            }

            this.hasError = false;
        } catch (globalErr) {
            console.error("[Sync Organizer] Global error:", globalErr);
            this.hasError = true;
        } finally {
            this.notifyListeners();
        }
    }

    public async pullEventData(eventId: string) {
        if (!this.isOnline || !isLive) return;
        console.log(`Sync: Pulling specific data for event ${eventId}`);
        
        const syncTableFiltered = async (tableName: string, dbStoreName: string) => {
            try {
                const { data, error } = await supabase.from(tableName).select('*').eq('event_id', eventId);
                if (!error && data) {
                    const db = await initDB();
                    
                    // Récupérer les éléments en attente de suppression pour cette table
                    const queue = await db.getAll('sync_queue');
                    const pendingDeletes = new Set(
                        queue
                            .filter(item => item.table === tableName && item.action === 'DELETE')
                            .map(item => item.data.id)
                    );

                    const tx = db.transaction(dbStoreName as any, 'readwrite');
                    let changed = false;

                    // 1. Mettre à jour / Insérer les éléments distants de l'événement
                    for (const remote of data) {
                        if (pendingDeletes.has(remote.id)) {
                            console.log(`[Sync Pull Filtered] Ignoré car en cours de suppression locale: ${tableName}:${remote.id}`);
                            continue;
                        }
                        const localData = { ...remote };
                        if (localData.event_id && !localData.eventId) {
                            localData.eventId = localData.event_id;
                        }

                        const localExisting = await tx.store.get(remote.id);
                        if (!localExisting || JSON.stringify(localExisting) !== JSON.stringify(localData)) {
                            await tx.store.put(localData);
                            changed = true;
                        }
                    }

                    // 2. Nettoyer les éléments locaux de cet événement qui n'existent plus sur Supabase
                    const localItems = await tx.store.getAll();
                    const remoteIds = new Set(data.map(r => r.id));
                    const pendingUpserts = new Set(
                        queue
                            .filter(item => item.table === tableName && item.action === 'UPSERT')
                            .map(item => item.data.id)
                    );

                    for (const localItem of localItems) {
                        if (localItem && localItem.id) {
                            const itemEventId = localItem.eventId || localItem.event_id;
                            if (itemEventId === eventId) {
                                if (!remoteIds.has(localItem.id) && !pendingDeletes.has(localItem.id) && !pendingUpserts.has(localItem.id)) {
                                    console.log(`[Sync Prune Filtered] Suppression de l'élément local obsolète: ${tableName}:${localItem.id}`);
                                    await tx.store.delete(localItem.id);
                                    changed = true;
                                }
                            }
                        }
                    }

                    await tx.done;

                    // 3. Notification de l'interface en cas de modification
                    if (changed) {
                        const bcMap: any = { 
                            'events': 'dps65_events_channel', 
                            'missions': 'dps65_events_channel', 
                            'victims': 'dps65_victims_channel', 
                            'logbook': 'dps65_comms_channel',
                            'config': 'dps65_config_channel',
                            'news': 'dps65_asso_channel',
                            'documents': 'dps65_asso_channel',
                            'custom_markers': 'dps65_gps_channel',
                            'team_locations': 'dps65_gps_channel'
                        };
                        const channelName = bcMap[tableName];
                        if (channelName) {
                            try {
                                const channel = new BroadcastChannel(channelName);
                                channel.postMessage({ type: 'UPDATE_' + tableName.toUpperCase(), eventId });
                                channel.close();
                            } catch (bcErr) {
                                console.error(`Error sending broadcast for ${tableName}:`, bcErr);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`Sync: Error pulling filtered ${tableName}`, e);
            }
        };

        await Promise.all([
            syncTableFiltered('victims', 'victims'),
            syncTableFiltered('logbook', 'logbook'),
            syncTableFiltered('custom_markers', 'custom_markers')
        ]);
    }

    private async handleRemoteChange(table: string, payload: any) {
        const db = await initDB();
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        const localData = newRecord ? { ...newRecord } : null;
        if (localData && localData.event_id && !localData.eventId) {
            localData.eventId = localData.event_id;
        }

        try {
            if (eventType === 'INSERT' || eventType === 'UPDATE') {
                if (!localData) return;

                // --- SÉCURITÉ CONTRE LA RÉSURRECTION D'ÉLÉMENTS SUPPRIMÉS LOCALEMENT ---
                if (localData.id) {
                    const queue = await db.getAll('sync_queue');
                    const isLocallyDeleted = queue.some(item => item.table === table && item.action === 'DELETE' && item.data.id === localData.id);
                    if (isLocallyDeleted) {
                        console.log(`[Sync Realtime] Rejet de l'écriture distante pour ${table}:${localData.id} car une suppression locale est en attente.`);
                        return;
                    }
                }

                // --- GESTION OPTIMISÉE DES CONFLITS (LAST WRITE WINS) ---
                if (localData.id) {
                    try {
                        const localExisting = await db.get(table as any, localData.id);
                        if (localExisting) {
                            const localTime = getNormalizedTime(localExisting.updatedAt || localExisting.updated_at || localExisting.timestamp);
                            const remoteTime = getNormalizedTime(localData.updatedAt || localData.updated_at || localData.timestamp);
                            
                            // Si la version locale a un horodatage d'édition plus récent, on écarte la version distante
                            if (localTime > remoteTime) {
                                console.log(`[Sync Conflit] Rejet remote obsolète pour ${table} (Local: ${localTime} > Remote: ${remoteTime})`);
                                return;
                            }
                        }
                    } catch (conflictErr) {
                        console.warn("Conflict comparison failed, default to put", conflictErr);
                    }
                }

                if (table === 'config') {
                    await db.put(table as any, localData, 'main');
                } else {
                    await db.put(table as any, localData);
                }
            }
            else if (eventType === 'DELETE' && oldRecord?.id) {
                // Tenter de récupérer l'élément local pour conserver eventId afin que l'UI puisse se rafraîchir correctement
                let localRecord: any = null;
                try {
                    localRecord = await db.get(table as any, oldRecord.id);
                } catch (e) {
                    console.warn(`[Sync DELETE] Impossible de lire l'élément local ${table}:${oldRecord.id} avant suppression`, e);
                }

                if (table === 'config') {
                    await db.delete(table as any, 'main');
                } else {
                    await db.delete(table as any, oldRecord.id);
                }

                if (localRecord) {
                    // Fusionner les données de l'élément existant dans oldRecord pour la propagation de l'événement (comme eventId/event_id)
                    oldRecord.event_id = oldRecord.event_id || localRecord.event_id || localRecord.eventId;
                    oldRecord.eventId = oldRecord.eventId || localRecord.eventId || localRecord.event_id;
                }
            }

            const bcMap: any = { 
                'events': 'dps65_events_channel', 
                'missions': 'dps65_events_channel', 
                'victims': 'dps65_victims_channel', 
                'logbook': 'dps65_comms_channel',
                'config': 'dps65_config_channel',
                'news': 'dps65_asso_channel',
                'documents': 'dps65_asso_channel',
                'custom_markers': 'dps65_gps_channel',
                'team_locations': 'dps65_gps_channel'
            };
            
            const eventId = localData?.eventId || localData?.event_id || oldRecord?.event_id || oldRecord?.eventId;
            const type = table === 'team_locations' ? 'NEW_LOCATION' : 'UPDATE_' + table.toUpperCase();
            
            if (bcMap[table]) {
                const channel = new BroadcastChannel(bcMap[table]);
                channel.postMessage({ 
                    type, 
                    eventId, 
                    entry: localData || oldRecord 
                });
                channel.close();
            }
            this.notifyListeners();
        } catch (e) {
            console.error("Error handling remote change:", e);
        }
    }

    public subscribe(callback: SyncStatusCallback) {
        this.listeners.push(callback);
        this.getPendingCount().then(count => callback(count, this.isOnline, this.hasError));
        return () => { this.listeners = this.listeners.filter(l => l !== callback); };
    }

    public async getPendingCount(): Promise<number> {
        try { 
            const db = await initDB(); 
            // On compte manuellement pour être sûr si l'index est corrompu
            const all = await db.getAll('sync_queue');
            return all.filter(i => i.status === 'PENDING').length;
        } catch { return 0; }
    }

    private async notifyListeners() {
        const count = await this.getPendingCount();
        this.listeners.forEach(l => l(count, this.isOnline, this.hasError));
    }

    public async processQueue(forceAll: boolean = false) {
        if (this.isProcessing || !this.isOnline) return;
        if (!isLive) {
            console.warn("Sync: Skipping queue processing (Offline Mode)");
            return;
        }
        
        this.isProcessing = true;
        console.log("Sync: Starting queue processing...");
        
        try {
            // Utilisation d'une boucle while pour traiter les nouveaux éléments ajoutés pendant le traitement
            let hasMore = true;
            while (hasMore && navigator.onLine) {
                const db = await initDB();
                const allItems = await db.getAll('sync_queue');
                let pendingItems = allItems.filter(i => i.status === 'PENDING');
                
                if (forceAll) {
                    const failedItems = allItems.filter(i => i.status === 'FAILED');
                    pendingItems = [...pendingItems, ...failedItems];
                }
                
                if (pendingItems.length === 0) {
                    hasMore = false;
                    break;
                }

                pendingItems.sort((a, b) => a.timestamp - b.timestamp);
                
                for (const item of pendingItems) {
                    if (!navigator.onLine) {
                        hasMore = false;
                        break;
                    }
                    
                    let success = false;
                    let errorMessage = '';

                    try {
                        const dataToPush = { ...item.data };
                        // Convert any eventId to event_id and remove eventId to match Supabase's schema
                        if ('eventId' in dataToPush) {
                            dataToPush.event_id = dataToPush.eventId || dataToPush.event_id;
                            delete dataToPush.eventId;
                        }

                        const supabaseCall = async () => {
                            if (item.action === 'UPSERT') {
                                sessionStorage.setItem(`local_create_${item.data.id}`, 'true');
                                return await supabase.from(item.table).upsert(dataToPush);
                            } else if (item.action === 'DELETE') {
                                return await supabase.from(item.table).delete().eq('id', item.data.id);
                            }
                            return { error: { message: 'Action inconnue' } };
                        };

                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Supabase Timeout (10s)')), 10000)
                        );

                        const result: any = await Promise.race([supabaseCall(), timeoutPromise]);
                        
                        if (result && !result.error) success = true;
                        else errorMessage = result?.error?.message || 'Erreur inconnue';

                    } catch (err: any) {
                        errorMessage = err.message || 'Unknown error';
                        console.error(`Sync: Error for table ${item.table}:`, err);
                    }

                    const freshDb = await initDB();
                    if (success) {
                        await freshDb.delete('sync_queue', item.id);
                        console.log(`Sync: Success for ${item.table} (${item.id})`);
                    } else {
                        item.retries = (item.retries || 0) + 1;
                        if (item.retries > 3) {
                            item.status = 'FAILED';
                            console.error(`Sync: Permanent failure for ${item.table} after 3 retries: ${errorMessage}`);
                        } else {
                            console.warn(`Sync: Retry ${item.retries}/3 for ${item.table}: ${errorMessage}`);
                        }
                        await freshDb.put('sync_queue', item);
                        
                        if (errorMessage.includes('Timeout') || errorMessage.includes('Network') || errorMessage.includes('fetch')) {
                            hasMore = false;
                            break;
                        }
                    }
                    
                    await new Promise(r => setTimeout(r, 50));
                }
                
                // On revérifie s'il y a de nouveaux éléments PENDING avant de quitter la boucle while
                const checkDb = await initDB();
                const remainingItems = await checkDb.getAll('sync_queue');
                const stillPending = remainingItems.filter(i => i.status === 'PENDING').length;
                if (stillPending === 0) hasMore = false;
            }
        } catch (e) {
            console.error("Sync: Global processQueue error:", e);
        } finally { 
            this.isProcessing = false; 
            this.notifyListeners(); 
            console.log("Sync: Queue processing finished.");
        }
    }
}
export const syncService = new SyncService();
