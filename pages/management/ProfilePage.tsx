
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { storageService } from '../../services/storageService';
import { Button } from '../../components/Button';
import { User, Phone, Save, LogOut, Trash2, Database, Award, Plus, Pencil, X, Loader2, TrendingUp, Calendar, Mail, Edit3, Settings, Bell, CreditCard, ExternalLink, Download, FileCheck, Map as MapIcon, CalendarCheck, CheckCircle2, AlertCircle, Shield, QrCode, ChevronRight, Moon, HeartPulse, Sun, Monitor, Eye, Navigation, Layers, Building2, Radio, Flame, Plane, Zap, Stethoscope, Key, Lock } from 'lucide-react';
import { generateUUID } from '../../utils/security';
import { Diploma, UserProfile, Mission, AppConfig } from '../../types';
import { deleteDB } from 'idb';
import QRCode from 'qrcode';
import { useTheme } from '../../context/ThemeContext';
import { addHeaderLogo } from '../../services/pdfUtils';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { OPS_DATA } from '../../data/opsData';

// Fix Leaflet Icons
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const iconShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
    iconUrl: iconUrl,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Composant Helper pour centrer sur la position utilisateur
const LocationMarker = () => {
    const [position, setPosition] = useState<L.LatLng | null>(null);
    const map = useMap();

    useEffect(() => {
        map.locate().on("locationfound", function (e) {
            setPosition(e.latlng);
            map.flyTo(e.latlng, 12);
        });
    }, [map]);

    return position === null ? null : (
        <Marker position={position} icon={L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        })}>
            <Popup>Vous êtes ici</Popup>
        </Marker>
    );
};

// Icônes personnalisées
const createIcon = (type: 'HOSP' | 'FIRE' | 'DZ' | 'DAE' | 'MMG', color: string) => {
    let svgContent = '';
    if (type === 'HOSP') svgContent = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 2v20M2 12h20"/></svg>'; // Croix Rouge
    else if (type === 'FIRE') svgContent = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
    else if (type === 'DZ') svgContent = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>'; // Héliport
    else if (type === 'DAE') svgContent = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'; // Éclair
    else if (type === 'MMG') svgContent = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6"/><path d="M12 10v6"/></svg>'; // Dossier/Croix

    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="w-8 h-8 rounded-full ${color} border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs">
            ${svgContent}
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
};

interface NotifSettings {
    new_mission: boolean;     // Création de mission (général)
    new_training: boolean;    // Nouvelle formation
    new_document: boolean;    // Nouveau doc
    mission_reminder: boolean;// Rappel veille de mission (J-1)
    diploma_alert: boolean;   // Rappel recyclage diplôme
    logistics_alert: boolean; // Alerte Stock/Véhicule (si concerné)
    push_notifications: boolean; // Global push notifications
}

// Chemin vers l'image dans le dossier public
const CARD_BG_IMAGE = '/member_card_bg.png';

