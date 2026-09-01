
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { CalendarDays, MapPin, Clock, CheckCircle2, UserPlus, UserX, ChevronDown, ChevronUp, FileText, Loader2, Syringe, Stethoscope, ArrowRight, Lock, Users, Archive, History, Pencil, Sparkles, X, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { storageService } from '../../services/storageService';
import { Mission, UserProfile } from '../../types';
import { safeDateFormat, getLocalDateString } from '../../utils/security';
import { useAuth } from '../../context/AuthContext';
import { useNewContent } from '../../context/NewContentContext';

const SEEN_MISSION_IDS_KEY = 'dps65_seen_mission_item_ids_v1';

export const PlanningPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAdmin, profile } = useAuth();
    const { markItemAsSeen, markSectionAsSeen, isItemNew, badges } = useNewContent();
    const [missions, setMissions] = useState<Mission[]>([]);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null);
    const [editingMission, setEditingMission] = useState<Mission | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);
    const [showArchives, setShowArchives] = useState(false);

    useEffect(() => {
        loadData();
        const bc = new BroadcastChannel('dps65_events_channel');
        bc.onmessage = (e) => {
            if (e.data.type === 'UPDATE_MISSIONS') loadMissions();
        };
        return () => bc.close();
    }, []);

    const markMissionSeen = (id: string) => {
        markItemAsSeen('missions', id);
    };

    const isMissionNew = (m: Mission) => {
        if (m.date < getLocalDateString()) return false;
        return isItemNew('missions', m.id, m.date);
    };

    const loadData = async () => {
        await loadMissions();
        const allProfiles = await authService.getProfiles();
        setProfiles(allProfiles);
    };

    const loadMissions = async () => {
        const data = await storageService.getMissions();
        // Marquer comme vu pour le badge du dashboard
        localStorage.setItem('dps65_seen_missions', data.length.toString());
        
        const safeData = data.map(m => ({
            ...m,
            registeredUserIds: Array.isArray(m.registeredUserIds) ? m.registeredUserIds : [],
            absentUserIds: Array.isArray(m.absentUserIds) ? m.absentUserIds : [],
            reservistUserIds: Array.isArray(m.reservistUserIds) ? m.reservistUserIds : []
        }));
        // Sort by date ascending for active missions
        setMissions(safeData.sort((a,b) => a.date.localeCompare(b.date)));
    };

    const changeStatus = async (missionId: string, status: 'present' | 'absent') => {
        if (!user) return;
        
        const targetMission = missions.find(m => m.id === missionId);
        if (!targetMission) return;

        const totalNeeded = (targetMission.requiredPse1 || 0) + (targetMission.requiredPse2 || 0) + (targetMission.requiredIde || 0) + (targetMission.requiredMed || 0);
        const currentFilled = (targetMission.registeredUserIds || []).filter(uid => {
            const p = profiles.find(prof => prof.id === uid);
            return p && p.role !== 'snu' && p.role !== 'stagiaire';
        }).length;

        const isCurrentlyPresent = (targetMission.registeredUserIds || []).includes(user.id);
        const isCurrentlyAbsent = (targetMission.absentUserIds || []).includes(user.id);
        const isCurrentlyReservist = (targetMission.reservistUserIds || []).includes(user.id);

        let finalStatus: 'present' | 'absent' | 'reservist' | 'none' = status;

        if (status === 'present') {
            if (isCurrentlyPresent || isCurrentlyReservist) {
                finalStatus = 'none';
            } else if (totalNeeded > 0 && currentFilled >= totalNeeded) {
                finalStatus = 'reservist';
            }
        } else if (status === 'absent') {
            if (isCurrentlyAbsent) finalStatus = 'none';
        }

        setMissions(prevMissions => prevMissions.map(m => {
            if (m.id !== missionId) return m;
            let newPresent = (m.registeredUserIds || []).filter(uid => uid !== user.id);
            let newAbsent = (m.absentUserIds || []).filter(uid => uid !== user.id);
            let newReservists = (m.reservistUserIds || []).filter(uid => uid !== user.id);

            if (finalStatus === 'present') newPresent.push(user.id);
            else if (finalStatus === 'absent') newAbsent.push(user.id);
            else if (finalStatus === 'reservist') newReservists.push(user.id);

            return { ...m, registeredUserIds: newPresent, absentUserIds: newAbsent, reservistUserIds: newReservists };
        }));
        
        await storageService.setMissionStatus(missionId, user.id, finalStatus);
    };

    const handleSaveMission = async () => {
        if (!editingMission) return;
        await storageService.saveMission(editingMission);
        setEditingMission(null);
        loadMissions();
    };

    const getProgressColor = (current: number, total: number) => {
        if (total === 0 && current > 0) return 'bg-blue-500';
        if (total === 0) return 'bg-slate-200 dark:bg-slate-600';
        const pct = (current / total) * 100;
        if (pct >= 100) return 'bg-blue-500';
        if (pct >= 50) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getMemberName = (userId: string) => {
        if (userId === 'me' || userId === user?.id) return "Moi";
        const p = profiles.find(p => p.id === userId);
        return p ? `${p.firstName} ${p.lastName}` : "Utilisateur Inconnu";
    };

    const getMemberRole = (userId: string) => {
        const p = profiles.find(p => p.id === userId);
        return p?.role || 'secouriste';
    };

    const handleDownloadOM = async (e: React.MouseEvent, mission: Mission) => {
        e.stopPropagation();
        setIsGeneratingPdf(mission.id);
        try {
            const missionParticipants = profiles.filter(p => mission.registeredUserIds.includes(p.id));
            const { generateMissionOrder } = await import('../../services/pdfService');
            await generateMissionOrder(mission, missionParticipants);
        } catch (error) { alert("Erreur lors de la génération du PDF."); } finally { setIsGeneratingPdf(null); }
    };

    // --- FILTRAGE AUTOMATIQUE ---
    const today = getLocalDateString();
    const activeMissions = missions.filter(m => m.date >= today);
    const archivedMissions = missions.filter(m => m.date < today).sort((a,b) => b.date.localeCompare(a.date)); // Descending for archives

    const MissionCard: React.FC<{ m: Mission }> = ({ m }) => {
        const isRegistered = (m.registeredUserIds || []).includes(user?.id || 'me');
        const isReservist = (m.reservistUserIds || []).includes(user?.id || 'me');
        const isAbsent = (m.absentUserIds || []).includes(user?.id || 'me');
        const totalNeeded = (m.requiredPse1 || 0) + (m.requiredPse2 || 0) + (m.requiredIde || 0) + (m.requiredMed || 0);
        const currentFilled = (m.registeredUserIds || []).filter(uid => {
            const p = profiles.find(prof => prof.id === uid);
            return p && p.role !== 'snu' && p.role !== 'stagiaire';
        }).length;
        const fillPercentage = totalNeeded > 0 ? Math.min(100, Math.round((currentFilled / totalNeeded) * 100)) : (currentFilled > 0 ? 100 : 0);
        const isExpanded = expandedMissionId === m.id;
        const dateObj = new Date(m.date);
        const isPast = m.date < today;
        const isNew = isMissionNew(m);

        return (
            <div 
                onClick={() => markMissionSeen(m.id)}
                className={`relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border overflow-hidden transition-all group mb-4 ${
                    isPast 
                        ? 'opacity-80 border-slate-200 dark:border-slate-700' 
                        : isNew 
                            ? 'border-blue-400 dark:border-blue-600 ring-1 ring-blue-400/30' 
                            : 'border-slate-200 dark:border-slate-700'
                }`}
            >
                <div className="flex">
                    <div className={`w-20 flex flex-col items-center justify-center border-r border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 p-2 shrink-0 ${isRegistered ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200' : ''}`}>
                        <span className="text-xs font-bold text-slate-400 uppercase">{dateObj.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                        <span className="text-3xl font-black text-slate-800 dark:text-white leading-none">{dateObj.getDate()}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">{dateObj.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                    </div>
                    <div className="flex-1 p-3 flex flex-col gap-2 min-w-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider inline-block ${m.type === 'DPS' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{m.type}</span>
                                    {isNew && !isPast && (
                                        <span className="inline-flex items-center gap-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs shadow-red-500/30 animate-pulse">
                                            <Sparkles className="w-2.5 h-2.5" /> Nouveau
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-slate-800 dark:text-white leading-tight truncate">{m.title}</h3>
                            </div>
                            {isAdmin && (
                                <button onClick={(e) => { e.stopPropagation(); markMissionSeen(m.id); setEditingMission(m); }} className="p-2 text-slate-400 hover:text-blue-600">
                                    <Pencil className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded"><Clock className="w-3 h-3"/> {m.timeStart}</span>
                            <span className="truncate flex items-center gap-1"><MapPin className="w-3 h-3"/> {m.location}</span>
                        </div>
                        <div className="mt-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                <span className="uppercase">Remplissage</span>
                                <span>{currentFilled} / {totalNeeded}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-500 ${getProgressColor(currentFilled, totalNeeded)}`} style={{ width: `${fillPercentage}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {!isPast && (
                    <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); changeStatus(m.id, 'present'); }} 
                            className={`py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                                isRegistered || isReservist
                                ? 'bg-blue-600 text-white shadow-blue-500/30 ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-800' 
                                : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/40'
                            }`}
                        >
                            {(isRegistered || isReservist) ? <CheckCircle2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                            {isRegistered ? 'Inscrit' : (isReservist ? 'Réserviste' : (currentFilled >= totalNeeded && totalNeeded > 0 ? 'S\'inscrire (Réserviste)' : 'Disponible'))}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); changeStatus(m.id, 'absent'); }} 
                            className={`py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                                isAbsent 
                                ? 'bg-red-600 text-white shadow-red-500/30 ring-2 ring-red-600 ring-offset-2 dark:ring-offset-slate-800' 
                                : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/40'
                            }`}
                        >
                            <UserX className="w-4 h-4" />
                            {isAbsent ? 'Absent' : 'Indisponible'}
                        </button>
                    </div>
                )}

                <div 
                    onClick={() => setExpandedMissionId(isExpanded ? null : m.id)}
                    className="bg-slate-50 dark:bg-slate-900/50 p-2 text-center border-t border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-xs font-bold text-slate-500"
                >
                    <Users className="w-3 h-3" />
                    {isExpanded ? 'Masquer l\'équipe' : `Voir l'équipe (${(m.registeredUserIds || []).length})`}
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>

                {isExpanded && (
                    <div className="bg-white dark:bg-slate-800 p-4 border-t border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2">
                        <div className="flex flex-wrap gap-2 mb-4 justify-center">
                            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">PSE1: {m.requiredPse1}</span>
                            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">PSE2: {m.requiredPse2}</span>
                            {m.requiredIde ? <span className="text-[10px] font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-700 px-2 py-1 rounded border border-purple-100 flex items-center gap-1"><Syringe className="w-3 h-3"/> IDE: {m.requiredIde}</span> : null}
                            {m.requiredMed ? <span className="text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-700 px-2 py-1 rounded border border-red-100 flex items-center gap-1"><Stethoscope className="w-3 h-3"/> MED: {m.requiredMed}</span> : null}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 p-3 mb-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Équipe Validée</h4>
                            <div className="space-y-1">
                                {(m.registeredUserIds || []).length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">Aucun inscrit pour le moment.</p>}
                                {(m.registeredUserIds || []).map(uid => (
                                    <div key={uid} className="flex items-center justify-between text-xs py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${uid === user?.id ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                            <span className={`font-bold ${uid === user?.id ? 'text-blue-600' : 'text-slate-700 dark:text-slate-300'}`}>{getMemberName(uid)}</span>
                                        </div>
                                        <span className="text-[9px] uppercase font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">{getMemberRole(uid)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RÉSERVISTES */}
                        {(m.reservistUserIds || []).length > 0 && (
                            <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-800/30 p-3 mb-4">
                                <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2 text-center">Réservistes</h4>
                                <div className="space-y-1">
                                    {(m.reservistUserIds || []).map(uid => (
                                        <div key={uid} className="flex items-center justify-between text-xs py-2 border-b border-orange-200 dark:border-orange-800/30 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${uid === user?.id ? 'bg-orange-500' : 'bg-orange-300'}`}></div>
                                                <span className={`font-bold ${uid === user?.id ? 'text-orange-600' : 'text-slate-700 dark:text-slate-300'}`}>{getMemberName(uid)}</span>
                                            </div>
                                            <span className="text-[9px] uppercase font-bold text-orange-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-700">{getMemberRole(uid)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button onClick={(e) => handleDownloadOM(e, m)} disabled={isGeneratingPdf === m.id} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 py-3 rounded-xl transition-colors">
                            {isGeneratingPdf === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Télécharger Ordre de Mission
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Layout title="Missions" showBack="/management" hideSync={true}>
            <div className="space-y-6 pb-24">
                
                {/* BANNIÈRE RACCOURCI BUREAU : CONVENTIONS & GRILLE DES RISQUES */}
                {isAdmin && (
                    <div className="hidden lg:flex items-center justify-between p-4 bg-gradient-to-r from-emerald-900/40 via-slate-900 to-blue-950/40 border border-emerald-500/30 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <FileSpreadsheet className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Mode Bureau — Administration</h4>
                                <p className="text-xs text-slate-300">Rédiger une convention organisateur &amp; dimensionner un dispositif avec la grille officielle RNMSC</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => navigate('/desktop/conventions')}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Conventions &amp; Grille RNMSC</span>
                        </button>
                    </div>
                )}

                {/* 1. MISSIONS ACTIVES */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <CalendarDays className="w-4 h-4" /> Prochaines Missions
                        </h3>
                        {badges.missions && (
                            <button 
                                onClick={() => markSectionAsSeen('missions')}
                                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg"
                            >
                                Tout marquer comme vu
                            </button>
                        )}
                    </div>
                    {activeMissions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                            <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
                            <p className="text-sm font-medium">Aucune mission à venir.</p>
                        </div>
                    ) : (
                        activeMissions.map(m => <MissionCard key={m.id} m={m} />)
                    )}
                </div>

                {/* 2. HISTORIQUE / ARCHIVES */}
                {archivedMissions.length > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                        <button 
                            onClick={() => setShowArchives(!showArchives)}
                            className="w-full flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4" /> Historique / Archives ({archivedMissions.length})
                            </div>
                            {showArchives ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        
                        {showArchives && (
                            <div className="mt-4 animate-in slide-in-from-top-2">
                                {archivedMissions.map(m => <MissionCard key={m.id} m={m} />)}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {editingMission && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh] animate-in zoom-in-95 my-auto">
                        <div className="p-3.5 bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-900 text-white flex justify-between items-center border-b border-blue-800/80 flex-shrink-0">
                            <div className="flex items-center gap-2 font-bold text-sm">
                                <Pencil className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>Modifier la mission</span>
                            </div>
                            <button type="button" onClick={() => setEditingMission(null)} className="p-1 text-slate-300 hover:text-white rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Titre de la mission *</label>
                                <input type="text" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={editingMission.title} onChange={e => setEditingMission({...editingMission, title: e.target.value})} />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Date *</label>
                                <input type="date" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={editingMission.date} onChange={e => setEditingMission({...editingMission, date: e.target.value})} />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Lieu *</label>
                                <input type="text" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={editingMission.location} onChange={e => setEditingMission({...editingMission, location: e.target.value})} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Type</label>
                                    <select className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={editingMission.type} onChange={e => setEditingMission({...editingMission, type: e.target.value as any})}>
                                        <option value="DPS">DPS</option>
                                        <option value="FORMATION">Formation</option>
                                        <option value="REUNION">Réunion</option>
                                        <option value="AUTRE">Autre</option>
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Début</label>
                                        <input type="time" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={editingMission.timeStart || ''} onChange={e => setEditingMission({...editingMission, timeStart: e.target.value})} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Fin</label>
                                        <input type="time" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={editingMission.timeEnd || ''} onChange={e => setEditingMission({...editingMission, timeEnd: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">PSE1</label>
                                    <input type="number" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={editingMission.requiredPse1 || 0} onChange={e => setEditingMission({...editingMission, requiredPse1: parseInt(e.target.value) || 0})} />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">PSE2</label>
                                    <input type="number" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={editingMission.requiredPse2 || 0} onChange={e => setEditingMission({...editingMission, requiredPse2: parseInt(e.target.value) || 0})} />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">IDE</label>
                                    <input type="number" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={editingMission.requiredIde || 0} onChange={e => setEditingMission({...editingMission, requiredIde: parseInt(e.target.value) || 0})} />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">MED</label>
                                    <input type="number" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={editingMission.requiredMed || 0} onChange={e => setEditingMission({...editingMission, requiredMed: parseInt(e.target.value) || 0})} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Inscrits</label>
                                    <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1 bg-slate-50 dark:bg-slate-800/80">
                                        {editingMission.registeredUserIds.length === 0 && <p className="text-[10px] text-slate-400 italic">Aucun</p>}
                                        {editingMission.registeredUserIds.map(uid => (
                                            <div key={uid} className="flex flex-col text-[10px] bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                                                <span className="font-bold truncate text-slate-800 dark:text-slate-100">{getMemberName(uid)}</span>
                                                <div className="flex justify-between mt-1">
                                                    <button type="button" onClick={() => {
                                                        const newReg = editingMission.registeredUserIds.filter(id => id !== uid);
                                                        const newRes = [...(editingMission.reservistUserIds || []), uid];
                                                        setEditingMission({...editingMission, registeredUserIds: newReg, reservistUserIds: newRes});
                                                    }} className="text-amber-600 hover:text-amber-700 dark:text-amber-400 font-bold">Réserve</button>
                                                    <button type="button" onClick={() => {
                                                        const newReg = editingMission.registeredUserIds.filter(id => id !== uid);
                                                        setEditingMission({...editingMission, registeredUserIds: newReg});
                                                    }} className="text-rose-600 hover:text-rose-700 dark:text-rose-400 font-bold">Retirer</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Réservistes</label>
                                    <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1 bg-slate-50 dark:bg-slate-800/80">
                                        {(editingMission.reservistUserIds || []).length === 0 && <p className="text-[10px] text-slate-400 italic">Aucun</p>}
                                        {(editingMission.reservistUserIds || []).map(uid => (
                                            <div key={uid} className="flex flex-col text-[10px] bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                                                <span className="font-bold truncate text-slate-800 dark:text-slate-100">{getMemberName(uid)}</span>
                                                <div className="flex justify-between mt-1">
                                                    <button type="button" onClick={() => {
                                                        const newRes = (editingMission.reservistUserIds || []).filter(id => id !== uid);
                                                        const newReg = [...editingMission.registeredUserIds, uid];
                                                        setEditingMission({...editingMission, registeredUserIds: newReg, reservistUserIds: newRes});
                                                    }} className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-bold">Inscrire</button>
                                                    <button type="button" onClick={() => {
                                                        const newRes = (editingMission.reservistUserIds || []).filter(id => id !== uid);
                                                        setEditingMission({...editingMission, reservistUserIds: newRes});
                                                    }} className="text-rose-600 hover:text-rose-700 dark:text-rose-400 font-bold">Retirer</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Ajouter un membre</label>
                                <select 
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                                    onChange={(e) => {
                                        const uid = e.target.value;
                                        if (!uid) return;
                                        if (editingMission.registeredUserIds.includes(uid) || (editingMission.reservistUserIds || []).includes(uid)) return;
                                        setEditingMission({...editingMission, registeredUserIds: [...editingMission.registeredUserIds, uid]});
                                        e.target.value = "";
                                    }}
                                >
                                    <option value="">Sélectionner un secouriste...</option>
                                    {profiles.filter(p => !editingMission.registeredUserIds.includes(p.id) && !(editingMission.reservistUserIds || []).includes(p.id)).map(p => (
                                        <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 flex-shrink-0">
                            <button type="button" onClick={() => setEditingMission(null)} className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-800 dark:text-white font-bold text-xs transition-colors">Annuler</button>
                            <button type="button" onClick={handleSaveMission} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs transition-colors shadow-md shadow-emerald-600/20">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};
