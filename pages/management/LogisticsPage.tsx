
import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { Truck, AlertTriangle, Save, History, Calendar, Wrench, ArrowLeft, Plus, Trash2, Settings, Bell, FileText, Loader2, PenTool, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { storageService } from '../../services/storageService';
import { exportService } from '../../services/exportService';
import { generateUUID, safeDateFormat } from '../../utils/security';
import { compressImageFile } from '../../utils/imageUtils';
import { VehicleCheck, VehicleDefinition, VehicleTrackingPoint } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/Button';
import { VehicleCard } from '../../components/logistics/VehicleCard';
import { MechanicalBreakdownsModal } from '../../components/logistics/MechanicalBreakdownsModal';

export const LogisticsPage: React.FC = () => {
    const { profile } = useAuth();
    const [view, setView] = useState<'LIST' | 'REPORT' | 'HISTORY' | 'EDIT'>('LIST');
    const [recentChecks, setRecentChecks] = useState<VehicleCheck[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
    const [vehicleHistory, setVehicleHistory] = useState<VehicleCheck[]>([]);
    const [fleet, setFleet] = useState<VehicleDefinition[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [breakdownModalVehicle, setBreakdownModalVehicle] = useState<VehicleDefinition | null>(null);
    const [currentVehicleIndex, setCurrentVehicleIndex] = useState(0);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchEndX, setTouchEndX] = useState<number | null>(null);
    
    // Droits d'accès
    const isManager = profile?.role === 'admin' || profile?.role === 'logisticien';
    const canDelete = profile?.role === 'admin' || profile?.role === 'logisticien';
    
    // Formulaire de Signalement / Entretien
    const [reportForm, setReportForm] = useState({ 
        vehicle: '', 
        date: new Date().toISOString().split('T')[0],
        km: '', 
        type: 'PANNE', 
        description: '' 
    });

    const [editForm, setEditForm] = useState<Partial<VehicleDefinition>>({});
    const [editingCheck, setEditingCheck] = useState<VehicleCheck | null>(null);
    const [newTrackingLabel, setNewTrackingLabel] = useState('');
    const [newTrackingDate, setNewTrackingDate] = useState('');
    const [fleetAlerts, setFleetAlerts] = useState<{vehicle: string, label: string, date: string, days: number}[]>([]);

    useEffect(() => {
        loadData();
        let bc: BroadcastChannel | null = null;
        try {
            bc = new BroadcastChannel('dps65_logistics_channel');
            bc.onmessage = () => {
                loadData();
            };
        } catch (e) {}
        return () => {
            if (bc) bc.close();
        };
    }, []);

    const minSwipeDistance = 45;

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEndX(null);
        setTouchStartX(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEndX(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStartX || !touchEndX) return;
        const distance = touchStartX - touchEndX;
        if (distance > minSwipeDistance && currentVehicleIndex < fleet.length - 1) {
            setCurrentVehicleIndex(prev => prev + 1);
        }
        if (distance < -minSwipeDistance && currentVehicleIndex > 0) {
            setCurrentVehicleIndex(prev => prev - 1);
        }
    };

    const goToPrevVehicle = () => {
        if (currentVehicleIndex > 0) {
            setCurrentVehicleIndex(prev => prev - 1);
        }
    };

    const goToNextVehicle = () => {
        if (currentVehicleIndex < fleet.length - 1) {
            setCurrentVehicleIndex(prev => prev + 1);
        }
    };

    const vehicleHasBreakdown = (vehicleId: string) => {
        return recentChecks.some(c => {
            if (c.vehicleId !== vehicleId || c.resolved) return false;
            return c.alerts && c.alerts.some(a => {
                const lower = a.toLowerCase();
                return (
                    a.startsWith('PANNE') ||
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
            });
        });
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (view !== 'LIST') return;
            if (e.key === 'ArrowRight') goToNextVehicle();
            if (e.key === 'ArrowLeft') goToPrevVehicle();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, currentVehicleIndex, fleet.length]);

    const loadData = async () => {
        const checks = await storageService.getVehicleChecks();
        const fleetData = await storageService.getFleet();
        // Marquer comme vu pour le badge du dashboard
        localStorage.setItem('dps65_seen_fleet', fleetData.length.toString());

        setRecentChecks(checks);
        setFleet(fleetData);
        if (fleetData.length > 0 && !reportForm.vehicle) {
            setReportForm(prev => ({ ...prev, vehicle: fleetData[0].id }));
        }
        setCurrentVehicleIndex(prev => (prev >= fleetData.length ? Math.max(0, fleetData.length - 1) : prev));
        calculateAlerts(fleetData);
    };

    const calculateAlerts = (vehicles: VehicleDefinition[]) => {
        const alerts: {vehicle: string, label: string, date: string, days: number}[] = [];
        const today = new Date();
        today.setHours(0,0,0,0);
        vehicles.forEach(v => {
            const points = [
                { l: 'Contrôle Technique', d: v.nextTechControl },
                { l: 'Entretien/Vidange', d: v.nextService },
                ...(v.customTracking || []).map(t => ({ l: t.label, d: t.date }))
            ];
            points.forEach(p => {
                if(p.d) {
                    const d = new Date(p.d);
                    d.setHours(0,0,0,0);
                    const diffTime = d.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if(diffDays <= 30) {
                        alerts.push({ vehicle: v.name, label: p.l, date: new Date(p.d).toLocaleDateString(), days: diffDays });
                    }
                }
            });
        });
        setFleetAlerts(alerts.sort((a,b) => a.days - b.days));
    };

    const loadHistory = async (id: string) => {
        setIsLoadingHistory(true);
        const history = await storageService.getVehicleChecks(id);
        // Tri par date décroissante
        setVehicleHistory(history.sort((a,b) => b.date - a.date));
        setIsLoadingHistory(false);
    };

    const handleHistoryClick = (id: string) => {
        setSelectedVehicleId(id);
        setView('HISTORY');
        loadHistory(id);
    };

    const handleReportClick = (vehicleId?: string) => {
        setReportForm({
            vehicle: vehicleId || (fleet[0]?.id || ''),
            date: new Date().toISOString().split('T')[0],
            km: '',
            type: 'PANNE',
            description: ''
        });
        setEditingCheck(null);
        setView('REPORT');
    };

    const handleEditCheck = (check: VehicleCheck) => {
        setEditingCheck(check);
        const details = check.alerts?.[0] || '';
        let type = 'AUTRE';
        let description = details;
        
        const types = ['PANNE', 'ENTRETIEN', 'PNEUS', 'DISTRIBUTION'];
        for (const t of types) {
            if (details.startsWith(t + ' : ')) {
                type = t;
                description = details.replace(t + ' : ', '');
                break;
            }
        }

        const formattedDate = check.date 
            ? new Date(check.date).toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0];

        setReportForm({
            vehicle: check.vehicleId,
            date: formattedDate,
            km: check.km.toString(),
            type,
            description
        });
        setView('REPORT');
    };

    const handleDeleteCheck = async (id: string) => {
        if (!confirm("Supprimer définitivement cette entrée de l'historique ?")) return;
        await storageService.deleteVehicleCheck(id);
        if (selectedVehicleId) loadHistory(selectedVehicleId);
        loadData();
    };

    const handleSaveReport = async () => {
        if (reportForm.type === 'PANNE' && !reportForm.km) { 
            alert("Le kilométrage est obligatoire pour un signalement de panne."); 
            return; 
        }
        if (!reportForm.description) { 
            alert("La description est requise."); 
            return; 
        }
        
        // On formate le message d'alerte pour inclure le type
        const formattedAlert = `${reportForm.type} : ${reportForm.description}`;

        // Calcul du timestamp à partir de la date sélectionnée
        let reportTimestamp = Date.now();
        if (reportForm.date) {
            const parsedDate = new Date(reportForm.date + 'T12:00:00');
            if (!isNaN(parsedDate.getTime())) {
                reportTimestamp = parsedDate.getTime();
            }
        }

        const checkData: VehicleCheck = {
            id: editingCheck?.id || generateUUID(),
            vehicleId: reportForm.vehicle,
            date: reportTimestamp,
            user: editingCheck?.user || (profile ? `${profile.firstName} ${profile.lastName}` : 'Utilisateur'),
            km: parseInt(reportForm.km) || 0,
            fuelLevel: 0,
            cleanlinessInOut: true,
            cleanlinessOut: true,
            alerts: [formattedAlert]
        };

        await storageService.saveVehicleCheck(checkData);

        alert(editingCheck ? "Modification enregistrée !" : "Signalement enregistré !");
        loadData();
        if (selectedVehicleId) loadHistory(selectedVehicleId);
        setView(editingCheck ? 'HISTORY' : 'LIST');
        setEditingCheck(null);
        setReportForm({ 
            vehicle: fleet[0]?.id || '', 
            date: new Date().toISOString().split('T')[0], 
            km: '', 
            type: 'PANNE', 
            description: '' 
        });
    };

    const openEditVehicle = (v: VehicleDefinition) => {
        setEditForm(JSON.parse(JSON.stringify(v)));
        setView('EDIT');
    };

    const handleUpdatePhoto = async (vehicleId: string, photoDataUrl: string) => {
        const vehicle = fleet.find(v => v.id === vehicleId);
        if (!vehicle) return;
        const updatedVehicle = { ...vehicle, imageUrl: photoDataUrl };
        await storageService.saveVehicle(updatedVehicle);
        await loadData();
    };

    const handleResolveBreakdown = async (checkId: string) => {
        const resolvedBy = profile ? `${profile.firstName} ${profile.lastName}` : 'Admin';
        await storageService.resolveVehicleBreakdown(checkId, resolvedBy);
        await loadData();
    };

    const saveVehicleEdit = async () => {
        if (!editForm.id || !editForm.name) return;
        await storageService.saveVehicle(editForm as VehicleDefinition);
        await loadData();
        setView('LIST');
    };

    const handleDeleteVehicle = async () => {
        if (!editForm.id) return;
        if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement le véhicule "${editForm.name}" ?\nCette action est irréversible.`)) {
            try {
                await storageService.deleteVehicle(editForm.id);
                await loadData();
                setView('LIST');
            } catch (e) {
                console.error(e);
                alert("Erreur lors de la suppression.");
            }
        }
    };

    const addTrackingPoint = () => {
        if (!newTrackingLabel || !newTrackingDate) return;
        const newPoint: VehicleTrackingPoint = { id: generateUUID(), label: newTrackingLabel, date: newTrackingDate, type: 'OTHER' };
        setEditForm(prev => ({ ...prev, customTracking: [...(prev.customTracking || []), newPoint] }));
        setNewTrackingLabel('');
        setNewTrackingDate('');
    };

    const removeTrackingPoint = (id: string) => {
        setEditForm(prev => ({ ...prev, customTracking: (prev.customTracking || []).filter(t => t.id !== id) }));
    };

    const handleExportHistory = async () => {
        const vehicle = fleet.find(v => v.id === selectedVehicleId);
        if (!vehicle || vehicleHistory.length === 0) return;

        setIsExporting(true);
        try {
            const { fileName, blob } = await exportService.generateVehicleHistoryPdf(vehicle, vehicleHistory);
            
            const file = new File([blob], fileName, { type: 'application/pdf' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Carnet ${vehicle.name}`,
                    text: 'Historique et Maintenance.'
                });
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error(e);
            alert("Erreur lors de la génération du PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    const renderListHeader = () => (
        <div className="flex items-center justify-center gap-3 w-full min-w-0 pr-6">
            <button
                onClick={goToPrevVehicle}
                disabled={currentVehicleIndex === 0}
                className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                aria-label="Véhicule précédent"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

            {fleet.length > 0 && (
                <div className="text-sm font-black tracking-widest text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700">
                    {currentVehicleIndex + 1} / {fleet.length}
                </div>
            )}

            <button
                onClick={goToNextVehicle}
                disabled={currentVehicleIndex === fleet.length - 1}
                className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                aria-label="Véhicule suivant"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );

    return (
        <Layout 
            title={view === 'LIST' ? renderListHeader() : (view === 'HISTORY' ? "Historique" : (view === 'EDIT' ? "Gestion Véhicule" : "Logistique"))} 
            showBack="/management" 
            hideSync={true} 
            noScroll={view === 'LIST'}
        >
            {view === 'LIST' && (
                fleet.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                        <Truck className="w-16 h-16 stroke-1 text-slate-400 mb-2" />
                        <p className="font-bold">Aucun véhicule configuré</p>
                    </div>
                ) : (
                    <div 
                        className="h-full flex-1 flex flex-col overflow-hidden select-none"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* CARROUSEL VIEWPORT */}
                        <div className="relative flex-1 w-full overflow-hidden flex items-stretch">
                            {/* PISTE DU CARROUSEL AVEC LARGEUR ADAPTÉE & FLUIDE */}
                            <div
                                className="flex w-full h-full transition-transform duration-300 ease-out"
                                style={{ transform: `translateX(-${currentVehicleIndex * 100}%)` }}
                            >
                                {fleet.map((v) => {
                                    const lastCheck = recentChecks.filter(c => c.vehicleId === v.id).sort((a,b) => b.date - a.date)[0];
                                    return (
                                        <div key={v.id} className="w-full h-full flex-shrink-0 px-3 sm:px-6 md:px-12 pb-1 flex flex-col items-center justify-center">
                                            <div className="w-full max-w-sm sm:max-w-md h-full flex flex-col">
                                                <VehicleCard
                                                    vehicle={v}
                                                    lastCheck={lastCheck}
                                                    checks={recentChecks}
                                                    isManager={isManager}
                                                    onEditSettings={openEditVehicle}
                                                    onReport={handleReportClick}
                                                    onHistory={handleHistoryClick}
                                                    onUpdatePhoto={handleUpdatePhoto}
                                                    onOpenBreakdowns={(veh) => setBreakdownModalVehicle(veh)}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* NAVIGATION PAR POINTS (DOTS) EN BAS */}
                        <div className="flex items-center justify-center gap-1.5 py-1.5 flex-none">
                            {fleet.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentVehicleIndex(idx)}
                                    aria-label={`Aller au véhicule ${idx + 1}`}
                                    className={`transition-all rounded-full ${
                                        idx === currentVehicleIndex
                                            ? 'w-6 h-2 bg-red-600'
                                            : 'w-2 h-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                )
            )}

            {view === 'REPORT' && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm space-y-5 animate-in slide-in-from-right">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <PenTool className="w-5 h-5"/> {editingCheck ? 'Modifier l\'entrée' : 'Nouveau Signalement'}
                    </h2>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Véhicule</label>
                        <select 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-50" 
                            value={reportForm.vehicle} 
                            onChange={e => setReportForm({...reportForm, vehicle: e.target.value})}
                            disabled={!!editingCheck}
                        >
                            {fleet.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date du signalement / intervention</label>
                        <input 
                            type="date" 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-sm font-semibold text-slate-800 dark:text-white" 
                            value={reportForm.date} 
                            onChange={e => setReportForm({...reportForm, date: e.target.value})} 
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type d'intervention</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['PANNE', 'ENTRETIEN', 'PNEUS', 'DISTRIBUTION', 'AUTRE'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setReportForm({...reportForm, type})}
                                    className={`p-2 rounded-lg text-xs font-bold border transition-colors ${reportForm.type === type 
                                        ? (type === 'PANNE' ? 'bg-red-600 text-white border-red-600' : 'bg-blue-600 text-white border-blue-600') 
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kilométrage Actuel</label>
                        <input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-mono" placeholder="ex: 125000" value={reportForm.km} onChange={e => setReportForm({...reportForm, km: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description / Travaux</label>
                        <textarea className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700" rows={3} placeholder="Détails de la panne ou des réparations..." value={reportForm.description} onChange={e => setReportForm({...reportForm, description: e.target.value})}></textarea>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button onClick={() => { setView(editingCheck ? 'HISTORY' : 'LIST'); setEditingCheck(null); }} className="flex-1 py-3 border border-slate-300 rounded-lg font-bold text-slate-500">Annuler</button>
                        <button onClick={handleSaveReport} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg flex items-center justify-center gap-2">
                            <Save className="w-4 h-4" /> {editingCheck ? 'Mettre à jour' : 'Enregistrer'}
                        </button>
                    </div>
                </div>
            )}

            {view === 'EDIT' && isManager && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm space-y-5 animate-in slide-in-from-right">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                            <Settings className="w-6 h-6" />
                            <h2 className="text-lg font-bold">Configuration : {editForm.name}</h2>
                        </div>
                        {canDelete && (
                            <button 
                                onClick={handleDeleteVehicle}
                                className="p-2 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                                title="Supprimer le véhicule"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom du véhicule</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-bold" 
                            value={editForm.name || ''} 
                            onChange={e => setEditForm({...editForm, name: e.target.value})} 
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Immatriculation</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-mono font-bold uppercase" 
                            placeholder="Ex: 65-DPS-01" 
                            value={editForm.immatriculation || ''} 
                            onChange={e => setEditForm({...editForm, immatriculation: e.target.value.toUpperCase()})} 
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Photo du véhicule</label>
                        <div className="flex items-center gap-3">
                            {editForm.imageUrl ? (
                                <img src={editForm.imageUrl} alt="Aperçu" className="w-24 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" />
                            ) : (
                                <div className="w-24 h-16 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700">
                                    <Truck className="w-6 h-6" />
                                </div>
                            )}
                            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-300 dark:border-slate-600 transition-colors">
                                <Camera className="w-4 h-4" />
                                <span>Sélectionner une photo</span>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={async (e) => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                            try {
                                                const compressed = await compressImageFile(f, 1200, 900, 0.8);
                                                setEditForm(prev => ({ ...prev, imageUrl: compressed }));
                                            } catch (err: any) {
                                                alert(err.message || "Erreur lors du chargement de l'image");
                                            }
                                        }
                                    }} 
                                />
                            </label>
                            {editForm.imageUrl && (
                                <button 
                                    type="button" 
                                    onClick={() => setEditForm(prev => ({ ...prev, imageUrl: '' }))}
                                    className="text-xs font-bold text-red-500 hover:text-red-700 p-2"
                                >
                                    Supprimer
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prochain CT</label><input type="date" className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700" value={editForm.nextTechControl} onChange={e => setEditForm({...editForm, nextTechControl: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prochaine Vidange</label><input type="date" className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700" value={editForm.nextService} onChange={e => setEditForm({...editForm, nextService: e.target.value})} /></div>
                    <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-white mb-3">Suivi additionnel</h3>
                        <div className="space-y-2 mb-4">{editForm.customTracking?.map(pt => (<div key={pt.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700"><div className="flex flex-col"><span className="font-bold text-sm text-slate-800 dark:text-white">{pt.label}</span><span className="text-xs text-slate-500">{new Date(pt.date).toLocaleDateString()}</span></div><button onClick={() => removeTrackingPoint(pt.id)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4"/></button></div>))}</div>
                        <div className="flex gap-2 items-end bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg"><div className="flex-1"><label className="block text-[10px] font-bold text-slate-500 mb-1">Intitulé</label><input type="text" className="w-full p-2 rounded text-sm border dark:bg-slate-800 dark:border-slate-600" placeholder="Ex: Pollution" value={newTrackingLabel} onChange={e => setNewTrackingLabel(e.target.value)} /></div><div className="flex-1"><label className="block text-[10px] font-bold text-slate-500 mb-1">Date</label><input type="date" className="w-full p-2 rounded text-sm border dark:bg-slate-800 dark:border-slate-600" value={newTrackingDate} onChange={e => setNewTrackingDate(e.target.value)} /></div><button onClick={addTrackingPoint} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"><Plus className="w-5 h-5"/></button></div>
                    </div>
                    <div className="flex gap-3 pt-4"><Button variant="outline" onClick={() => setView('LIST')} fullWidth>Annuler</Button><Button onClick={saveVehicleEdit} fullWidth icon={<Save className="w-4 h-4" />}>Enregistrer</Button></div>
                </div>
            )}

            {view === 'HISTORY' && (
                <div className="animate-in slide-in-from-right space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <button onClick={() => setView('LIST')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
                                <ArrowLeft className="w-4 h-4" /> Retour Liste
                            </button>
                            <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                                Historique classé par date d'intervention
                            </span>
                        </div>
                        
                        {/* EXPORT PDF - ACCESSIBLE ADMIN/LOGISTICIEN */}
                        {isManager && vehicleHistory.length > 0 && (
                            <Button 
                                onClick={handleExportHistory} 
                                disabled={isExporting} 
                                size="sm" 
                                variant="outline"
                                icon={isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            >
                                PDF
                            </Button>
                        )}
                    </div>

                    {isLoadingHistory ? <div className="text-center py-10 text-slate-400">Chargement...</div> : vehicleHistory.length === 0 ? <div className="text-center py-10 text-slate-400 italic">Aucun historique disponible.</div> : (
                        <div className="space-y-3">
                            {vehicleHistory.map(check => {
                                const details = check.alerts && check.alerts.length > 0 ? check.alerts[0] : 'RAS';
                                const isPanne = details.startsWith('PANNE');
                                const isEntretien = details.startsWith('ENTRETIEN') || details.startsWith('DISTRIBUTION') || details.startsWith('PNEUS');
                                const formattedDateDisplay = safeDateFormat(check.date);

                                return (
                                    <div key={check.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm relative overflow-hidden ${isPanne ? 'border-red-200 dark:border-red-900' : (isEntretien ? 'border-blue-200 dark:border-blue-900' : 'border-slate-200 dark:border-slate-700')}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">{formattedDateDisplay}</span>
                                                </div>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">Par {check.user}</span>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className="font-mono font-bold bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-sm">{check.km} km</span>
                                                {isManager && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleEditCheck(check)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteCheck(check.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`mt-2 p-2 rounded text-xs font-bold flex items-start gap-2 ${isPanne ? 'bg-red-50 text-red-700' : (isEntretien ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-600')}`}>
                                            {isPanne ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <Wrench className="w-4 h-4 flex-shrink-0" />}
                                            <div>{details}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* MODALE DU MODULE PANNES MÉCANIQUES ACTIVES */}
            {breakdownModalVehicle && (
                <MechanicalBreakdownsModal
                    isOpen={!!breakdownModalVehicle}
                    onClose={() => setBreakdownModalVehicle(null)}
                    vehicle={breakdownModalVehicle}
                    checks={recentChecks}
                    isManager={isManager}
                    onResolveBreakdown={handleResolveBreakdown}
                    onAddBreakdown={(vId) => handleReportClick(vId)}
                />
            )}
        </Layout>
    );
};
