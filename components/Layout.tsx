
import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, HardDrive, MapPin, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { SyncIndicator } from './SyncIndicator'; 
import { geoService } from '../services/geoService';
import { PushNotificationModal } from './PushNotificationModal';

interface LayoutProps {
  children: React.ReactNode;
  title?: string | null;
  showBack?: boolean | string;
  showStatus?: boolean;
  hideHeaderTools?: boolean;
  hideSync?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack = false, showStatus = false, hideHeaderTools = false, hideSync = false }) => {
  const { user, signOut } = useAuth();
  const isOrganizer = user?.role === 'organisateur';
  const navigate = useNavigate();
  const location = useLocation();

  const [isGpsActive, setIsGpsActive] = useState(() => {
    return localStorage.getItem('dps65_tracking_state') !== null || geoService.isTracking;
  });
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);

  useEffect(() => {
    const handleCheck = () => {
      const active = localStorage.getItem('dps65_tracking_state') !== null || geoService.isTracking;
      if (active !== isGpsActive) {
        setIsGpsActive(active);
      }
    };
    const int = setInterval(handleCheck, 1000);
    
    // Ecouter aussi le canal status change des autres onglets
    const bc = new BroadcastChannel('gps_status_change');
    bc.onmessage = (e) => {
      if (e.data.type === 'GPS_STOPPED') {
        setIsGpsActive(false);
      }
    };

    return () => {
      clearInterval(int);
      bc.close();
    };
  }, [isGpsActive]);

  const handleDeactivateGps = () => {
    if (window.confirm("Voulez-vous désactiver la géolocalisation GPS en cours ? Cela arrêtera votre suivi en temps réel.")) {
      geoService.stopTracking();
      localStorage.removeItem('dps65_tracking_state');
      setIsGpsActive(false);
      const bc = new BroadcastChannel('gps_status_change');
      bc.postMessage({ type: 'GPS_STOPPED' });
      bc.close();
    }
  };

  const isCustomHeaderPage = (title === undefined || title === null) && !showBack;
  const isMobile = window.innerWidth < 1024;
  const isNoviMode = location.pathname.includes('/novi'); // Assuming Novi mode is a path or state
  const isSettingsMode = location.pathname.includes('/settings'); // Assuming Settings mode is a path or state
  const isAiPage = location.pathname.startsWith('/ai');
  const shouldHideMenu = isMobile && (isNoviMode || isSettingsMode);

  return (
    <div className={`fixed inset-0 h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 flex transition-colors duration-300 overflow-hidden ${shouldHideMenu ? 'hidden' : ''}`}>
      {!hideHeaderTools && !isOrganizer && <Sidebar />}

      <div className="flex-1 flex flex-col relative w-full lg:pl-64 transition-all duration-300">
          
          {isCustomHeaderPage && !hideHeaderTools && !hideSync && (
            <div className="absolute left-0 w-full pointer-events-none z-[60] top-0">
              <div className="absolute top-4 right-4 lg:right-8 pointer-events-auto flex items-center gap-2">
                  {isGpsActive && (
                    <button 
                      onClick={handleDeactivateGps}
                      title="GPS Actif - Cliquer pour désactiver"
                      className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-green-500 text-white border-green-600 dark:bg-green-600 hover:bg-red-600 hover:border-red-700 hover:text-white transition-all cursor-pointer shadow-sm animate-pulse hover:animate-none"
                    >
                      <MapPin className="w-3.5 h-3.5 fill-current" /> GPS ON
                    </button>
                  )}
                  <SyncIndicator />
                  {showStatus && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider transition-colors bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                        <HardDrive className="w-3 h-3" /> Local+Cloud
                    </div>
                  )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto w-full overflow-x-hidden scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
              <main className="container mx-auto max-w-7xl p-4 lg:p-8 flex flex-col pb-32 min-h-full relative w-full min-w-0">
                {!isCustomHeaderPage && (
                  <div className="flex items-center justify-between mb-6 pt-2">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      {showBack ? (
                        isOrganizer ? (
                          <button 
                            onClick={async () => {
                              if (window.confirm("Voulez-vous vous déconnecter du suivi organisateur ?")) {
                                await signOut();
                                navigate('/login');
                              }
                            }}
                            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0"
                            title="Se déconnecter"
                          >
                            <ChevronLeft className="w-6 h-6" />
                          </button>
                        ) : typeof showBack === 'string' ? (
                            <Link to={showBack} className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0">
                              <ChevronLeft className="w-6 h-6" />
                            </Link>
                        ) : (
                            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0">
                              <ChevronLeft className="w-6 h-6" />
                            </button>
                        )
                      ) : (
                        <Link to="/" className="flex-shrink-0 lg:hidden">
                          <Logo className="w-8 h-8" />
                        </Link>
                      )}
                      <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight truncate mr-2">
                        {title !== undefined && title !== null ? title : 'Suivi DPS65'}
                      </h1>
                    </div>
                    
                    {!hideHeaderTools && !hideSync && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                              {isGpsActive && (
                                <button 
                                  onClick={handleDeactivateGps}
                                  title="GPS Actif - Cliquer pour désactiver"
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-green-500 text-white border-green-600 dark:bg-green-600 hover:bg-red-600 hover:border-red-700 hover:text-white transition-all cursor-pointer shadow-sm animate-pulse hover:animate-none"
                                >
                                  <MapPin className="w-3 h-3 fill-current" /> GPS ON
                                </button>
                              )}
                              {isOrganizer && (
                                <button
                                  onClick={async () => {
                                    if (window.confirm("Voulez-vous vous déconnecter ?")) {
                                      await signOut();
                                      navigate('/login');
                                    }
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs transition-colors shadow-xs outline-none cursor-pointer"
                                  title="Se déconnecter"
                                >
                                  <LogOut className="w-4 h-4" />
                                  <span className="hidden sm:inline">Déconnexion</span>
                                </button>
                              )}
                              {!isOrganizer && !isAiPage && (
                                <button
                                  onClick={() => setIsPushModalOpen(true)}
                                  title="Diffusion Notification Push"
                                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs transition-all border border-blue-400/30 flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/25 active:scale-95 ring-2 ring-blue-500/20"
                                >
                                  <Bell className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
                                  <span className="inline-block font-extrabold tracking-tight">Notif Push</span>
                                </button>
                              )}
                              {/* Sync Indicator dans la navbar classique */}
                              <SyncIndicator />
                        </div>
                    )}
                  </div>
                )}

                {children}
              </main>
          </div>
      </div>
      
      {!hideHeaderTools && !isOrganizer && (
          <div className="lg:hidden">
              <BottomNav />
          </div>
      )}
      
      <PushNotificationModal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
      />
    </div>
  );
};
