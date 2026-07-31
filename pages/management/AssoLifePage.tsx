
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Megaphone, FileText, ExternalLink, Lock, Sparkles } from 'lucide-react';
import { adminService } from '../../services/features/adminService';
import { NewsPost, AssociationDocument } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { NewContentBadge } from '../../components/NewContentBadge';
import { useNewContent } from '../../context/NewContentContext';

const SEEN_ASSO_IDS_KEY = 'dps65_seen_asso_item_ids_v1';

export const AssoLifePage: React.FC = () => {
    const { isAdmin } = useAuth();
    const { markItemAsSeen, markSectionAsSeen, isItemNew, badges } = useNewContent();
    const [news, setNews] = useState<NewsPost[]>([]);
    const [documents, setDocuments] = useState<AssociationDocument[]>([]);

    useEffect(() => {
        loadData();

        // Écoute des mises à jour en temps réel (Actus & Documents)
        const bc = new BroadcastChannel('dps65_asso_channel');
        bc.onmessage = () => {
            loadData();
        };

        return () => bc.close();
    }, [isAdmin]);

    const loadData = async () => {
        try {
            const n = await adminService.getNews();
            setNews(n);
            
            const d = await adminService.getDocuments();
            // Filtre les documents réservés aux admins
            const filteredDocs = d.filter(doc => !doc.adminOnly || isAdmin);
            setDocuments(filteredDocs);
        } catch (e) {
            console.error("Erreur chargement vie asso", e);
        }
    };

    const markItemSeen = (id: string) => {
        markItemAsSeen('docs', id);
    };

    const checkIsNew = (id: string, dateVal?: number | string) => {
        return isItemNew('docs', id, dateVal);
    };

    return (
        <Layout title="Vie de l'Association" showBack="/management" hideSync={true}>
            <div className="space-y-6 pb-20">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider flex items-center gap-2">
                            <Megaphone className="w-4 h-4"/> Dernières Infos
                        </h3>
                        {badges.docs && (
                            <button 
                                onClick={() => markSectionAsSeen('docs')}
                                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg"
                            >
                                Tout marquer comme vu
                            </button>
                        )}
                    </div>
                    <div className="space-y-3">
                        {news.length === 0 && <div className="text-center text-sm text-slate-400 py-4">Aucune actualité récente.</div>}
                        {news.map(post => {
                            const isNew = isItemNew('docs', post.id, post.date);
                            return (
                                <div 
                                    key={post.id} 
                                    onClick={() => markItemSeen(post.id)}
                                    className={`relative bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border transition-all ${
                                        post.isUrgent 
                                            ? 'border-red-500 border-l-4' 
                                            : isNew 
                                                ? 'border-blue-400 dark:border-blue-600 ring-1 ring-blue-400/30' 
                                                : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                >
                                    {/* Marqueur NOUVEAU au coin supérieur droit */}
                                    {isNew && (
                                        <div className="absolute top-3 right-3 flex items-center gap-1">
                                            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs shadow-red-500/30 animate-pulse">
                                                <Sparkles className="w-2.5 h-2.5" /> Nouveau
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-2 pr-20">
                                        <h4 className={`font-bold ${post.isUrgent ? 'text-red-600' : 'text-slate-800 dark:text-white'}`}>{post.title}</h4>
                                    </div>

                                    <div className="mb-2">
                                        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                                            {new Date(post.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>

                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{post.content}</p>
                                    <div className="mt-3 text-xs text-slate-400 font-medium italic flex justify-between items-center">
                                        <span>Par : {post.author}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4"/> Documents de Référence
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                        {documents.length === 0 && <div className="text-center text-sm text-slate-400 py-4 bg-white dark:bg-slate-800 rounded-lg">Aucun document partagé.</div>}
                        {documents.map((doc) => {
                            const isNew = isItemNew('docs', doc.id, doc.date);
                            return (
                                <div 
                                    key={doc.id} 
                                    onClick={() => markItemSeen(doc.id)}
                                    className={`relative flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border transition-all ${
                                        isNew 
                                            ? 'border-blue-400 dark:border-blue-600 ring-1 ring-blue-400/30' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded shrink-0 relative">
                                            <FileText className="w-4 h-4"/>
                                            {isNew && (
                                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-800 animate-ping"></span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate flex items-center gap-2">
                                                {doc.title}
                                                {doc.adminOnly && <Lock className="w-3 h-3 text-red-500"/>}
                                                {isNew && (
                                                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shadow-xs shrink-0">
                                                        Nouveau
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">{doc.category}</div>
                                        </div>
                                    </div>
                                    <a 
                                        href={doc.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        onClick={() => markItemSeen(doc.id)}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors shrink-0"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

