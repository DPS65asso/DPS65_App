
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Camera, Trash2, Maximize2, X, AlertTriangle } from 'lucide-react';
import { VictimPhoto } from '../types';
import { generateUUID } from '../utils/security';
import { Button } from './Button';

interface PhotoGalleryProps {
  photos: VictimPhoto[];
  onUpdate: (photos: VictimPhoto[]) => void;
  readOnly?: boolean;
}

const MAX_PHOTOS = 4;

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos, onUpdate, readOnly = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // Initialisation du Web Worker
  useEffect(() => {
    try {
        workerRef.current = new Worker(new URL('../workers/compression.worker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
        console.warn("Worker init failed, fallback might be needed", e);
    }
    
    return () => {
        workerRef.current?.terminate();
    };
  }, []); 

  // Gestionnaire de réponse du Worker
  useEffect(() => {
      if(workerRef.current) {
          workerRef.current.onmessage = (e) => {
            const { id, blob, success, error } = e.data;
            if (success && blob) {
                const newPhoto: VictimPhoto = {
                    id: id, 
                    timestamp: Date.now(),
                    blob: blob, 
                    description: ''
                };
                onUpdate([...photos, newPhoto]);
            } else {
                console.error("Worker error", error);
                alert("Erreur compression.");
            }
            setIsCompressing(false);
          };
      }
  }, [photos, onUpdate]);

  // OPTIMISATION CRITIQUE : Gestion stable des URLs pour les Blobs
  // Évite de recréer des URLs à chaque render (Memory Leak + Flickering)
  const displayUrls = useMemo(() => {
      const urls: Record<string, string> = {};
      photos.forEach(p => {
          if (p.blob) {
              urls[p.id] = URL.createObjectURL(p.blob);
          } else if (p.dataUrl) {
              urls[p.id] = p.dataUrl;
          }
      });
      return urls;
  }, [photos]);

  // Nettoyage des URLs lors du démontage ou changement de photos
  useEffect(() => {
      return () => {
          photos.forEach(p => {
              if (p.blob && displayUrls[p.id]) {
                  URL.revokeObjectURL(displayUrls[p.id]);
              }
          });
      };
  }, [displayUrls, photos]);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (photos.length >= MAX_PHOTOS) {
        alert(`Limite de ${MAX_PHOTOS} photos atteinte.`);
        return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    
    // Délégation au Worker
    if (workerRef.current) {
        const tempId = generateUUID();
        workerRef.current.postMessage({ 
            file, 
            id: tempId,
            maxWidth: 1280, // Full HD max
            quality: 0.75 
        });
    } else {
        alert("Erreur système (Worker manquant). Réessayez.");
        setIsCompressing(false);
    }
    
    e.target.value = '';
  };

  const removePhoto = (id: string) => {
      if (confirm("Supprimer cette photo ?")) {
          onUpdate(photos.filter(p => p.id !== id));
      }
  };

  return (
    <div className="space-y-4">
        {!readOnly && (
            <div className="flex flex-col gap-2">
                <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleCapture}
                />
                <Button 
                    type="button"
                    variant="outline" 
                    fullWidth 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressing || photos.length >= MAX_PHOTOS}
                    icon={<Camera className="w-5 h-5" />}
                    className="border-dashed border-2 py-8"
                >
                    {isCompressing ? "Traitement optimisé..." : photos.length >= MAX_PHOTOS ? "Limite Atteinte" : "Ajouter Photo (Preuve/Blessure)"}
                </Button>
                {photos.length >= MAX_PHOTOS && (
                    <div className="text-xs text-orange-600 flex items-center gap-1 justify-center font-bold">
                        <AlertTriangle className="w-3 h-3" /> Limite : {MAX_PHOTOS} photos.
                    </div>
                )}
            </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map(p => {
                const src = displayUrls[p.id];
                if (!src) return null;

                return (
                    <div key={p.id} className="relative group bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden aspect-square border border-slate-200 dark:border-slate-700 shadow-sm">
                        <img 
                            src={src} 
                            alt="Preuve" 
                            className="w-full h-full object-cover" 
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button 
                                type="button"
                                onClick={() => setFullscreenPhoto(src)}
                                className="p-2 bg-white/20 rounded-full hover:bg-white/40 text-white"
                            >
                                <Maximize2 className="w-5 h-5" />
                            </button>
                            {!readOnly && (
                                <button 
                                    type="button"
                                    onClick={() => removePhoto(p.id)}
                                    className="p-2 bg-red-500/80 rounded-full hover:bg-red-600 text-white"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 text-center font-mono">
                            {new Date(p.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Modal Fullscreen */}
        {fullscreenPhoto && (
            <div className="fixed inset-0 z-[150] bg-black flex items-center justify-center p-2 animate-in fade-in zoom-in">
                <button 
                    type="button"
                    onClick={() => setFullscreenPhoto(null)}
                    className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-white z-50"
                >
                    <X className="w-6 h-6" />
                </button>
                <img src={fullscreenPhoto} className="max-w-full max-h-full object-contain rounded" alt="Full" />
            </div>
        )}
    </div>
  );
};
