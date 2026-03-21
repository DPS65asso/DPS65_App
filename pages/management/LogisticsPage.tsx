
import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { Truck, AlertTriangle, Save, History, Calendar, Wrench, ArrowLeft, Plus, Trash2, Settings, Bell, FileText, Loader2, PenTool } from 'lucide-react';
import { storageService } from '../../services/storageService';
import { exportService } from '../../services/exportService';
import { generateUUID, safeDateFormat } from '../../utils/security';
import { VehicleCheck, VehicleDefinition, VehicleTrackingPoint } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/Button';

export const LogisticsPage: React.FC = () => {
    const { profile } = useAuth();
    const [view, setView] = useState<'LIST' | 'REPORT' | 'HISTORY' | 'EDIT'>('LIST');
    const [recentChecks, setRecentChecks] = useState<VehicleCheck[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
    const [vehicleHistory, setVehicleHistory] = useState<VehicleCheck[]>([]);
    const [fleet, setFleet] = useState<VehicleDefinition[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    // Droits d'accès
    const isManager = profile?.role === 'admin' || profile?.role === 'logisticien';
    const canDelete = profile?.role === 'admin' || profile?.role === 'logisticien';
    
    // Formulaire de Signalement / Entretien
    const [reportForm, setReportForm] = useState({ 
        vehicle: '', 
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
    }, []);

    const loadData = async () => {
        const checks = await storageService.getVehicleChecks();
        const fleetData = await storageService.getFleet();
        setRecentChecks(checks);
        setFleet(fleetData);
        if (fleetData.length > 0 && !reportForm.vehicle) {
            setReportForm(prev => ({ ...prev, vehicle: fleetData[0].id }));
        }
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
        if (vehicleId) setReportForm(prev => ({ ...prev, vehicle: vehicleId }));
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

        setReportForm({
            vehicle: check.vehicleId,
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

        const checkData: VehicleCheck = {
            id: editingCheck?.id || generateUUID(),
            vehicleId: reportForm.vehicle,
            date: editingCheck?.date || Date.now(),
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
        setReportForm({ vehicle: fleet[0]?.id || '', km: '', type: 'PANNE', description: '' });
    };

    const openEditVehicle = (v: VehicleDefinition) => {
        setEditForm(JSON.parse(JSON.stringify(v)));
        setView('EDIT');
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

    const getStatusStyle = (dateStr: string) => {
        if (!dateStr) return { className: 'bg-slate-100 text-slate-500 border border-slate-200', dateDisplay: '--/--/----', status: 'Non défini' };
        
        const today = new Date();
        const target = new Date(dateStr);
        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const dateDisplay = safeDateFormat(dateStr);

        if (diffDays < 0) return { className: 'bg-red-600 text-white shadow-md shadow-red-500/20', dateDisplay, status: `RETARD ${Math.abs(diffDays)}j` };
        if (diffDays < 30) return { className: 'bg-orange-500 text-white shadow-md shadow-orange-500/20', dateDisplay, status: `J-${diffDays}` };
        
        // Green status
        return { className: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20', dateDisplay, status: 'Valide' };
    };

    return (
        <Layout title={view === 'HISTORY' ? "Historique" : (view === 'EDIT' ? "Gestion Véhicule" : "Logistique")} showBack="/management" hideSync={true}>
            {view === 'LIST' && (
                <div className="space-y-4 pb-20">
                    {/* ALERTES MAINTENANCE (ADMIN ONLY) */}
                    {isManager && fleetAlerts.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800 p-4 shadow-sm animate-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2 text-xs uppercase tracking-wider"><Bell className="w-4 h-4 animate-pulse" /> Maintenance Requise ({fleetAlerts.length})</h3>
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {fleetAlerts.map((alert, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-900 p-2 rounded border border-red-100 dark:border-red-900/50 flex justify-between items-center text-xs">
                                        <div><span className="font-black text-slate-800 dark:text-white">{alert.vehicle}</span><span className="text-slate-400 mx-1">•</span><span className="text-slate-600 dark:text-slate-300">{alert.label}</span></div>
                                        <div className={`font-black ${alert.days < 0 ? 'text-red-600' : 'text-orange-500'}`}>{alert.days < 0 ? `RETARD ${Math.abs(alert.days)}j` : `J-${alert.days}`}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* BOUTON SIGNALEMENT (ACCESSIBLE TOUS) */}
                    <button onClick={() => handleReportClick()} className="w-full bg-slate-800 text-white p-4 rounded-xl shadow-lg flex items-center justify-between active:scale-[0.99] transition-transform">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg"><AlertTriangle className="w-6 h-6" /></div>
                            <div className="text-left">
                                <span className="block font-black text-lg">Signaler une Panne</span>
                                <span className="block text-xs opacity-70">Ou ajouter un entretien</span>
                            </div>
                        </div>
                        <Plus className="w-5 h-5" />
                    </button>

                    <div className="grid grid-cols-1 gap-3">
                        {fleet.map((v) => {
                            // On cherche le dernier relevé pour ce véhicule
                            const lastCheck = recentChecks.filter(c => c.vehicleId === v.id).sort((a,b) => b.date - a.date)[0];
                            const ctInfo = getStatusStyle(v.nextTechControl);
                            
                            return (
                                <div key={v.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm transition-all group">
                                    <div className="p-4 flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500">
                                                <Truck className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-lg text-slate-800 dark:text-white leading-none">{v.name}</h4>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{v.type}</span>
                                            </div>
                                        </div>
                                        {isManager && <button onClick={(e) => { e.stopPropagation(); openEditVehicle(v); }} className="text-slate-300 hover:text-blue-500 p-1"><Settings className="w-5 h-5" /></button>}
                                    </div>
                                    
                                    {/* DASHBOARD INDICATORS */}
                                    <div className="px-4 pb-4 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* SUIVI ADDITIONNEL (MOST URGENT) */}
                                            {(() => {
                                                const urgentPoint = v.customTracking && v.customTracking.length > 0 
                                                    ? [...v.customTracking].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
                                                    : null;
                                                
                                                const status = urgentPoint ? getStatusStyle(urgentPoint.date) : null;

                                                return (
                                                    <div className={`rounded-xl p-3 flex flex-col items-center justify-center min-h-[80px] ${status ? status.className : 'bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800'}`}>
                                                        <span className="text-[9px] font-bold uppercase mb-0.5 opacity-80 text-center leading-tight">
                                                            {urgentPoint ? urgentPoint.label : 'Suivi Add.'}
                                                        </span>
                                                        <span className="font-black text-lg tracking-tight">
                                                            {urgentPoint ? status?.dateDisplay : '--/--/----'}
                                                        </span>
                                                        {status && status.status !== 'Valide' && (
                                                            <span className="text-[9px] font-bold bg-black/20 px-1.5 rounded mt-1">{status.status}</span>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* PROCHAIN CT */}
                                            <div className={`rounded-xl p-3 flex flex-col items-center justify-center min-h-[80px] ${ctInfo.className}`}>
                                                <span className="text-[9px] font-bold uppercase mb-0.5 opacity-80">Prochain CT</span>
                                                <span className="font-black text-lg tracking-tight">{ctInfo.dateDisplay}</span>
                                                {ctInfo.status !== 'Valide' && <span className="text-[9px] font-bold bg-black/20 px-1.5 rounded mt-1">{ctInfo.status}</span>}
                                            </div>
                                        </div>

                                        {/* KILOMÉTRAGE EN GRAND */}
                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800 shadow-inner">
                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Kilométrage Actuel</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-mono font-black text-slate-800 dark:text-white text-3xl tracking-tighter">
                                                    {lastCheck ? lastCheck.km.toLocaleString() : '---'}
                                                </span>
                                                <span className="text-sm font-bold text-slate-400 uppercase">km</span>
                                            </div>
                                            {lastCheck && (
                                                <span className="text-[9px] text-slate-400 mt-1 font-bold italic">
                                                    Relevé le {new Date(lastCheck.date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* LISTE COMPLÈTE DU SUIVI ADDITIONNEL (SI PLUS D'UN POINT) */}
                                    {v.customTracking && v.customTracking.length > 1 && (
                                        <div className="px-4 pb-4">
                                            <div className="bg-blue-50/30 dark:bg-blue-900/5 rounded-xl p-2 border border-blue-100/30 dark:border-blue-900/20">
                                                <div className="space-y-1">
                                                    {v.customTracking.slice(1).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(pt => {
                                                        const status = getStatusStyle(pt.date);
                                                        return (
                                                            <div key={pt.id} className="flex justify-between items-center text-[10px] px-1">
                                                                <span className="font-bold text-slate-500 dark:text-slate-400">{pt.label}</span>
                                                                <span className={`font-mono ${status.status !== 'Valide' ? 'text-orange-500' : 'text-slate-400'}`}>{status.dateDisplay}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* ACTIONS */}
                                    <div className="flex border-t border-slate-100 dark:border-slate-700">
                                        <button onClick={() => handleReportClick(v.id)} className="flex-1 py-3 text-xs font-bold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center justify-center gap-2 border-r border-slate-100 dark:border-slate-700">
                                            <AlertTriangle className="w-4 h-4" /> Signaler
                                        </button>
                                        <button onClick={() => handleHistoryClick(v.id)} className="flex-1 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2">
                                            <History className="w-4 h-4" /> Historique
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
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
                        <button onClick={() => setView('LIST')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors"><ArrowLeft className="w-4 h-4" /> Retour Liste</button>
                        
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

                                return (
                                    <div key={check.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm relative overflow-hidden ${isPanne ? 'border-red-200 dark:border-red-900' : (isEntretien ? 'border-blue-200 dark:border-blue-900' : 'border-slate-200 dark:border-slate-700')}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 uppercase block mb-0.5">{new Date(check.date).toLocaleDateString()}</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Par {check.user}</span>
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
        </Layout>
    );
};
