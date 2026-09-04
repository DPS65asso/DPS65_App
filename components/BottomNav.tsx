
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, List, Sparkles, Activity, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNewContent } from '../context/NewContentContext';
import { NewContentBadge } from './NewContentBadge';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { profile } = useAuth();
  const { badges } = useNewContent();

  const linkClass = (isActive: boolean) => 
    `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
      isActive ? 'text-orange-500 dark:text-orange-400 font-semibold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
    }`;

  return (
    <nav 
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 w-full z-[100] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-5px_20px_rgba(0,0,0,0.08)] rounded-t-2xl"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex justify-between items-center h-[68px] max-w-lg mx-auto px-2 relative">
        {/* Gauche */}
        {profile?.role !== 'organisateur' && (
          <>
            <NavLink to="/" className={({ isActive }) => linkClass(isActive)}>
              <div className="relative">
                <Home className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-medium">Accueil</span>
            </NavLink>

            <NavLink to="/events" className={({ isActive }) => linkClass(isActive)}>
              <div className="relative">
                <List className="w-6 h-6" />
                <NewContentBadge show={badges.events} className="absolute -top-1 -right-1" />
              </div>
              <span className="text-[10px] font-medium">Events</span>
            </NavLink>
          </>
        )}

        {/* ESPACE CENTRAL POUR LE BOUTON FLOTTANT */}
        {profile?.role !== 'organisateur' ? (
          <div className="w-full relative flex justify-center pointer-events-none">
            {/* Le bouton est positionné en absolu pour dépasser au-dessus de la barre */}
            <div className="absolute -top-7 pointer-events-auto">
              <NavLink to="/ai" className="group block">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 p-1 shadow-lg shadow-orange-500/30 transition-transform active:scale-95 group-hover:scale-105 flex items-center justify-center border-4 border-white dark:border-slate-900">
                  <Sparkles className="w-7 h-7 text-white fill-white/20" />
                </div>
              </NavLink>
            </div>
            <span className={`text-[10px] font-bold mt-8 ${location.pathname === '/ai' ? 'text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-purple-600' : 'text-slate-400'}`}>
              I.A.
            </span>
          </div>
        ) : (
          <div className="w-full"></div>
        )}

        {/* Droite */}
        <NavLink to="/tactical" className={({ isActive }) => linkClass(isActive)}>
          <div className="relative">
            <Activity className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-medium">Tactique</span>
        </NavLink>

        {profile?.role !== 'organisateur' && (
          <NavLink to="/tools" className={({ isActive }) => linkClass(isActive)}>
            <div className="relative">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-medium">Outils</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
};
