
import { initDB, SyncQueueItem } from './db';
import { supabase, isLive } from './supabaseClient';
import { generateUUID } from '../utils/security';
import { auditService } from './auditService';
import { authService } from './authService';

type SyncStatusCallback = (pendingCount: number, isOnline: boolean, hasError: boolean) => void;

class SyncService {
    private isProcessing = false;
    private listeners: SyncStatusCallback[] = [];
    private isOnline = navigator.onLine;
    private hasError = false;
    
    constructor() {
        window.addEventListener('online', () => {
            this.isOnline = true; 
            this.notifyListeners(); 
            this.processQueue();
            this.initializeRealtime(); 
            this.pullLatestData(); 
        });
        window.addEventListener('offline', () => { this.isOnline = false; this.notifyListeners(); });
        this.initializeRealtime();
        if (this.isOnline) { this.processQueue(); this.pullLatestData(); }
    }

    private async initializeRealtime() {
        if (!this.isOnline || !isLive) return;
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
        channel.subscribe();
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
                        const tx = db.transaction(dbStoreName as any, 'readwrite');
                        for (const remote of data) {
                            // Mapping event_id -> eventId pour la compatibilité locale
                            const localData = { ...remote };
                            if (localData.event_id && !localData.eventId) {
                                localData.eventId = localData.event_id;
                            }

                            if (dbStoreName === 'config') {
                                await tx.store.put(localData, 'main');
                            } else {
                                await tx.store.put(localData);
                            }
                        }
                        await tx.done;
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

    public async pullEventData(eventId: string) {
        if (!this.isOnline || !isLive) return;
        console.log(`Sync: Pulling specific data for event ${eventId}`);
        
        const syncTableFiltered = async (tableName: string, dbStoreName: string) => {
            try {
                const { data, error } = await supabase.from(tableName).select('*').eq('event_id', eventId);
                if (!error && data) {
                    const db = await initDB();
                    const tx = db.transaction(dbStoreName as any, 'readwrite');
                    for (const remote of data) {
                        const localData = { ...remote };
                        if (localData.event_id && !localData.eventId) {
                            localData.eventId = localData.event_id;
                        }
                        await tx.store.put(localData);
                    }
                    await tx.done;
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
        try {
            if (eventType === 'INSERT' || eventType === 'UPDATE') {
                const localData = { ...newRecord };
                // Mapping event_id -> eventId pour la compatibilité locale
                if (localData.event_id && !localData.eventId) {
                    localData.eventId = localData.event_id;
                }

                if (table === 'config') {
                    await db.put(table as any, localData, 'main');
                } else {
                    await db.put(table as any, localData);
                }
            }
            else if (eventType === 'DELETE' && oldRecord?.id) {
                if (table === 'config') {
                    await db.delete(table as any, 'main');
                } else {
                    await db.delete(table as any, oldRecord.id);
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
            
            const eventId = newRecord?.eventId || newRecord?.event_id;
            const type = table === 'team_locations' ? 'NEW_LOCATION' : 'UPDATE_' + table.toUpperCase();
            
            if (bcMap[table]) {
                const channel = new BroadcastChannel(bcMap[table]);
                channel.postMessage({ 
                    type, 
                    eventId, 
                    entry: newRecord 
                });
                channel.close();
            }
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
            const db = await initDB();
            const allItems = await db.getAll('sync_queue');
            let pendingItems = allItems.filter(i => i.status === 'PENDING');
            
            if (forceAll) {
                const failedItems = allItems.filter(i => i.status === 'FAILED');
                pendingItems = [...pendingItems, ...failedItems];
            }
            
            if (pendingItems.length === 0) {
                console.log(`Sync: No pending items (Total in queue: ${allItems.length})`);
                return;
            }

            pendingItems.sort((a, b) => a.timestamp - b.timestamp);
            
            for (const item of pendingItems) {
                if (!navigator.onLine) break;
                
                let success = false;
                let errorMessage = '';

                try {
                    // Mapping eventId -> event_id pour Supabase
                    const dataToPush = { ...item.data };
                    if (dataToPush.eventId && !dataToPush.event_id) {
                        dataToPush.event_id = dataToPush.eventId;
                    }

                    // Timeout de 10 secondes pour l'appel Supabase
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
                    if (item.retries > 3) { // Réduit à 3 tentatives pour être plus réactif
                        item.status = 'FAILED';
                        console.error(`Sync: Permanent failure for ${item.table} after 3 retries: ${errorMessage}`);
                    } else {
                        console.warn(`Sync: Retry ${item.retries}/3 for ${item.table}: ${errorMessage}`);
                    }
                    await freshDb.put('sync_queue', item);
                    
                    // Si c'est une erreur de timeout ou réseau, on arrête le traitement de la file pour l'instant
                    if (errorMessage.includes('Timeout') || errorMessage.includes('Network') || errorMessage.includes('fetch')) {
                        break;
                    }
                }
                
                // Petit délai pour ne pas saturer le réseau
                await new Promise(r => setTimeout(r, 50));
            }
        } catch (e) {
            console.error("Sync: Global processQueue error:", e);
        } finally { 
            const remaining = await this.getPendingCount();
            if (remaining === 0) {
                this.hasError = false; 
            }
            this.isProcessing = false; 
            this.notifyListeners(); 
            console.log("Sync: Queue processing finished.");
        }
    }
}
export const syncService = new SyncService();
