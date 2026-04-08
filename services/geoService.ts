
import { initDB } from './db';
import { generateUUID } from '../utils/security';
import { syncService } from './syncService';

const MIN_DISTANCE_METERS = 10;
const MOVING_INTERVAL_MS = 15000;
const STATIC_INTERVAL_MS = 300000;
const MAX_TRACKING_DURATION = 24 * 60 * 60 * 1000;
const TRACKING_STORAGE_KEY = 'dps65_tracking_state';

interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
  speed?: number | null;
  heading?: number | null;
}

interface TrackingSession {
    teamName: string;
    eventId?: string;
    startTime: number;
}

const calculateDistance = (pos1: GeoPosition, pos2: GeoPosition): number => {
  const R = 6371e3;
  const φ1 = pos1.lat * Math.PI / 180;
  const φ2 = pos2.lat * Math.PI / 180;
  const Δφ = (pos2.lat - pos1.lat) * Math.PI / 180;
  const Δλ = (pos2.lng - pos1.lng) * Math.PI / 180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const bc = new BroadcastChannel('dps65_gps_channel');

class GeoService {
    private watchId: number | null = null;
    private lastSentPosition: GeoPosition | null = null;
    private lastSentTime: number = 0;
    private teamName: string = '';
    private eventId: string | undefined = undefined;
    private startTime: number = 0;
    private onStopCallback: (() => void) | null = null;
    public isTracking = false;
    private isFirstFix = false;

    public async requestPermissions(): Promise<boolean> {
        if (!navigator.geolocation) return false;

        const getPos = (options: PositionOptions): Promise<void> => {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    () => resolve(),
                    (error) => reject(error),
                    options
                );
            });
        };

        try {
            // Tentative 1 : Haute précision (GPS) avec timeout court
            await getPos({ timeout: 5000, enableHighAccuracy: true });
            return true;
        } catch (err: any) {
            if (err.code === 1) { // PERMISSION_DENIED
                 console.error("GPS Permission denied explicitly by user.");
                 return false;
            }
            console.warn("GPS High Accuracy failed, trying Low Accuracy...", err.message);
            try {
                // Tentative 2 : Basse précision
                await getPos({ timeout: 10000, enableHighAccuracy: false });
                return true;
            } catch (err2: any) {
                 if (err2.code === 1) return false; 
                 console.warn("GPS Low Accuracy failed too (allowing anyway for background retry):", err2.message);
                 return true;
            }
        }
    }

    // Tente de restaurer une session active après un reload/restart de l'app
    public async restoreSession(onStop?: () => void): Promise<boolean> {
        try {
            const stored = localStorage.getItem(TRACKING_STORAGE_KEY);
            if (stored) {
                const session: TrackingSession = JSON.parse(stored);
                // Si la session est trop vieille (> 24h), on la jette
                if (Date.now() - session.startTime > MAX_TRACKING_DURATION) {
                    this.clearSessionStorage();
                    return false;
                }

                console.log("🔄 Restauration de la session GPS :", session.teamName);
                this.startTracking(session.teamName, onStop, session.eventId, session.startTime);
                return true;
            }
        } catch (e) {
            console.error("Erreur restauration GPS", e);
        }
        return false;
    }

    public startTracking(teamName: string, onStop?: () => void, eventId?: string, restoredStartTime?: number) {
        if (this.isTracking) return;
        
        this.teamName = teamName;
        this.eventId = eventId;
        this.isTracking = true;
        this.isFirstFix = true;
        this.lastSentPosition = null;
        this.lastSentTime = 0;
        this.startTime = restoredStartTime || Date.now();
        this.onStopCallback = onStop || null;

        // Persistance de l'état pour reprise après crash/reload
        this.persistSession();

        // Fix immédiat au démarrage
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => this.handlePosition(pos),
                (err) => console.warn("GPS Initial Fix failed:", err.message),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }

        this.startWatch();
    }

    private persistSession() {
        const session: TrackingSession = {
            teamName: this.teamName,
            eventId: this.eventId,
            startTime: this.startTime
        };
        localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(session));
    }

    private clearSessionStorage() {
        localStorage.removeItem(TRACKING_STORAGE_KEY);
    }

    private startWatch() {
        if (!navigator.geolocation) return;
        
        const options = { 
            enableHighAccuracy: true, 
            timeout: 20000, 
            maximumAge: 0 
        };
        
        this.watchId = navigator.geolocation.watchPosition(
            this.handlePosition, 
            this.handleError, 
            options
        );
    }

    private handleError = (error: GeolocationPositionError) => {
        console.warn(`Erreur GPS (Watch): ${error.message} (Code: ${error.code})`);
        if (error.code === error.PERMISSION_DENIED) {
            this.stopTracking();
        }
    };

    public stopTracking() {
        this.pauseTracking();
        this.clearSessionStorage(); // Suppression de la persistance
        
        if (this.onStopCallback) {
            this.onStopCallback();
            this.onStopCallback = null;
        }
    }

    public pauseTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
    }

    // Supprime la position de l'équipe (DB Locale + Sync Cloud)
    public async clearLocation(teamName: string) {
        try {
            const db = await initDB();
            // On récupère toutes les positions pour trouver celles de l'équipe
            const allLocs = await db.getAll('team_locations');
            const teamLocs = allLocs.filter(l => l.team_name === teamName);

            if (teamLocs.length > 0) {
                const tx = db.transaction(['team_locations', 'sync_queue'], 'readwrite');

                for (const loc of teamLocs) {
                    // 1. Suppression Locale
                    await tx.objectStore('team_locations').delete(loc.id);

                    // 2. Suppression Distante (Sync)
                    await tx.objectStore('sync_queue').put({
                        id: generateUUID(),
                        table: 'team_locations',
                        action: 'DELETE',
                        data: { id: loc.id },
                        timestamp: Date.now(),
                        status: 'PENDING',
                        retries: 0
                    });
                }

                await tx.done;
                syncService.processQueue();
                
                // Notifie la carte locale pour rafraîchissement immédiat
                bc.postMessage({ type: 'NEW_LOCATION' });
            }
        } catch (e) {
            console.error("Erreur lors de la suppression de la position GPS:", e);
        }
    }

    private handlePosition = async (position: GeolocationPosition) => {
        if (Date.now() - this.startTime > MAX_TRACKING_DURATION) {
            this.stopTracking();
            return;
        }

        const currentPos: GeoPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            timestamp: Date.now()
        };

        const now = Date.now();
        let shouldSend = false;

        if (!this.lastSentPosition) {
            shouldSend = true;
        } else {
            const distance = calculateDistance(this.lastSentPosition, currentPos);
            const timeDiff = now - this.lastSentTime;
            
            if (distance > MIN_DISTANCE_METERS && timeDiff > MOVING_INTERVAL_MS) {
                shouldSend = true;
            } else if (timeDiff > STATIC_INTERVAL_MS) {
                shouldSend = true;
            }
        }

        if (shouldSend) {
            this.lastSentPosition = currentPos;
            this.lastSentTime = now;
            await this.savePosition(currentPos);
            
            // Solution 2: Si c'est le premier fix, on force une synchro complète (Push & Pull)
            if (this.isFirstFix) {
                this.isFirstFix = false;
                console.log("📍 Premier fix GPS reçu, déclenchement synchro complète...");
                syncService.retrySync();
            }
        }
    };

    private savePosition = async (pos: GeoPosition) => {
        try {
            const db = await initDB();
            const loc = {
                id: generateUUID(),
                team_name: this.teamName,
                event_id: this.eventId,
                lat: pos.lat,
                lng: pos.lng,
                accuracy: pos.accuracy,
                altitude: pos.altitude || 0,
                timestamp: pos.timestamp,
                battery_level: 100,
                is_charging: false
            };

            const tx = db.transaction(['team_locations', 'sync_queue'], 'readwrite');
            
            // 1. Sauvegarde Locale
            await tx.objectStore('team_locations').put(loc);
            
            // 2. Mise en file d'attente Synchro
            await tx.objectStore('sync_queue').put({
                id: generateUUID(),
                table: 'team_locations',
                action: 'UPSERT',
                data: loc,
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
            });

            await tx.done;
            
            // Déclenchement de la synchro
            syncService.processQueue();
            
            // Notification locale
            bc.postMessage({ type: 'NEW_LOCATION', loc });
        } catch (e) {
            console.warn("Erreur sauvegarde position GPS:", e);
        }
    }
}

export const geoService = new GeoService();
