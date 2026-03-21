
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Event, Victim, LogbookEntry, AppConfig, AuditLog, AssociationDocument, Bag, BagItem, BagConsumption, VehicleDefinition, VehicleCheck, TrainingCourse, NewsPost, UserUniformData, UserProfile, TeamLocation, Mission, CustomMarker } from '../types';

export interface SyncQueueItem {
    id: string; // UUID de l'action de sync
    table: string; // 'victims', 'events', 'logbook', etc.
    action: 'UPSERT' | 'DELETE';
    data: any; // L'objet à envoyer
    timestamp: number;
    status: 'PENDING' | 'RETRY' | 'FAILED';
    retries: number;
}

interface DPS65DB extends DBSchema {
  events: { key: string; value: Event; indexes: { 'by-date': string }; };
  events_archive: { key: string; value: Event; };
  victims: { key: string; value: Victim; indexes: { 'by-event': string }; };
  victim_photos: { key: string; value: { id: string; victimId: string; dataUrl?: string; blob?: Blob; publicUrl?: string; timestamp: number }; indexes: { 'by-victim': string }; };
  logbook: { key: string; value: LogbookEntry; indexes: { 'by-event': string }; };
  config: { key: string; value: AppConfig; };
  documents: { key: string; value: AssociationDocument; };
  audit: { key: string; value: AuditLog; indexes: { 'by-date': number }; };
  bags: { key: string; value: Bag; };
  bag_items: { key: string; value: BagItem; indexes: { 'by-bag': string }; };
  bag_consumptions: { key: string; value: BagConsumption; indexes: { 'by-bag': string }; };
  fleet: { key: string; value: VehicleDefinition; };
  vehicle_checks: { key: string; value: VehicleCheck; indexes: { 'by-vehicle': string }; };
  uniforms: { key: string; value: UserUniformData; };
  news: { key: string; value: NewsPost; };
  courses: { key: string; value: TrainingCourse; };
  profiles: { key: string; value: UserProfile; };
  team_locations: { key: string; value: TeamLocation; indexes: { 'by-timestamp': number }; };
  missions: { key: string; value: Mission; indexes: { 'by-date': string }; };
  custom_markers: { key: string; value: CustomMarker; indexes: { 'by-event': string }; };
  
  // NOUVELLE TABLE POUR LA SYNCHRONISATION
  sync_queue: { key: string; value: SyncQueueItem; indexes: { 'by-status': string; 'by-table': string } };
}

const DB_NAME = 'dps65_db_local';
const DB_VERSION = 5; // Version 5 pour custom_markers

let dbPromise: Promise<IDBPDatabase<DPS65DB>> | null = null;

export const initDB = (): Promise<IDBPDatabase<DPS65DB>> => {
  if (!dbPromise) {
    dbPromise = openDB<DPS65DB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events', { keyPath: 'id' });
          store.createIndex('by-date', 'date');
        }
        if (!db.objectStoreNames.contains('events_archive')) db.createObjectStore('events_archive', { keyPath: 'id' });
        
        if (!db.objectStoreNames.contains('victims')) {
          const store = db.createObjectStore('victims', { keyPath: 'id' });
          store.createIndex('by-event', 'eventId');
        }
        
        if (!db.objectStoreNames.contains('victim_photos')) {
          const store = db.createObjectStore('victim_photos', { keyPath: 'id' });
          store.createIndex('by-victim', 'victimId');
        }

        if (!db.objectStoreNames.contains('logbook')) {
          const store = db.createObjectStore('logbook', { keyPath: 'id' });
          store.createIndex('by-event', 'eventId');
        }
        
        if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
        if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'id' });
        
        if (!db.objectStoreNames.contains('audit')) {
          const store = db.createObjectStore('audit', { keyPath: 'id' });
          store.createIndex('by-date', 'timestamp');
        }
        
        if (!db.objectStoreNames.contains('bags')) db.createObjectStore('bags', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('bag_items')) {
          const store = db.createObjectStore('bag_items', { keyPath: 'id' });
          store.createIndex('by-bag', 'bagId');
        }
        if (!db.objectStoreNames.contains('bag_consumptions')) {
          const store = db.createObjectStore('bag_consumptions', { keyPath: 'id' });
          store.createIndex('by-bag', 'bagId');
        }
        if (!db.objectStoreNames.contains('fleet')) db.createObjectStore('fleet', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('vehicle_checks')) {
          const store = db.createObjectStore('vehicle_checks', { keyPath: 'id' });
          store.createIndex('by-vehicle', 'vehicleId');
        }
        if (!db.objectStoreNames.contains('uniforms')) db.createObjectStore('uniforms', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('news')) db.createObjectStore('news', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('courses')) db.createObjectStore('courses', { keyPath: 'id' });
        
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('team_locations')) {
            const store = db.createObjectStore('team_locations', { keyPath: 'id' });
            store.createIndex('by-timestamp', 'timestamp');
        }

        // Migration V2 : Sync Queue
        if (!db.objectStoreNames.contains('sync_queue')) {
            const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
            store.createIndex('by-status', 'status');
            store.createIndex('by-table', 'table');
        }

        // Migration V3/V4 : Missions
        if (!db.objectStoreNames.contains('missions')) {
            const store = db.createObjectStore('missions', { keyPath: 'id' });
            store.createIndex('by-date', 'date');
        }

        // Migration V5 : Custom Markers
        if (!db.objectStoreNames.contains('custom_markers')) {
            const store = db.createObjectStore('custom_markers', { keyPath: 'id' });
            store.createIndex('by-event', 'eventId');
        }
      },
      terminated() {
        console.warn('Connexion DB fermée (Auto-Recovering)...');
        dbPromise = null;
      },
    });
  }
  return dbPromise;
};
