
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, List, Sparkles, Activity, BookOpen, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { useNewContent } from '../context/NewContentContext';
import { NewContentBadge } from './NewContentBadge';

export const Sidebar: React.FC = () => {
  const { profile } = useAuth();
  const { badges } = useNewContent();

  const linkClass = (isActive: boolean) => 
    `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${
      isActive 
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 flex flex-col hidden lg:flex shadow-2xl">
      {/* HEADER LOGO */}
      <div className="py-3 px-5 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <Logo className="w-20 h-20 relative shrink-0" />
        <div className="flex flex-col text-left">
          <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-1">DPS 65</h1>
          <p className="text-[10px] text-slate-400 font-mono tracking-wider font-bold">PC OPÉRATIONNEL</p>
        </div>
      </div>

      {/* NAVIGATION */}
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {profile?.role !== 'organisateur' && (
          <>
            <NavLink to="/" className={({ isActive }) => linkClass(isActive)}>
                <div className="relative">
                    <Home className="w-5 h-5" />
                </div>
                <span>Tableau de bord</span>
            </NavLink>

            <NavLink to="/events" className={({ isActive }) => linkClass(isActive)}>
                <List className="w-5 h-5" />
                <span className="flex-1">Événements</span>
                <NewContentBadge show={badges.events} />
            </NavLink>
          </>
        )}

        <NavLink to="/tactical" className={({ isActive }) => linkClass(isActive)}>
            <Activity className="w-5 h-5" />
            <span>Vue Tactique</span>
        </NavLink>

        {profile?.role !== 'organisateur' && (
          <>
            <NavLink to="/ai" className={({ isActive }) => 
                `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${
                    isActive 
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
            }>
                <Sparkles className="w-5 h-5" />
                <span>Assistant I.A.</span>
            </NavLink>

            <NavLink to="/tools" className={({ isActive }) => linkClass(isActive)}>
                <BookOpen className="w-5 h-5" />
                <span>Outils & PISU</span>
            </NavLink>
          </>
        )}
      </div>

      {/* FOOTER USER INFO */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs uppercase">
                {profile?.firstName?.charAt(0) || <User className="w-4 h-4" />}
            </div>
            <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                    {profile?.firstName} {profile?.lastName}
                </p>
                <p className="text-[10px] text-blue-500 font-black uppercase">{profile?.role}</p>
            </div>
        </div>
      </div>
    </div>
  );
};
