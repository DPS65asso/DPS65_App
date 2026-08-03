
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
import { Activity, Trash2, Plus, X, List, Loader2, FileText, Truck, Users, Database, GraduationCap, Link as LinkIcon, Video, RefreshCw, Pencil, Shield, Award, Save, Lock, AlertTriangle, CheckCircle2, AlertCircle, Settings, Building2, Radio, Pill, Syringe, Shirt } from 'lucide-react';
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

  // Member Edition State & Advanced Troubleshooting
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [memberModalTab, setMemberModalTab] = useState<'IDENTITÉ' | 'RÔLE' | 'DIPLÔMES' | 'VESTIAIRE' | 'MISSIONS' | 'DÉPANNAGE'>('IDENTITÉ');
  const [memberUniform, setMemberUniform] = useState<any | null>(null);
  const [memberPassword, setMemberPassword] = useState('');
  const [tempDiploma, setTempDiploma] = useState<Partial<Diploma>>({});
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [isSavingMember, setIsSavingMember] = useState(false);

  useEffect(() => {
      if (editingMember) {
          setMemberPassword('');
          setActionSuccessMsg('');
          setTempDiploma({});
          setMemberModalTab('IDENTITÉ');
          logisticsService.getMyUniforms(editingMember.id).then(u => {
              if (u) {
                  setMemberUniform(u);
              } else {
                  setMemberUniform({
                      id: editingMember.id,
                      sizes: { top: 'M', bottom: '40', shoes: '42', head: 'M' },
                      items: [
                          { type: 'TSHIRT', label: 'T-Shirt Secouriste DPS65', hasItem: true, condition: 'BON', requestedQty: 2 },
                          { type: 'POLO', label: 'Polo Secouriste DPS65', hasItem: true, condition: 'BON', requestedQty: 2 },
                          { type: 'POLAIRE', label: 'Veste Polaire', hasItem: true, condition: 'BON', requestedQty: 1 },
                          { type: 'SOFTSHELL', label: 'Veste Softshell Réflectiv', hasItem: false, condition: 'NEUF', requestedQty: 1 },
                          { type: 'PANTALON', label: 'Pantalon d\'Intervention', hasItem: true, condition: 'BON', requestedQty: 2 },
                          { type: 'CASQUETTE', label: 'Casquette DPS 65', hasItem: false, condition: 'NEUF', requestedQty: 1 },
                          { type: 'CHAUSSURES', label: 'Chaussures de Sécurité', hasItem: true, condition: 'BON', requestedQty: 1 },
                      ],
                      lastUpdated: Date.now()
                  });
              }
          });
      } else {
          setMemberUniform(null);
      }
  }, [editingMember?.id]);

  // User Creation State
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'secouriste' as UserRole
  });
  const [createUserError, setCreateUserError] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Forms
  const [missionForm, setMissionForm] = useState({ title: '', date: '', timeStart: '', timeEnd: '', location: '', type: 'DPS' as any, req1: 2, req2: 1, reqIde: 0, reqMed: 0 });
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [newsForm, setNewsForm] = useState({ title: '', content: '', url: '', linkTitle: '', isUrgent: false });
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
      const updatedConfig: AppConfig = { ...appConfig, signupCode: signupCode.trim() };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
      alert("Code d'accès mis à jour !");
  };

  const handleAddTeam = async () => {
      if (!appConfig || !newTeam.trim()) return;
      const updatedConfig: AppConfig = { ...appConfig, teams: [...appConfig.teams, newTeam.trim()] };
      setAppConfig(updatedConfig); // Optimistic UI
      await adminService.saveConfig(updatedConfig);
      setNewTeam('');
  };

  const handleDeleteTeam = async (team: string) => {
      if (!appConfig || !confirm(`Supprimer l'équipe "${team}" ?`)) return;
      const updatedConfig: AppConfig = { ...appConfig, teams: appConfig.teams.filter(t => t !== team) };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
  };

  const handleAddHospital = async () => {
      if (!appConfig || !newHospital.trim()) return;
      const updatedConfig: AppConfig = { ...appConfig, hospitals: [...appConfig.hospitals, newHospital.trim()] };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
      setNewHospital('');
  };

  const handleDeleteHospital = async (hosp: string) => {
      if (!appConfig || !confirm(`Supprimer l'hôpital "${hosp}" ?`)) return;
      const updatedConfig: AppConfig = { ...appConfig, hospitals: appConfig.hospitals.filter(h => h !== hosp) };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
  };

  const handleAddMedication = async () => {
      if (!appConfig || !newMedication.trim()) return;
      const updatedConfig: AppConfig = { ...appConfig, medications: [...(appConfig.medications || []), newMedication.trim()] };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
      setNewMedication('');
  };

  const handleDeleteMedication = async (med: string) => {
      if (!appConfig || !confirm(`Supprimer le médicament "${med}" ?`)) return;
      const updatedConfig: AppConfig = { ...appConfig, medications: (appConfig.medications || []).filter(m => m !== med) };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
  };

  const handleAddSolute = async () => {
      if (!appConfig || !newSolute.trim()) return;
      const updatedConfig: AppConfig = { ...appConfig, solutes: [...(appConfig.solutes || []), newSolute.trim()] };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
      setNewSolute('');
  };

  const handleDeleteSolute = async (sol: string) => {
      if (!appConfig || !confirm(`Supprimer le soluté "${sol}" ?`)) return;
      const updatedConfig: AppConfig = { ...appConfig, solutes: (appConfig.solutes || []).filter(s => s !== sol) };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
  };

  const handleTriggerForcedUpdate = async () => {
      if (!appConfig) return;
      if (!confirm("Êtes-vous sûr de vouloir forcer une mise à jour globale pour tous les utilisateurs ?\n\nCela les déconnectera immédiatement et chargera la dernière version disponible de l'application.")) return;
      
      const updatedConfig: AppConfig = { ...appConfig, forcedUpdateAt: Date.now().toString() };
      setAppConfig(updatedConfig);
      await adminService.saveConfig(updatedConfig);
      alert("Demande de mise à jour forcée envoyée à tous les utilisateurs !");
  };

  // --- ACTIONS GLOBALES ---
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
      if(confirm("Voulez-vous forcer la régénération du Quiz IA du jour pour tous les rôles et toutes les difficultés ? (Cela remplacera le quiz actuel)")) {
          const roles = ['secouriste', 'infirmier', 'medecin'];
          const diffs = ['facile', 'moyen', 'expert'];
          const today = getLocalDateString();
          roles.forEach(r => {
              // Cleanup v3
              localStorage.removeItem(`dps65_daily_quiz_${today}_${r}_v3`);
              // Cleanup v4 (with difficulties)
              diffs.forEach(d => {
                  localStorage.removeItem(`dps65_daily_quiz_${today}_${r}_difficulty_${d}_v4`);
              });
          });
          alert("Quiz réinitialisés. Ils seront régénérés à la prochaine ouverture de la page Formation.");
      }
  };

  // --- OTHER HANDLERS ---

  const handleAdminCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreateUserError('');
      
      const { email, password, firstName, lastName, role } = createUserForm;
      
      if (!email.trim() || !password.trim() || !firstName.trim() || !lastName.trim()) {
          setCreateUserError("Tous les champs sont obligatoires.");
          return;
      }
      
      if (password.length < 6) {
          setCreateUserError("Le mot de passe doit contenir au moins 6 caractères.");
          return;
      }
      
      setIsCreatingUser(true);
      try {
          await authService.adminCreateUser(email, password, firstName, lastName, role);
          setShowCreateUserModal(false);
          await loadData(true);
          alert(`Compte créé avec succès pour ${firstName} ${lastName} (${email}) !`);
      } catch (err: any) {
          console.error("Error creating user:", err);
          setCreateUserError(err.message || "Une erreur est survenue lors de la création du compte.");
      } finally {
          setIsCreatingUser(false);
      }
  };

  const showToast = (msg: string) => {
      setActionSuccessMsg(msg);
      setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  const handleSaveMember = async () => {
      if (!editingMember) return;
      setIsSavingMember(true);
      try {
          const updates: Partial<UserProfile> = { ...editingMember };
          if (memberPassword.trim()) {
              updates.password = memberPassword.trim();
          }

          await authService.updateProfile(editingMember.id, updates);

          if (memberUniform) {
              await logisticsService.saveUniforms(editingMember.id, memberUniform);
          }

          await loadData(true);
          showToast("Compte utilisateur mis à jour et synchronisé avec succès !");
          setTimeout(() => setEditingMember(null), 700);
      } catch (e: any) {
          alert("Erreur lors de la sauvegarde du profil : " + (e.message || "Erreur inconnue"));
      } finally {
          setIsSavingMember(false);
      }
  };

  const handleAddPresetDiploma = (presetName: string, validYears: number) => {
      if (!editingMember) return;
      const todayStr = getLocalDateString();
      let expiresAt: string | undefined = undefined;
      if (validYears > 0) {
          const expDate = new Date();
          expDate.setFullYear(expDate.getFullYear() + validYears);
          expiresAt = expDate.toISOString().split('T')[0];
      }
      const newD: Diploma = {
          id: generateUUID(),
          name: presetName,
          dateObtained: todayStr,
          expiresAt: expiresAt
      };
      setEditingMember({
          ...editingMember,
          diplomas: [...(editingMember.diplomas || []), newD]
      });
      showToast(`Diplôme ${presetName} ajouté !`);
  };

  const handleRemoteSyncMember = async () => {
      if (!editingMember) return;
      try {
          const db = await initDB();
          await db.put('sync_queue', {
              id: generateUUID(),
              table: 'profiles',
              action: 'UPSERT',
              data: editingMember,
              timestamp: Date.now(),
              status: 'PENDING',
              retries: 0
          });
          await syncService.processQueue(true);
          showToast(`Profil de ${editingMember.firstName} forcé en synchro Cloud !`);
      } catch (e) {
          alert("Échec de la synchronisation à distance.");
      }
  };

  const handleUnlockMemberFields = () => {
      if (!editingMember) return;
      setEditingMember({
          ...editingMember,
          lockedFields: []
      });
      showToast("Champs restreints déverrouillés avec succès !");
  };

  const handleQuickRenewMembership = () => {
      if (!editingMember) return;
      const year = new Date().getFullYear();
      setEditingMember({
          ...editingMember,
          membershipExpiry: `${year}-12-31`
      });
      showToast(`Cotisation validée jusqu'au 31/12/${year} !`);
  };

  const handleToggleMemberMissionStatus = async (missionId: string, status: 'present' | 'reservist' | 'absent' | 'none') => {
      if (!editingMember) return;
      try {
          await storageService.setMissionStatus(missionId, editingMember.id, status);
          const updatedMissions = await storageService.getMissions();
          setMissions(updatedMissions);
          showToast("Inscription mission mise à jour en direct !");
      } catch (err) {
          alert("Erreur lors du changement de statut sur la mission.");
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
      
      let missionToSave: Mission;
      
      if (editingMissionId) {
          const original = missions.find(m => m.id === editingMissionId);
          missionToSave = {
              id: editingMissionId,
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
              registeredUserIds: original ? (original.registeredUserIds || []) : [],
              absentUserIds: original ? (original.absentUserIds || []) : [],
              reservistUserIds: original ? (original.reservistUserIds || []) : []
          };
      } else {
          const missionId = generateUUID();
          missionToSave = {
              id: missionId,
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
              registeredUserIds: [],
              absentUserIds: [],
              reservistUserIds: []
          };
          
          // On crée automatiquement un événement correspondant avec les mêmes données
          await storageService.saveEvent({
              id: generateUUID(),
              name: missionForm.title,
              date: missionForm.date,
              location: missionForm.location || 'Non spécifié',
              createdAt: Date.now()
          });
      }

      await storageService.saveMission(missionToSave);
      
      setMissionForm({ title: '', date: '', timeStart: '', timeEnd: '', location: '', type: 'DPS', req1: 2, req2: 1, reqIde: 0, reqMed: 0 });
      setEditingMissionId(null);
      loadData(true); // Silent reload
  };

  const handleDeleteMission = async (id: string) => {
      if(confirm('Supprimer cette mission ?')) { await storageService.deleteMission(id); loadData(true); }
  };

  const handleAddNews = async () => {
      if(!newsForm.title) return;
      await adminService.saveNews({ 
          id: generateUUID(), 
          date: Date.now(), 
          title: newsForm.title, 
          content: newsForm.content, 
          url: newsForm.url ? newsForm.url.trim() : undefined,
          linkTitle: newsForm.linkTitle ? newsForm.linkTitle.trim() : undefined,
          author: 'Admin', 
          isUrgent: newsForm.isUrgent 
      });
      setNewsForm({ title: '', content: '', url: '', linkTitle: '', isUrgent: false }); loadData(true);
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
                <Button 
                    fullWidth 
                    size="sm" 
                    onClick={() => {
                        setCreateUserError('');
                        setCreateUserForm({ email: '', password: '', firstName: '', lastName: '', role: 'secouriste' });
                        setShowCreateUserModal(true);
                    }}
                    icon={<Plus className="w-4 h-4" />}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white mb-2"
                >
                    Créer un compte membre
                </Button>

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
                        {editingMissionId ? (
                            <div className="flex gap-2">
                                <Button fullWidth size="sm" onClick={handleAddMission} icon={<Save />}>Enregistrer les modifications</Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => {
                                        setEditingMissionId(null);
                                        setMissionForm({ title: '', date: '', timeStart: '', timeEnd: '', location: '', type: 'DPS', req1: 2, req2: 1, reqIde: 0, reqMed: 0 });
                                    }}
                                >
                                    Annuler
                                </Button>
                            </div>
                        ) : (
                            <Button fullWidth size="sm" onClick={handleAddMission} icon={<Plus />}>Publier la mission</Button>
                        )}
                        
                        <CollapsibleList title="Missions existantes" count={missions.length} icon={<List className="w-4 h-4"/>}>
                            {missions.map(m => (
                                <div key={m.id} className="flex justify-between items-center p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="truncate flex-1 pr-2">
                                        <span className="font-bold dark:text-white">{m.title}</span> <span className="opacity-50">({m.date})</span>
                                        {editingMissionId === m.id && <span className="ml-2 text-blue-500 font-bold">(En cours d'édition)</span>}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button 
                                            onClick={() => {
                                                setEditingMissionId(m.id);
                                                setMissionForm({
                                                    title: m.title || '',
                                                    date: m.date || '',
                                                    timeStart: m.timeStart || '',
                                                    timeEnd: m.timeEnd || '',
                                                    location: m.location || '',
                                                    type: (m.type || 'DPS') as any,
                                                    req1: m.requiredPse1 || 0,
                                                    req2: m.requiredPse2 || 0,
                                                    reqIde: m.requiredIde || 0,
                                                    reqMed: m.requiredMed || 0
                                                });
                                            }} 
                                            className="text-blue-500 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                            title="Modifier"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteMission(m.id)} 
                                            className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </CollapsibleList>
                    </div>
                )}
                
                {resourceTab === 'ACTUALITÉ' && (
                    <div className="space-y-4">
                        <input type="text" className={inputClass} placeholder="Titre Actu *" value={newsForm.title} onChange={e => setNewsForm({...newsForm, title: e.target.value})} />
                        <textarea className={inputClass} rows={2} placeholder="Message..." value={newsForm.content} onChange={e => setNewsForm({...newsForm, content: e.target.value})} />
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-1">Lien externe (optionnel)</label>
                                <input type="url" className={inputClass} placeholder="https://..." value={newsForm.url} onChange={e => setNewsForm({...newsForm, url: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-1">Texte du bouton lien (optionnel)</label>
                                <input type="text" className={inputClass} placeholder="Ex: Consulter le document" value={newsForm.linkTitle} onChange={e => setNewsForm({...newsForm, linkTitle: e.target.value})} />
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs font-bold text-red-500 cursor-pointer"><input type="checkbox" checked={newsForm.isUrgent} onChange={e => setNewsForm({...newsForm, isUrgent: e.target.checked})} /> Urgent / Important</label>
                        <Button fullWidth size="sm" onClick={handleAddNews}>Publier l'actualité</Button>
                        
                        <CollapsibleList title="Historique Actualités" count={news.length} icon={<List className="w-4 h-4"/>}>
                            {news.map(n => (
                                <div key={n.id} className="flex justify-between items-center p-2 border-b last:border-0 border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="truncate flex-1 pr-2">
                                        <span className="font-bold dark:text-white block">{n.title}</span>
                                        {n.url && (
                                            <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline inline-flex items-center gap-1 truncate">
                                                🔗 {n.linkTitle || n.url}
                                            </a>
                                        )}
                                    </div>
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
                        {/* BADGE COMMANDES VESTIAIRE */}
                        <div>
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Shirt className="w-4 h-4 text-emerald-500" /> Vestiaire & Badges
                            </h3>
                            <div className="bg-slate-100 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">Badge "Commande en cours"</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Affiche le badge "Commande en cours" sur la carte Vestiaire du tableau de bord</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={!!appConfig?.clothingOrderInProgress}
                                        onChange={async (e) => {
                                            if (!appConfig) return;
                                            const updated = { ...appConfig, clothingOrderInProgress: e.target.checked };
                                            setAppConfig(updated);
                                            await adminService.saveConfig(updated);
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>
                        </div>

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

                        {/* SECTION ADMINISTRATION DE VERSION */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin-slow text-red-500" /> Administration de Version
                            </h3>
                            <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-200 dark:border-red-900/50 space-y-3">
                                <p className="text-xs text-red-700 dark:text-red-300">
                                    En cas de déploiement d'une nouvelle version majeure ou pour corriger un problème de synchronisation global, vous pouvez forcer tous les utilisateurs connectés à actualiser leur application.
                                </p>
                                {appConfig?.forcedUpdateAt && (
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                        Dernière mise à jour forcée demandée : {new Date(parseInt(appConfig.forcedUpdateAt)).toLocaleString()}
                                    </p>
                                )}
                                <Button 
                                    variant="danger" 
                                    size="sm" 
                                    onClick={handleTriggerForcedUpdate}
                                    icon={<RefreshCw className="w-4 h-4" />}
                                >
                                    Forcer la mise à jour pour tous les utilisateurs
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminCard>

        {/* MODAL CRÉATION UTILISATEUR */}
        {showCreateUserModal && (
            <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" style={{ zIndex: 1000 }}>
                <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                        <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                            <Plus className="w-5 h-5 text-indigo-600" /> Créer un Utilisateur
                        </h3>
                        <button onClick={() => setShowCreateUserModal(false)} className="p-1 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800"><X className="w-5 h-5" /></button>
                    </div>
                    
                    <form onSubmit={handleAdminCreateUser} className="flex flex-col flex-1 overflow-hidden">
                        <div className="p-6 overflow-y-auto space-y-4">
                            {createUserError && (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    <span>{createUserError}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Prénom</label>
                                    <input 
                                        type="text" 
                                        required
                                        className={inputClass} 
                                        placeholder="Jean"
                                        value={createUserForm.firstName} 
                                        onChange={e => setCreateUserForm({...createUserForm, firstName: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Nom</label>
                                    <input 
                                        type="text" 
                                        required
                                        className={inputClass} 
                                        placeholder="Dupont"
                                        value={createUserForm.lastName} 
                                        onChange={e => setCreateUserForm({...createUserForm, lastName: e.target.value})} 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Email</label>
                                <input 
                                    type="email" 
                                    required
                                    className={inputClass} 
                                    placeholder="jean.dupont@test.com"
                                    value={createUserForm.email} 
                                    onChange={e => setCreateUserForm({...createUserForm, email: e.target.value})} 
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Mot de passe (Min. 6 car.)</label>
                                <input 
                                    type="password" 
                                    required
                                    className={inputClass} 
                                    placeholder="******"
                                    value={createUserForm.password} 
                                    onChange={e => setCreateUserForm({...createUserForm, password: e.target.value})} 
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Rôle / Fonction</label>
                                <select 
                                    className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 dark:text-white text-sm"
                                    value={createUserForm.role}
                                    onChange={e => setCreateUserForm({...createUserForm, role: e.target.value as UserRole})}
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
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-3 sticky bottom-0 z-20">
                            <Button type="button" variant="outline" fullWidth onClick={() => setShowCreateUserModal(false)} className="dark:text-slate-200 dark:border-slate-600">Annuler</Button>
                            <Button type="submit" fullWidth disabled={isCreatingUser} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                                {isCreatingUser ? "Création..." : "Créer le compte"}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL ÉDITION INTEGRALE & DÉPANNAGE COMPTE MEMBRE */}
        {editingMember && (
            <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in" style={{ zIndex: 1000 }}>
                <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-700">
                    
                    {/* EN-TÊTE DE LA MODAL */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-black text-base shadow-inner text-white uppercase">
                                {editingMember.firstName?.[0] || 'U'}{editingMember.lastName?.[0] || ''}
                            </div>
                            <div>
                                <h3 className="font-bold text-base flex items-center gap-2">
                                    {editingMember.firstName} {editingMember.lastName}
                                    <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                        {editingMember.role}
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-400 flex items-center gap-2">
                                    <span>{editingMember.email}</span>
                                    {editingMember.phone && <span>• {editingMember.phone}</span>}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setEditingMember(null)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* TOAST NOTIFICATION S'IL Y A UNE ACTION REUSSIE */}
                    {actionSuccessMsg && (
                        <div className="bg-emerald-500 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-inner animate-in fade-in">
                            <span className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> {actionSuccessMsg}
                            </span>
                            <button onClick={() => setActionSuccessMsg('')} className="p-0.5 hover:bg-emerald-600 rounded"><X className="w-3.5 h-3.5"/></button>
                        </div>
                    )}

                    {/* NAVIGATION PAR ONGLETS */}
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 border-b border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0 scrollbar-none">
                        {[
                            { id: 'IDENTITÉ', label: 'Identité & Auth', icon: <Users className="w-3.5 h-3.5"/> },
                            { id: 'RÔLE', label: 'Rôle & Cotisation', icon: <Shield className="w-3.5 h-3.5"/> },
                            { id: 'DIPLÔMES', label: 'Diplômes', icon: <Award className="w-3.5 h-3.5"/> },
                            { id: 'VESTIAIRE', label: 'Vestiaire & Tailles', icon: <Shirt className="w-3.5 h-3.5"/> },
                            { id: 'MISSIONS', label: 'Missions & Planning', icon: <List className="w-3.5 h-3.5"/> },
                            { id: 'DÉPANNAGE', label: 'Dépannage Flash', icon: <Activity className="w-3.5 h-3.5 text-amber-500"/> },
                        ].map((t: any) => (
                            <button 
                                key={t.id} 
                                onClick={() => setMemberModalTab(t.id)} 
                                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all shrink-0 ${
                                    memberModalTab === t.id 
                                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/40'
                                }`}
                            >
                                {t.icon}
                                <span>{t.label}</span>
                            </button>
                        ))}
                    </div>
                    
                    {/* CONTENU DU CORPS DU MODAL */}
                    <div className="p-5 overflow-y-auto flex-1 space-y-6">

                        {/* ONGLET 1: IDENTITÉ & AUTH */}
                        {memberModalTab === 'IDENTITÉ' && (
                            <div className="space-y-4 animate-in fade-in">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-500" /> Informations Personnelles & Compte
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Prénom</label>
                                        <input className={inputClass} value={editingMember.firstName || ''} onChange={e => setEditingMember({...editingMember, firstName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Nom</label>
                                        <input className={inputClass} value={editingMember.lastName || ''} onChange={e => setEditingMember({...editingMember, lastName: e.target.value})} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Email (Identifiant de connexion)</label>
                                        <input className={inputClass} value={editingMember.email || ''} onChange={e => setEditingMember({...editingMember, email: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Numéro de Téléphone</label>
                                        <input className={inputClass} placeholder="06 12 34 56 78" value={editingMember.phone || ''} onChange={e => setEditingMember({...editingMember, phone: e.target.value})} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    <div>
                                        <label className={labelClass}>Points de Formation / Gamification</label>
                                        <input 
                                            type="number" 
                                            className={inputClass} 
                                            value={editingMember.points ?? 0} 
                                            onChange={e => setEditingMember({...editingMember, points: parseInt(e.target.value) || 0})} 
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Modifier le mot de passe (Dépannage local)</label>
                                        <input 
                                            type="password" 
                                            className={inputClass} 
                                            placeholder="Nouveau mot de passe (Optionnel)"
                                            value={memberPassword} 
                                            onChange={e => setMemberPassword(e.target.value)} 
                                        />
                                        <span className="text-[10px] text-slate-400 mt-1 block">Laissez vide pour conserver le mot de passe actuel.</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ONGLET 2: RÔLE & COTISATION */}
                        {memberModalTab === 'RÔLE' && (
                            <div className="space-y-5 animate-in fade-in">
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-3">
                                    <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                        <Shield className="w-4 h-4" /> Fonction & Droits d'Accès
                                    </h4>
                                    
                                    <div className="space-y-2">
                                        <label className={labelClass}>Rôle attribué</label>
                                        <select 
                                            className="w-full p-3 rounded-lg font-bold bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                                            value={editingMember.role}
                                            onChange={e => setEditingMember({...editingMember, role: e.target.value as UserRole})}
                                        >
                                            <option value="secouriste">Secouriste (PSE1/PSE2)</option>
                                            <option value="infirmier">Infirmier (IDE)</option>
                                            <option value="medecin">Médecin Urgentiste</option>
                                            <option value="logisticien">Logisticien / Matériel</option>
                                            <option value="snu">SNU (Stagiaire Service National)</option>
                                            <option value="stagiaire">Stagiaire (Interne)</option>
                                            <option value="admin">Administrateur (Accès Total)</option>
                                            <option value="organisateur">Organisateur Externe</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-emerald-500" /> Cotisation Annuelle Association
                                        </h4>
                                        <Button size="sm" variant="outline" onClick={handleQuickRenewMembership} className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                            Régler pour {currentYear}
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <label className={labelClass}>Valide jusqu'au 31 Décembre de l'année :</label>
                                            <select
                                                className={inputClass}
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
                                                <option value={currentYear - 2}>{currentYear - 2} (Très ancien)</option>
                                                <option value={currentYear - 1}>{currentYear - 1} (Expiré)</option>
                                                <option value={currentYear}>{currentYear} (En cours)</option>
                                                <option value={currentYear + 1}>{currentYear + 1} (Prochaine année)</option>
                                            </select>
                                        </div>
                                        <div className={`p-3 rounded-xl flex items-center gap-2 shrink-0 ${
                                            editingMember.membershipExpiry && new Date(editingMember.membershipExpiry) >= new Date()
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
                                        }`}>
                                            {editingMember.membershipExpiry && new Date(editingMember.membershipExpiry) >= new Date() ? (
                                                <>
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                                    <span className="text-xs font-bold">À jour</span>
                                                </>
                                            ) : (
                                                <>
                                                    <AlertCircle className="w-5 h-5 text-rose-600" />
                                                    <span className="text-xs font-bold">Non réglée</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ONGLET 3: DIPLÔMES & RECYCLAGES */}
                        {memberModalTab === 'DIPLÔMES' && (
                            <div className="space-y-5 animate-in fade-in">
                                <div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <Award className="w-4 h-4 text-purple-500" /> Diplômes & Qualifications Actuels
                                    </h4>

                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                                        {(editingMember.diplomas || []).map(d => (
                                            <div key={d.id} className="p-3 flex justify-between items-center text-xs hover:bg-white dark:hover:bg-slate-800/60 transition-colors">
                                                <div>
                                                    <span className="font-bold text-slate-800 dark:text-white block text-sm">{d.name}</span>
                                                    <div className="flex gap-3 text-[11px] text-slate-500 mt-0.5">
                                                        <span>Obtenu : {d.dateObtained}</span>
                                                        {d.expiresAt && (
                                                            <span className={new Date(d.expiresAt) < new Date() ? 'text-red-500 font-bold' : 'text-emerald-600'}>
                                                                • Recyclage : {d.expiresAt}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleRemoveDiplomaFromMember(d.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!editingMember.diplomas || editingMember.diplomas.length === 0) && (
                                            <div className="p-4 text-xs text-slate-400 italic text-center">Aucune qualification enregistrée.</div>
                                        )}
                                    </div>
                                </div>

                                {/* AJOUT RAPIDE 1-CLIC */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Ajout Rapide en 1 Clic :</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            { name: 'PSE 1', years: 1 },
                                            { name: 'PSE 2', years: 1 },
                                            { name: 'BNSSA', years: 5 },
                                            { name: 'SSA', years: 1 },
                                            { name: 'Chef de Poste DPS', years: 3 },
                                            { name: 'Formateur PS', years: 3 },
                                            { name: 'IDE (Infirmier)', years: 0 },
                                            { name: 'Médecin Urgentiste', years: 0 },
                                            { name: 'Permis B (VPSP)', years: 5 },
                                        ].map(p => (
                                            <button
                                                key={p.name}
                                                onClick={() => handleAddPresetDiploma(p.name, p.years)}
                                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 text-xs font-bold rounded-lg border border-purple-200 dark:border-purple-800 transition-colors flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" /> {p.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* FORMULAIRE AJOUT PERSONNALISÉ */}
                                <div className="bg-slate-100 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Ajouter une qualification personnalisée :</span>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="sm:col-span-1">
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Intitulé Diplôme</label>
                                            <input type="text" placeholder="Ex: PHTLS" className={inputClass} value={tempDiploma.name || ''} onChange={e => setTempDiploma({...tempDiploma, name: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Date d'obtention</label>
                                            <input type="date" className={inputClass} value={tempDiploma.dateObtained || ''} onChange={e => setTempDiploma({...tempDiploma, dateObtained: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Recyclage / Expiration</label>
                                            <input type="date" className={inputClass} value={tempDiploma.expiresAt || ''} onChange={e => setTempDiploma({...tempDiploma, expiresAt: e.target.value})} />
                                        </div>
                                    </div>
                                    <Button size="sm" fullWidth onClick={handleAddDiplomaToMember} icon={<Plus className="w-4 h-4"/>}>
                                        Ajouter le diplôme
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* ONGLET 4: VESTIAIRE & TAILLES */}
                        {memberModalTab === 'VESTIAIRE' && memberUniform && (
                            <div className="space-y-5 animate-in fade-in">
                                <div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                                        <Shirt className="w-4 h-4 text-indigo-500" /> Tailles de Vêtement du Secouriste
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div>
                                            <label className={labelClass}>Haut (T-Shirt/Polo)</label>
                                            <select 
                                                className={inputClass} 
                                                value={memberUniform.sizes?.top || 'M'}
                                                onChange={e => setMemberUniform({...memberUniform, sizes: {...memberUniform.sizes, top: e.target.value}})}
                                            >
                                                {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'].map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Bas (Pantalon)</label>
                                            <select 
                                                className={inputClass} 
                                                value={memberUniform.sizes?.bottom || '40'}
                                                onChange={e => setMemberUniform({...memberUniform, sizes: {...memberUniform.sizes, bottom: e.target.value}})}
                                            >
                                                {['36', '38', '40', '42', '44', '46', '48', '50', '52'].map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Pointure Chaussures</label>
                                            <select 
                                                className={inputClass} 
                                                value={memberUniform.sizes?.shoes || '42'}
                                                onChange={e => setMemberUniform({...memberUniform, sizes: {...memberUniform.sizes, shoes: e.target.value}})}
                                            >
                                                {['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'].map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Casquette / Tête</label>
                                            <select 
                                                className={inputClass} 
                                                value={memberUniform.sizes?.head || 'M'}
                                                onChange={e => setMemberUniform({...memberUniform, sizes: {...memberUniform.sizes, head: e.target.value}})}
                                            >
                                                {['S', 'M', 'L', 'Unique'].map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Shirt className="w-4 h-4 text-indigo-500" /> Dotations & Quantités Attribuées
                                    </h4>

                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                                        {(memberUniform.items || []).map((item: any, idx: number) => (
                                            <div key={item.type || idx} className="p-3 flex items-center justify-between text-xs gap-3">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <input 
                                                        type="checkbox"
                                                        checked={item.hasItem}
                                                        onChange={e => {
                                                            const updatedItems = [...memberUniform.items];
                                                            updatedItems[idx].hasItem = e.target.checked;
                                                            setMemberUniform({...memberUniform, items: updatedItems});
                                                        }}
                                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className={`font-bold truncate ${item.hasItem ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through'}`}>
                                                        {item.label}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <select
                                                        className="p-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-800 dark:text-white"
                                                        value={item.condition || 'NEUF'}
                                                        onChange={e => {
                                                            const updatedItems = [...memberUniform.items];
                                                            updatedItems[idx].condition = e.target.value;
                                                            setMemberUniform({...memberUniform, items: updatedItems});
                                                        }}
                                                    >
                                                        <option value="NEUF">Neuf</option>
                                                        <option value="BON">Bon état</option>
                                                        <option value="USÉ">Usé</option>
                                                        <option value="HS">À remplacer</option>
                                                    </select>

                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-slate-400 font-bold">Qté :</span>
                                                        <input 
                                                            type="number" 
                                                            min={0}
                                                            max={10}
                                                            className="w-12 p-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs text-center font-bold bg-white dark:bg-slate-800 dark:text-white"
                                                            value={item.requestedQty || 1}
                                                            onChange={e => {
                                                                const updatedItems = [...memberUniform.items];
                                                                updatedItems[idx].requestedQty = parseInt(e.target.value) || 0;
                                                                setMemberUniform({...memberUniform, items: updatedItems});
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ONGLET 5: MISSIONS & PLANNING */}
                        {memberModalTab === 'MISSIONS' && (
                            <div className="space-y-4 animate-in fade-in">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <List className="w-4 h-4 text-blue-500" /> Inscriptions du Membre aux Missions
                                </h4>

                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                                    {missions.map(m => {
                                        const isPresent = (m.registeredUserIds || []).includes(editingMember.id);
                                        const isAbsent = (m.absentUserIds || []).includes(editingMember.id);
                                        const isReservist = (m.reservistUserIds || []).includes(editingMember.id);

                                        return (
                                            <div key={m.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                                <div>
                                                    <span className="font-bold text-slate-900 dark:text-white text-sm block">{m.title}</span>
                                                    <span className="text-slate-500 text-[11px]">{m.date} • {m.location} ({m.type})</span>
                                                </div>

                                                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                                    <button 
                                                        onClick={() => handleToggleMemberMissionStatus(m.id, 'present')}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                                            isPresent 
                                                                ? 'bg-emerald-600 text-white shadow-sm' 
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100'
                                                        }`}
                                                    >
                                                        Présent
                                                    </button>
                                                    <button 
                                                        onClick={() => handleToggleMemberMissionStatus(m.id, 'reservist')}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                                            isReservist 
                                                                ? 'bg-amber-600 text-white shadow-sm' 
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100'
                                                        }`}
                                                    >
                                                        Réserve
                                                    </button>
                                                    <button 
                                                        onClick={() => handleToggleMemberMissionStatus(m.id, 'none')}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                                            !isPresent && !isReservist && !isAbsent 
                                                                ? 'bg-slate-700 text-white' 
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200'
                                                        }`}
                                                    >
                                                        Retirer
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {missions.length === 0 && (
                                        <div className="p-4 text-xs text-slate-400 italic text-center">Aucune mission enregistrée dans l'application.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ONGLET 6: DÉPANNAGE FLASH */}
                        {memberModalTab === 'DÉPANNAGE' && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/40 space-y-3">
                                    <h4 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-amber-500" /> Actions de Télécommandage & Dépannage
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-300">
                                        Si le secouriste rencontre un blocage sur son appareil (données non synchronisées, champs verrouillés ou problème de session), vous pouvez forcer la résolution à distance.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button 
                                        onClick={handleRemoteSyncMember}
                                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-xl flex items-center gap-3 text-left transition-all shadow-sm"
                                    >
                                        <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 shrink-0">
                                            <RefreshCw className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="font-bold text-xs block text-slate-900 dark:text-white">Forcer Synchro Cloud</span>
                                            <span className="text-[10px] text-slate-500">Pousse immédiatement le profil du membre sur Supabase</span>
                                        </div>
                                    </button>

                                    <button 
                                        onClick={handleUnlockMemberFields}
                                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 rounded-xl flex items-center gap-3 text-left transition-all shadow-sm"
                                    >
                                        <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 shrink-0">
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="font-bold text-xs block text-slate-900 dark:text-white">Déverrouiller le Profil</span>
                                            <span className="text-[10px] text-slate-500">Efface les champs bloqués (`lockedFields`)</span>
                                        </div>
                                    </button>

                                    <button 
                                        onClick={handleQuickRenewMembership}
                                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 rounded-xl flex items-center gap-3 text-left transition-all shadow-sm"
                                    >
                                        <div className="p-2.5 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 shrink-0">
                                            <Award className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="font-bold text-xs block text-slate-900 dark:text-white">Valider la Cotisation</span>
                                            <span className="text-[10px] text-slate-500">Active la cotisation de l'année en cours</span>
                                        </div>
                                    </button>

                                </div>
                            </div>
                        )}

                    </div>

                    {/* PIED DE MODAL AVEC BOUTONS D'ACTION */}
                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-3 sticky bottom-0 z-20 shrink-0">
                        <Button variant="outline" fullWidth onClick={() => setEditingMember(null)} className="dark:text-slate-200 dark:border-slate-600">
                            Annuler
                        </Button>
                        <Button fullWidth onClick={handleSaveMember} disabled={isSavingMember} icon={isSavingMember ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                            {isSavingMember ? "Sauvegarde..." : "Enregistrer les modifications"}
                        </Button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </Layout>
  );
};
