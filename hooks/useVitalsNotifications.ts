import { useEffect } from 'react';
import { Victim } from '../types';
import { useAuth } from '../context/AuthContext';

export const useVitalsNotifications = (victims: Victim[]) => {
  const { currentTeam } = useAuth();

  useEffect(() => {
    if (!('Notification' in window)) return;

    const checkVitals = () => {
      const now = Date.now();
      victims.forEach(victim => {
        if (victim.responderTeam === currentTeam && victim.vitals) {
          victim.vitals.forEach(vital => {
            if (vital.expiryTime && vital.expiryTime < now) {
              // Check if notification already shown (maybe store in sessionStorage?)
              const notificationId = `vital-expired-${victim.id}-${vital.id}`;
              if (!sessionStorage.getItem(notificationId)) {
                new Notification(`Constantes périmées pour ${victim.fullName}`, {
                  body: `Les constantes de ${victim.fullName} sont périmées depuis ${new Date(vital.expiryTime).toLocaleTimeString()}`,
                  icon: '/favicon.ico' // Ensure this exists
                });
                sessionStorage.setItem(notificationId, 'true');
              }
            }
          });
        }
      });
    };

    const interval = setInterval(checkVitals, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [victims, currentTeam]);

  const requestPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  return { requestPermission };
};
