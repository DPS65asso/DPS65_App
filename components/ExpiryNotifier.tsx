
import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { bagService } from '../services/bagService';

export const ExpiryNotifier: React.FC = () => {
    const { isAdmin } = useAuth();

    useEffect(() => {
        if (!isAdmin) return;

        // Vérification réglages (On utilise logistics_alert pour le stock aussi)
        const savedSettings = localStorage.getItem('dps65_notif_settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (settings.logistics_alert === false) return;
            } catch (e) {}
        }

        const checkExpiryAndStock = async () => {
            const todayStr = new Date().toISOString().split('T')[0];
            
            // 1. PÉREMPTION
            const alerts = await bagService.checkExpiringItems();
            
            if (alerts.length > 0) {
                if ("Notification" in window && Notification.permission === "default") {
                    await Notification.requestPermission();
                }

                if ("Notification" in window && Notification.permission === "granted") {
                    alerts.forEach(alert => {
                        const count = alert.items.length;
                        const text = `${count} produit(s) périmé(s) ou à péremption proche dans ${alert.bagName}.`;
                        
                        // Anti-spam quotidien
                        const key = `notif_expiry_${alert.bagName}_${todayStr}`;
                        if (!localStorage.getItem(key)) {
                            new Notification("DPS65 - Alerte Péremption", {
                                body: text,
                                icon: "/pwa-192x192.png",
                                tag: `expiry-${alert.bagName}` 
                            });
                            localStorage.setItem(key, 'true');
                        }
                    });
                }
            }

            // 2. STOCK CRITIQUE
            const bags = await bagService.getBags();
            for (const bag of bags) {
                const items = await bagService.getBagItems(bag.id);
                // Détection stock critique (< 20% de la cible)
                const criticalItems = items.filter(i => i.targetQuantity > 0 && (i.quantity / i.targetQuantity) < 0.2);
                
                if (criticalItems.length > 0) {
                    const key = `notif_stock_${bag.id}_${todayStr}`;
                    if (!localStorage.getItem(key)) {
                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification(`📦 Stock Critique : ${bag.name}`, {
                                body: `${criticalItems.length} article(s) presque épuisé(s). Vérifiez le sac.`,
                                icon: "/pwa-192x192.png",
                                tag: `stock-${bag.id}`
                            });
                            localStorage.setItem(key, 'true');
                        }
                    }
                }
            }
        };

        checkExpiryAndStock();
    }, [isAdmin]);

    return null; // Composant invisible
};
