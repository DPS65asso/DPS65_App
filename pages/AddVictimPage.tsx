
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { SignaturePad } from '../components/SignaturePad';
import { TransferQrModal } from '../components/TransferQrModal';
import { PhotoGallery } from '../components/PhotoGallery';
import { storageService } from '../services/storageService';
import { bagService } from '../services/bagService';
import { Outcome, Victim, Solute, VitalSign, AppConfig, TriageColor, Medication, Event, ResponderEntry, VictimPhoto } from '../types';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { User, ClipboardList, AlertTriangle, Activity, Loader2, Clock, Phone, RefreshCw, Mic, MicOff, ShieldCheck, HeartPulse, Stethoscope, Syringe, CheckCircle2, Plus, Trash2, MapPin, Building2, History, ChevronDown, ChevronUp, PenTool, Bed, QrCode, Zap, Timer, Camera, Pill, Flame, FileText, ArrowDown, Maximize2, X, Eye, EyeOff, Send, Check } from 'lucide-react';
import { generateUUID, isValidPhoneNumber, MAX_INPUT_LENGTH, MAX_TEXTAREA_LENGTH, MAX_PHONE_LENGTH, getLocalDateTimeString } from '../utils/security';
import { useAuth } from '../context/AuthContext';
import { Sparkline } from '../components/Sparkline';
import { FullChartModal } from '../components/FullChartModal';
import { Modal } from '../components/Modal';
import { presenceService } from '../services/presenceService';
import { aiService } from '../services/aiService';
import { Sparkles, Copy, Radio } from 'lucide-react';

const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white dark:placeholder-slate-400 transition-colors";
const labelClass = "block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1";
const EMPTY_PHOTOS: VictimPhoto[] = [];

