import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { bagService } from '../services/bagService';
import { syncService } from '../services/syncService';
import { getLocalDateString } from '../utils/security';

// Defining our different sections
export type SectionType = 'events' | 'missions' | 'fleet' | 'material' | 'courses' | 'docs';

export interface SeenIdsState {
    events: string[];
    missions: string[];
    fleet: string[];
    material: string[];
    courses: string[];
    docs: string[];
}

interface NewContentContextType {
    badges: Record<SectionType, boolean>;
    seenIds: SeenIdsState;
    markSectionAsSeen: (section: SectionType) => void;
    markItemAsSeen: (section: SectionType, itemId: string) => void;
    markSectionAsUpdated: (section: SectionType) => void;
    isItemNew: (section: SectionType, itemId: string, dateVal?: number | string) => boolean;
    refresh: () => Promise<void>;
}

const NewContentContext = createContext<NewContentContextType | undefined>(undefined);

const SEEN_IDS_KEY = 'dps65_seen_ids_v1';
const MANUAL_UPDATES_KEY = 'dps65_manual_updates_v1';

const defaultSeenIds: SeenIdsState = {
    events: [],
    missions: [],
    fleet: [],
    material: [],
    courses: [],
    docs: [],
};

export const NewContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Seen content IDs tracked in localStorage
    const [seenIds, setSeenIds] = useState<SeenIdsState>(() => {
        try {
            const saved = localStorage.getItem(SEEN_IDS_KEY);
            return saved ? { ...defaultSeenIds, ...JSON.parse(saved) } : defaultSeenIds;
        } catch (e) {
            return defaultSeenIds;
        }
    });

    // Manual triggers (e.g. markSectionAsUpdated), also persisted
    const [manualUpdates, setManualUpdates] = useState<Record<SectionType, boolean>>(() => {
        try {
            const saved = localStorage.getItem(MANUAL_UPDATES_KEY);
            return saved ? JSON.parse(saved) : {
                events: false,
                missions: false,
                fleet: false,
                material: false,
                courses: false,
                docs: false,
            };
        } catch (e) {
            return {
                events: false,
                missions: false,
                fleet: false,
                material: false,
                courses: false,
                docs: false,
            };
        }
    });

    // Current DB state counts/ids
    const [currentIds, setCurrentIds] = useState<SeenIdsState>(defaultSeenIds);
    const [badges, setBadges] = useState<Record<SectionType, boolean>>({
        events: false,
        missions: false,
        fleet: false,
        material: false,
        courses: false,
        docs: false,
    });

    // Main fetch mechanism
    const fetchCurrentIds = useCallback(async (): Promise<SeenIdsState> => {
        try {
            const [events, missions, fleet, material, courses, news, docs] = await Promise.all([
                storageService.getEvents().catch(() => []),
                storageService.getMissions().catch(() => []),
                storageService.getFleet().catch(() => []),
                bagService.getBags().catch(() => []),
                storageService.getCourses().catch(() => []),
                storageService.getNews().catch(() => []),
                storageService.getDocuments().catch(() => []),
            ]);

            const docIds = [...news, ...docs].map(d => d.id || '').filter(Boolean);
            const today = getLocalDateString();
            const activeTodayEvents = events.filter(e => !e.isArchived && e.date === today);

            return {
                events: activeTodayEvents.map(e => e.id || '').filter(Boolean),
                missions: missions.map(m => m.id || '').filter(Boolean),
                fleet: fleet.map(v => v.id || '').filter(Boolean),
                material: material.map(b => b.id || '').filter(Boolean),
                courses: courses.map(c => c.id || '').filter(Boolean),
                docs: docIds,
            };
        } catch (error) {
            console.error('Error fetching current IDs for badges:', error);
            return defaultSeenIds;
        }
    }, []);

    // Perform verification of what is new
    const refresh = useCallback(async () => {
        const current = await fetchCurrentIds();
        setCurrentIds(current);
    }, [fetchCurrentIds]);

    // Manual triggers
    const markSectionAsUpdated = useCallback((section: SectionType) => {
        setManualUpdates(prev => {
            const next = { ...prev, [section]: true };
            localStorage.setItem(MANUAL_UPDATES_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    // Individual item marking as read
    const markItemAsSeen = useCallback((section: SectionType, itemId: string) => {
        if (!itemId) return;
        setSeenIds(prev => {
            const currentList = prev[section] || [];
            if (currentList.includes(itemId)) return prev;
            const updated = {
                ...prev,
                [section]: [...currentList, itemId]
            };
            localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    // Full section marking as read
    const markSectionAsSeen = useCallback((section: SectionType) => {
        setManualUpdates(prev => {
            if (!prev[section]) return prev;
            const next = { ...prev, [section]: false };
            localStorage.setItem(MANUAL_UPDATES_KEY, JSON.stringify(next));
            return next;
        });

        setCurrentIds(curr => {
            setSeenIds(prev => {
                const updated = { 
                    ...prev, 
                    [section]: Array.from(new Set([...(prev[section] || []), ...(curr[section] || [])])) 
                };
                localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(updated));
                return updated;
            });
            return curr;
        });
    }, []);

    // Helper to check if a specific item is new/unread
    const isItemNew = useCallback((section: SectionType, itemId: string, dateVal?: number | string) => {
        if (!itemId) return false;
        const isUnread = !(seenIds[section] || []).includes(itemId);
        if (!dateVal) return isUnread;

        const d = typeof dateVal === 'number' ? dateVal : new Date(dateVal).getTime();
        if (isNaN(d)) return isUnread;
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const isRecent = Math.abs(Date.now() - d) <= SEVEN_DAYS_MS;
        return isUnread && isRecent;
    }, [seenIds]);

    // Compute badges based on compared IDs (if any current ID is NOT in seen list)
    useEffect(() => {
        const newBadges: Record<SectionType, boolean> = {
            events: false,
            missions: false,
            fleet: false,
            material: false,
            courses: false,
            docs: false,
        };

        (Object.keys(currentIds) as Array<SectionType>).forEach(section => {
            const currentList = currentIds[section] || [];
            const seenList = seenIds[section] || [];
            
            if (section === 'events') {
                // Le point rouge pulsant de la section "Events" ne doit s'afficher
                // que lorsqu'un événement a lieu à la date du jour (statut en cours)
                newBadges.events = currentList.length > 0;
            } else {
                // Badge is visible if there is any item in currentList that has NOT been seen yet
                const hasNewItem = currentList.some(id => id && !seenList.includes(id));
                newBadges[section] = hasNewItem || manualUpdates[section] || false;
            }
        });

        setBadges(newBadges);
    }, [currentIds, seenIds, manualUpdates]);

    // Initial load + subscribe to sync events or broadcasts
    useEffect(() => {
        refresh();

        const unsub = syncService.subscribe(() => {
            refresh();
        });

        const channels = [
            'dps65_comms_channel',
            'dps65_events_channel',
            'dps65_asso_channel',
            'dps65_config_channel',
            'dps65_victims_channel'
        ];

        const listeners = channels.map(chanName => {
            const bc = new BroadcastChannel(chanName);
            bc.onmessage = () => {
                refresh();
            };
            return bc;
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleVisibilityChange);

        return () => {
            unsub();
            listeners.forEach(bc => bc.close());
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleVisibilityChange);
        };
    }, [refresh]);

    return (
        <NewContentContext.Provider value={{ 
            badges, 
            seenIds, 
            markSectionAsSeen, 
            markItemAsSeen, 
            markSectionAsUpdated, 
            isItemNew, 
            refresh 
        }}>
            {children}
        </NewContentContext.Provider>
    );
};

export const useNewContent = () => {
    const context = useContext(NewContentContext);
    if (!context) {
        throw new Error('useNewContent must be used within a NewContentProvider');
    }
    return context;
};
