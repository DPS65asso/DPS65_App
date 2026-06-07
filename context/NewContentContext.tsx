import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { bagService } from '../services/bagService';
import { syncService } from '../services/syncService';

// Defining our different sections
export type SectionType = 'events' | 'missions' | 'fleet' | 'material' | 'courses' | 'docs';

interface SeenIdsState {
    events: string[];
    missions: string[];
    fleet: string[];
    material: string[];
    courses: string[];
    docs: string[];
}

interface NewContentContextType {
    badges: Record<SectionType, boolean>;
    markSectionAsSeen: (section: SectionType) => void;
    markSectionAsUpdated: (section: SectionType) => void;
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
    const location = useLocation();
    
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

            const docIds = [...news, ...docs].map(d => d.id || '');

            return {
                events: events.map(e => e.id || ''),
                missions: missions.map(m => m.id || ''),
                fleet: fleet.map(v => v.id || ''),
                material: material.map(b => b.id || ''),
                courses: courses.map(c => c.id || ''),
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

    // Save state helper
    const saveSeenIds = (newState: SeenIdsState) => {
        setSeenIds(newState);
        localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(newState));
    };

    // Manual marking
    const markSectionAsUpdated = useCallback((section: SectionType) => {
        setManualUpdates(prev => {
            const next = { ...prev, [section]: true };
            localStorage.setItem(MANUAL_UPDATES_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    // Individual marking as read
    const markSectionAsSeen = useCallback((section: SectionType) => {
        setManualUpdates(prev => {
            if (!prev[section]) return prev;
            const next = { ...prev, [section]: false };
            localStorage.setItem(MANUAL_UPDATES_KEY, JSON.stringify(next));
            return next;
        });

        // Add all current IDs of that section to seen
        setCurrentIds(curr => {
            setSeenIds(prev => {
                const updated = { ...prev, [section]: [...curr[section]] };
                localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(updated));
                return updated;
            });
            return curr;
        });
    }, []);

    // Compute badges based on compared IDs (if a current ID is not in seen list) + manual triggers
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
            // Check if there is any ID in current list that is NOT present in seen list
            const currentList = currentIds[section] || [];
            const seenList = seenIds[section] || [];
            
            // If seenList is empty but we have items, it could be first load.
            // On first-ever load, if seen is totally clean, let's treat it as read/empty so the user is not flooded.
            // But if it's already got some content or is subsequent load, identify brand new items.
            const hasNewItem = currentList.some(id => id && !seenList.includes(id));
            
            newBadges[section] = hasNewItem || manualUpdates[section] || false;
        });

        setBadges(newBadges);
    }, [currentIds, seenIds, manualUpdates]);

    // Initial load + subscribe to sync events or broadcasts
    useEffect(() => {
        refresh();

        // Subscribe to remote sync pulls
        const unsub = syncService.subscribe(() => {
            refresh();
        });

        // Listen on various BroadcastChannels to update on local changes
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

        return () => {
            unsub();
            listeners.forEach(bc => bc.close());
        };
    }, [refresh]);

    // Automatic route tracking to clear badges on visit
    useEffect(() => {
        const path = location.pathname;
        if (path === '/events' || path.startsWith('/events/')) {
            markSectionAsSeen('events');
        } else if (path === '/management/planning') {
            markSectionAsSeen('missions');
        } else if (path === '/management/logistics') {
            markSectionAsSeen('fleet');
        } else if (path === '/management/bags') {
            markSectionAsSeen('material');
        } else if (path === '/management/hr') {
            markSectionAsSeen('courses');
        } else if (path === '/management/life') {
            markSectionAsSeen('docs');
        }
    }, [location.pathname, markSectionAsSeen]);

    return (
        <NewContentContext.Provider value={{ badges, markSectionAsSeen, markSectionAsUpdated, refresh }}>
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
