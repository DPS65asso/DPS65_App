
import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { Bag, BagType, BagItem } from '../../types';
import { bagService } from '../../services/bagService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/Button';
import { Search, Package, AlertTriangle, Plus, CheckCircle2, RotateCcw, Calendar, X, Filter, Trash2, Edit, Info, ArrowRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const BAG_LABELS: Record<string, string> = {
    'LOT_A': 'Lot A (PMA)',
    'LOT_B': 'Lot B (Léger)',
    'LOT_C': 'Lot C (Oxygène)',
    'SAC_IDE': 'Sac IDE (Médical)'
};

const BagCard: React.FC<{ bag: Bag; onClick: () => void; isAssigned: boolean }> = ({ bag, onClick, isAssigned }) => (
    <div 
        onClick={onClick}
        className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98] relative overflow-hidden ${
            isAssigned 
            ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-md' 
            : (bag.type === 'SAC_IDE' ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700')
        }`}
    >
        {isAssigned && <div className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase">Votre Sac</div>}
        
        <div className="flex justify-between items-start">
            <div>
                <h3 className={`font-bold ${isAssigned ? 'text-blue-900' : 'text-slate-800 dark:text-white'}`}>{bag.name}</h3>
                <span className="text-[10px] font-bold uppercase bg-white/50 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 border border-slate-200">
                    {BAG_LABELS[bag.type] || bag.type.replace('_', ' ')}
                </span>
                {bag.description && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic flex items-center gap-1">
                        <Info className="w-3 h-3" /> {bag.description}
                    </p>
                )}
            </div>
            {bag.assignedTeam && bag.assignedTeam !== 'DEPOT' ? (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAssigned ? 'bg-white text-blue-700 border border-blue-200' : 'text-blue-600 bg-blue-100'}`}>
                    {bag.assignedTeam}
                </span>
            ) : (
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Dépôt</span>
            )}
        </div>
    </div>
);

