import React, { useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import { syncService } from '../services/syncService';
import { Outcome, Victim } from '../types';
import { useAuth } from '../context/AuthContext';
import { sendNativeNotification, requestNotificationPermission } from '../services/notificationService';

export const VitalsExpiryNotifier: React.FC = () => {
  const { currentTeam } = useAuth();
  const notifiedSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    requestNotificationPermission();

    const checkVitals = async () => {
      try {
        const events = await storageService.getEvents();
        const activeEvents = events.filter(e => !e.isArchived);
        
        let allVictims: Victim[] = [];
        for (const ev of activeEvents) {
          const vList = await storageService.getVictimsByEvent(ev.id);
          allVictims = [...allVictims, ...vList];
        }

        const now = Date.now();
        const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

        allVictims.forEach(v => {
          // Filtrer uniquement les victimes en cours de prise en charge
          if (v.outcome !== Outcome.TREATMENT_IN_PROGRESS && v.outcome !== ('EN_COURS' as any)) {
            notifiedSetRef.current.delete(v.id);
            return;
          }

          // Déterminer la date de dernière prise de constantes
          let lastVitalsTimeMs = new Date(v.arrivalTime).getTime();
          let hasExplicitExpiry = false;
          let explicitExpired = false;

          if (v.vitals && v.vitals.length > 0) {
            const sorted = [...v.vitals].sort((a, b) => b.time.localeCompare(a.time));
            const last = sorted[0];

            if (last.expiryTime) {
              hasExplicitExpiry = true;
              explicitExpired = last.expiryTime < now;
            }

            if (last.time) {
              const parts = last.time.split(/[:h]/).map(Number);
              if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                const d = new Date();
                d.setHours(parts[0], parts[1], 0, 0);
                lastVitalsTimeMs = d.getTime();
              }
            }
          }

          const isStaleByTime = (now - lastVitalsTimeMs) > FIFTEEN_MINUTES_MS;
          const isStale = explicitExpired || isStaleByTime;

          if (isStale) {
            const notificationKey = `${v.id}-${lastVitalsTimeMs}`;
            if (!notifiedSetRef.current.has(notificationKey) && !sessionStorage.getItem(`notified_vitals_${notificationKey}`)) {
              sendVitalsPushNotification(v, isStaleByTime, explicitExpired);
              notifiedSetRef.current.add(notificationKey);
              sessionStorage.setItem(`notified_vitals_${notificationKey}`, 'true');
            }
          } else {
            // Nettoyer pour ré-autoriser la notification si une nouvelle constante est saisie
            notifiedSetRef.current.forEach(key => {
              if (key.startsWith(v.id)) {
                notifiedSetRef.current.delete(key);
              }
            });
          }
        });
      } catch (err) {
        console.error("Erreur lors de la vérification des constantes vitales:", err);
      }
    };

    const sendVitalsPushNotification = async (victim: Victim, timeStale: boolean, explicitExpired: boolean) => {
      const title = `🩺 DPS65 : Re-bilan constantes requis`;
      const bodyMessage = explicitExpired
        ? `Les constantes de ${victim.fullName} sont arrivées à expiration.`
        : `Les constantes de ${victim.fullName} datent de plus de 15 min. Merci de réaliser un nouveau bilan.`;

      try {
        await sendNativeNotification(title, {
          body: bodyMessage,
          tag: `vitals-stale-${victim.id}`,
          requireInteraction: false,
          renotify: true,
          url: victim.eventId ? `#/events/${victim.eventId}` : '/'
        });
      } catch (e) {
        console.error("Impossible d'afficher la notification push des constantes", e);
      }
    };

    // Vérifier immédiatement puis toutes les minutes
    checkVitals();
    const interval = setInterval(checkVitals, 60000);

    // Écouter également les événements de synchronisation
    const unsubSync = syncService.subscribe(() => {
      checkVitals();
    });

    const bc = new BroadcastChannel('dps65_comms_channel');
    bc.onmessage = (ev) => {
      if (ev.data.type === 'UPDATE_VICTIMS' || ev.data.type === 'NEW_VICTIM') {
        checkVitals();
      }
    };

    return () => {
      clearInterval(interval);
      unsubSync();
      bc.close();
    };
  }, [currentTeam]);

  return null; // Composant de surveillance d'arrière-plan sans rendu DOM direct
};
