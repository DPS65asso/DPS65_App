
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { CalendarDays, Truck, GraduationCap, ArrowRight, MessageSquare, Briefcase, Shirt, User, QrCode, Shield, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';

type CardColor = 'blue' | 'cyan' | 'orange' | 'emerald' | 'purple' | 'pink';

const ModuleCard: React.FC<{ 
    title: string; 
    desc: string; 
    icon: React.ReactNode; 
    color: CardColor;
    onClick: () => void; 
    className?: string;
    hasBadge?: boolean;
    wide?: boolean; // Option pour affichage large
}> = ({ title, desc, icon, color, onClick, className, hasBadge, wide = false }) => {
    
    // CONFIGURATION DES "IMAGES" (LOGOS)
    // On simule une image d'app avec des dégradés riches et des ombres
    const themes = {
        blue:   { bg: 'bg-gradient-to-br from-blue-500 to-blue-700', shadow: 'shadow-blue-500/30' },
        cyan:   { bg: 'bg-gradient-to-br from-cyan-400 to-cyan-600', shadow: 'shadow-cyan-500/30' },
        orange: { bg: 'bg-gradient-to-br from-orange-400 to-red-500', shadow: 'shadow-orange-500/30' },
        emerald:{ bg: 'bg-gradient-to-br from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-500/30' },
        purple: { bg: 'bg-gradient-to-br from-purple-500 to-indigo-600', shadow: 'shadow-purple-500/30' },
        pink:   { bg: 'bg-gradient-to-br from-pink-500 to-rose-600', shadow: 'shadow-pink-500/30' },
    }[color];

    return (
        <div 
            onClick={onClick}
            className={`relative group cursor-pointer transition-all duration-200 active:scale-[0.98] 
            bg-white dark:bg-slate-800 shadow-sm hover:shadow-md border border-slate-100 dark:border-slate-700
            rounded-2xl p-3
            flex ${wide ? 'flex-row items-center gap-4' : 'flex-col justify-between'} h-full min-h-0
            ${className}`}
        >
            {/* Notification Dot */}
            {hasBadge && (
                <span className="absolute top-2 right-2 flex h-3 w-3 z-20">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-slate-800"></span>
                </span>
            )}
            
            {/* LOGO / IMAGE */}
            <div className={`
                ${wide ? 'w-14 h-14' : 'w-12 h-12 mb-3'} 
                rounded-xl ${themes.bg} ${themes.shadow} shadow-lg 
                flex items-center justify-center text-white shrink-0
                group-hover:scale-110 transition-transform duration-300
            `}>
                {React.cloneElement(icon as React.ReactElement, { className: wide ? "w-7 h-7" : "w-6 h-6" })}
            </div>
            
            {/* TEXT CONTENT */}
            <div className={`flex-1 min-w-0 ${wide ? '' : 'flex flex-col justify-end'}`}>
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm leading-tight truncate">{title}</h3>
                    {wide && <ArrowRight className="w-4 h-4 text-slate-300 -mr-1" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2 leading-tight mt-0.5 opacity-90">
                    {desc}
                </p>
            </div>
        </div>
    );
};

export const ManagementDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    
    // RESTRICTION : Organisateur ne peut pas accéder à la gestion
    useEffect(() => {
        if (profile?.role === 'organisateur') {
            navigate('/tactical', { replace: true });
        }
    }, [profile, navigate]);

    const [counts, setCounts] = useState({ missions: 0, docs: 0, courses: 0, fleet: 0 });
    const [badges, setBadges] = useState({ planning: false, life: false, hr: false, logistics: false });

    // Rôle SNU ne voit pas le vestiaire
    const isSnu = profile?.role === 'snu';

    useEffect(() => { checkUpdates(); }, []);

    const checkUpdates = async () => {
        try {
            const [missions, news, docs, courses, fleet] = await Promise.all([
                storageService.getMissions(), storageService.getNews(), storageService.getDocuments(),
                storageService.getCourses(), storageService.getFleet()
            ]);
            const currentCounts = { missions: missions.length, docs: news.length + docs.length, courses: courses.length, fleet: fleet.length };
            setCounts(currentCounts);
            const seenMissions = parseInt(localStorage.getItem('dps65_seen_missions') || '0');
            const seenDocs = parseInt(localStorage.getItem('dps65_seen_docs') || '0');
            const seenCourses = parseInt(localStorage.getItem('dps65_seen_courses') || '0');
            const seenFleet = parseInt(localStorage.getItem('dps65_seen_fleet') || '0');
            setBadges({
                planning: currentCounts.missions > seenMissions, life: currentCounts.docs > seenDocs,
                hr: currentCounts.courses > seenCourses, logistics: currentCounts.fleet > seenFleet
            });
        } catch (e) {}
    };

    const handleNavigation = (path: string, type: 'missions' | 'docs' | 'courses' | 'fleet') => {
        localStorage.setItem(`dps65_seen_${type}`, counts[type].toString());
        navigate(path);
    };

    return (
        <Layout title={null} showBack={false} hideSync={true}>
            {/* CONTAINER SANS SCROLL */}
            <div className="flex flex-col h-[calc(100vh-140px)] -mt-4 pb-2">
                
                {/* 1. BADGE D'IDENTIFICATION (Profile Header) */}
                <div 
                    onClick={() => navigate('/management/profile')}
                    className="shrink-0 mb-4 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-1 shadow-xl cursor-pointer group active:scale-[0.98] transition-transform"
                >
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-3 flex items-center gap-4 border border-white/10 relative overflow-hidden">
                        {/* Fond décoratif */}
                        <div className="absolute right-0 top-0 p-4 opacity-10 text-white"><Shield className="w-24 h-24" /></div>
                        
                        {/* Avatar Cercle - COULEURS ADAPTÉES DARK MODE */}
                        <div className="relative shrink-0">
                            <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-white font-black text-xl border-4 border-slate-700 dark:border-slate-500 shadow-md z-10 relative">
                                {profile?.firstName?.charAt(0)}{profile?.lastName?.charAt(0)}
                            </div>
                            <div className="absolute bottom-0 right-0 bg-emerald-500 w-4 h-4 rounded-full border-2 border-slate-900 z-20"></div>
                        </div>

                        {/* Info Text */}
                        <div className="flex-1 min-w-0 z-10">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-white font-bold text-lg leading-none truncate mb-1">
                                        {profile?.firstName} {profile?.lastName}
                                    </h2>
                                    <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest bg-blue-900/30 px-2 py-0.5 rounded w-fit border border-blue-500/30">
                                        {profile?.role} • DPS 65
                                    </p>
                                </div>
                                <QrCode className="w-6 h-6 text-slate-500 group-hover:text-white transition-colors" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. GRILLE D'APPLICATION (APP GRID) */}
                <div className="flex-1 grid grid-cols-2 grid-rows-4 gap-3 min-h-0">
                    
                    {/* PLANNING (Format Large) */}
                    <div className="col-span-2 row-span-1">
                        <ModuleCard 
                            title="Planning & Missions" 
                            desc="Agenda, inscriptions et ordres de mission."
                            icon={<CalendarDays />}
                            color="blue"
                            onClick={() => handleNavigation('/management/planning', 'missions')}
                            hasBadge={badges.planning}
                            wide
                            className="h-full"
                        />
                    </div>

                    {/* VÉHICULES */}
                    <ModuleCard 
                        title="Véhicules" 
                        desc="Carnet & Pannes."
                        icon={<Truck />}
                        color="orange"
                        onClick={() => handleNavigation('/management/logistics', 'fleet')}
                        hasBadge={badges.logistics}
                    />

                    {/* MATÉRIEL */}
                    <ModuleCard 
                        title="Matériel" 
                        desc="Stocks & Sacs."
                        icon={<Briefcase />}
                        color="cyan"
                        onClick={() => navigate('/management/bags')}
                    />
                    
                    {/* VESTIAIRE (Masqué pour SNU) */}
                    {!isSnu && (
                        <ModuleCard 
                            title="Vestiaire" 
                            desc="Tailles & Commandes"
                            icon={<Shirt />}
                            color="emerald"
                            onClick={() => navigate('/management/uniforms')}
                        />
                    )}

                    {/* FORMATION */}
                    <ModuleCard 
                        title="Formation" 
                        desc="Quiz & E-Learning."
                        icon={<GraduationCap />}
                        color="purple"
                        onClick={() => handleNavigation('/management/hr', 'courses')}
                        hasBadge={badges.hr}
                    />

                    {/* DASHBOARD */}
                    <ModuleCard 
                        title="Tableau de Bord" 
                        desc="Performance & Statistiques."
                        icon={<TrendingUp />}
                        color="pink"
                        onClick={() => navigate('/management/dashboard')}
                    />

                    {/* VIE ASSO */}
                    <ModuleCard 
                        title="Vie Associative" 
                        desc="Documents & Actus."
                        icon={<MessageSquare />}
                        color="pink"
                        onClick={() => handleNavigation('/management/life', 'docs')}
                        hasBadge={badges.life}
                    />
                </div>
            </div>
        </Layout>
    );
};
