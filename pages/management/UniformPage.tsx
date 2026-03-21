
import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { authService } from '../../services/authService';
import { exportService } from '../../services/exportService';
import { UserUniformData, UniformSizes, UniformItem } from '../../types';
import { Button } from '../../components/Button';
import { Ruler, ShoppingBag, CheckCircle2, Save, Download, Loader2, FileText } from 'lucide-react';

const DEFAULT_SIZES: UniformSizes = { top: '', bottom: '', shoes: '', head: '' };

const DEFAULT_ITEMS: UniformItem[] = [
    { type: 'TSHIRT', label: 'T-Shirt DPS', hasItem: false, requestedQty: 0 },
    { type: 'POLO', label: 'Polo DPS', hasItem: false, requestedQty: 0 },
    { type: 'POLAIRE', label: 'Polaire', hasItem: false, requestedQty: 0 },
    { type: 'SOFTSHELL', label: 'Veste Softshell', hasItem: false, requestedQty: 0 },
    { type: 'PANTALON', label: 'Pantalon Inter', hasItem: false, requestedQty: 0 },
    { type: 'CASQUETTE', label: 'Casquette', hasItem: false, requestedQty: 0 },
    { type: 'CHAUSSURES', label: 'Rangers / Chaussures', hasItem: false, requestedQty: 0 }
];

