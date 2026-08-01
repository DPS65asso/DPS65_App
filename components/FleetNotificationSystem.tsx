
import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';
import { sendNativeNotification, requestNotificationPermission } from '../services/notificationService';

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

        requestNotificationPermission();

        const checkDates = async () => {
            const fleet = await storageService.getFleet();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            fleet.forEach(async vehicle => {
                const checks = [
                    { label: 'Contrôle Technique', date: vehicle.nextTechControl },
                    { label: 'Entretien/Vidange', date: vehicle.nextService },
                    ...(vehicle.customTracking || []).map(t => ({ label: t.label, date: t.date }))
                ];

                for (const check of checks) {
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
                                await sendNativeNotification(`📅 Flotte : ${vehicle.name}`, { 
                                    body: `${check.label} : ${status}`,
                                    tag: `fleet-${vehicle.id}-${check.label}`
                                });
                                localStorage.setItem(storageKey, 'true');
                            }
                        }
                    }
                }
            });
        };

        checkDates();
    }, [isConcerned]);

    return null;
};
