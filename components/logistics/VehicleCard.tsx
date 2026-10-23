import React, { useRef, useState } from 'react';
import { VehicleDefinition, VehicleCheck } from '../../types';
import { safeDateFormat } from '../../utils/security';
import { compressImageFile } from '../../utils/imageUtils';
import { Truck, Camera, Settings, AlertTriangle, History, Wrench, Loader2, ChevronRight, CheckCircle2 } from 'lucide-react';

interface VehicleCardProps {
    vehicle: VehicleDefinition;
    lastCheck?: VehicleCheck;
    checks: VehicleCheck[];
    isManager: boolean;
    onEditSettings: (vehicle: VehicleDefinition) => void;
    onReport: (vehicleId: string) => void;
    onHistory: (vehicleId: string) => void;
    onUpdatePhoto: (vehicleId: string, photoDataUrl: string) => Promise<void>;
    onOpenBreakdowns: (vehicle: VehicleDefinition) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
    vehicle,
    lastCheck,
    checks,
    isManager,
    onEditSettings,
    onReport,
    onHistory,
    onUpdatePhoto,
    onOpenBreakdowns
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    // Détection des pannes mécaniques actives pour ce véhicule
    const isMechanicalAlert = (alertText: string) => {
        const lower = alertText.toLowerCase();
        return (
            alertText.startsWith('PANNE') ||
            lower.includes('mecanique') ||
            lower.includes('mécanique') ||
            lower.includes('moteur') ||
            lower.includes('frein') ||
            lower.includes('boite') ||
            lower.includes('embrayage') ||
            lower.includes('batterie') ||
            lower.includes('pneu') ||
            lower.includes('distribution')
        );
    };

    const activeBreakdowns = checks.filter(c => {
        if (c.vehicleId !== vehicle.id) return false;
        const hasAlert = c.alerts && c.alerts.some(isMechanicalAlert);
        return hasAlert && !c.resolved;
    });

    const activeBreakdownsCount = activeBreakdowns.length;

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingPhoto(true);
        try {
            const compressed = await compressImageFile(file, 1200, 900, 0.8);
            await onUpdatePhoto(vehicle.id, compressed);
        } catch (err: any) {
            console.error("Erreur compression photo:", err);
            alert(err.message || "Impossible de charger la photo.");
        } finally {
            setIsUploadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const getStatusStyle = (dateStr: string) => {
        if (!dateStr) return { className: 'bg-slate-100 text-slate-500 border border-slate-200', dateDisplay: '--/--/----', status: 'Non défini' };
        
        const today = new Date();
        const target = new Date(dateStr);
        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const dateDisplay = safeDateFormat(dateStr);

        if (diffDays < 0) return { className: 'bg-red-600 text-white shadow-md shadow-red-500/20', dateDisplay, status: `RETARD ${Math.abs(diffDays)}j` };
        if (diffDays < 30) return { className: 'bg-orange-500 text-white shadow-md shadow-orange-500/20', dateDisplay, status: `J-${diffDays}` };
        
        return { className: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20', dateDisplay, status: 'Valide' };
    };

    const ctInfo = getStatusStyle(vehicle.nextTechControl);
    
    const customPoint = vehicle.customTracking && vehicle.customTracking.length > 0 ? vehicle.customTracking[0] : null;
    const addControlDate = customPoint ? customPoint.date : vehicle.nextService;
    const addControlLabel = customPoint ? customPoint.label : 'Contrôle Pollution';
    const addControlInfo = getStatusStyle(addControlDate);

    return (
        <div className="h-full flex flex-col justify-between bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg select-none">
            {/* PHOTO DU VÉHICULE (PREND L'ESPACE DISPONIBLE SUPÉRIEUR) */}
            <div className="relative bg-slate-900 border-b border-slate-800 flex-1 min-h-[140px] max-h-[36vh] flex items-center justify-center overflow-hidden">
                {vehicle.imageUrl ? (
                    <img 
                        src={vehicle.imageUrl} 
                        alt={vehicle.name} 
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-slate-500">
                        <Truck className="w-14 h-14 stroke-1 mb-1 text-slate-600" />
                        <span className="text-xs font-semibold text-slate-400">Aucune photo enregistrée</span>
                    </div>
                )}

                {/* Badge d'alerte clignotante si panne active sur le véhicule */}
                {activeBreakdownsCount > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenBreakdowns(vehicle); }}
                        className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 bg-red-600/95 hover:bg-red-700 text-white px-2.5 py-1 rounded-xl text-xs font-black shadow-lg shadow-red-600/40 border border-white/30 animate-pulse active:scale-95 transition-transform cursor-pointer"
                        title="Panne mécanique détectée - Cliquer pour voir les détails"
                    >
                        <AlertTriangle className="w-4 h-4 text-amber-300 animate-bounce" />
                        <span>Panne active</span>
                    </button>
                )}

                {/* KILOMÉTRAGE EN BAS À DROITE DE LA PHOTO (PREMIER PLAN) */}
                <div className="absolute bottom-2.5 right-2.5 z-10 bg-black/75 backdrop-blur-md text-white px-3 py-1.5 rounded-xl font-mono font-black text-xs flex items-center gap-1.5 border border-white/20 shadow-lg">
                    <span className="text-slate-400 font-sans text-[10px] uppercase">KM</span>
                    <span>{lastCheck ? lastCheck.km.toLocaleString() : '---'}</span>
                </div>

