
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
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ScreenCurtain, CurtainTrigger } from '../components/ScreenCurtain';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Loader2, RefreshCw, HeartPulse, Settings, MapPin, QrCode, Battery, BatteryCharging, Users, Radio, Briefcase, ChevronRight, Power, Shield, Stethoscope, ShieldAlert, FlaskConical, User, GraduationCap, Package, Phone } from 'lucide-react';
import { AppConfig, Bag, UserRole, Event as DpsEvent } from '../types';
import { generateUUID, getLocalDateString } from '../utils/security';
import { useWakeLock } from '../hooks/useWakeLock';
import { SyncIndicator } from '../components/SyncIndicator';
import { syncService } from '../services/syncService';

// Mapping local pour l'affichage
const BAG_LABELS: Record<string, string> = {
    'LOT_A': 'Lot A (PMA)',
    'LOT_B': 'Lot B (Léger)',
    'LOT_C': 'Lot C (Oxygène)',
    'SAC_IDE': 'Sac IDE (Médical)'
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isEcoMode, toggleEcoMode } = useTheme();
  const { profile, currentTeam, setSessionTeam, isAdmin, refreshProfile } = useAuth();

  // Redirection automatique pour les organisateurs
  useEffect(() => {
    if (profile?.role === 'organisateur') {
      navigate('/tactical', { replace: true });
    }
  }, [profile, navigate]);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showCurtain, setShowCurtain] = useState(false);
  
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

  // Mode Critique (Urgence) ou Rideau Noir : Masque l'interface standard
  const isCriticalMode = showEmergency || showCurtain;
  
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

  // Surveiller la config pour l'arrêt forcé du service
  useEffect(() => {
      const checkServiceReset = async () => {
          const cfg = await storageService.getConfig();
          setConfig(cfg);
          
          if (cfg.serviceResetTimestamp && currentTeam) {
              const serviceStart = parseInt(sessionStorage.getItem('dps65_service_start_time') || '0');
              if (serviceStart > 0 && serviceStart < cfg.serviceResetTimestamp) {
                  // Le service a commencé AVANT la demande de reset global -> On coupe
                  executeEndService();
                  alert("⚠️ FIN DE SERVICE GÉNÉRALE DÉCLENCHÉE PAR LE PC.");
              }
          }
      };

      // Check immédiat
      checkServiceReset();

      // Check lors des syncs
      const unsub = syncService.subscribe(() => checkServiceReset());
      return () => unsub();
  }, [currentTeam]);

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
      
      try {
          const alertId = generateUUID();
          const authorName = profile ? `${profile.firstName} ${profile.lastName}` : 'MEMBRE ÉQUIPE';
          const teamInfo = currentTeam ? `(${currentTeam})` : '';
          const today = getLocalDateString();
          const events = await storageService.getEvents();
          const todayEvent = events.find(e => e.date === today);
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
      sessionStorage.removeItem('dps65_service_start_time'); // Clear start time
  };

  const handleTeamSelected = async (team: string) => {
      setSessionTeam(team);
      // Enregistrement du début de service pour comparaison avec reset global
      sessionStorage.setItem('dps65_service_start_time', Date.now().toString());
      
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

  const activateGpsAuto = async (team: string) => {
      const hasPermission = await geoService.requestPermissions();
      if (hasPermission) {
          const today = getLocalDateString();
          const events = await storageService.getEvents();
          const todayEvent = events.find(e => e.date === today);
          const eventId = todayEvent ? todayEvent.id : undefined;
          const eventName = todayEvent ? ` sur ${todayEvent.name}` : "";

          geoService.startTracking(team, () => setIsTracking(false), eventId);
          setIsTracking(true);
          
          // Solution 1: Synchronisation forcée immédiate (Push & Pull)
          syncService.retrySync();
          
          return { success: true, eventName };
      } else {
          alert("Attention : Géolocalisation refusée. Le suivi ne sera pas actif.");
          return { success: false, eventName: '' };
      }
  };

  const handleBagSelected = async (bag: Bag) => {
      if (!currentTeam) return;
      await bagService.assignBag(bag.id, currentTeam);
      setCurrentBag(bag);
      setShowBagSelect(false);
      
      const { success, eventName } = await activateGpsAuto(currentTeam);
      const gpsMsg = success ? `\n📡 GPS : Activé${eventName}` : "\n📡 GPS : Inactif";
      
      alert(`✅ Prise de service validée : ${currentTeam}\n🎒 Matériel : ${bag.name}${gpsMsg}`);
  };

  const handleSkipBag = async () => {
      if (!currentTeam) return;
      setShowBagSelect(false);
      setCurrentBag(null);
      
      const { success, eventName } = await activateGpsAuto(currentTeam);
      const gpsMsg = success ? `\n📡 GPS : Activé${eventName}` : "\n📡 GPS : Inactif";

      alert(`✅ Prise de service validée : ${currentTeam}\n🎒 Matériel : Aucun${gpsMsg}`);
  };

  return (
    <Layout showStatus={false} hideHeaderTools={isCriticalMode} hideSync={true}>
      {showCurtain && <ScreenCurtain onClose={() => setShowCurtain(false)} />}

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
              <button 
                onClick={toggleEcoMode}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all text-[10px] font-bold uppercase tracking-wider ${
                    isEcoMode 
                    ? 'bg-slate-800 text-white border border-slate-600 shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {isEcoMode ? <BatteryCharging className="w-4 h-4 animate-pulse" /> : <Battery className="w-4 h-4" />}
                {isEcoMode ? 'ÉCO / GPS' : 'Mode Éco'}
              </button>
              
              <div className="mt-1">
                  <SyncIndicator />
              </div>

              {/* Indicateur GPS ACTIF visible en permanence si tracking */}
              {isTracking && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full text-[10px] font-bold border border-green-200 dark:border-green-800 animate-pulse shadow-sm">
                      <MapPin className="w-3 h-3" /> GPS ON
                  </div>
              )}

              {/* Bouton Rideau visible uniquement si en service */}
              {currentTeam && (
                <div className="animate-in fade-in slide-in-from-left-2">
                   <CurtainTrigger onActivate={() => setShowCurtain(true)} />
                </div>
              )}
          </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-2 lg:content-center items-center w-full max-w-4xl mx-auto h-[calc(100vh-140px)] lg:h-full justify-center gap-4 lg:gap-8 py-2">
        <div className="w-full max-w-sm flex flex-col gap-4">
            <div className="flex-shrink-0 flex justify-center w-full">
                <div className="w-28 h-28 relative">
                    <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-xl"></div>
                    <Logo variant="simple" className="w-full h-full object-contain relative z-10" />
                </div>
            </div>

            <div className="flex gap-3 w-full">
                <button 
                    onClick={currentTeam ? handleEndService : handleStartService}
                    className={`py-4 px-6 rounded-2xl flex items-center justify-between border-2 shadow-lg transition-all active:scale-95 group flex-shrink-0 ${
                        currentTeam 
                        ? 'flex-1 bg-white dark:bg-slate-800 border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
                        : 'w-full bg-blue-600 text-white border-blue-500 hover:bg-blue-700'
                    }`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${currentTeam ? 'bg-red-100 dark:bg-red-900/30' : 'bg-white/20'}`}>
                            {currentTeam ? <Power className="w-6 h-6" /> : <Radio className="w-6 h-6" />}
                        </div>
                        <div className="text-left">
                            <span className="text-[10px] uppercase font-bold opacity-80 block tracking-wider">
                                {currentTeam ? 'Statut : EN SERVICE' : 'Statut : HORS SERVICE'}
                            </span>
                            <span className="font-black text-xl uppercase leading-none">
                                {currentTeam ? `${currentTeam}` : 'PRISE DE SERVICE'}
                            </span>
                        </div>
                    </div>
                    {/* L'indicateur GPS est aussi ici pour le contexte du bouton */}
                    {currentTeam && isTracking && (
                        <div className="flex flex-col items-center animate-pulse text-green-600 dark:text-green-400">
                            <MapPin className="w-5 h-5 fill-current" />
                            <span className="text-[8px] font-black uppercase">GPS ON</span>
                        </div>
                    )}
                </button>

                {currentTeam && todayEvent?.supervisorPhone && (
                    <a 
                        href={`tel:${todayEvent.supervisorPhone}`}
                        className="w-24 bg-emerald-600 text-white border-2 border-emerald-500 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-lg hover:bg-emerald-700 transition-all active:scale-95 animate-in slide-in-from-right-4"
                    >
                        <Phone className="w-6 h-6" />
                        <span className="text-[9px] font-black uppercase text-center leading-tight">Appel<br/>Resp.</span>
                    </a>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 w-full flex-1 min-h-0">
                <button 
                    onClick={() => navigate('/management')}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 group p-4"
                >
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                        <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="font-black text-sm uppercase tracking-wide">Portail Asso</span>
                </button>

                <button 
                    onClick={() => navigate('/scan')}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 group p-4"
                >
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                        <QrCode className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="font-black text-sm uppercase tracking-wide">Scanner</span>
                </button>
            </div>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-4">
            <button 
                onClick={handleEmergencyClick}
                className="w-full py-4 px-6 rounded-2xl flex items-center justify-between border-2 shadow-lg transition-all active:scale-95 group flex-shrink-0 bg-red-600 text-white border-red-500 hover:bg-red-700"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-white/20">
                        <HeartPulse className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <span className="text-[10px] uppercase font-bold opacity-80 block tracking-wider">
                            Alerte Générale
                        </span>
                        <span className="font-black text-xl uppercase leading-none">
                            URGENCE VITALE
                        </span>
                    </div>
                </div>
            </button>
            
            {/* BOUTON ACCÈS RAPIDE SAC (VISIBLE UNIQUEMENT SI EN SERVICE) */}
            {!isCriticalMode && currentTeam && (
                <button
                    onClick={() => navigate('/management/bags', { state: { autoSelect: true } })}
                    className="w-full bg-white dark:bg-slate-800 border-2 border-blue-500/30 p-4 rounded-2xl shadow-sm flex items-center justify-between group active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-2"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl relative">
                            <Briefcase className="w-6 h-6" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                        </div>
                        <div className="text-left">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Mon Matériel</span>
                            <span className="text-lg font-black text-slate-800 dark:text-white leading-none">
                                {currentBag ? currentBag.name : "Aucun sac assigné"}
                            </span>
                            {currentBag && (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 mt-1 inline-block border border-slate-200 dark:border-slate-600">
                                    {BAG_LABELS[currentBag.type] || currentBag.type}
                                </span>
                            )}
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
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
