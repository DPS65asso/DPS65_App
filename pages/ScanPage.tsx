
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { storageService } from '../services/storageService';
import { Event, Victim } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2, Save, Camera, RefreshCw, AlertCircle } from 'lucide-react';
import { getLocalDateString, generateUUID } from '../utils/security';

export const ScanPage: React.FC = () => {
    const navigate = useNavigate();
    const [scannedData, setScannedData] = useState<any | null>(null);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isScannerRunning, setIsScannerRunning] = useState(false);
    
    // Réf pour l'instance du scanner afin de gérer le nettoyage proprement
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        // 1. Chargement des événements
        const loadEvents = async () => {
            const evts = await storageService.getEvents();
            const today = getLocalDateString();
            const sorted = evts.sort((a,b) => {
                if (a.date === today && b.date !== today) return -1;
                if (b.date === today && a.date !== today) return 1;
                return b.createdAt - a.createdAt;
            });
            setEvents(sorted);
            if (sorted.length > 0) setSelectedEventId(sorted[0].id);
        };
        loadEvents();

        // 2. Démarrage du scanner (si pas de données déjà scannées)
        if (!scannedData) {
            startScanner();
        }

        // Nettoyage au démontage
        return () => {
            stopScanner();
        };
    }, [scannedData]);

    const startScanner = async () => {
        try {
            // Si une instance existe déjà et tourne, on ne fait rien
            if (html5QrCodeRef.current && isScannerRunning) return;

            // Nettoyage préventif
            if (html5QrCodeRef.current) {
                await stopScanner();
            }

            const html5QrCode = new Html5Qrcode("reader");
            html5QrCodeRef.current = html5QrCode;

            // Config spécifique pour iOS : fps modéré et taille de box adaptative
            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };
            
            await html5QrCode.start(
                { facingMode: "environment" }, // Force la caméra arrière
                config,
                (decodedText) => {
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Erreurs de lecture frame par frame (on ignore pour ne pas spammer)
                }
            );
            setIsScannerRunning(true);
            setError('');
        } catch (err) {
            console.error("Erreur démarrage caméra:", err);
            setError("Impossible d'accéder à la caméra. Vérifiez les permissions (HTTPS requis).");
            setIsScannerRunning(false);
        }
    };

    const stopScanner = async () => {
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
                html5QrCodeRef.current.clear();
            } catch (e) {
                console.error("Erreur arrêt scanner", e);
            }
            html5QrCodeRef.current = null;
            setIsScannerRunning(false);
        }
    };

    const handleScanSuccess = (text: string) => {
        // Arrêt immédiat pour éviter les doubles lectures
        stopScanner();

        try {
            const json = JSON.parse(text);

            // --- CAS 1 : FORMAT V3 MINIFIÉ (Nouveau) ---
            if (json.v === 3 && json.d) {
                const d = json.d;
                const reconstructed: Partial<Victim> = {
                    fullName: d.a || 'Inconnu',
                    birthDate: d.j || '',
                    bibNumber: d.b || '',
                    triageColor: d.c,
                    reason: d.d || '',
                    careProvided: d.e || '',
                    outcome: d.f || 'Traitement en cours',
                    arrivalTime: d.g || new Date().toISOString(),
                    phoneNumber: d.h,
                    emergencyContact: d.i,
                    isAdvancedMode: !!d.x,
                    medications: d.m || '',
                    hasKt: !!d.k,
                    vitals: (d.v || []).map((v: any) => ({
                        id: generateUUID(),
                        time: v.t,
                        pulse: v.p,
                        bp: v.b,
                        sao2: v.s,
                        glycemia: v.g,
                        temp: v.c,
                        eva: v.e
                    }))
                };
                setScannedData(reconstructed);
                return;
            }

            // --- CAS 2 : FORMAT V2 (Ancien) ---
            if (json.dps_v && json.data) {
                setScannedData(json.data);
                return;
            }
            
            throw new Error("Format QR invalide");

        } catch (e) {
            setError("QR Code non reconnu ou malformé.");
            // Si erreur de format, on ne relance pas automatiquement pour laisser l'utilisateur lire le message
        }
    };

    const handleSave = async () => {
        if (!selectedEventId || !scannedData) return;
        setIsSaving(true);
        try {
            const newId = await storageService.importVictimFromData(scannedData, selectedEventId);
            navigate(`/events/${selectedEventId}/edit/${newId}`);
        } catch (e) {
            alert("Erreur lors de l'importation.");
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setScannedData(null);
        setError('');
        setTimeout(() => startScanner(), 100);
    };

    return (
        <Layout title="Scanner QR" showBack>
            <div className="flex flex-col items-center">
                
                {!scannedData ? (
                    <div className="w-full max-w-md flex flex-col gap-4">
                        {/* Zone du scanner */}
                        <div className="relative overflow-hidden rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-black aspect-square shadow-inner">
                            <div id="reader" className="w-full h-full"></div>
                            
                            {!isScannerRunning && !error && (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                </div>
                            )}
                        </div>

                        {error ? (
                            <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl text-center shadow-sm border border-red-200 dark:border-red-800">
                                <div className="flex justify-center mb-2"><AlertCircle className="w-6 h-6" /></div>
                                <p className="text-sm font-bold mb-3">{error}</p>
                                <Button size="sm" variant="outline" onClick={handleReset} icon={<RefreshCw />}>Réessayer</Button>
                            </div>
                        ) : (
                            <div className="text-center space-y-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Pointez la caméra vers un QR Code de fiche victime.</p>
                                {!isScannerRunning && (
                                    <Button onClick={startScanner} variant="primary" icon={<Camera />}>
                                        Démarrer la caméra
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* AFFICHAGE DONNÉES IMPORTÉES */
                    <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-green-500"></div>
                            <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-1 flex items-center justify-center gap-2">
                                <Save className="w-5 h-5" /> Fiche Détectée
                            </h3>
                            <div className="text-2xl font-black text-slate-800 dark:text-white my-2 uppercase">{scannedData.fullName}</div>
                            <div className="text-sm font-mono bg-white/50 dark:bg-black/30 inline-block px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                                Dossard: {scannedData.bibNumber || 'N/A'}
                            </div>
                            
                            <div className="mt-4 flex justify-center gap-2">
                                {scannedData.vitals && scannedData.vitals.length > 0 && (
                                    <span className="text-[10px] uppercase font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                        {scannedData.vitals.length} Constantes
                                    </span>
                                )}
                                {scannedData.isAdvancedMode && (
                                    <span className="text-[10px] uppercase font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                        Médicalisé
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Destination de l'import :</label>
                            <select 
                                className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white mb-4 outline-none focus:ring-2 focus:ring-blue-500"
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                            >
                                {events.map(e => (
                                    <option key={e.id} value={e.id}>{e.date} - {e.name}</option>
                                ))}
                            </select>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" onClick={handleReset}>Annuler</Button>
                                <Button variant="primary" onClick={handleSave} disabled={isSaving || !selectedEventId} icon={isSaving ? <Loader2 className="animate-spin" /> : <Save />}>
                                    Confirmer
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};
