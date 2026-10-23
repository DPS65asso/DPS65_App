import React, { useState } from 'react';
import { VehicleDefinition, VehicleCheck } from '../../types';
import { safeDateFormat } from '../../utils/security';
import { Wrench, CheckCircle2, AlertTriangle, Plus, X, Calendar, User, Gauge } from 'lucide-react';
import { Button } from '../Button';

interface MechanicalBreakdownsModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: VehicleDefinition;
    checks: VehicleCheck[];
    isManager: boolean;
    onResolveBreakdown: (checkId: string) => Promise<void>;
    onAddBreakdown: (vehicleId: string) => void;
}

export const MechanicalBreakdownsModal: React.FC<MechanicalBreakdownsModalProps> = ({
    isOpen,
    onClose,
    vehicle,
    checks,
    isManager,
    onResolveBreakdown,
    onAddBreakdown
}) => {
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [showResolvedTab, setShowResolvedTab] = useState(false);

    if (!isOpen) return null;

    // Filtrer les signalements mécaniques pour ce véhicule
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

    const vehicleChecks = checks.filter(c => c.vehicleId === vehicle.id);

    const activeBreakdowns = vehicleChecks.filter(c => {
        const hasAlert = c.alerts && c.alerts.some(isMechanicalAlert);
        return hasAlert && !c.resolved;
    });

    const resolvedBreakdowns = vehicleChecks.filter(c => {
        const hasAlert = c.alerts && c.alerts.some(isMechanicalAlert);
        return hasAlert && !!c.resolved;
    });

    const handleResolve = async (id: string) => {
        setResolvingId(id);
        try {
            await onResolveBreakdown(id);
        } finally {
            setResolvingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${activeBreakdowns.length > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                            <Wrench className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                                Mécanique : {vehicle.name}
                            </h3>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {activeBreakdowns.length} panne{activeBreakdowns.length > 1 ? 's' : ''} active{activeBreakdowns.length > 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Onglets Actives / Résolues */}
                <div className="flex border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 text-xs font-bold">
                    <button
                        onClick={() => setShowResolvedTab(false)}
                        className={`flex-1 py-2.5 text-center transition-colors border-b-2 flex items-center justify-center gap-2 ${!showResolvedTab ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <span>Pannes Actives</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeBreakdowns.length > 0 ? 'bg-amber-100 text-amber-800 font-black' : 'bg-slate-100 text-slate-500'}`}>
                            {activeBreakdowns.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setShowResolvedTab(true)}
                        className={`flex-1 py-2.5 text-center transition-colors border-b-2 flex items-center justify-center gap-2 ${showResolvedTab ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <span>Résolues / Réparées</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500">
                            {resolvedBreakdowns.length}
                        </span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
                    {!showResolvedTab ? (
                        activeBreakdowns.length === 0 ? (
                            <div className="text-center py-8 px-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                                <h4 className="font-black text-emerald-800 dark:text-emerald-300 text-sm">
                                    Aucune panne mécanique en cours
                                </h4>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                    Ce véhicule est prêt et pleinement opérationnel pour les interventions.
                                </p>
                            </div>
                        ) : (
                            activeBreakdowns.map((check) => {
                                const details = check.alerts?.[0] || 'Panne mécanique signalée';
                                return (
                                    <div 
                                        key={check.id}
                                        className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/10 space-y-2 relative"
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="p-1 bg-amber-500 text-white rounded text-[10px] font-black uppercase tracking-wider">
                                                    Panne Active
                                                </span>
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> {safeDateFormat(check.date)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 font-mono text-xs font-black text-slate-700 dark:text-slate-300">
                                                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                                                <span>{check.km.toLocaleString()} km</span>
                                            </div>
                                        </div>

                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                            {details.replace(/^PANNE\s*:\s*/i, '')}
                                        </p>

                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                <User className="w-3 h-3" /> Signalé par {check.user}
                                            </span>

                                            {isManager && (
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={() => handleResolve(check.id)}
                                                    disabled={resolvingId === check.id}
                                                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                                >
                                                    {resolvingId === check.id ? "Résolution..." : "Marquer résolue"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )
                    ) : (
                        resolvedBreakdowns.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs italic">
                                Aucune panne résolue dans l'historique récent.
                            </div>
                        ) : (
                            resolvedBreakdowns.map((check) => {
                                const details = check.alerts?.[0] || 'Panne mécanique';
                                return (
                                    <div 
                                        key={check.id}
                                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1.5 opacity-80"
                                    >
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="flex items-center gap-1 text-emerald-600 font-bold">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Réparée
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                {safeDateFormat(check.date)}
                                            </span>
                                        </div>
                                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                            {details.replace(/^PANNE\s*:\s*/i, '')}
                                        </p>
                                        <div className="text-[10px] text-slate-400 flex justify-between">
                                            <span>Signalé par : {check.user}</span>
                                            {check.resolvedBy && <span>Résolu par : {check.resolvedBy}</span>}
                                        </div>
                                    </div>
                                );
                            })
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                            onClose();
                            onAddBreakdown(vehicle.id);
                        }}
                        icon={<Plus className="w-4 h-4" />}
                        fullWidth
                    >
                        Signaler une nouvelle panne
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={onClose}
                    >
                        Fermer
                    </Button>
                </div>
            </div>
        </div>
    );
};
