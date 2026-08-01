
import { initDB } from '../db';
import { supabase, isLive } from '../supabaseClient';
import { Event as AppEvent, Mission } from '../../types';
import { generateUUID, getLocalDateString } from '../../utils/security';
import { auditService } from '../auditService';
import { sanitizeEventData } from '../core/storageHelpers';
import { syncService } from '../syncService';

const bc = new BroadcastChannel('dps65_events_channel');

export const eventService = {
    getEvents: async (): Promise<AppEvent[]> => {
        const db = await initDB();
        const allEvents = await db.getAll('events');
        return allEvents.filter(e => !e.isArchived);
    },

    saveEvent: async (event: AppEvent): Promise<void> => {
        const cleanEvent = { ...sanitizeEventData(event), updatedAt: Date.now() };
        const db = await initDB();
        
        const tx = db.transaction(['events', 'sync_queue'], 'readwrite');
        await tx.objectStore('events').put(cleanEvent);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'events',
            action: 'UPSERT',
            data: { ...cleanEvent, is_archived: !!cleanEvent.isArchived },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;
        
        syncService.processQueue();
        
        auditService.log('CREATE_EVENT', `Event: ${cleanEvent.name}`);
        bc.postMessage({ type: 'UPDATE_EVENTS' });
    },

    deleteEvent: async (id: string): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['events', 'events_archive', 'victims', 'logbook', 'sync_queue'], 'readwrite');
        await tx.objectStore('events').delete(id);
        await tx.objectStore('events_archive').delete(id);
        
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'events',
            action: 'DELETE',
            data: { id },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        
        await tx.done;
        syncService.processQueue();
        
        auditService.log('DELETE_EVENT', `ID: ${id}`);
        bc.postMessage({ type: 'UPDATE_EVENTS' });
    },

    archiveEvent: async (id: string): Promise<void> => {
        const db = await initDB();
        let event = await db.get('events', id);
        if (!event) event = await db.get('events_archive', id);
        if (!event) return;

        const archivedEvent: AppEvent = { 
            ...sanitizeEventData(event), 
            isArchived: true, 
            updatedAt: Date.now() 
        };

        const tx = db.transaction(['events', 'events_archive', 'sync_queue'], 'readwrite');
        
        // 1. Sauvegarde dans events_archive ET mise à jour de events
        await tx.objectStore('events_archive').put(archivedEvent);
        await tx.objectStore('events').put(archivedEvent);
        
        // 2. Synchronisation en UPSERT avec is_archived: true (ne supprime PAS l'événement sur Supabase)
        const syncData: any = {
            ...archivedEvent,
            is_archived: true,
            isArchived: true
        };

        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'events',
            action: 'UPSERT',
            data: syncData,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });

        await tx.done;
        syncService.processQueue();
        
        auditService.log('ARCHIVE_EVENT', `Archived ID: ${id}`);
        bc.postMessage({ type: 'UPDATE_EVENTS' });
    },

    unarchiveEvent: async (id: string): Promise<void> => {
        const db = await initDB();
        let event = await db.get('events_archive', id);
        if (!event) event = await db.get('events', id);
        if (!event) return;

        const activeEvent: AppEvent = { 
            ...sanitizeEventData(event), 
            isArchived: false, 
            updatedAt: Date.now() 
        };

        const tx = db.transaction(['events', 'events_archive', 'sync_queue'], 'readwrite');
        await tx.objectStore('events').put(activeEvent);
        await tx.objectStore('events_archive').delete(id);

        const syncData: any = {
            ...activeEvent,
            is_archived: false,
            isArchived: false
        };

        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'events',
            action: 'UPSERT',
            data: syncData,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });

        await tx.done;
        syncService.processQueue();

        auditService.log('UNARCHIVE_EVENT', `Unarchived ID: ${id}`);
        bc.postMessage({ type: 'UPDATE_EVENTS' });
    },

    getEventById: async (id: string): Promise<AppEvent | undefined> => {
        const db = await initDB();
        let event = await db.get('events', id);
        if (!event) event = await db.get('events_archive', id);
        
        // Si non trouvé localement et qu'on est en ligne, on tente de le récupérer sur Supabase
        if (!event && isLive) {
            try {
                const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
                if (!error && data) {
                    event = data as AppEvent;
                    if (data.is_archived) event.isArchived = true;
                    // On le met en cache localement
                    await db.put(event.isArchived ? 'events_archive' : 'events', event);
                }
            } catch (e) {
                console.error("Error fetching event from Supabase:", e);
            }
        }
        
        return event;
    },

    ensureDailyEvent: async (): Promise<string> => {
        const today = getLocalDateString();
        const events = await eventService.getEvents();
        const existing = events.find(e => e.date === today);
        if (existing) return existing.id;

        const newEvent: AppEvent = {
            id: generateUUID(),
            name: `INTERVENTION ${new Date().toLocaleDateString('fr-FR')}`,
            date: today,
            location: 'Non spécifié (Auto)',
            createdAt: Date.now()
        };
        await eventService.saveEvent(newEvent);
        return newEvent.id;
    },

    getArchivedEvents: async (): Promise<AppEvent[]> => {
        const db = await initDB();
        const archivedStore = await db.getAll('events_archive');
        const activeStore = await db.getAll('events');
        const archivedFromActive = activeStore.filter(e => !!e.isArchived);

        const map = new Map<string, AppEvent>();
        archivedStore.forEach(e => map.set(e.id, { ...e, isArchived: true }));
        archivedFromActive.forEach(e => map.set(e.id, { ...e, isArchived: true }));

        // En ligne : si Supabase a des événements archivés (is_archived = true)
        if (isLive) {
            try {
                const { data } = await supabase.from('events').select('*').eq('is_archived', true);
                if (data && Array.isArray(data)) {
                    data.forEach(item => {
                        const evt = { ...item, isArchived: true } as AppEvent;
                        map.set(evt.id, evt);
                    });
                }
            } catch (err) {
                // Si la colonne is_archived n'existe pas encore sur Supabase, on ignore silencieusement
            }
        }

        return Array.from(map.values());
    },

    // --- MISSIONS (Migrated to IDB) ---

    getMissions: async (): Promise<Mission[]> => {
        const db = await initDB();
        return await db.getAllFromIndex('missions', 'by-date');
    },

    saveMission: async (mission: Mission): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['missions', 'sync_queue'], 'readwrite');
        await tx.objectStore('missions').put(mission);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'missions',
            action: 'UPSERT',
            data: mission,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;
        
        syncService.processQueue();
        bc.postMessage({ type: 'UPDATE_MISSIONS' });
    },

    deleteMission: async (id: string): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['missions', 'sync_queue'], 'readwrite');
        await tx.objectStore('missions').delete(id);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'missions',
            action: 'DELETE',
            data: { id },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;
        
        syncService.processQueue();
        bc.postMessage({ type: 'UPDATE_MISSIONS' });
    },

    setMissionStatus: async (missionId: string, userId: string, status: 'present' | 'absent' | 'reservist' | 'none'): Promise<boolean> => {
        const db = await initDB();
        const mission = await db.get('missions', missionId);
        if (!mission) return false;

        let present = mission.registeredUserIds || [];
        let absent = mission.absentUserIds || [];
        let reservists = mission.reservistUserIds || [];
        
        present = present.filter(id => id !== userId);
        absent = absent.filter(id => id !== userId);
        reservists = reservists.filter(id => id !== userId);
        
        if (status === 'present') present.push(userId);
        else if (status === 'absent') absent.push(userId);
        else if (status === 'reservist') reservists.push(userId);
        
        const updatedMission = { ...mission, registeredUserIds: present, absentUserIds: absent, reservistUserIds: reservists };
        await eventService.saveMission(updatedMission);
        return true;
    },
    
    purgeOldData: async (): Promise<void> => {
        // Nettoyage éventuel du localStorage obsolète
        localStorage.removeItem('dps65_missions');
    }
};
