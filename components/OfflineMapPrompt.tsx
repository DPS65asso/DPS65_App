import React, { useEffect, useState } from 'react';
import { Map, Download, CheckCircle2, AlertTriangle, Loader2, X, Info } from 'lucide-react';
import { getOfflineMapStatus, downloadOfflineMap, deleteOfflineMap } from '../services/offlineMapService';

export const OfflineMapPrompt: React.FC = () => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadSuccess, setDownloadSuccess] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [progress, setProgress] = useState({ downloaded: 0, total: 0, percent: 0, currentUrl: '' });
    const [cachedStatus, setCachedStatus] = useState({ isDownloaded: false, cachedCount: 0, totalCount: 0, percent: 0 });

    useEffect(() => {
        const checkStatus = async () => {
            // Vérifier si l'utilisateur a précédemment refusé ou reporté le téléchargement
            const isDismissed = localStorage.getItem('dps65_offline_map_dismissed') === 'true';
            if (isDismissed) return;

            try {
                const status = await getOfflineMapStatus();
                setCachedStatus(status);

                // Si plus de 90% des tuiles ne sont PAS téléchargées, on propose le téléchargement
                if (status.percent < 90) {
                    // Petite attente avant d'afficher pour un effet poli au démarrage
                    setTimeout(() => {
                        setShowPrompt(true);
                    }, 3000);
                }
            } catch (e) {
                console.error("Erreur d'initialisation du statut de carte hors-ligne :", e);
            }
        };

        checkStatus();
    }, []);

    const abortControllerRef = React.useRef<AbortController | null>(null);

    const handleDownload = async () => {
        setIsDownloading(true);
        setDownloadError(null);
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            await downloadOfflineMap((prog) => {
                setProgress({
                    downloaded: prog.downloaded,
                    total: prog.total,
                    percent: prog.percent,
                    currentUrl: prog.currentUrl || ''
                });
            }, controller.signal);
            setDownloadSuccess(true);
            setTimeout(() => {
                setShowPrompt(false);
            }, 4000);
        } catch (error: any) {
            if (error?.name === 'AbortError' || controller.signal.aborted) {
                console.log("Téléchargement annulé par l'utilisateur.");
                setDownloadError("Téléchargement de la carte générale annulé.");
            } else {
                console.error("Erreur de téléchargement :", error);
                setDownloadError(error?.message || "Le téléchargement a échoué. Veuillez réessayer.");
            }
            setIsDownloading(false);
        } finally {
            abortControllerRef.current = null;
        }
    };

    const handleCancelDownload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsDownloading(false);
        }
    };

    const handleDismiss = (permanent: boolean) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        if (permanent) {
            localStorage.setItem('dps65_offline_map_dismissed', 'true');
        }
        setShowPrompt(false);
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100 transition-all duration-300 my-auto">
                <div className="p-3.5 bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between border-b border-blue-800/80">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <Map className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Carte Hors-Ligne (65 - Hautes-Pyrénées)</span>
                    </div>
                    {!isDownloading && (
                        <button 
                            onClick={() => handleDismiss(false)}
                            className="p-1 text-slate-300 hover:text-white rounded-lg transition-colors"
                            title="Fermer"
                            id="btn-close-offline-prompt"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="p-4 sm:p-5 max-h-[80vh] overflow-y-auto">
                {!isDownloading && !downloadSuccess && (
                    <div>
                        {/* Header with design identity */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 ring-4 ring-blue-500/10">
                                <Map className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white leading-tight">
                                    Carte Hors-Ligne des Hautes-Pyrénées
                                </h3>
                                <span className="inline-block bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full mt-1">
                                    Recommandé Secours
                                </span>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-6 font-medium">
                            <p>
                                Vous allez intervenir sur des événements sportifs ou des dispositifs prévisionnels de secours (DPS) en Haute Montagne ou dans des zones avec peu de couverture réseau <strong>(Zones Blanches)</strong> ?
                            </p>
                            <p className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/20 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 flex gap-2.5 items-start">
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>
                                    Téléchargez dès maintenant l'intégralité du fond de carte standard pour y avoir accès instantanément à l'écran de suivi tactique, même sans aucune connexion internet ou réseau mobile.
                                </span>
                            </p>
                            <div className="text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3 rounded-xl space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Couverture :</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">Hautes-Pyrénées (65)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Niveaux de détail :</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">Zoom 8 à 13 (Idéal DPS)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Taille estimée :</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">~15-20 Mo</span>
                                </div>
                            </div>
                        </div>

                        {/* Error log if failed */}
                        {downloadError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs rounded-xl flex items-center gap-2 mb-4 font-bold">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>{downloadError}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleDownload}
                                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-blue-500/25 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-blue-500/20"
                                id="btn-start-offline-download"
                            >
                                <Download className="w-4 h-4" />
                                Télécharger la carte maintenant
                            </button>
                            
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <button
                                    onClick={() => handleDismiss(false)}
                                    className="py-2.5 px-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl font-bold text-xs border border-slate-200/50 dark:border-slate-800 transition-colors"
                                    id="btn-offline-dismiss-temp"
                                >
                                    Plus tard
                                </button>
                                <button
                                    onClick={() => handleDismiss(true)}
                                    className="py-2.5 px-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl font-bold text-xs border border-slate-200/50 dark:border-slate-800 transition-colors"
                                    id="btn-offline-dismiss-perm"
                                >
                                    Ne plus me demander
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Progress Screen */}
                {isDownloading && !downloadSuccess && (
                    <div className="py-6 flex flex-col items-center text-center">
                        <div className="relative mb-6">
                            <div className="w-20 h-20 rounded-full border-4 border-slate-100 dark:border-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                            <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1.5 shadow-md">
                                <Download className="w-4 h-4" />
                            </span>
                        </div>

                        <h4 className="font-black text-lg text-slate-800 dark:text-white mb-2 leading-tight">
                            Téléchargement de la carte...
                        </h4>
                        
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 font-bold uppercase tracking-widest">
                            Ne fermez pas l'application
                        </p>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mb-4 border border-slate-200/50 dark:border-slate-705">
                            <div 
                                className="h-full bg-blue-600 rounded-full transition-all duration-350 shadow-md"
                                style={{ width: `${progress.percent}%` }}
                            ></div>
                        </div>

                        <div className="flex justify-between w-full text-xs font-black text-slate-500 mb-1">
                            <span>{progress.percent}%</span>
                            <span className="font-mono">{progress.downloaded} / {progress.total} tuiles</span>
                        </div>

                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono italic max-w-full truncate bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-900/60 w-full text-center">
                            {progress.currentUrl}
                        </p>

                        <button
                            onClick={handleCancelDownload}
                            className="mt-5 px-5 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-bold rounded-2xl text-xs transition-colors shadow-sm outline-none w-full"
                        >
                            Annuler le téléchargement
                        </button>
                    </div>
                )}

                {/* Success Screen */}
                {downloadSuccess && (
                    <div className="py-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 ring-8 ring-emerald-500/10">
                            <CheckCircle2 className="w-12 h-12" />
                        </div>

                        <h4 className="font-black text-xl text-slate-800 dark:text-white mb-2 leading-tight">
                            Carte enregistrée !
                        </h4>

                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mb-4 leading-relaxed font-semibold">
                            L'intégralité du fond de carte des <strong>Hautes-Pyrénées (65)</strong> est désormais présente localement sur votre téléphone.
                        </p>

                        <span className="inline-block bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300">
                            Prête pour l'intervention en Zone Blanche.
                        </span>
                    </div>
                )}
                </div>

            </div>
        </div>
    );
};
