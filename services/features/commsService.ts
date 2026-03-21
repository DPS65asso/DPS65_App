
import { initDB } from '../db';
import { LogbookEntry } from '../../types';
import { sanitizeInput, generateUUID } from '../../utils/security';
import { prepareLogForStorage, restoreLogFromStorage } from '../core/storageHelpers';
import { syncService } from '../syncService';

const bc = new BroadcastChannel('dps65_comms_channel');

export const commsService = {
    addLogbookEntry: async (entry: LogbookEntry): Promise<void> => {
        const cleanEntry = { ...entry, message: sanitizeInput(entry.message), author: sanitizeInput(entry.author) };
        const db = await initDB();
        const encryptedEntry = await prepareLogForStorage(cleanEntry);
        
        const tx = db.transaction(['logbook', 'sync_queue'], 'readwrite');
        await tx.objectStore('logbook').put(encryptedEntry as any);
        
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'logbook',
            action: 'UPSERT',
            data: encryptedEntry,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        
        await tx.done;
        syncService.processQueue();
        
        bc.postMessage({ type: 'NEW_LOG', entry: cleanEntry });
    },

    getLogbookEntries: async (eventId: string): Promise<LogbookEntry[]> => {
        const db = await initDB();
        const storedLogs = await db.getAllFromIndex('logbook', 'by-event', eventId);
        const decryptedLogs = await Promise.all(storedLogs.map(log => restoreLogFromStorage(log)));
        return decryptedLogs.sort((a,b) => b.timestamp - a.timestamp);
    },
};
