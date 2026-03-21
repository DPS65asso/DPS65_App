
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Settings } from 'lucide-react';

interface ResourceModalProps {
    isOpen: boolean;
    config: { totalStretchers: number; totalChairs: number };
    onSave: (c: { totalStretchers: number; totalChairs: number }) => void;
    onCancel: () => void;
}

export const ResourceModal: React.FC<ResourceModalProps> = ({ isOpen, config, onSave, onCancel }) => {
    const [localConfig, setLocalConfig] = useState(config);
    useEffect(() => setLocalConfig(config), [config, isOpen]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-xs shadow-xl">
                <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white flex items-center gap-2"><Settings className="w-5 h-5" /> Capacité du Poste</h3>
                <div className="space-y-4 mb-6">
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Nombre de Brancards</label><input type="number" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={localConfig.totalStretchers} onChange={e => setLocalConfig({...localConfig, totalStretchers: parseInt(e.target.value) || 0})} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Nombre de Chaises</label><input type="number" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={localConfig.totalChairs} onChange={e => setLocalConfig({...localConfig, totalChairs: parseInt(e.target.value) || 0})} /></div>
                </div>
                <div className="flex gap-2"><Button fullWidth variant="outline" onClick={onCancel}>Annuler</Button><Button fullWidth onClick={() => onSave(localConfig)}>Sauvegarder</Button></div>
            </div>
        </div>
    );
};
