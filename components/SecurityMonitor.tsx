
import React, { useEffect } from 'react';
import { adminService } from '../services/features/adminService';
import { geoService } from '../services/geoService';
import { authService } from '../services/authService';
import { deleteDB } from 'idb';

export const SecurityMonitor: React.FC = () => {
    useEffect(() => {
        const performWipe = async () => {
            try {
                const config = await adminService.getConfig();
                
                if (config.securityMode === 'WIPE_AND_LOCK') {
                    console.warn("🚨 REMOTE WIPE TRIGGERED BY ADMIN");
                    
                    // 1. Arrêt du GPS
                    geoService.stopTracking();
                    
                    // 2. Nettoyage LocalStorage
                    localStorage.clear();
                    sessionStorage.clear();
                    
                    // 3. Nettoyage Base de données locale
                    try {
                        await deleteDB('dps65_db_local');
                    } catch(e) {
                        console.error("DB Wipe failed", e);
                    }
                    
                    // 4. Déconnexion forcée
                    await authService.logout();
                    
                    // 5. Redirection Force vers Login et RECHARGEMENT pour vider la mémoire
                    window.location.hash = '/login';
                    window.location.reload();
                }
            } catch (e) {
                // Ignore errors during check (e.g. offline)
            }
        };

        // 1. Vérification périodique (toutes les 5 secondes)
        const interval = setInterval(performWipe, 5000);

        // 2. Vérification immédiate sur signal Broadcast (depuis SyncService)
        const bc = new BroadcastChannel('dps65_config_channel');
        bc.onmessage = (e) => {
            if (e.data.type === 'UPDATE_CONFIG') {
                performWipe();
            }
        };

        // 3. Vérification immédiate au montage
        performWipe();

        return () => {
            clearInterval(interval);
            bc.close();
        };
    }, []);

    return null; // Composant invisible
};
