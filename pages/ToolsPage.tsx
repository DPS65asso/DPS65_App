import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout';
import { ChevronDown, ChevronUp, Activity, Brain, Baby, HeartPulse, Heart, Flame, Timer, ClipboardList, AlertTriangle, Wind, Calculator, Syringe, Stethoscope, Search, ShieldCheck, Scale, FileText, Zap, Radio, CheckCircle, Table, Thermometer, Droplet, UserMinus, Lightbulb, Languages, ArrowRightLeft, Plane, X, Volume2, Settings2 } from 'lucide-react';
import { PISU_PROTOCOLS, Protocol } from '../data/pisuData';
import { useAuth } from '../context/AuthContext';
import { Metronome } from '../components/Metronome';

const ToolCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-3 transition-colors">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="text-blue-600 dark:text-blue-400">{icon}</div>
                    <span className="font-bold text-slate-800 dark:text-white text-left">{title}</span>
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
            </button>
            {isOpen && <div className="p-4 border-t border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2">{children}</div>}
        </div>
    );
};

const SectionHeader: React.FC<{ title: string; color?: string }> = ({ title, color = "bg-slate-200" }) => (
    <div className="flex items-center gap-3 mt-8 mb-4 px-1">
        <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">{title}</h3>
        <div className={`h-0.5 flex-1 rounded-full ${color} dark:bg-slate-700`}></div>
    </div>
);

// --- COMPOSANTS OUTILS EXTRAITS ---

const XAbcdeMemo = () => (
    <div className="space-y-2 text-sm">
        <div className="flex items-start gap-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500"><span className="font-black text-red-600 text-lg w-6">X</span><div><strong className="block text-slate-900 dark:text-slate-100">Hémorragie Exsanguinante</strong><span className="text-slate-700 dark:text-slate-300">Arrêt immédiat (Garrot, Compression).</span></div></div>
        <div className="flex items-start gap-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500"><span className="font-black text-blue-600 text-lg w-6">A</span><div><strong className="block text-slate-900 dark:text-slate-100">Airway (Voies Aériennes)</strong><span className="text-slate-700 dark:text-slate-300">Liberté (LVA), Collier cervical si trauma.</span></div></div>
        <div className="flex items-start gap-3 p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border-l-4 border-cyan-500"><span className="font-black text-cyan-600 text-lg w-6">B</span><div><strong className="block text-slate-900 dark:text-slate-100">Breathing (Respiration)</strong><span className="text-slate-700 dark:text-slate-300">Freq, Ampli, Saturation, Cyanose. O2 si besoin.</span></div></div>
        <div className="flex items-start gap-3 p-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg border-l-4 border-pink-500"><span className="font-black text-pink-600 text-lg w-6">C</span><div><strong className="block text-slate-900 dark:text-slate-100">Circulation</strong><span className="text-slate-700 dark:text-slate-300">Pouls, TA, TRC, Marbrures, Hémorragies secondaires.</span></div></div>
        <div className="flex items-start gap-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-500"><span className="font-black text-yellow-600 text-lg w-6">D</span><div><strong className="block text-slate-900 dark:text-slate-100">Disability (Neuro)</strong><span className="text-slate-700 dark:text-slate-300">Glasgow, Pupilles, Motricité, Glycémie.</span></div></div>
        <div className="flex items-start gap-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500"><span className="font-black text-green-600 text-lg w-6">E</span><div><strong className="block text-slate-900 dark:text-slate-100">Exposure (Environnement)</strong><span className="text-slate-700 dark:text-slate-300">Trauma complet, Hypothermie (couvrir), Pudeur.</span></div></div>
    </div>
);

const GlasgowCalc = () => {
    const [glasgow, setGlasgow] = useState({ eye: 4, verbal: 5, motor: 6 });
    const glasgowScore = glasgow.eye + glasgow.verbal + glasgow.motor;
    return (
        <div className="space-y-4">
             <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-700 p-3 rounded-lg"><span className="font-bold text-slate-700 dark:text-slate-200">Score Total</span><span className={`text-2xl font-bold px-3 py-1 rounded ${glasgowScore <= 8 ? 'bg-red-500 text-white' : (glasgowScore <= 12 ? 'bg-orange-500 text-white' : 'bg-green-500 text-white')}`}>{glasgowScore} / 15</span></div>
             {[{label: 'Ouverture des Yeux (Y)', key: 'eye', vals: {4:'Spontanée', 3:'À la demande', 2:'À la douleur', 1:'Absente'}}, {label: 'Réponse Verbale (V)', key: 'verbal', vals: {5:'Orientée', 4:'Confuse', 3:'Inappropriée', 2:'Incompréhensible', 1:'Absente'}}, {label: 'Réponse Motrice (M)', key: 'motor', vals: {6:'À la demande', 5:'Orientée', 4:'Évitement', 3:'Décortication', 2:'Décérébration', 1:'Absente'}}].map((cat: any) => (<div key={cat.key}><h4 className="font-bold text-xs mb-1 text-slate-500">{cat.label}</h4><div className="flex flex-col gap-1">{Object.keys(cat.vals).reverse().map((k: any) => { const v = parseInt(k); return (<button key={v} onClick={() => setGlasgow({...glasgow, [cat.key]: v})} className={`text-left px-3 py-2 rounded text-sm border flex justify-between ${glasgow[cat.key as keyof typeof glasgow] === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300'}`}><span>{cat.vals[v]}</span><span className="font-bold opacity-50">{v}</span></button>); })}</div></div>))}
        </div>
    );
};