export const BagManagementPage: React.FC = () => {
    const { profile, isAdmin, currentTeam } = useAuth();
    const location = useLocation();
    const [bags, setBags] = useState<Bag[]>([]);
    const [selectedBag, setSelectedBag] = useState<Bag | null>(null);
    const [bagItems, setBagItems] = useState<BagItem[]>([]);
    
    // Modes d'affichage détail
    const [mode, setMode] = useState<'VIEW' | 'CONSUME' | 'RESTOCK' | 'EXPIRY' | 'EDIT'>('CONSUME');
    
    // State pour consommation
    const [consumeItem, setConsumeItem] = useState('');
    const [consumeQty, setConsumeQty] = useState(1);
    const [consumeSearch, setConsumeSearch] = useState(''); // Recherche produit

    // State pour création (Admin)
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newType, setNewType] = useState<BagType>('LOT_A');

    // State pour Renommer (Admin)
    const [isRenamingBag, setIsRenamingBag] = useState(false);
    const [tempBagName, setTempBagName] = useState('');
    const [tempBagDesc, setTempBagDesc] = useState('');
    
    // State pour Ajout Item (Admin)
    const [newItemName, setNewItemName] = useState('');
    const [newItemQty, setNewItemQty] = useState(1);
    const [newItemTarget, setNewItemTarget] = useState(1);
    
    // Admin override filter
    const [showAllBags, setShowAllBags] = useState(false); 

    useEffect(() => {
        loadBags();
    }, [currentTeam]);

    const loadBags = async () => {
        let allBags = await bagService.getBags();
        
        // Filtrage selon rôle (Sécurité métier)
        if (!isAdmin) {
            if (profile?.role === 'secouriste') {
                allBags = allBags.filter(b => b.type !== 'SAC_IDE');
            }
            if (profile?.role === 'infirmier' || profile?.role === 'medecin') {
                allBags = allBags.filter(b => b.type === 'SAC_IDE');
            }
        }
        setBags(allBags.sort((a, b) => a.name.localeCompare(b.name)));

        // AUTO-SELECT LOGIC ADDED HERE
        if (location.state && (location.state as any).autoSelect && currentTeam) {
            const myBag = allBags.find(b => b.assignedTeam === currentTeam);
            if (myBag) {
                handleSelectBag(myBag);
            }
        }
    };

    const handleSelectBag = async (bag: Bag) => {
        const items = await bagService.getBagItems(bag.id);
        setBagItems(items);
        setSelectedBag(bag);
        // OUVERTURE PAR DÉFAUT SUR CONSOMMATION pour faciliter l'opérationnel
        setMode('CONSUME'); 
        setConsumeSearch('');
        setConsumeItem('');
    };

    // --- ACTIONS ---

    const handleAssignTeam = async () => {
        if (!selectedBag) return;
        
        let team = currentTeam;
        if (!team) {
            team = prompt("Nom de l'équipe (ex: Alpha, Bravo) :", "Alpha");
        }

        if (team) {
            // Vérif doublon côté serveur/local avant d'assigner
            const myCurrentBag = bags.find(b => b.assignedTeam === team);
            if (myCurrentBag && myCurrentBag.id !== selectedBag.id) {
                alert(`L'équipe ${team} possède déjà le sac "${myCurrentBag.name}". Impossible d'en cumuler deux.`);
                return;
            }

            await bagService.assignBag(selectedBag.id, team);
            setSelectedBag({ ...selectedBag, assignedTeam: team });
            loadBags();
        }
    };

    const handleReleaseBag = async () => {
        if (!selectedBag) return;
        if(confirm("Confirmer le retour au dépôt ?")) {
            await bagService.assignBag(selectedBag.id, 'DEPOT');
            setSelectedBag(null); // On ferme la vue détail pour retourner à la liste
            loadBags();
        }
    };

    const handleConsume = async () => {
        if (!selectedBag || !consumeItem) return;
        await bagService.logConsumption(
            selectedBag.id, 
            consumeItem, 
            consumeQty, 
            profile?.lastName || 'Anonyme'
        );
        const items = await bagService.getBagItems(selectedBag.id);
        setBagItems(items);
        setConsumeItem('');
        setConsumeQty(1);
        setConsumeSearch('');
        alert("Consommation enregistrée.");
    };

    const handleCreateBag = async () => {
        if(!newName) return;
        await bagService.createBag(newName, newType, newDescription);
        setShowCreate(false);
        setNewName('');
        setNewDescription('');
        loadBags();
    };

    const handleRenameBag = async () => {
        if (!selectedBag || !tempBagName) return;
        await bagService.updateBag(selectedBag.id, { 
            name: tempBagName, 
            description: tempBagDesc 
        });
        setSelectedBag({ ...selectedBag, name: tempBagName, description: tempBagDesc });
        setIsRenamingBag(false);
        loadBags();
    };

    // OPTION B : Validation Ligne par Ligne
    const handleSingleRestock = async (item: BagItem) => {
        await bagService.updateBagItem(item.id, { quantity: item.targetQuantity });
        
        // Refresh local
        setBagItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: item.targetQuantity } : i));
    };

    // --- ADMIN ACTIONS (Delete / Edit) ---
    const handleDeleteBag = async () => {
        if (!selectedBag) return;
        if (confirm(`ATTENTION : Voulez-vous vraiment supprimer le sac "${selectedBag.name}" et tout son historique ? Cette action est irréversible.`)) {
            await bagService.deleteBag(selectedBag.id);
            setSelectedBag(null);
            loadBags();
        }
    };

    const handleUpdateItem = async (itemId: string, field: 'name' | 'quantity' | 'targetQuantity', value: any) => {
        await bagService.updateBagItem(itemId, { [field]: value });
        setBagItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value } : i));
    };

    const handleDeleteItem = async (itemId: string) => {
        if(confirm("Supprimer cet article du sac ?")) {
            await bagService.deleteBagItem(itemId);
            setBagItems(prev => prev.filter(i => i.id !== itemId));
        }
    };

    const handleAddItem = async () => {
        if (!selectedBag || !newItemName) return;
        await bagService.addBagItem(selectedBag.id, { name: newItemName, quantity: newItemQty, targetQuantity: newItemTarget });
        const items = await bagService.getBagItems(selectedBag.id);
        setBagItems(items);
        setNewItemName('');
        setNewItemQty(1);
        setNewItemTarget(1);
    };

    const handleUpdateExpiry = async (itemId: string, date: string) => {
        await bagService.updateExpiryDate(itemId, date);
        setBagItems(prev => prev.map(i => i.id === itemId ? { ...i, expiryDate: date } : i));
    };

    const restockList = bagItems
        .filter(i => i.quantity < i.targetQuantity)
        .sort((a, b) => a.name.localeCompare(b.name));

    // --- LOGIQUE D'AFFICHAGE LISTE ---
    const myBag = currentTeam ? bags.find(b => b.assignedTeam === currentTeam) : null;
    
    let displayedBags = bags;
    
    if (!isAdmin) {
        if (myBag) {
            displayedBags = [myBag];
        } else {
            displayedBags = bags.filter(b => b.assignedTeam === 'DEPOT');
        }
    } else {
        if (showAllBags) {
            displayedBags = bags;
        } else {
            displayedBags = bags;
        }
    }

    const filteredConsumeItems = bagItems.filter(i => 
        i.quantity > 0 && 
        i.name.toLowerCase().includes(consumeSearch.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <Layout title="Gestion des Sacs" showBack="/management" hideSync={true}>
            
            {!selectedBag && (
                <div className="space-y-4 pb-20">
                    {!currentTeam ? (
                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 text-xs text-orange-800 mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4"/>
                            <span>Veuillez choisir votre équipe sur l'accueil pour prendre un sac.</span>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center px-1">
                            <span className="text-xs font-bold text-slate-500 uppercase">
                                Équipe : <span className="text-blue-600">{currentTeam}</span>
                            </span>
                            {isAdmin && (
                                <button 
                                    onClick={() => setShowAllBags(!showAllBags)}
                                    className="text-xs text-blue-600 underline flex items-center gap-1"
                                >
                                    <Filter className="w-3 h-3" /> {showAllBags ? 'Tout voir' : 'Filtrer'}
                                </button>
                            )}
                        </div>
                    )}

                    {!myBag && isAdmin && (
                        <div className="flex gap-2">
                            <Button onClick={() => setShowCreate(true)} variant="secondary" icon={<Plus />} fullWidth>Créer un sac</Button>
                        </div>
                    )}

                    {showCreate && (
                        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl space-y-3 animate-in fade-in border border-slate-200 dark:border-slate-700">
                            <input 
                                type="text" 
                                placeholder="Nom du sac (ex: Sac Alpha)" 
                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" 
                                value={newName} 
                                onChange={e => setNewName(e.target.value)} 
                            />
                            <textarea 
                                placeholder="Description (optionnelle)" 
                                className="w-full p-2 rounded text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" 
                                value={newDescription} 
                                onChange={e => setNewDescription(e.target.value)} 
                                rows={2} 
                            />
                            <select 
                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" 
                                value={newType} 
                                onChange={e => setNewType(e.target.value as any)}
                            >
                                <option value="LOT_A">Lot A (PMA)</option>
                                <option value="LOT_B">Lot B (Léger)</option>
                                <option value="LOT_C">Lot C (Oxygène)</option>
                                <option value="SAC_IDE">Sac IDE (Médical)</option>
                            </select>
                            <div className="flex gap-2">
                                <Button onClick={handleCreateBag} fullWidth>Valider</Button>
                                <Button onClick={() => setShowCreate(false)} variant="outline" fullWidth>Annuler</Button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                        {displayedBags.map(bag => (
                            <BagCard 
                                key={bag.id} 
                                bag={bag} 
                                isAssigned={bag.assignedTeam === currentTeam}
                                onClick={() => handleSelectBag(bag)} 
                            />
                        ))}
                        {displayedBags.length === 0 && <div className="text-center text-slate-400 py-10 text-sm">Aucun sac disponible ou assigné.</div>}
                    </div>
                </div>
            )}

            {selectedBag && (
                <div className="pb-20 space-y-4">
                    
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                                {isRenamingBag ? (
                                    <div className="space-y-2 pr-4">
                                        <input 
                                            type="text" 
                                            className="w-full p-1 text-lg font-bold border rounded dark:bg-slate-700 dark:text-white"
                                            value={tempBagName}
                                            onChange={e => setTempBagName(e.target.value)}
                                            autoFocus
                                        />
                                        <textarea 
                                            className="w-full p-1 text-xs border rounded dark:bg-slate-700 dark:text-white"
                                            value={tempBagDesc}
                                            onChange={e => setTempBagDesc(e.target.value)}
                                            placeholder="Description..."
                                            rows={2}
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <Button size="sm" onClick={handleRenameBag}>Enregistrer</Button>
                                            <Button size="sm" variant="outline" onClick={() => setIsRenamingBag(false)}>Annuler</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-xl font-black text-slate-800 dark:text-white">{selectedBag.name}</h2>
                                        <span className="text-xs text-slate-500 font-mono">ID: {selectedBag.id.slice(0,8)}...</span>
                                        {selectedBag.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">{selectedBag.description}</p>}
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {isAdmin && !isRenamingBag && (
                                    <>
                                        <button 
                                            onClick={() => {
                                                setTempBagName(selectedBag.name);
                                                setTempBagDesc(selectedBag.description || '');
                                                setIsRenamingBag(true);
                                            }} 
                                            className="p-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 rounded-full text-blue-600 transition-colors" 
                                            title="Renommer le sac"
                                        >
                                            <Edit className="w-5 h-5" />
                                        </button>
                                        <button onClick={handleDeleteBag} className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 rounded-full text-red-600 transition-colors" title="Supprimer le sac">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                                <button onClick={() => { setSelectedBag(null); setIsRenamingBag(false); }} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full"><X className="w-5 h-5" /></button>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {selectedBag.assignedTeam === 'DEPOT' ? (
                                <Button onClick={handleAssignTeam} size="sm" fullWidth className="bg-emerald-600 hover:bg-emerald-700" disabled={!currentTeam}>
                                    Prendre ce sac {currentTeam ? `(${currentTeam})` : ''}
                                </Button>
                            ) : (
                                <div className="flex gap-2 w-full">
                                    <div className={`flex-1 border rounded-lg flex items-center justify-center font-bold text-sm ${selectedBag.assignedTeam === currentTeam ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        {selectedBag.assignedTeam === currentTeam ? 'Votre Sac' : `Team: ${selectedBag.assignedTeam}`}
                                    </div>
                                    {(selectedBag.assignedTeam === currentTeam || isAdmin) && (
                                        <Button onClick={handleReleaseBag} variant="outline" size="sm">Rendre</Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg overflow-x-auto">
                        <button onClick={() => setMode('CONSUME')} className={`flex-1 py-2 px-2 text-xs font-bold rounded-md whitespace-nowrap ${mode === 'CONSUME' ? 'bg-white dark:bg-slate-700 shadow text-orange-600 dark:text-orange-300' : 'text-slate-500'}`}>Conso.</button>
                        <button onClick={() => setMode('VIEW')} className={`flex-1 py-2 px-2 text-xs font-bold rounded-md whitespace-nowrap ${mode === 'VIEW' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500'}`}>Contenu</button>
                        <button onClick={() => setMode('RESTOCK')} className={`flex-1 py-2 px-2 text-xs font-bold rounded-md whitespace-nowrap ${mode === 'RESTOCK' ? 'bg-white dark:bg-slate-700 shadow text-red-600 dark:text-red-300' : 'text-slate-500'}`}>Réappro</button>
                        <button onClick={() => setMode('EXPIRY')} className={`flex-1 py-2 px-2 text-xs font-bold rounded-md whitespace-nowrap ${mode === 'EXPIRY' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-300' : 'text-slate-500'}`}>Périmés</button>
                        {isAdmin && <button onClick={() => setMode('EDIT')} className={`flex-1 py-2 px-2 text-xs font-bold rounded-md whitespace-nowrap ${mode === 'EDIT' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500'}`}><Edit className="w-3 h-3 inline mr-1"/> Édition</button>}
                    </div>

                    {mode === 'CONSUME' && (
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm space-y-4 animate-in slide-in-from-right">
                            <h3 className="font-bold text-orange-600 flex items-center gap-2 text-sm uppercase tracking-wider"><Package className="w-4 h-4" /> Sortie de stock</h3>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Rechercher Produit</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="text" 
                                        className="w-full pl-9 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                                        placeholder="Ex: Compresse, Sérum..."
                                        value={consumeSearch}
                                        onChange={e => setConsumeSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-lg custom-scrollbar">
                                {filteredConsumeItems.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-400 italic">Aucun produit trouvé.</div>
                                ) : (
                                    filteredConsumeItems.map(i => (
                                        <button
                                            key={i.id}
                                            onClick={() => setConsumeItem(i.name)}
                                            className={`w-full text-left p-2.5 text-sm flex justify-between items-center border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${consumeItem === i.name ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                                        >
                                            <span>{i.name}</span>
                                            <span className="text-xs bg-slate-200 dark:bg-slate-600 px-1.5 rounded text-slate-600 dark:text-slate-300">x{i.quantity}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Sélection : <span className="text-slate-800 dark:text-white">{consumeItem || '-'}</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setConsumeQty(Math.max(1, consumeQty - 1))} className="w-10 h-10 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg font-bold shadow-sm">-</button>
                                    <span className="flex-1 text-center text-xl font-black text-slate-800 dark:text-white">{consumeQty}</span>
                                    <button onClick={() => setConsumeQty(consumeQty + 1)} className="w-10 h-10 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg font-bold shadow-sm">+</button>
                                </div>
                            </div>
                            <Button onClick={handleConsume} disabled={!consumeItem} fullWidth className="bg-orange-600 hover:bg-orange-700 py-3 shadow-lg shadow-orange-500/20">Valider Sortie</Button>
                        </div>
                    )}

                    {mode === 'VIEW' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                            {bagItems.map(item => (
                                <div key={item.id} className="p-3 border-b border-slate-100 dark:border-slate-700 last:border-0 flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${item.quantity < item.targetQuantity ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {item.quantity} / {item.targetQuantity}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* OPTION B : Validation Ligne par Ligne */}
                    {mode === 'RESTOCK' && (
                        <div className="space-y-3">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2">
                                <RotateCcw className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                Cliquez sur <ArrowRight className="w-3 h-3 inline"/> pour valider le réarmement.
                            </div>
                            
                            {restockList.length === 0 ? (
                                <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-xl">
                                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                                    <span className="font-bold text-green-600">Sac Complet !</span>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-red-200 dark:border-red-900">
                                    {restockList.map((item, idx) => {
                                        // On retrouve l'objet BagItem complet pour la mise à jour
                                        const fullItem = bagItems.find(b => b.name === item.name);
                                        if(!fullItem) return null;

                                        return (
                                            <div key={idx} className="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-red-50/50 dark:bg-red-900/10">
                                                <div className="flex-1">
                                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">{item.name}</span>
                                                    {/* FIX: Calculating missing quantity here directly */}
                                                    <span className="text-[10px] text-red-600 font-bold uppercase">Manque : {item.targetQuantity - item.quantity}</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleSingleRestock(fullItem)}
                                                    className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 px-3 py-2 rounded-lg flex items-center gap-1 hover:bg-green-200 transition-colors shadow-sm"
                                                >
                                                    <span className="text-xs font-bold">AJOUTER</span>
                                                    <ArrowRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'EXPIRY' && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500 italic">Renseignez les dates pour activer les alertes (J-15).</p>
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                                {bagItems.map(item => {
                                    const isExpiring = item.expiryDate && new Date(item.expiryDate) <= new Date(Date.now() + 15 * 86400000);
                                    
                                    return (
                                        <div key={item.id} className="p-3">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.name}</span>
                                                {isExpiring && <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <input 
                                                    type="date" 
                                                    className={`text-xs p-1 rounded border ${isExpiring ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'} dark:bg-slate-900 dark:border-slate-600 dark:text-white`}
                                                    value={item.expiryDate || ''}
                                                    onChange={(e) => handleUpdateExpiry(item.id, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {mode === 'EDIT' && isAdmin && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 italic">
                                Modification directe de l'inventaire de référence.
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                {bagItems.sort((a,b) => a.name.localeCompare(b.name)).map(item => (
                                    <div key={item.id} className="p-2 border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center gap-2">
                                        <div className="flex-1">
                                            <input 
                                                type="text" 
                                                className="w-full p-1 text-sm border border-transparent hover:border-slate-300 rounded bg-transparent dark:text-white"
                                                value={item.name}
                                                onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex flex-col w-12">
                                            <label className="text-[9px] text-slate-400 text-center">Qté</label>
                                            <input 
                                                type="number" 
                                                className="w-full p-1 text-xs text-center border border-slate-200 dark:border-slate-600 rounded bg-transparent dark:text-white"
                                                value={item.quantity}
                                                onChange={(e) => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value))}
                                            />
                                        </div>
                                        <div className="flex flex-col w-12">
                                            <label className="text-[9px] text-slate-400 text-center">Cible</label>
                                            <input 
                                                type="number" 
                                                className="w-full p-1 text-xs text-center border border-slate-200 dark:border-slate-600 rounded bg-transparent dark:text-white"
                                                value={item.targetQuantity}
                                                onChange={(e) => handleUpdateItem(item.id, 'targetQuantity', parseInt(e.target.value))}
                                            />
                                        </div>
                                        <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-2">Ajouter un article</h4>
                                <div className="flex gap-2 mb-2">
                                    <input type="text" placeholder="Nom produit..." className="flex-1 p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-[9px] text-slate-500 mb-1">Qté Initiale</label>
                                        <input type="number" className="w-full p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white" value={newItemQty} onChange={e => setNewItemQty(parseInt(e.target.value))} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[9px] text-slate-500 mb-1">Qté Cible</label>
                                        <input type="number" className="w-full p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-white" value={newItemTarget} onChange={e => setNewItemTarget(parseInt(e.target.value))} />
                                    </div>
                                    <div className="flex items-end">
                                        <Button onClick={handleAddItem} size="sm" icon={<Plus className="w-4 h-4"/>}>Ajouter</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </Layout>
    );
};
