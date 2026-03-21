
import { useEffect, useRef } from 'react';

export const useWakeLock = (isActive: boolean) => {
  const wakeLock = useRef<any>(null);

  useEffect(() => {
    const requestLock = async () => {
      // Vérification du support navigateur (Compatible Android & iOS 16.4+)
      if ('wakeLock' in navigator) {
        try {
          wakeLock.current = await (navigator as any).wakeLock.request('screen');
          console.log('💡 Screen Wake Lock active');
        } catch (err) {
          console.warn('⚠️ Wake Lock rejected:', err);
        }
      }
    };

    const releaseLock = async () => {
      if (wakeLock.current) {
        try {
          await wakeLock.current.release();
          wakeLock.current = null;
          console.log('🌑 Screen Wake Lock released');
        } catch (err) {
          console.warn('Error releasing Wake Lock:', err);
        }
      }
    };

    if (isActive) {
      requestLock();
    } else {
      releaseLock();
    }

    // Gestion de la réacquisition du verrouillage en cas de retour sur l'app (Visibilité)
    // Important sur mobile si l'utilisateur switch d'app brièvement
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      releaseLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive]);
};
