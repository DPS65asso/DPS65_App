
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Settings, X } from 'lucide-react';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xs w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 my-auto">
                <div className="p-3.5 bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between border-b border-blue-800/80">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <Settings className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Capacité du Poste</span>
                    </div>
                    <button type="button" onClick={onCancel} className="p-1 text-slate-300 hover:text-white rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Nombre de Brancards</label>
                        <input type="number" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500" value={localConfig.totalStretchers} onChange={e => setLocalConfig({...localConfig, totalStretchers: parseInt(e.target.value) || 0})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Nombre de Chaises</label>
                        <input type="number" className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500" value={localConfig.totalChairs} onChange={e => setLocalConfig({...localConfig, totalChairs: parseInt(e.target.value) || 0})} />
                    </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel} className="text-xs py-1.5 px-3 rounded-lg border-slate-300 dark:border-slate-700">Annuler</Button>
                    <Button onClick={() => onSave(localConfig)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5 px-4 font-bold rounded-lg">Sauvegarder</Button>
                </div>
            </div>
        </div>
    );
};
