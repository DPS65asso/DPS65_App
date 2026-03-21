
import { initDB } from '../db';
import { VehicleDefinition, VehicleCheck, UserUniformData } from '../../types';
import { auditService } from '../auditService';
import { syncService } from '../syncService';
import { generateUUID } from '../../utils/security';

export const logisticsService = {
    getFleet: async (): Promise<VehicleDefinition[]> => {
        const db = await initDB();
        return await db.getAll('fleet');
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
        if (vehicleId) return await db.getAllFromIndex('vehicle_checks', 'by-vehicle', vehicleId);
        return await db.getAll('vehicle_checks');
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