                {/* Bouton de sélection photo (Admin / Logisticien) */}
                {isManager && (
                    <div className="absolute top-2.5 right-2.5 z-10 flex gap-2">
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handlePhotoSelect} 
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingPhoto}
                            className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/20 transition-all active:scale-95"
                            title="Sélectionner une photo depuis vos fichiers (PC ou mobile)"
                        >
                            {isUploadingPhoto ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Camera className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">Photo</span>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEditSettings(vehicle); }} 
                            className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white p-1.5 rounded-xl shadow-lg border border-white/20 transition-all active:scale-95"
                            title="Configuration du véhicule"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* CONTENU PRINCIPAL COMPACT SANS SCROLL */}
            <div className="p-3 sm:p-4 space-y-2.5 flex-none">
                {/* HEADER DU VÉHICULE & IMMATRICULATION */}
                <div className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-lg sm:text-xl text-slate-800 dark:text-white leading-tight">
                                {vehicle.name}
                            </h4>
                            {activeBreakdownsCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded-md text-[11px] font-black border border-red-300 dark:border-red-800 animate-pulse">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                                    Panne
                                </span>
                            )}
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">
                                {vehicle.type}
                            </span>
                        </div>
                    </div>

                    {/* Badge Immatriculation style plaque automobile européenne */}
                    {vehicle.immatriculation && (
                        <div className="inline-flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded overflow-hidden font-mono font-black text-xs text-slate-900 dark:text-white tracking-widest shadow-inner whitespace-nowrap flex-shrink-0">
                            <div className="bg-blue-700 text-amber-300 flex flex-col items-center justify-center px-1.5 self-stretch">
                                <div className="text-[6px] tracking-tighter leading-none my-0.5">★★★★★</div>
                                <span className="text-[10px] font-sans font-black leading-none text-white">F</span>
                            </div>
                            <div className="px-2.5 py-1">
                                {vehicle.immatriculation}
                            </div>
                        </div>
                    )}
                </div>

                {/* MODULE PANNE MÉCANIQUE */}
                <div>
                    <div 
                        onClick={() => onOpenBreakdowns(vehicle)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.99] flex items-center justify-between shadow-sm ${
                            activeBreakdownsCount > 0 
                                ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 border-l-4 border-l-amber-500 hover:bg-amber-100/70' 
                                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/80 border-l-4 border-l-emerald-500 hover:bg-slate-100/70'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
                                activeBreakdownsCount > 0 
                                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' 
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                            }`}>
                                <Wrench className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="font-black text-sm text-slate-800 dark:text-white leading-none">
                                        Mécanique
                                    </span>
                                    {activeBreakdownsCount > 0 && (
                                        <span className="animate-pulse flex h-2 w-2 rounded-full bg-amber-500" />
                                    )}
                                </div>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium mt-0.5">
                                    {activeBreakdownsCount > 0 
                                        ? `${activeBreakdownsCount} panne${activeBreakdownsCount > 1 ? 's' : ''} active${activeBreakdownsCount > 1 ? 's' : ''}` 
                                        : "Aucune panne active"}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-black text-xs ${
                                activeBreakdownsCount > 0 
                                    ? 'bg-amber-500 text-white shadow-sm' 
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                                {activeBreakdownsCount}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                    </div>
                </div>

                {/* INDICATEURS TECHNIQUES (CONTRÔLE ADDITIONNEL & CT) */}
                <div className="grid grid-cols-2 gap-2">
                    {/* CONTRÔLE ADDITIONNEL (EX: CONTRÔLE POLLUTION) */}
                    <div className={`rounded-xl p-2.5 flex flex-col items-center justify-center ${addControlInfo.className}`}>
                        <span className="text-[9px] font-bold uppercase mb-0.5 opacity-80 truncate max-w-full">{addControlLabel}</span>
                        <span className="font-black text-sm tracking-tight">{addControlInfo.dateDisplay}</span>
                        {addControlInfo.status !== 'Valide' && <span className="text-[8px] font-bold bg-black/20 px-1.5 rounded mt-0.5">{addControlInfo.status}</span>}
                    </div>

                    {/* PROCHAIN CT */}
                    <div className={`rounded-xl p-2.5 flex flex-col items-center justify-center ${ctInfo.className}`}>
                        <span className="text-[9px] font-bold uppercase mb-0.5 opacity-80">Prochain CT</span>
                        <span className="font-black text-sm tracking-tight">{ctInfo.dateDisplay}</span>
                        {ctInfo.status !== 'Valide' && <span className="text-[8px] font-bold bg-black/20 px-1.5 rounded mt-0.5">{ctInfo.status}</span>}
                    </div>
                </div>
            </div>

            {/* ACTIONS (FIXÉES EN BAS) */}
            <div className="flex border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex-none">
                <button 
                    onClick={() => onReport(vehicle.id)} 
                    className="flex-1 py-3 text-xs font-bold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center justify-center gap-2 border-r border-slate-100 dark:border-slate-700"
                >
                    <AlertTriangle className="w-4 h-4" /> Signaler Panne
                </button>
                <button 
                    onClick={() => onHistory(vehicle.id)} 
                    className="flex-1 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2"
                >
                    <History className="w-4 h-4" /> Historique
                </button>
            </div>
        </div>
    );
};
