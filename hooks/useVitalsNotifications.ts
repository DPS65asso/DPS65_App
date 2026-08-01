import { useEffect } from 'react';
import { Victim } from '../types';
import { useAuth } from '../context/AuthContext';
import { sendNativeNotification, requestNotificationPermission } from '../services/notificationService';

export const useVitalsNotifications = (victims: Victim[]) => {
  const { currentTeam } = useAuth();

  useEffect(() => {
    const checkVitals = async () => {
      const now = Date.now();
      for (const victim of victims) {
        if (victim.responderTeam === currentTeam && victim.vitals) {
          for (const vital of victim.vitals) {
            if (vital.expiryTime && vital.expiryTime < now) {
              const notificationId = `vital-expired-${victim.id}-${vital.id}`;
              if (!sessionStorage.getItem(notificationId)) {
                await sendNativeNotification(`Constantes périmées pour ${victim.fullName}`, {
                  body: `Les constantes de ${victim.fullName} sont périmées depuis ${new Date(vital.expiryTime).toLocaleTimeString()}`,
                  tag: notificationId
                });
                sessionStorage.setItem(notificationId, 'true');
              }
            }
          }
        }
      }
    };

    const interval = setInterval(checkVitals, 60000);
    return () => clearInterval(interval);
  }, [victims, currentTeam]);

  const requestPermission = () => {
    requestNotificationPermission();
  };

  return { requestPermission };
};