export const ProfilePage: React.FC = () => {
    const { profile, refreshProfile, signOut } = useAuth();
    const { themeMode, setThemeMode } = useTheme();
    const location = useLocation();
    
    // UI States
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [showDiplomaModal, setShowDiplomaModal] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    useEffect(() => {
        if (location.state?.openSettings) {
            setShowSettings(true);
        }
    }, [location]);
    
    // MAP STATES
    const [showMapModal, setShowMapModal] = useState(false);
    const [mapLayers, setMapLayers] = useState({ hospitals: true, fire: true, dz: false, dae: false, mmg: false });
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    // Form States
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState<Partial<UserProfile>>(profile || {});
    const [diplomaForm, setDiplomaForm] = useState<Partial<Diploma>>({});
    
    // Default Settings
    const [notifSettings, setNotifSettings] = useState<NotifSettings>({
        new_mission: true, 
        new_training: true, 
        new_document: true,
        mission_reminder: true,
        diploma_alert: true,
        logistics_alert: true,
        push_notifications: true
    });
    
    // Data
    const [myMissions, setMyMissions] = useState<Mission[]>([]);
    const [totalHours, setTotalHours] = useState(0);
    const [config, setConfig] = useState<AppConfig | null>(null);

    const isSnu = profile?.role === 'snu';
    const isLogistics = profile?.role === 'admin' || profile?.role === 'logisticien';

    // Verrouillage du scroll d'arrière-plan quand un modal est ouvert
    useEffect(() => {
        const isAnyModalOpen = showSettings || showDiplomaModal || showQrModal || showMapModal || isEditingProfile || showPasswordModal;
        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showSettings, showDiplomaModal, showQrModal, showMapModal, isEditingProfile, showPasswordModal]);

    useEffect(() => {
        loadMissions();
        loadConfig();
        const saved = localStorage.getItem('dps65_notif_settings');
        if (saved) {
            try { 
                const parsed = JSON.parse(saved);
                // Merge avec les défauts pour gérer les nouvelles clés
                setNotifSettings(prev => ({ ...prev, ...parsed })); 
            } catch (e) {}
        }
        if (profile) {
            generateMemberQr();
        }
    }, [profile]);

    const loadConfig = async () => {
        const c = await storageService.getConfig();
        setConfig(c);
    };

    const generateMemberQr = async () => {
        if (!profile) return;
        try {
            // QR Code contenant l'ID membre (pour pointage futur)
            const url = await QRCode.toDataURL(JSON.stringify({ type: 'MEMBER_ID', id: profile.id, name: `${profile.firstName} ${profile.lastName}` }));
            setQrCodeUrl(url);
        } catch (e) { console.error(e); }
    };

    const loadMissions = async () => {
        if (!profile) return;
        const allMissions = await storageService.getMissions();
        const userMissions = allMissions.filter(m => m.registeredUserIds?.includes(profile.id));
        setMyMissions(userMissions);

        let minutes = 0;
        userMissions.forEach(m => {
            if (m.timeStart && m.timeEnd) {
                const [h1, m1] = m.timeStart.split(':').map(Number);
                const [h2, m2] = m.timeEnd.split(':').map(Number);
                let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (diff < 0) diff += 24 * 60;
                minutes += diff;
            }
        });
        
        let calculatedHours = Math.floor(minutes / 60);
        
        // SNU Cap at 84 hours
        if (profile.role === 'snu' && calculatedHours > 84) {
            calculatedHours = 84;
        }
        
        setTotalHours(calculatedHours);
    };

    const toggleNotif = (key: keyof NotifSettings) => {
        const newSettings = { ...notifSettings, [key]: !notifSettings[key] };
        setNotifSettings(newSettings);
        localStorage.setItem('dps65_notif_settings', JSON.stringify(newSettings));
    };

    const isMembershipActive = () => {
        if (!profile?.membershipExpiry) return false;
        return new Date(profile.membershipExpiry) >= new Date();
    };

    const isActive = isMembershipActive();
    const expiryDate = profile?.membershipExpiry ? new Date(profile.membershipExpiry).toLocaleDateString() : 'Non définie';

    const handleSaveProfile = async () => {
        if (!profile?.id) return;
        setIsSaving(true);
        try {
            await authService.updateProfile(profile.id, {
                firstName: editForm.firstName,
                lastName: editForm.lastName,
                phone: editForm.phone
            });
            await refreshProfile();
            setIsEditingProfile(false);
        } catch (e) { alert("Erreur de sauvegarde"); } finally { setIsSaving(false); }
    };

    const handleSavePassword = async () => {
        setPasswordError('');
        setPasswordSuccess('');
        
        if (newPassword.length < 6) {
            setPasswordError('Le mot de passe doit faire au moins 6 caractères.');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            setPasswordError('Les mots de passe ne correspondent pas.');
            return;
        }
        
        setIsUpdatingPassword(true);
        try {
            await authService.changePassword(newPassword);
            setPasswordSuccess('Mot de passe mis à jour avec succès !');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                setShowPasswordModal(false);
                setPasswordSuccess('');
            }, 1500);
        } catch (err: any) {
            setPasswordError(err.message || 'Erreur lors de la mise à jour du mot de passe.');
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleExportCalendar = () => {
        if (myMissions.length === 0) { alert("Aucune mission planifiée."); return; }
        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//DPS65//App//FR\n";
        icsContent += "METHOD:PUBLISH\n";
        myMissions.forEach(m => {
            const missionDate = new Date(m.date);
            if (missionDate < new Date(Date.now() - 86400000 * 30)) return;
            const startStr = m.date.replace(/-/g, '') + 'T' + m.timeStart.replace(':', '') + '00';
            const endStr = m.date.replace(/-/g, '') + 'T' + m.timeEnd.replace(':', '') + '00';
            icsContent += "BEGIN:VEVENT\n";
            icsContent += `SUMMARY:Mission DPS65: ${m.title}\n`;
            icsContent += `DTSTART:${startStr}\nDTEND:${endStr}\nLOCATION:${m.location}\n`;
            icsContent += "END:VEVENT\n";
        });
        icsContent += "END:VCALENDAR";
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a'); link.href = window.URL.createObjectURL(blob); link.setAttribute('download', 'planning_dps65.ics');
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleSaveDiploma = async () => {
        if (!profile?.id || !diplomaForm.name || !diplomaForm.dateObtained) return;
        try {
            let updatedDiplomas = profile.diplomas ? [...profile.diplomas] : [];
            if (diplomaForm.id) {
                updatedDiplomas = updatedDiplomas.map(d => d.id === diplomaForm.id ? { ...diplomaForm, id: d.id } as Diploma : d);
            } else {
                updatedDiplomas.push({ id: generateUUID(), name: diplomaForm.name!, dateObtained: diplomaForm.dateObtained!, expiresAt: diplomaForm.expiresAt });
            }
            await authService.updateProfile(profile.id, { diplomas: updatedDiplomas });
            await refreshProfile();
            setShowDiplomaModal(false);
            setDiplomaForm({});
        } catch (e) { alert("Erreur diplôme"); }
    };

    const handleDeleteDiploma = async (id: string) => {
        if (!profile?.id || !confirm("Supprimer ce diplôme ?")) return;
        const updated = (profile.diplomas || []).filter(d => d.id !== id);
        await authService.updateProfile(profile.id, { diplomas: updated });
        await refreshProfile();
    };

    const handleWipeLocalData = async () => {
        if (confirm("Effacer cache local ?")) {
            try {
                const { initDB } = await import('../../services/db');
                const db = await initDB();
                const storeNames = Array.from(db.objectStoreNames);
                const tx = db.transaction(storeNames as any, 'readwrite');
                for (const storeName of storeNames) {
                    await tx.objectStore(storeName as any).clear();
                }
                await tx.done;
                alert("Cache local vidé avec succès !");
                window.location.reload();
            } catch (err) {
                console.error("Failed to clear IndexedDB stores, falling back to deleteDB", err);
                try {
                    await deleteDB('dps65_db_local');
                    window.location.reload();
                } catch (e) {
                    alert("Erreur lors de la réinitialisation du cache.");
                }
            }
        }
    };

    const handleDeleteAccount = async () => {
        if (confirm("ATTENTION : Irréversible. Continuer ?")) { if (profile?.id) { await authService.deleteAccount(profile.id); signOut(); } }
    };

    const handlePayContribution = () => {
        if (config?.yaplaLink) {
            window.open(config.yaplaLink, '_blank');
        } else {
            alert("Lien de paiement non configuré.");
        }
    };

    const handleDownloadAttestation = () => {
        if (!profile) return;
        import('jspdf').then(async (jsPDFModule) => {
            try {
                // Correction Import jsPDF (Default ou Named export selon le bundler)
                const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
                const doc = new jsPDF();
                
                await addHeaderLogo(doc);
                
                doc.setFontSize(22);
                doc.setTextColor(41, 128, 185);
                doc.text("ATTESTATION D'ENGAGEMENT", 105, 30, { align: "center" });
                
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text(`Nous, Association DPS 65, certifions que :`, 20, 60);
                
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text(`${profile.firstName} ${profile.lastName}`, 105, 80, { align: "center" });
                
                doc.setFontSize(12);
                doc.setFont("helvetica", "normal");
                doc.text(`A réalisé un volume horaire bénévole de :`, 20, 100);
                
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text(`${totalHours} heures`, 105, 115, { align: "center" });
                
                doc.setFontSize(12);
                doc.setFont("helvetica", "normal");
                doc.text(`Au titre de ses missions de sécurité civile.`, 20, 130);
                
                doc.text(`Fait à Tarbes, le ${new Date().toLocaleDateString('fr-FR')}`, 120, 160);
                doc.text("La Présidence", 120, 170);
                
                doc.save(`Attestation_Benevolat_${profile.lastName}.pdf`);
            } catch (e) {
                console.error(e);
                alert("Erreur lors de la génération du PDF.");
            }
        });
    };

    const getExpiryStatus = (dateStr?: string) => {
        if (!dateStr) return { color: 'bg-emerald-100 text-emerald-700', label: 'Valide' };
        const today = new Date();
        const exp = new Date(dateStr);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
        if (diffDays < 0) return { color: 'bg-red-100 text-red-700', label: 'Expiré' };
        if (diffDays < 90) return { color: 'bg-orange-100 text-orange-700', label: `Exp. ${diffDays}j` };
        return { color: 'bg-emerald-100 text-emerald-700', label: 'Valide' };
    };

    const inputClass = "w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all";
    const labelClass = "text-[10px] font-black uppercase text-slate-400 mb-1 block tracking-wider";

    const NotifRow = ({ label, code, visible = true }: { label: string, code: keyof NotifSettings, visible?: boolean }) => {
        if (!visible) return null;
        return (
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-sm font-medium text-slate-300">{label}</span>
                <button onClick={() => toggleNotif(code)} className={`w-10 h-6 rounded-full p-1 transition-colors ${notifSettings[code] ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${notifSettings[code] ? 'translate-x-4' : ''}`}></div>
                </button>
            </div>
        );
    };

    return (
        <Layout title="Mon Espace" showBack="/management" hideSync={true}>
            <div className="max-w-2xl mx-auto space-y-6 pb-24">
                
                {/* 1. CARTE D'IDENTITÉ NUMÉRIQUE - Masqué pour SNU */}
                {!isSnu && (
                    <div className="relative w-full aspect-[1.586/1] max-w-sm mx-auto perspective-1000 group cursor-pointer" onClick={() => setShowQrModal(true)}>
                        <div className="relative w-full h-full transition-transform duration-500 transform-style-3d group-hover:scale-[1.02]">
                            {/* Recto */}
                            <div className="absolute inset-0 w-full h-full rounded-2xl shadow-2xl p-5 border border-slate-600/30 flex flex-col justify-between overflow-hidden bg-slate-900">
                                {/* BACKGROUND IMAGE (Fichier local) */}
                                <img 
                                    src={CARD_BG_IMAGE}
                                    alt="Background" 
                                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                                    onError={(e) => e.currentTarget.style.opacity = '0'} // Masque l'image si introuvable
                                />
                                
                                {/* Overlay Gradient léger pour lisibilité */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-slate-900/50"></div>

                                <div className="absolute bottom-0 left-0 p-4 opacity-10"><Shield className="w-32 h-32 text-white" /></div>

                                {/* Top: Logo & Title */}
                                <div className="flex justify-between items-start z-10">
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <h2 className="text-white font-black text-sm uppercase tracking-wider leading-none drop-shadow-sm">DPS 65</h2>
                                            <p className="text-[9px] text-blue-200 font-bold uppercase tracking-widest">Sécurité Civile</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Middle: Photo & Info */}
                                <div className="flex items-center gap-4 z-10 flex-1 pl-1">
                                    <div className="w-20 h-20 rounded-xl bg-slate-800 border-2 border-slate-600 flex items-center justify-center overflow-hidden shadow-lg relative ring-2 ring-white/10 shrink-0">
                                        <div className="absolute inset-0 bg-white"></div>
                                        <img src="/logo" alt="Logo" className="w-full h-full object-contain relative z-10" onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-xl font-black text-white uppercase leading-tight mb-1 drop-shadow-md truncate">{profile?.lastName}</h1>
                                        <h2 className="text-lg font-medium text-slate-200 capitalize drop-shadow-sm truncate">{profile?.firstName}</h2>
                                        <span className="inline-block mt-2 px-2 py-0.5 bg-yellow-500 text-black text-[10px] font-bold uppercase rounded tracking-wider shadow-lg border border-yellow-400">
                                            {profile?.role}
                                        </span>
                                    </div>
                                </div>

                                {/* Bottom: QR Hint */}
                                <div className="flex justify-between items-end z-10 w-full">
                                    <div className="text-[9px] text-slate-300 uppercase font-mono bg-slate-900/60 px-2 py-1 rounded backdrop-blur-md border border-white/10">
                                        Valide jusqu'au : <span className="text-white font-bold">{expiryDate}</span>
                                    </div>
                                    <QrCode className="w-6 h-6 text-white opacity-90 drop-shadow-sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. BENTO GRID */}
                <div className={`grid ${isSnu ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                    
                    {/* STATUS BLOCK (Cotisation) - Masqué pour SNU */}
                    {!isSnu && (
                        <div 
                            onClick={!isActive ? handlePayContribution : undefined}
                            className={`p-4 rounded-2xl border flex flex-col justify-between h-32 transition-all relative overflow-hidden ${isActive ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900' : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-900 cursor-pointer hover:shadow-md'}`}
                        >
                            <div className={`p-2 w-fit rounded-xl mb-2 ${isActive ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30 animate-pulse'}`}>
                                {isActive ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-black opacity-60 block">Cotisation</span>
                                <span className={`text-lg font-black ${isActive ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-800 dark:text-red-400'}`}>
                                    {isActive ? 'À jour' : 'Inactif'}
                                </span>
                            </div>
                            {!isActive && <div className="absolute bottom-3 right-3"><ChevronRight className="w-4 h-4 text-red-400" /></div>}
                        </div>
                    )}

                    {/* TOOLS BLOCK (MINI GRID) */}
                    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 h-32 ${isSnu ? 'col-span-1' : ''}`}>
                        <div className={`grid ${isSnu ? 'grid-cols-4' : 'grid-cols-2'} gap-2 h-full`}>
                            <button onClick={handleExportCalendar} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl flex flex-col items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors">
                                <CalendarCheck className="w-5 h-5 mb-1" />
                                <span className="text-[8px] font-bold uppercase">Planning</span>
                            </button>
                            <button onClick={() => setShowMapModal(true)} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl flex flex-col items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors">
                                <MapIcon className="w-5 h-5 mb-1" />
                                <span className="text-[8px] font-bold uppercase">Carte 65</span>
                            </button>
                            <button onClick={() => { setEditForm(profile || {}); setIsEditingProfile(true); }} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl flex flex-col items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors">
                                <Edit3 className="w-5 h-5 mb-1" />
                                <span className="text-[8px] font-bold uppercase">Profil</span>
                            </button>
                            <button onClick={() => setShowSettings(true)} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl flex flex-col items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors">
                                <Settings className="w-5 h-5 mb-1" />
                                <span className="text-[8px] font-bold uppercase">Réglages</span>
                            </button>
                        </div>
                    </div>

                    {/* ENGAGEMENT BLOCK (WIDE) */}
                    <div className={`${isSnu ? 'col-span-1' : 'col-span-2'} bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between`}>
                        <div className="absolute right-0 bottom-0 p-4 opacity-10"><Award className="w-24 h-24" /></div>
                        
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-xs font-bold uppercase opacity-80">Mon Engagement</h3>
                                    <button onClick={handleDownloadAttestation} className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-colors" title="Télécharger Attestation">
                                        <Download className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="text-3xl font-black leading-none">{totalHours} <span className="text-base font-medium opacity-80">h</span> {isSnu && <span className="text-xs opacity-60">/ 84h</span>}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold leading-none">{myMissions.length}</div>
                                <div className="text-[10px] font-bold uppercase opacity-80">Missions</div>
                            </div>
                        </div>

                        {/* BARRE DE PROGRESSION SNU */}
                        {isSnu && (
                            <div className="relative z-10 mt-3">
                                <div className="flex justify-between text-[10px] font-bold opacity-90 mb-1">
                                    <span>Objectif SNU</span>
                                    <span>{Math.min(100, Math.round((totalHours / 84) * 100))}%</span>
                                </div>
                                <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden backdrop-blur-sm">
                                    <div 
                                        className="bg-white h-full rounded-full transition-all duration-1000 ease-out" 
                                        style={{ width: `${Math.min(100, Math.round((totalHours / 84) * 100))}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. DIPLÔMES (LISTE COMPACTE) */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[300px]">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Award className="w-4 h-4"/> Qualifications ({profile?.diplomas?.length || 0})
                        </h3>
                        <button onClick={() => { setDiplomaForm({}); setShowDiplomaModal(true); }} className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <div className="overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {(!profile?.diplomas || profile.diplomas.length === 0) && (
                            <div className="p-6 text-center text-slate-400 text-xs italic">
                                Aucune qualification enregistrée.
                            </div>
                        )}
                        {(profile?.diplomas || []).map(d => {
                            const status = getExpiryStatus(d.expiresAt);
                            return (
                                <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 group transition-all hover:border-blue-200 dark:hover:border-blue-800">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${status.color.replace('text-', 'bg-').replace('100', '100')}`}>
                                            <Award className={`w-4 h-4 ${status.color.split(' ')[1]}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-white leading-none truncate">{d.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-slate-500">Obtenu: {new Date(d.dateObtained).getFullYear()}</span>
                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setDiplomaForm(d); setShowDiplomaModal(true); }} className="p-2 text-slate-400 hover:text-blue-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm"><Pencil className="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteDiploma(d.id)} className="p-2 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* MODALS */}
                {/* 1. Edit Profile Modal */}
                {isEditingProfile && (
                    <div className="fixed inset-0 z-[250] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl scale-100 animate-in zoom-in-95">
                            <h3 className="font-bold text-lg mb-4 dark:text-white">Modifier Profil</h3>
                            <div className="space-y-4 mb-6">
                                <div><label className={labelClass}>Prénom</label><input type="text" className={inputClass} value={editForm.firstName || ''} onChange={e => setEditForm({...editForm, firstName: e.target.value})} /></div>
                                <div><label className={labelClass}>Nom</label><input type="text" className={inputClass} value={editForm.lastName || ''} onChange={e => setEditForm({...editForm, lastName: e.target.value})} /></div>
                                <div><label className={labelClass}>Téléphone</label><input type="tel" className={inputClass} value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" fullWidth onClick={() => setIsEditingProfile(false)}>Annuler</Button>
                                <Button variant="primary" fullWidth onClick={handleSaveProfile} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin"/> : "Enregistrer"}</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. QR Code Modal */}
                {showQrModal && (
                    <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in" onClick={() => setShowQrModal(false)}>
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500"><X className="w-5 h-5"/></button>
                            <div className="w-20 h-20 bg-blue-600 rounded-full mx-auto flex items-center justify-center text-3xl text-white font-black mb-6 shadow-lg shadow-blue-500/30">
                                {profile?.firstName?.charAt(0)}{profile?.lastName?.charAt(0)}
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase leading-none mb-1">{profile?.firstName} {profile?.lastName}</h2>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">{profile?.role}</p>
                            <div className="bg-slate-900 p-4 rounded-2xl shadow-inner inline-block">
                                {qrCodeUrl && <img src={qrCodeUrl} alt="QR Membre" className="w-48 h-48 mix-blend-screen" />}
                            </div>
                            <p className="text-xs text-slate-400 mt-6 font-mono">ID: {profile?.id.slice(0, 12)}...</p>
                        </div>
                    </div>
                )}

                {/* Password Change Modal */}
                {showPasswordModal && (
                    <div className="fixed inset-0 z-[260] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl scale-100 animate-in zoom-in-95">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold dark:text-white flex items-center gap-2">
                                    <Lock className="w-5 h-5 text-blue-500" /> Modifier le mot de passe
                                </h3>
                                <button onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(''); setNewPassword(''); setConfirmPassword(''); }} className="p-1 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            {passwordError && (
                                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{passwordError}</span>
                                </div>
                            )}

                            {passwordSuccess && (
                                <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>{passwordSuccess}</span>
                                </div>
                            )}

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className={labelClass}>Nouveau mot de passe</label>
                                    <input 
                                        type="password" 
                                        className={inputClass} 
                                        value={newPassword} 
                                        onChange={e => setNewPassword(e.target.value)} 
                                        placeholder="Min. 6 caractères"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Confirmer le mot de passe</label>
                                    <input 
                                        type="password" 
                                        className={inputClass} 
                                        value={confirmPassword} 
                                        onChange={e => setConfirmPassword(e.target.value)} 
                                        placeholder="Ressaisir le mot de passe"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    fullWidth 
                                    onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(''); setNewPassword(''); setConfirmPassword(''); }}
                                >
                                    Annuler
                                </Button>
                                <Button 
                                    variant="primary" 
                                    fullWidth 
                                    onClick={handleSavePassword} 
                                    disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                                >
                                    {isUpdatingPassword ? <Loader2 className="animate-spin w-5 h-5"/> : "Confirmer"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Settings Modal */}
                {showSettings && (
                    <div className="fixed inset-0 z-[250] bg-slate-950 flex flex-col animate-in slide-in-from-bottom h-[100dvh] w-full overscroll-none">
                        <div className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-900 shrink-0">
                            <h2 className="text-lg font-bold text-white">Réglages & Sécurité</h2>
                            <button onClick={() => setShowSettings(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 active:scale-95 transition-transform"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain pb-32">
                            
                            {/* THEME SELECTOR */}
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Apparence</h3>
                                <div className="grid grid-cols-3 gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                                    <button onClick={() => setThemeMode('light')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${themeMode === 'light' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                                        <Sun className="w-5 h-5 mb-1" />
                                        <span className="text-[10px] font-bold uppercase">Clair</span>
                                    </button>
                                    <button onClick={() => setThemeMode('dark')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${themeMode === 'dark' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                                        <Moon className="w-5 h-5 mb-1" />
                                        <span className="text-[10px] font-bold uppercase">Sombre</span>
                                    </button>
                                    <button onClick={() => setThemeMode('system')} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${themeMode === 'system' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                        <Monitor className="w-5 h-5 mb-1" />
                                        <span className="text-[10px] font-bold uppercase">Auto</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notifications</h3>
                                <NotifRow label="Notifications Push" code="push_notifications" />
                                <NotifRow label="Nouvelle Mission" code="new_mission" />
                                <NotifRow label="Nouvelle Formation" code="new_training" />
                                <NotifRow label="Nouveau Document" code="new_document" />
                                <NotifRow label="Rappel Veille Mission" code="mission_reminder" />
                                <NotifRow label="Alerte Recyclage Diplôme" code="diploma_alert" />
                                <NotifRow label="Logistique & Stocks" code="logistics_alert" visible={isLogistics} />
                            </div>
                            <div className="space-y-2 pb-safe">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Actions Compte</h3>
                                <button onClick={() => setShowPasswordModal(true)} className="w-full p-4 bg-slate-900 rounded-xl border border-slate-800 text-white font-bold flex items-center gap-3 hover:bg-slate-800 active:scale-[0.98] transition-transform"><Key className="w-5 h-5 text-blue-400" /> Modifier mon mot de passe</button>
                                <button onClick={signOut} className="w-full p-4 bg-slate-900 rounded-xl border border-slate-800 text-white font-bold flex items-center gap-3 hover:bg-slate-800 active:scale-[0.98] transition-transform"><LogOut className="w-5 h-5" /> Déconnexion</button>
                                <button onClick={handleWipeLocalData} className="w-full p-4 bg-slate-900 rounded-xl border border-orange-900/50 text-orange-500 font-bold flex items-center gap-3 hover:bg-slate-800 active:scale-[0.98] transition-transform"><Database className="w-5 h-5" /> Réparer (Vider Cache)</button>
                                <button onClick={handleDeleteAccount} className="w-full p-4 bg-red-900/20 rounded-xl border border-red-900/50 text-red-500 font-bold flex items-center gap-3 hover:bg-red-900/30 active:scale-[0.98] transition-transform"><Trash2 className="w-5 h-5" /> Supprimer mon compte</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. Diploma Modal */}
                {showDiplomaModal && (
                    <div className="fixed inset-0 z-[260] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl scale-100 animate-in zoom-in-95">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold dark:text-white flex items-center gap-2"><Award className="w-5 h-5 text-purple-500" /> Diplôme / Qualif</h3>
                                <button onClick={() => setShowDiplomaModal(false)} className="p-1 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="space-y-4 mb-6">
                                <div><label className={labelClass}>Intitulé</label><input type="text" className={inputClass} value={diplomaForm.name || ''} onChange={e => setDiplomaForm({...diplomaForm, name: e.target.value})} placeholder="ex: PSE 2" /></div>
                                <div><label className={labelClass}>Date d'obtention</label><input type="date" className={`${inputClass} dark:[color-scheme:dark]`} value={diplomaForm.dateObtained || ''} onChange={e => setDiplomaForm({...diplomaForm, dateObtained: e.target.value})} /></div>
                                <div><label className={labelClass}>Recyclage (Optionnel)</label><input type="date" className={`${inputClass} dark:[color-scheme:dark]`} value={diplomaForm.expiresAt || ''} onChange={e => setDiplomaForm({...diplomaForm, expiresAt: e.target.value})} /></div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" fullWidth onClick={() => setShowDiplomaModal(false)}>Annuler</Button>
                                <Button variant="primary" fullWidth onClick={handleSaveDiploma}>Valider</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. INTERACTIVE MAP MODAL */}
                {showMapModal && (
                    <div className="fixed inset-0 z-[300] bg-slate-950 flex flex-col animate-in fade-in zoom-in h-[100dvh] w-full">
                        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                            <button onClick={() => setShowMapModal(false)} className="p-3 bg-slate-800/90 text-white rounded-full hover:bg-slate-700 shadow-lg active:scale-95 transition-transform"><X className="w-6 h-6" /></button>
                        </div>
                        
                        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
                            <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-2 rounded-xl shadow-xl flex flex-col gap-2">
                                <button onClick={() => setMapLayers(prev => ({ ...prev, hospitals: !prev.hospitals }))} className={`p-2 rounded-lg flex items-center justify-center transition-colors ${mapLayers.hospitals ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Hôpitaux"><Building2 className="w-5 h-5" /></button>
                                <button onClick={() => setMapLayers(prev => ({ ...prev, mmg: !prev.mmg }))} className={`p-2 rounded-lg flex items-center justify-center transition-colors ${mapLayers.mmg ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`} title="Maisons Médicales"><Stethoscope className="w-5 h-5" /></button>
                                <button onClick={() => setMapLayers(prev => ({ ...prev, fire: !prev.fire }))} className={`p-2 rounded-lg flex items-center justify-center transition-colors ${mapLayers.fire ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`} title="Pompiers"><Flame className="w-5 h-5" /></button>
                                <button onClick={() => setMapLayers(prev => ({ ...prev, dz: !prev.dz }))} className={`p-2 rounded-lg flex items-center justify-center transition-colors ${mapLayers.dz ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`} title="DZ Hélico"><Plane className="w-5 h-5" /></button>
                                <button onClick={() => setMapLayers(prev => ({ ...prev, dae: !prev.dae }))} className={`p-2 rounded-lg flex items-center justify-center transition-colors ${mapLayers.dae ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-400'}`} title="DAE Public"><Zap className="w-5 h-5" /></button>
                            </div>
                        </div>

                        {/* BANDEAU GEOLOC */}
                        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[1000] flex gap-4 w-full px-4 justify-center">
                            <div className="bg-slate-900/90 backdrop-blur px-4 py-2 rounded-full border border-slate-700 text-white text-xs font-bold uppercase tracking-wider shadow-xl flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                Carte Opérationnelle 65
                            </div>
                        </div>

                        <div className="flex-1 w-full h-full relative z-0">
                            <MapContainer center={[43.2333, 0.0833]} zoom={10} style={{ height: '100%', width: '100%', background: '#0f172a' }}>
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    className="map-tiles-dark"
                                />
                                <LocationMarker />
                                
                                {mapLayers.hospitals && OPS_DATA.hospitals.map((h, i) => (
                                    <Marker key={i} position={h.pos} icon={createIcon('HOSP', 'bg-red-600')}>
                                        <Popup>
                                            <div className="text-center">
                                                <div className="font-bold text-sm">{h.name}</div>
                                                <div className="text-xs font-mono mt-1 bg-slate-100 p-1 rounded"><Phone className="w-3 h-3 inline mr-1"/>{h.tel}</div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}

                                {mapLayers.mmg && OPS_DATA.medicalHomes.map((m, i) => (
                                    <Marker key={`mmg-${i}`} position={m.pos} icon={createIcon('MMG', 'bg-emerald-600')}>
                                        <Popup>
                                            <div className="text-center">
                                                <div className="font-bold text-sm">{m.name}</div>
                                                <div className="text-xs font-mono mt-1 bg-slate-100 p-1 rounded">{m.info}</div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}

                                {mapLayers.fire && OPS_DATA.fireStations.map((f, i) => (
                                    <Marker key={`fire-${i}`} position={f.pos} icon={createIcon('FIRE', 'bg-red-500')}>
                                        <Popup>
                                            <div className="text-center">
                                                <div className="font-bold text-sm">{f.name}</div>
                                                <div className="text-xs font-mono mt-1 bg-slate-100 p-1 rounded"><Phone className="w-3 h-3 inline mr-1"/>{f.tel}</div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}

                                {mapLayers.dz && OPS_DATA.dz.map((d, i) => (
                                    <Marker key={`dz-${i}`} position={d.pos} icon={createIcon('DZ', 'bg-blue-600')}>
                                        <Popup>
                                            <div className="text-center">
                                                <div className="font-bold text-sm">{d.name}</div>
                                                <div className="text-xs font-mono mt-1 bg-slate-100 p-1 rounded">Type: {d.type}</div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}

                                {mapLayers.dae && OPS_DATA.dae.map((d, i) => (
                                    <Marker key={`dae-${i}`} position={d.pos} icon={createIcon('DAE', 'bg-green-600')}>
                                        <Popup>
                                            <div className="text-center">
                                                <div className="font-bold text-sm">{d.name}</div>
                                                <div className="text-xs font-mono mt-1 bg-slate-100 p-1 rounded">Loc: {d.loc}</div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    </div>
                )}

            </div>
        </Layout>
    );
};
