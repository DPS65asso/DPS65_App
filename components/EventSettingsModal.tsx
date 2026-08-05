
import React, { useState, useRef, useEffect } from 'react';
import { X, FileUp, Trash2, Save, Loader2, User, Phone, FileText, Settings } from 'lucide-react';
import { Event, Track } from '../types';
import { storageService } from '../services/storageService';
import { generateUUID, sanitizeInput } from '../utils/security';
import { Button } from './Button';

interface Props {
    isOpen: boolean;
    event: Event;
    onClose: () => void;
    onSave: (updatedEvent: Event) => void;
}

export const EventSettingsModal: React.FC<Props> = ({ isOpen, event, onClose, onSave }) => {
    const [name, setName] = useState(event.name);
    const [location, setLocation] = useState(event.location);
    const [supervisorName, setSupervisorName] = useState(event.supervisorName || '');
    const [supervisorPhone, setSupervisorPhone] = useState(event.supervisorPhone || '');
    const [organizerCode, setOrganizerCode] = useState(event.organizer_code || '');
    const [tracks, setTracks] = useState<Track[]>(event.tracks || []);
    const [mapPdfs, setMapPdfs] = useState<{ id: string; name: string; url: string; }[]>(
        event.mapPdfs && event.mapPdfs.length > 0 
            ? event.mapPdfs 
            : event.mapPdfUrl 
                ? [{ id: 'primary-pdf', name: 'Plan de cartographie.pdf', url: event.mapPdfUrl }] 
                : []
    );
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);
    
    // Bloquer le scroll du body quand la modale est ouverte
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleGpxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target?.result as string;
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, "text/xml");
                    const trkpts = xmlDoc.getElementsByTagName("trkpt");
                    
                    const coords: [number, number][] = [];
                    const step = Math.ceil(trkpts.length / 2000); 

                    for(let i=0; i < trkpts.length; i += step) {
                        const lat = parseFloat(trkpts[i].getAttribute("lat") || "0");
                        const lon = parseFloat(trkpts[i].getAttribute("lon") || "0");
                        if (lat && lon) coords.push([lat, lon]);
                    }
                    
                    let trackName = xmlDoc.getElementsByTagName("name")[0]?.textContent || file.name.replace('.gpx', '');
                    
                    setTracks(prev => {
                        const isFirst = prev.length === 0;
                        const newTrack: Track = {
                            id: generateUUID(),
                            name: trackName,
                            data: coords,
                            color: isFirst ? '#2563eb' : ['#dc2626', '#16a34a', '#eab308', '#9333ea', '#ea580c', '#0891b2'][Math.floor(Math.random() * 6)]
                        };
                        return [...prev, newTrack];
                    });
                } catch (err) {
                    alert(`Erreur fichier ${file.name}`);
                }
            };
            reader.readAsText(file);
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSave = async () => {
        setIsSaving(true);
        const updatedEvent: Event = {
            ...event,
            name: sanitizeInput(name),
            location: sanitizeInput(location),
            supervisorName: sanitizeInput(supervisorName),
            supervisorPhone: sanitizeInput(supervisorPhone),
            organizer_code: sanitizeInput(organizerCode).toUpperCase(),
            tracks: tracks.length > 0 ? tracks : undefined,
            mapPdfUrl: mapPdfs.length > 0 ? mapPdfs[0].url : undefined,
            mapPdfs: mapPdfs.length > 0 ? mapPdfs : undefined,
            trackData: tracks.length > 0 ? tracks[0].data : undefined
        };
        await storageService.saveEvent(updatedEvent);
        onSave(updatedEvent);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95dvh] sm:max-h-[90vh]">
                <div className="p-3.5 bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-900 text-white flex justify-between items-center border-b border-blue-800/80 flex-shrink-0">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <Settings className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Paramètres de l'événement</span>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-300 hover:text-white rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 overscroll-contain">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                        <label className="block text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase mb-1 tracking-widest">Code Accès Organisateur</label>
                        <input 
                            type="text" 
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-black tracking-widest uppercase text-center"
                            value={organizerCode}
                            onChange={e => setOrganizerCode(e.target.value)}
                            placeholder="EX: ORGA-123"
                        />
                        <p className="mt-1 text-[9px] text-blue-500/70 italic text-center">Ce code permet à l'organisateur de se connecter avec un accès restreint (Vue Tactique & Carte uniquement).</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lieu</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Responsable</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={supervisorName}
                                    onChange={e => setSupervisorName(e.target.value)}
                                    placeholder="Nom"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <input 
                                    type="tel" 
                                    className="w-full pl-9 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={supervisorPhone}
                                    onChange={e => setSupervisorPhone(e.target.value)}
                                    placeholder="06..."
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tracés GPX ({tracks.length})</label>
                        <div className="space-y-2 mb-4">
                            {tracks.map(t => (
                                <div key={t.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }}></div>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{t.name}</span>
                                    </div>
                                    <button onClick={() => setTracks(prev => prev.filter(x => x.id !== t.id))} className="text-slate-400 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <input type="file" accept=".gpx" multiple ref={fileInputRef} className="hidden" onChange={handleGpxUpload} />
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2"
                        >
                            <FileUp className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase">Ajouter GPX</span>
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Plans de cartographie (PDF)</label>
                        
                        {mapPdfs.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {mapPdfs.map(pdf => (
                                    <div key={pdf.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate pr-2">{pdf.name}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setMapPdfs(prev => prev.filter(p => p.id !== pdf.id))} 
                                            className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <input 
                            type="file" 
                            accept=".pdf" 
                            multiple
                            ref={pdfInputRef} 
                            className="hidden" 
                            onChange={(e) => {
                                const files = e.target.files;
                                if (!files || files.length === 0) return;
                                Array.from(files).forEach(file => {
                                    if (file.size > 8 * 1024 * 1024) {
                                        alert(`Le fichier ${file.name} est trop volumineux (max 8 Mo)`);
                                        return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                        setMapPdfs(prev => [
                                            ...prev,
                                            {
                                                id: generateUUID(),
                                                name: file.name,
                                                url: ev.target?.result as string
                                            }
                                        ]);
                                    };
                                    reader.readAsDataURL(file);
                                });
                                if (pdfInputRef.current) pdfInputRef.current.value = '';
                            }} 
                        />
                        <button 
                            type="button"
                            onClick={() => pdfInputRef.current?.click()}
                            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2"
                        >
                            <FileUp className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase">Ajouter des Plans PDF</span>
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex gap-3 flex-shrink-0">
                    <Button onClick={onClose} variant="outline" fullWidth>Annuler</Button>
                    <Button onClick={handleSave} fullWidth disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Enregistrer</>}
                    </Button>
                </div>
            </div>
        </div>
    );
};
