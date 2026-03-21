
import React, { useState, useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import { Victim, Outcome, TriageColor } from '../types';
import { Siren, X, Check, Barcode } from 'lucide-react';
import { generateUUID } from '../utils/security';

interface NoviModalProps {
  isOpen: boolean;
  eventId: string;
  onClose: () => void;
  onVictimAdded: (v: Victim) => void;
}

export const NoviModal: React.FC<NoviModalProps> = ({ isOpen, eventId, onClose, onVictimAdded }) => {
    const [sinusId, setSinusId] = useState('');
    const [counter, setCounter] = useState(0);
    const [lastAction, setLastAction] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, counter]);

    if (!isOpen) return null;

    const handleTriage = async (color: TriageColor, outcome: Outcome = Outcome.TREATMENT_IN_PROGRESS) => {
        const nowVal = new Date();
        const finalBib = sinusId.trim() || `NOVI-${Math.floor(Math.random() * 1000)}`;
        const newVictim: Victim = {
            id: generateUUID(),
            eventId: eventId,
            bibNumber: finalBib,
            fullName: `Victime ${finalBib}`,
            reason: 'PLAN NOVI - TRIAGE INITIAL',
            careProvided: 'Catégorisation',
            allergies: '', treatments: '',
            outcome: outcome,
            arrivalTime: nowVal.toISOString(),
            triageColor: color,
            isAdvancedMode: false
        };
        try {
            await storageService.addVictim(newVictim);
            onVictimAdded(newVictim);
            setCounter(c => c + 1);
            setLastAction(`${finalBib} : ${color}`);
            setSinusId('');
            if (navigator.vibrate) navigator.vibrate(100);
        } catch (e) { alert("Erreur sauvegarde triage"); }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col h-[100dvh] animate-in slide-in-from-bottom duration-300">
            <div className="bg-red-700 text-white p-4 flex justify-between items-center shadow-2xl z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-full animate-pulse"><Siren className="w-6 h-6" /></div>
                    <div><h2 className="text-xl font-black uppercase tracking-tighter leading-none">PLAN NOVI</h2><span className="text-[10px] font-mono opacity-80">MODE DÉGRADÉ / MASSIF</span></div>
                </div>
                <div className="text-right"><div className="text-xs opacity-70 uppercase">Victimes triées</div><div className="text-2xl font-black font-mono">{counter}</div></div>
            </div>
            <div className="p-4 bg-slate-900 border-b border-slate-800 shrink-0">
                <label className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center gap-2"><Barcode className="w-4 h-4" /> N° Bracelet / SINUS (Optionnel)</label>
                <div className="flex gap-2">
                    <input ref={inputRef} type="text" value={sinusId} onChange={(e) => setSinusId(e.target.value)} className="flex-1 bg-slate-800 border-2 border-slate-700 text-white text-xl font-mono p-3 rounded-xl focus:border-blue-500 focus:outline-none placeholder-slate-600 uppercase" placeholder="Scanner ou saisir..." autoComplete="off" />
                    {sinusId && <button onClick={() => setSinusId('')} className="bg-slate-800 text-slate-400 p-3 rounded-xl border border-slate-700"><X className="w-6 h-6" /></button>}
                </div>
                {lastAction && <div className="mt-2 text-center text-xs font-bold text-emerald-500 flex items-center justify-center gap-1 animate-in fade-in zoom-in"><Check className="w-3 h-3" /> Dernier ajout : {lastAction}</div>}
            </div>
            <div className="flex-1 p-4 grid grid-cols-2 gap-4 overflow-y-auto min-h-0">
                <button onClick={() => handleTriage(TriageColor.UA)} className="bg-red-600 hover:bg-red-500 active:scale-95 transition-all rounded-2xl flex flex-col items-center justify-center p-4 shadow-lg shadow-red-900/20 border-b-8 border-red-800"><span className="text-4xl font-black text-white mb-1">UA</span><span className="text-xs font-bold text-red-100 uppercase tracking-widest">Urgence Absolue</span></button>
                <button onClick={() => handleTriage(TriageColor.UR)} className="bg-yellow-500 hover:bg-yellow-400 active:scale-95 transition-all rounded-2xl flex flex-col items-center justify-center p-4 shadow-lg shadow-yellow-900/20 border-b-8 border-yellow-700"><span className="text-4xl font-black text-white mb-1">UR</span><span className="text-xs font-bold text-yellow-100 uppercase tracking-widest">Urgence Relative</span></button>
                <button onClick={() => handleTriage(TriageColor.UIP)} className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all rounded-2xl flex flex-col items-center justify-center p-4 shadow-lg shadow-emerald-900/20 border-b-8 border-emerald-800"><span className="text-4xl font-black text-white mb-1">UIP</span><span className="text-xs font-bold text-emerald-100 uppercase tracking-widest">Impliqué / Valide</span></button>
                <button onClick={() => handleTriage(TriageColor.DCD, Outcome.DECEASED)} className="bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all rounded-2xl flex flex-col items-center justify-center p-4 shadow-lg shadow-black/40 border-b-8 border-slate-900"><span className="text-4xl font-black text-white mb-1">DCD</span><span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Décédé</span></button>
            </div>
            <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 pb-safe mb-4">
                <button onClick={onClose} className="w-full py-4 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">TERMINER LE TRIAGE</button>
            </div>
        </div>
    );
};
