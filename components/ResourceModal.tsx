
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Settings } from 'lucide-react';
import { Modal } from './Modal';

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
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title="Capacité du Poste"
            icon={<Settings className="w-4 h-4 text-emerald-400 shrink-0" />}
            maxWidth="max-w-xs"
            footer={
                <>
                    <Button variant="outline" onClick={onCancel} className="text-xs py-2 px-3.5 rounded-xl border-slate-300 dark:border-slate-700 min-h-[40px]">
                        Annuler
                    </Button>
                    <Button onClick={() => onSave(localConfig)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 px-4 font-bold rounded-xl shadow-md shadow-emerald-600/20 min-h-[40px]">
                        Sauvegarder
                    </Button>
                </>
            }
        >
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Nombre de Brancards</label>
                    <input type="number" min="0" className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={localConfig.totalStretchers} onChange={e => setLocalConfig({...localConfig, totalStretchers: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Nombre de Chaises</label>
                    <input type="number" min="0" className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={localConfig.totalChairs} onChange={e => setLocalConfig({...localConfig, totalChairs: parseInt(e.target.value) || 0})} />
                </div>
            </div>
        </Modal>
    );
};

