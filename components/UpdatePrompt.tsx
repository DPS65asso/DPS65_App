
import React, { useEffect, useState } from 'react';
import { RefreshCw, X, Download } from 'lucide-react';

export const UpdatePrompt = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // References for cleanup to ensure listeners created asynchronously are removed
    let intervalId: any;
    let visibilityHandler: any;

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // 1. Écouter le rechargement forcé par le SW
      const handleControllerChange = () => {
         window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      // 2. Récupérer l'enregistrement et configurer les écouteurs
      navigator.serviceWorker.getRegistration()
        .then((reg) => {
            if (!reg) return;
            setRegistration(reg);

            // Si une mise à jour attend déjà
            if (reg.waiting) setNeedRefresh(true);

            // Fonction pour vérifier manuellement les mises à jour
            const checkForUpdate = () => {
                reg.update().catch(() => {});
            };

            // Écouter si une nouvelle version est trouvée
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            setNeedRefresh(true);
                        }
                    });
                }
            });

            // 3. STRATÉGIE PWA MOBILE :
            // Vérifier les mises à jour à chaque fois que l'utilisateur ouvre l'app
            visibilityHandler = () => {
                if (document.visibilityState === 'visible') {
                    checkForUpdate();
                }
            };
            document.addEventListener('visibilitychange', visibilityHandler);
            
            // Et une vérification périodique (toutes les heures) si l'app reste ouverte
            intervalId = setInterval(checkForUpdate, 60 * 60 * 1000);
      })
      .catch((err) => {
          // Catch errors when origin mismatches (e.g. inside AI Studio preview) to prevent crash
          console.warn('Service Worker registration check failed:', err);
      });

      // Cleanup function
      return () => {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          if (visibilityHandler) {
              document.removeEventListener('visibilitychange', visibilityHandler);
          }
          if (intervalId) {
              clearInterval(intervalId);
          }
      };
    }
  }, []);

  const updateServiceWorker = () => {
    if (registration && registration.waiting) {
      // Envoi du message pour forcer l'activation du nouveau SW
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setNeedRefresh(false);
    } else {
        // Fallback
        window.location.reload();
    }
  };

  const close = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[200] animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 max-w-lg mx-auto">
        
        <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/20 animate-pulse">
                <Download className="w-5 h-5 text-white" />
            </div>
            <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                    Mise à jour disponible
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">vNext</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Nouvelle version téléchargée.</p>
            </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
                onClick={updateServiceWorker}
                className="flex-1 sm:flex-none bg-white text-slate-900 px-4 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
                <RefreshCw className="w-3 h-3" /> Actualiser
            </button>
            <button 
                onClick={close} 
                className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                aria-label="Fermer"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

      </div>
    </div>
  );
};
