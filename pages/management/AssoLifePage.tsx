
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Megaphone, FileText, ExternalLink, Lock } from 'lucide-react';
import { adminService } from '../../services/features/adminService';
import { NewsPost, AssociationDocument } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const AssoLifePage: React.FC = () => {
    const { isAdmin } = useAuth();
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
            // Marquer comme vu pour le badge du dashboard
            localStorage.setItem('dps65_seen_docs', (n.length + d.length).toString());

            // Filtre les documents réservés aux admins
            const filteredDocs = d.filter(doc => !doc.adminOnly || isAdmin);
            setDocuments(filteredDocs);
        } catch (e) {
            console.error("Erreur chargement vie asso", e);
        }
    };

    return (
        <Layout title="Vie de l'Association" showBack="/management" hideSync={true}>
            <div className="space-y-6 pb-20">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider flex items-center gap-2"><Megaphone className="w-4 h-4"/> Dernières Infos</h3>
                    </div>
                    <div className="space-y-3">
                        {news.length === 0 && <div className="text-center text-sm text-slate-400 py-4">Aucune actualité récente.</div>}
                        {news.map(post => (
                            <div key={post.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border ${post.isUrgent ? 'border-red-500 border-l-4' : 'border-slate-200 dark:border-slate-700'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className={`font-bold ${post.isUrgent ? 'text-red-600' : 'text-slate-800 dark:text-white'}`}>{post.title}</h4>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">{new Date(post.date).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{post.content}</p>
                                <div className="mt-3 text-xs text-slate-400 font-medium italic">Par : {post.author}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider mb-2 flex items-center gap-2"><FileText className="w-4 h-4"/> Documents de Référence</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {documents.length === 0 && <div className="text-center text-sm text-slate-400 py-4 bg-white dark:bg-slate-800 rounded-lg">Aucun document partagé.</div>}
                        {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded shrink-0"><FileText className="w-4 h-4"/></div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate flex items-center gap-2">
                                            {doc.title}
                                            {doc.adminOnly && <Lock className="w-3 h-3 text-red-500"/>}
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">{doc.category}</div>
                                    </div>
                                </div>
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors shrink-0"><ExternalLink className="w-4 h-4" /></a>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Layout>
    );
};