const OxygenCalc = () => {
    const [oxy, setOxy] = useState({ vol: 5, bar: 200, flow: 15 });
    const oxyResult = oxy.flow > 0 ? Math.floor((oxy.vol * oxy.bar) / oxy.flow) : 0;
    const oxyHours = Math.floor(oxyResult / 60);
    const oxyMins = oxyResult % 60;
    return (
        <div className="space-y-4">
            <div className="flex gap-2 justify-center mb-2">{[2, 5, 15].map(v => (<button key={v} onClick={() => setOxy({...oxy, vol: v})} className={`px-3 py-1 text-xs rounded-full border ${oxy.vol === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{v} L</button>))}</div>
            <div className="grid grid-cols-3 gap-3"><div><label className="block text-xs font-bold text-slate-500 mb-1">Vol. (L)</label><input type="number" className="w-full p-2 rounded border dark:bg-slate-700 dark:border-slate-600 dark:text-white text-center font-bold" value={oxy.vol} onChange={e => setOxy({...oxy, vol: parseInt(e.target.value)||0})} /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Pression (Bar)</label><input type="number" className="w-full p-2 rounded border dark:bg-slate-700 dark:border-slate-600 dark:text-white text-center font-bold" value={oxy.bar} onChange={e => setOxy({...oxy, bar: parseInt(e.target.value)||0})} /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Débit (L/min)</label><input type="number" className="w-full p-2 rounded border dark:bg-slate-700 dark:border-slate-600 dark:text-white text-center font-bold" value={oxy.flow} onChange={e => setOxy({...oxy, flow: parseInt(e.target.value)||0})} /></div></div>
            <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg flex items-center justify-between border border-slate-200 dark:border-slate-700"><span className="font-bold text-slate-600 dark:text-slate-400 uppercase text-xs">Autonomie estimée</span><div className="text-right"><div className={`text-2xl font-black ${oxyResult < 15 ? 'text-red-600 animate-pulse' : 'text-slate-800 dark:text-white'}`}>{oxyResult} <span className="text-sm font-medium">min</span></div>{oxyHours > 0 && <div className="text-xs text-slate-500">{oxyHours}h {oxyMins}min</div>}</div></div>
        </div>
    );
};

const VitalsActionGuide = () => {
    const [tab, setTab] = useState<'GLY' | 'TAS' | 'SPO2' | 'TEMP' | 'FC'>('GLY');

    const Row = ({ range, action, color }: { range: string, action: React.ReactNode, color: string }) => (
        <div className={`flex flex-col p-3 rounded-lg border mb-2 ${color}`}>
            <div className="font-black text-sm mb-1">{range}</div>
            <div className="text-sm font-medium">{action}</div>
        </div>
    );

    return (
        <div className="space-y-3">
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg overflow-x-auto">
                <button onClick={() => setTab('GLY')} className={`flex-1 py-2 px-2 text-[10px] font-bold rounded uppercase whitespace-nowrap ${tab === 'GLY' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500'}`}>Glycémie</button>
                <button onClick={() => setTab('TAS')} className={`flex-1 py-2 px-2 text-[10px] font-bold rounded uppercase whitespace-nowrap ${tab === 'TAS' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500'}`}>Tension</button>
                <button onClick={() => setTab('SPO2')} className={`flex-1 py-2 px-2 text-[10px] font-bold rounded uppercase whitespace-nowrap ${tab === 'SPO2' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500'}`}>SpO2</button>
                <button onClick={() => setTab('TEMP')} className={`flex-1 py-2 px-2 text-[10px] font-bold rounded uppercase whitespace-nowrap ${tab === 'TEMP' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500'}`}>Temp</button>
                <button onClick={() => setTab('FC')} className={`flex-1 py-2 px-2 text-[10px] font-bold rounded uppercase whitespace-nowrap ${tab === 'FC' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500'}`}>FC</button>
            </div>

            {tab === 'GLY' && (
                <div className="animate-in fade-in">
                    <Row 
                        range="< 0.80 g/L (Hypoglycémie)" 
                        action={<ul className="list-disc pl-4"><li>Conscient : Resucrage (sucre, jus) + Repos.</li><li>Inconscient : PLS, Rien par la bouche, <strong>Appel 15</strong>.</li></ul>}
                        color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300" 
                    />
                    <Row 
                        range="> 2.50 g/L (Hyperglycémie)" 
                        action="Avis 15 requis. Surveillance conscience." 
                        color="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300" 
                    />
                </div>
            )}

            {tab === 'TAS' && (
                <div className="animate-in fade-in">
                    <Row 
                        range="< 90 mmHg (Hypotension)" 
                        action="Allonger, Surélever les jambes (sauf gêne respi)." 
                        color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300" 
                    />
                    <Row 
                        range="> 180 mmHg (Hypertension)" 
                        action="Position demi-assise (ou confort), Repos, Avis 15." 
                        color="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300" 
                    />
                </div>
            )}

            {tab === 'SPO2' && (
                <div className="animate-in fade-in">
                    <Row 
                        range="< 94 %" 
                        action="Position demi-assise. O2 si habilité (Masque HC)." 
                        color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300" 
                    />
                    <Row 
                        range="< 90 % (Détresse Grave)" 
                        action={<span><strong>Appel 15 Immédiat</strong>. O2 15 L/min.</span>}
                        color="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300" 
                    />
                </div>
            )}

            {tab === 'TEMP' && (
                <div className="animate-in fade-in">
                    <Row 
                        range="< 35°C (Hypothermie)" 
                        action="Isoler du sol, Couverture de survie, Manipulations douces." 
                        color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300" 
                    />
                    <Row 
                        range="> 39°C (Hyperthermie)" 
                        action={
                            <ul className="list-disc pl-4">
                                <li>Découvrir la victime (laisser en sous-vêtements).</li>
                                <li>Refroidissement actif : brumisation + ventilation.</li>
                                <li>Draps humides ou poches de glace (creux axillaires/inguinaux).</li>
                                <li>Hydratation si conscient. <strong>Avis 15 systématique</strong>.</li>
                            </ul>
                        }
                        color="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300" 
                    />
                </div>
            )}

            {tab === 'FC' && (
                <div className="animate-in fade-in">
                    <Row 
                        range="< 50 ou > 100 bpm" 
                        action={<span>Mise au repos strict. <strong>Avis 15 systématique</strong>.</span>}
                        color="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300" 
                    />
                </div>
            )}
        </div>
    );
};

const VitalsTable = () => (
    <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
            <thead>
                <tr className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    <th className="p-2 border dark:border-slate-600">ÂGE</th>
                    <th className="p-2 border dark:border-slate-600">FC (BPM)</th>
                    <th className="p-2 border dark:border-slate-600">FR (CPM)</th>
                    <th className="p-2 border dark:border-slate-600">TAS (MMHG)</th>
                </tr>
            </thead>
            <tbody>
                <tr className="border-b dark:border-slate-700"><td className="p-2 font-bold">Nouveau-né</td><td>120-160</td><td>40-60</td><td>60-80</td></tr>
                <tr className="border-b dark:border-slate-700"><td className="p-2 font-bold">1 an</td><td>100-140</td><td>30-40</td><td>80-90</td></tr>
                <tr className="border-b dark:border-slate-700"><td className="p-2 font-bold">3-5 ans</td><td>90-120</td><td>25-30</td><td>90-100</td></tr>
                <tr className="border-b dark:border-slate-700"><td className="p-2 font-bold">10 ans</td><td>80-100</td><td>20</td><td>100-110</td></tr>
                <tr className="border-b dark:border-slate-700"><td className="p-2 font-bold">Adulte</td><td>60-100</td><td>12-20</td><td>110-140</td></tr>
                <tr><td className="p-2 font-bold">Sénior</td><td>60-100</td><td>12-20</td><td>120-150</td></tr>
            </tbody>
        </table>
    </div>
);

const PediaHelp = () => {
    const [age, setAge] = useState<number | ''>('');
    const [weight, setWeight] = useState<number | ''>('');

    const calculateWeight = (ageVal: number) => (ageVal + 4) * 2;

    const handleAgeChange = (val: string) => {
        const v = val === '' ? '' : parseInt(val);
        setAge(v);
        if (typeof v === 'number' && v > 0) {
            setWeight(calculateWeight(v));
        } else {
            setWeight('');
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Âge (ans)</label>
                    <input type="number" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="Ex: 5" value={age} onChange={e => handleAgeChange(e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Poids (kg)</label>
                    <input type="number" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold text-blue-600" placeholder="Ex: 18" value={weight} onChange={e => setWeight(e.target.value === '' ? '' : parseFloat(e.target.value))} />
                </div>
            </div>
            
            {weight && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700 space-y-2 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-800 pb-1">
                        <span className="text-slate-600 dark:text-slate-400">Adrénaline (ACR)</span>
                        <span className="font-bold text-slate-800 dark:text-white">{(weight * 0.01).toFixed(2)} mg</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-800 pb-1">
                        <span className="text-slate-600 dark:text-slate-400">Choc électrique</span>
                        <span className="font-bold text-slate-800 dark:text-white">{(weight * 4).toFixed(0)} J</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-800 pb-1">
                        <span className="text-slate-600 dark:text-slate-400">Paracétamol (15mg/kg)</span>
                        <span className="font-bold text-slate-800 dark:text-white">{(weight * 15).toFixed(0)} mg</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Remplissage (20ml/kg)</span>
                        <span className="font-bold text-slate-800 dark:text-white">{(weight * 20).toFixed(0)} ml</span>
                    </div>
                </div>
            )}
            {!weight && <div className="text-center text-xs text-slate-400 italic">Entrez un âge ou un poids pour voir les doses.</div>}
        </div>
    );
};

const SilvermanScore = () => {
    const [scores, setScores] = useState({ bal: 0, tir: 0, ent: 0, bat: 0, gein: 0 });
    const total = (Object.values(scores) as number[]).reduce((a, b) => a + b, 0);
    
    const Row = ({ label, val, set }: any) => (
        <div className="flex flex-col mb-2">
            <span className="text-xs font-bold text-slate-500 mb-1">{label}</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                {[0, 1, 2].map(v => (
                    <button key={v} onClick={() => set(v)} className={`flex-1 py-2 text-xs font-bold ${val === v ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{v}</button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-2">
            <div className="text-xs italic text-slate-400 mb-2">0 (Normal) à 10 (Détresse majeure).</div>
            <Row label="Balancement Thoraco-Abdominal" val={scores.bal} set={(v: number) => setScores({...scores, bal: v})} />
            <Row label="Tirage Intercostal" val={scores.tir} set={(v: number) => setScores({...scores, tir: v})} />
            <Row label="Entonnoir Xyphoïdien" val={scores.ent} set={(v: number) => setScores({...scores, ent: v})} />
            <Row label="Battement des ailes du nez" val={scores.bat} set={(v: number) => setScores({...scores, bat: v})} />
            <Row label="Geignement Expiratoire" val={scores.gein} set={(v: number) => setScores({...scores, gein: v})} />
            <div className="mt-3 bg-slate-100 dark:bg-slate-900 p-3 rounded-lg flex justify-between items-center border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-200">Score de Silverman</span>
                <span className={`text-xl font-black ${total > 3 ? 'text-red-600' : 'text-green-600'}`}>{total} / 10</span>
            </div>
        </div>
    );
};

const ApgarScore = () => {
    const [scores, setScores] = useState({ app: 0, pouls: 0, grim: 0, act: 0, resp: 0 });
    const total = (Object.values(scores) as number[]).reduce((a, b) => a + b, 0);

    const Row = ({ label, val, set, options }: any) => (
        <div className="flex flex-col mb-2">
            <span className="text-xs font-bold text-slate-500 mb-1">{label}</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                {options.map((opt: string, i: number) => (
                    <button key={i} onClick={() => set(i)} className={`flex-1 py-2 px-1 text-[9px] font-bold leading-tight ${val === i ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                        {i}: {opt}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-2">
            <Row label="Apparence (Coloration)" val={scores.app} set={(v: number) => setScores({...scores, app: v})} options={["Bleu/Pâle", "Corps rose, Ext. bleues", "Tout rose"]} />
            <Row label="Pouls (Fréquence Cardiaque)" val={scores.pouls} set={(v: number) => setScores({...scores, pouls: v})} options={["Absent", "< 100 bpm", "> 100 bpm"]} />
            <Row label="Grimace (Réactivité)" val={scores.grim} set={(v: number) => setScores({...scores, grim: v})} options={["Nulle", "Grimace/Faible", "Cris/Toux"]} />
            <Row label="Activité (Tonus)" val={scores.act} set={(v: number) => setScores({...scores, act: v})} options={["Flasque", "Légère flexion", "Mouvements actifs"]} />
            <Row label="Respiration" val={scores.resp} set={(v: number) => setScores({...scores, resp: v})} options={["Absente", "Lente/Irrégulière", "Vigoureuse/Cris"]} />
            
            <div className="mt-3 p-3 rounded-lg flex justify-between items-center border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
                <span className="font-bold text-slate-700 dark:text-slate-200">Score d'APGAR</span>
                <span className={`text-xl font-black ${total > 7 ? 'text-green-600' : (total < 4 ? 'text-red-600' : 'text-orange-500')}`}>{total} / 10</span>
            </div>
        </div>
    );
};

const MalinaAlcoholScore = () => {
    const [checks, setChecks] = useState({
        haleine: false,
        propos: false,
        equilibre: false,
        vigilance: false
    });

    const toggle = (key: keyof typeof checks) => setChecks(p => ({...p, [key]: !p[key]}));
    const count = Object.values(checks).filter(Boolean).length;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
                <button onClick={() => toggle('haleine')} className={`p-3 rounded-lg border text-sm font-bold flex justify-between items-center ${checks.haleine ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    <span>Haleine éthylique</span>
                    {checks.haleine && <CheckCircle className="w-4 h-4" />}
                </button>
                <button onClick={() => toggle('propos')} className={`p-3 rounded-lg border text-sm font-bold flex justify-between items-center ${checks.propos ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    <span>Propos incohérents / Pâteux</span>
                    {checks.propos && <CheckCircle className="w-4 h-4" />}
                </button>
                <button onClick={() => toggle('equilibre')} className={`p-3 rounded-lg border text-sm font-bold flex justify-between items-center ${checks.equilibre ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    <span>Troubles de l'équilibre</span>
                    {checks.equilibre && <CheckCircle className="w-4 h-4" />}
                </button>
                <button onClick={() => toggle('vigilance')} className={`p-3 rounded-lg border text-sm font-bold flex justify-between items-center ${checks.vigilance ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    <span>Somnolence / Agitation</span>
                    {checks.vigilance && <CheckCircle className="w-4 h-4" />}
                </button>
            </div>
            
            <div className={`p-4 rounded-xl border flex justify-between items-center ${count > 0 ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                <span className="text-sm font-bold uppercase">Signes Positifs</span>
                <span className="text-2xl font-black">{count} / 4</span>
            </div>
            
            {count >= 3 && (
                <div className="text-xs bg-red-100 text-red-800 p-2 rounded font-bold text-center border border-red-200">
                    Suspicion Intoxication Éthylique Aiguë (IEA).<br/>Surveillance PLS si inconscient.
                </div>
            )}
        </div>
    );
};

const WallaceCalculator = () => {
    const [zones, setZones] = useState({
        head: false, torso: false, back: false, armL: false, armR: false, legL: false, legR: false, genitals: false
    });
    
    const toggle = (key: keyof typeof zones) => setZones(p => ({...p, [key]: !p[key]}));
    
    const total = 
        (zones.head ? 9 : 0) + 
        (zones.torso ? 18 : 0) + 
        (zones.back ? 18 : 0) + 
        (zones.armL ? 9 : 0) + 
        (zones.armR ? 9 : 0) + 
        (zones.legL ? 18 : 0) + 
        (zones.legR ? 18 : 0) + 
        (zones.genitals ? 1 : 0);

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => toggle('head')} className={`p-2 rounded border text-sm font-bold ${zones.head ? 'bg-red-500 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-700 dark:border-slate-600'}`}>Tête (9%)</button>
                <button onClick={() => toggle('genitals')} className={`p-2 rounded border text-sm font-bold ${zones.genitals ? 'bg-red-500 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-700 dark:border-slate-600'}`}>Organes (1%)</button>
                <button onClick={() => toggle('armL')} className={`p-2 rounded border text-sm font-bold ${zones.armL ? 'bg-red-500 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-700 dark:border-slate-600'}`}>Bras G (9%)</button>
                <button onClick={() => toggle('armR')} className={`p-2 rounded border text-sm font-bold ${zones.armR ? 'bg-red-500 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-700 dark:border-slate-600'}`}>Bras D (9%)</button>
                <button onClick={() => toggle('torso')} className={`p-2 rounded border text-sm font-bold ${zones.torso ? 'bg-red-500 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-700 dark:border-slate-600'}`}>Torse (18%)</button>
                <button onClick={() => toggle('back')} className={`p-2 rounded border text-sm font-bold ${zones.back ? 'bg-red-500 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-700 dark:border-slate-600'}`}>Dos (18%)</button>
                <button onClick={() => toggle('legL')} className={`p-2 rounded border text-sm font-bold ${zones.legL ? 'bg-red-500 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-700 dark:border-slate-600'}`}>Jambe G (18%)</button>
                <button onClick={() => toggle('legR')} className={`p-2 rounded border text-sm font-bold ${zones.legR ? 'bg-red-500 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-700 dark:border-slate-600'}`}>Jambe D (18%)</button>
            </div>
            <div className="bg-slate-800 text-white p-3 rounded-xl flex justify-between items-center">
                <span className="font-bold uppercase text-xs">Total Surface</span>
                <span className={`text-xl font-black ${total > 15 ? 'text-red-500' : 'text-white'}`}>{total} %</span>
            </div>
            {total > 15 && <div className="text-xs text-red-600 font-bold bg-red-100 p-2 rounded">Attention : Brûlure Grave (Adulte {'>'} 15%). Appel 15 Requis.</div>}
        </div>
    );
};

const FastCheck = () => (
    <div className="space-y-2">
        <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="bg-slate-200 dark:bg-slate-700 w-8 h-8 flex items-center justify-center rounded font-black text-slate-600 dark:text-slate-300">F</div>
            <div><strong className="block text-sm">Face (Visage)</strong><span className="text-xs text-slate-500">Demander de sourire. Asymétrie ?</span></div>
        </div>
        <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="bg-slate-200 dark:bg-slate-700 w-8 h-8 flex items-center justify-center rounded font-black text-slate-600 dark:text-slate-300">A</div>
            <div><strong className="block text-sm">Arms (Bras)</strong><span className="text-xs text-slate-500">Lever les 2 bras. Un bras retombe ?</span></div>
        </div>
        <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="bg-slate-200 dark:bg-slate-700 w-8 h-8 flex items-center justify-center rounded font-black text-slate-600 dark:text-slate-300">S</div>
            <div><strong className="block text-sm">Speech (Parole)</strong><span className="text-xs text-slate-500">Faire répéter une phrase. Difficulté ?</span></div>
        </div>
        <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500">
            <div className="text-red-600 font-black text-xl w-8 text-center">T</div>
            <div><strong className="block text-sm text-red-700 dark:text-red-400">Time (Temps)</strong><span className="text-xs text-red-600 dark:text-red-300">Si 1 signe positif = <strong>Appel 15 IMMÉDIAT</strong>. Noter l'heure du début des signes.</span></div>
        </div>
    </div>
);

const RadioMemo = () => (
    <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl font-mono text-sm border-l-4 border-orange-500">
        <h4 className="font-bold text-orange-600 mb-2 uppercase">Bilan Flash (Sapeur-Pompier)</h4>
        <ul className="space-y-2">
            <li><strong>1. JE SUIS :</strong> Indicatif (Ex: DPS Alpha)</li>
            <li><strong>2. JE VOIS :</strong> Sexe, Âge approximatif</li>
            <li><strong>3. JE FAIS :</strong> Motif principal (Ex: Malaise)</li>
            <li><strong>4. BILAN :</strong> 
                <ul className="pl-4 list-disc text-slate-500 text-xs mt-1">
                    <li>Conscience (Oui/Non)</li>
                    <li>Respiration (Oui/Non)</li>
                    <li>Circulation (Pouls perçu)</li>
                </ul>
            </li>
            <li><strong>5. JE DEMANDE :</strong> Renforts ou instructions</li>
        </ul>
    </div>
);

const DsaChecklist = () => (
    <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900 text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4"/> <strong>Zone humide / Flaque d'eau</strong> : Déplacer la victime au sec.
        </div>
        <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-100 dark:border-orange-900 text-orange-700 dark:text-orange-300">
            <Zap className="w-4 h-4"/> <strong>Timbre autocollant (Patch)</strong> : Retirer et essuyer la zone.
        </div>
        <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
            <CheckCircle className="w-4 h-4 text-green-500"/> <strong>Pilosité excessive</strong> : Raser la zone de pose des électrodes.
        </div>
        <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
            <Baby className="w-4 h-4 text-pink-500"/> <strong>Enfant (-8 ans / -25kg)</strong> : Utiliser électrodes pédiatriques (ou placer Dos/Poitrine).
        </div>
        <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
            <Radio className="w-4 h-4 text-blue-500"/> <strong>Pacemaker</strong> : Placer l'électrode à 3cm du boîtier (bosse sous la peau).
        </div>
    </div>
);

const RcpMemo = () => (
    <div className="space-y-3 text-sm">
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border-l-4 border-red-500">
            <h4 className="font-bold text-red-700 dark:text-red-400 mb-2 uppercase text-xs">Adulte / Enfant {'>'} 8 ans</h4>
            <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                <li><strong>Fréquence :</strong> 100 - 120 compressions / min.</li>
                <li><strong>Profondeur :</strong> 5 - 6 cm.</li>
                <li><strong>Cycle :</strong> 30 compressions / 2 insufflations.</li>
                <li><strong>Relève :</strong> Toutes les 2 min (changement masseur).</li>
            </ul>
        </div>
        <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-lg border-l-4 border-pink-500">
            <h4 className="font-bold text-pink-700 dark:text-pink-400 mb-2 uppercase text-xs">Enfant (1-8 ans) & Nourrisson</h4>
            <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                <li><strong>Initial :</strong> 5 insufflations de départ (si possible).</li>
                <li><strong>Cycle (2 secouristes) :</strong> 15 compressions / 2 insufflations.</li>
                <li><strong>Cycle (1 secouriste) :</strong> 30 compressions / 2 insufflations.</li>
                <li><strong>Profondeur :</strong> 1/3 de l'épaisseur du thorax.</li>
            </ul>
        </div>
        <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 italic">
            Note : Si ventilation impossible ou refusée (COVID/Trauma facial), massage cardiaque seul en continu.
        </div>
    </div>
);

const PisuCard: React.FC<{ protocol: Protocol; weight: number }> = ({ protocol, weight }) => {
    const [isOpen, setIsOpen] = useState(false);
    const calcResults = (weight > 0 && protocol.calculator) ? protocol.calculator(weight) : null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-2 transition-colors">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-700 ${protocol.color}`}>
                        <protocol.icon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">{protocol.code}</span>
                        <span className="font-bold text-slate-800 dark:text-white">{protocol.title}</span>
                    </div>
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            
            {isOpen && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2 space-y-4">
                    {protocol.calculator && (
                        <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><Calculator className="w-3 h-3" /> Posologie {weight > 0 ? `pour ${weight} kg` : 'Théorique'}</h4>
                            {calcResults ? (
                                <div className="grid gap-2">
                                    {calcResults.map((res, idx) => (
                                        <div key={idx} className={`flex justify-between items-center p-2 rounded bg-white dark:bg-slate-800 border ${res.alert ? 'border-red-200 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'}`}>
                                            <div>
                                                <span className={`block font-bold text-sm ${res.alert ? 'text-red-600' : 'text-slate-700 dark:text-slate-200'}`}>{res.label}</span>
                                                {res.detail && <span className="text-[10px] text-slate-500">{res.detail}</span>}
                                            </div>
                                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">{res.value}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (<div className="text-center text-sm text-slate-400 italic py-2">Saisissez un poids en haut de section pour calculer.</div>)}
                        </div>
                    )}
                    <div className="text-sm">
                        <div className="mb-2"><span className="font-bold text-slate-700 dark:text-slate-200 block mb-1">Indication :</span><p className="text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/10 p-2 rounded border-l-2 border-green-500">{protocol.indication}</p></div>
                        {protocol.contraIndication && (<div className="mb-2"><span className="font-bold text-slate-700 dark:text-slate-200 block mb-1">Contre-indication :</span><p className="text-slate-600 dark:text-slate-400 bg-red-50 dark:bg-red-900/10 p-2 rounded border-l-2 border-red-500">{protocol.contraIndication}</p></div>)}
                    </div>
                    <div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 block mb-2">Conduite à tenir :</span>
                        <ul className="space-y-2">
                            {protocol.steps.map((step, i) => (<li key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-300"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-bold">{i + 1}</span><span>{step}</span></li>))}
                        </ul>
                    </div>
                    {protocol.alert && (<div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded text-xs font-bold"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{protocol.alert}</div>)}
                </div>
            )}
        </div>
    );
};

const EmergencyTranslator = () => {
    const [lang, setLang] = useState<'EN' | 'ES' | 'DE' | 'RU'>('EN');
    const phrases = [
        // 1. Contact & Rassurance
        { fr: "Écoutez-moi", tr: { EN: "Listen to me", ES: "Escúcheme", DE: "Hören Sie mir zu", RU: "Послушайте меня" } },
        { fr: "Calmez-vous", tr: { EN: "Calm down", ES: "Cálmese", DE: "Beruhigen Sie sich", RU: "Успокойтесь" } },
        { fr: "Je vais vous aider", tr: { EN: "I am going to help you", ES: "Le voy a ayudar", DE: "Ich werde Ihnen helfen", RU: "Я вам помогу" } },
        
        // 2. Identité & Conscience
        { fr: "Comment vous appelez-vous ?", tr: { EN: "What is your name?", ES: "¿Cómo se llama?", DE: "Wie heißen Sie?", RU: "Как вас зовут?" } },
        { fr: "Quel âge avez-vous ?", tr: { EN: "How old are you?", ES: "¿Cuántos años tiene?", DE: "Wie alt sind Sie?", RU: "Сколько вам лет?" } },
        { fr: "Ouvrez les yeux", tr: { EN: "Open your eyes", ES: "Abre los ojos", DE: "Öffnen Sie die Augen", RU: "Откройте глаза" } },
        { fr: "Serrez ma main", tr: { EN: "Squeeze my hand", ES: "Aprieta mi mano", DE: "Drücken Sie meine Hand", RU: "Сожмите мою руку" } },
        
        // 3. Douleur & État
        { fr: "Avez-vous mal ?", tr: { EN: "Are you in pain?", ES: "¿Le duele?", DE: "Haben Sie Schmerzen?", RU: "Вам больно?" } },
        { fr: "Où avez-vous mal ?", tr: { EN: "Where does it hurt?", ES: "¿Dónde le duele?", DE: "Wo haben Sie Schmerzen?", RU: "Где у вас болит?" } },
        { fr: "Avez-vous froid ?", tr: { EN: "Are you cold?", ES: "¿Tiene frío?", DE: "Ist Ihnen kalt?", RU: "Вам холодно?" } },
        
        // 4. Instructions & Mobilité
        { fr: "Respirez lentement", tr: { EN: "Breathe slowly", ES: "Respire lentement", DE: "Atmen Sie langsam", RU: "Дышите медленно" } },
        { fr: "Ne bougez pas", tr: { EN: "Don't move", ES: "No se mueva", DE: "Bewegen Sie sich nicht", RU: "Не двигайтесь" } },
        { fr: "Pouvez-vous vous lever ?", tr: { EN: "Can you stand up?", ES: "¿Puede levantarse?", DE: "Können Sie aufstehen?", RU: "Вы можете встать?" } },
        { fr: "Pouvez-vous marcher ?", tr: { EN: "Can you walk?", ES: "¿Puede caminar?", DE: "Können Sie gehen?", RU: "Вы можете идти?" } },
        
        // 5. Antécédents
        { fr: "Allergie ?", tr: { EN: "Any allergies?", ES: "¿Tienes alergias?", DE: "Haben Sie Allergien?", RU: "Есть ли аллергия?" } },
        { fr: "Médicaments ?", tr: { EN: "Medication?", ES: "¿Medicamentos?", DE: "Medikamente?", RU: "Принимаете лекарства?" } },
        { fr: "Enceinte ?", tr: { EN: "Pregnant?", ES: "¿Embarazada?", DE: "Schwanger?", RU: "Вы беременны?" } }
    ];

    const speak = (text: string, langCode: string) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = langCode;
        window.speechSynthesis.speak(u);
    };

    const getLangCode = (l: string) => {
        switch(l) {
            case 'EN': return 'en-US';
            case 'ES': return 'es-ES';
            case 'DE': return 'de-DE';
            case 'RU': return 'ru-RU';
            default: return 'en-US';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2 justify-center mb-2 flex-wrap">
                {(['EN', 'ES', 'DE', 'RU'] as const).map(l => (
                    <button key={l} onClick={() => setLang(l)} className={`px-4 py-2 rounded-lg font-bold text-xs border ${lang === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                        {l === 'EN' ? '🇬🇧 Anglais' : l === 'ES' ? '🇪🇸 Espagnol' : l === 'DE' ? '🇩🇪 Allemand' : '🇷🇺 Russe'}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
                {phrases.map((p, i) => (
                    <button 
                        key={i} 
                        onClick={() => speak(p.tr[lang], getLangCode(lang))}
                        className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all"
                    >
                        <span className="text-sm font-bold text-slate-800 dark:text-white mb-1">{p.fr}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-medium flex items-center gap-2">
                            {p.tr[lang]} <Volume2 className="w-3 h-3 text-blue-500" />
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const FlashlightTool = () => {
    const [mode, setMode] = useState<'OFF' | 'WHITE' | 'RED' | 'SOS'>('OFF');
    const [sosState, setSosState] = useState(false);

    useEffect(() => {
        let interval: any;
        if (mode === 'SOS') {
            interval = setInterval(() => setSosState(s => !s), 500);
        }
        return () => clearInterval(interval);
    }, [mode]);

    if (mode !== 'OFF') {
        return (
            <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer ${
                mode === 'WHITE' ? 'bg-white' : 
                mode === 'RED' ? 'bg-red-600' : 
                (sosState ? 'bg-white' : 'bg-black')
            }`} onClick={() => setMode('OFF')}>
                <div className="bg-black/50 px-6 py-3 rounded-full text-white font-bold backdrop-blur-md flex items-center gap-2 animate-pulse">
                    <X className="w-5 h-5" /> Tapper pour éteindre
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-3">
            <button onClick={() => setMode('WHITE')} className="p-4 bg-white border-2 border-slate-200 rounded-xl flex flex-col items-center gap-2 hover:bg-slate-50 transition-colors">
                <Lightbulb className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-bold text-slate-600">Torche</span>
            </button>
            <button onClick={() => setMode('RED')} className="p-4 bg-red-600 border-2 border-red-700 rounded-xl flex flex-col items-center gap-2 hover:bg-red-700 transition-colors text-white">
                <Lightbulb className="w-6 h-6" />
                <span className="text-xs font-bold">Nuit</span>
            </button>
            <button onClick={() => setMode('SOS')} className="p-4 bg-slate-900 border-2 border-slate-700 rounded-xl flex flex-col items-center gap-2 hover:bg-black transition-colors text-white">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
                <span className="text-xs font-bold">S.O.S</span>
            </button>
        </div>
    );
};

const MedicalConverter = () => {
    const [val, setVal] = useState('');
    const [type, setType] = useState<'GLY' | 'TEMP' | 'WEIGHT'>('GLY');

    const getResult = () => {
        const v = parseFloat(val);
        if (isNaN(v)) return '---';
        if (type === 'GLY') return `${(v * 5.5).toFixed(2)} mmol/L`; // g/L -> mmol/L
        if (type === 'TEMP') return `${((v * 9/5) + 32).toFixed(1)} °F`; // C -> F
        if (type === 'WEIGHT') return `${(v * 2.20462).toFixed(1)} lb`; // kg -> lb
        return '';
    };

    return (
        <div className="space-y-3">
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                <button onClick={() => setType('GLY')} className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase ${type === 'GLY' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-500'}`}>Glycémie</button>
                <button onClick={() => setType('TEMP')} className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase ${type === 'TEMP' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-500'}`}>Temp</button>
                <button onClick={() => setType('WEIGHT')} className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase ${type === 'WEIGHT' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-500'}`}>Poids</button>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">
                        {type === 'GLY' ? 'g/L' : type === 'TEMP' ? 'Celsius' : 'Kg'}
                    </label>
                    <input type="number" className="w-full bg-transparent font-black text-xl text-slate-800 dark:text-white outline-none" placeholder="0" value={val} onChange={e => setVal(e.target.value)} />
                </div>
                <ArrowRightLeft className="w-5 h-5 text-slate-400" />
                <div className="flex-1 text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">
                        {type === 'GLY' ? 'mmol/L' : type === 'TEMP' ? 'Fahrenheit' : 'Livres'}
                    </span>
                    <span className="font-black text-xl text-blue-600 dark:text-blue-400">{getResult()}</span>
                </div>
            </div>
        </div>
    );
};

const DzCalculator = () => {
    const [len, setLen] = useState('');
    const [wid, setWid] = useState('');
    
    const l = parseFloat(len) || 0;
    const w = parseFloat(wid) || 0;
    const area = l * w;
    const isSafe = l >= 25 && w >= 25; // Min 25x25 pour sécurité civile (Dragon)

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Longueur (m)</label>
                    <input type="number" className="w-full p-2 rounded border dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={len} onChange={e => setLen(e.target.value)} placeholder="Ex: 30" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Largeur (m)</label>
                    <input type="number" className="w-full p-2 rounded border dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={wid} onChange={e => setWid(e.target.value)} placeholder="Ex: 30" />
                </div>
            </div>
            {area > 0 && (
                <div className={`p-3 rounded-lg border flex justify-between items-center ${isSafe ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div>
                        <span className="text-xs font-bold uppercase block">Surface DZ</span>
                        <span className="font-black text-lg">{area} m²</span>
                    </div>
                    <div className="text-right">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${isSafe ? 'bg-green-200' : 'bg-red-200'}`}>
                            {isSafe ? 'CONFORME (Dragon)' : 'TROP PETIT (<25m)'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

const DripCalculator = () => {
    const [vol, setVol] = useState(500);
    const [hours, setHours] = useState(1);
    
    // Formule : (Volume ml * 20 gouttes/ml) / (Heures * 60)
    const result = hours > 0 ? Math.round((vol * 20) / (hours * 60)) : 0;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Volume (ml)</label>
                    <input type="number" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white text-center font-bold" value={vol} onChange={e => setVol(parseInt(e.target.value) || 0)} placeholder="500" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Durée (Heures)</label>
                    <input type="number" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white text-center font-bold" value={hours} onChange={e => setHours(parseFloat(e.target.value) || 0)} placeholder="1" />
                </div>
            </div>
            
            <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 font-bold uppercase">Débit requis<br/>(Standard 20 gttes/ml)</div>
                <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{result} <span className="text-sm text-slate-400 font-medium">gttes/min</span></div>
            </div>
        </div>
    );
};

// --- DATA STRUCTURE DES OUTILS ---

const TOOLS_DATA = [
    {
        id: 'urgence', title: "1. Réanimation & Urgence Vitale", color: "bg-red-500",
        tools: [
            { title: "Métronome Interactif", icon: <Zap className="w-5 h-5 text-yellow-500" />, component: <div className="flex justify-center"><Metronome /></div> },
            { title: "Aide-Mémoire RCP", icon: <HeartPulse className="w-5 h-5 text-red-600" />, component: <RcpMemo /> },
            { title: "Checklist DSA", icon: <Zap className="w-5 h-5 text-yellow-600" />, component: <DsaChecklist /> },
            { title: "Bilan X-ABCDE (Marche en avant)", icon: <ClipboardList className="w-5 h-5" />, component: <XAbcdeMemo /> }
        ]
    },
    {
        id: 'clinique', title: "2. Bilan Neuro & Clinique", color: "bg-blue-500",
        tools: [
            { title: "Score de Glasgow (GCS)", icon: <Brain className="w-5 h-5" />, component: <GlasgowCalc /> },
            { title: "Score FAST (AVC)", icon: <Zap className="w-5 h-5 text-yellow-500" />, component: <FastCheck /> },
            { title: "Constantes Vitales Normales", icon: <Activity className="w-5 h-5 text-blue-500" />, component: <VitalsTable /> },
            { title: "CAT : Anomalies Constantes", icon: <Thermometer className="w-5 h-5 text-red-500" />, component: <VitalsActionGuide /> }
        ]
    },
    {
        id: 'pedia', title: "3. Pédiatrie & Maternité", color: "bg-pink-500",
        tools: [
            { title: "PédiaHelp : Urgence Pédiatrique", icon: <Calculator className="w-5 h-5 text-purple-500" />, component: <PediaHelp /> },
            { title: "Score d'APGAR (Vitalité Naissance)", icon: <Baby className="w-5 h-5 text-green-500" />, component: <ApgarScore /> },
            { title: "Score de Silverman (Détresse Respi)", icon: <Wind className="w-5 h-5 text-blue-400" />, component: <SilvermanScore /> }
        ]
    },
    {
        id: 'technique', title: "4. Calculateurs & Soins Techniques", color: "bg-emerald-500",
        tools: [
            { title: "Débit de Perfusion", icon: <Droplet className="w-5 h-5 text-cyan-500" />, component: <DripCalculator /> },
            { title: "Autonomie Oxygène", icon: <Timer className="w-5 h-5 text-blue-500" />, component: <OxygenCalc /> },
            { title: "Convertisseur Médical", icon: <ArrowRightLeft className="w-5 h-5 text-slate-500" />, component: <MedicalConverter /> },
            { title: "Règle de Wallace (Brûlures)", icon: <Flame className="w-5 h-5 text-orange-500" />, component: <WallaceCalculator /> }
        ]
    },
    {
        id: 'logistique', title: "5. Opérationnel & Logistique", color: "bg-slate-500",
        tools: [
            { title: "Bilan Flash Radio (MSP)", icon: <Radio className="w-5 h-5 text-slate-500" />, component: <RadioMemo /> },
            { title: "Calcul Zone Hélicoptère (DZ)", icon: <Plane className="w-5 h-5 text-blue-500" />, component: <DzCalculator /> },
            { title: "Lampe Torche / SOS", icon: <Lightbulb className="w-5 h-5 text-yellow-500" />, component: <FlashlightTool /> }
        ]
    }
];

export const ToolsPage: React.FC = () => {
    const { profile, isAdmin } = useAuth();
    
    // --- STATE ---
    const [isMedicalMode, setIsMedicalMode] = useState(false);
    const [pisuWeight, setPisuWeight] = useState<number | ''>('');
    const [searchPisu, setSearchPisu] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Filtrage PISU
    const filteredProtocols = PISU_PROTOCOLS.filter(p => p.title.toLowerCase().includes(searchPisu.toLowerCase()) || p.code.toLowerCase().includes(searchPisu.toLowerCase()));

    // Filtrage Outils Généraux
    const filteredSections = TOOLS_DATA.map(section => ({
        ...section,
        tools: section.tools.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    })).filter(section => section.tools.length > 0);

    // Vérification des droits d'accès PISU (Infirmier, Médecin, Admin)
    const canAccessPisu = isAdmin || ['infirmier', 'medecin'].includes(profile?.role || '');

  return (
    <Layout title="Outils & Aide-Mémoire" showBack>
        <div className="pb-10">

            {/* --- RECHERCHE GLOBALE --- */}
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 sticky top-0 z-20">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Rechercher un outil..." 
                        className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors text-slate-900 dark:text-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
                </div>
            </div>

            {/* --- ZONE PISU (PROTÉGÉE & ISOLÉE) --- */}
            {canAccessPisu && !searchQuery && (
                <div className="mb-8 border-b-2 border-slate-200 dark:border-slate-800 pb-6">
                    <div className="mb-6 bg-slate-100 dark:bg-slate-900 p-4 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${isMedicalMode ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}><ShieldCheck className="w-6 h-6" /></div>
                            <div><h3 className="font-bold text-slate-800 dark:text-white">Mode P.I.S.U</h3><p className="text-xs text-slate-500 dark:text-slate-400">Protocoles Infirmiers (Réservé IDE/Med)</p></div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={isMedicalMode} onChange={(e) => setIsMedicalMode(e.target.checked)} />
                            <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    {isMedicalMode && (
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 text-white animate-in slide-in-from-top-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-purple-400" /><h2 className="text-lg font-bold uppercase tracking-tight">Protocoles P.I.S.U 2026</h2></div>
                                <span className="text-[10px] bg-purple-600 px-2 py-0.5 rounded font-bold">IDE / MÉDECIN</span>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600 mb-4 flex items-center gap-4">
                                <div className="p-2 bg-slate-700 rounded-full text-slate-300"><Scale className="w-5 h-5" /></div>
                                <div className="flex-1">
                                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Poids du patient (kg) - Calcul Auto</label>
                                    <input type="number" className="w-full bg-transparent border-b-2 border-slate-500 focus:border-purple-500 outline-none text-xl font-bold text-white placeholder-slate-600 transition-colors" placeholder="Saisir poids..." value={pisuWeight} onChange={(e) => setPisuWeight(e.target.value === '' ? '' : parseFloat(e.target.value))} />
                                </div>
                            </div>
                            <div className="relative mb-4"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" /><input type="text" placeholder="Rechercher protocole (ex: ACR, Douleur)..." className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-purple-500 outline-none" value={searchPisu} onChange={(e) => setSearchPisu(e.target.value)} /></div>
                            <div className="space-y-2">
                                {filteredProtocols.map(proto => <PisuCard key={proto.id} protocol={proto} weight={typeof pisuWeight === 'number' ? pisuWeight : 0} />)}
                                {filteredProtocols.length === 0 && <div className="text-center text-slate-500 text-xs py-4">Aucun protocole trouvé.</div>}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- LISTE DES OUTILS --- */}
            {filteredSections.length === 0 ? (
                <div className="text-center py-10 text-slate-400 italic">Aucun outil ne correspond à votre recherche.</div>
            ) : (
                filteredSections.map(section => (
                    <div key={section.id}>
                        <SectionHeader title={section.title} color={section.color} />
                        {section.tools.map((tool, idx) => (
                            <ToolCard key={idx} title={tool.title} icon={tool.icon} defaultOpen={!!searchQuery}>
                                {tool.component}
                            </ToolCard>
                        ))}
                    </div>
                ))
            )}

        </div>
    </Layout>
  );
};