export const AddVictimPage: React.FC = () => {
  const { id, victimId } = useParams<{ id: string; victimId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, currentTeam, isAdmin } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isEditing = !!victimId;
  
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [eventData, setEventData] = useState<Event | null>(null);
  const [isResponderOpen, setIsResponderOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showFullCpr, setShowFullCpr] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [showSamuAiModal, setShowSamuAiModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [samuSummaryText, setSamuSummaryText] = useState('');
  const [isGeneratingSamu, setIsGeneratingSamu] = useState(false);

  // Presence Service Integration
  useEffect(() => {
    if (victimId && profile) {
      const userName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email || 'Secouriste';
      presenceService.setEditing(victimId, userName, profile.role || 'SECOURISTE');
      
      return () => {
        presenceService.clearEditing(victimId);
      };
    }
  }, [victimId, profile]);

  const handleGenerateSamuAi = async () => {
    setIsGeneratingSamu(true);
    setShowSamuAiModal(true);
    try {
      const text = await aiService.generateSamuChronologicalSummary(formData as Victim, eventData?.name || 'DPS65');
      setSamuSummaryText(text);
    } catch (err) {
      setSamuSummaryText("Erreur lors de la génération de la synthèse SAMU. Veuillez réessayer.");
    } finally {
      setIsGeneratingSamu(false);
    }
  };

  const handleCopySmsFormat = () => {
      // Format: DPS65:ID|INIT|AGE|TRIAGE|OUTCOME|VITALS|GARROT
      const initials = formData.fullName ? formData.fullName.split(' ').map(n => n[0] || '').join('').toUpperCase() : 'XX';
      
      let ageCode = 'XX';
      if (formData.birthDate) {
          try {
              const birthYear = new Date(formData.birthDate).getFullYear();
              const currentYear = new Date().getFullYear();
              if (!isNaN(birthYear)) {
                  ageCode = String(currentYear - birthYear);
              }
          } catch (e) {}
      }

      const triage = formData.triageColor || 'X';
      const outcome = formData.outcome || 'X';
      
      // Get latest vital signs if any
      let lastVitals = 'N/A';
      if (formData.vitals && formData.vitals.length > 0) {
          const sorted = [...formData.vitals].sort((a,b) => (b.time || '').localeCompare(a.time || ''));
          const v = sorted[0];
          lastVitals = `FC:${v.pulse || '?'}-TA:${v.bp || '?'}-SpO2:${v.sao2 || '?'}`;
      }
      
      const compactId = victimId ? victimId.slice(0, 4) : 'TEMP';
      const text = `DPS65:${compactId}|${initials}|${ageCode}|${triage}|${outcome}|${lastVitals}|${formData.hasTourniquet ? 'G_OK' : 'S_G'}`;
      
      // 1. Copie presse-papier
      if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
              setCopiedSms(true);
              setTimeout(() => setCopiedSms(false), 3000);
          }).catch(err => {
              console.error("Clipboard error", err);
          });
      }

      // 2. Partage natif via Web Share API sur Android APK et iOS si supporté
      if (navigator.share) {
          navigator.share({
              title: `Bilan DPS65 - ${initials} (${ageCode} ans)`,
              text: text,
          }).catch((e) => {
              // Si annulation utilisateur ou non supporté, on ne bloque pas
              if (e.name !== 'AbortError') {
                  console.warn("Native share error:", e);
              }
          });
      } else {
          setCopiedSms(true);
          setTimeout(() => setCopiedSms(false), 3000);
      }
  };
  
  const [showVitalList, setShowVitalList] = useState(false); 
  const [showFullChartModal, setShowFullChartModal] = useState(false);

  // RESTRICTION : Organisateur ne peut pas accéder à la fiche victime
  useEffect(() => {
    if (profile?.role === 'organisateur') {
      navigate('/tactical', { replace: true });
    }
  }, [profile?.role, navigate]);

  const [hospitalSelect, setHospitalSelect] = useState('');
  const [timeError, setTimeError] = useState(false);
  
  const handleVoiceReason = useCallback((text: string) => {
    setFormData(prev => ({ ...prev, reason: (prev.reason ? prev.reason + ' ' : '') + text }));
  }, []);
  const handleVoiceCare = useCallback((text: string) => {
    setFormData(prev => ({ ...prev, careProvided: (prev.careProvided ? prev.careProvided + ' ' : '') + text }));
  }, []);
  const { startListening: startReason, isListening: isListeningReason } = useVoiceInput(handleVoiceReason);
  const { startListening: startCare, isListening: isListeningCare } = useVoiceInput(handleVoiceCare);
  const topRef = useRef<HTMLDivElement>(null);
  
  // RESTRICTION : Accès aux soins avancés
  const canAccessMedicalCare = isAdmin || profile?.role === 'medecin' || profile?.role === 'infirmier';

  const getCurrentTime = () => {
     return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const navResponder = location.state?.responder || {};

  const [newVital, setNewVital] = useState<Partial<VitalSign>>({
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    pulse: '',
    sao2: '',
    bp: '',
    glycemia: '',
    temp: '',
    eva: ''
  });

  const [formData, setFormData] = useState<Partial<Victim>>({
    fullName: '',
    birthDate: '',
    bibNumber: '',
    phoneNumber: '',
    emergencyContact: '',
    reason: '',
    careProvided: '',
    allergies: 'Aucune',
    treatments: 'Aucun',
    outcome: Outcome.TREATMENT_IN_PROGRESS,
    hospitalName: '',
    arrivalTime: '', 
    careOnSiteTime: '', 
    departureTime: '',
    deceasedDetails: '',
    deceasedDate: '',
    deceasedTime: '',
    deceasedDoctorName: '',
    responderName: navResponder.name || profile?.lastName || '',
    responderFirstName: navResponder.firstName || profile?.firstName || '',
    responderTeam: navResponder.team || currentTeam || '',
    responderHistory: [],
    vitals: [], 
    isAdvancedMode: false,
    hasKt: false,
    ktTime: '', 
    solutes: [],
    medications: '',
    medicationsList: [], 
    samuValidated: false,
    signatureData: undefined,
    doctorSignatureData: undefined,
    triageColor: undefined, 
    resourceUsed: undefined,
    cprHistory: [],
    photos: [],
    hasTourniquet: false,
    tourniquetTime: ''
  });

  useEffect(() => {
    const init = async () => {
      const appConfig = await storageService.getConfig();
      setConfig(appConfig);
      
      if (id) {
          const ev = await storageService.getEventById(id);
          if (ev) setEventData(ev);
      }

      if (victimId) {
        try {
            const victim = await storageService.getVictimById(victimId);
            if (victim) {
              if (victim.hospitalName && appConfig.hospitals.includes(victim.hospitalName)) {
                  setHospitalSelect(victim.hospitalName);
              } else if (victim.hospitalName) {
                  setHospitalSelect('Autre');
              } else {
                  setHospitalSelect('');
              }

              let migratedVitals = victim.vitals || [];
              if (migratedVitals.length === 0 && (victim.pulse || victim.bp || victim.sao2 || victim.glycemia || victim.temp || victim.eva)) {
                 let timeStr = "00:00";
                 try { timeStr = new Date(victim.arrivalTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch(e) {}

                 migratedVitals.push({
                     id: generateUUID(),
                     time: timeStr,
                     pulse: victim.pulse,
                     sao2: victim.sao2,
                     bp: victim.bp,
                     glycemia: victim.glycemia,
                     temp: victim.temp,
                     eva: victim.eva
                 });
              }

              setFormData({
                ...victim,
                birthDate: victim.birthDate || '',
                arrivalTime: getLocalDateTimeString(victim.arrivalTime),
                careOnSiteTime: victim.careOnSiteTime ? getLocalDateTimeString(victim.careOnSiteTime) : '',
                departureTime: victim.departureTime ? getLocalDateTimeString(victim.departureTime) : '',
                ktTime: victim.ktTime ? getLocalDateTimeString(victim.ktTime) : '',
                tourniquetTime: victim.tourniquetTime ? getLocalDateTimeString(victim.tourniquetTime) : '',
                solutes: victim.solutes || [],
                medicationsList: victim.medicationsList || [],
                responderHistory: victim.responderHistory || [],
                vitals: migratedVitals,
                cprHistory: victim.cprHistory || [],
                photos: victim.photos || []
              });
            } else {
              navigate(`/events/${id}`);
            }
        } catch (e) {
            console.error("Erreur chargement victime", e);
        }
      }
      setIsLoading(false);
    };

    init();
  }, [victimId, id, navigate]);

  const handleChange = useCallback((field: keyof Victim, value: any) => { 
    if (field === 'outcome') { 
      const exitStatuses = [Outcome.RELEASED, Outcome.EVACUATED_HOSPITAL, Outcome.REFUSED_CARE, Outcome.TRANSFER_TO_POST]; 
      setFormData(prev => {
        if (exitStatuses.includes(value) && !prev.departureTime) { 
          return { ...prev, [field]: value, departureTime: getLocalDateTimeString() }; 
        }
        return { ...prev, [field]: value };
      });
      return;
    } 
    setFormData(prev => ({ ...prev, [field]: value })); 
  }, []);

  const handleUpdatePhotos = useCallback((newPhotos: VictimPhoto[]) => {
    setFormData(prev => ({ ...prev, photos: newPhotos }));
  }, []);

  const handleVitalChange = (field: keyof VitalSign, value: string) => { if (value.length > 10) return; setNewVital(prev => ({ ...prev, [field]: value })); };
  const addVitalSign = () => { if (!newVital.pulse && !newVital.sao2 && !newVital.bp && !newVital.glycemia && !newVital.temp && !newVital.eva) return; const entry: VitalSign = { id: generateUUID(), time: newVital.time || getCurrentTime(), pulse: newVital.pulse, sao2: newVital.sao2, bp: newVital.bp, glycemia: newVital.glycemia, temp: newVital.temp, eva: newVital.eva }; setFormData(prev => ({ ...prev, vitals: [...(prev.vitals || []), entry] })); setNewVital({ time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), pulse: '', sao2: '', bp: '', glycemia: '', temp: '', eva: '' }); };
  const removeVitalSign = (vitalId: string) => { setFormData(prev => ({ ...prev, vitals: (prev.vitals || []).filter(v => v.id !== vitalId) })); };
  const addSolute = () => { const newSolute: Solute = { id: generateUUID(), name: '', time: getCurrentTime() }; setFormData(prev => ({ ...prev, solutes: [...(prev.solutes || []), newSolute] })); };
  const removeSolute = (soluteId: string) => { setFormData(prev => ({ ...prev, solutes: (prev.solutes || []).filter(s => s.id !== soluteId) })); };
  const updateSolute = (soluteId: string, field: keyof Solute, value: string) => { if (value.length > MAX_INPUT_LENGTH) return; setFormData(prev => ({ ...prev, solutes: (prev.solutes || []).map(s => s.id === soluteId ? { ...s, [field]: value } : s) })); };
  const addMedication = () => { const newMed: Medication = { id: generateUUID(), name: '', dose: '', time: getCurrentTime() }; setFormData(prev => ({ ...prev, medicationsList: [...(prev.medicationsList || []), newMed] })); };
  const removeMedication = (medId: string) => { setFormData(prev => ({ ...prev, medicationsList: (prev.medicationsList || []).filter(m => m.id !== medId) })); };
  const updateMedication = (medId: string, field: keyof Medication, value: string) => { if (value.length > MAX_INPUT_LENGTH) return; setFormData(prev => ({ ...prev, medicationsList: (prev.medicationsList || []).map(m => m.id === medId ? { ...m, [field]: value } : m) })); };
  const updateDateTime = (field: keyof Victim, type: 'date' | 'time', value: string) => { if (timeError) setTimeError(false); setFormData(prev => { const current = (prev[field] as string) || getLocalDateTimeString(); const parts = current.split('T'); const d = parts[0] || new Date().toISOString().split('T')[0]; const t = parts[1] || "00:00"; const newDate = type === 'date' ? value : d; const newTime = type === 'time' ? value : t; return { ...prev, [field]: `${newDate}T${newTime}` }; }); };
  const setNow = (field: keyof Victim) => { if (timeError) setTimeError(false); setFormData(prev => ({ ...prev, [field]: getLocalDateTimeString() })); };
  const toggleKt = (checked: boolean) => { if (checked) { setFormData(prev => ({ ...prev, hasKt: true, ktTime: prev.ktTime || getLocalDateTimeString() })); } else { setFormData(prev => ({ ...prev, hasKt: false })); } };
  const toggleTourniquet = (checked: boolean) => { if (checked) { setFormData(prev => ({ ...prev, hasTourniquet: true, tourniquetTime: prev.tourniquetTime || getLocalDateTimeString() })); } else { setFormData(prev => ({ ...prev, hasTourniquet: false })); } };

  const getVitalHistory = (type: 'pulse' | 'bp' | 'sao2'): number[] => {
      if (!formData.vitals || formData.vitals.length === 0) return [];
      return [...formData.vitals]
        .sort((a,b) => (a.time || '').localeCompare(b.time || ''))
        .map(v => {
            if (type === 'bp' && v.bp) return parseInt(v.bp.split('/')[0]); 
            if (type === 'pulse' && v.pulse) return parseInt(v.pulse);
            if (type === 'sao2' && v.sao2) return parseInt(v.sao2);
            return 0;
        })
        .filter(v => v > 0);
  };

  const handleHandover = () => {
      if (!formData.responderName) {
          alert("Veuillez renseigner le nom de l'intervenant actuel avant de faire une relève.");
          return;
      }
      const historyEntry: ResponderEntry = {
          id: generateUUID(),
          timestamp: Date.now(),
          name: formData.responderName,
          firstName: formData.responderFirstName || '',
          team: formData.responderTeam || ''
      };
      setFormData(prev => ({
          ...prev,
          responderHistory: [...(prev.responderHistory || []), historyEntry],
          responderName: '',
          responderFirstName: '',
          responderTeam: '',
      }));
      alert("Intervenant archivé. Veuillez saisir le nouvel intervenant (Relève).");
      setIsResponderOpen(true);
  };

  const handleExportPdf = async () => {
      if (!eventData) {
          alert("Erreur: Données événement manquantes.");
          return;
      }
      setIsExporting(true);
      try {
          const { generateSingleVictimReport } = await import('../services/pdfService');
          const victimForPdf = { ...formData, id: victimId || 'temp' } as Victim;
          const { fileName, blob } = await generateSingleVictimReport(eventData, victimForPdf);
          
          const file = new File([blob], fileName, { type: 'application/pdf' });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  files: [file],
                  title: 'Fiche Bilan Victime',
                  text: `Bilan pour ${formData.fullName}`
              });
          } else {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
          }
      } catch (e) {
          alert("Erreur lors de la génération du PDF.");
          console.error(e);
      } finally {
          setIsExporting(false);
      }
  };

  const doSaveVictim = async () => {
    if (!id) return;
    setIsSubmitting(true);

    let arrivalDateObj: Date; try { arrivalDateObj = formData.arrivalTime ? new Date(formData.arrivalTime) : new Date(); } catch { arrivalDateObj = new Date(); }
    const careOnSiteDateObj = formData.careOnSiteTime ? new Date(formData.careOnSiteTime) : undefined;
    const departureDateObj = formData.departureTime ? new Date(formData.departureTime) : undefined;
    const ktDateObj = formData.ktTime ? new Date(formData.ktTime) : undefined;
    const tourniquetDateObj = formData.tourniquetTime ? new Date(formData.tourniquetTime) : undefined;
    const safeArrivalTime = (formData.arrivalTime) ? arrivalDateObj.toISOString() : arrivalDateObj.toISOString(); 
    const safeCareTime = (careOnSiteDateObj && !isNaN(careOnSiteDateObj.getTime())) ? careOnSiteDateObj.toISOString() : undefined;
    const safeDepartureTime = (departureDateObj && !isNaN(departureDateObj.getTime())) ? departureDateObj.toISOString() : undefined;
    const safeKtTime = (ktDateObj && !isNaN(ktDateObj.getTime())) ? ktDateObj.toISOString() : undefined;
    const safeTourniquetTime = (tourniquetDateObj && !isNaN(tourniquetDateObj.getTime())) ? tourniquetDateObj.toISOString() : undefined;
    const isDeceased = formData.outcome === Outcome.DECEASED;

    const victimData = {
      ...formData,
      eventId: id,
      birthDate: formData.birthDate || undefined,
      arrivalTime: safeArrivalTime,
      careOnSiteTime: safeCareTime,
      departureTime: safeDepartureTime,
      ktTime: safeKtTime,
      tourniquetTime: safeTourniquetTime,
      deceasedDetails: isDeceased ? (formData.deceasedDetails || '') : undefined,
      deceasedDate: isDeceased ? (formData.deceasedDate || '') : undefined,
      deceasedTime: isDeceased ? (formData.deceasedTime || '') : undefined,
      deceasedDoctorName: isDeceased ? (formData.deceasedDoctorName || '') : undefined,
      hospitalName: formData.outcome === Outcome.EVACUATED_HOSPITAL ? formData.hospitalName : undefined,
      pulse: undefined, sao2: undefined, bp: undefined, glycemia: undefined, temp: undefined, eva: undefined
    } as Victim;

    try {
        if (isEditing && victimId) { await storageService.updateVictim({ ...victimData, id: victimId }); } else { await storageService.addVictim({ ...victimData, id: generateUUID() }); }
        setShowValidationModal(false);
        navigate(`/events/${id}`);
    } catch (err) { console.error("Erreur enregistrement:", err); alert("Une erreur est survenue lors de l'enregistrement. Vérifiez votre connexion."); } finally { setIsSubmitting(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (formData.phoneNumber && !isValidPhoneNumber(formData.phoneNumber)) { alert("Le format du numéro de téléphone semble invalide."); return; }
    
    const hasArrival = formData.arrivalTime && formData.arrivalTime.length > 5;
    const hasCare = formData.careOnSiteTime && formData.careOnSiteTime.length > 5;

    if (!hasArrival && !hasCare) {
        setTimeError(true);
        alert("ERREUR : Vous devez renseigner au moins une heure de prise en charge (Terrain ou Poste de Secours).");
        topRef.current?.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    const requiresValidation = [
      Outcome.RELEASED,
      Outcome.EVACUATED_HOSPITAL,
      Outcome.REFUSED_CARE,
      Outcome.DECEASED
    ].includes(formData.outcome as Outcome);

    if (requiresValidation) {
      setShowValidationModal(true);
    } else {
      await doSaveVictim();
    }
  };

  if (isLoading) {
      return (
          <Layout title="Chargement..." showBack>
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
          </Layout>
      );
  }

  const getResponderSummary = () => {
      const parts = [ formData.responderName, formData.responderFirstName, formData.responderTeam ? `(${formData.responderTeam})` : null ].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : "Non renseigné";
  };

  const getCprDuration = () => {
      if (!formData.cprHistory || formData.cprHistory.length === 0) return "00:00";
      const start = formData.cprHistory[0].timestamp;
      const last = formData.cprHistory[formData.cprHistory.length - 1].timestamp;
      const diff = Math.floor((last - start) / 1000);
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
  };

  const getRelativeTimeFromStart = (ts: number) => {
      if (!formData.cprHistory || formData.cprHistory.length === 0) return "T+00:00";
      const start = formData.cprHistory[0].timestamp;
      const diff = Math.floor((ts - start) / 1000);
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      return `T+${m}:${s}`;
  };

  return (
    <Layout title={isEditing ? "Modifier la fiche" : "Nouvelle fiche"} showBack>
      {showFullChartModal && <FullChartModal vitals={formData.vitals || []} onClose={() => setShowFullChartModal(false)} />}
      
      <form onSubmit={handleSubmit} className="space-y-6 pb-10" autoComplete="off">
        <div ref={topRef}></div>
        {config && (
            <datalist id="teams-list">
              {config.teams.map(t => <option key={t} value={t} />)}
            </datalist>
        )}
        
        {/* HEADER ACTIONS */}
        <div className="-mt-4 space-y-2">
            <button
                type="button"
                onClick={(e) => { e.preventDefault(); handleGenerateSamuAi(); }}
                className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-xs border border-blue-700/60 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
            >
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Générer Synthèse Chronologique SAMU 15 (IA)</span>
            </button>

            <div className="grid grid-cols-3 gap-2 w-full">
                <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); handleCopySmsFormat(); }}
                    className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 py-1.5 rounded-lg text-xs font-extrabold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors shadow-sm"
                    title="Générer et copier un bilan condensé au format SMS Montagne"
                >
                    {copiedSms ? <Check className="w-4 h-4 text-green-500 animate-bounce shrink-0" /> : <Send className="w-4 h-4 text-amber-500 shrink-0" />} <span>{copiedSms ? 'Copié !' : 'SMS'}</span>
                </button>
                <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setShowQrModal(true); }}
                    className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 py-1.5 rounded-lg text-xs font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                    <QrCode className="w-4 h-4 shrink-0" /> <span>QR Code</span>
                </button>
                <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); handleExportPdf(); }}
                    disabled={isExporting}
                    title="Exporter la Fiche-Bilan de Secours SSU/SAMU"
                    className="flex items-center justify-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 py-1.5 rounded-lg text-xs font-extrabold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors shadow-sm disabled:opacity-50"
                >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <FileText className="w-4 h-4 shrink-0" />} <span>PDF</span>
                </button>
            </div>
        </div>

        {/* --- RCP HISTORIQUE --- */}
        {formData.cprHistory && formData.cprHistory.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl shadow-md border-l-4 border-red-600 p-4 mb-4">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowFullCpr(!showFullCpr)}>
                    <div className="flex flex-col">
                        <h3 className="text-sm font-black text-red-700 dark:text-red-400 uppercase flex items-center gap-2"><Zap className="w-5 h-5 fill-current" /> RELEVÉ DE RÉANIMATION</h3>
                        <span className="text-[10px] text-red-600 dark:text-red-300 font-bold ml-7">{formData.cprHistory.length} événements enregistrés</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded border border-red-100 dark:border-red-900"><Timer className="w-4 h-4 text-red-500" /> {getCprDuration()}</div>
                        {showFullCpr ? <ChevronUp className="w-5 h-5 text-red-500" /> : <ChevronDown className="w-5 h-5 text-red-500" />}
                    </div>
                </div>
                {showFullCpr && (
                    <div className="relative border-l-2 border-red-200 dark:border-red-800 ml-2 space-y-4 py-4 mt-4 animate-in slide-in-from-top-2">
                        {[...formData.cprHistory].reverse().map((event, i) => (
                            <div key={i} className="pl-4 relative flex flex-col">
                                <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 ${event.action === 'DRUG' ? 'bg-purple-500 border-purple-700' : 'bg-red-100 dark:bg-red-900 border-red-500'}`}></div>
                                <div className="flex justify-between items-start text-xs mb-0.5"><span className={`font-bold uppercase ${event.action === 'DRUG' ? 'text-purple-700 dark:text-purple-400' : 'text-red-800 dark:text-red-300'}`}>{event.action}</span><span className="font-mono text-slate-500 dark:text-slate-400">{getRelativeTimeFromStart(event.timestamp)}</span></div>
                                <div className="text-sm text-slate-700 dark:text-slate-200 font-medium">{event.details || '-'}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{new Date(event.timestamp).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* --- INTERVENANT --- */}
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/30 overflow-hidden">
            <button type="button" onClick={() => setIsResponderOpen(!isResponderOpen)} className="w-full flex items-center justify-between focus:outline-none p-3 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors">
                <div className="flex items-center gap-3">
                     <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400"><ShieldCheck className="w-4 h-4" /></div>
                     <div className="flex flex-col items-start text-left"><h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Intervenant / Relève</h3>{!isResponderOpen && (<span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{getResponderSummary()}</span>)}</div>
                </div>
                {isResponderOpen ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5 text-blue-400" />}
            </button>
            {isResponderOpen && (
                <div className="p-3 border-t border-blue-100 dark:border-blue-900/30 bg-white/50 dark:bg-slate-900/20 animate-in slide-in-from-top-1">
                    {formData.responderHistory && formData.responderHistory.length > 0 && (
                        <div className="mb-4 pl-2 border-l-2 border-slate-200 dark:border-slate-700 space-y-3">
                            {formData.responderHistory.map((h) => (
                                <div key={h.id} className="relative pl-4"><div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-400"></div><div className="text-[10px] text-slate-400 font-mono mb-0.5">{new Date(h.timestamp).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</div><div className="text-xs font-bold text-slate-600 dark:text-slate-300">{h.firstName} {h.name} {h.team && `(${h.team})`}</div></div>
                            ))}
                            <div className="pl-4 pt-1"><div className="text-[10px] text-blue-500 font-bold uppercase flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Relève</div></div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div><label className={labelClass}>Nom</label><input type="text" className={inputClass} value={formData.responderName} onChange={e => handleChange('responderName', e.target.value)} maxLength={MAX_INPUT_LENGTH} disabled={isSubmitting} /></div>
                        <div><label className={labelClass}>Prénom</label><input type="text" className={inputClass} value={formData.responderFirstName} onChange={e => handleChange('responderFirstName', e.target.value)} maxLength={MAX_INPUT_LENGTH} disabled={isSubmitting} /></div>
                        <div><label className={labelClass}>Équipe</label><input type="text" list="teams-list" className={inputClass} value={formData.responderTeam} onChange={e => handleChange('responderTeam', e.target.value)} maxLength={MAX_INPUT_LENGTH} disabled={isSubmitting} /></div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/50 flex justify-end">
                        <button type="button" onClick={handleHandover} className="text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors"><Plus className="w-3 h-3" /> Signaler une relève</button>
                    </div>
                </div>
            )}
        </div>

        {/* --- IDENTITÉ --- */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Identité & Installation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg border transition-colors ${timeError ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50'} mb-2`}>
                     {timeError && (<div className="col-span-1 sm:col-span-2 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-2 mb-2 animate-pulse"><AlertTriangle className="w-4 h-4" /> Veuillez noter l'heure de prise en charge</div>)}
                     <div className="col-span-1">
                        <label className={`${labelClass} flex items-center gap-1 text-orange-600 dark:text-orange-400`}><MapPin className="w-3 h-3" /> Prise en charge Terrain</label>
                        <div className="flex gap-2"><input type="date" className={`${inputClass} w-1/2 dark:[color-scheme:dark]`} value={formData.careOnSiteTime?.split('T')[0] || ''} onChange={e => updateDateTime('careOnSiteTime', 'date', e.target.value)} disabled={isSubmitting} /><input type="time" className={`${inputClass} w-1/2 dark:[color-scheme:dark]`} value={formData.careOnSiteTime?.split('T')[1] || ''} onChange={e => updateDateTime('careOnSiteTime', 'time', e.target.value)} disabled={isSubmitting} /></div>
                        <button type="button" onClick={() => setNow('careOnSiteTime')} className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Maintenant</button>
                    </div>
                    <div className="col-span-1">
                        <label className={`${labelClass} flex items-center gap-1 text-blue-600 dark:text-blue-400`}><Building2 className="w-3 h-3" /> Arrivée Poste de Secours</label>
                        <div className="flex gap-2"><input type="date" className={`${inputClass} w-1/2 dark:[color-scheme:dark]`} value={formData.arrivalTime?.split('T')[0] || ''} onChange={e => updateDateTime('arrivalTime', 'date', e.target.value)} disabled={isSubmitting} /><input type="time" className={`${inputClass} w-1/2 dark:[color-scheme:dark]`} value={formData.arrivalTime?.split('T')[1] || ''} onChange={e => updateDateTime('arrivalTime', 'time', e.target.value)} disabled={isSubmitting} /></div>
                        <button type="button" onClick={() => setNow('arrivalTime')} className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Maintenant</button>
                    </div>
                </div>
                <div className="col-span-1 sm:col-span-2 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                    <label className={`${labelClass} flex items-center gap-1 whitespace-nowrap mb-0`}><Bed className="w-4 h-4 text-blue-500"/> Installation immédiate :</label>
                    <select className={`${inputClass} max-w-[200px] font-bold`} value={formData.resourceUsed || 'none'} onChange={e => handleChange('resourceUsed', e.target.value)}><option value="none">--</option><option value="stretcher">Brancard</option><option value="chair">Chaise</option></select>
                </div>
                <div className="col-span-1"><label className={labelClass}>Dossard n°</label><input type="text" className={`${inputClass} text-lg font-mono`} placeholder="123" value={formData.bibNumber} onChange={e => handleChange('bibNumber', e.target.value)} maxLength={20} disabled={isSubmitting} /></div>
                <div className="col-span-1 sm:col-span-2"><label className={labelClass}>Nom Complet de la Victime</label><input type="text" required className={inputClass} placeholder="Inconnu / Jean Dupont" value={formData.fullName} onChange={e => handleChange('fullName', e.target.value)} maxLength={MAX_INPUT_LENGTH} disabled={isSubmitting} /></div>
                <div className="col-span-1"><label className={labelClass}>Date de naissance</label><input type="date" className={`${inputClass} dark:[color-scheme:dark]`} value={formData.birthDate || ''} onChange={e => handleChange('birthDate', e.target.value)} disabled={isSubmitting} /></div>
                <div className="col-span-1"><label className={`${labelClass} flex items-center gap-1`}><Phone className="w-3 h-3" /> Téléphone</label><input type="tel" className={inputClass} placeholder="06..." value={formData.phoneNumber} onChange={e => handleChange('phoneNumber', e.target.value)} maxLength={MAX_PHONE_LENGTH} disabled={isSubmitting} /></div>
                <div className="col-span-1"><label className={labelClass}>Contact Urgence (ICE)</label><input type="text" className={inputClass} placeholder="Nom & Numéro" value={formData.emergencyContact} onChange={e => handleChange('emergencyContact', e.target.value)} maxLength={MAX_INPUT_LENGTH} disabled={isSubmitting} /></div>
            </div>
        </div>

        {/* --- CONSTANTES --- */}
        <div className="bg-emerald-50/30 dark:bg-emerald-900/10 p-4 rounded-xl shadow-sm border border-emerald-100 dark:border-emerald-900/30">
            <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2"><HeartPulse className="w-4 h-4" /> Suivi Constantes Vitales</h3>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/50 mb-4 shadow-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="col-span-2 sm:col-span-1"><label className={labelClass}>Heure</label><input type="text" className={`${inputClass} text-center font-bold`} value={newVital.time} onChange={e => handleVitalChange('time', e.target.value)} maxLength={10} disabled={isSubmitting} /></div>
                    <div><label className={labelClass}>Pouls (bpm)</label><input type="number" placeholder="ex: 75" className={inputClass} value={newVital.pulse} onChange={e => handleVitalChange('pulse', e.target.value)} disabled={isSubmitting} /></div>
                    <div><label className={labelClass}>SaO2 (%)</label><input type="number" placeholder="ex: 98" className={inputClass} value={newVital.sao2} onChange={e => handleVitalChange('sao2', e.target.value)} disabled={isSubmitting} /></div>
                    <div><label className={labelClass}>TA</label><input type="text" placeholder="12/8" className={inputClass} value={newVital.bp} onChange={e => handleVitalChange('bp', e.target.value)} maxLength={10} disabled={isSubmitting} /></div>
                    <div><label className={labelClass}>Glyc (g/L)</label><input type="text" placeholder="1.10" className={inputClass} value={newVital.glycemia} onChange={e => handleVitalChange('glycemia', e.target.value)} maxLength={10} disabled={isSubmitting} /></div>
                    <div><label className={labelClass}>Temp (°C)</label><input type="text" placeholder="37.5" className={inputClass} value={newVital.temp} onChange={e => handleVitalChange('temp', e.target.value)} maxLength={10} disabled={isSubmitting} /></div>
                    <div><label className={labelClass}>EVA (0-10)</label><input type="number" min="0" max="10" placeholder="0" className={inputClass} value={newVital.eva} onChange={e => handleVitalChange('eva', e.target.value)} disabled={isSubmitting} /></div>
                    <div className="flex items-end"><button type="button" onClick={addVitalSign} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg font-bold shadow-sm transition-colors flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Ajouter</button></div>
                </div>
            </div>
            {formData.vitals && formData.vitals.length > 0 ? (
                <div className="space-y-2">
                    <div className="flex flex-col gap-2 mb-2">
                        <div className="flex items-center justify-between"><div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2"><History className="w-3 h-3 flex-shrink-0" /> Tendances</div><button type="button" onClick={() => setShowFullChartModal(true)} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="Vue Plein Écran"><Maximize2 className="w-4 h-4" /></button></div>
                        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            <div className="flex items-center gap-1 flex-shrink-0"><Sparkline data={getVitalHistory('pulse')} color="#ef4444" height={25} /><span className="text-[10px] font-bold text-red-500">FC</span></div>
                            <div className="flex items-center gap-1 flex-shrink-0"><Sparkline data={getVitalHistory('sao2')} color="#06b6d4" height={25} /><span className="text-[10px] font-bold text-cyan-500">SpO2</span></div>
                            <div className="flex items-center gap-1 flex-shrink-0"><Sparkline data={getVitalHistory('bp')} color="#3b82f6" height={25} /><span className="text-[10px] font-bold text-blue-500">TA</span></div>
                        </div>
                    </div>
                    <button type="button" onClick={() => setShowVitalList(!showVitalList)} className="w-full flex items-center justify-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 mb-2">{showVitalList ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}{showVitalList ? 'Masquer l\'historique détaillé' : `Voir l'historique complet (${formData.vitals.length})`}</button>
                    {showVitalList && (
                        <div className="animate-in slide-in-from-top-2 space-y-2">
                            {[...formData.vitals].sort((a, b) => (b.time || '').localeCompare(a.time || '')).map((vital) => (
                                <div key={vital.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{vital.time}</span>
                                        <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 grid grid-cols-3 sm:flex sm:flex-wrap gap-x-3 gap-y-1">
                                            {vital.pulse && <span><span className="font-semibold text-red-500">FC:</span> {vital.pulse}</span>}
                                            {vital.bp && <span><span className="font-semibold text-blue-500">TA:</span> {vital.bp}</span>}
                                            {vital.sao2 && <span><span className="font-semibold text-cyan-500">SpO2:</span> {vital.sao2}%</span>}
                                            {vital.glycemia && <span><span className="font-semibold text-yellow-500">Gly:</span> {vital.glycemia}</span>}
                                            {vital.temp && <span><span className="font-semibold text-purple-500">T°:</span> {vital.temp}</span>}
                                            {vital.eva && <span><span className="font-semibold text-orange-500">EVA:</span> {vital.eva}</span>}
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeVitalSign(vital.id)} className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (<div className="text-center p-4 text-sm text-slate-400 italic">Aucune constante relevée pour le moment.</div>)}
        </div>

        {/* --- BILAN CLINIQUE --- */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
             <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800 mb-4">
                <label className={`${labelClass} text-red-700 dark:text-red-400 mb-2 font-bold flex items-center gap-2`}><Flame className="w-4 h-4 fill-current" /> Hémorragie (Pose Garrot)</label>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button type="button" onClick={() => toggleTourniquet(true)} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${formData.hasTourniquet ? 'bg-red-600 text-white shadow' : 'text-slate-500'}`}>OUI</button>
                        <button type="button" onClick={() => toggleTourniquet(false)} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${!formData.hasTourniquet ? 'bg-slate-500 text-white shadow' : 'text-slate-500'}`}>NON</button>
                    </div>
                    {formData.hasTourniquet && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                                <span className="text-xs font-bold text-red-600 dark:text-red-400">Heure de pose :</span>
                                <div className="flex gap-1">
                                    <input type="time" className={`${inputClass} !py-1 !text-sm w-auto dark:[color-scheme:dark]`} value={formData.tourniquetTime ? formData.tourniquetTime.split('T')[1] : ''} onChange={e => updateDateTime('tourniquetTime', 'time', e.target.value)} disabled={isSubmitting} />
                                    <button type="button" onClick={() => setNow('tourniquetTime')} className="text-red-500 hover:text-red-700 p-1"><RefreshCw className="w-4 h-4" /></button>
                                </div>
                        </div>
                    )}
                </div>
             </div>
             <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Bilan Clinique</h3>
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between items-center mb-1"><label className={labelClass}>Motif de consultation</label><button type="button" onClick={() => startReason()} className={`p-1.5 rounded-full transition-colors flex items-center gap-1 ${isListeningReason ? 'bg-red-100 text-red-600 animate-pulse border border-red-200' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{isListeningReason ? <><MicOff className="w-4 h-4" /><span className="text-xs font-bold">Enregistrement...</span></> : <Mic className="w-4 h-4" />}</button></div>
                    <textarea required rows={2} className={inputClass} placeholder="ex: Douleur thoracique, Entorse..." value={formData.reason} onChange={e => handleChange('reason', e.target.value)} maxLength={MAX_TEXTAREA_LENGTH} disabled={isSubmitting} />
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1"><label className={labelClass}>Soins prodigués</label><button type="button" onClick={() => startCare()} className={`p-1.5 rounded-full transition-colors flex items-center gap-1 ${isListeningCare ? 'bg-red-100 text-red-600 animate-pulse border border-red-200' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{isListeningCare ? <><MicOff className="w-4 h-4" /><span className="text-xs font-bold">Enregistrement...</span></> : <Mic className="w-4 h-4" />}</button></div>
                    <textarea required rows={3} className={inputClass} placeholder="ex: Immobilisation, Désinfection..." value={formData.careProvided} onChange={e => handleChange('careProvided', e.target.value)} maxLength={MAX_TEXTAREA_LENGTH} disabled={isSubmitting} />
                </div>
            </div>
        </div>

        {/* --- PHOTOS --- */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Camera className="w-4 h-4" /> Photos & Preuves</h3>
            <PhotoGallery photos={formData.photos || EMPTY_PHOTOS} onUpdate={handleUpdatePhotos} />
        </div>

        {/* --- MODE AVANCÉ (RESTREINT AUX IDE/MED/ADMIN) --- */}
        {canAccessMedicalCare ? (
            <div className="bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/30">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <h3 className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-2 flex-shrink-0"><Stethoscope className="w-4 h-4" /> Soins IDE</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase hidden sm:inline">ACTIVER MODE AVANCÉ</span>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input type="checkbox" className="sr-only peer" checked={formData.isAdvancedMode} onChange={e => handleChange('isAdvancedMode', e.target.checked)} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>
                </div>
                {formData.isAdvancedMode && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                            <label className={`${labelClass} text-purple-700 dark:text-purple-400 mb-2 font-bold flex items-center gap-2`}><Syringe className="w-4 h-4" /> Pose de KT (Voie Veineuse)</label>
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                                    <button type="button" onClick={() => toggleKt(true)} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${formData.hasKt ? 'bg-purple-600 text-white shadow' : 'text-slate-500'}`}>OUI</button>
                                    <button type="button" onClick={() => toggleKt(false)} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${!formData.hasKt ? 'bg-slate-500 text-white shadow' : 'text-slate-500'}`}>NON</button>
                                </div>
                                {formData.hasKt && (
                                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                                        <span className="text-xs font-bold text-slate-500">Heure de pose :</span>
                                        <div className="flex gap-1">
                                            <input type="date" className={`${inputClass} !py-1 !text-sm w-auto dark:[color-scheme:dark]`} value={formData.ktTime ? formData.ktTime.split('T')[0] : ''} onChange={e => updateDateTime('ktTime', 'date', e.target.value)} disabled={isSubmitting} />
                                            <input type="time" className={`${inputClass} !py-1 !text-sm w-auto dark:[color-scheme:dark]`} value={formData.ktTime ? formData.ktTime.split('T')[1] : ''} onChange={e => updateDateTime('ktTime', 'time', e.target.value)} disabled={isSubmitting} />
                                            <button type="button" onClick={() => setNow('ktTime')} className="text-blue-500 hover:text-blue-700 p-1"><RefreshCw className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className={labelClass}>Solutés de Remplissage</label>
                            {(formData.solutes || []).map((solute) => (
                                <div key={solute.id} className="flex items-end gap-2 animate-in slide-in-from-left-2 duration-200">
                                    <div className="flex-1"><select className={inputClass} value={solute.name} onChange={e => updateSolute(solute.id, 'name', e.target.value)}><option value="">-- Sélectionner --</option>{[...(config?.solutes || [])].sort((a, b) => a.localeCompare(b)).map(item => <option key={item} value={item}>{item}</option>)}</select></div>
                                    <div className="w-24"><input type="time" className={`${inputClass} text-center dark:[color-scheme:dark]`} value={solute.time} onChange={e => updateSolute(solute.id, 'time', e.target.value)} /></div>
                                    <button type="button" onClick={() => removeSolute(solute.id)} className="p-2.5 text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                            <button type="button" onClick={addSolute} className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline px-1 py-2"><Plus className="w-3 h-3" /> AJOUTER UN SOLUTÉ</button>
                        </div>
                        <div className="space-y-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                            <label className={`${labelClass} flex items-center gap-2 text-purple-700 dark:text-purple-400`}><Pill className="w-4 h-4" /> Médicaments Administrés</label>
                            {(formData.medicationsList || []).map((med) => (
                                <div key={med.id} className="flex items-end gap-2 animate-in slide-in-from-left-2 duration-200">
                                    <div className="flex-1 min-w-[100px]"><label className="text-[10px] text-slate-400 block mb-0.5">Nom</label><select className={`${inputClass} !text-sm !p-1.5`} value={med.name} onChange={e => updateMedication(med.id, 'name', e.target.value)}><option value="">-- Sélectionner --</option>{[...(config?.medications || [])].sort((a, b) => a.localeCompare(b)).map(item => <option key={item} value={item}>{item}</option>)}</select></div>
                                    <div className="w-24"><label className="text-[10px] text-slate-400 block mb-0.5">Dose</label><input type="text" placeholder="Ex: 1g IV" className={`${inputClass} !text-sm !p-1.5`} value={med.dose} onChange={e => updateMedication(med.id, 'dose', e.target.value)} maxLength={MAX_INPUT_LENGTH} /></div>
                                    <div className="w-20"><label className="text-[10px] text-slate-400 block mb-0.5">Heure</label><input type="time" className={`${inputClass} !text-xs !p-1 text-center dark:[color-scheme:dark]`} value={med.time} onChange={e => updateMedication(med.id, 'time', e.target.value)} /></div>
                                    <div className="w-8 flex justify-center pb-1"><button type="button" onClick={() => removeMedication(med.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4" /></button></div>
                                </div>
                            ))}
                            <button type="button" onClick={addMedication} className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline mt-2"><Plus className="w-3 h-3" /> AJOUTER MÉDICAMENT</button>
                        </div>
                        <div><label className="labelClass">Commentaires / Observations TTT (Optionnel)</label><textarea rows={2} className={inputClass} placeholder="Observations libres..." value={formData.medications} onChange={e => handleChange('medications', e.target.value)} maxLength={MAX_TEXTAREA_LENGTH} /></div>
                        <div className="p-3 bg-purple-100/50 dark:bg-purple-900/30 rounded-lg flex items-center justify-between border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300 font-bold text-xs uppercase"><CheckCircle2 className="w-4 h-4" /> Validation Régulation SAMU</div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={formData.samuValidated} onChange={e => handleChange('samuValidated', e.target.checked)} />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        ) : (
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400 italic">
                Mode Médical réservé aux Infirmiers et Médecins.
            </div>
        )}

        {/* --- DEVENIR --- */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
             <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> Devenir & Signature</h3>
            <div className="mb-4">
                <label className={`${labelClass} flex items-center gap-1`}><Clock className="w-3 h-3" /> Heure de départ</label>
                <div className="flex gap-2 max-w-sm"><input type="date" className={`${inputClass} w-1/2 dark:[color-scheme:dark]`} value={formData.departureTime ? formData.departureTime.split('T')[0] : ''} onChange={e => updateDateTime('departureTime', 'date', e.target.value)} disabled={isSubmitting} /><input type="time" className={`${inputClass} w-1/2 dark:[color-scheme:dark]`} value={formData.departureTime ? formData.departureTime.split('T')[1] : ''} onChange={e => updateDateTime('departureTime', 'time', e.target.value)} disabled={isSubmitting} /></div>
                 <button type="button" onClick={() => setNow('departureTime')} className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Maintenant</button>
            </div>
            <div className="space-y-2 mb-6">
                {Object.values(Outcome).map((outcome) => (
                    <div key={outcome}>
                        <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${formData.outcome === outcome ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            <input type="radio" name="outcome" value={outcome} checked={formData.outcome === outcome} onChange={(e) => handleChange('outcome', e.target.value)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" disabled={isSubmitting} />
                            <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-200">{outcome}</span>
                        </label>
                        {outcome === Outcome.EVACUATED_HOSPITAL && formData.outcome === Outcome.EVACUATED_HOSPITAL && (
                            <div className="ml-8 mt-2 mr-2 animate-in slide-in-from-top-2 duration-200">
                                <label className={labelClass}>Destination</label>
                                <div className="space-y-2">
                                    <select className={inputClass} value={hospitalSelect} onChange={(e) => { setHospitalSelect(e.target.value); if (e.target.value !== 'Autre') { handleChange('hospitalName', e.target.value); } else { handleChange('hospitalName', ''); } }}>
                                        <option value="">-- Sélectionner Hôpital --</option>{config?.hospitals.map(h => <option key={h} value={h}>{h}</option>)}<option value="Autre">Autre / Non listé</option>
                                    </select>
                                    {hospitalSelect === 'Autre' && (<input type="text" placeholder="Préciser le nom..." className={inputClass} value={formData.hospitalName} onChange={e => handleChange('hospitalName', e.target.value)} required={formData.outcome === Outcome.EVACUATED_HOSPITAL} maxLength={MAX_INPUT_LENGTH} />)}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {formData.outcome === Outcome.REFUSED_CARE && (
                <div className="mb-6 animate-in fade-in duration-500 bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-100 dark:border-orange-800">
                    <label className={`${labelClass} flex items-center gap-1 mb-2 text-orange-800 dark:text-orange-300 font-bold`}><PenTool className="w-4 h-4" /> Signature Victime / Témoin (Refus de soin)</label>
                    <SignaturePad onSave={(data) => handleChange('signatureData', data)} initialData={formData.signatureData} />
                </div>
            )}
            {formData.outcome === Outcome.DECEASED && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300 p-4 border border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 rounded-lg space-y-3">
                    <h4 className="text-sm font-bold text-red-800 dark:text-red-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Constat de décès</h4>
                    <div>
                        <label className="block text-xs font-medium text-red-700 dark:text-red-300 mb-1">Nom du Médecin (Déclarant)</label>
                        <input type="text" className="w-full p-2 border border-red-200 dark:border-red-800 bg-white dark:bg-slate-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-white text-sm" placeholder="ex: Dr. Martin" value={formData.deceasedDoctorName || ''} onChange={e => handleChange('deceasedDoctorName', e.target.value)} disabled={isSubmitting} maxLength={MAX_INPUT_LENGTH} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-medium text-red-700 dark:text-red-300 mb-1">Date</label><input type="date" className="w-full p-2 border border-red-200 dark:border-red-800 bg-white dark:bg-slate-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-white text-sm dark:[color-scheme:dark]" value={formData.deceasedDate || ''} onChange={e => handleChange('deceasedDate', e.target.value)} disabled={isSubmitting} /></div>
                         <div><label className="block text-xs font-medium text-red-700 dark:text-red-300 mb-1">Heure</label><input type="time" className="w-full p-2 border border-red-200 dark:border-red-800 bg-white dark:bg-slate-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-white text-sm dark:[color-scheme:dark]" value={formData.deceasedTime || ''} onChange={e => handleChange('deceasedTime', e.target.value)} disabled={isSubmitting} /></div>
                    </div>
                    <div><label className="block text-xs font-medium text-red-700 dark:text-red-300 mb-1">Détails / Circonstances</label><textarea rows={3} className="w-full p-2 border border-red-200 dark:border-red-800 bg-white dark:bg-slate-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none placeholder-red-300 dark:placeholder-red-700 text-slate-800 dark:text-white text-sm" placeholder="Circonstances..." value={formData.deceasedDetails || ''} onChange={e => handleChange('deceasedDetails', e.target.value)} maxLength={MAX_TEXTAREA_LENGTH} disabled={isSubmitting} /></div>
                    <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800/50">
                        <label className={`${labelClass} flex items-center gap-1 mb-2 text-red-800 dark:text-red-300 font-bold`}><PenTool className="w-4 h-4" /> Signature Médecin</label>
                        <SignaturePad onSave={(data) => handleChange('doctorSignatureData', data)} initialData={formData.doctorSignatureData} />
                    </div>
                </div>
            )}


        </div>

        <div className="sticky bottom-4 space-y-2">
            <Button type="submit" fullWidth className="shadow-xl" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : (isEditing ? 'Mettre à jour la fiche' : 'Enregistrer la fiche')}
            </Button>
        </div>
        
        {/* Modal Validation Officielle & Signature du Bilan */}
        <Modal
          isOpen={showValidationModal}
          onClose={() => setShowValidationModal(false)}
          title="Validation Officielle & Signature"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          maxWidth="max-w-md"
          footer={
            <>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowValidationModal(false)}
                className="rounded-xl border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm py-2 px-3.5 min-h-[40px]"
              >
                Fermer
              </Button>
              <Button 
                type="button" 
                onClick={() => {
                  const activeValideur = formData.validatedBy || (profile ? `${profile.firstName || ''} ${profile.lastName || ''} (${profile.role || 'SECOURISTE'})`.trim() : '');
                  
                  if (!activeValideur.trim()) {
                    alert("Veuillez renseigner le nom et la qualité du valideur.");
                    return;
                  }
                  if (!formData.doctorSignatureData && !formData.signatureData) {
                    alert("La signature numérique du valideur est obligatoire pour valider et enregistrer la fiche.");
                    return;
                  }

                  if (!formData.validatedBy) {
                    handleChange('validatedBy', activeValideur);
                    handleChange('validatedAt', Date.now());
                  }

                  doSaveVictim();
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl py-2 px-4 text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center gap-1.5 min-h-[40px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enregistrement...</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Valider & Enregistrer</>}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Statut de clôture</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                  Validation & signature obligatoires
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shrink-0">
                {formData.outcome}
              </span>
            </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                      Valideur / Signataire (Chef / Médecin) *
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none" 
                      placeholder="Nom, Prénom & Qualité (ex: Dr. Martin / Chef Poste)"
                      value={formData.validatedBy || (profile ? `${profile.firstName || ''} ${profile.lastName || ''} (${profile.role || 'SECOURISTE'})`.trim() : '')}
                      onChange={(e) => {
                        handleChange('validatedBy', e.target.value);
                        handleChange('validatedAt', Date.now());
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="space-y-0.5 pr-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-white block">Validation Régulation SAMU 15 / Chef</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Autorise la clôture et transmission</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={!!formData.samuValidated} 
                        onChange={(e) => {
                          handleChange('samuValidated', e.target.checked);
                          if (e.target.checked) {
                            if (!formData.validatedBy && profile) {
                              handleChange('validatedBy', `${profile.firstName || ''} ${profile.lastName || ''} (${profile.role || 'SECOURISTE'})`.trim());
                            }
                            handleChange('validatedAt', Date.now());
                          }
                        }} 
                      />
                      <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Signature Numérique du Valideur *</span>
                    </label>
                    <div className="bg-white rounded-lg p-0.5 text-slate-900 border border-slate-300 dark:border-slate-700">
                      <SignaturePad 
                        height="120px"
                        onSave={(data) => {
                          handleChange('doctorSignatureData', data);
                          if (data) {
                            handleChange('samuValidated', true);
                            handleChange('validatedAt', Date.now());
                          }
                        }} 
                        initialData={formData.doctorSignatureData} 
                      />
                    </div>
                  </div>

                  {formData.outcome === Outcome.DECEASED && (
                    <div className="p-2 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-red-800 dark:text-red-200 text-[11px]">
                      <p className="font-bold flex items-center gap-1 flex-wrap"><AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" /> Constat : Dr. {formData.deceasedDoctorName || 'Non spécifié'}</p>
                    </div>
                  )}
                </div>
              </div>
        </Modal>
        
        <TransferQrModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} victim={formData} />

        {/* Modal Synthèse IA SAMU 15 */}
        <Modal
          isOpen={showSamuAiModal}
          onClose={() => setShowSamuAiModal(false)}
          title="Synthèse Radio SAMU 15 (Bilan Chronologique)"
          icon={<Radio className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />}
          maxWidth="max-w-lg"
          footer={
            <>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowSamuAiModal(false)}
                className="rounded-xl border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm py-2 px-3.5 min-h-[40px]"
              >
                Fermer
              </Button>
              {!isGeneratingSamu && (
                <Button 
                  type="button" 
                  onClick={() => { 
                    navigator.clipboard.writeText(samuSummaryText); 
                    alert("Synthèse SAMU copiée dans le presse-papier !"); 
                  }} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 rounded-xl text-xs sm:text-sm py-2 px-4 shadow-md shadow-emerald-600/20 min-h-[40px]"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copier la synthèse</span>
                </Button>
              )}
            </>
          }
        >
          {isGeneratingSamu ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">L'IA analyse les constantes, chronologies et bilans de la victime...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl border border-slate-800 whitespace-pre-wrap leading-relaxed select-all">
                {samuSummaryText}
              </div>
              <p className="text-[11px] text-slate-500 italic">Format conforme à la transmission radio SAMU 15 / Régulation Médicale.</p>
            </div>
          )}
        </Modal>

      </form>
    </Layout>
  );
};
