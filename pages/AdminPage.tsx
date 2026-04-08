
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { generateUUID, getLocalDateString } from '../utils/security';
import { storageService } from '../services/storageService';
import { authService } from '../services/authService';
import { adminService } from '../services/features/adminService';
import { initDB } from '../services/db';
import { logisticsService } from '../services/features/logisticsService';
import { testConnection } from '../services/supabaseClient'; 
import { syncService } from '../services/syncService';
import { Event, UserProfile, VehicleDefinition, TrainingCourse, Mission, NewsPost, AssociationDocument, Diploma, UserRole, AppConfig } from '../types';
import { Activity, Trash2, Plus, X, List, Loader2, FileText, Truck, Users, Database, GraduationCap, Link as LinkIcon, Video, RefreshCw, Pencil, Shield, Award, Save, Lock, AlertTriangle, Siren, CheckCircle2, AlertCircle, Settings, Building2, Radio, Power, Pill, Syringe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SyncIndicator } from '../components/SyncIndicator';

interface AdminCardProps {
    title: string;
    icon: React.ReactNode;
    color: string;
    children: React.ReactNode;
    className?: string;
}

const AdminCard: React.FC<AdminCardProps> = ({ title, icon, color, children, className = "" }) => (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full transition-all hover:shadow-md ${className}`}>
        <div className={`px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-3`}>
            <div className={`p-2 rounded-lg ${color} shadow-sm shrink-0`}>{icon}</div>
            <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wide truncate">{title}</h3>
        </div>
        <div className="p-3 md:p-5 flex-1 flex flex-col gap-4">
            {children}
        </div>
    </div>
);

const CollapsibleList: React.FC<{ title: string, count: number, children: React.ReactNode, defaultOpen?: boolean, icon?: React.ReactNode }> = ({ title, count, children, defaultOpen = false, icon }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 mt-2">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2">{icon}<span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">{title} <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] ml-1">{count}</span></span></div>
                {isOpen ? <X className="w-4 h-4 text-slate-500" /> : <List className="w-4 h-4 text-slate-500" />}
            </button>
            {isOpen && <div className="border-t border-slate-100 dark:border-slate-700 max-h-60 overflow-y-auto p-1">{children}</div>}
        </div>
    );
};

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [isPageLoading, setIsPageLoading] = useState(true);

  // RESTRICTION : Admin uniquement
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      navigate('/', { replace: true });
    }
  }, [profile, navigate]);
  const [resourceTab, setResourceTab] = useState<'MISSIONS' | 'ACTUALITÉ' | 'DOCUMENTS' | 'FORMATION' | 'VÉHICULE' | 'CONFIG'>('MISSIONS');
  
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [diagStatus, setDiagStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [diagMessage, setDiagMessage] = useState('');
  const [dbLatency, setDbLatency] = useState(0);
  
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [news, setNews] = useState<NewsPost[]>([]);
  const [documents, setDocuments] = useState<AssociationDocument[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [fleet, setFleet] = useState<VehicleDefinition[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  // Member Edition State
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [tempDiploma, setTempDiploma] = useState<Partial<Diploma>>({});

  // Forms
  const [missionForm, setMissionForm] = useState({ title: '', date: '', timeStart: '', timeEnd: '', location: '', type: 'DPS' as any, req1: 2, req2: 1, reqIde: 0, reqMed: 0 });
  const [newsForm, setNewsForm] = useState({ title: '', content: '', isUrgent: false });
  const [docForm, setDocForm] = useState({ title: '', category: 'Procédure', url: '', adminOnly: false });
  const [courseForm, setCourseForm] = useState({ title: '', description: '', url: '', category: 'PSE1', type: 'PDF' });
  const [vehicleForm, setVehicleForm] = useState({ name: '', type: 'VPSP', nextTechControl: '', nextService: '' });
  
  // Config Forms
  const [newTeam, setNewTeam] = useState('');
  const [newHospital, setNewHospital] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [newSolute, setNewSolute] = useState('');
  const [signupCode, setSignupCode] = useState('');

  const currentYear = new Date().getFullYear();

  useEffect(() => { 
      loadData(); 

      // Écoute des mises à jour distantes (Configuration & Documents)
      const bcConfig = new BroadcastChannel('dps65_config_channel');
      const bcAsso = new BroadcastChannel('dps65_asso_channel');

      bcConfig.onmessage = () => {
          adminService.getConfig().then(c => {
              setAppConfig(c);
              setSignupCode(c.signupCode || '');
          });
      };

      bcAsso.onmessage = () => {
          adminService.getDocuments().then(setDocuments);
          adminService.getNews().then(setNews);
      };

      return () => {
          bcConfig.close();
          bcAsso.close();
      };
  }, []);

  const loadData = async (silent = false) => {
    if(!silent) setIsPageLoading(true);
    try {
        const [pr, fl, mi, ne, docItems, crsItems, conf] = await Promise.all([
            authService.getProfiles(), storageService.getFleet(),
            storageService.getMissions(), adminService.getNews(), adminService.getDocuments(), adminService.getCourses(), adminService.getConfig()
        ]);
        setProfiles(pr); setFleet(fl); setMissions(mi); setNews(ne); setDocuments(docItems); setCourses(crsItems); setAppConfig(conf);
        setSignupCode(conf.signupCode || '');
    } catch(e) {
        console.error("Load Data Error", e);
    } finally {
        if(!silent) setIsPageLoading(false);
    }
  };

  // --- CONFIG HANDLERS ---
  const handleUpdateCode = async () => {
      if (!appConfig) return;
      const updatedConfig = { ...appConfig, signupCode: signupCode.trim() };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
      alert("Code d'accès mis à jour !");
  };

  const handleAddTeam = async () => {
      if (!appConfig || !newTeam.trim()) return;
      const updatedConfig = { ...appConfig, teams: [...appConfig.teams, newTeam.trim()] };
      setAppConfig(updatedConfig); // Optimistic UI
      await adminService.saveConfig(updatedConfig);
      setNewTeam('');
  };

  const handleDeleteTeam = async (team: string) => {
      if (!appConfig || !confirm(`Supprimer l'équipe "${team}" ?`)) return;
      const updatedConfig = { ...appConfig, teams: appConfig.teams.filter(t => t !== team) };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
  };

  const handleAddHospital = async () => {
      if (!appConfig || !newHospital.trim()) return;
      const updatedConfig = { ...appConfig, hospitals: [...appConfig.hospitals, newHospital.trim()] };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
      setNewHospital('');
  };

  const handleDeleteHospital = async (hosp: string) => {
      if (!appConfig || !confirm(`Supprimer l'hôpital "${hosp}" ?`)) return;
      const updatedConfig = { ...appConfig, hospitals: appConfig.hospitals.filter(h => h !== hosp) };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
  };

  const handleAddMedication = async () => {
      if (!appConfig || !newMedication.trim()) return;
      const updatedConfig = { ...appConfig, medications: [...(appConfig.medications || []), newMedication.trim()] };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
      setNewMedication('');
  };

  const handleDeleteMedication = async (med: string) => {
      if (!appConfig || !confirm(`Supprimer le médicament "${med}" ?`)) return;
      const updatedConfig = { ...appConfig, medications: (appConfig.medications || []).filter(m => m !== med) };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
  };

  const handleAddSolute = async () => {
      if (!appConfig || !newSolute.trim()) return;
      const updatedConfig = { ...appConfig, solutes: [...(appConfig.solutes || []), newSolute.trim()] };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
      setNewSolute('');
  };

  const handleDeleteSolute = async (sol: string) => {
      if (!appConfig || !confirm(`Supprimer le soluté "${sol}" ?`)) return;
      const updatedConfig = { ...appConfig, solutes: (appConfig.solutes || []).filter(s => s !== sol) };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
  };

  // --- ACTIONS GLOBALES ---
  const handleGlobalServiceStop = async () => {
      if (!confirm("ATTENTION : Cela va déconnecter l'équipe de TOUS les téléphones actifs (Fin de Service forcée).\n\nLes utilisateurs seront déconnectés de leur indicatif et le suivi GPS s'arrêtera.\n\nConfirmer ?")) return;
      
      setIsActionLoading(true);
      try {
          const config = await adminService.getConfig();
          const newConfig = { ...config, serviceResetTimestamp: Date.now() };
          await adminService.saveConfig(newConfig);
          // On force le traitement de la file pour être sûr que ça parte
          await syncService.processQueue(true);
          alert("Ordre de fin de service envoyé à tous les appareils.");
      } catch(e) {
          alert("Erreur lors de l'envoi de la commande.");
      } finally {
          setIsActionLoading(false);
      }
  };

  const handleRepairProfiles = async () => {
      if (!confirm("Cette action va re-synchroniser tous les profils locaux vers Supabase. Utile si certains membres manquent sur le serveur. Continuer ?")) return;
      
      setIsActionLoading(true);
      try {
          const db = await initDB();
          const allProfiles = await db.getAll('profiles');
          
          for (const p of allProfiles) {
              await db.put('sync_queue', {
                  id: generateUUID(),
                  table: 'profiles',
                  action: 'UPSERT',
                  data: p,
                  timestamp: Date.now(),
                  status: 'PENDING',
                  retries: 0
              });
          }
          
          await syncService.processQueue(true);
          alert(`${allProfiles.length} profils mis en file de synchronisation.`);
      } catch (e) {
          alert("Erreur lors de la réparation des profils.");
      } finally {
          setIsActionLoading(false);
      }
  };

  const handleRegenerateQuiz = () => {
      if(confirm("Voulez-vous forcer la régénération du Quiz IA du jour pour tous les rôles ? (Cela remplacera le quiz actuel)")) {
          const roles = ['secouriste', 'infirmier', 'medecin'];
          const today = getLocalDateString();
          roles.forEach(r => {
              localStorage.removeItem(`dps65_daily_quiz_${today}_${r}_v3`);
          });
          alert("Quiz réinitialisés. Ils seront régénérés à la prochaine ouverture de la page Formation.");
      }
  };

  // --- OTHER HANDLERS ---

  const handleSaveMember = async () => {
      if (!editingMember) return;
      try {
          await authService.updateProfile(editingMember.id, editingMember);
          setEditingMember(null);
          loadData(true);
      } catch (e) {
          alert("Erreur lors de la mise à jour du profil.");
      }
  };

  const handleAddDiplomaToMember = () => {
      if (!editingMember || !tempDiploma.name || !tempDiploma.dateObtained) return;
      const newD: Diploma = {
          id: generateUUID(),
          name: tempDiploma.name,
          dateObtained: tempDiploma.dateObtained,
          expiresAt: tempDiploma.expiresAt
      };
      setEditingMember({
          ...editingMember,
          diplomas: [...(editingMember.diplomas || []), newD]
      });
      setTempDiploma({});
  };

  const handleRemoveDiplomaFromMember = (dId: string) => {
      if (!editingMember) return;
      setEditingMember({
          ...editingMember,
          diplomas: (editingMember.diplomas || []).filter(d => d.id !== dId)
      });
  };

  const handleAddMission = async () => {
      if(!missionForm.title || !missionForm.date) return;
      await storageService.saveMission({
          id: generateUUID(),
          title: missionForm.title,
          date: missionForm.date,
          timeStart: missionForm.timeStart,
          timeEnd: missionForm.timeEnd,
          location: missionForm.location,
          type: missionForm.type,
          requiredPse1: missionForm.req1,
          requiredPse2: missionForm.req2,
          requiredIde: missionForm.reqIde,
          requiredMed: missionForm.reqMed,
          registeredUserIds: []
      });
      setMissionForm({ title: '', date: '', timeStart: '', timeEnd: '', location: '', type: 'DPS', req1: 2, req2: 1, reqIde: 0, reqMed: 0 });
      loadData(true); // Silent reload
  };

  const handleDeleteMission = async (id: string) => {
      if(confirm('Supprimer cette mission ?')) { await storageService.deleteMission(id); loadData(true); }
  };

  const handleAddNews = async () => {
      if(!newsForm.title) return;
      await adminService.saveNews({ id: generateUUID(), date: Date.now(), title: newsForm.title, content: newsForm.content, author: 'Admin', isUrgent: newsForm.isUrgent });
      setNewsForm({ title: '', content: '', isUrgent: false }); loadData(true);
  };

  const handleDeleteNews = async (id: string) => {
      if(confirm('Supprimer cette actualité ?')) { await adminService.deleteNews(id); loadData(true); }
  };

  const handleAddDocument = async () => {
      if(!docForm.title || !docForm.url) return;
      await adminService.saveDocument({
          id: generateUUID(),
          title: docForm.title,
          category: docForm.category,
          url: docForm.url,
          date: Date.now(),
          adminOnly: docForm.adminOnly
      });
      setDocForm({ title: '', category: 'Procédure', url: '', adminOnly: false });
      loadData(true);
  };

  const handleDeleteDocument = async (id: string) => {
      if(confirm('Supprimer ce document ?')) { await adminService.deleteDocument(id); loadData(true); }
  };

  const handleAddCourse = async () => {
      if(!courseForm.title) return;
      await adminService.saveCourse({
          id: generateUUID(),
          title: courseForm.title,
          description: courseForm.description,
          url: courseForm.url,
          category: courseForm.category,
          type: courseForm.type,
          date: getLocalDateString()
      });
      setCourseForm({ title: '', description: '', url: '', category: 'PSE1', type: 'PDF' });
      loadData(true);
  };

  const handleDeleteCourse = async (id: string) => {
      if(confirm('Supprimer ce cours ?')) { await adminService.deleteCourse(id); loadData(true); }
  };

  const handleAddVehicle = async () => {
      if(!vehicleForm.name) return;
      await logisticsService.saveVehicle({
          id: generateUUID(),
          name: vehicleForm.name,
          type: vehicleForm.type,
          nextTechControl: vehicleForm.nextTechControl,
          nextService: vehicleForm.nextService,
          lastTechControl: '',
          lastService: ''
      });
      setVehicleForm({ name: '', type: 'VPSP', nextTechControl: '', nextService: '' });
      loadData(true);
  };

  const handleDeleteVehicle = async (id: string) => {
      if(confirm('Supprimer ce véhicule ?')) { await logisticsService.deleteVehicle(id); loadData(true); }
  };

  const handleRunDiagnostics = async () => {
      setDiagStatus('TESTING');
      const res = await testConnection();
      setDiagStatus(res.success ? 'SUCCESS' : 'ERROR');
      setDbLatency(res.latency || 0); setDiagMessage(res.message);
  };

  const handleForceSync = async () => {
      if(confirm("Forcer la synchronisation manuelle ?")) {
          setIsPageLoading(true);
          await syncService.processQueue(true);
          await syncService.pullLatestData();
          loadData(); // Will stop loader
          alert("Synchronisation effectuée.");
      }
  };

  const handleRemoteWipe = async () => {
      const confirmCode = prompt("ATTENTION : CELA EFFACERA TOUTES LES DONNÉES DE TOUS LES APPAREILS CONNECTÉS.\nTapez 'CONFIRMER' pour exécuter :");
      if (confirmCode === 'CONFIRMER') {
          setIsActionLoading(true);
          try {
              const config = await adminService.getConfig();
              await adminService.saveConfig({ ...config, securityMode: 'WIPE_AND_LOCK' });
              await syncService.processQueue(true);
              alert("COMMANDE DE SUPPRESSION ENVOYÉE.");
          } catch (e) {
              alert("Erreur lors de l'envoi de la commande.");
          } finally {
              setIsActionLoading(false);
          }
      }
  };

  const inputClass = "w-full p-2 text-sm rounded-lg border border-slate-300 dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50";
  const labelClass = "text-[10px] font-black uppercase text-slate-500 mb-1 block";

  if (isPageLoading) return <Layout title="Administration" hideSync={true}><div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600"/></div></Layout>;

  return (
    <Layout title="Administration" showBack="/" hideSync={true}>
      <div className="space-y-6 pb-32">
        
        {/* DIAGNOSTIC & MEMBRES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AdminCard title="État du Système" icon={<Activity className="w-5 h-5" />} color="bg-blue-100 text-blue-600">
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-500 uppercase">Synchronisation</span>
                        <SyncIndicator />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <Button 
                            fullWidth 
                            size="sm" 
                            onClick={handleRunDiagnostics} 
                            disabled={diagStatus === 'TESTING'}
                            className={diagStatus === 'SUCCESS' ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                            {diagStatus === 'TESTING' ? 'Test en cours...' : 
                             diagStatus === 'SUCCESS' ? `Latence : ${dbLatency}ms` : 
                             'Diagnostic Cloud'}
                        </Button>
                        <Button 
                            fullWidth 
                            size="sm" 
                            variant="outline" 
                            onClick={() => navigate('/admin/diagnostics')}
                            icon={<Shield className="w-4 h-4" />}
                            className="dark:text-slate-200 dark:border-slate-600"
                        >
                            Diagnostics Avancés
                        </Button>
                        <Button 
                            fullWidth 
                            size="sm" 
                            variant="outline" 
                            onClick={handleRepairProfiles}
                            disabled={isActionLoading}
                            icon={<RefreshCw className="w-4 h-4" />}
                            className="dark:text-slate-200 dark:border-slate-600"
                        >
                            Réparer Profils
                        </Button>
                    </div>

                    {diagStatus === 'ERROR' && (
                        <div className="p-3 rounded-lg border text-xs bg-red-50 border-red-200 text-red-700">
                            {diagMessage}
                        </div>
                    )}
                </div>
            </AdminCard>

            <AdminCard title="Membres de l'Asso" icon={<Users className="w-5 h-5" />} color="bg-indigo-100 text-indigo-600">
                <CollapsibleList title="Liste des membres" count={profiles.length} icon={<Users className="w-4 h-4"/>}>
                    {profiles.map(p => (
                        <div key={p.id} className="p-2 border-b last:border-0 text-xs flex justify-between items-center dark:text-slate-300 dark:border-slate-700">
                            <div>
                                <span className="font-bold">{p.firstName} {p.lastName}</span>
                                <span className="ml-2 text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded uppercase">{p.role}</span>
                            </div>
                            <button 
                                onClick={() => setEditingMember(p)} 
                                className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </CollapsibleList>
            </AdminCard>
        </div>

        {/* CONTENT MANAGEMENT */}
        <AdminCard title="Gestion Contenu & Ressources" icon={<Database className="w-5 h-5" />} color="bg-purple-100 text-purple-600">
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl overflow-x-auto mb-4">
                {['MISSIONS', 'ACTUALITÉ', 'DOCUMENTS', 'FORMATION', 'VÉHICULE', 'CONFIG'].map((t: any) => (
                    <button key={t} onClick={() => setResourceTab(t)} className={`flex-1 py-2 px-3 text-[10px] font-black rounded-lg transition-all ${resourceTab === t ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-400' : 'text-slate-500'}`}>{t}</button>
                ))}
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                {resourceTab === 'MISSIONS' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><label className={labelClass}>Titre Mission</label><input type="text" className={inputClass} value={missionForm.title} onChange={e => setMissionForm({...missionForm, title: e.target.value})} placeholder="Marathon de Tarbes" /></div>
                            <div>
                                <label className={labelClass}>Type</label>
                                <select className={inputClass} value={missionForm.type} onChange={e => setMissionForm({...missionForm, type: e.target.value as any})}>
                                    <option value="DPS">DPS</option>
                                    <option value="FORMATION">Formation</option>
                                    <option value="REUNION">Réunion</option>
                                    <option value="AUTRE">Autre</option>
                                </select>
                            </div>
                            <div><label className={labelClass}>Lieu</label><input type="text" className={inputClass} value={missionForm.location} onChange={e => setMissionForm({...missionForm, location: e.target.value})} placeholder="Centre Ville" /></div>
                            <div><label className={labelClass}>Date</label><input type="date" className={inputClass} value={missionForm.date} onChange={e => setMissionForm({...missionForm, date: e.target.value})} /></div>
                            <div className="flex gap-2">
                                <div className="flex-1"><label className={labelClass}>Début</label><input type="time" className={inputClass} value={missionForm.timeStart} onChange={e => setMissionForm({...missionForm, timeStart: e.target.value})} /></div>
                                <div className="flex-1"><label className={labelClass}>Fin</label><input type="time" className={inputClass} value={missionForm.timeEnd} onChange={e => setMissionForm({...missionForm, timeEnd: e.target.value})} /></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <div><label className={labelClass}>PSE1</label><input type="number" className={inputClass} value={missionForm.req1} onChange={e => setMissionForm({...missionForm, req1: parseInt(e.target.value)||0})} /></div>
                            <div><label className={labelClass}>PSE2</label><input type="number" className={inputClass} value={missionForm.req2} onChange={e => setMissionForm({...missionForm, req2: parseInt(e.target.value)||0})} /></div>
                            <div><label className={labelClass}>IDE</label><input type="number" className={inputClass} value={missionForm.reqIde} onChange={e => setMissionForm({...missionForm, reqIde: parseInt(e.target.value)||0})} /></div>
                            <div><label className={labelClass}>MED</label><input type="number" className={inputClass} value={missionForm.reqMed} onChange={e => setMissionForm({...missionForm, reqMed: parseInt(e.target.value)||0})} /></div>
                        </div>
                        <Button fullWidth size="sm" onClick={handleAddMission} icon={<Plus />}>Publier la mission</Button>
                        
                        <CollapsibleList title="Missions existantes" count={missions.length} icon={<List className="w-4 h-4"/>}>
                            {missions.map(m => (
                                <div key={m.id} className="flex justify-between items-center p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="truncate"><span className="font-bold dark:text-white">{m.title}</span> <span className="opacity-50">({m.date})</span></div>
                                    <button onClick={() => handleDeleteMission(m.id)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </CollapsibleList>
                    </div>
                )}
                
                {resourceTab === 'ACTUALITÉ' && (
                    <div className="space-y-4">
                        <input type="text" className={inputClass} placeholder="Titre Actu" value={newsForm.title} onChange={e => setNewsForm({...newsForm, title: e.target.value})} />
                        <textarea className={inputClass} rows={2} placeholder="Message..." value={newsForm.content} onChange={e => setNewsForm({...newsForm, content: e.target.value})} />
                        <label className="flex items-center gap-2 text-xs font-bold text-red-500"><input type="checkbox" checked={newsForm.isUrgent} onChange={e => setNewsForm({...newsForm, isUrgent: e.target.checked})} /> Urgent / Important</label>
                        <Button fullWidth size="sm" onClick={handleAddNews}>Publier l'actualité</Button>
                        
                        <CollapsibleList title="Historique Actualités" count={news.length} icon={<List className="w-4 h-4"/>}>
                            {news.map(n => (
                                <div key={n.id} className="flex justify-between items-center p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="truncate"><span className="font-bold dark:text-white">{n.title}</span></div>
                                    <button onClick={() => handleDeleteNews(n.id)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </CollapsibleList>
                    </div>
                )}
                
                {resourceTab === 'DOCUMENTS' && (
                    <div className="space-y-4">
                        <div><label className={labelClass}>Titre Document</label><input type="text" className={inputClass} value={docForm.title} onChange={e => setDocForm({...docForm, title: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Catégorie</label><select className={inputClass} value={docForm.category} onChange={e => setDocForm({...docForm, category: e.target.value})}><option>Procédure</option><option>Administratif</option><option>Médical</option><option>Autre</option></select></div><div><label className={labelClass}>URL</label><input type="text" className={inputClass} value={docForm.url} onChange={e => setDocForm({...docForm, url: e.target.value})} placeholder="https://..." /></div></div>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
                            <input type="checkbox" checked={docForm.adminOnly} onChange={e => setDocForm({...docForm, adminOnly: e.target.checked})} />
                            <Lock className="w-3 h-3"/> Réservé aux Admins
                        </label>
                        <Button fullWidth size="sm" onClick={handleAddDocument} icon={<FileText className="w-4 h-4"/>}>Ajouter Document</Button>
                        
                        <CollapsibleList title="Bibliothèque Documents" count={documents.length} icon={<FileText className="w-4 h-4"/>}>
                            {documents.map(d => (
                                <div key={d.id} className="flex justify-between items-center p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="truncate flex items-center gap-2"><FileText className="w-3 h-3 text-blue-500"/> <span className="font-bold dark:text-white">{d.title}</span> {d.adminOnly && <Lock className="w-3 h-3 text-red-500"/>}</div>
                                    <button onClick={() => handleDeleteDocument(d.id)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </CollapsibleList>
                    </div>
                )}
                
                {resourceTab === 'FORMATION' && (
                    <div className="space-y-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 mb-4">
                            <h4 className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-2 uppercase">Configuration Quiz IA</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">
                                Les quiz quotidiens sont générés automatiquement par l'IA. Si besoin, vous pouvez forcer la régénération ici.
                            </p>
                            <Button size="sm" variant="outline" onClick={handleRegenerateQuiz} fullWidth>Régénérer le Quiz du Jour</Button>
                        </div>

                        <div><label className={labelClass}>Titre</label><input type="text" className={inputClass} value={courseForm.title} onChange={e => setCourseForm({...courseForm, title: e.target.value})} /></div>
                        <div><label className={labelClass}>Desc.</label><textarea className={inputClass} rows={2} value={courseForm.description} onChange={e => setCourseForm({...courseForm, description: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Niveau</label><select className={inputClass} value={courseForm.category} onChange={e => setCourseForm({...courseForm, category: e.target.value})}><option>PSE1</option><option>PSE2</option><option>BNSSA</option><option>Divers</option></select></div><div><label className={labelClass}>Type</label><select className={inputClass} value={courseForm.type} onChange={e => setCourseForm({...courseForm, type: e.target.value})}><option value="PDF">PDF</option><option value="VIDEO">Vidéo</option><option value="QUIZ">Quiz</option><option value="SITE">Site Internet</option><option value="AUTRE">Autre</option></select></div></div>
                        <div><label className={labelClass}>URL</label><input type="text" className={inputClass} value={courseForm.url} onChange={e => setCourseForm({...courseForm, url: e.target.value})} /></div>
                        <Button fullWidth size="sm" onClick={handleAddCourse} icon={<GraduationCap className="w-4 h-4"/>}>Ajouter Formation</Button>
                        
                        <CollapsibleList title="Catalogue Formations" count={courses.length} icon={<GraduationCap className="w-4 h-4"/>}>
                            {courses.map(c => (
                                <div key={c.id} className="flex justify-between items-center p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="truncate flex items-center gap-2"><span className="font-bold dark:text-white">{c.title}</span></div>
                                    <button onClick={() => handleDeleteCourse(c.id)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </CollapsibleList>
                    </div>
                )}
                
                {resourceTab === 'VÉHICULE' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Nom</label><input type="text" className={inputClass} value={vehicleForm.name} onChange={e => setVehicleForm({...vehicleForm, name: e.target.value})} /></div><div><label className={labelClass}>Type</label><input type="text" className={inputClass} value={vehicleForm.type} onChange={e => setVehicleForm({...vehicleForm, type: e.target.value})} /></div></div>
                        <div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>CT</label><input type="date" className={inputClass} value={vehicleForm.nextTechControl} onChange={e => setVehicleForm({...vehicleForm, nextTechControl: e.target.value})} /></div><div><label className={labelClass}>Vidange</label><input type="date" className={inputClass} value={vehicleForm.nextService} onChange={e => setVehicleForm({...vehicleForm, nextService: e.target.value})} /></div></div>
                        <Button fullWidth size="sm" onClick={handleAddVehicle} icon={<Truck className="w-4 h-4"/>}>Ajouter Véhicule</Button>
                        
                        <CollapsibleList title="Parc Automobile" count={fleet.length} icon={<Truck className="w-4 h-4"/>}>
                            {fleet.map(v => (
                                <div key={v.id} className="flex justify-between items-center p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="truncate flex items-center gap-2"><Truck className="w-3 h-3 text-orange-500"/><span className="font-bold dark:text-white">{v.name}</span></div>
                                    <button onClick={() => handleDeleteVehicle(v.id)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </CollapsibleList>
                    </div>
                )}

                {resourceTab === 'CONFIG' && (
                    <div className="space-y-6">
                        {/* CODE D'ACCÈS */}
                        <div>
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Lock className="w-4 h-4" /> Code d'accès Inscription
                            </h3>
                            <div className="bg-slate-100 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-2">
                                <input 
                                    type="text" 
                                    className={inputClass}
                                    value={signupCode}
                                    onChange={e => setSignupCode(e.target.value)}
                                    placeholder="Vide = Aucun code requis"
                                />
                                <Button size="sm" onClick={handleUpdateCode}>Mettre à jour</Button>
                            </div>
                        </div>

                        {/* SECTION ÉQUIPES */}
                        <div>
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Radio className="w-4 h-4" /> Équipes & Indicatifs Radio
                            </h3>
                            <div className="bg-slate-100 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Nouvelle équipe (ex: TANGO)" 
                                        className={inputClass}
                                        value={newTeam}
                                        onChange={e => setNewTeam(e.target.value)}
                                    />
                                    <button onClick={handleAddTeam} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"><Plus className="w-5 h-5"/></button>
                                </div>
                                <CollapsibleList title="Équipes" count={appConfig?.teams.length ?? 0} icon={<Radio className="w-4 h-4" />}>
                                    {appConfig?.teams.map((t, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <span className="font-bold dark:text-white">{t}</span>
                                            <button onClick={() => handleDeleteTeam(t)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                </CollapsibleList>
                            </div>
                        </div>

                        {/* SECTION MÉDICAMENTS & SOLUTÉS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Pill className="w-4 h-4" /> Médicaments
                                </h3>
                                <div className="bg-slate-100 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Nouveau médicament..." className={inputClass} value={newMedication} onChange={e => setNewMedication(e.target.value)} />
                                        <button onClick={handleAddMedication} className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700"><Plus className="w-5 h-5"/></button>
                                    </div>
                                    <CollapsibleList title="Médicaments" count={appConfig?.medications?.length ?? 0} icon={<Pill className="w-4 h-4" />}>
                                        {appConfig?.medications?.map((m, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <span className="font-bold dark:text-white">{m}</span>
                                                <button onClick={() => handleDeleteMedication(m)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        ))}
                                    </CollapsibleList>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Syringe className="w-4 h-4" /> Solutés
                                </h3>
                                <div className="bg-slate-100 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Nouveau soluté..." className={inputClass} value={newSolute} onChange={e => setNewSolute(e.target.value)} />
                                        <button onClick={handleAddSolute} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700"><Plus className="w-5 h-5"/></button>
                                    </div>
                                    <CollapsibleList title="Solutés" count={appConfig?.solutes?.length ?? 0} icon={<Syringe className="w-4 h-4" />}>
                                        {appConfig?.solutes?.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <span className="font-bold dark:text-white">{s}</span>
                                                <button onClick={() => handleDeleteSolute(s)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        ))}
                                    </CollapsibleList>
                                </div>
                            </div>
                        </div>

                        {/* SECTION HÔPITAUX */}
                        <div>
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Building2 className="w-4 h-4" /> Centres Hospitaliers
                            </h3>
                            <div className="bg-slate-100 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Nouvel hôpital..." 
                                        className={inputClass}
                                        value={newHospital}
                                        onChange={e => setNewHospital(e.target.value)}
                                    />
                                    <button onClick={handleAddHospital} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700"><Plus className="w-5 h-5"/></button>
                                </div>
                                <CollapsibleList title="Centres Hospitaliers" count={appConfig?.hospitals.length ?? 0} icon={<Building2 className="w-4 h-4" />}>
                                    {appConfig?.hospitals.map((h, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <span className="font-bold dark:text-white">{h}</span>
                                            <button onClick={() => handleDeleteHospital(h)} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                </CollapsibleList>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminCard>

        {/* DANGER ZONE (LAST) */}
        <AdminCard title="Zone de Danger" icon={<Siren className="w-5 h-5" />} color="bg-red-100 text-red-600">
            {/* BOUTON FIN SERVICE GENERAL */}
            <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-lg border border-orange-200 dark:border-orange-800 text-center mb-4">
                <h4 className="text-xs font-bold text-orange-700 dark:text-orange-300 uppercase mb-2">Fin Opérationnelle</h4>
                <p className="text-[10px] text-orange-600 dark:text-orange-400 mb-3">
                    Force l'arrêt du service et du suivi GPS sur tous les appareils connectés. Les données sont conservées.
                </p>
                <button
                    onClick={handleGlobalServiceStop}
                    disabled={isActionLoading}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black uppercase rounded-lg shadow-lg flex items-center justify-center gap-2"
                >
                    {isActionLoading ? <Loader2 className="animate-spin" /> : <Power className="w-5 h-5" />} 
                    FIN DE SERVICE GÉNÉRALE
                </button>
            </div>

            <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-900 text-center">
                <h4 className="text-xs font-bold text-red-700 dark:text-red-300 uppercase mb-2">Urgence Absolue</h4>
                <p className="text-[10px] text-red-600 dark:text-red-400 mb-3">
                    Cette action efface les données de TOUS les téléphones connectés, désactive le GPS et déconnecte tout le monde.
                </p>
                <button 
                    onClick={handleRemoteWipe}
                    disabled={isActionLoading}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black uppercase rounded-lg shadow-lg flex items-center justify-center gap-2 animate-pulse"
                >
                    {isActionLoading ? <Loader2 className="animate-spin" /> : <Trash2 className="w-5 h-5" />} 
                    SUPPRESSION DISTANTE (WIPE)
                </button>
            </div>
        </AdminCard>

        {/* MODAL ÉDITION MEMBRE - FIX Z-INDEX & LAYOUT */}
        {editingMember && (
            <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" style={{ zIndex: 1000 }}>
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                        <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                            <Pencil className="w-5 h-5 text-blue-600" /> Édition Membre
                        </h3>
                        <button onClick={() => setEditingMember(null)} className="p-1 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800"><X className="w-5 h-5" /></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto space-y-6">
                        {/* 1. INFO PERSO */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-4 h-4" /> État Civil</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelClass}>Prénom</label><input className={inputClass} value={editingMember.firstName} onChange={e => setEditingMember({...editingMember, firstName: e.target.value})} /></div>
                                <div><label className={labelClass}>Nom</label><input className={inputClass} value={editingMember.lastName} onChange={e => setEditingMember({...editingMember, lastName: e.target.value})} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelClass}>Email</label><input className={inputClass} value={editingMember.email} onChange={e => setEditingMember({...editingMember, email: e.target.value})} /></div>
                                <div><label className={labelClass}>Téléphone</label><input className={inputClass} value={editingMember.phone || ''} onChange={e => setEditingMember({...editingMember, phone: e.target.value})} /></div>
                            </div>
                        </div>

                        {/* 2. RÔLE & COTISATION */}
                        <div className="space-y-3 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                            <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2"><Shield className="w-4 h-4" /> Rôle & Permissions</h4>
                            
                            <div className="space-y-2">
                                <label className={labelClass}>Fonction</label>
                                <select 
                                    className="w-full p-3 rounded-lg font-bold bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                                    value={editingMember.role}
                                    onChange={e => setEditingMember({...editingMember, role: e.target.value as UserRole})}
                                >
                                    <option value="secouriste">Secouriste</option>
                                    <option value="infirmier">Infirmier (IDE)</option>
                                    <option value="medecin">Médecin</option>
                                    <option value="logisticien">Logisticien</option>
                                    <option value="snu">SNU (Stagiaire)</option>
                                    <option value="stagiaire">Stagiaire (Interne)</option>
                                    <option value="admin">Administrateur</option>
                                </select>
                            </div>

                            <div className="space-y-2 mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                                <label className={labelClass}>Cotisation acquittée pour l'année : (Valide jusqu'au 31/12)</label>
                                <div className="flex items-center gap-2">
                                    <select
                                        className="flex-1 p-2 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white"
                                        value={editingMember.membershipExpiry ? editingMember.membershipExpiry.split('-')[0] : ''}
                                        onChange={(e) => {
                                            const year = e.target.value;
                                            setEditingMember({
                                                ...editingMember,
                                                membershipExpiry: year ? `${year}-12-31` : undefined
                                            });
                                        }}
                                    >
                                        <option value="">-- Non à jour --</option>
                                        <option value={currentYear - 1}>{currentYear - 1} (Expiré)</option>
                                        <option value={currentYear}>{currentYear} (En cours)</option>
                                        <option value={currentYear + 1}>{currentYear + 1} (Avance)</option>
                                    </select>
                                    <div className={`p-2 rounded-lg ${
                                        editingMember.membershipExpiry && new Date(editingMember.membershipExpiry) >= new Date()
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                        {editingMember.membershipExpiry && new Date(editingMember.membershipExpiry) >= new Date() 
                                            ? <CheckCircle2 className="w-5 h-5" />
                                            : <AlertCircle className="w-5 h-5" />
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. DIPLÔMES */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Award className="w-4 h-4" /> Qualifications</h4>
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                                {(editingMember.diplomas || []).map(d => (
                                    <div key={d.id} className="p-2 border-b border-slate-200 dark:border-slate-700 last:border-0 flex justify-between items-center text-sm">
                                        <div>
                                            <span className="font-bold block dark:text-white">{d.name}</span>
                                            <span className="text-[10px] text-slate-500">Obtenu: {new Date(d.dateObtained).getFullYear()}</span>
                                        </div>
                                        <button onClick={() => handleRemoveDiplomaFromMember(d.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                {(!editingMember.diplomas || editingMember.diplomas.length === 0) && <div className="p-3 text-xs text-slate-400 italic text-center">Aucun diplôme.</div>}
                            </div>
                            
                            <div className="flex gap-2 items-end bg-slate-100 dark:bg-slate-900 p-3 rounded-lg">
                                <div className="flex-1">
                                    <label className="text-[9px] font-bold text-slate-500 block mb-1">Nouveau Diplôme</label>
                                    <input type="text" placeholder="Ex: PSE 2" className="w-full p-2 rounded text-xs border" value={tempDiploma.name || ''} onChange={e => setTempDiploma({...tempDiploma, name: e.target.value})} />
                                </div>
                                <div className="w-32">
                                    <label className="text-[9px] font-bold text-slate-500 block mb-1">Date</label>
                                    <input type="date" className="w-full p-2 rounded text-xs border" value={tempDiploma.dateObtained || ''} onChange={e => setTempDiploma({...tempDiploma, dateObtained: e.target.value})} />
                                </div>
                                <button onClick={handleAddDiplomaToMember} className="bg-slate-800 text-white p-2 rounded hover:bg-black"><Plus className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-3 sticky bottom-0 z-20">
                        <Button variant="outline" fullWidth onClick={() => setEditingMember(null)} className="dark:text-slate-200 dark:border-slate-600">Annuler</Button>
                        <Button fullWidth onClick={handleSaveMember} icon={<Save className="w-4 h-4"/>}>Enregistrer</Button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </Layout>
  );
};
