
import { initDB } from '../db';
import { supabase, isLive } from '../supabaseClient';
import { Victim, CprEvent, Outcome, TriageColor, VictimPhoto } from '../../types';
import { generateUUID, getLocalDateTimeString, sanitizeInput } from '../../utils/security';
import { auditService } from '../auditService';
import { prepareVictimForStorage, restoreVictimFromStorage, sanitizeVictimData } from '../core/storageHelpers';
import { syncService } from '../syncService'; // Import du service de sync

const bc = new BroadcastChannel('dps65_victims_channel');

export const victimService = {
    getVictimsByEvent: async (eventId: string, includePhotos: boolean = false): Promise<Victim[]> => {
        const db = await initDB();
        let storedVictims = await db.getAllFromIndex('victims', 'by-event', eventId);
        
        // Si vide localement et en ligne, on tente de récupérer sur Supabase
        if (storedVictims.length === 0 && isLive) {
            try {
                const { data, error } = await supabase.from('victims').select('*').eq('event_id', eventId);
                if (!error && data) {
                    // Mapping event_id -> eventId si nécessaire
                    const mappedData = data.map((v: any) => ({
                        ...v,
                        eventId: v.event_id || v.eventId
                    }));

                    // On met en cache localement
                    const tx = db.transaction('victims', 'readwrite');
                    for (const v of mappedData) {
                        await tx.store.put(v);
                    }
                    await tx.done;
                    storedVictims = mappedData;
                }
            } catch (e) {
                console.error("Error fetching victims from Supabase:", e);
            }
        }

        const localVictims = await Promise.all(storedVictims.map(v => restoreVictimFromStorage(v)));

        if (!includePhotos) return localVictims;

        const victimsWithPhotos = await Promise.all(localVictims.map(async (v) => {
            const localPhotos = await db.getAllFromIndex('victim_photos', 'by-victim', v.id);
            const mappedPhotos: VictimPhoto[] = localPhotos.map(p => ({ 
                id: p.id, victimId: v.id, timestamp: p.timestamp || Date.now(), blob: p.blob, dataUrl: p.blob ? undefined : p.dataUrl
            }));
            return { ...v, photos: mappedPhotos };
        }));

        return victimsWithPhotos;
    },

    getVictimById: async (victimId: string): Promise<Victim | undefined> => {
        const db = await initDB();
        const storedVictim = await db.get('victims', victimId);
        if (storedVictim) {
            const victim = await restoreVictimFromStorage(storedVictim);
            const localPhotos = await db.getAllFromIndex('victim_photos', 'by-victim', victimId);
            const mappedPhotos = localPhotos.map(p => ({ 
                id: p.id, timestamp: p.timestamp || Date.now(), blob: p.blob, dataUrl: p.blob ? undefined : p.dataUrl 
            })) as VictimPhoto[];
            return { ...victim, photos: mappedPhotos };
        }
        return undefined;
    },

    addVictim: async (victim: Victim): Promise<void> => {
        const cleanVictim = sanitizeVictimData(victim);
        const { photos, ...victimMeta } = cleanVictim;
        victimMeta.updatedAt = Date.now();

        const db = await initDB();
        const encryptedForLocal = await prepareVictimForStorage(victimMeta);
        
        const tx = db.transaction(['victims', 'victim_photos', 'sync_queue'], 'readwrite');
        
        // 1. Ecriture Locale
        await tx.objectStore('victims').put(encryptedForLocal as any);
        if (photos && photos.length > 0) {
            for (const p of photos) {
                await tx.objectStore('victim_photos').put({ 
                    id: p.id, victimId: victim.id, blob: p.blob, dataUrl: p.blob ? undefined : p.dataUrl, timestamp: p.timestamp
                });
            }
        }

        // 2. Ecriture Queue Sync
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'victims',
            action: 'UPSERT',
            data: encryptedForLocal, // On envoie les métadonnées (sans les photos lourdes pour l'instant)
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });

        await tx.done;
        
        // 3. Trigger Sync
        syncService.processQueue();
        
        auditService.log('CREATE_VICTIM', `Victim ID: ${cleanVictim.id}`);
        bc.postMessage({ type: 'UPDATE_VICTIMS', eventId: victim.eventId });
    },

    updateVictim: async (updatedVictim: Victim): Promise<void> => {
        const cleanVictim = sanitizeVictimData(updatedVictim);
        const { photos, ...victimMeta } = cleanVictim;
        victimMeta.updatedAt = Date.now();

        const db = await initDB();
        const encryptedForLocal = await prepareVictimForStorage(victimMeta);

        const tx = db.transaction(['victims', 'victim_photos', 'sync_queue'], 'readwrite');
        
        // 1. Locale
        await tx.objectStore('victims').put(encryptedForLocal as any);
        if (photos && photos.length > 0) {
            for (const p of photos) {
                await tx.objectStore('victim_photos').put({ 
                    id: p.id, victimId: updatedVictim.id, blob: p.blob, dataUrl: p.blob ? undefined : p.dataUrl, timestamp: p.timestamp
                });
            }
        }

        // 2. Sync
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'victims',
            action: 'UPSERT',
            data: encryptedForLocal,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });

        await tx.done;
        syncService.processQueue();
        
        bc.postMessage({ type: 'UPDATE_VICTIMS', eventId: updatedVictim.eventId });
    },

    deleteVictim: async (victimId: string): Promise<void> => {
        const db = await initDB();
        const victim = await db.get('victims', victimId);
        const eventId = victim?.eventId;

        const tx = db.transaction(['victims', 'victim_photos', 'sync_queue'], 'readwrite');
        
        // 1. Locale
        await tx.objectStore('victims').delete(victimId);
        const photoKeys = await tx.objectStore('victim_photos').index('by-victim').getAllKeys(victimId);
        for (const k of photoKeys) await tx.objectStore('victim_photos').delete(k);
        
        // 2. Sync
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'victims',
            action: 'DELETE',
            data: { id: victimId },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });

        await tx.done;
        syncService.processQueue();
        
        auditService.log('DELETE_VICTIM', `Victim ID: ${victimId}`);
        if(eventId) bc.postMessage({ type: 'UPDATE_VICTIMS', eventId });
    },

    createEmergencyVictim: async (eventId: string, customStartTime?: number): Promise<string> => {
        const startTime = customStartTime || Date.now();
        const now = new Date(startTime);
        const timeStr = now.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
        const newId = generateUUID();
        const victim: Victim = {
            id: newId, eventId: eventId, bibNumber: 'ACR', fullName: `INCONNU (ACR ${timeStr})`,
            reason: 'ARRÊT CARDIO-RESPIRATOIRE', careProvided: 'Réanimation Cardio-Pulmonaire (RCP)',
            allergies: 'Inconnu', treatments: 'Inconnu', outcome: Outcome.TREATMENT_IN_PROGRESS,
            arrivalTime: now.toISOString(), careOnSiteTime: now.toISOString(), triageColor: TriageColor.UA,
            isAdvancedMode: true, 
            cprHistory: [{ timestamp: startTime, action: 'START', details: 'Démarrage Métronome Urgence' }],
            cprStartTime: startTime,
            vitals: [{ id: generateUUID(), time: timeStr, pulse: '0', eva: '0', sao2: '?', bp: '?', glycemia: '?', temp: '?' }]
        };
        await victimService.addVictim(victim);
        return newId;
    },

    addCprEvent: async (victimId: string, event: CprEvent): Promise<void> => {
        let victim = await victimService.getVictimById(victimId);
        if (!victim) return;
        const newHistory = [...(victim.cprHistory || []), event];
        await victimService.updateVictim({ ...victim, cprHistory: newHistory });
    },

    addMedicationToVictim: async (victimId: string, name: string, dose: string, customTime?: string): Promise<void> => {
        const victim = await victimService.getVictimById(victimId);
        if (!victim) return;
        const timeStr = customTime || new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
        const updatedVictim = {
            ...victim, isAdvancedMode: true, hasKt: true, ktTime: victim.ktTime || getLocalDateTimeString(),
            medicationsList: [...(victim.medicationsList || []), { id: generateUUID(), name: sanitizeInput(name), dose: sanitizeInput(dose), time: timeStr }]
        };
        await victimService.updateVictim(updatedVictim);
    },

    importVictimFromData: async (victimData: Partial<Victim>, targetEventId: string): Promise<string> => {
        const newId = victimData.id || generateUUID();
        const newVictim: Victim = {
            ...victimData, id: newId, eventId: targetEventId,
            fullName: victimData.fullName || 'Inconnu (Import)',
            outcome: victimData.outcome || 'Traitement en cours',
            arrivalTime: victimData.arrivalTime || new Date().toISOString()
        } as Victim;
        await victimService.addVictim(newVictim);
        return newId;
    },

    dataURLtoBlob: (dataurl: string) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) { u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], { type: mime });
    },
};
