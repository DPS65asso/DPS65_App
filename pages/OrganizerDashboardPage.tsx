import React, { useEffect, useState, Suspense, lazy, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { storageService } from '../services/storageService';
import { Event, Victim, TriageColor, Outcome } from '../types';
import { 
  Phone, ShieldAlert, Activity, Bed, Users, RefreshCw, FileText, 
  Map as MapIcon, X, AlertCircle, Loader2, LogOut, Search, Clock, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

const EventMap = lazy(() => import('../components/EventMap').then(module => ({ default: module.EventMap })));

export const OrganizerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [victims, setVictims] = useState<Victim[]>([]);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [showPdf, setShowPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTriage, setSelectedTriage] = useState<string>('ALL');

  // Déterminer l'ID de l'événement à partir de la session de l'organisateur
  const eventId = useMemo(() => {
    const sessionKey = 'dps65_active_user_id';
    const storedId = localStorage.getItem(sessionKey);
    if (storedId && storedId.startsWith('temp-organizer-')) {
      return storedId.replace('temp-organizer-', '');
    }
    return '';
  }, []);

  const refreshData = async () => {
    if (!eventId) return;
    setIsLoading(true);
    try {
      // Tenter un pull léger via syncService si possible
      try {
        const { syncService } = await import('../services/syncService');
        await syncService.pullLatestData();
      } catch (err) {
        console.warn("Pull auto failed, loading locally:", err);
      }
      
      const updatedVictims = await storageService.getVictimsByEvent(eventId);
      setVictims(updatedVictims);
      
      const allEvents = await storageService.getEvents();
      const currentEvt = allEvents.find(e => e.id === eventId);
      if (currentEvt) {
        setEvent(currentEvt);
      }
      
      setLastRefresh(Date.now());
    } catch (e) {
      console.error("Failed to refresh organizer dashboard", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!eventId) {
      navigate('/login', { replace: true });
      return;
    }

    refreshData();

    // Ecouteur en temps réel pour synchroniser les victimes
    const bc = new BroadcastChannel('dps65_victims_channel');
    bc.onmessage = (e) => {
      if (e.data.type === 'UPDATE_VICTIMS') {
        refreshData();
      }
    };

    // Polling régulier de secours toutes les 15 secondes
    const interval = setInterval(refreshData, 15000);

    return () => {
      clearInterval(interval);
      bc.close();
    };
  }, [eventId]);

  const allPdfs = useMemo(() => {
    return event?.mapPdfs && event.mapPdfs.length > 0
      ? event.mapPdfs
      : event?.mapPdfUrl
        ? [{ id: 'primary', name: 'Plan principal.pdf', url: event.mapPdfUrl }]
        : [];
  }, [event]);

  const [activePdfIndex, setActivePdfIndex] = useState(0);
  const activeMapPdfUrl = useMemo(() => allPdfs[activePdfIndex]?.url, [allPdfs, activePdfIndex]);

  // Filtrage et recherche de la liste des victimes (Module D)
  const filteredVictims = useMemo(() => {
    return victims
      .filter(v => {
        const matchesSearch = v.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (v.bibNumber && v.bibNumber.includes(searchQuery));
        
        if (selectedTriage === 'ALL') return matchesSearch;
        if (selectedTriage === 'UA') return matchesSearch && v.triageColor === TriageColor.UA;
        if (selectedTriage === 'UR') return matchesSearch && v.triageColor === TriageColor.UR;
        if (selectedTriage === 'ACTIF') return matchesSearch && v.outcome === Outcome.TREATMENT_IN_PROGRESS;
        return matchesSearch;
      })
      .sort((a, b) => new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime());
  }, [victims, searchQuery, selectedTriage]);

  // Statistiques de l'événement (Module A)
  const stats = useMemo(() => {
    const total = victims.length;
    const ua = victims.filter(v => v.triageColor === TriageColor.UA).length;
    const ur = victims.filter(v => v.triageColor === TriageColor.UR).length;
    const uip = victims.filter(v => v.triageColor === TriageColor.UIP).length;
    const active = victims.filter(v => v.outcome === Outcome.TREATMENT_IN_PROGRESS).length;
    return { total, ua, ur, uip, active };
  }, [victims]);

  const handleLogout = async () => {
    if (window.confirm("Voulez-vous vous déconnecter du suivi organisateur ?")) {
      await signOut();
      navigate('/login');
    }
  };

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Chargement de votre événement...</p>
      </div>
    );
  }

  return (
    <Layout title={null} hideHeaderTools hideSync>
      {/* Conteneur principal indépendant */}
      <div className="text-slate-900 dark:text-white space-y-6">
        
        {/* BANNIÈRE D'EN-TÊTE PREMIUM */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-orange-500/20 text-orange-500 p-4 rounded-2xl border border-orange-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] bg-orange-500/20 text-orange-500 border border-orange-500/30 px-2.5 py-1 rounded-full uppercase font-black tracking-widest inline-block mb-1.5 animate-pulse">
                Accès Restreint Organisateur
              </span>
              <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight uppercase leading-none">
                {event.name}
              </h1>
              <p className="text-slate-400 text-sm mt-1.5 flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-orange-500" />
                {event.location} • {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-3">
            {/* BOUTON RAFFRAICHIR AVEC ANIMATION */}
            <button 
              onClick={refreshData}
              disabled={isLoading}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold px-4 py-3 rounded-2xl border border-slate-700 transition-all cursor-pointer shadow-sm text-sm"
              title="Mettre à jour les données"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-orange-500' : ''}`} />
              <span>Rafraîchir</span>
            </button>

            {/* BOUTON APPELER CHEF DE DISPOSITIF */}
            {event.supervisorPhone ? (
              <a 
                href={`tel:${event.supervisorPhone}`}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-3 rounded-2xl border border-red-500 hover:border-red-400 transition-all cursor-pointer shadow-lg hover:shadow-red-500/20 text-sm uppercase tracking-wider"
              >
                <Phone className="w-4 h-4 fill-current animate-bounce" />
                <span>Appeler le Chef ({event.supervisorName || 'Site'})</span>
              </a>
            ) : (
              <div className="flex items-center gap-2 bg-slate-800 text-slate-500 font-bold px-4 py-3 rounded-2xl border border-slate-700 text-sm">
                <Phone className="w-4 h-4" />
                <span>Aucun numéro chef renseigné</span>
              </div>
            )}

            {/* DECONNEXION */}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 bg-slate-800 hover:bg-red-950/40 hover:text-red-400 hover:border-red-500/30 text-white font-bold px-4 py-3 rounded-2xl border border-slate-700 transition-all cursor-pointer text-sm"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* METRICS & CHARTS (Module A) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-black uppercase tracking-wider block mb-1">Total Victimes</span>
              <span className="text-4xl font-black text-white">{stats.total}</span>
            </div>
            <div className="bg-slate-800 p-3 rounded-xl text-slate-300">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-red-950/40 p-5 rounded-2xl shadow-xl flex items-center justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-600"></div>
            <div>
              <span className="text-red-400 text-xs font-black uppercase tracking-wider block mb-1">Urgences Absolues</span>
              <span className="text-4xl font-black text-red-500">{stats.ua}</span>
            </div>
            <div className="bg-red-500/10 p-3 rounded-xl text-red-500">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="bg-slate-900 border border-yellow-950/40 p-5 rounded-2xl shadow-xl flex items-center justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-yellow-500"></div>
            <div>
              <span className="text-yellow-400 text-xs font-black uppercase tracking-wider block mb-1">Urgences Relatives</span>
              <span className="text-4xl font-black text-yellow-500">{stats.ur}</span>
            </div>
            <div className="bg-yellow-500/10 p-3 rounded-xl text-yellow-500">
              <Activity className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-teal-500"></div>
            <div>
              <span className="text-teal-400 text-xs font-black uppercase tracking-wider block mb-1">Actifs au Poste</span>
              <span className="text-4xl font-black text-teal-400">{stats.active}</span>
            </div>
            <div className="bg-teal-500/10 p-3 rounded-xl text-teal-400">
              <Bed className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* DYNAMIC PROGRESS ACCENT (Part of Module A) */}
        {stats.total > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3">Répartition de la Gravité des Prises en Charge</h3>
            <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex">
              <div 
                style={{ width: `${(stats.ua / stats.total) * 100}%` }} 
                className="bg-red-600 h-full transition-all duration-500"
                title={`UA: ${stats.ua}`}
              ></div>
              <div 
                style={{ width: `${(stats.ur / stats.total) * 100}%` }} 
                className="bg-yellow-500 h-full transition-all duration-500"
                title={`UR: ${stats.ur}`}
              ></div>
              <div 
                style={{ width: `${((stats.total - stats.ua - stats.ur) / stats.total) * 100}%` }} 
                className="bg-green-600 h-full transition-all duration-500"
                title={`Autres / EU: ${stats.total - stats.ua - stats.ur}`}
              ></div>
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-red-500">
                <span className="w-2.5 h-2.5 bg-red-600 rounded-full block"></span>
                <span>Urgence Absolue (UA) : {Math.round((stats.ua / stats.total) * 100)}%</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-yellow-500">
                <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full block"></span>
                <span>Urgence Relative (UR) : {Math.round((stats.ur / stats.total) * 100)}%</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-green-500">
                <span className="w-2.5 h-2.5 bg-green-600 rounded-full block"></span>
                <span>Léger/Autres : {Math.round(((stats.total - stats.ua - stats.ur) / stats.total) * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLES DE LA CARTOGRAPHIE ET DU PLAN (Module C) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-bold text-slate-300 uppercase">Cartographie Tactique de l'événement</span>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setShowMap(!showMap)} 
              className={`flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${showMap ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              <MapIcon className="w-4 h-4" />
              <span>{showMap ? "Masquer la Carte" : "Afficher la Carte"}</span>
            </button>

            {allPdfs.length > 0 && (
              <button 
                onClick={() => setShowPdf(!showPdf)} 
                className={`flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${showPdf ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                <FileText className="w-4 h-4" />
                <span>{showPdf ? "Masquer Plan PDF" : `Plan PDF (${allPdfs.length})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* CARTE TACTIQUE INTERACTIVE (Module C) */}
        <AnimatePresence>
          {showMap && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-3xl overflow-hidden border-2 border-orange-500/30 shadow-2xl relative h-[450px] bg-slate-950"
            >
              <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-400 uppercase font-black tracking-widest text-xs"><Loader2 className="w-8 h-8 animate-spin text-orange-500 mr-2" /> Chargement de la carte...</div>}>
                <EventMap eventId={eventId} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PDF VIEWER (Module C) */}
        <AnimatePresence>
          {showPdf && activeMapPdfUrl && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-900 border-2 border-red-500/40 rounded-3xl overflow-hidden shadow-2xl relative h-[700px] flex flex-col"
            >
              {allPdfs.length > 1 && (
                <div className="bg-slate-850 p-3 border-b border-red-500/20 flex gap-2 overflow-x-auto scrollbar-thin">
                  {allPdfs.map((pdf, idx) => (
                    <button
                      key={pdf.id || idx}
                      onClick={() => setActivePdfIndex(idx)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        activePdfIndex === idx
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                          : 'bg-slate-850 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      {pdf.name || `Plan ${idx + 1}`}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex-1 bg-slate-950">
                <iframe 
                  src={activeMapPdfUrl} 
                  className="w-full h-full border-none"
                  title="Plan de cartographie"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LISTE ET RECHERCHE DES VICTIMES (Module D) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Registre des Victimes (Temps Réel)</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Mise à jour automatique • {filteredVictims.length} victime(s) filtrée(s)
              </p>
            </div>

            {/* BARRE DE RECHERCHE */}
            <div className="relative max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Rechercher par nom ou dossard..." 
                className="w-full bg-slate-800 border border-slate-700 text-white pl-11 pr-4 py-3 rounded-2xl outline-none focus:border-orange-500 transition-all font-medium placeholder-slate-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* FILTRES RAPIDES */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'Toutes', count: stats.total, color: 'bg-slate-800 text-slate-300' },
              { id: 'UA', label: 'Urgences Absolues', count: stats.ua, color: 'bg-red-600/20 text-red-400 border border-red-500/30' },
              { id: 'UR', label: 'Urgences Relatives', count: stats.ur, color: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' },
              { id: 'ACTIF', label: 'Au Poste (En cours)', count: stats.active, color: 'bg-teal-500/10 text-teal-400 border border-teal-500/20' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setSelectedTriage(filter.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  selectedTriage === filter.id 
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-105' 
                    : 'bg-slate-850 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span>{filter.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${selectedTriage === filter.id ? 'bg-white text-orange-600' : 'bg-slate-800 text-slate-300'}`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>

          {/* LISTE DES VICTIMES AVEC ANIMATION DE GRILLE */}
          {filteredVictims.length > 0 ? (
            <motion.div 
              layout
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {filteredVictims.map(v => (
                  <motion.div
                    key={v.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`p-5 rounded-2xl border-2 shadow-lg relative overflow-hidden transition-all ${
                      v.triageColor === TriageColor.UA 
                        ? 'bg-red-950/40 border-red-900 hover:border-red-700' 
                        : v.triageColor === TriageColor.UR 
                          ? 'bg-yellow-950/20 border-yellow-900 hover:border-yellow-700' 
                          : 'bg-slate-850 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Indicateur vertical gauche */}
                    <div className={`absolute left-0 top-0 bottom-0 w-2.5 ${
                      v.triageColor === TriageColor.UA 
                        ? 'bg-red-600 animate-pulse' 
                        : v.triageColor === TriageColor.UR 
                          ? 'bg-yellow-500' 
                          : 'bg-green-600'
                    }`}></div>

                    <div className="pl-3">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-col">
                          <span className="text-3xl font-black text-white leading-none tracking-tight mb-1">
                            {v.bibNumber || '---'}
                          </span>
                          <span className="text-sm font-bold text-slate-300 truncate w-44">
                            {v.fullName}
                          </span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shadow-sm ${
                          v.triageColor === TriageColor.UA 
                            ? 'bg-red-600 text-white' 
                            : v.triageColor === TriageColor.UR 
                              ? 'bg-yellow-500 text-black' 
                              : 'bg-green-600 text-white'
                        }`}>
                          {v.triageColor || 'NOVI'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 border-t border-white/10 pt-3 mt-3 space-y-1.5 font-medium">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Prise en charge :</span>
                          <span className="text-slate-300">{new Date(v.arrivalTime).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Équipe d'intervention :</span>
                          <span className="text-slate-300 font-bold">{v.responderTeam || 'Non assignée'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Statut / Devenir :</span>
                          <span className={`font-bold ${v.outcome === Outcome.TREATMENT_IN_PROGRESS ? 'text-teal-400' : 'text-slate-300'}`}>
                            {v.outcome || 'Traitement en cours'}
                          </span>
                        </div>
                      </div>

                      {v.isAdvancedMode && (
                        <div className="mt-3.5 text-[9px] text-purple-300 bg-purple-900/50 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider border border-purple-700/50 block text-center animate-pulse">
                          🚨 SOINS MÉDICAUX (IDE/MED) EN COURS
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="bg-slate-850 rounded-2xl p-8 text-center border border-slate-800">
              <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">Aucune victime trouvée</p>
              <p className="text-slate-500 text-sm mt-1">Aucune fiche de victime ne correspond aux filtres de recherche.</p>
            </div>
          )}
        </div>

        {/* PIED DE PAGE DISCRET */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase tracking-widest px-4">
          <span>Mode Organisateur • Suivi DPS65</span>
          <span>Dernière synchro: {new Date(lastRefresh).toLocaleTimeString()}</span>
        </div>

      </div>
    </Layout>
  );
};
