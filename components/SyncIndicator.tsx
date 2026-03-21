
import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { syncService } from '../services/syncService';

export const SyncIndicator: React.FC = () => {
    const [pendingCount, setPendingCount] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [hasError, setHasError] = useState(false);
    const [showLabel, setShowLabel] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);

    useEffect(() => {
        const unsub = syncService.subscribe((count, online, error) => {
            setPendingCount(count);
            setIsOnline(online);
            setHasError(error);
            // Si on n'a plus d'items en attente, on arrête de montrer le spinner de retry
            if (count === 0) setIsRetrying(false);
        });
        return () => unsub();
    }, []);

    const handleRetry = async () => {
        if (isRetrying) return;
        setIsRetrying(true);
        try {
            await syncService.retrySync();
        } finally {
            // On laisse un peu de temps pour que l'utilisateur voit le changement
            setTimeout(() => {
                syncService.getPendingCount().then(count => {
                    if (count === 0) setIsRetrying(false);
                });
            }, 2000);
        }
    };

    let icon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    let statusClass = "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400";
    let label = "Sync OK";

    if (!isOnline) {
        icon = <CloudOff className="w-4 h-4 text-slate-400" />;
        statusClass = "bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400";
        label = "Hors Ligne";
    } else if (hasError && pendingCount > 0) {
        // Erreur bloquante (des données ne partent pas)
        icon = <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />;
        statusClass = "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400";
        label = `Erreur Envoi (${pendingCount})`;
    } else if (pendingCount > 0 || isRetrying) {
        icon = <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
        statusClass = "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400";
        label = isRetrying ? "Connexion..." : `Envoi ${pendingCount}...`;
    } else if (hasError) {
        // Erreur non bloquante (pull failed)
        icon = <AlertCircle className="w-4 h-4 text-amber-500" />;
        statusClass = "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400";
        label = "Sync OK (Réseau Instable)";
    }

    if (isOnline && !hasError && pendingCount === 0 && !isRetrying) {
        return null;
    }

    return (
        <button 
            onClick={() => {
                setShowLabel(!showLabel);
                // On permet quand même de relancer au clic si erreur masquée ou offline
                if (hasError || !isOnline) {
                    handleRetry();
                }
            }}
            className={`flex items-center gap-2 px-2 py-1 rounded-full border transition-all shadow-sm ${statusClass}`}
            title={`Statut: ${label}. Cliquez pour relancer.`}
        >
            {icon}
            {(showLabel || pendingCount > 0 || (hasError && pendingCount > 0) || isRetrying) && (
                <span className="text-[10px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-left-2 whitespace-nowrap">
                    {label}
                </span>
            )}
        </button>
    );
};
