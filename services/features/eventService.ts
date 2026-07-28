
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
        return await db.getAll('events');
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
            data: cleanEvent,
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
        const event = await db.get('events', id);
        if (!event) return;

        const tx = db.transaction(['events', 'events_archive', 'sync_queue'], 'readwrite');
        
        // 1. Copie vers Archives Locales
        await tx.objectStore('events_archive').put(event);
        
        // 2. Suppression de la liste Active
        await tx.objectStore('events').delete(id);
        
        // 3. Sync: On considère l'archivage comme une suppression de la liste active partagée
        // (L'archive reste accessible localement pour l'admin qui a fait l'action)
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
        
        auditService.log('ARCHIVE_EVENT', `Archived ID: ${id}`);
        bc.postMessage({ type: 'UPDATE_EVENTS' });
    },

    getEventById: async (id: string): Promise<AppEvent | undefined> => {
        const db = await initDB();
        let event = await db.get('events', id);
        if (!event) event = await db.get('events_archive', id);
        
        // Si non trouvé localement et qu'on est en ligne, on tente de le récupérer sur Supabase
        if (!event && isLive) {
            try {
                // On force un petit délai pour laisser Supabase s'initialiser si besoin
                const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
                if (!error && data) {
                    event = data as AppEvent;
                    // On le met en cache localement
                    await db.put('events', event);
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
        return await db.getAll('events_archive');
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
