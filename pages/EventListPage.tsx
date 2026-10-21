
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { storageService } from '../services/storageService';
import { syncService } from '../services/syncService';
import { isLive } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Event } from '../types';
import { safeDateFormat, getLocalDateString } from '../utils/security';
import { Calendar, ChevronRight, MapPin, Loader2, Trash2, Search, X, Filter, PlusCircle, Archive, ArchiveRestore, Download, Check, AlertTriangle, FileSpreadsheet, RefreshCw } from 'lucide-react';

export const EventListPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // RESTRICTION : Organisateur ne peut pas accéder à la liste des événements
  useEffect(() => {
    if (profile?.role === 'organisateur') {
      navigate('/tactical', { replace: true });
    }
  }, [profile, navigate]);
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false); 
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'FINISHED'>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  
  // Action states
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // States pour téléchargement hors-ligne local (~10km)
  const [downloadingEventId, setDownloadingEventId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState({ downloaded: 0, total: 0, percent: 0, currentUrl: '' });
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const listAbortControllerRef = useRef<AbortController | null>(null);
  const hasInitialLoadedRef = useRef(false);
  const listDebounceTimerRef = useRef<any>(null);

  const handleDownloadOfflineClick = async (e: React.MouseEvent, event: Event) => {
    e.stopPropagation();
    if (!navigator.onLine) {
      setDownloadingEventId(event.id);
      setDownloadError("Mode hors-ligne / avion actif : connectez-vous à Internet pour télécharger cette carte.");
      setTimeout(() => {
        setDownloadingEventId(null);
        setDownloadError(null);
      }, 4000);
      return;
    }

    setDownloadingEventId(event.id);
    setDownloadProgress({ downloaded: 0, total: 0, percent: 0, currentUrl: '' });
    setDownloadSuccess(false);
    setDownloadError(null);
    const controller = new AbortController();
    listAbortControllerRef.current = controller;
    
    try {
      const { getEventCoordinates, generateLocalEventTileUrls, downloadTileUrls } = await import('../services/offlineMapService');
      const coords = getEventCoordinates(event);
      const urls = generateLocalEventTileUrls(coords.lat, coords.lng);
      
      if (urls.length === 0) {
        throw new Error("Aucune tuile de carte disponible pour cette localisation.");
      }
      
      await downloadTileUrls(urls, (prog) => {
        setDownloadProgress({
          downloaded: prog.downloaded,
          total: prog.total,
          percent: prog.percent,
          currentUrl: prog.currentUrl || ''
        });
      }, controller.signal);
      
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadingEventId(null);
        setDownloadSuccess(false);
      }, 4000);
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        console.log("Téléchargement de carte d'événement annulé.");
        setDownloadError("Téléchargement de la carte annulé.");
      } else {
        console.error("Local map download failed from list:", err);
        setDownloadError(err?.message || "Le téléchargement d'urgence a échoué.");
      }
      setTimeout(() => {
        setDownloadingEventId(null);
        setDownloadError(null);
      }, 5000);
    } finally {
      listAbortControllerRef.current = null;
    }
  };

  const handleCancelListDownload = () => {
    if (listAbortControllerRef.current) {
        listAbortControllerRef.current.abort();
    }
  };

  const loadEvents = async (silent: boolean = false) => {
    if (!silent && !hasInitialLoadedRef.current) {
      setIsLoading(true);
    }
    let data: Event[] = [];
    
    if (showArchived) {
        data = await storageService.getArchivedEvents();
    } else {
        data = await storageService.getEvents();
        // Si la liste est vide et qu'on est en ligne, tentative de chargement immédiat depuis Supabase
        if (data.length === 0 && isLive && navigator.onLine) {
            try {
                await syncService.pullEvents();
                data = await storageService.getEvents();
            } catch (e) {
                console.warn("[EventListPage] Auto-pull on empty events failed:", e);
            }
        }
    }
    
    const today = getLocalDateString();

    const sortedData = data.sort((a, b) => {
      const aIsToday = a.date === today;
      const bIsToday = b.date === today;

      // Logique pour liste active (non archivée)
      if (!showArchived) {
          if (aIsToday && !bIsToday) return -1;
          if (!aIsToday && bIsToday) return 1;
          const dateCompare = a.date.localeCompare(b.date);
          if (dateCompare !== 0) return dateCompare;
          return b.createdAt - a.createdAt;
      }

      // Logique pour Archives : Date DÉCROISSANTE (Plus récent en haut)
      const dateCompareDesc = b.date.localeCompare(a.date);
      if (dateCompareDesc !== 0) return dateCompareDesc;
      return b.createdAt - a.createdAt;
    });

    setEvents(sortedData);
    setIsLoading(false);
    hasInitialLoadedRef.current = true;
  };

  useEffect(() => {
    hasInitialLoadedRef.current = false;
    loadEvents();
    
    // Déclenchement d'un rafraîchissement silencieux immédiat et léger en tâche de fond (<15Ko)
    if (navigator.onLine && isLive) {
      syncService.pullEvents().then(() => loadEvents(true)).catch(() => {});
    }

    const debouncedLoadEvents = () => {
      if (listDebounceTimerRef.current) clearTimeout(listDebounceTimerRef.current);
      listDebounceTimerRef.current = setTimeout(() => {
        loadEvents(true);
      }, 150);
    };

    // Écoute des mises à jour en temps réel des événements
    const bc = new BroadcastChannel('dps65_events_channel');
    bc.onmessage = (e) => {
      if (e.data.type === 'UPDATE_EVENTS' || e.data.type === 'UPDATE_MISSIONS') {
        debouncedLoadEvents();
      }
    };

    // Synchronisation en direct avec le service de synchronisation
    const unsubSync = syncService.subscribe(() => {
      debouncedLoadEvents();
    });

    // Rechargement au retour sur l'onglet (iPhone iOS Safari / Android)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        debouncedLoadEvents();
        if (navigator.onLine && isLive) {
          syncService.pullEvents().then(() => loadEvents(true)).catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      if (listDebounceTimerRef.current) clearTimeout(listDebounceTimerRef.current);
      bc.close();
      unsubSync();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [showArchived]);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const handleArchiveClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setArchiveId(id);
  };

  const executeDeletion = async () => {
    if (!deleteId) return;

    setIsProcessing(true);
    try {
      await storageService.deleteEvent(deleteId);
      setEvents(prev => prev.filter(e => e.id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error("Failed to delete event", error);
      alert("Échec de la suppression. Veuillez réessayer.");
    } finally {
      setIsProcessing(false);
    }
  };

  const executeArchive = async () => {
    if (!archiveId) return;

    setIsProcessing(true);
    try {
      await storageService.archiveEvent(archiveId);
      setEvents(prev => prev.filter(e => e.id !== archiveId));
      setArchiveId(null);
    } catch (error) {
      console.error("Failed to archive event", error);
      alert("Échec de l'archivage.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnarchiveClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await storageService.unarchiveEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error("Failed to unarchive event", error);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('');
    setStatusFilter('ALL');
    setShowFilters(false);
  };

  // Filter logic
  const filteredEvents = events.filter(event => {
    const today = getLocalDateString();
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      event.name.toLowerCase().includes(searchLower) ||
      event.location.toLowerCase().includes(searchLower);
      
    const matchesDate = dateFilter ? event.date === dateFilter : true;
    
    let matchesStatus = true;
    if (statusFilter === 'ACTIVE') matchesStatus = event.date === today;
    else if (statusFilter === 'UPCOMING') matchesStatus = event.date > today;
    else if (statusFilter === 'FINISHED') matchesStatus = event.date < today;

    return matchesSearch && matchesDate && matchesStatus;
  });

  const getEventStatus = (eventDate: string) => {
    const today = getLocalDateString();
    if (showArchived) {
        return { label: 'Archivé', className: 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' };
    }
    if (eventDate === today) {
      return { label: 'En cours', className: 'text-green-700 bg-green-50 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' };
    } else if (eventDate < today) {
      return { label: 'Terminé', className: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' };
    } else {
      return { label: 'À venir', className: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' };
    }
  };

  const hasActiveFilters = searchQuery || dateFilter || statusFilter !== 'ALL';

  return (
    <Layout>
      <div className="space-y-4 mt-2">
        
        {/* HEADER FLEXIBLE AVEC TOGGLE ARCHIVE INTEGRE */}
        <div className="flex items-center justify-between px-1">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              {showArchived ? <ArchiveRestore className="text-slate-500 w-6 h-6" /> : null}
              {showArchived ? 'Archives' : 'Événements'}
            </h1>
            
            {isAdmin && (
              <button 
                  onClick={() => {
                      if(showArchived) setStatusFilter('ALL');
                      setShowArchived(!showArchived);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      showArchived 
                      ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' 
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300'
                  }`}
              >
                  {showArchived ? (
                      <>Voir Actifs <ChevronRight className="w-3 h-3" /></>
                  ) : (
                      <><Archive className="w-3 h-3" /> Archives</>
                  )}
              </button>
            )}
        </div>
        
        {/* ACTION PRINCIPALE : CRÉER (ADMIN SEULEMENT) */}
        {!showArchived && isAdmin && (
            <div className="animate-in slide-in-from-top-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Button 
                    onClick={() => navigate('/create-event')}
                    variant="primary" 
                    icon={<PlusCircle className="w-5 h-5" />}
                    fullWidth
                    className="py-4 text-base sm:text-lg shadow-blue-500/20"
                >
                    Créer un événement rapide
                </Button>

                {/* BOUTON BUREAU : CONVENTIONS & GRILLE DES RISQUES */}
                <Button 
                    onClick={() => navigate('/desktop/conventions')}
                    variant="outline" 
                    icon={<FileSpreadsheet className="w-5 h-5 text-emerald-600" />}
                    fullWidth
                    className="hidden lg:flex py-4 text-base font-bold border-2 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                >
                    Conventions &amp; Grille des Risques (PC)
                </Button>
            </div>
        )}

        {/* Search & Filter Section */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-3 transition-colors">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input 
                type="text"
                placeholder="Rechercher nom ou lieu..."
                className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors text-slate-900 dark:text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button 
              onClick={async () => {
                if (isRefreshing) return;
                setIsRefreshing(true);
                await syncService.pullEvents();
                await loadEvents();
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
              className="p-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="Actualiser les événements"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
            </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border transition-colors ${showFilters || dateFilter || statusFilter !== 'ALL' ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              title="Filtres"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {(showFilters || dateFilter || statusFilter !== 'ALL') && (
            <div className="animate-in slide-in-from-top-2 duration-200 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3 mt-1">
               {/* STATUS FILTER */}
               <div className="flex gap-2 overflow-x-auto pb-1">
                   {[
                       { id: 'ALL', label: 'Tout' },
                       { id: 'ACTIVE', label: 'En cours' },
                       { id: 'UPCOMING', label: 'À venir' },
                       { id: 'FINISHED', label: 'Terminé' }
                   ].map((s) => (
                       <button
                            key={s.id}
                            onClick={() => setStatusFilter(s.id as any)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${statusFilter === s.id 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                       >
                           {s.label}
                       </button>
                   ))}
               </div>

               {/* DATE FILTER */}
               <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                 <Calendar className="w-4 h-4 text-slate-500" />
                 <span className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">Date précise :</span>
                 <input 
                   type="date"
                   className="bg-transparent border-none focus:ring-0 text-sm text-slate-800 dark:text-slate-200 w-full cursor-pointer dark:[color-scheme:dark]"
                   value={dateFilter}
                   onChange={(e) => setDateFilter(e.target.value)}
                 />
                 {dateFilter && (
                    <button onClick={() => setDateFilter('')} className="text-slate-400 hover:text-slate-600 p-1">
                      <X className="w-4 h-4" />
                    </button>
                 )}
               </div>
            </div>
          )}
        </div>

        {/* Results Info */}
        {hasActiveFilters && (
            <div className="flex justify-between items-center px-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {filteredEvents.length} résultat{filteredEvents.length !== 1 ? 's' : ''}
                </span>
                <button onClick={clearFilters} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">
                    Effacer les filtres
                </button>
            </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
            <p className="text-slate-500 dark:text-slate-400 mb-4">
                {hasActiveFilters ? "Aucun événement ne correspond à vos critères." : (showArchived ? "Aucune archive trouvée." : "Aucun événement.")}
            </p>
            {!hasActiveFilters && !showArchived && isAdmin ? (
                <button 
                  onClick={() => navigate('/create-event')}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  Créer votre premier événement
                </button>
            ) : hasActiveFilters ? (
                <button 
                  onClick={clearFilters}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  Effacer les filtres
                </button>
            ) : null}
          </div>
        ) : (
          filteredEvents.map(event => {
            const status = getEventStatus(event.date);
            return (
            <div 
              key={event.id}
              onClick={() => navigate(`/events/${event.id}`)}
              className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group flex justify-between items-center relative"
            >
              <div className="flex-1 pr-10">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                    {event.name}
                    </h3>
                </div>
                
                <div className="flex flex-col gap-2 mt-2">
                   <div className="flex items-center gap-2">
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${status.className}`}>
                        {status.label}
                       </span>
                   </div>
                   <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {safeDateFormat(event.date)}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {event.location}
                        </span>
                   </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* DOWNLOAD LOCAL MAP BUTTON */}
                <button
                    onClick={(e) => handleDownloadOfflineClick(e, event)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors z-10"
                    title="Télécharger la carte locale (~10km)"
                    id={`btn-download-list-${event.id}`}
                >
                    <Download className="w-5 h-5" />
                </button>

                {/* ARCHIVE / UNARCHIVE BUTTON - ADMIN ONLY */}
                {isAdmin && !showArchived && (
                    <button
                        onClick={(e) => handleArchiveClick(e, event.id)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors z-10"
                        title="Archiver l'événement"
                    >
                        <Archive className="w-5 h-5" />
                    </button>
                )}
                {isAdmin && showArchived && (
                    <button
                        onClick={(e) => handleUnarchiveClick(e, event.id)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-full transition-colors z-10"
                        title="Désarchiver l'événement"
                    >
                        <ArchiveRestore className="w-5 h-5" />
                    </button>
                )}

                {/* DELETE BUTTON - ADMIN OR LOCAL MODE ONLY */}
                {(isAdmin || !isLive) && (
                    <button
                      onClick={(e) => handleDeleteClick(e, event.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors z-10"
                      title="Supprimer l'événement (Irréversible)"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                )}
                
                <ChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Overlay/Modal de téléchargement hors-ligne local */}
      {downloadingEventId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-6 relative max-h-[95vh] overflow-y-auto transform scale-100 transition-all duration-300">
                {!downloadSuccess && !downloadError && (
                    <div className="py-2 flex flex-col items-center text-center">
                        <div className="relative mb-6">
                            <div className="w-20 h-20 rounded-full border-4 border-slate-100 dark:border-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner animate-pulse">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                            <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1.5 shadow-md">
                                <Download className="w-4 h-4" />
                            </span>
                        </div>

                        <h4 className="font-extrabold text-lg text-slate-900 dark:text-white mb-2 leading-tight">
                            Téléchargement de la carte...
                        </h4>
                        
                        <p className="text-xs text-slate-500 mb-6 font-bold uppercase tracking-widest">
                            Ne fermez pas l'application
                        </p>

                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mb-4 border border-slate-200/50 dark:border-slate-700">
                            <div 
                                className="h-full bg-blue-600 rounded-full transition-all duration-300 shadow-md"
                                style={{ width: `${downloadProgress.percent}%` }}
                            ></div>
                        </div>

                        <div className="flex justify-between w-full text-xs font-black text-slate-500 mb-1">
                            <span>{downloadProgress.percent}%</span>
                            <span className="font-mono">{downloadProgress.downloaded} / {downloadProgress.total} tuiles</span>
                        </div>

                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono italic max-w-full truncate bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-900/60 w-full text-center">
                            {downloadProgress.currentUrl || 'Préparation...'}
                        </p>

                        <button
                            onClick={handleCancelListDownload}
                            className="mt-5 px-5 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-bold rounded-2xl text-xs transition-colors shadow-sm outline-none w-full"
                        >
                            Annuler le téléchargement
                        </button>
                    </div>
                )}

                {downloadSuccess && (
                    <div className="py-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 ring-8 ring-emerald-500/10">
                            <Check className="w-12 h-12" />
                        </div>

                        <h4 className="font-black text-xl text-slate-800 dark:text-white mb-2 leading-tight">
                            Carte enregistrée !
                        </h4>

                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mb-4 leading-relaxed font-semibold">
                            Le secteur de 10km autour de l'événement est désormais présent localement sur votre téléphone.
                        </p>

                        <span className="inline-block bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300">
                            Prête pour l'intervention en Zone Blanche (Zooms 11 à 16).
                        </span>
                    </div>
                )}

                {downloadError && (
                    <div className="py-4 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
                            Échec du téléchargement
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            {downloadError}
                        </p>
                        <button
                            onClick={() => setDownloadingEventId(null)}
                            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs transition-colors shadow-sm outline-none w-full"
                        >
                            Fermer
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={!!deleteId}
        title="Supprimer l'événement ?"
        message="Cette action est irréversible. Toutes les victimes associées seront supprimées."
        onConfirm={executeDeletion}
        onCancel={() => setDeleteId(null)}
        isLoading={isProcessing}
      />

      <ConfirmDialog 
        isOpen={!!archiveId}
        title="Archiver l'événement ?"
        message="L'événement sera déplacé dans les archives et ne sera plus visible sur la liste active des autres utilisateurs."
        onConfirm={executeArchive}
        onCancel={() => setArchiveId(null)}
        isLoading={isProcessing}
      />
    </Layout>
  );
};
