
import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';

export const FleetNotificationSystem: React.FC = () => {
    const { profile } = useAuth();
    const isConcerned = profile?.role === 'admin' || profile?.role === 'logisticien';

    useEffect(() => {
        if (!isConcerned) return;

        // Vérification réglages
        const savedSettings = localStorage.getItem('dps65_notif_settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (settings.logistics_alert === false) return;
            } catch (e) {}
        }

        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        const checkDates = async () => {
            const fleet = await storageService.getFleet();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            fleet.forEach(vehicle => {
                const checks = [
                    { label: 'Contrôle Technique', date: vehicle.nextTechControl },
                    { label: 'Entretien/Vidange', date: vehicle.nextService },
                    ...(vehicle.customTracking || []).map(t => ({ label: t.label, date: t.date }))
                ];

                checks.forEach(check => {
                    if (check.date) {
                        const targetDate = new Date(check.date);
                        targetDate.setHours(0, 0, 0, 0);
                        const diffTime = targetDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays <= 30) {
                            const todayStr = today.toISOString().split('T')[0];
                            const storageKey = `notif_fleet_${vehicle.id}_${check.label}_${check.date}_${todayStr}`;
                            
                            if (!localStorage.getItem(storageKey)) {
                                const status = diffDays < 0 ? `RETARD (${Math.abs(diffDays)}j)` : `J-${diffDays}`;
                                if ("Notification" in window && Notification.permission === "granted") {
                                    new Notification(`📅 Flotte : ${vehicle.name}`, { 
                                        body: `${check.label} : ${status}`,
                                        icon: "/pwa-192x192.png",
                                        tag: `fleet-${vehicle.id}-${check.label}`
                                    });
                                    localStorage.setItem(storageKey, 'true');
                                }
                            }
                        }
                    }
                });
            });
        };

        checkDates();
    }, [isConcerned]);

    return null;
};
