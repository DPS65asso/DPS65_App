import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/features/adminService';

export const UpdatePrompt = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [forcedUpdateTimestamp, setForcedUpdateTimestamp] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const { signOut } = useAuth();

  // 1. Écouter le Service Worker et vérifier les mises à jour automatiques (PWA)
  useEffect(() => {
    let intervalId: any;
    let visibilityHandler: any;

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Écouter le rechargement forcé par le SW
      const handleControllerChange = () => {
         window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

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

            // Stratégie PWA Mobile : Vérifier à l'ouverture de l'application
            visibilityHandler = () => {
                if (document.visibilityState === 'visible') {
                    checkForUpdate();
                }
            };
            document.addEventListener('visibilitychange', visibilityHandler);
            
            // Vérification périodique toutes les heures
            intervalId = setInterval(checkForUpdate, 60 * 60 * 1000);
      })
      .catch((err) => {
          console.warn('Service Worker registration check failed:', err);
      });

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

  // 2. Vérifier les demandes de mises à jour manuelles / forcées (depuis Supabase config)
  useEffect(() => {
    const checkForcedUpdate = async () => {
        try {
            const config = await adminService.getConfig();
            if (config && config.forcedUpdateAt) {
                const storedValue = localStorage.getItem('dps65_last_forced_update_at');
                if (storedValue !== config.forcedUpdateAt) {
                    setForcedUpdateTimestamp(config.forcedUpdateAt);
                    setNeedRefresh(true);
                }
            }
        } catch (err) {
            console.error("Failed to check forced update config:", err);
        }
    };

    // Vérifier au montage
    checkForcedUpdate();

    // Écouter via le canal de diffusion des configurations
    const bc = new BroadcastChannel('dps65_config_channel');
    bc.onmessage = (e) => {
        if (e.data.type === 'UPDATE_CONFIG') {
            checkForcedUpdate();
        }
    };

    return () => {
        bc.close();
    };
  }, []);

  const updateApplication = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    try {
        // Enregistrer la version forcée dans le localStorage si c'est une demande manuelle
        if (forcedUpdateTimestamp) {
            localStorage.setItem('dps65_last_forced_update_at', forcedUpdateTimestamp);
        }

        // Forcer la déconnexion de l'utilisateur (Exigence de sécurité et rafraîchissement propre des tokens)
        try {
            await signOut();
        } catch (logoutError) {
            console.error("Erreur déconnexion pendant la mise à jour:", logoutError);
        }

        // Activer le Service Worker en attente ou recharger
        if (registration && registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
            window.location.reload();
        }
    } catch (err) {
        console.error("Échec de la procédure de mise à jour:", err);
        window.location.reload(); // Fallback ultime
    } finally {
        setIsUpdating(false);
    }
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-6 rounded-2xl shadow-2xl border border-slate-700 flex flex-col items-center text-center gap-6 max-w-md w-full">
        
        <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/40 animate-bounce">
            <Download className="w-8 h-8 text-white" />
        </div>
        
        <div>
            <h3 className="font-black text-lg flex items-center justify-center gap-2">
                Mise à jour requise
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 font-bold uppercase tracking-wider">Obligatoire</span>
            </h3>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                Une nouvelle version de l'application est disponible. Pour garantir l'intégrité de la synchronisation et la sécurité des données, cette mise à jour est obligatoire.
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Le processus va forcer une déconnexion de votre compte afin de déployer proprement la nouvelle version de l'application.
            </p>
        </div>

        <button 
            onClick={updateApplication}
            disabled={isUpdating}
            className="w-full bg-blue-600 text-white py-3.5 px-6 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 duration-150 cursor-pointer"
        >
            {isUpdating ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Application en cours de mise à jour...
                </>
            ) : (
                <>
                    <RefreshCw className="w-4 h-4" /> Actualiser et se déconnecter
                </>
            )}
        </button>
      </div>
    </div>
  );
};
