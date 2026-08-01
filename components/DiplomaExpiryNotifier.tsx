
import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { sendNativeNotification, requestNotificationPermission } from '../services/notificationService';

export const DiplomaExpiryNotifier: React.FC = () => {
    const { profile, isAdmin } = useAuth();

    useEffect(() => {
        if (!profile) return;

        // Vérification réglages
        const savedSettings = localStorage.getItem('dps65_notif_settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (settings.diploma_alert === false) return;
            } catch (e) {}
        }

        const checkAll = async () => {
            const today = new Date();
            
            // 1. NOTIFICATION PERSONNELLE (J-30)
            const personalLimit = new Date();
            personalLimit.setDate(today.getDate() + 30);
            
            if (profile.diplomas) {
                for (const d of profile.diplomas) {
                    if (d.expiresAt) {
                        const exp = new Date(d.expiresAt);
                        if (exp <= personalLimit) {
                            const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
                            const msg = daysLeft < 0 
                                ? `Votre diplôme ${d.name} est expiré !` 
                                : `Votre diplôme ${d.name} expire dans ${daysLeft} jours.`;

                            const key = `notif_perso_${d.id}_${today.toDateString()}`;
                            if (!localStorage.getItem(key)) {
                                try {
                                    await sendNativeNotification("📅 Recyclage Diplôme", {
                                        body: msg,
                                        tag: `diploma-expiry-${d.id}`
                                    });
                                    localStorage.setItem(key, 'true');
                                } catch (e) {
                                    console.error("Notif error", e);
                                }
                            }
                        }
                    }
                }
            }

            // 2. NOTIFICATION ADMIN (J-60)
            if (isAdmin) {
                const adminLimit = new Date();
                adminLimit.setDate(today.getDate() + 60);
                
                const allProfiles = await authService.getProfiles();
                
                for (const member of allProfiles) {
                    if (member.id === profile.id) continue;
                    
                    for (const d of (member.diplomas || [])) {
                        if (d.expiresAt) {
                            const exp = new Date(d.expiresAt);
                            if (exp <= adminLimit) {
                                const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
                                const key = `notif_admin_${member.id}_${d.id}_${d.expiresAt}`;
                                
                                if (!localStorage.getItem(key)) {
                                    const status = daysLeft < 0 ? "EXPIRÉ" : `Expire dans ${daysLeft}j`;
                                    const body = `${member.lastName} ${member.firstName} : ${d.name} (${status}). Pensez à planifier une formation.`;
                                    
                                    try {
                                        await sendNativeNotification("⚠️ Gestion Formation", {
                                            body: body,
                                            tag: `admin-dip-${member.id}-${d.id}`
                                        });
                                        localStorage.setItem(key, 'true');
                                    } catch (e) {
                                        console.error("Notif error", e);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        requestNotificationPermission().then(perm => {
            if (perm === 'granted') checkAll();
        });
    }, [profile, isAdmin]);

    return null;
};
