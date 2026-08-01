
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Calendar, Truck, GraduationCap, ArrowRight, MessageSquare, Briefcase, Shirt, User, QrCode, Shield, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';
import { adminService } from '../services/features/adminService';
import { syncService } from '../services/syncService';
import { AppConfig } from '../types';
import { useNewContent } from '../context/NewContentContext';
import { NewContentBadge } from '../components/NewContentBadge';

type CardColor = 'blue' | 'cyan' | 'orange' | 'emerald' | 'purple' | 'pink';

const ModuleCard: React.FC<{ 
    title: string; 
    desc: string; 
    icon: React.ReactNode; 
    color: CardColor;
    onClick: () => void; 
    className?: string;
    wide?: boolean; // Option pour affichage large
    badge?: boolean;
    badgeText?: string;
    badgeVariant?: 'dot' | 'pill';
}> = ({ title, desc, icon, color, onClick, className, wide = false, badge = false, badgeText, badgeVariant = 'dot' }) => {
    
    // CONFIGURATION DES "IMAGES" (LOGOS)
    // On simule une image d'app avec des dégradés riches et des ombres
    const themes = {
        blue:   { bg: 'bg-gradient-to-br from-blue-500 to-blue-700', shadow: 'shadow-blue-500/20' },
        cyan:   { bg: 'bg-gradient-to-br from-cyan-400 to-cyan-600', shadow: 'shadow-cyan-500/20' },
        orange: { bg: 'bg-gradient-to-br from-orange-400 to-red-500', shadow: 'shadow-orange-500/20' },
        emerald:{ bg: 'bg-gradient-to-br from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-500/20' },
        purple: { bg: 'bg-gradient-to-br from-purple-500 to-indigo-600', shadow: 'shadow-purple-500/20' },
        pink:   { bg: 'bg-gradient-to-br from-pink-500 to-rose-600', shadow: 'shadow-pink-500/20' },
    }[color];

    return (
        <div 
            onClick={onClick}
            className={`relative group cursor-pointer transition-all duration-200 active:scale-[0.98] 
            bg-white dark:bg-slate-900 shadow-sm hover:shadow-md border border-slate-205/60 dark:border-slate-800/85
            rounded-2xl p-3.5 sm:p-4
            flex ${wide ? 'flex-row items-center gap-4' : 'flex-col justify-center items-start'} h-full min-h-0
            ${className}`}
        >
            {/* Pastille ou badge de nouveauté au coin supérieur droit de la carte */}
            <NewContentBadge show={badge} text={badgeText} variant={badgeVariant} className="absolute top-2.5 right-2.5 z-20" />

            {/* LOGO / IMAGE */}
            <div className={`
                ${wide ? 'w-11 sm:w-12 h-11 sm:h-12 shrink-0' : 'w-11 h-11 mb-2.5 sm:mb-3 shrink-0'} 
                rounded-xl ${themes.bg} ${themes.shadow} shadow-xs 
                flex items-center justify-center text-white relative group-hover:scale-105 transition-transform
            `}>
                {React.cloneElement(icon as React.ReactElement, { className: "w-5.5 h-5.5" })}
            </div>
            
            {/* TEXT CONTENT */}
            <div className={`flex-1 min-w-0 w-full flex flex-col justify-center`}>
                <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-805 dark:text-white text-sm sm:text-base leading-snug tracking-tight truncate">{title}</h3>
                    {wide && <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0 ml-1" />}
                </div>
                <p className="text-xs sm:text-[13px] text-slate-400 dark:text-slate-500 font-semibold line-clamp-2 leading-relaxed mt-1 sm:mt-1.5 opacity-90">
                    {desc}
                </p>
            </div>
        </div>
    );
};

export const ManagementDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { badges, markSectionAsSeen } = useNewContent();
    
    // RESTRICTION : Organisateur ne peut pas accéder à la gestion
    useEffect(() => {
        if (profile?.role === 'organisateur') {
            navigate('/tactical', { replace: true });
        }
    }, [profile, navigate]);

    const [counts, setCounts] = useState({ missions: 0, docs: 0, courses: 0, fleet: 0 });
    const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

    // Rôle SNU ne voit pas le vestiaire
    const isSnu = profile?.role === 'snu';

    useEffect(() => { 
        const loadCounts = async () => {
            try {
                const [missions, news, docs, courses, fleet, conf] = await Promise.all([
                    storageService.getMissions(), storageService.getNews(), storageService.getDocuments(),
                    storageService.getCourses(), storageService.getFleet(), adminService.getConfig()
                ]);
                setCounts({ missions: missions.length, docs: news.length + docs.length, courses: courses.length, fleet: fleet.length });
                setAppConfig(conf);
            } catch (e) {}
        };
        loadCounts();

        const bcConfig = new BroadcastChannel('dps65_config_channel');
        const handleConfigUpdate = () => {
            adminService.getConfig().then(setAppConfig);
        };
        bcConfig.onmessage = handleConfigUpdate;

        const unsubscribeSync = syncService.subscribe(() => {
            handleConfigUpdate();
        });

        return () => {
            bcConfig.close();
            unsubscribeSync();
        };
    }, []);

    const handleNavigation = (path: string, type: 'missions' | 'docs' | 'courses' | 'fleet') => {
        localStorage.setItem(`dps65_seen_${type}`, counts[type].toString());
        navigate(path);
    };

    return (
        <Layout title={null} showBack={false} hideSync={true}>
            {/* CONTAINER D'ÉCRAN COMPACT MOBILE SANS AUCUN SCROLL */}
            <div className="fixed inset-x-0 top-0 bottom-[calc(80px+env(safe-area-inset-bottom,0px))] z-40 bg-slate-50 dark:bg-slate-950 p-3 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-2 px-3 flex flex-col justify-between overflow-hidden lg:static lg:inset-auto lg:h-[calc(100vh-140px)] lg:bg-transparent lg:p-0">
                
                {/* 1. BADGE D'IDENTIFICATION COMPACT (Profile Header) */}
                <div 
                    onClick={() => navigate('/management/profile')}
                    className="shrink-0 mb-3 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-[1px] shadow-md cursor-pointer group active:scale-[0.98] transition-transform"
                >
                    <div className="bg-slate-900/40 backdrop-blur-xs rounded-lg p-2 flex items-center gap-3 border border-white/10 relative overflow-hidden">
                        {/* Fond décoratif */}
                        <div className="absolute right-0 top-0 p-3 opacity-10 text-white"><Shield className="w-16 h-16 sm:w-20 sm:h-20" /></div>
                        
                        {/* Avatar Cercle */}
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-white font-black text-xs sm:text-sm border-2 border-slate-600 dark:border-slate-500 shadow-xs z-10 relative">
                                {profile?.firstName?.charAt(0)}{profile?.lastName?.charAt(0)}
                            </div>
                            <div className="absolute bottom-0 right-0 bg-emerald-500 w-3 h-3 rounded-full border border-slate-900 z-20"></div>
                        </div>

                        {/* Info Text */}
                        <div className="flex-1 min-w-0 z-10">
                            <div className="flex justify-between items-center">
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-white font-extrabold text-base leading-none truncate mb-1">
                                        {profile?.firstName} {profile?.lastName}
                                    </h2>
                                    <p className="text-[10.5px] text-blue-300 font-extrabold uppercase tracking-widest bg-blue-900/30 px-1.5 py-0.5 rounded w-fit border border-blue-500/30 leading-none">
                                        {profile?.role} • DPS 65
                                    </p>
                                </div>
                                <QrCode className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors ml-2 shrink-0" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. GRILLE D'APPLICATION SÉCURISÉE (APP GRID SANS DEBORDEMENT ET PARFAITEMENT ÉQUILIBRÉE) */}
                <div className="flex-1 grid grid-cols-2 grid-rows-4 gap-2 pb-2 min-h-0 h-full">
                    
                    {/* PLANNING (Format Large) - RANGÉE 1 */}
                    <div className="col-span-2 row-span-1 min-h-0 h-full">
                        <ModuleCard 
                            title="Planning & Missions" 
                            desc="Agenda, inscriptions et ordres de mission."
                            icon={<Calendar />}
                            color="blue"
                            onClick={() => handleNavigation('/management/planning', 'missions')}
                            wide
                            badge={badges.missions}
                            className="h-full"
                        />
                    </div>

                    {/* VÉHICULES - RANGÉE 2 */}
                    <div className="col-span-1 row-span-1 min-h-0 h-full">
                        <ModuleCard 
                            title="Véhicules" 
                            desc="Carnet & Pannes."
                            icon={<Truck />}
                            color="orange"
                            onClick={() => handleNavigation('/management/logistics', 'fleet')}
                            className="h-full"
                        />
                    </div>

                    {/* MATÉRIEL - RANGÉE 2 */}
                    <div className="col-span-1 row-span-1 min-h-0 h-full">
                        <ModuleCard 
                            title="Matériel" 
                            desc="Stocks & Sacs."
                            icon={<Briefcase />}
                            color="cyan"
                            onClick={() => navigate('/management/bags')}
                            className="h-full"
                        />
                    </div>
                    
                    {/* SI PAS SNU: VESTIAIRE + FORMATION (RANGÉE 3); TABLEAU DE BORD + VIE ASSO (RANGÉE 4) */}
                    {!isSnu ? (
                        <>
                            {/* RANGÉE 3 */}
                            <div className="col-span-1 row-span-1 min-h-0 h-full">
                                <ModuleCard 
                                    title="Vestiaire" 
                                    desc="Tailles & Commandes."
                                    icon={<Shirt />}
                                    color="emerald"
                                    badge={!!appConfig?.clothingOrderInProgress}
                                    badgeText="Commande en cours"
                                    badgeVariant="pill"
                                    onClick={() => navigate('/management/uniforms')}
                                    className="h-full"
                                />
                            </div>
                            <div className="col-span-1 row-span-1 min-h-0 h-full">
                                <ModuleCard 
                                    title="Formation" 
                                    desc="Quiz & E-Learning."
                                    icon={<GraduationCap />}
                                    color="purple"
                                    badge={badges.courses}
                                    onClick={() => handleNavigation('/management/hr', 'courses')}
                                    className="h-full"
                                />
                            </div>

                            {/* RANGÉE 4 */}
                            <div className="col-span-1 row-span-1 min-h-0 h-full">
                                <ModuleCard 
                                    title="Tableau de Bord" 
                                    desc="Stats & Activité."
                                    icon={<TrendingUp />}
                                    color="pink"
                                    onClick={() => navigate('/management/dashboard')}
                                    className="h-full"
                                />
                            </div>
                            <div className="col-span-1 row-span-1 min-h-0 h-full">
                                <ModuleCard 
                                    title="Vie Associative" 
                                    desc="Documents & Actus."
                                    icon={<MessageSquare />}
                                    color="pink"
                                    badge={badges.docs}
                                    onClick={() => handleNavigation('/management/life', 'docs')}
                                    className="h-full"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* SI SNU (PAS de Vestiaire, donc 5 cartes pour équilibrer parfaitement les 4 rangées) */}
                            {/* RANGÉE 3: FORMATION + TABLEAU DE BORD */}
                            <div className="col-span-1 row-span-1 min-h-0 h-full">
                                <ModuleCard 
                                    title="Formation" 
                                    desc="Quiz & E-Learning."
                                    icon={<GraduationCap />}
                                    color="purple"
                                    badge={badges.courses}
                                    onClick={() => handleNavigation('/management/hr', 'courses')}
                                    className="h-full"
                                />
                            </div>
                            <div className="col-span-1 row-span-1 min-h-0 h-full">
                                <ModuleCard 
                                    title="Tableau de Bord" 
                                    desc="Stats & Activité."
                                    icon={<TrendingUp />}
                                    color="pink"
                                    onClick={() => navigate('/management/dashboard')}
                                    className="h-full"
                                />
                            </div>

                            {/* RANGÉE 4: VIE ASSO (LARGE) */}
                            <div className="col-span-2 row-span-1 min-h-0 h-full">
                                <ModuleCard 
                                    title="Vie Associative" 
                                    desc="Documents, actualités et échanges associatifs."
                                    icon={<MessageSquare />}
                                    color="pink"
                                    badge={badges.docs}
                                    onClick={() => handleNavigation('/management/life', 'docs')}
                                    wide
                                    className="h-full"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
};
