
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { EmergencyGuide } from '../components/EmergencyGuide';
import { storageService } from '../services/storageService';
import { geoService } from '../services/geoService';
import { bagService } from '../services/bagService';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Loader2, RefreshCw, HeartPulse, Settings, MapPin, QrCode, Users, Radio, Briefcase, ChevronRight, Power, Shield, Stethoscope, ShieldAlert, FlaskConical, User, GraduationCap, Package, Phone } from 'lucide-react';
import { AppConfig, Bag, UserRole, Event as DpsEvent } from '../types';
import { generateUUID, getLocalDateString } from '../utils/security';
import { useWakeLock } from '../hooks/useWakeLock';
import { SyncIndicator } from '../components/SyncIndicator';
import { syncService } from '../services/syncService';
import { useNewContent } from '../context/NewContentContext';
import { NewContentBadge } from '../components/NewContentBadge';

// Mapping local pour l'affichage
const BAG_LABELS: Record<string, string> = {
    'LOT_A': 'Lot A (PMA)',
    'LOT_B': 'Lot B (Léger)',
    'LOT_C': 'Lot C (Oxygène)',
    'SAC_IDE': 'Sac IDE (Médical)'
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, currentTeam, setSessionTeam, isAdmin, refreshProfile } = useAuth();
  const { badges } = useNewContent();
  const hasPortalBadges = badges.missions || badges.fleet || badges.material || badges.courses || badges.docs;

  // Redirection automatique pour les organisateurs
  useEffect(() => {
    if (profile?.role === 'organisateur') {
      navigate('/tactical', { replace: true });
    }
  }, [profile, navigate]);
  const [showEmergency, setShowEmergency] = useState(false);
  
  const [isTracking, setIsTracking] = useState(false);
  const [showStopTrackingConfirm, setShowStopTrackingConfirm] = useState(false); 
  const [showEndServiceConfirm, setShowEndServiceConfirm] = useState(false); 
  const [showTeamSelect, setShowTeamSelect] = useState(false);
  const [showBagSelect, setShowBagSelect] = useState(false); 
  const [availableBags, setAvailableBags] = useState<Bag[]>([]); 
  const [loadingBags, setLoadingBags] = useState(false); 
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [todayEvent, setTodayEvent] = useState<DpsEvent | null>(null);
  
  // État pour le sac actif
  const [currentBag, setCurrentBag] = useState<Bag | null>(null);

  // Mode Critique (Urgence) : Masque l'interface standard
  const isCriticalMode = showEmergency;
  
  useWakeLock(isCriticalMode || isTracking);

  useEffect(() => {
    storageService.getConfig().then(setConfig);
    
    const loadTodayEvent = async () => {
        const today = getLocalDateString();
        const events = await storageService.getEvents();
        const found = events.find(e => e.date === today);
        setTodayEvent(found || null);
    };
    loadTodayEvent();
    
    // Tentative de restauration de session GPS (si app redémarrée)
    const initGps = async () => {
        // Callback de fin de suivi passé à restoreSession
        await geoService.restoreSession(() => setIsTracking(false));
        setIsTracking(geoService.isTracking);
    };
    initGps();
  }, []);

  // Surveiller la config pour les mises à jour
  useEffect(() => {
      const updateConfig = async () => {
          const cfg = await storageService.getConfig();
          setConfig(cfg);
      };

      // Check immédiat
      updateConfig();

      // Check lors des syncs
      const unsub = syncService.subscribe(() => updateConfig());

      // Check immédiat sur signal Broadcast (depuis SyncService)
      const bc = new BroadcastChannel('dps65_config_channel');
      bc.onmessage = (e) => {
          if (e.data.type === 'UPDATE_CONFIG') {
              updateConfig();
          }
      };

      return () => {
          unsub();
          bc.close();
      };
  }, []);

  // Surveiller l'équipe actuelle pour charger le sac correspondant
  useEffect(() => {
      const loadCurrentBag = async () => {
          if (currentTeam) {
              const bags = await bagService.getBags();
              const found = bags.find(b => b.assignedTeam === currentTeam);
              setCurrentBag(found || null);
          } else {
              setCurrentBag(null);
          }
      };
      loadCurrentBag();
  }, [currentTeam]);

  const handleRefresh = () => {
      window.location.reload();
  };

  const handleEmergencyClick = async () => {
      if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
      }

      setShowEmergency(true);
      
      const activeTeam = currentTeam || (profile ? `URG-${profile.lastName.toUpperCase()}` : 'URG-INCONNU');
      const today = getLocalDateString();
      let todayEvent: DpsEvent | null = null;
      try {
          const events = await storageService.getEvents();
          todayEvent = events.find(e => e.date === today) || null;
      } catch (e) {
          console.error("Error loading events in emergency", e);
      }
      const eventId = todayEvent ? todayEvent.id : undefined;

      // 1. Activation immédiate du GPS (si désactivé)
      if (!isTracking) {
          try {
              const hasPermission = await geoService.requestPermissions();
              if (hasPermission) {
                  geoService.startTracking(activeTeam, () => setIsTracking(false), eventId);
                  setIsTracking(true);
              }
          } catch (gpsErr) {
              console.error("Error activating GPS in emergency", gpsErr);
          }
      }

      // 2. Envoi instantané de la localisation (via table team_locations synced to Supabase)
      try {
          await geoService.sendImmediateEmergencyLocation(activeTeam, eventId);
          syncService.retrySync();
      } catch (locErr) {
          console.error("Error sending emergency positioning", locErr);
      }
      
      try {
          const alertId = generateUUID();
          const authorName = profile ? `${profile.firstName} ${profile.lastName}` : 'MEMBRE ÉQUIPE';
          const teamInfo = activeTeam ? `(${activeTeam})` : '';
          const eventContext = todayEvent ? `[${todayEvent.name}]` : '';

          const alertMessage = `URGENCE VITALE : DÉBUT R.C.P. PAR ${authorName.toUpperCase()} ${teamInfo} ${eventContext}`;

          // On empêche l'affichage de la modale visuelle locale (pour ne pas bloquer le guide RCP)
          sessionStorage.setItem('ignore_alert_id', alertId);
          
          // MAIS on envoie une notification native immédiate pour confirmer à l'utilisateur que c'est parti
          if ("Notification" in window && Notification.permission === "granted") {
              new Notification("🚨 ALERTE ENVOYÉE", {
                  body: "Votre demande de renfort (Urgence Vitale) a été transmise à toutes les équipes.",
                  icon: "/pwa-192x192.png",
                  tag: "emergency-alert",
                  silent: false
              });
          }

          await storageService.addLogbookEntry({
              id: alertId,
              eventId: todayEvent ? todayEvent.id : null,
              timestamp: Date.now(),
              message: alertMessage,
              category: 'ALERTE_GEN',
              author: authorName
          });
      } catch (e) {
          console.error("Erreur alerte", e);
      }
  };

  const handleStartService = () => {
      setShowTeamSelect(true);
  };

  const handleEndService = () => {
      setShowEndServiceConfirm(true);
  };

  const executeEndService = async () => {
      if (currentTeam) {
          await geoService.clearLocation(currentTeam);
      }
      geoService.stopTracking();
      setIsTracking(false);
      setSessionTeam(null);
      setCurrentBag(null);
      setShowEndServiceConfirm(false);
      localStorage.removeItem('dps65_service_start_time'); // Clear start time
  };

  const handleTeamSelected = async (team: string) => {
      setSessionTeam(team);
      // Enregistrement du début de service pour comparaison avec reset global
      localStorage.setItem('dps65_service_start_time', Date.now().toString());
      
      setShowTeamSelect(false);
      setLoadingBags(true);
      setShowBagSelect(true); 
      
      try {
          let bags = await bagService.getBags();
          let relevantBags = bags.filter(b => b.assignedTeam === 'DEPOT' || b.assignedTeam === team);
          
          if (!isAdmin) {
              if (profile?.role === 'secouriste') {
                  relevantBags = relevantBags.filter(b => b.type !== 'SAC_IDE');
              }
              if (profile?.role === 'infirmier' || profile?.role === 'medecin') {
                  relevantBags = relevantBags.filter(b => b.type === 'SAC_IDE');
              }
          }
          setAvailableBags(relevantBags);
      } catch (e) {
          console.error("Error loading bags", e);
      } finally {
          setLoadingBags(false);
      }
  };

  const handleBagSelected = async (bag: Bag) => {
      if (!currentTeam) return;
      await bagService.assignBag(bag.id, currentTeam);
      setCurrentBag(bag);
      setShowBagSelect(false);
      
      alert(`✅ Prise de service validée : ${currentTeam}\n🎒 Matériel : ${bag.name}`);
  };

  const handleSkipBag = async () => {
      if (!currentTeam) return;
      setShowBagSelect(false);
      setCurrentBag(null);
      
      alert(`✅ Prise de service validée : ${currentTeam}\n🎒 Matériel : Aucun`);
  };

  return (
    <Layout showStatus={false} hideHeaderTools={isCriticalMode} hideSync={true}>

      {!isCriticalMode && (
          <div className="absolute top-2 right-4 lg:right-10 z-20 flex gap-2">
              <button 
                onClick={handleRefresh}
                title="Actualiser l'application"
                className="p-2 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all active:rotate-180 duration-500"
              >
                <RefreshCw className="w-6 h-6" />
              </button>
              {isAdmin && (
                  <button 
                    onClick={() => navigate('/admin')}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <Settings className="w-6 h-6" />
                  </button>
              )}
          </div>
      )}

      {!isCriticalMode && (
          <div className="absolute top-2 left-4 lg:left-10 z-20 flex flex-col gap-2 items-start">
              <div className="mt-1">
                  <SyncIndicator />
              </div>

              {/* Indicateur GPS ACTIF visible en permanence si tracking */}
              {isTracking && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full text-[10px] font-bold border border-green-200 dark:border-green-800 animate-pulse shadow-sm">
                      <MapPin className="w-3 h-3" /> GPS ON
                  </div>
              )}
          </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-2 items-center justify-center w-full max-w-4xl mx-auto gap-4 lg:gap-8 py-4 px-4 h-auto lg:h-[calc(100vh-140px)] my-auto">
        {/* COLONNE GAUCHE: BRANDING & ENTRÉE DE SERVICE */}
        <div className="w-full max-w-sm flex flex-col gap-3.5">
            {/* BRANDING ZONE */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center w-full mb-1">
                <div className="w-20 h-20 relative animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                    <Logo variant="simple" className="w-full h-full object-contain relative z-10" />
                </div>
            </div>

            {/* PRISE / FIN DE SERVICE */}
            <div className="flex gap-3 w-full">
                <button 
                    onClick={currentTeam ? handleEndService : handleStartService}
                    className={`py-3 px-5 rounded-xl flex items-center justify-between border shadow-md transition-all active:scale-98 group flex-shrink-0 ${
                        currentTeam 
                        ? 'flex-1 bg-white dark:bg-slate-800 border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/10' 
                        : 'w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white border-blue-500/50 hover:from-blue-700 hover:to-blue-600 shadow-blue-500/10'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg ${currentTeam ? 'bg-red-50 dark:bg-red-950/40' : 'bg-white/15'}`}>
                            {currentTeam ? <Power className="w-5 h-5 text-red-500" /> : <Radio className="w-5 h-5 text-white" />}
                        </div>
                        <div className="text-left col-span-1">
                            <span className="text-[11px] sm:text-xs uppercase font-bold opacity-75 block tracking-wider">
                                {currentTeam ? 'Statut : EN SERVICE' : 'Statut : HORS SERVICE'}
                            </span>
                            <span className="font-extrabold text-lg uppercase leading-tight tracking-wide">
                                {currentTeam ? `${currentTeam}` : 'PRISE DE SERVICE'}
                            </span>
                        </div>
                    </div>
                    {/* GPS Status badge on Button */}
                    {currentTeam && isTracking && (
                        <div className="flex flex-col items-center animate-pulse text-green-500 ml-2">
                            <MapPin className="w-4 h-4 fill-current" />
                            <span className="text-[7px] font-black uppercase">GPS ON</span>
                        </div>
                    )}
                </button>

                {currentTeam && todayEvent?.supervisorPhone && (
                    <a 
                        href={`tel:${todayEvent.supervisorPhone}`}
                        className="w-20 bg-emerald-600 text-white border border-emerald-500 rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-md hover:bg-emerald-700 transition-all active:scale-95 animate-in slide-in-from-right-2"
                    >
                        <Phone className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase text-center leading-tight">Responsable</span>
                    </a>
                )}
            </div>

            {/* GPS COMPACT MANUAL TOGGLE */}
            {!isCriticalMode && (
                <div className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl shadow-xs transition-all" id="gps-manual-toggle">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${isTracking ? 'bg-green-50 dark:bg-green-950 text-green-500' : 'bg-slate-50 dark:bg-slate-900 text-slate-400'}`}>
                            <MapPin className={`w-4 h-4 ${isTracking ? 'animate-pulse' : ''}`} />
                        </div>
                        <div className="text-left min-w-0">
                            <span className="text-[13px] sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 block truncate">
                                {isTracking ? 'GPS Actif' : 'GPS Inactif'}
                            </span>
                            {!currentTeam ? (
                                <span className="text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400 block font-semibold leading-none mt-0.5">
                                    Prendre le service
                                </span>
                            ) : (
                                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 block font-semibold leading-none mt-0.5">
                                    Position temps réel
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <button
                        id="gps-toggle-button"
                        disabled={!currentTeam}
                        onClick={async () => {
                            if (isTracking) {
                                geoService.stopTracking();
                                setIsTracking(false);
                            } else {
                                if (!currentTeam) return;
                                const hasPermission = await geoService.requestPermissions();
                                if (hasPermission) {
                                    const today = getLocalDateString();
                                    const events = await storageService.getEvents();
                                    const todayEvent = events.find(e => e.date === today);
                                    const eventId = todayEvent ? todayEvent.id : undefined;
                                    geoService.startTracking(currentTeam, () => setIsTracking(false), eventId);
                                    setIsTracking(true);
                                    syncService.processQueue();
                                } else {
                                    alert("Attention : Géolocalisation refusée ou indisponible. Le suivi ne sera pas actif.");
                                }
                            }
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            !currentTeam ? 'opacity-30 cursor-not-allowed' : ''
                        } ${isTracking ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                isTracking ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
            )}

            {/* PORTAIL ASSO & SCANNER (COMPACT BENTO) */}
            <div className="grid grid-cols-2 gap-3 w-full">
                <button 
                    onClick={() => navigate('/management')}
                    className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl flex items-center gap-3 p-3 shadow-xs hover:border-blue-500/40 hover:shadow-md transition-all active:scale-95 group text-left relative"
                >
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-105 transition-transform shrink-0 relative">
                        <Users className="w-5 h-5" />
                        <NewContentBadge show={hasPortalBadges} className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-sm text-slate-805 dark:text-white uppercase tracking-wider truncate">ASSO</span>
                        <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold truncate mt-0.5">Membres</span>
                    </div>
                </button>

                <button 
                    onClick={() => navigate('/scan')}
                    className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl flex items-center gap-3 p-3 shadow-xs hover:border-indigo-500/40 hover:shadow-md transition-all active:scale-95 group text-left"
                >
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                        <QrCode className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-sm text-slate-805 dark:text-white uppercase tracking-wider truncate">SCAN</span>
                        <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold truncate mt-0.5">QR Code</span>
                    </div>
                </button>
            </div>
        </div>

        {/* COLONNE DROITE: URGENCE & ÉCOUTEUX GPS/MATÉRIEL */}
        <div className="w-full max-w-sm flex flex-col gap-3.5">
            {/* ALERTE URGENCE VITALE */}
            <button 
                onClick={handleEmergencyClick}
                className="w-full py-3.5 px-5 rounded-xl flex items-center justify-between border border-red-500 bg-red-600 text-white shadow-lg shadow-red-500/15 hover:bg-red-700 transition-all active:scale-98 group shrink-0 relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-red-500 opacity-5 group-hover:opacity-10 animate-pulse pointer-events-none" />
                <div className="flex items-center gap-3 relative z-10">
                    <div className="p-2 bg-white/20 rounded-lg text-white">
                        <HeartPulse className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="text-left">
                        <span className="text-[11px] sm:text-xs uppercase font-black tracking-widest text-red-100 block">
                            Alerte Générale
                        </span>
                        <span className="font-black text-base sm:text-lg uppercase leading-none tracking-wide text-white block mt-1">
                            URGENCE VITALE
                        </span>
                    </div>
                </div>
                <div className="text-[10px] font-black uppercase text-red-100 border border-white/25 px-2.5 py-0.5 rounded-lg relative z-10 bg-white/10 group-hover:bg-white/20 transition-all">
                    SOS
                </div>
            </button>
            
            {/* BOUTON ACCÈS RAPIDE SAC (VISIBLE UNIQUEMENT SI EN SERVICE) */}
            {!isCriticalMode && currentTeam && (
                <button
                    onClick={() => navigate('/management/bags', { state: { autoSelect: true } })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-3 rounded-xl shadow-xs flex items-center justify-between group active:scale-95 transition-all text-left"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg shrink-0 relative">
                            <Briefcase className="w-5 h-5" />
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white dark:border-slate-800 animate-pulse"></div>
                        </div>
                        <div className="text-left min-w-0">
                            <span className="text-[11px] sm:text-xs font-bold uppercase text-slate-400 dark:text-slate-500 block tracking-wider leading-none">Matériel actif</span>
                            <span className="text-base font-black text-slate-800 dark:text-white leading-tight block truncate mt-1">
                                {currentBag ? currentBag.name : "Aucun sac assigné"}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {currentBag && (
                            <span className="text-[10px] sm:text-xs bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold shrink-0">
                                {BAG_LABELS[currentBag.type] || currentBag.type}
                            </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                </button>
            )}
        </div>
      </div>

      {showTeamSelect && (
          <div className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                  <h3 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
                      <Radio className="text-blue-500" /> Prise de Service
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Sélectionnez votre indicatif radio pour démarrer.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-6">
                      {config?.teams.map(t => (
                          <button
                            key={t}
                            onClick={() => handleTeamSelected(t)}
                            className={`p-3 rounded-lg font-bold text-sm border transition-all ${
                                currentTeam === t 
                                ? 'bg-blue-600 text-white border-blue-700 shadow-md' 
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                              {t}
                          </button>
                      ))}
                  </div>
                  
                  <Button fullWidth variant="outline" onClick={() => setShowTeamSelect(false)}>Annuler</Button>
              </div>
          </div>
      )}

      {showBagSelect && (
          <div className="fixed inset-0 z-[130] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-right-10">
                  <div className="flex items-center gap-3 mb-4 text-emerald-600 dark:text-emerald-400">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full"><Briefcase className="w-6 h-6" /></div>
                      <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-none">Matériel</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Attribuer un sac à {currentTeam}</p>
                      </div>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto space-y-2 mb-4 custom-scrollbar">
                      {loadingBags ? (
                          <div className="py-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/> Chargement stock...</div>
                      ) : availableBags.length === 0 ? (
                          <div className="py-4 text-center text-slate-400 italic text-sm">Aucun sac disponible au dépôt pour votre profil.</div>
                      ) : (
                          availableBags.map(bag => (
                              <button
                                key={bag.id}
                                onClick={() => handleBagSelected(bag)}
                                className={`w-full p-3 rounded-xl border flex items-center justify-between group transition-all text-left ${
                                    bag.assignedTeam === currentTeam 
                                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-2 ring-blue-500' 
                                    : 'bg-slate-50 border-slate-100 dark:bg-slate-700/50 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700'
                                }`}
                              >
                                  <div>
                                      <span className="font-bold text-sm text-slate-800 dark:text-white block">{bag.name}</span>
                                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                          {BAG_LABELS[bag.type] || bag.type.replace('_', ' ')}
                                      </span>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                              </button>
                          ))
                      )}
                  </div>

                  <div className="flex gap-2">
                      <Button fullWidth variant="outline" onClick={handleSkipBag}>Pas de sac / Ignorer</Button>
                  </div>
              </div>
          </div>
      )}

      {showEmergency && <EmergencyGuide onClose={() => setShowEmergency(false)} />}

      <ConfirmDialog 
        isOpen={showStopTrackingConfirm}
        title="Arrêter le suivi ?"
        message="Votre position ne sera plus enregistrée."
        onConfirm={() => { geoService.stopTracking(); setIsTracking(false); setShowStopTrackingConfirm(false); }}
        onCancel={() => setShowStopTrackingConfirm(false)}
      />

      <ConfirmDialog 
        isOpen={showEndServiceConfirm}
        title="Fin de Service"
        message={`Confirmez-vous la fin de service pour l'équipe ${currentTeam} ?`}
        onConfirm={executeEndService}
        onCancel={() => setShowEndServiceConfirm(false)}
      />
    </Layout>
  );
};
