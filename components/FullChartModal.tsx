
import React, { useState } from 'react';
import { Activity, X } from 'lucide-react';
import { VitalSign } from '../types';

export const FullChartModal: React.FC<{ vitals: VitalSign[], onClose: () => void }> = ({ vitals, onClose }) => {
    const [visible, setVisible] = useState({
        pulse: true,
        bp: true,
        sao2: true,
        glycemia: false,
        temp: false,
        eva: false
    });

    const sortedVitals = [...vitals].sort((a,b) => a.time.localeCompare(b.time));
    const labels = sortedVitals.map(v => v.time);

    // Helper pour normaliser les données sur une échelle 0-100 pour l'affichage SVG
    const getPoints = (key: 'pulse' | 'sao2' | 'bp' | 'glycemia' | 'temp' | 'eva', maxVal: number) => {
        return sortedVitals.map((v, i) => {
            let val = 0;
            if (key === 'bp') val = parseInt(v.bp?.split('/')[0] || '0');
            else if (key === 'glycemia') val = parseFloat(v.glycemia?.replace(',','.') || '0') * 100; // Echelle adaptée
            else if (key === 'temp') val = parseFloat(v.temp?.replace(',','.') || '0');
            else if (key === 'eva') val = parseInt(v.eva || '0') * 10; // Echelle 0-100
            else val = parseInt((v as any)[key] || '0');

            if (!val) return null; // Skip empty points

            const x = (i / (sortedVitals.length - 1)) * 100;
            const y = 100 - ((val / maxVal) * 100); 
            return `${x},${y}`;
        }).filter(p => p !== null).join(' ');
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col p-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2"><Activity className="w-5 h-5"/> Moniteur Multiparamétrique</h3>
                <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700"><X className="w-6 h-6"/></button>
            </div>

            <div className="flex-1 bg-black/50 rounded-xl border border-slate-700 relative mb-4 p-4 overflow-hidden">
                {/* Grille de fond */}
                <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
                    <defs>
                        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="gray" strokeWidth="0.5"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    {visible.pulse && <polyline points={getPoints('pulse', 180)} fill="none" stroke="#ef4444" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
                    {visible.sao2 && <polyline points={getPoints('sao2', 100)} fill="none" stroke="#06b6d4" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
                    {visible.bp && <polyline points={getPoints('bp', 220)} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
                    {visible.glycemia && <polyline points={getPoints('glycemia', 400)} fill="none" stroke="#eab308" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="4" />}
                    {visible.temp && <polyline points={getPoints('temp', 42)} fill="none" stroke="#a855f7" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
                    {visible.eva && <polyline points={getPoints('eva', 100)} fill="none" stroke="#f97316" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="2" />}
                </svg>
                
                {/* Labels Temps en bas */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-[10px] text-slate-500 font-mono">
                    {labels.map((l, i) => (i === 0 || i === labels.length -1 || i % 2 === 0) && <span key={i}>{l}</span>)}
                </div>
            </div>

            {/* Légende Interactive */}
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setVisible(p => ({...p, pulse: !p.pulse}))} className={`p-2 rounded border text-xs font-bold ${visible.pulse ? 'bg-red-900/30 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>FC (bpm)</button>
                <button onClick={() => setVisible(p => ({...p, sao2: !p.sao2}))} className={`p-2 rounded border text-xs font-bold ${visible.sao2 ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>SpO2 (%)</button>
                <button onClick={() => setVisible(p => ({...p, bp: !p.bp}))} className={`p-2 rounded border text-xs font-bold ${visible.bp ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>TA (sys)</button>
                <button onClick={() => setVisible(p => ({...p, glycemia: !p.glycemia}))} className={`p-2 rounded border text-xs font-bold ${visible.glycemia ? 'bg-yellow-900/30 border-yellow-500 text-yellow-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>Glycémie</button>
                <button onClick={() => setVisible(p => ({...p, temp: !p.temp}))} className={`p-2 rounded border text-xs font-bold ${visible.temp ? 'bg-purple-900/30 border-purple-500 text-purple-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>Temp (°C)</button>
                <button onClick={() => setVisible(p => ({...p, eva: !p.eva}))} className={`p-2 rounded border text-xs font-bold ${visible.eva ? 'bg-orange-900/30 border-orange-500 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>EVA (x10)</button>
            </div>
        </div>
    );
};
