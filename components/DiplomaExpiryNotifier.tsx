
import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

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
            // Avertit l'utilisateur si ses propres diplômes expirent dans moins d'un mois
            const personalLimit = new Date();
            personalLimit.setDate(today.getDate() + 30);
            
            if (profile.diplomas) {
                profile.diplomas.forEach(d => {
                    if (d.expiresAt) {
                        const exp = new Date(d.expiresAt);
                        if (exp <= personalLimit) {
                            const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
                            const msg = daysLeft < 0 
                                ? `Votre diplôme ${d.name} est expiré !` 
                                : `Votre diplôme ${d.name} expire dans ${daysLeft} jours.`;

                            // Anti-spam journalier pour notif perso (basé sur la date du jour)
                            const key = `notif_perso_${d.id}_${today.toDateString()}`;
                            if (!localStorage.getItem(key)) {
                                try {
                                    if ("Notification" in window && Notification.permission === "granted") {
                                        new Notification("📅 Recyclage Diplôme", {
                                            body: msg,
                                            icon: "/pwa-192x192.png",
                                            tag: `diploma-expiry-${d.id}`
                                        });
                                        localStorage.setItem(key, 'true');
                                    }
                                } catch (e) {
                                    console.error("Notif error", e);
                                }
                            }
                        }
                    }
                });
            }

            // 2. NOTIFICATION ADMIN (J-60 pour les membres)
            // Avertit l'admin si un membre a un diplôme expirant dans moins de 2 mois
            if (isAdmin) {
                const adminLimit = new Date();
                adminLimit.setDate(today.getDate() + 60); // 2 mois
                
                const allProfiles = await authService.getProfiles();
                
                allProfiles.forEach(member => {
                    if (member.id === profile.id) return; // Déjà traité par le check perso
                    
                    (member.diplomas || []).forEach(d => {
                        if (d.expiresAt) {
                            const exp = new Date(d.expiresAt);
                            if (exp <= adminLimit) {
                                const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
                                
                                // Anti-spam persistant pour admin
                                // La clé contient la date d'expiration : si le diplôme est renouvelé (nouvelle date), la notif reviendra l'année suivante.
                                const key = `notif_admin_${member.id}_${d.id}_${d.expiresAt}`;
                                
                                if (!localStorage.getItem(key)) {
                                    const status = daysLeft < 0 ? "EXPIRÉ" : `Expire dans ${daysLeft}j`;
                                    const body = `${member.lastName} ${member.firstName} : ${d.name} (${status}). Pensez à planifier une formation.`;
                                    
                                    try {
                                        if ("Notification" in window && Notification.permission === "granted") {
                                            new Notification("⚠️ Gestion Formation", {
                                                body: body,
                                                icon: "/pwa-192x192.png",
                                                tag: `admin-dip-${member.id}-${d.id}`
                                            });
                                            localStorage.setItem(key, 'true');
                                        }
                                    } catch (e) {
                                        console.error("Notif error", e);
                                    }
                                }
                            }
                        }
                    });
                });
            }
        };

        if ("Notification" in window) {
            if (Notification.permission === "default") {
                Notification.requestPermission().then(perm => {
                    if (perm === "granted") checkAll();
                });
            } else if (Notification.permission === "granted") {
                checkAll();
            }
        }
    }, [profile, isAdmin]);

    return null;
};