export const UniformPage: React.FC = () => {
    const { user, isAdmin } = useAuth();
    const [data, setData] = useState<UserUniformData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [activeTab, setActiveTab] = useState<'SIZES' | 'INVENTORY' | 'ORDERS' | 'ADMIN'>('SIZES');

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            const existing = await storageService.getMyUniforms(user.id);
            if (existing) {
                // Merge sécurisé : On s'assure que 'sizes' et 'items' sont bien fusionnés avec les défauts
                // Protection contre existing.items undefined
                const existingItems = existing.items || [];
                const mergedItems = DEFAULT_ITEMS.map(defItem => {
                    const existItem = existingItems.find(i => i.type === defItem.type);
                    return existItem ? existItem : defItem;
                });
                
                setData({ 
                    ...existing, 
                    sizes: { ...DEFAULT_SIZES, ...(existing.sizes || {}) }, // Force les tailles par défaut si manquantes
                    items: mergedItems 
                });
            } else {
                setData({
                    id: user.id,
                    sizes: DEFAULT_SIZES,
                    items: DEFAULT_ITEMS,
                    lastUpdated: Date.now()
                });
            }
        } catch (e) {
            console.error("Error loading uniform data", e);
            setData({
                id: user.id,
                sizes: DEFAULT_SIZES,
                items: DEFAULT_ITEMS,
                lastUpdated: Date.now()
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !data) return;
        setSaving(true);
        try {
            await storageService.saveUniforms(user.id, data);
            alert("Sauvegarde effectuée !");
        } catch (e) {
            alert("Erreur lors de la sauvegarde.");
        } finally {
            setSaving(false);
        }
    };

    const handleAdminExport = async () => {
        setExporting(true);
        try {
            const allUniforms = await storageService.getAllUniforms();
            const allProfiles = await authService.getProfiles();
            
            const { fileName, blob } = await exportService.generateUniformPdf(allProfiles, allUniforms);
            
            // Partage mobile natif si dispo
            const file = new File([blob], fileName, { type: 'application/pdf' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Commande Vestiaire DPS65',
                    text: 'Ci-joint le récapitulatif des commandes.'
                });
            } else {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            alert("Erreur lors de la génération du PDF.");
            console.error(e);
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <Layout title="Vestiaire" hideSync={true}><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></Layout>;
    
    if (!data) return <Layout title="Vestiaire" hideSync={true}><div className="text-center py-20 text-slate-500">Erreur de chargement du profil utilisateur.</div></Layout>;

    return (
        <Layout title="Mon Vestiaire" showBack="/management" hideSync={true}>
            <div className="pb-32 space-y-4">
                
                {/* TABS NAVIGATION */}
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl overflow-x-auto">
                    <button onClick={() => setActiveTab('SIZES')} className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'SIZES' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500'}`}>
                        <Ruler className="w-4 h-4 mx-auto mb-1"/> Mes Tailles
                    </button>
                    <button onClick={() => setActiveTab('INVENTORY')} className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'INVENTORY' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-300' : 'text-slate-500'}`}>
                        <CheckCircle2 className="w-4 h-4 mx-auto mb-1"/> Dotation
                    </button>
                    <button onClick={() => setActiveTab('ORDERS')} className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'ORDERS' ? 'bg-white dark:bg-slate-700 shadow text-orange-600 dark:text-orange-300' : 'text-slate-500'}`}>
                        <ShoppingBag className="w-4 h-4 mx-auto mb-1"/> Commandes
                    </button>
                    {isAdmin && (
                        <button onClick={() => setActiveTab('ADMIN')} className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'ADMIN' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-300' : 'text-slate-500'}`}>
                            <Download className="w-4 h-4 mx-auto mb-1"/> Admin
                        </button>
                    )}
                </div>

                {/* 1. TAILLES */}
                {activeTab === 'SIZES' && (
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-6 animate-in slide-in-from-right">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Ruler className="w-5 h-5 text-blue-500"/> Mes Mensurations</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Haut (T-Shirt, Polo, Veste)</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
                                    value={data.sizes.top}
                                    onChange={e => setData({...data, sizes: {...data.sizes, top: e.target.value}})}
                                >
                                    <option value="">Sélectionner...</option>
                                    {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bas (Pantalon)</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
                                    value={data.sizes.bottom}
                                    onChange={e => setData({...data, sizes: {...data.sizes, bottom: e.target.value}})}
                                >
                                    <option value="">Sélectionner...</option>
                                    {Array.from({length: 16}, (_, i) => 34 + i * 2).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chaussures / Rangers</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
                                    value={data.sizes.shoes}
                                    onChange={e => setData({...data, sizes: {...data.sizes, shoes: e.target.value}})}
                                >
                                    <option value="">Sélectionner...</option>
                                    {Array.from({length: 16}, (_, i) => 35 + i).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tête (Casque/Casquette)</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: 58 ou M"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
                                    value={data.sizes.head || ''}
                                    onChange={e => setData({...data, sizes: {...data.sizes, head: e.target.value}})}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. INVENTAIRE */}
                {activeTab === 'INVENTORY' && (
                    <div className="space-y-3 animate-in slide-in-from-right">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex gap-2">
                            <InfoTip className="w-4 h-4 flex-shrink-0" />
                            Cochez les équipements que vous avez actuellement en votre possession.
                        </div>
                        {data.items.map((item, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                                        checked={item.hasItem}
                                        onChange={e => {
                                            const newItems = [...data.items];
                                            newItems[idx].hasItem = e.target.checked;
                                            if (!e.target.checked) newItems[idx].condition = undefined;
                                            else newItems[idx].condition = 'BON';
                                            setData({...data, items: newItems});
                                        }}
                                    />
                                    <span className={`font-bold ${item.hasItem ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{item.label}</span>
                                </div>
                                
                                {item.hasItem && (
                                    <select 
                                        className={`text-xs font-bold p-1 rounded border outline-none ${
                                            item.condition === 'NEUF' ? 'bg-green-100 text-green-700 border-green-200' :
                                            item.condition === 'BON' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            item.condition === 'USÉ' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                            'bg-red-100 text-red-700 border-red-200'
                                        }`}
                                        value={item.condition}
                                        onChange={e => {
                                            const newItems = [...data.items];
                                            newItems[idx].condition = e.target.value as any;
                                            setData({...data, items: newItems});
                                        }}
                                    >
                                        <option value="NEUF">Neuf</option>
                                        <option value="BON">Bon</option>
                                        <option value="USÉ">Usé</option>
                                        <option value="HS">H.S.</option>
                                    </select>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* 3. COMMANDES */}
                {activeTab === 'ORDERS' && (
                    <div className="space-y-4 animate-in slide-in-from-right">
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800 text-xs text-orange-800 dark:text-orange-300 flex gap-2">
                            <ShoppingBag className="w-4 h-4 flex-shrink-0" />
                            Indiquez les quantités manquantes que vous souhaitez recevoir.
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            {data.items.map((item, idx) => (
                                <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border transition-colors ${item.requestedQty > 0 ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-300 dark:border-orange-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                    <span className="font-bold text-sm text-slate-800 dark:text-white">{item.label}</span>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => {
                                                const newItems = [...data.items];
                                                newItems[idx].requestedQty = Math.max(0, item.requestedQty - 1);
                                                setData({...data, items: newItems});
                                            }}
                                            className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 border shadow-sm font-bold text-slate-500"
                                        >-</button>
                                        <span className={`w-6 text-center font-black ${item.requestedQty > 0 ? 'text-orange-600' : 'text-slate-300'}`}>{item.requestedQty}</span>
                                        <button 
                                            onClick={() => {
                                                const newItems = [...data.items];
                                                newItems[idx].requestedQty = item.requestedQty + 1;
                                                setData({...data, items: newItems});
                                            }}
                                            className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 border shadow-sm font-bold text-slate-500"
                                        >+</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 4. ADMIN */}
                {activeTab === 'ADMIN' && isAdmin && (
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 animate-in slide-in-from-right">
                        <h3 className="font-bold text-purple-600 dark:text-purple-400 mb-4 flex items-center gap-2"><Download className="w-5 h-5"/> Espace Logistique</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                            Générez un rapport PDF contenant l'ensemble des besoins, tailles et demandes de tous les membres pour préparer les commandes groupées.
                        </p>
                        <Button onClick={handleAdminExport} variant="primary" fullWidth disabled={exporting} icon={exporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4"/>}>
                            {exporting ? 'Génération...' : 'Exporter Commandes (PDF)'}
                        </Button>
                    </div>
                )}

                {/* SAVE BAR - FIX Mobile Position (Above Navigation) */}
                {activeTab !== 'ADMIN' && (
                    <div className="fixed bottom-[80px] lg:bottom-0 left-0 w-full p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 z-[150] flex justify-center">
                        <Button 
                            onClick={handleSave} 
                            disabled={saving} 
                            className="w-full max-w-md shadow-xl"
                            icon={saving ? <Loader2 className="animate-spin" /> : <Save />}
                        >
                            {saving ? 'Enregistrement...' : 'Enregistrer mes changements'}
                        </Button>
                    </div>
                )}
            </div>
        </Layout>
    );
};

const InfoTip = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
);
