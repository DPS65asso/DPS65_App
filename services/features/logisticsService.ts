
import { initDB } from '../db';
import { VehicleDefinition, VehicleCheck, UserUniformData } from '../../types';
import { auditService } from '../auditService';
import { syncService } from '../syncService';
import { generateUUID } from '../../utils/security';
import { supabase, isLive } from '../supabaseClient';

export const logisticsService = {
    getFleet: async (): Promise<VehicleDefinition[]> => {
        const db = await initDB();
        let fleet = await db.getAll('fleet');

        // Récupération automatique depuis Supabase si le cache local est vide
        if (fleet.length === 0 && isLive && navigator.onLine) {
            try {
                const { data, error } = await supabase.from('fleet').select('*');
                if (!error && data && data.length > 0) {
                    const tx = db.transaction('fleet', 'readwrite');
                    for (const v of data) {
                        await tx.store.put(v);
                    }
                    await tx.done;
                    fleet = await db.getAll('fleet');
                }
            } catch (e) {
                console.warn("[logisticsService] Auto-pull fleet failed:", e);
            }
        }

        // Si le parc est toujours vide (mode preview ou premier démarrage), génération d'un parc opérationnel par défaut
        if (fleet.length === 0) {
            const defaultFleet: VehicleDefinition[] = [
                {
                    id: 'fleet-vpsp-01',
                    name: 'VPSP 65 (Ambulance)',
                    type: 'VPSP',
                    immatriculation: '65-DPS-01',
                    imageUrl: '/assets/aistudio/IMG_9100_c893e3db.PNG',
                    lastTechControl: new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0],
                    nextTechControl: new Date(Date.now() + 300 * 86400000).toISOString().split('T')[0],
                    lastService: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
                    nextService: new Date(Date.now() + 270 * 86400000).toISOString().split('T')[0],
                    customTracking: []
                },
                {
                    id: 'fleet-vps-02',
                    name: 'VPS 65 (Premiers Secours)',
                    type: 'VPS',
                    immatriculation: '65-DPS-02',
                    lastTechControl: new Date(Date.now() - 120 * 86400000).toISOString().split('T')[0],
                    nextTechControl: new Date(Date.now() + 240 * 86400000).toISOString().split('T')[0],
                    lastService: new Date(Date.now() - 40 * 86400000).toISOString().split('T')[0],
                    nextService: new Date(Date.now() + 320 * 86400000).toISOString().split('T')[0],
                    customTracking: []
                },
                {
                    id: 'fleet-vltt-03',
                    name: 'VLTT 65 (Tout-Terrain)',
                    type: 'VLTT',
                    immatriculation: '65-DPS-03',
                    lastTechControl: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
                    nextTechControl: new Date(Date.now() + 330 * 86400000).toISOString().split('T')[0],
                    lastService: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0],
                    nextService: new Date(Date.now() + 340 * 86400000).toISOString().split('T')[0],
                    customTracking: []
                }
            ];

            const tx = db.transaction('fleet', 'readwrite');
            for (const v of defaultFleet) {
                await tx.store.put(v);
            }
            await tx.done;
            fleet = defaultFleet;
        }

        return fleet;
    },

    saveVehicle: async (vehicle: VehicleDefinition): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['fleet', 'sync_queue'], 'readwrite');
        await tx.objectStore('fleet').put(vehicle);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'fleet',
            action: 'UPSERT',
            data: vehicle,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;
        syncService.processQueue();
    },

    deleteVehicle: async (id: string): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['fleet', 'sync_queue'], 'readwrite');
        await tx.objectStore('fleet').delete(id);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'fleet',
            action: 'DELETE',
            data: { id },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;
        syncService.processQueue();
    },

    saveVehicleCheck: async (check: VehicleCheck): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['vehicle_checks', 'sync_queue'], 'readwrite');
        await tx.objectStore('vehicle_checks').put(check);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'vehicle_checks',
            action: 'UPSERT',
            data: check,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;
        syncService.processQueue();
        auditService.log('VEHICLE_CHECK', `Check véhicule ${check.vehicleId}`);
    },

    getVehicleChecks: async (vehicleId?: string): Promise<VehicleCheck[]> => {
        const db = await initDB();
        let checks = vehicleId 
            ? await db.getAllFromIndex('vehicle_checks', 'by-vehicle', vehicleId)
            : await db.getAll('vehicle_checks');

        if (checks.length === 0 && isLive && navigator.onLine) {
            try {
                let query = (supabase.from('vehicle_checks') as any).select('*');
                if (vehicleId) {
                    query = query.eq('vehicleId', vehicleId);
                }
                const { data, error } = await query;
                if (!error && data && data.length > 0) {
                    const tx = db.transaction('vehicle_checks', 'readwrite');
                    for (const c of data) {
                        await tx.store.put(c);
                    }
                    await tx.done;
                    checks = vehicleId 
                        ? await db.getAllFromIndex('vehicle_checks', 'by-vehicle', vehicleId)
                        : await db.getAll('vehicle_checks');
                }
            } catch (e) {
                console.warn("[logisticsService] Auto-pull vehicle_checks failed:", e);
            }
        }
        return checks;
    },

    resolveVehicleBreakdown: async (checkId: string, resolvedBy: string): Promise<void> => {
        const db = await initDB();
        const check = await db.get('vehicle_checks', checkId);
        if (check) {
            const updatedCheck: VehicleCheck = {
                ...check,
                resolved: true,
                resolvedAt: Date.now(),
                resolvedBy
            };
            const tx = db.transaction(['vehicle_checks', 'sync_queue'], 'readwrite');
            await tx.objectStore('vehicle_checks').put(updatedCheck);
            await tx.objectStore('sync_queue').put({
                id: generateUUID(),
                table: 'vehicle_checks',
                action: 'UPSERT',
                data: updatedCheck,
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });
            await tx.done;
            syncService.processQueue();
            auditService.log('VEHICLE_CHECK', `Panne mécanique résolue pour ${check.vehicleId} par ${resolvedBy}`);
        }
    },

    deleteVehicleCheck: async (id: string): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['vehicle_checks', 'sync_queue'], 'readwrite');
        await tx.objectStore('vehicle_checks').delete(id);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'vehicle_checks',
            action: 'DELETE',
            data: { id },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;
        syncService.processQueue();
    },

    saveUniforms: async (userId: string, data: Partial<UserUniformData>): Promise<void> => {
        const db = await initDB();
        const updated = { id: userId, ...data, lastUpdated: Date.now() } as UserUniformData;
        
        const tx = db.transaction(['uniforms', 'sync_queue'], 'readwrite');
        await tx.objectStore('uniforms').put(updated);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'uniforms',
            action: 'UPSERT',
            data: updated,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;
        syncService.processQueue();
        
        auditService.log('UNIFORM_UPDATE', `Mise à jour vestiaire ${userId}`);
    },

    getMyUniforms: async (userId: string): Promise<UserUniformData | null> => {
        const db = await initDB();
        return await db.get('uniforms', userId) || null;
    },

    getAllUniforms: async (): Promise<UserUniformData[]> => {
        const db = await initDB();
        return await db.getAll('uniforms');
    },
};
