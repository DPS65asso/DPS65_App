
import { eventService } from './features/eventService';
import { victimService } from './features/victimService';
import { logisticsService } from './features/logisticsService';
import { commsService } from './features/commsService';
import { adminService } from './features/adminService';
import { initDB } from './db';
import { syncService } from './syncService';
import { CustomMarker } from '../types';
import { generateUUID } from '../utils/security';

// On combine tous les services dans un seul objet "storageService"
export const storageService = {
    // Core
    isCloudEnabled: () => true, // Activé pour la sync des points

    // Events & Missions
    ...eventService,

    // Victims
    ...victimService,

    // Logistics (Fleet & Uniforms)
    ...logisticsService,

    // Comms (Chat & Logbook)
    ...commsService,

    // Admin & Config
    ...adminService,

    // --- CUSTOM MARKERS (SYNCED) ---
    addCustomMarker: async (marker: CustomMarker): Promise<void> => {
        const db = await initDB();
        await db.put('custom_markers', marker);
        
        // Ajout à la file de sync
        await db.put('sync_queue', {
            id: generateUUID(),
            table: 'custom_markers',
            action: 'UPSERT',
            data: marker,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        syncService.processQueue();
    },

    getCustomMarkers: async (eventId: string): Promise<CustomMarker[]> => {
        const db = await initDB();
        return await db.getAllFromIndex('custom_markers', 'by-event', eventId);
    },

    updateCustomMarkerPosition: async (id: string, lat: number, lng: number): Promise<void> => {
        const db = await initDB();
        const marker = await db.get('custom_markers', id);
        if (marker) {
            marker.lat = lat;
            marker.lng = lng;
            await db.put('custom_markers', marker);
            
            // Ajout à la file de sync
            await db.put('sync_queue', {
                id: generateUUID(),
                table: 'custom_markers',
                action: 'UPSERT',
                data: marker,
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });
            syncService.processQueue();
        }
    },

    deleteCustomMarker: async (id: string): Promise<void> => {
        const db = await initDB();
        const marker = await db.get('custom_markers', id);
        if (marker) {
            await db.delete('custom_markers', id);
            
            // Ajout à la file de sync
            await db.put('sync_queue', {
                id: generateUUID(),
                table: 'custom_markers',
                action: 'DELETE',
                data: { id },
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });
            syncService.processQueue();
        }
    }
};
