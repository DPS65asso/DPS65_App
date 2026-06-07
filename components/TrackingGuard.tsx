
import React, { useEffect, useState } from 'react';
import { geoService } from '../services/geoService';
import { AlertTriangle, X } from 'lucide-react';

export const TrackingGuard: React.FC = () => {
    const [showAlert, setShowAlert] = useState(false);
    const [inactiveDuration, setInactiveDuration] = useState(0);

    useEffect(() => {
        let backgroundStart = 0;

        const handleVisibilityChange = () => {
            // Si l'utilisateur quitte l'app (écran éteint ou switch app)
            if (document.visibilityState === 'hidden') {
                if (geoService.isTracking) {
                    backgroundStart = Date.now();
                }
            } 
            // Si l'utilisateur revient
            else if (document.visibilityState === 'visible') {
                if (geoService.isTracking && backgroundStart > 0) {
                    const diffSeconds = Math.floor((Date.now() - backgroundStart) / 1000);
                    
                    // Si l'app est restée en fond plus de 30 secondes sans garantie native (Capacitor),
                    // il y a un fort risque que le navigateur ait tué le GPS.
                    if (diffSeconds > 30) {
                        setInactiveDuration(diffSeconds);
                        setShowAlert(true);
                        // Pattern vibration alerte
                        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    }
                    backgroundStart = 0;
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    if (!showAlert) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-4 border-orange-500 shadow-2xl max-w-sm w-full text-center relative">
                <button 
                    onClick={() => setShowAlert(false)}
                    className="absolute top-2 right-2 p-2 text-slate-400 hover:text-slate-600"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="flex justify-center mb-4">
                    <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 animate-bounce">
                        <AlertTriangle className="w-12 h-12" />
                    </div>
                </div>

                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase mb-2">
                    Attention GPS
                </h3>
                
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">
                    L'application a été mise en arrière-plan pendant <strong>{inactiveDuration} secondes</strong>.
                    <br/><br/>
                    Sur certains téléphones, cela coupe le GPS. Vérifiez que votre position est toujours à jour.
                </p>

                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs text-slate-500 mb-4">
                    <strong>Conseil :</strong> Gardez l'application ouverte et active au premier plan pour assurer un suivi GPS continu et précis.
                </div>

                <button 
                    onClick={() => setShowAlert(false)}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform"
                >
                    J'ai compris
                </button>
            </div>
        </div>
    );
};
