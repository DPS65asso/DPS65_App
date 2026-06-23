
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { storageService } from '../services/storageService';
import { Event, Victim, Outcome, TriageColor, AppConfig } from '../types';
import { safeDateFormat, safeTimeFormat, getLocalDateString } from '../utils/security';
import { generateEventReport } from '../services/pdfService';
import { UserPlus, Loader2, Pencil, Trash2, Search, Calendar, MapPin, Bed, Settings, AlertCircle, Siren, X, Filter, Stethoscope, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { NoviModal } from '../components/NoviModal';
import { ResponderModal } from '../components/ResponderModal';
import { ResourceModal } from '../components/ResourceModal';
import { EventSettingsModal } from '../components/EventSettingsModal';

export const EventDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, currentTeam } = useAuth();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [victims, setVictims] = useState<Victim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterTriage, setFilterTriage] = useState<TriageColor | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'FINISHED'>('ALL');
  const [filterMedical, setFilterMedical] = useState(false);

  const notifiedVictimsRef = useRef<Set<string>>(new Set());

  const [isResponderModalOpen, setIsResponderModalOpen] = useState(false);
  const [isNoviModalOpen, setIsNoviModalOpen] = useState(false);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // RESTRICTION : Organisateur ne peut pas accéder à la liste des victimes
  useEffect(() => {
    if (profile?.role === 'organisateur') {
      navigate('/tactical', { replace: true });
    }
  }, [profile, navigate]);

  const loadData = async () => {
    if (id) {
      const e = await storageService.getEventById(id);
      if (e) {
        setEvent(e);
        const v = await storageService.getVictimsByEvent(id, false);
        setVictims(v);
        const c = await storageService.getConfig();
        setConfig(c);
      } else { navigate('/events'); }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    
    // Rafraichissement local
    const interval = setInterval(() => {
        const timeNow = Date.now();
        setNow(timeNow);
        checkVictimsFreshness(timeNow);
    }, 60000); 

    const bc = new BroadcastChannel('dps65_victims_channel');
    bc.onmessage = (e) => {
        if (e.data.type === 'UPDATE_VICTIMS' && e.data.eventId === id) {
            loadData();
        }
    };
    
    return () => { 
        clearInterval(interval);
        bc.close();
    };
  }, [id]);

  const checkVictimsFreshness = (timeNow: number) => {
    victims.forEach(v => {
        if (v.outcome === Outcome.TREATMENT_IN_PROGRESS && isVitalsStale(v, timeNow)) {
            if (!notifiedVictimsRef.current.has(v.id)) {
                sendStaleNotification(v);
                notifiedVictimsRef.current.add(v.id);
            }
        } else {
            notifiedVictimsRef.current.delete(v.id);
        }
    });
  };

  const sendStaleNotification = (v: Victim) => {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("DPS65 : Re-bilan nécessaire", {
            body: `Les constantes de ${v.fullName} datent de plus de 15 min.`,
            icon: "/pwa-192x192.png",
            tag: `stale-${v.id}`
        });
    }
  };

  const isVitalsStale = (victim: Victim, timeNow: number): boolean => {
      if (victim.outcome !== Outcome.TREATMENT_IN_PROGRESS) return false;
      let lastTimeMs = new Date(victim.arrivalTime).getTime();
      if (victim.vitals && victim.vitals.length > 0) {
          const sorted = [...victim.vitals].sort((a,b) => b.time.localeCompare(a.time));
          const last = sorted[0];
          const [h, m] = last.time.split(/:|h/).map(Number);
          const d = new Date(); d.setHours(h, m, 0, 0);
          lastTimeMs = d.getTime();
      }
      return (timeNow - lastTimeMs) > 15 * 60 * 1000;
  };

  const handleAddVictimClick = () => {
      if (currentTeam) {
          const responderData = {
              name: profile?.lastName || 'Anonyme',
              firstName: profile?.firstName || '',
              team: currentTeam
          };
          navigate(`/events/${id}/add`, { state: { responder: responderData } });
      } else {
          setIsResponderModalOpen(true);
      }
  };

  const handleDeleteClick = (e: React.MouseEvent, victimId: string) => { e.stopPropagation(); setDeleteId(victimId); };
  const handleConfirmDelete = async () => { if (!deleteId) return; setIsDeleting(true); try { await storageService.deleteVictim(deleteId); setVictims(prev => prev.filter(v => v.id !== deleteId)); } catch (error) { alert("Échec."); } finally { setIsDeleting(false); setDeleteId(null); } };
  const cancelDelete = () => { setDeleteId(null); };
  const handleResponderConfirm = (data: { name: string; firstName: string; team: string }) => { setIsResponderModalOpen(false); navigate(`/events/${id}/add`, { state: { responder: data } }); };
  const clearFilters = () => { setSearchQuery(''); setFilterStatus('ALL'); setFilterTriage('ALL'); setFilterMedical(false); setShowFilters(false); };

  // OPTIMISATION : Calculs mémorisés pour ne pas bloquer le thread principal
  const activeVictims = useMemo(() => victims.filter(v => v.outcome === Outcome.TREATMENT_IN_PROGRESS), [victims]);
  
  const stats = useMemo(() => {
      const stretchersOccupied = activeVictims.filter(v => v.resourceUsed === 'stretcher' || (!v.resourceUsed && (v.triageColor === TriageColor.UA || v.triageColor === TriageColor.UR))).length;
      const chairsOccupied = activeVictims.length - stretchersOccupied;
      return { stretchersOccupied, chairsOccupied };
  }, [activeVictims]);

  const totalStretchers = event?.resourceConfig?.totalStretchers || 0;
  const totalChairs = event?.resourceConfig?.totalChairs || 0;
  
  const saveResourceConfig = async (cfg: { totalStretchers: number; totalChairs: number }) => {
      if (!event) return;
      const updatedEvent = { ...event, resourceConfig: cfg };
      setEvent(updatedEvent);
      await storageService.saveEvent(updatedEvent);
      setIsResourceModalOpen(false);
  };

  // OPTIMISATION : Filtrage lourd mémorisé
  const filteredVictims = useMemo(() => {
      return [...victims]
        .sort((a, b) => new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime())
        .filter(v => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = v.fullName.toLowerCase().includes(searchLower) || v.bibNumber.includes(searchLower);
            const matchesTriage = filterTriage === 'ALL' || v.triageColor === filterTriage;
            let matchesOutcome = true;
            if (filterStatus === 'ACTIVE') matchesOutcome = v.outcome === Outcome.TREATMENT_IN_PROGRESS;
            if (filterStatus === 'FINISHED') matchesOutcome = v.outcome !== Outcome.TREATMENT_IN_PROGRESS;
            const matchesMedical = !filterMedical || v.isAdvancedMode;
            return matchesSearch && matchesTriage && matchesOutcome && matchesMedical;
        });
  }, [victims, searchQuery, filterTriage, filterStatus, filterMedical]);

  const hasActiveFilters = searchQuery || filterTriage !== 'ALL' || filterStatus !== 'ALL' || filterMedical;

  if (isLoading) return <Layout><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div></Layout>;
  if (!event) return null;
  const isEventToday = event.date === getLocalDateString();

  const VictimList = () => (
      <div className="space-y-4 h-full flex flex-col">
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-3 flex-shrink-0">
              <div className="flex gap-2">
                  <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      <input 
                          type="text" 
                          placeholder="Rechercher..." 
                          className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors text-slate-900 dark:text-white"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
                  </div>
                  <button 
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-2 rounded-lg border transition-colors ${hasActiveFilters ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`}
                  >
                      <Filter className="w-5 h-5" />
                  </button>
              </div>

              {(showFilters || hasActiveFilters) && (
                  <div className="animate-in slide-in-from-top-2 duration-200 pt-1 border-t border-slate-100 dark:border-slate-700 mt-2 space-y-3">
                      <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Statut</span>
                          <div className="flex gap-2">
                              {[{ id: 'ALL', label: 'Tout' }, { id: 'ACTIVE', label: 'En charge' }, { id: 'FINISHED', label: 'Terminés' }].map(s => (
                                  <button key={s.id} onClick={() => setFilterStatus(s.id as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${filterStatus === s.id ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-600'}`}>{s.label}</button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Triage</span>
                          <div className="flex gap-3">
                              <button onClick={() => setFilterTriage('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${filterTriage === 'ALL' ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-white text-slate-400 border-slate-200 dark:bg-slate-900 dark:border-slate-600'}`}>Tous</button>
                              <button onClick={() => setFilterTriage(TriageColor.UA)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-[10px] transition-all ${filterTriage === TriageColor.UA ? 'bg-red-600 border-red-800 text-white scale-110 shadow' : 'bg-red-100 border-red-200 text-red-800 opacity-60'}`}>UA</button>
                              <button onClick={() => setFilterTriage(TriageColor.UR)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-[10px] transition-all ${filterTriage === TriageColor.UR ? 'bg-yellow-500 border-yellow-700 text-black scale-110 shadow' : 'bg-yellow-100 border-yellow-200 text-yellow-800 opacity-60'}`}>UR</button>
                              <button onClick={() => setFilterTriage(TriageColor.UIP)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-[10px] transition-all ${filterTriage === TriageColor.UIP ? 'bg-green-600 border-green-800 text-white scale-110 shadow' : 'bg-green-100 border-green-200 text-green-800 opacity-60'}`}>UIP</button>
                              <button onClick={() => setFilterTriage(TriageColor.DCD)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-[10px] transition-all ${filterTriage === TriageColor.DCD ? 'bg-slate-800 border-black text-white scale-110 shadow' : 'bg-slate-200 border-slate-300 text-slate-600 opacity-60'}`}>DCD</button>
                          </div>
                      </div>
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2"><Stethoscope className="w-4 h-4"/> Soins Médicaux (Avancé)</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={filterMedical} onChange={e => setFilterMedical(e.target.checked)} />
                              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                          </label>
                      </div>
                      {hasActiveFilters && <div className="flex justify-end pt-2"><button onClick={clearFilters} className="text-xs text-blue-600 hover:underline">Effacer les filtres</button></div>}
                  </div>
              )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar pb-20 lg:pb-2">
              {hasActiveFilters && <div className="px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">{filteredVictims.length} résultat{filteredVictims.length > 1 ? 's' : ''}</div>}
              
              {filteredVictims.length === 0 ? (
                  <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-slate-400 italic">Aucune victime ne correspond.</p>
                      {hasActiveFilters && <button onClick={clearFilters} className="text-blue-500 text-sm mt-2 hover:underline">Voir tout</button>}
                  </div>
              ) : (
                  filteredVictims.map(victim => {
                      const stale = isVitalsStale(victim, now);
                      let borderClass = 'border-l-4 border-l-blue-500'; 
                      let outcomeBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'; 
                      if (victim.outcome === Outcome.EVACUATED_HOSPITAL) { borderClass = 'border-l-4 border-l-red-600'; outcomeBadgeClass = 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'; } 
                      else if (victim.outcome === Outcome.RELEASED) { borderClass = 'border-l-4 border-l-green-500'; outcomeBadgeClass = 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'; } 
                      else if (victim.outcome === Outcome.REFUSED_CARE) { borderClass = 'border-l-4 border-l-orange-500'; outcomeBadgeClass = 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'; } 
                      else if (victim.outcome === Outcome.DECEASED) { borderClass = 'border-l-4 border-l-slate-900'; outcomeBadgeClass = 'bg-slate-700 text-slate-100 border-slate-600 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800'; } 
                      else if (victim.triageColor) {
                           if (victim.triageColor === TriageColor.UA) borderClass = 'border-l-8 border-l-red-600';
                           else if (victim.triageColor === TriageColor.UR) borderClass = 'border-l-8 border-l-yellow-500';
                           else if (victim.triageColor === TriageColor.UIP) borderClass = 'border-l-8 border-l-green-500';
                           else if (victim.triageColor === TriageColor.DCD) borderClass = 'border-l-8 border-l-slate-900';
                      }
                      return (
                      <div key={victim.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border-t border-r border-b border-slate-200 dark:border-slate-700 ${borderClass} relative group hover:shadow-md cursor-pointer transition-all`} onClick={() => navigate(`/events/${event.id}/edit/${victim.id}`)}>
                          <div className="flex justify-between items-start mb-1 pr-8">
                              <div className="flex flex-col gap-1 w-full">
                                  <div className="flex items-center gap-2">
                                      {victim.bibNumber && <span className="bg-slate-800 text-white text-xs font-bold px-1.5 py-0.5 rounded">#{victim.bibNumber}</span>}
                                      <span className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight truncate">{victim.fullName}</span>
                                      {stale && <span title="Constantes périmées (>15min)"><AlertCircle className="w-5 h-5 text-orange-500 animate-pulse" /></span>}
                                      {victim.isAdvancedMode && <Stethoscope className="w-4 h-4 text-purple-500" />}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
                                      {victim.triageColor && <span className="font-bold px-2 py-0.5 rounded text-white bg-slate-500" style={{backgroundColor: victim.triageColor === TriageColor.UA ? '#dc2626' : victim.triageColor === TriageColor.UR ? '#eab308' : '#16a34a'}}>{victim.triageColor}</span>}
                                      <span className={`px-2 py-0.5 rounded border font-bold uppercase tracking-wide ${outcomeBadgeClass}`}>{victim.outcome}</span>
                                      {stale && <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800 flex items-center gap-1 animate-pulse uppercase tracking-tighter"><AlertCircle className="w-3 h-3"/> Re-bilan Constantes</span>}
                                  </div>
                              </div>
                          </div>
                           <div className="text-sm text-slate-600 dark:text-slate-300 mb-2 line-clamp-1">{victim.reason.includes('PLAN NOVI') ? victim.reason : victim.outcome}</div>
                           <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
                              <span>Arrivée: {safeTimeFormat(victim.arrivalTime)}</span>
                              {victim.signatureData && <Pencil className="w-3 h-3 text-green-500" />}
                           </div>
                           <button onClick={(e) => handleDeleteClick(e, victim.id)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                      </div>
                  )})
              )}
          </div>
      </div>
  );

  return (
    <Layout>
      <div className="lg:h-[calc(100vh-80px)] lg:flex lg:flex-col mt-2">
        <div className="px-1 flex-shrink-0">
             <div className="flex items-center justify-between gap-2 mb-1">
                 <h1 className="text-2xl font-bold text-slate-800 dark:text-white break-words">{event.name}</h1>
                 <div className="flex items-center gap-2">
                     <button onClick={loadData} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors hidden lg:block">
                        <RefreshCw className="w-5 h-5" />
                     </button>
                     <button onClick={() => generateEventReport(event, victims)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors">
                        <FileText className="w-5 h-5" />
                     </button>
                     {profile?.role === 'admin' && (
                        <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors">
                            <Settings className="w-5 h-5" />
                        </button>
                     )}
                 </div>
             </div>
             <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400"><span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {safeDateFormat(event.date)}</span><span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {event.location}</span></div>
        </div>

        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg relative overflow-hidden cursor-pointer mt-4 flex-shrink-0" onClick={() => setIsResourceModalOpen(true)}>
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2"><Bed className="w-4 h-4" /> Occupation Poste</h3>
                <Settings className="w-4 h-4 opacity-50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="flex justify-between text-xs mb-1 text-slate-400"><span>Brancards</span><span>{stats.stretchersOccupied} / {totalStretchers}</span></div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${totalStretchers > 0 && stats.stretchersOccupied >= totalStretchers ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: totalStretchers > 0 ? `${Math.min((stats.stretchersOccupied/totalStretchers)*100, 100)}%` : '0%' }}></div>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs mb-1 text-slate-400"><span>Chaises/Assis</span><span>{stats.chairsOccupied} / {totalChairs}</span></div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${totalChairs > 0 && stats.chairsOccupied >= totalChairs ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: totalChairs > 0 ? `${Math.min((stats.chairsOccupied/totalChairs)*100, 100)}%` : '0%' }}></div>
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4 flex-shrink-0">
             <Button 
                 onClick={handleAddVictimClick} 
                 icon={<UserPlus />} 
                 fullWidth 
                 disabled={!(isEventToday || profile?.role === 'admin')} 
                 variant={(isEventToday || profile?.role === 'admin') ? "primary" : "outline"}
             >
                 {isEventToday ? "Victime" : (profile?.role === 'admin' ? "Victime (Admin)" : "Clos")}
             </Button>
             <Button 
                 onClick={() => setIsNoviModalOpen(true)} 
                 icon={<Siren className="w-4 h-4 text-white" />} 
                 fullWidth 
                 disabled={!(isEventToday || profile?.role === 'admin')} 
                 className={(isEventToday || profile?.role === 'admin') ? "bg-red-700 hover:bg-red-800 text-white border-none shadow-red-700/20 font-black tracking-wide" : "bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700 font-black tracking-wide cursor-not-allowed"}
             >
                 PLAN NOVI
             </Button>
        </div>
        
        {/* LISTE VICTIMES (PLEINE PAGE) */}
        <div className="flex-1 flex flex-col min-h-0 mt-4 relative">
            <VictimList />
        </div>
      </div>

      <ResponderModal 
        isOpen={isResponderModalOpen} 
        onConfirm={handleResponderConfirm} 
        onCancel={() => setIsResponderModalOpen(false)}
        teamsList={config?.teams || []} 
      />
      <NoviModal isOpen={isNoviModalOpen} eventId={event.id} onClose={() => setIsNoviModalOpen(false)} onVictimAdded={(v) => setVictims(prev => [v, ...prev])} />
      <ResourceModal isOpen={isResourceModalOpen} config={event.resourceConfig || {totalStretchers: 0, totalChairs: 0}} onSave={saveResourceConfig} onCancel={() => setIsResourceModalOpen(false)} />
      
      <EventSettingsModal 
        isOpen={isSettingsModalOpen} 
        event={event} 
        onClose={() => setIsSettingsModalOpen(false)} 
        onSave={(updated) => { setEvent(updated); setIsSettingsModalOpen(false); }} 
      />

      <ConfirmDialog isOpen={!!deleteId} title="Supprimer la victime ?" message="Cette action est irréversible." onConfirm={handleConfirmDelete} onCancel={cancelDelete} isLoading={isDeleting} />
    </Layout>
  );
};
