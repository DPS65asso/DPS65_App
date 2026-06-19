
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { storageService } from '../services/storageService';
import { Calendar, MapPin, Type, Loader2, FileUp, CheckCircle, X, Plus, Phone, User, FileText } from 'lucide-react';
import { generateUUID, sanitizeInput, MAX_INPUT_LENGTH, getLocalDateString } from '../utils/security';
import { Event, Track } from '../types';

export const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [mapPdfs, setMapPdfs] = useState<{ id: string; name: string; url: string; }[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    date: getLocalDateString(),
    location: '',
    supervisorName: '',
    supervisorPhone: ''
  });

  const handleGpxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (event) => {
              const text = event.target?.result as string;
              try {
                  const parser = new DOMParser();
                  const xmlDoc = parser.parseFromString(text, "text/xml");
                  const trkpts = xmlDoc.getElementsByTagName("trkpt");
                  
                  const coords: [number, number][] = [];
                  // Sampling pour éviter de stocker trop de points (max 2000 points)
                  const step = Math.ceil(trkpts.length / 2000); 

                  for(let i=0; i < trkpts.length; i += step) {
                      const lat = parseFloat(trkpts[i].getAttribute("lat") || "0");
                      const lon = parseFloat(trkpts[i].getAttribute("lon") || "0");
                      if (lat && lon) {
                          coords.push([lat, lon]);
                      }
                  }
                  
                  // Extraire le nom du tracé du GPX ou utiliser le nom du fichier
                  let trackName = xmlDoc.getElementsByTagName("name")[0]?.textContent || file.name.replace('.gpx', '');
                  
                  setTracks(prev => {
                      const isFirst = prev.length === 0;
                      const newTrack: Track = {
                          id: generateUUID(),
                          name: trackName,
                          data: coords,
                          color: isFirst ? '#2563eb' : getRandomColor()
                      };
                      return [...prev, newTrack];
                  });
              } catch (err) {
                  alert(`Erreur lors de la lecture du fichier ${file.name}. Format invalide.`);
                  console.error(err);
              }
          };
          reader.readAsText(file);
      });
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getRandomColor = () => {
      const colors = ['#dc2626', '#16a34a', '#eab308', '#9333ea', '#ea580c', '#0891b2'];
      return colors[Math.floor(Math.random() * colors.length)];
  };

  const removeTrack = (id: string) => {
      setTracks(prev => prev.filter(t => t.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.date) return;
    
    setIsSubmitting(true);

    const newEvent: Event = {
      id: generateUUID(),
      name: sanitizeInput(formData.name),
      date: formData.date,
      location: sanitizeInput(formData.location),
      supervisorName: sanitizeInput(formData.supervisorName),
      supervisorPhone: sanitizeInput(formData.supervisorPhone),
      createdAt: Date.now(),
      tracks: tracks.length > 0 ? tracks : undefined,
      mapPdfUrl: mapPdfs.length > 0 ? mapPdfs[0].url : undefined,
      mapPdfs: mapPdfs.length > 0 ? mapPdfs : undefined,
      // On garde trackData pour la compatibilité avec le premier tracé
      trackData: tracks.length > 0 ? tracks[0].data : undefined
    };

    await storageService.saveEvent(newEvent);
    setIsSubmitting(false);
    navigate(`/events/${newEvent.id}`);
  };

  return (
    <Layout title="Nouvel Événement" showBack>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-100 dark:border-slate-700 transition-colors">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Détails de l'événement</h2>
        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de l'événement</label>
            <div className="relative">
              <Type className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                required
                maxLength={MAX_INPUT_LENGTH}
                autoComplete="off"
                autoCorrect="off"
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                placeholder="ex: Marathon de la ville 2024"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
            <div className="relative max-w-[200px]">
              <Calendar className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="date"
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-white dark:[color-scheme:dark]"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lieu</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                required
                maxLength={MAX_INPUT_LENGTH}
                autoComplete="off"
                autoCorrect="off"
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                placeholder="ex: Poste central, Place d'Armes"
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Responsable Dispositif</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  maxLength={MAX_INPUT_LENGTH}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                  placeholder="ex: Jean DUPONT"
                  value={formData.supervisorName}
                  onChange={e => setFormData({...formData, supervisorName: e.target.value})}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Téléphone Responsable</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="tel"
                  maxLength={20}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                  placeholder="ex: 06 12 34 56 78"
                  value={formData.supervisorPhone}
                  onChange={e => setFormData({...formData, supervisorPhone: e.target.value})}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* SECTION GPX */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tracés du parcours (Optionnel)</label>
              
              <input 
                  type="file" 
                  accept=".gpx" 
                  multiple
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleGpxUpload}
              />

              <div className="space-y-2 mb-4">
                  {tracks.map(track => (
                      <div key={track.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color }}></div>
                              <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{track.name}</span>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold">{track.data.length} points</span>
                              </div>
                          </div>
                          <button 
                              type="button" 
                              onClick={() => removeTrack(track.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                              <X className="w-4 h-4" />
                          </button>
                      </div>
                  ))}
              </div>

              <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex flex-col items-center justify-center gap-1"
              >
                  <FileUp className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase tracking-wider">Ajouter des fichiers .GPX</span>
              </button>
          </div>

          {/* SECTION PDF CARTOGRAPHIE */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Plans de cartographie (PDF - Optionnels)</label>
              
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
                          reader.onload = (event) => {
                              setMapPdfs(prev => [
                                  ...prev,
                                  {
                                      id: generateUUID(),
                                      name: file.name,
                                      url: event.target?.result as string
                                  }
                              ]);
                          };
                          reader.readAsDataURL(file);
                      });
                      if (pdfInputRef.current) pdfInputRef.current.value = '';
                  }}
              />

              {mapPdfs.length > 0 && (
                  <div className="space-y-2 mb-4">
                      {mapPdfs.map(pdf => (
                          <div key={pdf.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                              <div className="flex items-center gap-3">
                                  <FileText className="w-5 h-5 text-red-500" />
                                  <div className="flex flex-col">
                                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{pdf.name}</span>
                                      <span className="text-[10px] text-slate-500 uppercase font-bold">Document PDF</span>
                                  </div>
                              </div>
                              <button 
                                  type="button" 
                                  onClick={() => setMapPdfs(prev => prev.filter(p => p.id !== pdf.id))}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              <button 
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex flex-col items-center justify-center gap-1"
              >
                  <FileUp className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase tracking-wider">Ajouter des plans PDF</span>
              </button>
          </div>

          <div className="pt-4">
            <Button type="submit" fullWidth disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Création...
                </>
              ) : (
                'Créer et commencer le suivi'
              )}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};
