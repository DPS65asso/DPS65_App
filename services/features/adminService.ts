
import { initDB } from '../db';
import { AppConfig, AssociationDocument, NewsPost, TrainingCourse } from '../../types';
import { auditService } from '../auditService';
import { restoreLogFromStorage, restoreVictimFromStorage } from '../core/storageHelpers';
import { syncService } from '../syncService';
import { generateUUID } from '../../utils/security';

const DEFAULT_CONFIG: AppConfig = {
    hospitals: ['CH Tarbes', 'Clinique Ormeau', 'CH Pau', 'CH Lourdes'],
    teams: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Tango'],
    voiceUri: '',
    yaplaLink: 'https://dispositif-premiers-secours-65.s2.yapla.com/fr/espace-membres',
    signupCode: 'DPS65-2025', // Code par défaut
    medications: ['Paracétamol', 'Ibuprofène', 'Spasfon', 'Gaviscon'],
    solutes: ['NaCl 0.9%', 'G5%', 'Ringer Lactate']
};

export const adminService = {
    getConfig: async (): Promise<AppConfig> => {
        try {
          const db = await initDB();
          const conf = await db.get('config', 'main');
          return { ...DEFAULT_CONFIG, ...conf } as AppConfig;
        } catch { return DEFAULT_CONFIG; }
    },
    
    saveConfig: async (config: AppConfig): Promise<void> => {
        try {
          const db = await initDB();
          
          // Mise à jour locale
          await db.put('config', config, 'main');
          
          // Préparation d'un objet propre pour Supabase (évite les undefined qui causent des erreurs JSONB/SQL)
          const cleanConfig: AppConfig = {
              id: 'main', // ID fixe pour la ligne de configuration unique
              hospitals: Array.isArray(config.hospitals) ? config.hospitals : [],
              teams: Array.isArray(config.teams) ? config.teams : [],
              voiceUri: config.voiceUri || '',
              yaplaLink: config.yaplaLink || '',
              signupCode: config.signupCode || '',
              medications: Array.isArray(config.medications) ? config.medications : [],
              solutes: Array.isArray(config.solutes) ? config.solutes : [],
              forcedUpdateAt: config.forcedUpdateAt || ''
          };

          // Sync Cloud (Important pour le Kill Switch)
          const tx = db.transaction(['config', 'sync_queue'], 'readwrite');
          await tx.objectStore('config').put(config, 'main');
          await tx.objectStore('sync_queue').put({
              id: generateUUID(),
              table: 'config', 
              action: 'UPSERT',
              data: cleanConfig, 
              timestamp: Date.now(),
              status: 'PENDING',
              retries: 0
          });
          await tx.done;
          
          // Broadcast local pour mise à jour immédiate des composants (SecurityMonitor, HomePage)
          const localBc = new BroadcastChannel('dps65_config_channel');
          localBc.postMessage({ type: 'UPDATE_CONFIG' });
          localBc.close();

          // Tentative d'envoi immédiat sur Supabase si en ligne
          const isLive = typeof window !== 'undefined' && (window as any).isLiveMode !== false;
          if (isLive && navigator.onLine) {
              try {
                  const { supabase } = await import('../supabaseClient');
                  if (supabase) {
                      await supabase.from('config').upsert(cleanConfig);
                      console.log("Admin: Config sync directe vers Supabase réussie.");
                  }
              } catch (supaErr) {
                  console.warn("Admin: Sync directe Supabase en échec, file de sync prend le relais:", supaErr);
              }
          }

          console.log("Admin: Config saved locally and added to sync queue.");
          syncService.processQueue();
          auditService.log('CONFIG_UPDATE', 'Configuration mise à jour');
        } catch (e) { console.error(e); }
    },

    getNews: async (): Promise<NewsPost[]> => {
        const db = await initDB();
        return (await db.getAll('news')).sort((a,b) => b.date - a.date);
    },

    saveNews: async (news: NewsPost): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['news', 'sync_queue'], 'readwrite');
        await tx.objectStore('news').put(news);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'news',
            action: 'UPSERT',
            data: news,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;

        // Broadcast local immédiat
        try {
            const bc = new BroadcastChannel('dps65_asso_channel');
            bc.postMessage({ type: 'UPDATE_NEWS' });
            bc.close();
        } catch(e) {}

        // Push direct vers Supabase si en ligne
        const isLive = typeof window !== 'undefined' && (window as any).isLiveMode !== false;
        if (isLive && navigator.onLine) {
            try {
                const { supabase } = await import('../supabaseClient');
                if (supabase) {
                    await supabase.from('news').upsert(news);
                }
            } catch (e) {
                console.warn("Direct news sync warning:", e);
            }
        }

        syncService.processQueue();
    },

    deleteNews: async (id: string): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['news', 'sync_queue'], 'readwrite');
        await tx.objectStore('news').delete(id);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'news',
            action: 'DELETE',
            data: { id },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;

        try {
            const bc = new BroadcastChannel('dps65_asso_channel');
            bc.postMessage({ type: 'UPDATE_NEWS' });
            bc.close();
        } catch(e) {}

        const isLive = typeof window !== 'undefined' && (window as any).isLiveMode !== false;
        if (isLive && navigator.onLine) {
            try {
                const { supabase } = await import('../supabaseClient');
                if (supabase) {
                    await supabase.from('news').delete().eq('id', id);
                }
            } catch (e) {
                console.warn("Direct delete news warning:", e);
            }
        }

        syncService.processQueue();
    },

    getDocuments: async (): Promise<AssociationDocument[]> => {
        const db = await initDB();
        return (await db.getAll('documents')).sort((a,b) => b.date - a.date);
    },

    saveDocument: async (doc: AssociationDocument): Promise<void> => {
        const db = await initDB();
        
        // Nettoyage de l'objet Document
        const cleanDoc = {
            id: doc.id,
            title: doc.title || 'Document Sans Titre',
            category: doc.category || 'Autre',
            url: doc.url,
            date: doc.date || Date.now(),
            adminOnly: !!doc.adminOnly // Force booléen true/false (pas undefined)
        };

        const tx = db.transaction(['documents', 'sync_queue'], 'readwrite');
        await tx.objectStore('documents').put(cleanDoc);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'documents',
            action: 'UPSERT',
            data: cleanDoc,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;

        // Broadcast local immédiat pour mise à jour instantanée de la vue Portail Asso & Admin
        try {
            const bc = new BroadcastChannel('dps65_asso_channel');
            bc.postMessage({ type: 'UPDATE_DOCUMENTS' });
            bc.close();
        } catch(e) {}

        // Envoi direct à Supabase si connecté
        const isLive = typeof window !== 'undefined' && (window as any).isLiveMode !== false;
        if (isLive && navigator.onLine) {
            try {
                const { supabase } = await import('../supabaseClient');
                if (supabase) {
                    await supabase.from('documents').upsert(cleanDoc);
                    console.log("Admin: Document synchro directe Supabase OK.");
                }
            } catch (e) {
                console.warn("Direct document sync warning:", e);
            }
        }

        syncService.processQueue();
    },

    deleteDocument: async (id: string): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['documents', 'sync_queue'], 'readwrite');
        await tx.objectStore('documents').delete(id);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'documents',
            action: 'DELETE',
            data: { id },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;

        try {
            const bc = new BroadcastChannel('dps65_asso_channel');
            bc.postMessage({ type: 'UPDATE_DOCUMENTS' });
            bc.close();
        } catch(e) {}

        const isLive = typeof window !== 'undefined' && (window as any).isLiveMode !== false;
        if (isLive && navigator.onLine) {
            try {
                const { supabase } = await import('../supabaseClient');
                if (supabase) {
                    await supabase.from('documents').delete().eq('id', id);
                }
            } catch (e) {
                console.warn("Direct delete document warning:", e);
            }
        }

        syncService.processQueue();
    },

    getCourses: async (): Promise<TrainingCourse[]> => {
        const db = await initDB();
        return await db.getAll('courses');
    },

    saveCourse: async (course: TrainingCourse): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['courses', 'sync_queue'], 'readwrite');
        await tx.objectStore('courses').put(course);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'courses',
            action: 'UPSERT',
            data: course,
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;

        try {
            const bc = new BroadcastChannel('dps65_asso_channel');
            bc.postMessage({ type: 'UPDATE_COURSES' });
            bc.close();
        } catch(e) {}

        const isLive = typeof window !== 'undefined' && (window as any).isLiveMode !== false;
        if (isLive && navigator.onLine) {
            try {
                const { supabase } = await import('../supabaseClient');
                if (supabase) {
                    await supabase.from('courses').upsert(course);
                }
            } catch (e) {
                console.warn("Direct course sync warning:", e);
            }
        }

        syncService.processQueue();
    },

    deleteCourse: async (id: string): Promise<void> => {
        const db = await initDB();
        const tx = db.transaction(['courses', 'sync_queue'], 'readwrite');
        await tx.objectStore('courses').delete(id);
        await tx.objectStore('sync_queue').put({
            id: generateUUID(),
            table: 'courses',
            action: 'DELETE',
            data: { id },
            timestamp: Date.now(),
            status: 'PENDING',
            retries: 0
        });
        await tx.done;

        try {
            const bc = new BroadcastChannel('dps65_asso_channel');
            bc.postMessage({ type: 'UPDATE_COURSES' });
            bc.close();
        } catch(e) {}

        const isLive = typeof window !== 'undefined' && (window as any).isLiveMode !== false;
        if (isLive && navigator.onLine) {
            try {
                const { supabase } = await import('../supabaseClient');
                if (supabase) {
                    await supabase.from('courses').delete().eq('id', id);
                }
            } catch (e) {
                console.warn("Direct delete course warning:", e);
            }
        }

        syncService.processQueue();
    },

    exportFullBackup: async (): Promise<string> => {
        const db = await initDB();
        const events = await db.getAll('events');
        const storedVictims = await db.getAll('victims');
        const victims = await Promise.all(storedVictims.map(v => restoreVictimFromStorage(v)));
        const logs = await auditService.getAllLogs();
        const config = await adminService.getConfig();
        const storedLogbook = await db.getAll('logbook');
        const logbook = await Promise.all(storedLogbook.map(l => restoreLogFromStorage(l)));
        
        const backupData = {
          version: 5, 
          date: new Date().toISOString(),
          data: { events, victims, logs, config, logbook }
        };
        auditService.log('BACKUP_EXPORT', `Export IDB: ${events.length} ev, ${victims.length} vict`);
        return JSON.stringify(backupData, null, 2);
    },
    
    importFullBackup: async (jsonString: string): Promise<{events: number, victims: number}> => {
        try {
            const backup = JSON.parse(jsonString);
            if (!backup.data) throw new Error("Format JSON invalide ou corrompu.");

            const db = await initDB();
            const tx = db.transaction(['events', 'victims', 'logbook', 'config'], 'readwrite');

            let eCount = 0;
            let vCount = 0;

            if (Array.isArray(backup.data.events)) {
                for (const e of backup.data.events) {
                    await tx.objectStore('events').put(e);
                    eCount++;
                }
            }

            if (Array.isArray(backup.data.victims)) {
                for (const v of backup.data.victims) {
                    await tx.objectStore('victims').put(v);
                    vCount++;
                }
            }

            if (Array.isArray(backup.data.logbook)) {
                for (const l of backup.data.logbook) {
                    await tx.objectStore('logbook').put(l);
                }
            }

            if (backup.data.config) {
                await tx.objectStore('config').put(backup.data.config, 'main');
            }

            await tx.done;
            auditService.log('BACKUP_IMPORT', `Import: ${eCount} ev, ${vCount} vict`);
            return { events: eCount, victims: vCount };
        } catch (e) {
            console.error("Import failed", e);
            throw e;
        }
    },
};
