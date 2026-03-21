
import { AuditLog, AuditAction } from '../types';
import { generateUUID } from '../utils/security';
import { initDB } from './db';

export const auditService = {
  log: async (action: AuditAction, details: string) => {
    // Plus de vérification hasSessionKey() ici car la session locale n'existe plus.
    
    const newLog: AuditLog = {
      id: generateUUID(),
      timestamp: Date.now(),
      action,
      details
    };

    try {
      const db = await initDB();
      await db.put('audit', newLog);
    } catch (e) {
      console.error("Failed to write audit log", e);
    }
  },

  getAllLogs: async (): Promise<AuditLog[]> => {
    try {
        const db = await initDB();
        const logs = await db.getAllFromIndex('audit', 'by-date');
        return logs.reverse(); // Plus récent en premier
    } catch (e) {
        return [];
    }
  },
  
  clearLogs: async () => {
    const db = await initDB();
    await db.clear('audit');
  },

  purgeOldLogs: async (maxAgeMs: number): Promise<number> => {
    try {
      const db = await initDB();
      const cutoff = Date.now() - maxAgeMs;
      const range = IDBKeyRange.upperBound(cutoff);
      
      // Compter avant de supprimer pour le rapport
      let count = 0;
      let cursor = await db.transaction('audit', 'readwrite').store.index('by-date').openCursor(range);
      
      while (cursor) {
          await cursor.delete();
          count++;
          cursor = await cursor.continue();
      }
      return count;
    } catch (e) {
      console.error("Failed to purge logs", e);
    }
    return 0;
  }
};
