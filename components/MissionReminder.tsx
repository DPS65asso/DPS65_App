
import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';

export const MissionReminder: React.FC = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        // Vérification des réglages utilisateur
        const savedSettings = localStorage.getItem('dps65_notif_settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (settings.mission_reminder === false) return; // Si désactivé, on arrête
            } catch (e) {}
        }

        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        const checkMissions = async () => {
            const missions = await storageService.getMissions();
            const myMissions = missions.filter(m => m.registeredUserIds && m.registeredUserIds.includes(user.id));
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            myMissions.forEach(m => {
                if (m.date === tomorrowStr) {
                    // Clé unique pour ne pas spammer (ID mission + date check)
                    const key = `notif_remind_${m.id}`;
                    
                    if (!localStorage.getItem(key)) {
                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification(`📅 Mission Demain : ${m.title}`, {
                                body: `Rappel : Début à ${m.timeStart} - Lieu : ${m.location}`,
                                icon: "/pwa-192x192.png",
                                tag: `mission-remind-${m.id}`
                            });
                            localStorage.setItem(key, 'true');
                        }
                    }
                }
            });
        };

        checkMissions();
    }, [user]);

    return null;
};
