
import React, { useState } from 'react';
import { Logo } from './Logo';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, HardDrive } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ScreenCurtain, CurtainTrigger } from './ScreenCurtain';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { SyncIndicator } from './SyncIndicator'; 

interface LayoutProps {
  children: React.ReactNode;
  title?: string | null;
  showBack?: boolean | string;
  showStatus?: boolean;
  hideHeaderTools?: boolean;
  hideSync?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack = false, showStatus = false, hideHeaderTools = false, hideSync = false }) => {
  const { isEcoMode } = useTheme();
  const { user } = useAuth();
  const isOrganizer = user?.role === 'organisateur';
  const navigate = useNavigate();
  const location = useLocation();

  const isCustomHeaderPage = (title === undefined || title === null) && !showBack;
  const isMobile = window.innerWidth < 1024;
  const isNoviMode = location.pathname.includes('/novi'); // Assuming Novi mode is a path or state
  const isSettingsMode = location.pathname.includes('/settings'); // Assuming Settings mode is a path or state
  const shouldHideMenu = isMobile && (isNoviMode || isSettingsMode);

  return (
    <div className={`fixed inset-0 h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 flex transition-colors duration-300 overflow-hidden ${shouldHideMenu ? 'hidden' : ''}`}>
      {!hideHeaderTools && !isOrganizer && <Sidebar />}

      <div className="flex-1 flex flex-col relative w-full lg:pl-64 transition-all duration-300">
          
          {isCustomHeaderPage && !hideHeaderTools && !hideSync && (
            <div className="absolute left-0 w-full pointer-events-none z-[60] top-0">
              <div className="absolute top-4 right-4 lg:right-8 pointer-events-auto flex items-center gap-2">
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
              <main className="container mx-auto max-w-7xl p-4 lg:p-8 flex flex-col pb-32 min-h-full relative">
                {!isCustomHeaderPage && (
                  <div className="flex items-center justify-between mb-6 pt-2">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      {showBack ? (
                        typeof showBack === 'string' ? (
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
      
    </div>
  );
};
